'use strict';

var assert = require('assert');
var path = require('path');

global.window = {};
require(path.join(__dirname, '..', 'js', 'eng-ups.js'));

var ups = global.window.EngUps;
assert(ups, 'window.EngUps must be defined');
assert(typeof ups.calculate === 'function', 'calculate must be a function');
assert(typeof ups.pdfDoc === 'function', 'pdfDoc must be a function');
assert(ups.CONSTANTS && typeof ups.CONSTANTS === 'object', 'CONSTANTS must be an object');

function near(actual, expected, tol) {
  var diff = Math.abs(actual - expected);
  assert(diff <= (tol || 1e-3), 'Expected ' + expected + ' +/- ' + (tol || 1e-3) + ', got ' + actual);
}

// 1. Check CONSTANTS metadata
Object.keys(ups.CONSTANTS).forEach(function (key) {
  var c = ups.CONSTANTS[key];
  assert.strictEqual(c.status, 'from_memory_needs_review', key + '.status must be from_memory_needs_review');
  assert.strictEqual(c.source, null, key + '.source must be null');
  assert(typeof c.warning === 'string' && c.warning.length > 0, key + '.warning must be non-empty Arabic string');
});

/*
 * Case 1 (Hand-calculated): Standard 40 kW Office UPS
 * loadKw=40, loadPf=0.8, upsRatedPf=0.9, sparePct=0, runtimeMin=15, dcVoltageV=240,
 * inverterEff=0.94, eodRatio=0.875, ageingFactor=1.25, tempFactor=1.0, designMargin=1.1
 * loadKva = 40 / 0.8 = 50 kVA; minKvaByUpsPf = 40 / 0.9 = 44.4444 kVA -> requiredUpsKva = 50 kVA -> stdUpsKva = 60 kVA
 * batteryPowerKw = 40 / 0.94 = 42.553191 kW
 * eodVoltageV = 240 * 0.875 = 210 V
 * dcCurrentEodA = 42553.191489 / 210 = 202.634245 A
 * runtimeHours = 15 / 60 = 0.25 h
 * rawEnergyKwh = 42.553191 * 0.25 = 10.638298 kWh
 * combinedDerating = 1.25 * 1.0 * 1.1 = 1.375
 * correctedEnergyKwh = 10.638298 * 1.375 = 14.627660 kWh
 * rawAh = 202.634245 * 0.25 = 50.658561 Ah
 * requiredAh = 50.658561 * 1.375 = 69.655522 Ah -> standardAh = 75 Ah
 */
var c1 = ups.calculate({
  loadKw: 40, loadPf: 0.8, upsRatedPf: 0.9, sparePct: 0, runtimeMin: 15,
  dcVoltageV: 240, inverterEff: 0.94, eodRatio: 0.875,
  ageingFactor: 1.25, tempFactor: 1.0, designMargin: 1.1
});
assert.strictEqual(c1.ok, true);
near(c1.requiredUpsKva, 50.0, 1e-4);
assert.strictEqual(c1.standardUpsKva, 60);
near(c1.batteryPowerKw, 42.5532, 1e-3);
near(c1.eodVoltageV, 210.0, 1e-4);
near(c1.dcCurrentEodA, 202.6342, 1e-3);
near(c1.rawEnergyKwh, 10.6383, 1e-3);
near(c1.correctedEnergyKwh, 14.6277, 1e-3);
near(c1.rawAh, 50.6586, 1e-3);
near(c1.requiredAh, 69.6555, 1e-3);
assert.strictEqual(c1.standardAh, 75);
assert.strictEqual(c1.reverseCheck, null);

/*
 * Case 2 (Hand-calculated): 100 kW Data Center UPS with 20% spare, cold temp 1.12, reverse check PASS
 * loadKw=100, loadPf=0.9, upsRatedPf=0.9, sparePct=20, runtimeMin=30, dcVoltageV=480,
 * inverterEff=0.95, eodRatio=0.875, ageingFactor=1.25, tempFactor=1.12, designMargin=1.1, installedAh=250
 * requiredKw = 120 kW; requiredUpsKva = 120 / 0.9 = 133.333333 kVA -> stdUpsKva = 160 kVA
 * batteryPowerKw = 120 / 0.95 = 126.315789 kW
 * eodVoltageV = 480 * 0.875 = 420 V
 * dcCurrentEodA = 126315.789474 / 420 = 300.751880 A
 * combinedDerating = 1.25 * 1.12 * 1.1 = 1.54
 * rawAh = 300.751880 * 0.5 = 150.375940 Ah
 * requiredAh = 150.375940 * 1.54 = 231.578947 Ah -> standardAh = 250 Ah
 * effectiveAvailableAh = 250 / 1.54 = 162.337662 Ah
 * estimatedRuntimeMin = (162.337662 / 300.751880) * 60 = 32.386364 min >= 30 (PASS)
 */
var c2 = ups.calculate({
  loadKw: 100, loadPf: 0.9, upsRatedPf: 0.9, sparePct: 20, runtimeMin: 30,
  dcVoltageV: 480, inverterEff: 0.95, eodRatio: 0.875,
  ageingFactor: 1.25, tempFactor: 1.12, designMargin: 1.1, installedAh: 250
});
assert.strictEqual(c2.ok, true);
near(c2.requiredUpsKva, 133.3333, 1e-3);
assert.strictEqual(c2.standardUpsKva, 160);
near(c2.batteryPowerKw, 126.3158, 1e-3);
near(c2.dcCurrentEodA, 300.7519, 1e-3);
near(c2.requiredAh, 231.5789, 1e-3);
assert.strictEqual(c2.standardAh, 250);
assert(c2.reverseCheck !== null);
near(c2.reverseCheck.estimatedRuntimeMin, 32.3864, 1e-3);
assert.strictEqual(c2.reverseCheck.meetsRequiredRuntime, true);

/*
 * Case 3 (Hand-calculated): 48V Telecom/Server UPS, unity load PF, reverse check FAIL
 * loadKw=4.5, loadPf=1.0, upsRatedPf=0.9, sparePct=0, runtimeMin=60, dcVoltageV=48,
 * inverterEff=0.90, eodRatio=0.875, ageingFactor=1.25, tempFactor=1.0, designMargin=1.0, installedAh=100
 * loadKva = 4.5, minKvaByUpsPf = 4.5 / 0.9 = 5.0 kVA -> requiredUpsKva = 5.0 kVA -> stdUpsKva = 5 kVA
 * batteryPowerKw = 4.5 / 0.90 = 5.0 kW; eodVoltageV = 42 V
 * dcCurrentEodA = 5000 / 42 = 119.047619 A
 * requiredAh = 119.047619 * 1.0 * 1.25 = 148.809524 Ah -> standardAh = 150 Ah
 * effectiveAvailableAh = 100 / 1.25 = 80 Ah
 * estimatedRuntimeMin = (80 / 119.047619) * 60 = 40.32 min < 60 (FAIL)
 */
var c3 = ups.calculate({
  loadKw: 4.5, loadPf: 1.0, upsRatedPf: 0.9, sparePct: 0, runtimeMin: 60,
  dcVoltageV: 48, inverterEff: 0.90, eodRatio: 0.875,
  ageingFactor: 1.25, tempFactor: 1.0, designMargin: 1.0, installedAh: 100
});
assert.strictEqual(c3.ok, true);
near(c3.requiredUpsKva, 5.0, 1e-4);
assert.strictEqual(c3.standardUpsKva, 5);
near(c3.dcCurrentEodA, 119.0476, 1e-3);
near(c3.requiredAh, 148.8095, 1e-3);
assert.strictEqual(c3.standardAh, 150);
near(c3.reverseCheck.estimatedRuntimeMin, 40.32, 1e-3);
assert.strictEqual(c3.reverseCheck.meetsRequiredRuntime, false);

/*
 * Case 4 (Hand-calculated): Large Industrial UPS > 1000 kVA
 * loadKw=950, loadPf=0.85, upsRatedPf=0.9, sparePct=10, runtimeMin=10, dcVoltageV=480,
 * inverterEff=0.96, eodRatio=0.875, ageingFactor=1.25, tempFactor=1.0, designMargin=1.1
 * requiredUpsKva = (950 / 0.85) * 1.1 = 1229.411765 kVA -> standardUpsKva = null
 * batteryPowerKw = 1045 / 0.96 = 1088.541667 kW; eodVoltageV = 420 V
 * dcCurrentEodA = 1088541.666667 / 420 = 2591.765873 A
 * rawAh = 2591.765873 * (10 / 60) = 431.960979 Ah
 * requiredAh = 431.960979 * 1.375 = 593.946346 Ah -> standardAh = 600 Ah
 */
var c4 = ups.calculate({
  loadKw: 950, loadPf: 0.85, upsRatedPf: 0.9, sparePct: 10, runtimeMin: 10,
  dcVoltageV: 480, inverterEff: 0.96, eodRatio: 0.875,
  ageingFactor: 1.25, tempFactor: 1.0, designMargin: 1.1
});
assert.strictEqual(c4.ok, true);
near(c4.requiredUpsKva, 1229.4118, 1e-3);
assert.strictEqual(c4.standardUpsKva, null);
near(c4.batteryPowerKw, 1088.5417, 1e-3);
near(c4.dcCurrentEodA, 2591.7659, 1e-3);
near(c4.requiredAh, 593.9463, 1e-3);
assert.strictEqual(c4.standardAh, 600);

// Edge cases: zero, negative, NaN, PF > 1, eff <= 0
assert.strictEqual(ups.calculate({ loadKw: 0, runtimeMin: 15 }).ok, false, 'zero loadKw');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: 0 }).ok, false, 'zero runtimeMin');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: 15, dcVoltageV: 0 }).ok, false, 'zero dcVoltageV');
assert.strictEqual(ups.calculate({ loadKw: -10, runtimeMin: 15 }).ok, false, 'negative loadKw');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: 15, sparePct: -5 }).ok, false, 'negative sparePct');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: 15, installedAh: -20 }).ok, false, 'negative installedAh');
assert.strictEqual(ups.calculate({ loadKw: NaN, runtimeMin: 15 }).ok, false, 'NaN loadKw');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: NaN }).ok, false, 'NaN runtimeMin');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: 15, loadPf: 1.05 }).ok, false, 'PF > 1');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: 15, upsRatedPf: 1.2 }).ok, false, 'UPS PF > 1');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: 15, inverterEff: 0 }).ok, false, 'eff == 0');
assert.strictEqual(ups.calculate({ loadKw: 10, runtimeMin: 15, inverterEff: -0.9 }).ok, false, 'eff < 0');

// pdfDoc check
var doc = ups.pdfDoc('UPS + Battery Sizing', c1);
assert.strictEqual(doc.status, 'from_memory_needs_review');
assert(Array.isArray(doc.sections) && doc.sections.length === 1);
assert(Array.isArray(doc.warnings) && doc.warnings.length >= 1);

// Optional UPS efficiency: hand 80 kW, PF 0.8, spare 15 %: (80/0.8) x 1.15 = 115 kVA; / 0.92 = 125.0 kVA
var base = ups.calculate({ loadKw: 80, loadPf: 0.8, upsRatedPf: 0.8, sparePct: 15, runtimeMin: 15 });
assert(base.ok); near(base.requiredUpsKva, 115, 1e-6);
var withEff = ups.calculate({ loadKw: 80, loadPf: 0.8, upsRatedPf: 0.8, sparePct: 15, runtimeMin: 15, upsEff: 0.92 });
assert(withEff.ok); near(withEff.requiredUpsKva, 125.0, 0.05);
var blankEff = ups.calculate({ loadKw: 80, loadPf: 0.8, upsRatedPf: 0.8, sparePct: 15, runtimeMin: 15, upsEff: null });
assert(blankEff.ok); near(blankEff.requiredUpsKva, 115, 1e-6);
assert.strictEqual(ups.calculate({ loadKw: 80, loadPf: 0.8, upsRatedPf: 0.8, sparePct: 15, runtimeMin: 15, upsEff: 0 }).ok, false);
assert.strictEqual(ups.calculate({ loadKw: 80, loadPf: 0.8, upsRatedPf: 0.8, sparePct: 15, runtimeMin: 15, upsEff: 1.5 }).ok, false);

// Peukert (optional): hand case UPS-09 style. Idc = 551.3784 A, t = 5 min, k = 1.2, H = 20 h.
// factor = (t/H)^(1/k - 1) = (0.0833333/20)^(-0.1666667) = 2.4929 ; Ah_lin = 45.9482 ; x1.375 = 157.497 Ah -> 200 Ah
var pkBase = { loadKw: 200, loadPf: 0.85, upsRatedPf: 0.9, sparePct: 10, runtimeMin: 5, dcVoltageV: 480, inverterEff: 0.95, eodRatio: 0.875, ageingFactor: 1.25, tempFactor: 1.0, designMargin: 1.1 };
var pk0 = ups.calculate(pkBase), pk1 = ups.calculate(Object.assign({}, pkBase, { peukertK: 1.2, ratedHours: 20 }));
near(pk0.requiredAh, 63.1788, 1e-3);
near(pk0.peukertFactor, 1, 1e-9);
near(pk1.peukertFactor, 2.4929, 1e-3);
near(pk1.requiredAh, 157.497, 1e-2);
assert.strictEqual(pk1.standardAh, 200);
assert.strictEqual(ups.calculate(Object.assign({}, pkBase, { peukertK: 2.5 })).ok, false);
assert.strictEqual(ups.calculate(Object.assign({}, pkBase, { peukertK: 0.9 })).ok, false);
assert.strictEqual(ups.calculate(Object.assign({}, pkBase, { ratedHours: 20 })).ok, false);
near(ups.calculate(Object.assign({}, pkBase, { peukertK: 1.0 })).requiredAh, 63.1788, 1e-3);
near(ups.calculate(Object.assign({}, pkBase, { runtimeMin: 180, peukertK: 1.2, ratedHours: 2 })).peukertFactor, 1, 1e-9);

console.log('ALL ENG-UPS TESTS PASSED');
