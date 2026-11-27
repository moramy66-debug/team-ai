/* Tests for js/eng-isc.js. Every expected value is worked by hand in the comment above it. */
'use strict';
global.window = {};
require('../js/eng-isc.js');
var C = window.EngIsc.calculate, fails = 0;
function near(n, g, w, t) { if (!(Math.abs(g - w) <= t)) { fails++; console.log('FAIL ' + n + ': got ' + g + ' want ' + w); } else console.log('ok   ' + n); }
function eq(n, g, w) { if (g !== w) { fails++; console.log('FAIL ' + n + ': got ' + g + ' want ' + w); } else console.log('ok   ' + n); }
// MVA_tx = 1/0.05 = 20 ; MVA_sc = 1/(1/500+1/20) = 1/0.052 = 19.2308 ; Isc = 19.2308*1000/(1.73205*400) = 27.757 kA
var a = C({ method: 'mva', gridMva: 500, txKva: 1000, txZPct: 5, vLL: 400 });
near('MVA sc', a.mvaSc, 19.2308, 0.001); near('MVA Isc kA', a.iscKA, 27.757, 0.01);
// infinite grid: 20 MVA -> 20000/692.82 = 28.868 kA
near('infinite grid', C({ method: 'mva', txKva: 1000, txZPct: 5, vLL: 400 }).iscKA, 28.868, 0.01);
// Z = hypot(0.004, 0.012) = 0.012649 ; Isc = 230.94/0.012649/1000 = 18.257 kA
near('ohmic c=1', C({ method: 'ohmic', vLL: 400, rOhm: 0.004, xOhm: 0.012, cFactor: 1 }).iscKA, 18.257, 0.005);
// c=1.05 -> 19.170 kA
near('ohmic c=1.05', C({ method: 'ohmic', vLL: 400, rOhm: 0.004, xOhm: 0.012, cFactor: 1.05 }).iscKA, 19.170, 0.005);
// Rc=0.193*50/1000=0.00965 ; Xc=0.08*50/1000=0.004 ; Rt=0.003+0.00965=0.01265 ; Xt=0.01+0.004=0.014 ; Z=0.018868 ; Isc=230.94/0.018868/1000=12.239 kA
var b = C({ method: 'ohmic', vLL: 400, rOhm: 0.003, xOhm: 0.01, cableLenM: 50, rCableOhmKm: 0.193, xCableOhmKm: 0.08, cFactor: 1 });
near('ohmic cable Z', b.zTotalOhm, 0.018868, 0.00001); near('ohmic cable Isc', b.iscKA, 12.239, 0.005);
// ip = 1.8 x 1.41421 x 20 = 50.912 kA
near('peak', C({ method: 'peak', vLL: 400, ikKa: 20, kappa: 1.8 }).ipPeakKA, 50.912, 0.005);
// 350 x 1000 / (1.73205 x 13800) = 14.643 kA
near('given MVA', C({ method: 'mvasc', mvaSc: 350, vLL: 13800 }).iscKA, 14.643, 0.005);
eq('zero impedance error', C({ method: 'ohmic', vLL: 400, rOhm: 0, xOhm: 0 }).ok, false);
eq('negative grid MVA error', C({ method: 'mva', gridMva: -100, txKva: 1000, txZPct: 5, vLL: 400 }).ok, false);
eq('zero voltage error', C({ method: 'mvasc', mvaSc: 10, vLL: 0 }).ok, false);
eq('kappa out of range error', C({ method: 'peak', vLL: 400, ikKa: 20, kappa: 3 }).ok, false);
eq('peak needs kappa', C({ method: 'peak', vLL: 400, ikKa: 20 }).ok, false);
eq('result is flagged needs_review', /needs_review/.test(a.summary), true);
eq('no standard number in text', /(IEC|ISO|IEEE|BS|NEC|SBC)\s?\d/.test(JSON.stringify(a)), false);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); } console.log('all ok');
