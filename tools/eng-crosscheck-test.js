/* Cross-check advisory logic against the REAL data/eng-tables.json. */
'use strict';
var fs = require('fs'), path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-tables.js'));
require(path.join(__dirname, '../js/eng-calc.js'));
require(path.join(__dirname, '../js/eng-crosscheck.js'));
window.EngTables.setData(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/eng-tables.json'), 'utf8')));
var X = window.EngCross, fails = 0;
function eq(name, got, want) { if (got !== want) { fails++; console.log('FAIL ' + name + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); } else console.log('ok   ' + name); }

var p = X.parseTask('Size a cable for a 3-phase 400 V feeder, 60 A, 50 m run, XLPE copper, ambient 35 C, max voltage drop 3%.');
eq('parse voltage', p.voltageV, 400); eq('parse current', p.currentA, 60); eq('parse length', p.lengthM, 50);
eq('parse phases', p.phases, 3); eq('parse ambient', p.ambientC, 35); eq('parse vd limit', p.maxVdropPct, 3);
eq('parse insulation', p.insulation, 'XLPE'); eq('parse conductor', p.conductor, 'Cu');
var pa = X.parseTask('كابل المنيوم 70 mm2 PVC، 100 أمبير، 230 فولت، طول 80 متر');
eq('parse arabic Al', pa.conductor, 'Al'); eq('parse arabic size', pa.size_mm2, 70); eq('parse arabic length', pa.lengthM, 80); eq('parse arabic 1ph by voltage', pa.phases, 1);

var task = 'Size a cable for a 3-phase 400 V feeder, 60 A, 50 m run, XLPE copper, ambient 35 C, max voltage drop 3%. Also select the breaker.';
// Hand-check of the calculator: 60 A, Ca 0.96, In 63 A, Iz_req 65.6 A, B.52.5 col C: 10 mm2 = 71 A -> dV 2.63 % (see eng-calc-test)
var good = X.compare(task, 'المقطع المختار: 10 mm2 XLPE. القاطع MCB 63 A. هبوط الجهد = 2.6 %.');
eq('matching answer: not diverging', good && good.diverge, false);
eq('matching answer: three items compared', good && good.items.length, 3);
var bad = X.compare(task, 'المقطع المختار: 6 mm2. القاطع MCB 63 A. هبوط الجهد 1.2 %.');
eq('wrong size/vd answer: diverges', bad && bad.diverge, true);
eq('wrong answer: size item not ok', bad.items.filter(function (i) { return i.label === 'مقطع الكابل'; })[0].ok, false);
eq('wrong answer: breaker item ok', bad.items.filter(function (i) { return i.label === 'قاطع الحماية'; })[0].ok, true);
eq('no engineering inputs -> null', X.compare('اكتب لي ايميل لعميل عن تأخير التسليم', 'تمام، ده الايميل'), null);
eq('answer without numbers to compare -> null', X.compare(task, 'يرجى مراجعة الكود.'), null);
// voltage drop with a given size: 35 mm2 XLPE Cu, 100 A, 100 m, 400 V 3ph PF 0.85 -> 10.57 V = 2.64 % (hand math in eng-calc-test)
var vd = X.compare('Voltage drop for 35 mm2 XLPE copper 3-phase 400 V, 100 A, 100 m, PF 0.85', 'Voltage drop = 2.64 %');
eq('vd case matches', vd && vd.diverge, false);
var vd2 = X.compare('Voltage drop for 35 mm2 XLPE copper 3-phase 400 V, 100 A, 100 m, PF 0.85', 'Voltage drop = 5.0 %');
eq('vd case diverges', vd2 && vd2.diverge, true);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL CROSSCHECK TESTS PASSED');
