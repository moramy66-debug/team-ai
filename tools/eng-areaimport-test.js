'use strict';
const fs = require('fs'), path = require('path');
global.window = {}; global.document = undefined;
require('../js/eng-areaimport.js');
const A = window.EngAreaImport; let fail = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; }
(async () => {
  const xp = path.join(__dirname, 'fixtures/areas-sample.xlsx');
  if (fs.existsSync(xp)) {
  const buf = fs.readFileSync(xp);
  const sheets = await A.parseXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  const d = A.detect(sheets[0].rows), sp = A.buildSpaces(d, d.col);
  ok(sheets[0].name === 'Areas', 'sheet name');
  ok(d.col.area === 2 && d.col.name === 1 && d.col.floor === 0, 'columns detected');
  ok(sp.length === 6, 'rows read ' + sp.length);
  ok(sp[0].cat === 'C7' && sp[1].cat === 'C6' && sp[2].cat === 'C7', 'keyword proposals');
  ok(sp[4].cat === '' , 'parking has no proposal (never guessed)');
  ok(sp[5].excluded && /total/.test(sp[5].note), 'total row excluded');
  ok(Math.abs(sp[0].area - 3990.26) < 1e-9, 'area value exact');
  }
  const c = A.parseCsv(fs.readFileSync(path.join(__dirname, 'fixtures/areas-sample.csv'), 'utf8')), dc = A.detect(c), sc = A.buildSpaces(dc, dc.col);
  ok(sc.length === 4 && sc[0].area === 3990.26, 'csv comma-grouped number');
  ok(sc[0].cat === 'C7' && sc[1].cat === 'C6', 'arabic keywords');
  ok(sc[3].excluded, 'arabic total row excluded');
  ok(isNaN(A.num('abc')) && A.num('1,234.5') === 1234.5 && A.num('١٢٣') === 123, 'num parsing');
  if (fail) { console.log('FAILED ' + fail); process.exit(1); } console.log('ALL AREAIMPORT TESTS PASSED');
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
