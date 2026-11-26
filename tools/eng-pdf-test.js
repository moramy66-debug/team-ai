/* Structure test for the PDF packer: every xref offset must point at its object. */
'use strict';
var path = require('path');
global.window = {};
require(path.join(__dirname, '../js/eng-pdf.js'));
var P = window.EngPDF, fails = 0;
function eq(name, got, want) { if (got !== want) { fails++; console.log('FAIL ' + name + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); } else console.log('ok   ' + name); }
var jpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
var bytes = P.packJpegs([{ bytes: new Uint8Array(jpg), w: 1, h: 1 }, { bytes: new Uint8Array(jpg), w: 1, h: 1 }], { title: 'Test (x)', stamp: '20261126120000' });
var s = Buffer.from(bytes).toString('latin1');
eq('starts with %PDF-1.4', s.slice(0, 8), '%PDF-1.4');
eq('ends with %%EOF', s.trim().slice(-5), '%%EOF');
eq('page count 2', /\/Count 2/.test(s), true);
var sx = parseInt(/startxref\n(\d+)/.exec(s)[1], 10);
eq('startxref points at xref', s.slice(sx, sx + 4), 'xref');
var lines = s.slice(sx).split('\n'), total = parseInt(lines[1].split(' ')[1], 10);
eq('object count = 4 + 3 pages... (10)', total, 10);
var okAll = true;
for (var i = 1; i < total; i++) {
  var off = parseInt(lines[2 + i].slice(0, 10), 10);
  if (s.slice(off, off + (i + ' 0 obj').length) !== i + ' 0 obj') { okAll = false; console.log('bad offset for obj ' + i); }
}
eq('all xref offsets valid', okAll, true);
eq('image length matches', s.indexOf('/Length ' + jpg.length) > 0, true);
eq('title parentheses stripped', s.indexOf('/Title (Test x)') > 0, true);
eq('file name format', /^TeamAI-Hello-World-\d{8}\.pdf$/.test(P.fileName({ title: 'Hello World!' })), true);
var doc = P.docFromResult('Cable sizing', { summary: 'S', steps: [{ step: 'a', formula: 'b', substitution: 'c', result: 'd' }], tablesUsed: [{ id: 't', status: 'verified_mirror', source: 'u' }], warnings: ['w'], compliant: true });
eq('doc has summary, status, warnings, table blocks', doc.blocks.map(function (b) { return b.type; }).join(','), 'summary,status,warnings,table');
eq('failed result flagged not ok', P.docFromResult('x', { summary: 's', steps: [], compliant: false }).blocks[0].ok, false);
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENG-PDF TESTS PASSED');
