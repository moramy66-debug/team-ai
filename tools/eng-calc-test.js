'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

var root = path.resolve(__dirname, '..');
var tablesJson = JSON.parse(fs.readFileSync(path.join(root, 'data', 'eng-tables.json'), 'utf8'));
var tablesSrc = fs.readFileSync(path.join(root, 'js', 'eng-tables.js'), 'utf8');
var calcSrc = fs.readFileSync(path.join(root, 'js', 'eng-calc.js'), 'utf8');

var sandbox = {
  window: {},
  console: console,
  Math: Math,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  Error: Error,
  Promise: Promise,
  JSON: JSON
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(tablesSrc, sandbox);
vm.runInContext(calcSrc, sandbox);

var EngTables = sandbox.window.EngTables;
var EngCalc = sandbox.window.EngCalc;
assert.ok(EngTables && typeof EngTables.setData === 'function', 'EngTables.setData must exist');
assert.ok(EngCalc && typeof EngCalc.cableSizing === 'function', 'EngCalc.cableSizing must exist');
EngTables.setData(tablesJson);

// 1. Cable sizing cases (3 cases, including voltage-drop upsizing)
var cs1 = EngCalc.cableSizing({
  phases: 3,
  voltageV: 400,
  currentA: 30,
  conductor: 'Cu',
  insulation: 'XLPE',
  method: 'air',
  ambientC: 30,
  circuits: 1
});
assert.strictEqual(cs1.compliant, true, 'cs1 should be compliant');
assert.ok(cs1.size_mm2 >= 2.5, 'cs1 size should be >= 2.5 mm2');
assert.ok(cs1.deratedAmpacityA >= 30, 'cs1 derated ampacity should cover 30 A');

var cs2 = EngCalc.cableSizing({
  phases: 1,
  voltageV: 230,
  powerKW: 5,
  powerFactor: 0.9,
  conductor: 'Cu',
  insulation: 'PVC',
  method: 'air',
  ambientC: 35,
  circuits: 2
});
assert.strictEqual(cs2.compliant, true, 'cs2 should be compliant');
assert.ok(cs2.designCurrentA > 20, 'cs2 design current should be > 20 A');
assert.ok(cs2.factors.combined > 0 && cs2.factors.combined <= 1, 'cs2 combined factor in (0, 1]');

var csShort = EngCalc.cableSizing({
  phases: 3,
  voltageV: 400,
  currentA: 32,
  conductor: 'Cu',
  insulation: 'XLPE',
  method: 'air',
  ambientC: 30,
  circuits: 1,
  lengthM: 10,
  maxVdropPct: 3
});
var csLong = EngCalc.cableSizing({
  phases: 3,
  voltageV: 400,
  currentA: 32,
  conductor: 'Cu',
  insulation: 'XLPE',
  method: 'air',
  ambientC: 30,
  circuits: 1,
  lengthM: 250,
  maxVdropPct: 3
});
assert.strictEqual(csLong.compliant, true, 'csLong should be compliant');
assert.ok(csLong.size_mm2 > csShort.size_mm2, 'Long cable run must upsize due to voltage drop');
assert.ok(csLong.vdrop && csLong.vdrop.vdropPct <= 3, 'csLong voltage drop must be <= 3%');

// 2. Voltage drop cases (1-phase, 3-phase Cu, 3-phase Al)
var vd1 = EngCalc.voltageDrop({
  phases: 1,
  voltageV: 230,
  currentA: 20,
  size_mm2: 16,
  lengthM: 30,
  conductor: 'Cu',
  insulation: 'XLPE',
  powerFactor: 0.85
});
assert.strictEqual(vd1.phases, 1);
assert.strictEqual(vd1.conductor, 'Cu');
assert.ok(vd1.vdropV > 0 && vd1.vdropPct > 0, 'vd1 should be positive');

var vd2 = EngCalc.voltageDrop({
  phases: 3,
  voltageV: 400,
  currentA: 50,
  size_mm2: 16,
  lengthM: 50,
  conductor: 'Cu',
  insulation: 'XLPE',
  powerFactor: 0.85
});
assert.strictEqual(vd2.phases, 3);
assert.strictEqual(vd2.conductor, 'Cu');
assert.ok(vd2.vdropV > 0 && vd2.vdropPct > 0, 'vd2 should be positive');

var vd3 = EngCalc.voltageDrop({
  phases: 3,
  voltageV: 400,
  currentA: 50,
  size_mm2: 25,
  lengthM: 50,
  conductor: 'Al',
  insulation: 'XLPE',
  powerFactor: 0.85
});
assert.strictEqual(vd3.phases, 3);
assert.strictEqual(vd3.conductor, 'Al');
assert.ok(vd3.vdropV > 0 && vd3.vdropPct > 0, 'vd3 should be positive');

// 3. Breaker selection cases (2 cases)
var br1 = EngCalc.breakerSelection({
  designCurrentA: 45,
  cableAmpacityA: 75,
  type: 'MCB'
});
assert.ok(br1.rating_a >= 45, 'br1 rating must be >= 45 A');
assert.strictEqual(br1.coordinated, true, 'br1 should be coordinated with 75 A cable');

var br2 = EngCalc.breakerSelection({
  designCurrentA: 140,
  cableAmpacityA: 120,
  type: 'MCCB',
  safetyFactor: 1.1
});
assert.ok(br2.rating_a >= 154, 'br2 rating must be >= 154 A');
assert.strictEqual(br2.coordinated, false, 'br2 should not be coordinated when In > Iz');

// 4. Invalid input cases
assert.throws(function () {
  EngCalc.cableSizing({ currentA: -10, voltageV: 400 });
}, 'Negative current must throw');

assert.throws(function () {
  EngCalc.voltageDrop({ size_mm2: 0, currentA: 20, lengthM: 10, voltageV: 400 });
}, 'Zero cable size must throw');

assert.throws(function () {
  EngCalc.breakerSelection({ designCurrentA: 0 });
}, 'Zero design current must throw');

console.log('ALL ENGCALC TESTS PASSED');
