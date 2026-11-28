/* SBC 401 Table G.52-1 voltage drop limit and the long main-wiring supplement, hand-calculated against the real data. */
'use strict';
var fs = require('fs'), path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-tables.js'));
require(path.join(__dirname, '../js/eng-calc.js'));
window.EngTables.setData(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/eng-tables.json'), 'utf8')));
var C = window.EngCalc, fails = 0;
function eq(n, g, w) { var ok = Math.abs(g - w) < 1e-9; if (!ok) { fails++; console.log('FAIL ' + n + ': got ' + g + ' want ' + w); } else console.log('ok   ' + n); }
function thr(n, fn) { var t = false; try { fn(); } catch (e) { t = true; } if (!t) { fails++; console.log('FAIL ' + n + ' (no error)'); } else console.log('ok   ' + n); }
function L(s, u, m) { return C.vdropLimit({ supply: s, use: u, mainRunM: m }); }
// base limits, no long run
eq('A lighting 3', L('A', 'lighting', 50).limitPct, 3);
eq('A other 5', L('A', 'other', 50).limitPct, 5);
eq('B lighting 6', L('B', 'lighting', 50).limitPct, 6);
eq('B other 8', L('B', 'other', 50).limitPct, 8);
// boundary: exactly 100 m gives no supplement; empty length gives none
eq('100 m no supplement', L('A', 'other', 100).supplementPct, 0);
eq('empty run no supplement', C.vdropLimit({ supply: 'A', use: 'other' }).limitPct, 5);
// 120 m: 0.005 x 20 = 0.1
eq('120 m supplement 0.1', L('A', 'other', 120).supplementPct, 0.1);
eq('120 m A other 5.1', L('A', 'other', 120).limitPct, 5.1);
// 150 m: 0.25 ; B lighting 6.25
eq('150 m B lighting 6.25', L('B', 'lighting', 150).limitPct, 6.25);
// 200 m: 0.5 exactly (cap reached); 300 m stays 0.5
eq('200 m supplement 0.5', L('A', 'lighting', 200).supplementPct, 0.5);
eq('300 m capped 0.5', L('B', 'other', 300).supplementPct, 0.5);
eq('300 m B other 8.5', L('B', 'other', 300).limitPct, 8.5);
// input checks
thr('bad supply', function () { L('C', 'other', 10); });
thr('bad use', function () { L('A', 'x', 10); });
thr('negative run', function () { L('A', 'other', -5); });
// table status never above verified_secondary
eq('status verified_secondary', window.EngTables.meta('iec_60364_5_52_voltage_drop_limits_informative').status === 'verified_secondary' ? 1 : 0, 1);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL VDLIMIT TESTS PASSED');
