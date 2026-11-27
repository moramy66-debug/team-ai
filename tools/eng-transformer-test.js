/*
 * Unit tests for js/eng-transformer.js (Transformer Sizing & Short-Circuit Current)
 *
 * Hand-Calculated Case 1 (Commercial Building with Growth & Spare):
 *   Inputs: demandKva = 600, growthPct = 15, sparePct = 10, targetLoadPct = 80, vPrimary = 13800, vSecondary = 400, impedancePct = 5
 *   designKva = 600 * 1.15 * 1.10 = 759 kVA
 *   requiredRatingKva = 759 / 0.80 = 948.75 kVA
 *   stdKva = 1000 kVA (smallest standard rating >= 948.75 kVA)
 *   actualLoadPct = (759 / 1000) * 100 = 75.9%
 *   iPrimary = (1000 * 1000) / (sqrt(3) * 13800) = 41.836976 A
 *   iSecondary = (1000 * 1000) / (sqrt(3) * 400) = 1443.375673 A
 *   iscApproxKa = (1443.375673 / 0.05) / 1000 = 28.867513 kA
 *
 * Hand-Calculated Case 2 (Medium Industrial Load, 0% Growth/Spare, 33 kV Primary):
 *   Inputs: demandKva = 1000, growthPct = 0, sparePct = 0, targetLoadPct = 80, vPrimary = 33000, vSecondary = 400, impedancePct = 6
 *   designKva = 1000 kVA
 *   requiredRatingKva = 1000 / 0.80 = 1250 kVA
 *   stdKva = 1250 kVA
 *   actualLoadPct = (1000 / 1250) * 100 = 80%
 *   iPrimary = 1250000 / (sqrt(3) * 33000) = 21.869328 A
 *   iSecondary = 1250000 / (sqrt(3) * 400) = 1804.219591 A
 *   iscApproxKa = (1804.219591 / 0.06) / 1000 = 30.070327 kA
 */
'use strict';
var path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-transformer.js'));
var T = window.EngTransformer, fails = 0;
function eq(n, g, w, tol) { var ok = typeof w === 'number' ? Math.abs(g - w) <= (tol || 1e-6) : g === w; if (!ok) { console.log('FAIL:', n, 'got', g, 'want', w); fails++; } }

// Case 1: Commercial Building
var r1 = T.calculate({ demandKva: 600, growthPct: 15, sparePct: 10, targetLoadPct: 80, vPrimary: 13800, vSecondary: 400, impedancePct: 5 });
eq('c1 ok', r1.ok, true);
eq('c1 designKva', r1.designKva, 759);
eq('c1 requiredRatingKva', r1.requiredRatingKva, 948.75);
eq('c1 stdKva', r1.stdKva, 1000);
eq('c1 actualLoadPct', r1.actualLoadPct, 75.9);
eq('c1 iPrimary', r1.iPrimary, 1000000 / (Math.sqrt(3) * 13800));
eq('c1 iSecondary', r1.iSecondary, 1000000 / (Math.sqrt(3) * 400));
eq('c1 iscApproxKa', r1.iscApproxKa, (1000000 / (Math.sqrt(3) * 400) / 0.05) / 1000);
eq('c1 warnings', r1.warnings.length, 1);

// Case 2: Medium Industrial Load
var r2 = T.calculate({ demandKva: 1000, growthPct: 0, sparePct: 0, targetLoadPct: 80, vPrimary: 33000, vSecondary: 400, impedancePct: 6 });
eq('c2 ok', r2.ok, true);
eq('c2 designKva', r2.designKva, 1000);
eq('c2 requiredRatingKva', r2.requiredRatingKva, 1250);
eq('c2 stdKva', r2.stdKva, 1250);
eq('c2 actualLoadPct', r2.actualLoadPct, 80);
eq('c2 iPrimary', r2.iPrimary, 1250000 / (Math.sqrt(3) * 33000));
eq('c2 iSecondary', r2.iSecondary, 1250000 / (Math.sqrt(3) * 400));
eq('c2 iscApproxKa', r2.iscApproxKa, (1250000 / (Math.sqrt(3) * 400) / 0.06) / 1000);
eq('c2 warnings', r2.warnings.length, 1);

// Edge Cases: Zero, Negative, Large values
eq('zero demand', T.calculate({ demandKva: 0, growthPct: 10, sparePct: 10, targetLoadPct: 80, vPrimary: 13800, vSecondary: 400, impedancePct: 5 }).ok, false);
eq('neg demand', T.calculate({ demandKva: -100, growthPct: 10, sparePct: 10, targetLoadPct: 80, vPrimary: 13800, vSecondary: 400, impedancePct: 5 }).ok, false);
eq('neg growth', T.calculate({ demandKva: 500, growthPct: -5, sparePct: 10, targetLoadPct: 80, vPrimary: 13800, vSecondary: 400, impedancePct: 5 }).ok, false);
eq('neg impedance', T.calculate({ demandKva: 500, growthPct: 0, sparePct: 0, targetLoadPct: 80, vPrimary: 13800, vSecondary: 400, impedancePct: -5 }).ok, false);
eq('load > 100', T.calculate({ demandKva: 500, growthPct: 0, sparePct: 0, targetLoadPct: 110, vPrimary: 13800, vSecondary: 400, impedancePct: 5 }).ok, false);

var ratings = T.CONSTANTS.standardRatingsKva.value;
var maxStd = ratings[ratings.length - 1];
var rLarge = T.calculate({ demandKva: 50000, growthPct: 20, sparePct: 10, targetLoadPct: 80, vPrimary: 13800, vSecondary: 400, impedancePct: 5 });
eq('large ok', rLarge.ok, true);
eq('large stdKva == max', rLarge.stdKva, maxStd);
eq('large warning', rLarge.warnings.length, 2);

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-TRANSFORMER TESTS PASSED');
