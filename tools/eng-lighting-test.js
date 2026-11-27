/*
 * Unit tests for js/eng-lighting.js (Lumen Method & Fixture Layout)
 *
 * Hand-Calculated Case 1 (Standard Office Room):
 *   Inputs: L = 10 m, W = 8 m, Hm = 2.5 m, E = 500 lux, F = 4000 lm, P = 40 W, UF = 0.65, MF = 0.80
 *   A = 10 * 8 = 80 m2
 *   K = (10 * 8) / (2.5 * (10 + 8)) = 80 / 45 = 1.777778
 *   N_exact = (500 * 80) / (4000 * 0.65 * 0.80) = 40000 / 2080 = 19.230769
 *   N = ceil(19.230769) = 20
 *   cols = max(1, round(sqrt(20 * (10 / 8)))) = round(sqrt(25)) = 5
 *   rows = ceil(20 / 5) = 4 => N_grid = 5 * 4 = 20
 *   spacingX = 10 / 5 = 2.0 m, spacingY = 8 / 4 = 2.0 m
 *   SHR = max(2.0, 2.0) / 2.5 = 0.8 (<= 1.5, no SHR warning)
 *   actualLux = (20 * 4000 * 0.65 * 0.80) / 80 = 520 lux
 *   totalWatts = 20 * 40 = 800 W, wPerM2 = 800 / 80 = 10 W/m2
 *
 * Hand-Calculated Case 2 (Warehouse with SHR > 1.5 Warning & Grid Rounding):
 *   Inputs: L = 20 m, W = 10 m, Hm = 3 m, E = 300 lux, F = 20000 lm, P = 150 W, UF = 0.60, MF = 0.75
 *   A = 20 * 10 = 200 m2
 *   K = (20 * 10) / (3 * (20 + 10)) = 200 / 90 = 2.222222
 *   N_exact = (300 * 200) / (20000 * 0.60 * 0.75) = 60000 / 9000 = 6.666667
 *   N = ceil(6.666667) = 7
 *   cols = max(1, round(sqrt(7 * (20 / 10)))) = round(sqrt(14)) = 4
 *   rows = ceil(7 / 4) = 2 => N_grid = 4 * 2 = 8
 *   spacingX = 20 / 4 = 5.0 m, spacingY = 10 / 2 = 5.0 m
 *   SHR = max(5.0, 5.0) / 3 = 1.666667 (> 1.5, triggers SHR warning)
 *   actualLux = (8 * 20000 * 0.60 * 0.75) / 200 = 360 lux
 *   totalWatts = 8 * 150 = 1200 W, wPerM2 = 1200 / 200 = 6 W/m2
 */
'use strict';
var path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-lighting.js'));
var L = window.EngLighting, fails = 0;
function eq(n, g, w, tol) { var ok = typeof w === 'number' ? Math.abs(g - w) <= (tol || 1e-6) : g === w; if (!ok) { console.log('FAIL:', n, 'got', g, 'want', w); fails++; } }

// Case 1: Standard Office Room
var r1 = L.calculate({ lengthM: 10, widthM: 8, mountingHeightM: 2.5, targetLux: 500, lumensPerFixture: 4000, wattPerFixture: 40, uf: 0.65, mf: 0.80 });
eq('c1 ok', r1.ok, true);
eq('c1 A', r1.A, 80);
eq('c1 K', r1.K, 80 / 45);
eq('c1 N_exact', r1.N_exact, 40000 / 2080);
eq('c1 N', r1.N, 20);
eq('c1 cols', r1.cols, 5);
eq('c1 rows', r1.rows, 4);
eq('c1 N_grid', r1.N_grid, 20);
eq('c1 spacingX', r1.spacingX, 2.0);
eq('c1 spacingY', r1.spacingY, 2.0);
eq('c1 shr', r1.shr, 0.8);
eq('c1 actualLux', r1.actualLux, 520);
eq('c1 totalWatts', r1.totalWatts, 800);
eq('c1 wPerM2', r1.wPerM2, 10);
eq('c1 warnings', r1.warnings.length, 1);

// Case 2: Warehouse with SHR > 1.5 warning
var r2 = L.calculate({ lengthM: 20, widthM: 10, mountingHeightM: 3, targetLux: 300, lumensPerFixture: 20000, wattPerFixture: 150, uf: 0.60, mf: 0.75 });
eq('c2 ok', r2.ok, true);
eq('c2 A', r2.A, 200);
eq('c2 K', r2.K, 200 / 90);
eq('c2 N_exact', r2.N_exact, 60000 / 9000);
eq('c2 N', r2.N, 7);
eq('c2 cols', r2.cols, 4);
eq('c2 rows', r2.rows, 2);
eq('c2 N_grid', r2.N_grid, 8);
eq('c2 spacingX', r2.spacingX, 5.0);
eq('c2 spacingY', r2.spacingY, 5.0);
eq('c2 shr', r2.shr, 5 / 3);
eq('c2 actualLux', r2.actualLux, 360);
eq('c2 totalWatts', r2.totalWatts, 1200);
eq('c2 wPerM2', r2.wPerM2, 6);
eq('c2 warnings', r2.warnings.length, 2);

// Edge Cases: Zero, Negative, Large values
eq('zero length', L.calculate({ lengthM: 0, widthM: 8, mountingHeightM: 2.5, targetLux: 500, lumensPerFixture: 4000, wattPerFixture: 40, uf: 0.65, mf: 0.80 }).ok, false);
var rZeroWatt = L.calculate({ lengthM: 10, widthM: 8, mountingHeightM: 2.5, targetLux: 500, lumensPerFixture: 4000, wattPerFixture: 0, uf: 0.65, mf: 0.80 });
eq('zero watt ok', rZeroWatt.ok, true);
eq('zero watt totalWatts', rZeroWatt.totalWatts, 0);
eq('zero watt wPerM2', rZeroWatt.wPerM2, 0);
eq('neg width', L.calculate({ lengthM: 10, widthM: -8, mountingHeightM: 2.5, targetLux: 500, lumensPerFixture: 4000, wattPerFixture: 40, uf: 0.65, mf: 0.80 }).ok, false);
eq('neg watt', L.calculate({ lengthM: 10, widthM: 8, mountingHeightM: 2.5, targetLux: 500, lumensPerFixture: 4000, wattPerFixture: -10, uf: 0.65, mf: 0.80 }).ok, false);
eq('neg lux', L.calculate({ lengthM: 10, widthM: 8, mountingHeightM: 2.5, targetLux: -500, lumensPerFixture: 4000, wattPerFixture: 40, uf: 0.65, mf: 0.80 }).ok, false);

var rLarge = L.calculate({ lengthM: 1000, widthM: 500, mountingHeightM: 20, targetLux: 1000, lumensPerFixture: 50000, wattPerFixture: 300, uf: 0.70, mf: 0.80 });
eq('large ok', rLarge.ok, true);
eq('large A', rLarge.A, 500000);
eq('large N', rLarge.N, 17858);
eq('large N_grid >= N', rLarge.N_grid >= rLarge.N, true);
eq('large actualLux >= target', rLarge.actualLux >= 1000, true);

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-LIGHTING TESTS PASSED');
