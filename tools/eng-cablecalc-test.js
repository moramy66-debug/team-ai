'use strict';
var assert = require('assert');
global.window = {};
require('../js/eng-cablecalc.js');
var C = window.EngCableCalc.calculate;
function near(a, e, t) { assert(Math.abs(a - e) <= (t || 1e-3), 'expected ' + e + ' got ' + a); }
// Hand values
near(C({ method: 'ib', kw: 75, voltageV: 400, phases: 3, pf: 0.88, eff: 0.92 }).ibA, 133.712, 0.002);
near(C({ method: 'ib', kw: 75, voltageV: 400, phases: 3, pf: 0.88 }).ibA, 123.01, 0.01);
near(C({ method: 'it', inA: 100, ca: 0.87, cg: 0.7 }).itA, 164.204, 0.002);
var a = C({ method: 'vdrx', currentA: 150, lengthM: 120, voltageV: 400, phases: 3, pf: 0.85, rOhmKm: 0.342, xOhmKm: 0.08 });
near(a.vdropV, 10.377, 0.002); near(a.vdropPct, 2.594, 0.002);
a = C({ method: 'vdrx', currentA: 20, lengthM: 40, voltageV: 230, phases: 1, pf: 0.9, rOhmKm: 5.88, xOhmKm: 0.08 });
near(a.vdropV, 8.523, 0.002);
a = C({ method: 'vdrx', currentA: 50, lengthM: 30, voltageV: 230, phases: 1, pf: 1, rOhmKm: 1.47, xOhmKm: 0.08 });
near(a.vdropV, 4.41, 0.002); near(a.vdropPct, 1.917, 0.002);
a = C({ method: 'vdrx', currentA: 300, lengthM: 1200, voltageV: 11000, phases: 3, pf: 0.9, rOhmKm: 0.125, xOhmKm: 0.1 });
near(a.vdropV, 97.327, 0.01);
a = C({ method: 'vdmv', currentA: 250, lengthM: 80, voltageV: 400, phases: 3, mvAm: 0.44 });
near(a.vdropV, 8.8, 1e-6); near(a.vdropPct, 2.2, 1e-6);
near(C({ method: 'cont', contA: 40, nonContA: 20, mult: 1.25 }).requiredA, 70, 1e-9);
// Every result is needs_review and has object steps
['ib', 'it', 'vdrx', 'vdmv', 'cont'].forEach(function (m) {
  var r = C({ method: m, kw: 10, voltageV: 400, pf: 0.9, inA: 100, ca: 1, cg: 1, currentA: 10, lengthM: 10, rOhmKm: 1, mvAm: 1, contA: 10, mult: 1.25 });
  assert(r.ok, m); assert(/needs_review/.test(r.warnings.join(' ')), m + ' warning');
  r.steps.forEach(function (s) { assert(s.step && s.formula && s.substitution && s.result, m + ' step shape'); });
});
// Errors, no silent defaults
[{ method: 'ib', kw: 0, voltageV: 400, pf: 0.9 }, { method: 'ib', kw: 10, voltageV: 0, pf: 0.9 }, { method: 'ib', kw: 10, voltageV: 400, pf: 1.5 },
 { method: 'ib', kw: 10, voltageV: 400, pf: 0.9, eff: 0 }, { method: 'ib', kw: 10, voltageV: 400, pf: 0.9, eff: 1.2 }, { method: 'ib', kw: 10, voltageV: 400, pf: 0.9, phases: 2 },
 { method: 'it', inA: 100, ca: 0, cg: 1 }, { method: 'it', inA: 100, ca: 1 }, { method: 'vdrx', currentA: 10, lengthM: 0, voltageV: 400, pf: 0.9, rOhmKm: 1 },
 { method: 'vdrx', currentA: 10, lengthM: 10, voltageV: 400, pf: 0, rOhmKm: 1 }, { method: 'vdrx', currentA: 10, lengthM: 10, voltageV: 400, pf: 0.9 },
 { method: 'vdrx', currentA: 10, lengthM: 10, voltageV: 400, pf: 0.9, rOhmKm: 1, xOhmKm: -1 }, { method: 'vdmv', currentA: 10, lengthM: 10, voltageV: 400, mvAm: 0 },
 { method: 'cont', contA: 10, mult: 0.9 }, { method: 'cont', contA: 10 }, { method: 'cont', contA: 0, mult: 1.25 }, { method: 'zzz' }].forEach(function (o, i) {
  var r = C(o); assert.strictEqual(r.ok, false, 'case ' + i + ' must be an error'); assert(r.error);
});
assert(!/IEC|BS |SBC|NEC|clause|Table/i.test(require('fs').readFileSync(__dirname + '/../js/eng-cablecalc.js', 'utf8').replace(/\/\*[\s\S]*?\*\//, '')), 'no standard numbers in text');
console.log('ALL ENG-CABLECALC TESTS PASSED');
