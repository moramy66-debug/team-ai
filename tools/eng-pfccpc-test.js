/* PFC and CPC: hand-calculated cases. */
'use strict';
var path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-pfc-cpc.js'));
var L = window.EngPfcCpc, fails = 0;
function eq(n, g, w, tol) { var ok = typeof w === 'number' ? Math.abs(g - w) <= (tol || 1e-6) : g === w; if (!ok) { fails++; console.log('FAIL ' + n + ': got ' + g + ' want ' + w); } else console.log('ok ' + n); }
function thr(n, f) { try { f(); fails++; console.log('FAIL ' + n + ' (no throw)'); } catch (e) { console.log('ok ' + n); } }
/* PFC: P = 500 kW, 0.80 -> 0.95. tan(acos 0.8) = 0.75 ; tan(acos 0.95) = 0.312250/0.95 = 0.328684. Qc = 500 x 0.421316 = 210.66 kVAR */
var a = L.pfc({ pKW: 500, pfExisting: 0.8, pfTarget: 0.95, voltageV: 400 });
eq('Qc 500kW 0.8->0.95', a.qcKVAR, 210.7, 0.05);
eq('standard step >= 210.7 is 250', a.standardKVAR, 250);
/* S1 = 625 kVA -> I1 = 625000/(1.7320508 x 400) = 902.1 A ; S2 = 526.32 -> I2 = 759.7 A */
eq('I before', a.currentBeforeA, 902.1, 0.1);
eq('I after', a.currentAfterA, 759.7, 0.1);
var b = L.pfc({ pKW: 100, pfExisting: 0.96, pfTarget: 0.95 });
eq('no correction needed', b.qcKVAR, 0);
thr('P zero throws', function () { L.pfc({ pKW: 0, pfExisting: 0.8 }); });
thr('PF > 1 throws', function () { L.pfc({ pKW: 10, pfExisting: 1.2 }); });
/* CPC: I = 10 kA, t = 0.5 s -> I2t = 5e7 ; sqrt = 7071.07 */
var c = L.cpc({ iscKA: 10, timeS: 0.5, conductor: 'Cu', insulation: 'PVC', kind: 'multicore' });
eq('k Cu PVC multicore', c.k, 115);
eq('S = 7071.07/115 = 61.49', c.adiabaticMm2, 61.49, 0.01);
eq('standard 70', c.selectedMm2, 70);
var d = L.cpc({ iscKA: 10, timeS: 0.5, conductor: 'Cu', insulation: 'XLPE', kind: 'multicore', phaseMm2: 95 });
eq('k Cu XLPE multicore', d.k, 143);
eq('S = 7071.07/143 = 49.45', d.adiabaticMm2, 49.45, 0.01);
eq('standard 50', d.selectedMm2, 50);
eq('simplified 95/2 = 47.5', d.simplifiedMm2, 47.5);
var e = L.cpc({ iscKA: 10, timeS: 0.5, conductor: 'Cu', insulation: 'XLPE', kind: 'insulated' });
eq('k Cu XLPE insulated 176 -> 40.18', e.adiabaticMm2, 40.18, 0.01);
var f = L.cpc({ iscKA: 1, timeS: 0.1, conductor: 'Al', insulation: 'XLPE', kind: 'multicore', separated: 'unprotected' });
/* sqrt(1e6 x 0.1) = 316.2 / 94 = 3.36 -> mechanical min 4 */
eq('mechanical minimum 4 wins', f.selectedMm2, 4);
var g = L.cpc({ letThroughKA2s: 20, conductor: 'Cu', insulation: 'PVC', kind: 'multicore' });
/* sqrt(20e6)=4472.1/115 = 38.89 -> 50 */
eq('datasheet I2t', g.adiabaticMm2, 38.89, 0.01);
eq('datasheet standard 50', g.selectedMm2, 50);
thr('missing time throws', function () { L.cpc({ iscKA: 10 }); });
/* capacitor bank current (v153): 100 kVAR, 400 V, 3-phase: 100000 / (sqrt(3) x 400) = 144.34 A */
var cap = L.pfc({ pKW: 100, pfExisting: 0.8, pfTarget: 0.95, voltageV: 400, capKVAR: 100 });
eq('capacitor current 144.34 A', cap.capacitorCurrentA, 144.34, 0.01);
eq('capacitor current absent when blank', L.pfc({ pKW: 100, pfExisting: 0.8, pfTarget: 0.95 }).capacitorCurrentA, null);
thr('capacitor kVAR 0 throws', function () { L.pfc({ pKW: 100, pfExisting: 0.8, pfTarget: 0.95, capKVAR: 0 }); });
if (fails) { console.log(fails + ' FAILED'); process.exit(1); } else console.log('ALL OK');
