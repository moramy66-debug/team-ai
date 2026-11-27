/*
 * Unit tests for js/eng-generator.js (Standby Generator Sizing & Derating)
 *
 * Hand-Calculated Case 1 (Sea-Level 40C with DOL Motor Starting):
 *   Inputs: continuousKw = 160, pf = 0.8, largestMotorKw = 45, startMethod = 'DOL', altitudeM = 0, ambientTempC = 40, sparePct = 10
 *   runningKva = 160 / 0.8 = 200 kVA
 *   motorStartKva = (45 / 0.90) * 6.0 = 50 * 6.0 = 300 kVA
 *   runningWithSpareKva = 200 * 1.10 = 220 kVA
 *   stepLoadKva = 200 + 300 = 500 kVA
 *   requiredSiteKva = max(220, 500) = 500 kVA
 *   altDeratePct = 0%, tempDeratePct = 0% => deratingFactor = 1.0
 *   requiredIsoKva = 500 / 1.0 = 500 kVA
 *   stdKva = 500 kVA, stdSiteKva = 500 kVA
 *   voltageDipPct = (300 * 15) / (500 + 300 * 0.15) = 4500 / 545 = 8.256881% (<= 15%, no dip warning)
 *
 * Hand-Calculated Case 2 (High Altitude + High Ambient Temp Derating + VFD Motor):
 *   Inputs: continuousKw = 400, pf = 0.8, largestMotorKw = 90, startMethod = 'VFD', altitudeM = 2000, ambientTempC = 50, sparePct = 20
 *   runningKva = 400 / 0.8 = 500 kVA
 *   motorStartKva = (90 / 0.90) * 1.25 = 100 * 1.25 = 125 kVA
 *   runningWithSpareKva = 500 * 1.20 = 600 kVA
 *   stepLoadKva = 500 + 125 = 625 kVA
 *   requiredSiteKva = max(600, 625) = 625 kVA
 *   altDeratePct = ((2000 - 1000) / 100) * 1.0 = 10%
 *   tempDeratePct = (50 - 40) * 0.5 = 5%
 *   totalDeratePct = min(50, 10 + 5) = 15% => deratingFactor = 0.85
 *   requiredIsoKva = 625 / 0.85 = 735.294118 kVA
 *   stdKva = 750 kVA, stdSiteKva = 750 * 0.85 = 637.5 kVA
 *   voltageDipPct = (125 * 15) / (637.5 + 125 * 0.15) = 1875 / 656.25 = 2.857143%
 */
'use strict';
var path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-generator.js'));
var G = window.EngGenerator, fails = 0;
function eq(n, g, w, tol) { var ok = typeof w === 'number' ? Math.abs(g - w) <= (tol || 1e-6) : g === w; if (!ok) { console.log('FAIL:', n, 'got', g, 'want', w); fails++; } }

// Case 1: Sea-Level 40C + DOL Motor
var r1 = G.calculate({ continuousKw: 160, pf: 0.8, largestMotorKw: 45, startMethod: 'DOL', motorPf: 1, altitudeM: 0, ambientTempC: 40, sparePct: 10 });
eq('c1 ok', r1.ok, true);
eq('c1 runningKva', r1.runningKva, 200);
eq('c1 motorStartKva', r1.motorStartKva, 300);
eq('c1 stepLoadKva', r1.stepLoadKva, 500);
eq('c1 requiredSiteKva', r1.requiredSiteKva, 500);
eq('c1 deratingFactor', r1.deratingFactor, 1.0);
eq('c1 requiredIsoKva', r1.requiredIsoKva, 500);
eq('c1 stdKva', r1.stdKva, 500);
eq('c1 stdSiteKva', r1.stdSiteKva, 500);
eq('c1 voltageDipPct', r1.voltageDipPct, 4500 / 545);
eq('c1 warnings', r1.warnings.length, 1);

// Case 2: High Altitude + High Temp Derating + VFD Motor
var r2 = G.calculate({ continuousKw: 400, pf: 0.8, largestMotorKw: 90, startMethod: 'VFD', motorPf: 1, altitudeM: 2000, ambientTempC: 50, sparePct: 20 });
eq('c2 ok', r2.ok, true);
eq('c2 runningKva', r2.runningKva, 500);
eq('c2 motorStartKva', r2.motorStartKva, 125);
eq('c2 stepLoadKva', r2.stepLoadKva, 625);
eq('c2 requiredSiteKva', r2.requiredSiteKva, 625);
eq('c2 deratingFactor', r2.deratingFactor, 0.85);
eq('c2 requiredIsoKva', r2.requiredIsoKva, 625 / 0.85);
eq('c2 stdKva', r2.stdKva, 750);
eq('c2 stdSiteKva', r2.stdSiteKva, 637.5);
eq('c2 voltageDipPct', r2.voltageDipPct, 1875 / 656.25);
eq('c2 warnings', r2.warnings.length, 1);

// Edge Cases: Zero, Negative, Large values
eq('zero contKw', G.calculate({ continuousKw: 0, pf: 0.8, largestMotorKw: 0, startMethod: 'DOL', altitudeM: 0, ambientTempC: 40, sparePct: 0 }).ok, false);
var rZeroMotor = G.calculate({ continuousKw: 80, pf: 0.8, largestMotorKw: 0, startMethod: 'DOL', altitudeM: 0, ambientTempC: 40, sparePct: 0 });
eq('zero motor ok', rZeroMotor.ok, true);
eq('zero motor startKva', rZeroMotor.motorStartKva, 0);
eq('zero motor dip', rZeroMotor.voltageDipPct, 0);
eq('neg contKw', G.calculate({ continuousKw: -50, pf: 0.8, largestMotorKw: 0, startMethod: 'DOL', altitudeM: 0, ambientTempC: 40, sparePct: 0 }).ok, false);
eq('neg pf', G.calculate({ continuousKw: 100, pf: -0.8, largestMotorKw: 0, startMethod: 'DOL', altitudeM: 0, ambientTempC: 40, sparePct: 0 }).ok, false);
eq('neg motor', G.calculate({ continuousKw: 100, pf: 0.8, largestMotorKw: -10, startMethod: 'DOL', altitudeM: 0, ambientTempC: 40, sparePct: 0 }).ok, false);
eq('neg alt', G.calculate({ continuousKw: 100, pf: 0.8, largestMotorKw: 0, startMethod: 'DOL', altitudeM: -100, ambientTempC: 40, sparePct: 0 }).ok, false);
eq('neg spare', G.calculate({ continuousKw: 100, pf: 0.8, largestMotorKw: 0, startMethod: 'DOL', altitudeM: 0, ambientTempC: 40, sparePct: -5 }).ok, false);

var rLarge = G.calculate({ continuousKw: 50000, pf: 0.8, largestMotorKw: 5000, startMethod: 'DOL', altitudeM: 6000, ambientTempC: 80, sparePct: 20 });
eq('large ok', rLarge.ok, true);
eq('large derate capped 0.5', rLarge.deratingFactor, 0.5);
eq('large warning', rLarge.warnings.length >= 2, true);

// Motor PF (added in v149): the cases above pass motorPf 1 so their hand-calculated numbers stay valid.
// Case M: default motor PF 0.85 (assumption), start kVA = (45 / (0.90 x 0.85)) x 6 = 352.94
var rm = G.calculate({ continuousKw: 200, pf: 0.85, largestMotorKw: 45, startMethod: 'DOL' });
eq('motor PF default start kVA', Math.round(rm.motorStartKva * 100) / 100, 352.94);
var rm2 = G.calculate({ continuousKw: 200, pf: 0.85, largestMotorKw: 75, startMethod: 'VFD', motorPf: 0.85 });
eq('motor PF explicit start kVA', Math.round(rm2.motorStartKva * 100) / 100, 122.55);
eq('motor PF 0 gives error', G.calculate({ continuousKw: 200, largestMotorKw: 45, motorPf: 0 }).ok, false);
eq('motor PF 1.2 gives error', G.calculate({ continuousKw: 200, largestMotorKw: 45, motorPf: 1.2 }).ok, false);

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-GENERATOR TESTS PASSED');
