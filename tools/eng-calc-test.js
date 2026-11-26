/* Runs the calculators against the REAL data/eng-tables.json with hand-calculated cases. */
'use strict';
var fs = require('fs'), path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-tables.js'));
require(path.join(__dirname, '../js/eng-calc.js'));
var data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/eng-tables.json'), 'utf8'));
window.EngTables.setData(data);
var C = window.EngCalc, fails = 0;
function eq(name, got, want, tol) {
  var ok = typeof want === 'number' ? Math.abs(got - want) <= (tol || 1e-6) : got === want;
  if (!ok) { fails++; console.log('FAIL ' + name + ': got ' + got + ' want ' + want); } else console.log('ok   ' + name);
}
function has(name, arr, sub) {
  var ok = arr.some(function (x) { return String(x).indexOf(sub) >= 0; });
  if (!ok) { fails++; console.log('FAIL ' + name + ' (missing: ' + sub + ')'); } else console.log('ok   ' + name);
}
// Raw table checks (values read by hand from the table, B.52.5 XLPE Cu 3 loaded, col C)
var t5 = window.EngTables.get('iec_b52_5_xlpe_cu_3loaded'), ci = t5.columns.indexOf('C');
eq('B.52.5 4mm2 method C = 40 A (D1 col would be 36)', t5.rows.filter(function (r) { return r[0] === 4; })[0][ci], 40);
var t4 = window.EngTables.get('iec_b52_4_pvc_cu_3loaded');
eq('B.52.4 1.5mm2 method C = 17.5 A', t4.rows[0][t4.columns.indexOf('C')], 17.5);

// Case 1: breaker. Ib=45 A, SF 1 -> MCB list [6,10,13,16,20,25,32,40,50,...] -> 50 A.
var b = C.breakerSelection({ designCurrentA: 45, type: 'MCB', cableAmpacityA: 75 });
eq('breaker 45A MCB -> 50', b.rating_a, 50);
eq('breaker coordinated 45<=50<=75', b.coordinated, true);
// Ib=45 any -> MCB 50 (first >=45)
eq('breaker any 45 -> MCB', C.breakerSelection({ designCurrentA: 45, type: 'any' }).type, 'MCB');
// Ib=70 any -> no MCB >=70 within 63? MCB list has 80 -> 80
eq('breaker 70A MCB -> 80', C.breakerSelection({ designCurrentA: 70, type: 'MCB' }).rating_a, 80);
eq('breaker MCCB table status passes through', C.breakerSelection({ designCurrentA: 150, type: 'MCCB' }).table.status, 'from_memory_needs_review');

// Case 2: voltage drop, 4D1B. 4 mm2 Cu PVC 3ph: table 3ph_AB. read by hand below.
var t4d = window.EngTables.get('bs7671_4d1b_voltage_drop_cu_70c_upto16mm2');
var mv4 = t4d.rows.filter(function (r) { return r[0] === 4; })[0][t4d.columns.indexOf('3ph_AB')];
// dV = mv * I * L / 1000 = mv*20*50/1000
var v1 = C.voltageDrop({ size_mm2: 4, currentA: 20, lengthM: 50, phases: 3, voltageV: 400, conductor: 'Cu', insulation: 'PVC', powerFactor: 0.85 });
eq('vdrop 4mm2 PVC 3ph uses 4D1B', v1.methodUsed, 'bs7671_4d1b');
eq('vdrop 4mm2 value', v1.vdropV, Math.round(mv4 * 20 * 50 / 1000 * 1000) / 1000, 1e-9);
eq('vdrop table status passes', v1.table.status, 'verified_mirror');
// Case 3: computed, 35 mm2 Cu XLPE 3ph, I=100, L=100 m, PF 0.85, theta 90.
// R20=0.524; R90 = 0.524*(1+0.00393*70) = 0.524*1.2751 = 0.66815; X=0.08; sin=sqrt(1-0.7225)=0.52678
// dV = 1.7320508*100*0.1*(0.66815*0.85+0.08*0.52678)=17.320508*(0.567928+0.042142)=17.320508*0.610070=10.5667
var v2 = C.voltageDrop({ size_mm2: 35, currentA: 100, lengthM: 100, phases: 3, voltageV: 400, conductor: 'Cu', insulation: 'XLPE', powerFactor: 0.85 });
eq('vdrop 35mm2 computed method', v2.methodUsed, 'computed_r_x');
eq('vdrop 35mm2 value ~10.567 V', v2.vdropV, 10.567, 0.01);
has('25mm2+ computed note', v2.warnings, 'مش من جدول BS 7671 4D1B');
has('from_memory status warning', v2.warnings, 'from_memory_needs_review');
// Case 4: cable sizing. 3ph XLPE Cu, Ib=60 A, 35 C air, 1 circuit, method C.
// Ca(XLPE,35C)=0.96, Cg=1 -> Ct=0.96. In: MCB >= 60 -> 63. Iz_req=63/0.96=65.625 A.
// B.52.5 col C: 6mm2=? read below; first size with value >= 65.625.
var rows = t5.rows.slice().sort(function (a, b2) { return a[0] - b2[0]; });
var want = rows.filter(function (r) { return r[ci] >= 65.625; })[0][0];
var cs = C.cableSizing({ phases: 3, voltageV: 400, currentA: 60, powerFactor: 0.85, conductor: 'Cu', insulation: 'XLPE', method: 'air', ambientC: 35, circuits: 1 });
eq('sizing Ca = 0.96', cs.factors.ca, 0.96);
eq('sizing In = 63', cs.breaker.rating_a, 63);
eq('sizing Iz_req', cs.requiredBaseAmpacityA, 65.63, 0.01);
eq('sizing size matches hand lookup', cs.size_mm2, want);
eq('sizing table is B.52.5', cs.table.key, 'iec_b52_5_xlpe_cu_3loaded');
eq('sizing table status shown', cs.table.status, 'verified_mirror');
// Case 5: grouping, 3 circuits bunched = 0.70
var cg = C.cableSizing({ phases: 3, currentA: 20, conductor: 'Cu', insulation: 'PVC', method: 'air', ambientC: 30, circuits: 3 });
eq('grouping 3 circuits = 0.7', cg.factors.cg, 0.7);
eq('ambient 30C = 1', cg.factors.ca, 1);
// Case 6: power input 3ph: P=30 kW, V=400, PF 0.85 -> Ib=30000/(1.73205*400*0.85)=50.944
var cp = C.cableSizing({ phases: 3, powerKW: 30, voltageV: 400, powerFactor: 0.85, conductor: 'Al', insulation: 'XLPE', method: 'ground', ambientC: 20, circuits: 1 });
eq('Ib from kW ~50.94', cp.designCurrentA, 50.94, 0.01);
// Error cases
var threw = false; try { C.cableSizing({ conductor: 'Cu' }); } catch (e) { threw = true; }
eq('missing current/power throws', threw, true);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-CALC TESTS PASSED');
