// Validates data/code-library.json: fields, status values, and the sourcing rules.
var fs = require('fs');
var d = JSON.parse(fs.readFileSync(__dirname + '/../data/code-library.json', 'utf8'));
var fails = 0;
function bad(m) { console.log('FAIL ' + m); fails++; }
var F = ['id', 'code', 'topic', 'text', 'clause', 'source_url', 'source_note', 'status', 'checked_on'];
var S = ['verified_mirror', 'verified_secondary', 'needs_review'];
if (!Array.isArray(d) || !d.length) bad('library is not a non-empty array');
var ids = {};
(Array.isArray(d) ? d : []).forEach(function (e) {
  F.forEach(function (k) { if (!(k in e)) bad(e.id + ' missing field ' + k); });
  if (ids[e.id]) bad('duplicate id ' + e.id); ids[e.id] = 1;
  if (S.indexOf(e.status) < 0) bad(e.id + ' bad status ' + e.status);
  if (!e.text || !e.topic) bad(e.id + ' empty text/topic');
  if (e.status !== 'needs_review' && !e.source_url) bad(e.id + ' verified without source_url');
  if (!e.source_url && e.clause !== null) bad(e.id + ' has a clause but no source_url');
  if (e.source_url && !/^https?:\/\//.test(e.source_url)) bad(e.id + ' bad source_url');
  if (e.status === 'needs_review' && /\d+(\.\d+)?\s*(%|kV|V|Hz|mA|ms|s|A|kA|mm2|m2|ohm|Ω)\b/.test(e.text)) bad(e.id + ' needs_review entry contains a number with unit');
});
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ok ' + d.length + ' entries'); console.log('ALL OK');
