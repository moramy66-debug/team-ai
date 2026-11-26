/* Hand-checked cases for the submittal review rules (no model). */
'use strict';
var path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-submittal.js'));
var S = window.EngSubmittal, fails = 0;
function eq(n, g, w) { if (g !== w) { fails++; console.log('FAIL ' + n + ': got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); } else console.log('ok   ' + n); }

var spec = [
  '1. The MCCB shall comply with IEC 60947-2.',
  '2. Rated short-circuit breaking capacity shall be not less than 25 kA at 400 V.',
  '3. Enclosure shall be IP54 minimum.',
  '4. Rated current shall be 630 A.',
  '5. Contractor shall provide thermal magnetic trip unit with adjustable settings.',
  'Notes'
].join('\n');
var reqs = S.splitRequirements(spec);
eq('5 requirements parsed, heading dropped', reqs.length, 5);
eq('mandatory detected on #1', reqs[0].mandatory, true);
eq('clause number kept', reqs[1].clause, '2');

// Offer: complies with 60947-2 (with year), 36 kA (>= 25 ok), 400 V, IP54, 800 A (deviation vs 630 A), silent on trip unit
var offer = 'Moulded case circuit breaker 3P, tested to IEC 60947-2:2016. Icu = 36 kA at 400 V. Enclosure IP54. Rated current 800 A. Frame size 800.';
var rr = S.ruleReview(spec, offer);
var by = {}; rr.items.forEach(function (i) { (by[i.req] = by[i.req] || []).push(i); });
eq('#1 standard with year accepted', !!by[1], false);
eq('#2 min 25 kA met by 36 kA', !!by[2], false);
eq('#3 IP54 found', !!by[3], false);
eq('#4 630 A vs 800 A is deviation', by[4] && by[4][0].type, 'deviation');
eq('#4 deviation severity major (mandatory)', by[4] && by[4][0].severity, 'major');
eq('#5 trip unit not addressed -> missing', by[5] && by[5][0].type, 'missing');
eq('#5 severity critical (shall)', by[5] && by[5][0].severity, 'critical');

// Offer with 20 kA and wrong standard
var rr2 = S.ruleReview(spec, 'Breaker to IEC 60898. Icu = 20 kA at 400 V. Enclosure IP20. Rated 630 A. adjustable thermal magnetic trip unit settings provided.');
var t = {}; rr2.items.forEach(function (i) { (t[i.req] = t[i.req] || []).push(i.type); });
eq('wrong standard flagged', t[1] && t[1][0], 'missing');
eq('20 kA < 25 kA flagged deviation', t[2] && t[2][0], 'deviation');
eq('IP20 vs IP54 flagged', t[3] && t[3][0], 'missing');
eq('#4 630 A found, no issue', !!t[4], false);

// Arabic digits and Arabic text
var ar = S.ruleReview('1. يجب أن يكون الجهد المقنن 400 V.', 'الجهد المقنن ٤٠٠ V.');
eq('Arabic-Indic digits normalised, requirement met', ar.items.length, 0);

// Conclusion rule
function c(a) { return S.conclusion(a.map(function (s) { return { severity: s }; })).code; }
eq('no items -> A', c([]), 'A');
eq('minor only -> B', c(['minor']), 'B');
eq('1 major -> B (no resubmission)', c(['major']), 'B');
eq('2 majors -> C', c(['major', 'major']), 'C');
eq('3 majors -> C', c(['major', 'major', 'major']), 'C');
eq('manual D overrides', S.conclusion([], 'D').code, 'D');
eq('manual flag set', S.conclusion([], 'E').manual, true);
eq('five codes', Object.keys(S.CODES).join(''), 'ABCDE');
eq('code B label verbatim', S.CODES.B, 'B: معتمد مع ملاحظات - إعادة التقديم غير ضرورية');
eq('code E label verbatim', S.CODES.E, 'E: بدون إجراء');
eq('1 critical -> C', c(['critical']), 'C');

// Model merge: unverified quote flagged, hallucinated req dropped, rule items kept for uncovered reqs
var merged = S.mergeModel([
  { req: 4, type: 'deviation', severity: 'major', offer_quote: 'Rated current 800 A', finding_ar: 'التيار المقنن 800 A بدل 630 A.', action_ar: 'تصحيح.' },
  { req: 5, type: 'missing', severity: 'critical', offer_quote: 'this text is not in the offer', finding_ar: 'وحدة الفصل غير مذكورة.', action_ar: 'تقديم.' },
  { req: 99, type: 'missing', severity: 'critical', offer_quote: '', finding_ar: 'x', action_ar: 'y' }
], reqs, offer, rr.items);
eq('merge drops unknown requirement #99', merged.length, 2);
eq('quote present in offer -> verified', merged.filter(function (m) { return m.req === 4; })[0].verified, true);
eq('invented quote -> not verified', merged.filter(function (m) { return m.req === 5; })[0].verified, false);
var sorted = S.sortItems(merged);
eq('ordered: critical first', sorted[0].severity, 'critical');
var rev = { items: merged, reqCount: 5, concl: S.conclusion(merged), method: 'm', date: '2026-11-26', title: 'T', project: {} };
eq('report text has conclusion line', /كود الاعتماد المقترح: C/.test(S.reportText(rev)), true);
eq('pdf doc has summary,text,table', S.pdfDoc(rev).blocks.map(function (b) { return b.type; }).join(','), 'summary,text,table,table');
var m2 = S.mergeModel([], reqs, offer, rr.items);
eq('rule-only leftovers: clarification dropped, others labelled', m2.every(function (m) { return m.type !== 'clarification' && /لم يؤكدها الموديل/.test(m.finding); }), true);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-SUBMITTAL TESTS PASSED');
