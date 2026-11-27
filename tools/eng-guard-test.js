/* Overflow guard and edge-case tests for UPS, Generator, Transformer, Load Schedule, PFC/CPC. */
'use strict';
global.window = {};
['eng-transformer', 'eng-generator', 'eng-ups', 'eng-loadschedule', 'eng-pfc-cpc'].forEach(function (f) { require('../js/' + f + '.js'); });
var fails = 0;
function eq(n, g, w) { if (g !== w) { fails++; console.log('FAIL ' + n + ': got ' + g + ' want ' + w); } else console.log('ok   ' + n); }
[1e308, Infinity].forEach(function (x) {
  eq('UPS load ' + x + ' rejected', window.EngUps.calculate({ loadKw: x, runtimeMin: 15 }).ok, false);
  eq('Generator load ' + x + ' rejected', window.EngGenerator.calculate({ continuousKw: x, pf: 0.8, largestMotorKw: x }).ok, false);
});
eq('UPS normal case ok', window.EngUps.calculate({ loadKw: 40, loadPf: 0.8, sparePct: 15, runtimeMin: 15 }).ok, true);
eq('Generator normal case ok', window.EngGenerator.calculate({ continuousKw: 160, pf: 0.8, largestMotorKw: 45, startMethod: 'DOL' }).ok, true);
eq('Transformer normal case ok', window.EngTransformer.calculate({ demandKva: 500 }).ok, true);
var ls = window.EngLoadSchedule.schedule({ loads: [{ kw: 10, df: 0 }, { kw: 10, df: '' }, { kw: 10 }, { kw: 10, df: 0.5 }] });
eq('DF 0 stays 0', ls.rows[0].df, 0);
eq('DF blank defaults to 1', ls.rows[1].df, 1);
eq('DF missing defaults to 1', ls.rows[2].df, 1);
var dfmsg = ''; try { window.EngLoadSchedule.schedule({ loads: [{ kw: 10, df: 1.5 }] }); } catch (e) { dfmsg = e.message; }
eq('DF 1.5 gives a clear error', dfmsg.indexOf('Demand factor غير صالح') >= 0, true);
dfmsg = ''; try { window.EngLoadSchedule.schedule({ loads: [{ kw: 10, df: -0.5 }] }); } catch (e) { dfmsg = e.message; }
eq('DF negative gives a clear error', dfmsg.indexOf('Demand factor غير صالح') >= 0, true);
var trz = window.EngTransformer.calculate({ demandKva: 500, impedancePct: 0 });
var pfm = ''; try { window.EngLoadSchedule.schedule({ loads: [{ kw: 10, pf: 1.5 }] }); } catch (e) { pfm = e.message; }
eq('Load PF 1.5 gives a clear error', pfm.indexOf('Power Factor غير صالح') >= 0, true);
pfm = ''; try { window.EngLoadSchedule.schedule({ loads: [{ kw: 10, pf: 0 }] }); } catch (e) { pfm = e.message; }
eq('Load PF 0 gives a clear error', pfm.indexOf('Power Factor غير صالح') >= 0, true);
eq('Load PF blank defaults to 0.85', window.EngLoadSchedule.schedule({ loads: [{ kw: 10, pf: '' }] }).rows[0].pf, 0.85);
var vm = ''; try { window.EngLoadSchedule.schedule({ loads: [{ kw: 10 }], voltageV: 0 }); } catch (e) { vm = e.message; }
eq('Load schedule voltage 0 gives a clear error', vm.indexOf('Voltage غير صالح') >= 0, true);
eq('Load schedule voltage blank uses 400', window.EngLoadSchedule.schedule({ loads: [{ kw: 10 }] }).ok !== false, true);
eq('Transformer Z 0 gives a clear error', trz.ok === false && String(trz.error).indexOf('Impedance') >= 0, true);
eq('Transformer Z blank uses default', window.EngTransformer.calculate({ demandKva: 500 }).ok, true);
eq('DF 0.5 kept', ls.rows[3].df, 0.5);
var cp = window.EngPfcCpc.cpc({ currentA: 1000, timeS: 6, conductor: 'Cu', insulation: 'PVC', kind: 'insulated', phaseMm2: 30 });
eq('CPC t>5 s warns that adiabatic is not valid', (cp.warnings || []).some(function (w) { return String(w).indexOf('5 ثواني') >= 0; }), true);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-GUARD TESTS PASSED');
