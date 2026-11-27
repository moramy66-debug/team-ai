'use strict';
var fs = require('fs'), path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-tables.js'));
require(path.join(__dirname, '../js/source-info.js'));
var data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/eng-tables.json'), 'utf8'));
window.EngTables.setData(data);
var S = window.SourceInfo, fails = 0;
function ok(n, c) { if (!c) { fails++; console.log('FAIL ' + n); } else console.log('ok   ' + n); }
var d = S.describe({ id: 'iec_b52_5_xlpe_cu_3loaded', status: 'verified_secondary' });
ok('title from table', /B\.52\.5/.test(d.title));
ok('url from table', d.isUrl && /^https?:/.test(d.url));
ok('mirror label for non-official host', /mirror/.test(d.kind));
ok('page never invented', d.page === null && d.clause === null);
ok('edition not invented', d.edition === null);
var n = S.describe({ id: 'eng_ups_defaults_and_standard_sizes', status: 'from_memory_needs_review', source: null });
ok('missing source flagged', n.url === null && n.kind === S.NR);
ok('text has missing markers', /المصدر: المصدر غير مسجل/.test(S.text({ id: 'x', status: 'needs_review' }, 2)) && /الصفحة: غير مسجل/.test(S.text({ id: 'x' }, 2)));
ok('status kept', S.describe({ id: 'x', status: 'needs_review' }).status === 'needs_review');
ok('gov.sa is official', /موقع الجهة/.test(S.describe({ id: 'y', source: 'https://www.sera.gov.sa/ar/x', status: 'verified_secondary' }).kind));
var old = S.describe({ id: 'sec_voltage_drop_allocation_dps' });
ok('edition_note shown as edition', !!old.edition);
require(path.join(__dirname, '../js/eng-pdf.js'));
var doc = window.EngPDF.docFromResult('T', { summary: 's', steps: [], tablesUsed: [{ id: 'iec_b52_5_xlpe_cu_3loaded', status: 'verified_secondary', source: 'https://ti-soft.com/x' }, { id: 'z', status: 'from_memory_needs_review', source: null }] });
var b = doc.blocks.filter(function (x) { return x.type === 'status'; })[0];
ok('pdf numbered 1', /^\[1\] /.test(b.tables[0].id) && /^\[2\] /.test(b.tables[1].id));
ok('pdf shows missing', /المصدر غير مسجل/.test(b.tables[1].source) && /الصفحة: غير مسجل/.test(b.tables[1].source));
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL SOURCE-INFO TESTS PASSED');
