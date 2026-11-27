/* SLD: build() content and PDF block draw (no throw). */
'use strict';
var path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-sld.js'));
var S = window.EngSLD, fails = 0;
function eq(n, g, w) { if (g !== w) { fails++; console.log('FAIL ' + n + ': got ' + g + ' want ' + w); } else console.log('ok ' + n); }
var d = S.build({ source: 'DB-1', voltageV: 400, iscKA: 25, breakerType: 'MCCB', breakerA: 80, cableMm2: 16, cores: '4C', conductor: 'Cu', insulation: 'XLPE', lengthM: 50, loadName: 'AHU', loadKW: 30, IbA: 71.7, dropPct: 1.234 });
var txt = d.prims.filter(function (p) { return p.t === 'text'; }).map(function (p) { return p.s; });
eq('has breaker label', txt.indexOf('MCCB 80 A') >= 0, true);
eq('has cable label', txt.indexOf('4C x 16 mm2 Cu/XLPE') >= 0, true);
eq('has length', txt.indexOf('Length 50 m') >= 0, true);
eq('dV rounded to 2dp', txt.indexOf('dV = 1.23 %') >= 0, true);
eq('Ib shown', txt.some(function (t) { return t.indexOf('Ib = 71.7 A') >= 0; }), true);
var svg = S.toSVG(d);
eq('svg root', svg.indexOf('<svg') === 0 && svg.slice(-6) === '</svg>', true);
eq('svg escapes', S.toSVG(S.build({ loadName: 'A<B&C', breakerA: 10 })).indexOf('A&lt;B&amp;C') > 0, true);
eq('fromLoadSchedule null without breaker', S.fromLoadSchedule({}), null);
var sp = S.fromLoadSchedule({ mainBreakerA: 80, incomerSizeMm2: 16, voltageV: 400, designCurrentA: 71.71, totals: { dkw: 40 }, incomer: { breaker: { type: 'MCB' }, vdrop: { vdropPct: 0.9 } } }, { lengthM: 30 });
eq('spec breaker', sp.breakerA, 80); eq('spec type', sp.breakerType, 'MCB'); eq('spec dV', sp.dropPct, 0.9); eq('spec len', sp.lengthM, 30);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); } else console.log('ALL OK');
