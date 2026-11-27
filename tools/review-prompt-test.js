'use strict';
var fs = require('fs'), path = require('path');
global.window = {};
global.document = { body: {} };
require(path.join(__dirname, '../js/eng-tables.js'));
require(path.join(__dirname, '../js/source-info.js'));
require(path.join(__dirname, '../js/review-prompt.js'));
window.EngTables.setData(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/eng-tables.json'), 'utf8')));
var fails = 0;
function ok(n, c) { if (!c) { fails++; console.log('FAIL ' + n); } else console.log('ok   ' + n); }
var res = {
  summary: 'Breaker: 63 A | Ib = 60 A',
  warnings: ['Power Factor missing, default 0.85 used.'],
  steps: [{ step: 'Design Current Ib', formula: 'Ib = I', substitution: 'I = 60 A', result: '60 A' }, { step: 'Breaker', formula: 'In >= Ib', substitution: '63 >= 60', result: 'In = 63 A' }],
  tablesUsed: [{ id: 'iec_b52_5_xlpe_cu_3loaded', status: 'verified_secondary', source: 'https://ti-soft.com/x' }, { id: 'eng_ups_defaults_and_standard_sizes', status: 'from_memory_needs_review', source: null }]
};
var t = window.ReviewPrompt.build({ title: 'Cable Sizing Result', res: res, inputs: [{ label: 'Voltage (V)', value: '400' }, { label: 'Power (kW) - optional', value: '' }] });
ok('title', /Calculation type: Cable Sizing Result/.test(t));
ok('input with unit', /- Voltage \(V\): 400/.test(t));
ok('empty input flagged', /Power \(kW\) - optional: \(empty, default used\)/.test(t));
ok('warning present', /default 0.85 used/.test(t));
ok('both steps with formula/substitution/result', /1\. Design Current Ib\n {3}Formula: Ib = I\n {3}Substitution: I = 60 A\n {3}Result: 60 A/.test(t) && /2\. Breaker/.test(t));
ok('summary', /## 4. Final result\nBreaker: 63 A/.test(t));
ok('sources numbered with status', /\[1\] iec_b52_5_xlpe_cu_3loaded/.test(t) && /\[2\] eng_ups_defaults/.test(t) && /from_memory_needs_review/.test(t));
ok('missing source marked', /المصدر: المصدر غير مسجل/.test(t));
ok('no invented page', /الصفحة: غير مسجل/.test(t));
ok('instructions: recompute, no invented clauses, severity', /Recompute every step/.test(t) && /Do not invent clause numbers/.test(t) && /severity/.test(t) && /Arabic with English technical terms/.test(t));
ok('no emoji', !/[\u{1F300}-\u{1FAFF}]/u.test(t));
var e = window.ReviewPrompt.build({ title: 'X', res: {}, inputs: [] });
ok('empty result still builds', /No steps were returned/.test(e) && /Inputs were not captured/.test(e));
var c = window.ReviewPrompt.buildChat({ task: 'Size a cable for 60 A', answer: 'Use 25 mm2 Cu.' });
ok('chat prompt: task and answer included', /Size a cable for 60 A/.test(c) && /Use 25 mm2 Cu\./.test(c));
ok('chat prompt: says answer is not calculator output', /NOT computed by a deterministic calculator/.test(c));
ok('chat prompt: no invented clauses rule and verdict', /Do not invent clause numbers/.test(c) && /Accept, Accept with comments, or Reject/.test(c));
ok('chat prompt: empty input still builds', /task text not captured/.test(window.ReviewPrompt.buildChat({})) );
ok('chat prompt: no emoji', !/[\u{1F300}-\u{1FAFF}]/u.test(c));
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL REVIEW-PROMPT TESTS PASSED');
