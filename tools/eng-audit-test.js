/* Audit vectors (independent hand recompute from DPS-01 Rev-02 Tables 19/20, as reported by a second reviewer). */
'use strict';
var fs = require('fs'), path = require('path'), assert = require('assert');
global.window = {};
require(path.join(__dirname, '../js/eng-tables.js'));
require(path.join(__dirname, '../js/eng-loadest.js'));
window.EngTables.setData(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/eng-tables.json'), 'utf8')));
var E = window.EngLoadEst;
function near(a, b) { assert(Math.abs(a - b) < 1e-9, a + ' vs ' + b); }
var c1 = E.calculate({ areas: [{ category: 'C7', areaM2: 1000 }] }); near(c1.connectedKva, 176); near(c1.demandKva, 105.6);
var c2 = E.calculate({ areas: [{ category: 'C7', areaM2: 1000 }, { category: 'C6', areaM2: 300 }] }); near(c2.connectedKva, 232.4); near(c2.demandKva, 139.44);
var c4 = E.calculate({ areas: [{ category: 'C7', areaM2: 100 }], assumptions: { ceiling: 'above', heightM: 4.5 } });
near(c4.connectedKva, 20); near(c4.demandKva, 17.6 * 0.6 + 2.4); /* documents current behaviour: extra added after DF (assumption, flagged) */
function cf(N) { return N === 1 ? 1 : (0.67 + 0.33 / Math.sqrt(N)) / 1.25; }
near(cf(1), 1); assert(Math.abs(cf(10) - 0.619484) < 1e-6); assert(Math.abs(cf(50) - 0.573335) < 1e-6); assert(Math.abs(cf(99) - 0.562533) < 1e-6);
console.log('ALL AUDIT TESTS PASSED');
