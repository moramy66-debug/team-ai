/* Load Estimate against the real data, hand-calculated: 11862.5 m2 offices C7 176 VA/m2, 836.27 m2 restaurant C6 188 VA/m2, DF 0.6 once. */
'use strict';
var fs = require('fs'), path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-tables.js'));
require(path.join(__dirname, '../js/eng-loadest.js'));
window.EngTables.setData(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/eng-tables.json'), 'utf8')));
var E = window.EngLoadEst, fails = 0;
function eq(n, g, w, tol) { var ok = typeof w === 'number' ? Math.abs(g - w) <= (tol || 1e-6) : g === w; if (!ok) { fails++; console.log('FAIL ' + n + ': got ' + g + ' want ' + w); } else console.log('ok   ' + n); }
var r = E.calculate({ areas: [{ category: 'C7', areaM2: 11862.5 }, { category: 'C6', areaM2: 836.27 }], sensitivity: true });
eq('ok', r.ok, true);
eq('offices CL = 11862.5 x 176 / 1000', r.rows[0].connectedKva, 2087.8, 1e-9);
eq('restaurant CL = 836.27 x 188 / 1000', r.rows[1].connectedKva, 157.22, 0.005);
eq('total CL', r.connectedKva, 2087.8 + 836.27 * 188 / 1000, 1e-9);
eq('demand = CL x 0.6 once', r.demandKva, (2087.8 + 836.27 * 188 / 1000) * 0.6, 1e-9);
eq('2015 sensitivity CL', r.sensitivity.connectedKva, 11862.5 * 0.22 + 836.27 * 0.235, 1e-9);
eq('2015 sensitivity DL at 0.6', r.sensitivity.demandKva, (11862.5 * 0.22 + 836.27 * 0.235) * 0.6, 1e-9);
eq('2015 sensitivity DL at 0.70', r.sensitivity.demandKvaDf070, (11862.5 * 0.22 + 836.27 * 0.235) * 0.7, 1e-9);
var c = E.calculate({ areas: [{ category: 'custom', areaM2: 100, densityVaM2: 144, demandFactor: 0.5 }] });
eq('custom DL = 100 x 144 / 1000 x 0.5', c.demandKva, 7.2, 1e-9);
eq('custom labeled assumption', c.rows[0].basis.indexOf('assumption') === 0, true);
eq('bad category', E.calculate({ areas: [{ category: 'C9', areaM2: 10 }] }).ok, false);
eq('zero area', E.calculate({ areas: [{ category: 'C7', areaM2: 0 }] }).ok, false);
eq('custom needs DF', E.calculate({ areas: [{ category: 'custom', areaM2: 10, densityVaM2: 100 }] }).ok, false);
eq('status', window.EngTables.meta('sec_dps01_load_density_demand').status, 'verified_secondary');
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL LOADEST TESTS PASSED');
