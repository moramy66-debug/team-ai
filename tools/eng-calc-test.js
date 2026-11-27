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
// ---- Buried grouping (B.52.18 direct D2, B.52.19 ducts D1), values read by hand from the tables ----
function cgOf(o) { return C.cableSizing(Object.assign({ phases: 3, currentA: 30, conductor: 'Cu', insulation: 'XLPE', ambientC: 20 }, o)).factors.cg; }
eq('D2 3 circuits touching = 0.65', cgOf({ method: 'ground', circuits: 3 }), 0.65);
eq('D2 3 circuits 0.25 m = 0.80', cgOf({ method: 'ground', circuits: 3, spacing: '0.25' }), 0.8);
eq('D2 4 circuits one diameter = 0.60', cgOf({ method: 'ground', circuits: 4, spacing: 'one_diameter' }), 0.6);
eq('D2 10 circuits -> next listed (12) touching = 0.36', cgOf({ method: 'ground', circuits: 10 }), 0.36);
eq('D2 1 circuit = 1', cgOf({ method: 'ground', circuits: 1 }), 1);
eq('D1 multicore 4 ducts 0.5 m = 0.85', cgOf({ method: 'duct', circuits: 4, spacing: '0.5' }), 0.85);
eq('D1 single-core 3 ducts touching = 0.70', cgOf({ method: 'duct', circuits: 3, ductCable: 'single' }), 0.7);
var thr = false; try { cgOf({ method: 'duct', circuits: 3, spacing: 'one_diameter' }); } catch (e) { thr = true; }
eq('D1 with spacing one_diameter throws (not in B.52.19)', thr, true);
var sus = C.cableSizing({ phases: 3, currentA: 30, conductor: 'Cu', insulation: 'XLPE', method: 'ground', ambientC: 20, circuits: 16, spacing: '0.5' });
eq('D2 16 circuits 0.5 m = 0.68 (corrected from ti-soft typo 0.38 per Eupen 4.4.8)', cgOf({ method: 'ground', circuits: 16, spacing: '0.5' }), 0.68);
eq('buried sizing uses table B.52.5 col D2 (not estimate)', sus.steps.filter(function (x) { return x.step === 'معامل التجميع Cg'; })[0].formula.indexOf('B.52.18') >= 0, true);

// ---- Short circuit: I2t <= k2 S2 ----
// 4 mm2 XLPE Cu: k=143 -> 143^2*16 = 20449*16 = 327,184 A2s (Schneider G53: 0.3272e6)
var sc1 = C.shortCircuit({ size_mm2: 4, conductor: 'Cu', insulation: 'XLPE', iscKA: 10, letThroughKA2s: 0.05 });
eq('4mm2 XLPE Cu withstand = 327184', sc1.withstandA2s, 327184);
eq('let-through 0.05 kA2s passes', sc1.ok, true);
// Smin = sqrt(50000)/143 = 223.607/143 = 1.5637
eq('Smin = 1.56', sc1.minSizeMm2, 1.56, 0.01);
eq('k table status passes through', sc1.table.status, 'verified_secondary');
var sc2 = C.shortCircuit({ size_mm2: 4, conductor: 'Cu', insulation: 'XLPE', iscKA: 10, letThroughKA2s: 0.5 });
eq('let-through 0.5 kA2s fails (5e5 > 327184)', sc2.ok, false);
// 1.5 mm2 PVC Cu: 115^2*2.25 = 13225*2.25 = 29756.25 (Schneider G53: 0.0297e6)
eq('1.5mm2 PVC Cu withstand = 29756.25', C.shortCircuit({ size_mm2: 1.5, insulation: 'PVC', conductor: 'Cu', iscKA: 6, letThroughKA2s: 0.01 }).withstandA2s, 29756.25, 0.01);
// 4 mm2 PVC Cu, Isc 10 kA, t 0.1 s: I2t = 1e8*0.1 = 1e7; withstand 211,600 -> fail; Smin = sqrt(1e7)/115 = 27.50; tmax = 211600/1e8 = 0.002116
var sc3 = C.shortCircuit({ size_mm2: 4, insulation: 'PVC', conductor: 'Cu', iscKA: 10, clearingTimeS: 0.1 });
eq('time basis I2t = 1e7', sc3.letThroughA2s, 1e7, 1);
eq('time basis fails', sc3.ok, false);
eq('Smin = 27.50', sc3.minSizeMm2, 27.5, 0.01);
eq('tmax = 0.002 s', sc3.maxTimeS, 0.002, 0.0005);
// 4 mm2 Al XLPE: 94^2*16 = 8836*16 = 141,376
eq('Al XLPE k=94', C.shortCircuit({ size_mm2: 4, insulation: 'XLPE', conductor: 'Al', iscKA: 5, letThroughKA2s: 0.01 }).withstandA2s, 141376);
has('time basis flagged as an estimate', sc3.warnings, 'تقدير');
var thr2 = false; try { C.shortCircuit({ size_mm2: 4, iscKA: 5 }); } catch (e) { thr2 = true; }
eq('no let-through and no time throws', thr2, true);

// Error cases
var threw = false; try { C.cableSizing({ conductor: 'Cu' }); } catch (e) { threw = true; }
eq('missing current/power throws', threw, true);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-CALC TESTS PASSED');
