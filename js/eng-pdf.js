/* Client-side PDF export (no server, no library).
   Pages are drawn on canvas (the browser shapes Arabic/RTL text) and packed as JPEG pages into a minimal PDF.
   Doc model: { title, subtitle, ref, project:{name,client,loc,ref}, blocks:[...], signature:true|false }
   Block types: summary{text,ok}, status{tables:[{id,status,source}]}, warnings{items}, kv{heading,rows:[[k,v]]},
                text{heading,text}, table{heading,columns:[..],rows:[[..]],widths:[..],rtl}  */
(function () {
  'use strict';

  var W = 1240, H = 1754, M = 80, PT_W = 595.28, PT_H = 841.89;
  var FONT = '"Segoe UI", Tahoma, "Noto Naskh Arabic", "Noto Sans Arabic", Arial, sans-serif';
  var C = { navy: '#0f172a', ac: '#4f46e5', line: '#cbd5e1', soft: '#f1f5f9', tx: '#111827', mut: '#475569', ok: '#15803d', okbg: '#e8f6ec', warn: '#b45309', warnbg: '#fdf2e1', bad: '#b91c1c', badbg: '#fdeaea' };

  function hasArabic(s) { var m = String(s).match(/[\u0600-\u06FF]/g); return !!m && m.length >= Math.max(2, String(s).replace(/[\s\d\W]/g, '').length * 0.3); }

  function projectInfo() {
    var raw = null;
    try { raw = (window.LS && typeof window.LS.get === 'function') ? window.LS.get('teamai.project') : localStorage.getItem('teamai.project'); } catch (e) {}
    try { var o = typeof raw === 'string' ? JSON.parse(raw) : raw; if (o && typeof o === 'object') return { name: o.name || '', client: o.client || '', loc: o.loc || '', ref: o.ref || '' }; } catch (e2) {}
    return { name: '', client: '', loc: '', ref: '' };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateStr(d) { return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function refNo(d) { return 'TAI-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()); }

  /* ---------- layout helpers ---------- */
  function Pager() {
    this.pages = []; this.ctx = null; this.y = 0;
    this.newPage();
  }
  Pager.prototype.newPage = function () {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    this.pages.push(cv); this.ctx = c; this.y = M + 20;
    return c;
  };
  Pager.prototype.space = function (h) { if (this.y + h > H - M - 40) { this.newPage(); this.y = M + 10; return true; } return false; };

  function wrap(ctx, text, maxW) {
    var out = [];
    String(text === undefined || text === null ? '' : text).split('\n').forEach(function (para) {
      var words = para.split(/\s+/), line = '';
      if (!para.trim()) { out.push(''); return; }
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width <= maxW) { line = t; return; }
        if (line) { out.push(line); line = ''; }
        if (ctx.measureText(w).width <= maxW) { line = w; return; }
        var chunk = '';
        for (var i = 0; i < w.length; i++) {
          if (ctx.measureText(chunk + w[i]).width > maxW && chunk) { out.push(chunk); chunk = ''; }
          chunk += w[i];
        }
        line = chunk;
      });
      if (line) out.push(line);
    });
    return out;
  }

  function setFont(ctx, size, bold) { ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; }

  /* draw wrapped text in a box; returns height used. rtl decided per text unless forced */
  function drawText(ctx, text, x, y, w, size, color, bold, rtl) {
    setFont(ctx, size, bold);
    var lh = Math.round(size * 1.5), lines = wrap(ctx, text, w);
    var isR = rtl === undefined ? hasArabic(text) : rtl;
    ctx.fillStyle = color; ctx.textBaseline = 'top'; ctx.direction = isR ? 'rtl' : 'ltr'; ctx.textAlign = isR ? 'right' : 'left';
    lines.forEach(function (l, i) { ctx.fillText(l, isR ? x + w : x, y + i * lh); });
    ctx.direction = 'ltr'; ctx.textAlign = 'left';
    return lines.length * lh;
  }
  function measure(ctx, text, w, size, bold) { setFont(ctx, size, bold); return wrap(ctx, text, w).length * Math.round(size * 1.5); }

  function heading(pg, text) {
    pg.space(200);
    var c = pg.ctx;
    c.fillStyle = C.soft; c.fillRect(M, pg.y, W - 2 * M, 54);
    c.fillStyle = C.ac; c.fillRect(hasArabic(text) ? W - M - 8 : M, pg.y, 8, 54);
    drawText(c, text, M + 22, pg.y + 11, W - 2 * M - 44, 28, C.navy, true);
    pg.y += 54 + 18;
  }

  function box(pg, text, fg, bg, size, bold) {
    var inner = W - 2 * M - 44, h = measure(pg.ctx, text, inner, size || 26, bold) + 26;
    pg.space(h + 12);
    var c = pg.ctx;
    c.fillStyle = bg; c.fillRect(M, pg.y, W - 2 * M, h);
    c.strokeStyle = fg; c.lineWidth = 2; c.strokeRect(M + 1, pg.y + 1, W - 2 * M - 2, h - 2);
    drawText(c, text, M + 22, pg.y + 13, inner, size || 26, C.tx, !!bold);
    pg.y += h + 14;
  }

  function table(pg, b) {
    var cols = b.columns, n = cols.length, tw = W - 2 * M, fs = b.fontSize || 22, padd = 10;
    var widths = (b.widths || cols.map(function () { return 1 / n; })).map(function (r) { return Math.floor(r * tw); });
    var rtl = !!b.rtl;
    function xOf(i) { var off = 0, k; if (rtl) { for (k = 0; k < i; k++) off += widths[k]; return M + tw - off - widths[i]; } for (k = 0; k < i; k++) off += widths[k]; return M + off; }
    function rowH(cells, bold) { var h = 0; cells.forEach(function (t, i) { h = Math.max(h, measure(pg.ctx, t, widths[i] - 2 * padd, fs, bold)); }); return h + 2 * padd; }
    function drawRow(cells, bold, bg) {
      var h = rowH(cells, bold), c = pg.ctx;
      if (pg.y + h > H - M - 40) { pg.newPage(); pg.y = M + 10; drawHead(); h = rowH(cells, bold); c = pg.ctx; }
      if (bg) { c.fillStyle = bg; c.fillRect(M, pg.y, tw, h); }
      c.strokeStyle = C.line; c.lineWidth = 1.5; c.strokeRect(M, pg.y, tw, h);
      cells.forEach(function (t, i) {
        var x = xOf(i);
        if (i > 0) { c.beginPath(); var lx = rtl ? x + widths[i] : x; c.moveTo(lx, pg.y); c.lineTo(lx, pg.y + h); c.stroke(); }
        drawText(c, t, x + padd, pg.y + padd, widths[i] - 2 * padd, fs, bold ? C.navy : C.tx, bold, rtl ? true : undefined);
      });
      pg.y += h;
    }
    function drawHead() { drawRow(cols, true, '#e2e8f0'); }
    if (b.heading) heading(pg, b.heading);
    pg.space(rowH(cols, true) + rowH(b.rows[0] || [''], false));
    drawHead();
    b.rows.forEach(function (r, i) { drawRow(r.map(function (x) { return x === undefined || x === null ? '' : String(x); }), false, i % 2 ? '#f8fafc' : null); });
    pg.y += 24;
  }

  function signature(pg) {
    var h = 250; pg.space(h + 20);
    heading(pg, 'اعتماد / Sign-off');
    var c = pg.ctx, bw = Math.floor((W - 2 * M - 40) / 3), labels = ['Prepared by / إعداد', 'Reviewed by / مراجعة', 'Approved by / اعتماد'];
    labels.forEach(function (l, i) {
      var x = M + i * (bw + 20);
      c.strokeStyle = C.line; c.lineWidth = 2; c.strokeRect(x, pg.y, bw, 170);
      drawText(c, l, x + 14, pg.y + 12, bw - 28, 22, C.mut, true, false);
      c.strokeStyle = C.mut; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 20, pg.y + 120); c.lineTo(x + bw - 20, pg.y + 120); c.stroke();
      drawText(c, 'Name / الاسم', x + 14, pg.y + 128, bw - 28, 18, C.mut, false, false);
      drawText(c, 'Signature / التوقيع      Date / التاريخ', x + 14, pg.y + 148, bw - 28, 16, C.mut, false, false);
    });
    pg.y += 190;
  }

  function header(pg, doc, d) {
    var c = pg.ctx;
    c.fillStyle = C.navy; c.fillRect(0, 0, W, 170);
    drawText(c, 'TEAM AI  |  ENGINEERING REPORT', M, 34, W - 2 * M, 22, '#a5b4fc', true, false);
    drawText(c, doc.title || 'Report', M, 70, W - 2 * M, 40, '#ffffff', true);
    drawText(c, (doc.subtitle || ''), M, 124, W - 2 * M, 22, '#cbd5e1', false);
    pg.y = 200;
    var p = doc.project || projectInfo(), rows = [];
    rows.push(['Ref No.', doc.ref || refNo(d)]); rows.push(['Date', dateStr(d)]);
    if (p.name) rows.push(['Project', p.name]); if (p.client) rows.push(['Client', p.client]);
    if (p.loc) rows.push(['Location', p.loc]); if (p.ref) rows.push(['Project Ref', p.ref]);
    var colW = (W - 2 * M) / 2, rh = 40, i, r;
    for (i = 0; i < rows.length; i += 2) {
      for (var j = 0; j < 2 && i + j < rows.length; j++) {
        r = rows[i + j];
        var x = M + j * colW;
        drawText(c, r[0] + ':', x, pg.y, 150, 22, C.mut, true, false);
        drawText(c, r[1], x + 160, pg.y, colW - 180, 22, C.tx, false);
      }
      pg.y += rh;
    }
    c.strokeStyle = C.line; c.lineWidth = 2; c.beginPath(); c.moveTo(M, pg.y + 4); c.lineTo(W - M, pg.y + 4); c.stroke();
    pg.y += 28;
  }

  function footers(pages, d) {
    var n = pages.length;
    pages.forEach(function (cv, i) {
      var c = cv.getContext('2d');
      c.strokeStyle = C.line; c.lineWidth = 1.5; c.beginPath(); c.moveTo(M, H - 70); c.lineTo(W - M, H - 70); c.stroke();
      drawText(c, 'Generated by Team AI on ' + dateStr(d) + '. Tables are public mirrors unless marked: verify against the official standard before use.', M, H - 58, W - 2 * M - 160, 15, C.mut, false, false);
      drawText(c, 'Page ' + (i + 1) + ' / ' + n, W - M - 150, H - 58, 150, 18, C.mut, true, false);
    });
  }

  function statusColor(st) {
    st = String(st || '');
    if (st.indexOf('verified') === 0 && st.indexOf('old_edition') < 0) return [C.ok, C.okbg];
    return [C.warn, C.warnbg];
  }

  /* single-line diagram: neutral primitives from EngSLD.build, drawn scaled to the page width */
  function drawSld(pg, b) {
    var d = b.sld; if (!d || !d.prims) return;
    if (b.heading) heading(pg, b.heading);
    var sc = Math.min(1.9, (W - 2 * M) / d.w), hh = Math.round(d.h * sc);
    pg.space(hh + 30);
    var c = pg.ctx, ox = M + Math.round(((W - 2 * M) - d.w * sc) / 2), oy = pg.y;
    c.fillStyle = '#ffffff'; c.fillRect(M, oy - 6, W - 2 * M, hh + 12);
    c.strokeStyle = C.line; c.lineWidth = 1.5; c.strokeRect(M, oy - 6, W - 2 * M, hh + 12);
    d.prims.forEach(function (p) {
      if (p.t === 'line') { c.strokeStyle = '#0f172a'; c.lineWidth = (p.w || 3) * sc; c.beginPath(); c.moveTo(ox + p.x1 * sc, oy + p.y1 * sc); c.lineTo(ox + p.x2 * sc, oy + p.y2 * sc); c.stroke(); }
      else if (p.t === 'rect') { if (p.fill) { c.fillStyle = p.fill; c.fillRect(ox + p.x * sc, oy + p.y * sc, p.w * sc, p.h * sc); } if (p.stroke) { c.strokeStyle = p.stroke; c.lineWidth = 2.5 * sc; c.strokeRect(ox + p.x * sc, oy + p.y * sc, p.w * sc, p.h * sc); } }
      else if (p.t === 'poly') { c.fillStyle = p.fill || '#0f172a'; c.beginPath(); p.pts.forEach(function (q, i) { if (i) c.lineTo(ox + q[0] * sc, oy + q[1] * sc); else c.moveTo(ox + q[0] * sc, oy + q[1] * sc); }); c.closePath(); c.fill(); }
      else if (p.t === 'text') {
        setFont(c, Math.round(p.size * sc), p.bold); c.fillStyle = '#0f172a'; c.textBaseline = 'top'; c.direction = 'ltr';
        c.textAlign = p.anchor === 'middle' ? 'center' : (p.anchor === 'end' ? 'right' : 'left');
        c.fillText(p.s, ox + p.x * sc, oy + p.y * sc); c.textAlign = 'left';
      }
    });
    pg.y += hh + 24;
  }

  /* ---------- public: render + pack ---------- */
  function render(doc) {
    var d = new Date(), pg = new Pager();
    header(pg, doc, d);
    (doc.blocks || []).forEach(function (b) {
      if (b.type === 'summary') { box(pg, b.text, b.ok === false ? C.bad : (b.ok === true ? C.ok : C.ac), b.ok === false ? C.badbg : (b.ok === true ? C.okbg : '#eef2ff'), 28, true); }
      else if (b.type === 'status') {
        heading(pg, b.heading || 'الجداول المستخدمة وحالتها / Tables used');
        b.tables.forEach(function (t) { var col = statusColor(t.status); box(pg, t.id + '  |  ' + t.status + (t.source ? '  |  ' + t.source : ''), col[0], col[1], 20, false); });
      }
      else if (b.type === 'warnings') { heading(pg, b.heading || 'تنبيهات / Warnings'); b.items.forEach(function (w) { box(pg, w, C.warn, C.warnbg, 22, false); }); }
      else if (b.type === 'kv') { heading(pg, b.heading || ''); table(pg, { columns: ['Item', 'Value'], rows: b.rows, widths: [0.38, 0.62], fontSize: 22 }); }
      else if (b.type === 'text') { if (b.heading) heading(pg, b.heading); var h = measure(pg.ctx, b.text, W - 2 * M, 24, false); pg.space(Math.min(h, 200) + 10); var left = h, txt = String(b.text); drawParagraphs(pg, txt); }
      else if (b.type === 'sld') { drawSld(pg, b); }
      else if (b.type === 'table') { table(pg, b); }
    });
    if (doc.signature !== false) signature(pg);
    footers(pg.pages, d);
    return pg.pages;
  }

  function drawParagraphs(pg, text) {
    var ctx = pg.ctx, size = 24, lh = Math.round(size * 1.5), w = W - 2 * M;
    setFont(ctx, size, false);
    var lines = wrap(ctx, text, w), rtl = hasArabic(text);
    lines.forEach(function (l) {
      if (pg.y + lh > H - M - 40) { pg.newPage(); pg.y = M + 10; setFont(pg.ctx, size, false); }
      var c = pg.ctx; c.fillStyle = C.tx; c.textBaseline = 'top'; c.direction = rtl ? 'rtl' : 'ltr'; c.textAlign = rtl ? 'right' : 'left';
      c.fillText(l, rtl ? M + w : M, pg.y); c.direction = 'ltr'; c.textAlign = 'left'; pg.y += lh;
    });
    pg.y += 14;
  }

  /* ---------- minimal PDF writer: one JPEG per A4 page ---------- */
  function b64ToBytes(b64) { var bin = atob(b64), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u; }
  function strBytes(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }

  function packJpegs(jpegs, meta) {
    /* jpegs: [{bytes:Uint8Array,w,h}] -> Uint8Array PDF */
    var parts = [], offsets = [], len = 0, n = jpegs.length;
    function push(u) { parts.push(u); len += u.length; }
    function pushS(s) { push(strBytes(s)); }
    function obj(id, bodyFn) { offsets[id] = len; pushS(id + ' 0 obj\n'); bodyFn(); pushS('\nendobj\n'); }
    pushS('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    var kids = [], i;
    for (i = 0; i < n; i++) kids.push((4 + i * 3) + ' 0 R');
    obj(1, function () { pushS('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { pushS('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>'); });
    obj(3, function () { pushS('<< /Title (' + String(meta.title || 'Report').replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '') + ') /Producer (Team AI) /CreationDate (D:' + meta.stamp + ') >>'); });
    for (i = 0; i < n; i++) {
      (function (k) {
        var pid = 4 + k * 3, cid = pid + 1, iid = pid + 2, content = 'q ' + PT_W + ' 0 0 ' + PT_H + ' 0 0 cm /Im0 Do Q';
        obj(pid, function () { pushS('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PT_W + ' ' + PT_H + '] /Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>'); });
        obj(cid, function () { pushS('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
        obj(iid, function () {
          pushS('<< /Type /XObject /Subtype /Image /Width ' + jpegs[k].w + ' /Height ' + jpegs[k].h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegs[k].bytes.length + ' >>\nstream\n');
          push(jpegs[k].bytes); pushS('\nendstream');
        });
      })(i);
    }
    var xref = len, total = 4 + n * 3, s = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (i = 1; i < total; i++) s += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    pushS(s + 'trailer\n<< /Size ' + total + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    var out = new Uint8Array(len), p = 0;
    parts.forEach(function (u) { out.set(u, p); p += u.length; });
    return out;
  }

  function buildBytes(doc) {
    var pages = render(doc), d = new Date();
    var jpegs = pages.map(function (cv) { return { bytes: b64ToBytes(cv.toDataURL('image/jpeg', 0.92).split(',')[1]), w: cv.width, h: cv.height }; });
    var stamp = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
    return { bytes: packJpegs(jpegs, { title: doc.title, stamp: stamp }), pages: pages.length };
  }

  function toBlob(doc) { var r = buildBytes(doc); return new Blob([r.bytes], { type: 'application/pdf' }); }

  function fileName(doc) {
    var d = new Date(), base = String(doc.fileBase || doc.title || 'report').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
    return 'TeamAI-' + base + '-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '.pdf';
  }

  function download(doc) {
    var blob = toBlob(doc), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = fileName(doc); a.rel = 'noopener'; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
    return a.download;
  }

  /* calculator result -> doc */
  function docFromResult(title, res) {
    var steps = (res.steps || []).map(function (s) { return [s.step, s.formula, s.substitution, s.result]; });
    var blocks = [{ type: 'summary', text: res.summary || '', ok: res.ok === false || res.compliant === false ? false : (res.ok === true ? true : undefined) }];
    if ((res.tablesUsed || []).length) blocks.push({ type: 'status', tables: res.tablesUsed });
    if ((res.warnings || []).length) blocks.push({ type: 'warnings', items: res.warnings });
    blocks.push({ type: 'table', heading: 'الحسابات خطوة بخطوة / Calculation steps', columns: ['الخطوة', 'المعادلة', 'التعويض', 'النتيجة'], rows: steps, widths: [0.2, 0.27, 0.31, 0.22], rtl: true, fontSize: 21 });
    return { title: title, subtitle: 'Deterministic calculation with table sources and status flags', blocks: blocks, signature: true, fileBase: title };
  }

  function exportResult(title, res) { return download(docFromResult(title, res)); }

  window.EngPDF = { render: render, toBlob: toBlob, download: download, buildBytes: buildBytes, packJpegs: packJpegs, docFromResult: docFromResult, exportResult: exportResult, fileName: fileName, projectInfo: projectInfo };
})();
