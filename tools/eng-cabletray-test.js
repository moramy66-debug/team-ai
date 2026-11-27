/*
 * Unit tests for js/eng-cabletray.js (Cable Tray Sizing & Fill Ratio)
 *
 * Hand-Calculated Case 1 (Multicore Cables):
 *   Inputs: cableCount = 10, outerDiaMm = 20 mm, trayDepthMm = 100 mm, fillLimitPct = 40%, arrangement = 'multicore', sparePct = 20%
 *   singleCableArea = pi * (20 / 2)^2 = pi * 100 = 314.159265 mm2
 *   totalCableArea = 10 * 314.159265 = 3141.592654 mm2
 *   effectiveArea = 3141.592654 * (1 + 20 / 100) = 3769.911184 mm2
 *   reqWidthByArea = 3769.911184 / (100 * 0.40) = 94.247780 mm
 *   layoutWidthMm = 10 * 20 * 1.20 = 240 mm
 *   requiredWidthMm = max(94.247780, 240) = 240 mm
 *   stdWidthMm = 300 mm (smallest standard width >= 240 mm)
 *   actualFillPct = (3141.592654 / (300 * 100)) * 100 = 10.471976%
 *
 * Hand-Calculated Case 2 (Single-Core Trefoil + Large Cable Diameter Warning):
 *   Inputs: cableCount = 6, outerDiaMm = 60 mm, trayDepthMm = 100 mm, fillLimitPct = 40%, arrangement = 'single_core', sparePct = 0%
 *   singleCableArea = pi * (60 / 2)^2 = pi * 900 = 2827.433388 mm2
 *   totalCableArea = 6 * 2827.433388 = 16964.600329 mm2
 *   effectiveArea = 16964.600329 mm2
 *   reqWidthByArea = 16964.600329 / (100 * 0.40) = 424.115008 mm
 *   trefoilGroups = ceil(6 / 3) = 2
 *   layoutWidthMm = 2 * (2 * 60) * 1.0 = 240 mm
 *   requiredWidthMm = max(424.115008, 240) = 424.115008 mm
 *   stdWidthMm = 450 mm
 *   actualFillPct = (16964.600329 / (450 * 100)) * 100 = 37.699112%
 *   outerDiaMm > 50 mm => triggers single-layer / derating warning (warnings.length === 2)
 */
'use strict';
var path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-cabletray.js'));
var CT = window.EngCableTray, fails = 0;
function eq(n, g, w, tol) { var ok = typeof w === 'number' ? Math.abs(g - w) <= (tol || 1e-6) : g === w; if (!ok) { console.log('FAIL:', n, 'got', g, 'want', w); fails++; } }

// Case 1: Multicore Cables
var r1 = CT.calculate({ cableCount: 10, outerDiaMm: 20, trayDepthMm: 100, fillLimitPct: 40, arrangement: 'multicore', sparePct: 20 });
eq('c1 ok', r1.ok, true);
eq('c1 singleCableArea', r1.singleCableArea, Math.PI * 100);
eq('c1 totalCableArea', r1.totalCableArea, 10 * Math.PI * 100);
eq('c1 effectiveArea', r1.effectiveArea, 12 * Math.PI * 100);
eq('c1 reqWidthByArea', r1.reqWidthByArea, (12 * Math.PI * 100) / 40);
eq('c1 layoutWidthMm', r1.layoutWidthMm, 240);
eq('c1 requiredWidthMm', r1.requiredWidthMm, 240);
eq('c1 stdWidthMm', r1.stdWidthMm, 300);
eq('c1 actualFillPct', r1.actualFillPct, ((10 * Math.PI * 100) / 30000) * 100);
eq('c1 warnings', r1.warnings.length, 1);

// Case 2: Single-Core Trefoil + Large Diameter Warning
var r2 = CT.calculate({ cableCount: 6, outerDiaMm: 60, trayDepthMm: 100, fillLimitPct: 40, arrangement: 'single_core', sparePct: 0 });
eq('c2 ok', r2.ok, true);
eq('c2 singleCableArea', r2.singleCableArea, Math.PI * 900);
eq('c2 totalCableArea', r2.totalCableArea, 6 * Math.PI * 900);
eq('c2 reqWidthByArea', r2.reqWidthByArea, (6 * Math.PI * 900) / 40);
eq('c2 layoutWidthMm', r2.layoutWidthMm, 240);
eq('c2 requiredWidthMm', r2.requiredWidthMm, (6 * Math.PI * 900) / 40);
eq('c2 stdWidthMm', r2.stdWidthMm, 450);
eq('c2 actualFillPct', r2.actualFillPct, ((6 * Math.PI * 900) / 45000) * 100);
eq('c2 warnings', r2.warnings.length, 2);

// Edge Cases: Zero, Negative, Large values
eq('zero count', CT.calculate({ cableCount: 0, outerDiaMm: 20, trayDepthMm: 100, fillLimitPct: 40, arrangement: 'multicore', sparePct: 0 }).ok, false);
eq('zero dia', CT.calculate({ cableCount: 5, outerDiaMm: 0, trayDepthMm: 100, fillLimitPct: 40, arrangement: 'multicore', sparePct: 0 }).ok, false);
eq('neg count', CT.calculate({ cableCount: -5, outerDiaMm: 20, trayDepthMm: 100, fillLimitPct: 40, arrangement: 'multicore', sparePct: 0 }).ok, false);
eq('neg depth', CT.calculate({ cableCount: 5, outerDiaMm: 20, trayDepthMm: -100, fillLimitPct: 40, arrangement: 'multicore', sparePct: 0 }).ok, false);
eq('neg spare', CT.calculate({ cableCount: 5, outerDiaMm: 20, trayDepthMm: 100, fillLimitPct: 40, arrangement: 'multicore', sparePct: -10 }).ok, false);
eq('fill > 100', CT.calculate({ cableCount: 5, outerDiaMm: 20, trayDepthMm: 100, fillLimitPct: 120, arrangement: 'multicore', sparePct: 0 }).ok, false);

var rLarge = CT.calculate({ cableCount: 500, outerDiaMm: 45, trayDepthMm: 100, fillLimitPct: 40, arrangement: 'multicore', sparePct: 25 });
eq('large ok', rLarge.ok, true);
eq('large exceeds 1000', rLarge.requiredWidthMm > 1000, true);
eq('large stdWidthMm', rLarge.stdWidthMm, 1000);
eq('large warning', rLarge.warnings.length >= 2, true);

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-CABLETRAY TESTS PASSED');
