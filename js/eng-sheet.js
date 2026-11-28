/* Ramz - calculation sheet: one structured object drives the on-screen sheet (phone first, no sideways
   scrolling), the markdown used for the Excel export, and the PDF document. Text only comes from the
   calculators, the app tables and the user's confirmed values. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cell(x) { return String(x == null ? '' : x).replace(/\|/g, '/').replace(/\s+/g, ' ').trim(); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function project() { try { return (window.EngPDF && window.EngPDF.projectInfo) ? window.EngPDF.projectInfo() : { name: '' }; } catch (e) { return { name: '' }; } }
  function baseMeta(calc, edition, extra) {
    var p = project(), m = [['Project', p.name || 'Not set (Settings > Project)'], ['Date', today()], ['Calculator', calc], ['Edition / basis', edition]];
    (extra || []).forEach(function (x) { m.push(x); });
    return m;
  }

  function numbered(sh) {
    var c = Object.assign({}, sh);
    c.sections = (sh.sections || []).map(function (s) {
      if (s.type !== 'box' || (s.kind !== 'assump' && s.kind !== 'question')) return s;
      var p = s.kind === 'assump' ? 'A' : 'Q', items = (s.items || []).map(function (t, i) { return p + (i + 1) + '  ' + t + (p === 'Q' ? '  [Open]' : ''); });
      return Object.assign({}, s, { items: items.length ? items : ['None'] });
    });
    return c;
  }
  /* ---------- on-screen HTML ---------- */
  function html(sh) {
    sh = numbered(sh);
    var o = '<div class="cs" dir="rtl">';
    o += '<div class="cs-head"><div class="cs-title">' + esc(sh.title) + '</div><div class="cs-meta">';
    (sh.meta || []).forEach(function (m) { o += '<div class="cs-m"><span class="cs-ml">' + esc(m[0]) + '</span><span class="cs-mv" dir="auto">' + esc(m[1]) + '</span></div>'; });
    o += '</div></div>';
    if ((sh.kpis || []).length) {
      o += '<div class="cs-h">Results &middot; النتائج</div><div class="cs-kpis">';
      sh.kpis.forEach(function (k) { o += '<div class="cs-kpi' + (k.bad ? ' bad' : '') + '"><div class="cs-kv" dir="ltr">' + esc(k.v) + '<span class="cs-ku">' + esc(k.u || '') + '</span></div><div class="cs-kl">' + esc(k.l) + '</div></div>'; });
      o += '</div>';
    }
    (sh.sections || []).forEach(function (s) {
      if (s.type === 'cards') {
        o += '<div class="cs-h">' + esc(s.title) + '</div>';
        (s.rows || []).forEach(function (r) {
          o += '<div class="cs-card' + (r.total ? ' tot' : '') + '"><div class="cs-ch" dir="auto">' + esc(r.head) + '</div><div class="cs-grid">';
          r.cells.forEach(function (c) { o += '<div class="cs-c"><span class="cs-cl">' + esc(c[0]) + '</span><span class="cs-cv" dir="ltr">' + esc(c[1]) + '</span></div>'; });
          o += '</div></div>';
        });
      } else if (s.type === 'steps') {
        o += '<div class="cs-h">' + esc(s.title) + '</div>';
        (s.rows || []).forEach(function (r) {
          o += '<div class="cs-step"><div class="cs-sn" dir="auto">' + esc(r.step) + '</div>';
          if (r.formula) o += '<div class="cs-sl"><span>Formula</span><code dir="ltr">' + esc(r.formula) + '</code></div>';
          if (r.substitution) o += '<div class="cs-sl"><span>Substitution</span><code dir="ltr">' + esc(r.substitution) + '</code></div>';
          if (r.result) o += '<div class="cs-sl res"><span>Result</span><code dir="ltr">' + esc(r.result) + '</code></div>';
          o += '</div>';
        });
      } else if (s.type === 'box') {
        o += '<div class="cs-box ' + esc(s.kind || '') + '"><div class="cs-bh">' + esc(s.title) + '</div><ul>';
        (s.items || []).forEach(function (t) { o += '<li dir="auto">' + esc(t) + '</li>'; });
        o += '</ul></div>';
      }
    });
    var gk = (sh.kpis || []).filter(function (k) { return k.sticky; })[0] || (sh.kpis || []).filter(function (k) { return /demand/i.test(k.l); })[0];
    if (gk) o += '<div class="cs-sticky" dir="ltr"><span>' + esc(gk.l) + '</span><b>' + esc(gk.v) + ' ' + esc(gk.u || '') + '</b></div>';
    return o + '</div>';
  }

  /* ---------- markdown (Excel export, copy, history) ---------- */
  function markdown(sh) {
    sh = numbered(sh);
    var L = ['# ' + sh.title, '', '| Item | Value |', '|---|---|'];
    (sh.meta || []).forEach(function (m) { L.push('| ' + cell(m[0]) + ' | ' + cell(m[1]) + ' |'); });
    if ((sh.kpis || []).length) {
      L.push('', '## Results', '| Item | Value | Unit |', '|---|---|---|');
      sh.kpis.forEach(function (k) { L.push('| ' + cell(k.l) + ' | ' + cell(k.v) + ' | ' + cell(k.u || '') + ' |'); });
    }
    (sh.sections || []).forEach(function (s) {
      L.push('', '## ' + s.title.replace(/\s*\u00b7.*$/, ''));
      if (s.type === 'cards') {
        var labels = (s.rows[0] ? s.rows[0].cells : []).map(function (c) { return c[0]; });
        L.push('| Item | ' + labels.map(cell).join(' | ') + ' |', '|---|' + labels.map(function () { return '---|'; }).join(''));
        s.rows.forEach(function (r) { L.push('| ' + cell(r.head) + ' | ' + r.cells.map(function (c) { return cell(c[1]); }).join(' | ') + ' |'); });
      } else if (s.type === 'steps') {
        L.push('| Step | Formula | Substitution | Result |', '|---|---|---|---|');
        s.rows.forEach(function (r) { L.push('| ' + cell(r.step) + ' | ' + cell(r.formula) + ' | ' + cell(r.substitution) + ' | ' + cell(r.result) + ' |'); });
      } else if (s.type === 'box') {
        (s.items || []).forEach(function (t) { L.push('- ' + cell(t)); });
      }
    });
    return L.join('\n');
  }

  /* ---------- PDF document for EngPDF.render ---------- */
  function pdfDoc(sh) {
    sh = numbered(sh);
    var blocks = [];
    var head = (sh.kpis || []).map(function (k) { return k.l + ': ' + k.v + ' ' + (k.u || ''); }).join('   |   ');
    blocks.push({ type: 'summary', text: head || sh.title, ok: sh.ok });
    blocks.push({ type: 'kv', heading: 'Title block', rows: (sh.meta || []).map(function (m) { return [m[0], String(m[1])]; }) });
    (sh.sections || []).forEach(function (s) {
      var h = s.title;
      if (s.type === 'cards' && s.rows.length) {
        var labels = s.rows[0].cells.map(function (c) { return c[0]; }), n = labels.length + 1, w = [0.28];
        for (var i = 1; i < n; i++) w.push(0.72 / (n - 1));
        blocks.push({ type: 'table', heading: h, columns: ['Item'].concat(labels), rows: s.rows.map(function (r) { return [r.head].concat(r.cells.map(function (c) { return String(c[1]); })); }), widths: w, fontSize: n > 6 ? 18 : 20 });
      } else if (s.type === 'steps') {
        blocks.push({ type: 'table', heading: h, columns: ['Step', 'Formula', 'Substitution', 'Result'], rows: s.rows.map(function (r) { return [r.step, r.formula || '', r.substitution || '', r.result || '']; }), widths: [0.2, 0.28, 0.3, 0.22], fontSize: 18 });
      } else if (s.type === 'box') {
        if (s.kind === 'basis') blocks.push({ type: 'text', heading: h, text: (s.items || []).join('\n') });
        else if ((s.items || []).length) blocks.push({ type: 'warnings', heading: h, items: s.items });
      }
    });
    return { title: sh.title, subtitle: sh.edition || 'Deterministic calculation sheet', blocks: blocks, signature: true, fileBase: sh.title };
  }


  /* ---------- styled XLSX (EngXlsx) following the layout logic of an engineering area program ---------- */
  function pn(v) { var m = /^(-?[\d,]+(?:\.\d+)?)\s*(kVA|m\u00b2|VA\/m\u00b2|kW|A|V|mm\u00b2|%)?$/.exec(String(v == null ? '' : v).trim()); if (!m || /^,|,$/.test(m[1])) return null; var dp = (m[1].split('.')[1] || '').length; return { n: parseFloat(m[1].replace(/,/g, '')), u: m[2] || '', dp: dp }; }
  function num(v) { var q = pn(v); return q && !q.u ? q.n : null; }
  function fmtOf(q) { var base = q.dp ? '#,##0.' + new Array(q.dp + 1).join('0') : '#,##0'; return q.u ? base + ' "' + q.u + '"' : base; }
  function ncell(v, st) { var q = pn(v); if (!q) return Object.assign({ v: String(v) }, { s: st }); return { v: q.n, s: Object.assign({}, st, { fmt: fmtOf(q) }) }; }
  function book(sh) {
    sh = numbered(sh);
    var GOLD = 'F6DD8C', BLUE = '526D94', GREY = 'D9D9D9', GREEN = 'E2EFDA', PINK = 'FCE4E4', WH = 'FFFFFF';
    var rows = [], merges = [], heights = {}, ncol = 5, r;
    (sh.sections || []).forEach(function (s) { if (s.type === 'cards' && s.rows[0]) ncol = Math.max(ncol, s.rows[0].cells.length + 1); if (s.type === 'steps') ncol = Math.max(ncol, 4); });
    function put(row, cols) { rows[row] = cols; }
    function bar(text, bg, color, sz, ht) { var a = [{ v: text, s: { b: 1, sz: sz, color: color, bg: bg, h: 'center', border: 1 } }]; for (var i = 1; i < ncol; i++) a.push({ v: '', s: { bg: bg, border: 1 } }); r = rows.length; put(r, a); merges.push('A' + (r + 1) + ':' + EngXlsx.colName(ncol - 1) + (r + 1)); heights[r] = ht; }
    function band(text) { bar(text, BLUE, WH, 12, 22); }
    bar(sh.title, GOLD, '3A3A3A', 16, 30);
    bar((sh.edition || 'Deterministic calculation sheet') + '  |  Ramz', BLUE, WH, 11, 20);
    (sh.meta || []).forEach(function (m) { r = rows.length; var a = [{ v: m[0], s: { b: 1, bg: GREY, border: 1 } }, { v: String(m[1]), s: { border: 1, h: 'left' } }]; for (var i = 2; i < ncol; i++) a.push({ v: '', s: { border: 1 } }); put(r, a); merges.push('B' + (r + 1) + ':' + EngXlsx.colName(ncol - 1) + (r + 1)); });
    if ((sh.kpis || []).length) {
      rows.push(null); band('RESULTS SUMMARY');
      sh.kpis.forEach(function (k) { r = rows.length; var n = num(k.v); var a = [{ v: k.l, s: { b: 1, bg: GREEN, border: 1 } }, (function () { var q = pn(k.v); return q ? { v: q.n, s: { b: 1, sz: 13, bg: k.bad ? PINK : 'FFF2CC', border: 1, h: 'center', fmt: fmtOf(q) } } : { v: String(k.v), s: { b: 1, sz: 13, bg: 'FFF2CC', border: 1, h: 'center' } }; })(), { v: k.u || '', s: { border: 1, h: 'center' } }]; for (var i = 3; i < ncol; i++) a.push({ v: '', s: { border: 1 } }); put(r, a); });
    }
    (sh.sections || []).forEach(function (s) {
      rows.push(null); band(s.title.replace(/\s*\u00b7.*$/, '').toUpperCase());
      if (s.type === 'cards' && s.rows.length) {
        var labels = s.rows[0].cells.map(function (c) { return c[0]; });
        r = rows.length; var h = [{ v: 'Item', s: { b: 1, bg: GREY, border: 1, h: 'center' } }]; labels.forEach(function (l) { h.push({ v: l, s: { b: 1, bg: GREY, border: 1, h: 'center', wrap: 1 } }); }); while (h.length < ncol) h.push({ v: '', s: { bg: GREY, border: 1 } }); put(r, h); heights[r] = 32;
        var firstR = rows.length;
        s.rows.forEach(function (x) { r = rows.length; var t = !!x.total; var a = [{ v: x.head, s: { b: t ? 1 : 0, bg: t ? 'FFC000' : GREEN, border: 1, wrap: 1 } }]; x.cells.forEach(function (c, ci) {
          var st = { b: t ? 1 : 0, bg: t ? 'FFC000' : null, border: 1, h: 'center' }, q = pn(c[1]), cc = ncell(c[1], st);
          if (t && q && r > firstR && s.rows.every(function (y) { var z = pn(y.cells[ci] && y.cells[ci][1]); return y.total || (z && z.u === q.u); })) { var L = EngXlsx.colName(ci + 1); cc.f = 'SUM(' + L + (firstR + 1) + ':' + L + r + ')'; }
          a.push(cc); }); while (a.length < ncol) a.push({ v: '', s: { border: 1 } }); put(r, a); });
      } else if (s.type === 'steps') {
        r = rows.length; var hh = ['Step', 'Formula', 'Substitution', 'Result'].map(function (l) { return { v: l, s: { b: 1, bg: GREY, border: 1, h: 'center' } }; }); while (hh.length < ncol) hh.push({ v: '', s: { bg: GREY, border: 1 } }); put(r, hh);
        s.rows.forEach(function (x) { r = rows.length; var a = [x.step, x.formula || '', x.substitution || '', x.result || ''].map(function (t, i) { return { v: String(t), s: { border: 1, wrap: 1, b: i === 3 ? 1 : 0, bg: i === 3 ? PINK : null, v: 'top' } }; }); while (a.length < ncol) a.push({ v: '', s: { border: 1 } }); put(r, a); heights[r] = Math.max(34, Math.ceil(Math.max(String(x.formula || '').length / 22, String(x.substitution || '').length / 20, String(x.result || '').length / 20, String(x.step || '').length / 30)) * 15); });
      } else if (s.type === 'box') {
        (s.items || []).forEach(function (t) { r = rows.length; var a = [{ v: String(t), s: { wrap: 1, border: 1, bg: s.kind === 'warn' || s.kind === 'open' ? 'FFF2CC' : 'F2F2F2', v: 'top' } }]; for (var i = 1; i < ncol; i++) a.push({ v: '', s: { border: 1, bg: s.kind === 'warn' || s.kind === 'open' ? 'FFF2CC' : 'F2F2F2' } }); put(r, a); merges.push('A' + (r + 1) + ':' + EngXlsx.colName(ncol - 1) + (r + 1)); heights[r] = Math.max(20, Math.ceil(String(t).length / 95) * 17); });
      }
    });
    rows.push(null); band('SIGN-OFF');
    r = rows.length; put(r, ['Prepared', 'Checked', 'Approved'].map(function (l) { return { v: l + ':  name / signature / date', s: { border: 1, b: 1, bg: GREY } }; })); heights[r] = 20;
    r = rows.length; put(r, [{ v: '', s: { border: 1 } }, { v: '', s: { border: 1 } }, { v: '', s: { border: 1 } }]); heights[r] = 44;
    var cols = [38]; for (var i = 1; i < ncol; i++) cols.push(i === 1 ? 26 : 18);
    return { sheets: [{ name: 'Calculation Sheet', rows: rows, merges: merges, heights: heights, cols: cols, freeze: 2 }] };
  }
  function xlsx(sh, name) { return window.EngXlsx.download(book(sh), (name || sh.title || 'Ramz-calculation-sheet').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.xlsx'); }

  window.EngSheet = { book: book, xlsx: xlsx, html: html, markdown: markdown, pdfDoc: pdfDoc, baseMeta: baseMeta, today: today };
})();
