/* Load schedule: hand-calculated case against the REAL data/eng-tables.json. */
'use strict';
var fs = require('fs'), path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-tables.js'));
require(path.join(__dirname, '../js/eng-calc.js'));
require(path.join(__dirname, '../js/eng-loadschedule.js'));
window.EngTables.setData(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/eng-tables.json'), 'utf8')));
var L = window.EngLoadSchedule, fails = 0;
function eq(n, g, w, tol) { var ok = typeof w === 'number' ? Math.abs(g - w) <= (tol || 1e-6) : g === w; if (!ok) { fails++; console.log('FAIL ' + n + ': got ' + g + ' want ' + w); } else console.log('ok   ' + n); }
var res = L.schedule({ voltageV: 400, diversity: 0.9, sparePct: 20, ambientC: 35, loads: [
  { name: 'AHU', qty: 2, kw: 15, pf: 0.8, df: 0.8, phase: '3P' },
  { name: 'Sockets', qty: 1, kw: 10, pf: 1, df: 1, phase: 'R' },
  { name: 'Lighting', qty: 1, kw: 6, pf: 1, df: 1, phase: 'AUTO' }] });
eq('connected kVA = 37.5 + 10 + 6', res.totals.kva, 53.5);
eq('demand kVA = 30 + 10 + 6', res.totals.dkva, 46);
eq('R phase kVA = 10 (3P share) + 10', res.phases.R.kva, 20);
eq('AUTO load goes to least loaded phase Y', res.rows[2].assigned, 'Y');
eq('Y phase kVA = 10 + 6', res.phases.Y.kva, 16);
eq('B phase kVA = 10', res.phases.B.kva, 10);
eq('IR = 20000/230.94 = 86.6 A', res.phases.currents.R, 86.6, 0.05);
eq('unbalance = 30.4 %', res.unbalancePct, 30.4, 0.05);
eq('design kVA = 46 x 0.9 x 1.2 = 49.68', res.designKVA, 49.7, 0.05);
eq('Ib = 71.7 A', res.designCurrentA, 71.71, 0.01);
eq('main breaker 80 A (first standard In >= 71.7)', res.mainBreakerA, 80);
eq('incomer size chosen from tables', typeof res.incomerSizeMm2, 'number');
eq('table sources reported', res.tablesUsed.length > 0, true);
eq('unbalance warning present', res.warnings.some(function (w) { return w.indexOf('عدم الاتزان') >= 0; }), true);
var bal = L.schedule({ voltageV: 400, sizeIncomer: false, loads: [{ kw: 9, phase: '3P', pf: 1 }] });
eq('pure 3P load: unbalance 0', bal.unbalancePct, 0);
eq('3P 9 kW pf1: each phase 3 kVA', bal.phases.R.kva, 3);
var thr = false; try { L.schedule({ loads: [] }); } catch (e) { thr = true; } eq('empty schedule throws', thr, true);
var d = L.pdfDoc(res); eq('pdf doc blocks', d.blocks.map(function (b) { return b.type; }).join(','), 'summary,status,warnings,table,table,table');
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-LOADSCHEDULE TESTS PASSED');
