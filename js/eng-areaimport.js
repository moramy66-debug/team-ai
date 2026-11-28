/* Ramz - area file import for Load Estimate.
   Deterministic parse (xlsx / csv) -> editable table -> quick-pick questions -> EngLoadEst.calculate.
   The model never computes: every number comes from the file, the user, or the verified table. */
(function () {
  'use strict';
  var KW_C7 = /office|offices|admin|administration|مكتب|مكاتب|اداري|إداري/i;
  var KW_C6 = /restaurant|cafe|café|coffee|food court|مطعم|مطاعم|كافيه|كافي|مقهى|كافتيريا|كافيتريا/i;
  var KW_TOTAL = /^\s*(grand\s+)?(total|sum|subtotal)|اجمالي|إجمالي|المجموع|مجموع/i;
  var H_AREA = /area|m2|m²|sqm|sq\.?\s*m|مساحة|المساحة|م2|م²/i;
  var H_NAME = /space|name|use|usage|type|description|room|zone|function|الفراغ|الاستخدام|البيان|الوصف|النشاط|الاسم/i;
  var H_TYPE = /type|category|النوع|التصنيف|الفئة/i;
  var H_SUMMARY = /total|summary|sum\b|اجمالي|إجمالي|ملخص|الاجمالي/i;
  var H_FLOOR = /floor|level|storey|story|الدور|الطابق|المستوى/i;

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).replace(/[\u066C,\s]/g, '').replace(/\u066B/g, '.').replace(/[\u0660-\u0669]/g, function (d) { return d.charCodeAt(0) - 1632; });
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }
  function round2(x) { return Math.round(x * 100) / 100; }

  /* ---------- CSV ---------- */
  function parseCsv(text) {
    text = text.replace(/^\uFEFF/, '');
    var first = text.split(/\r?\n/)[0] || '';
    var d = [',', ';', '\t'].map(function (c) { return [c, first.split(c).length]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var rows = [], row = [], cur = '', q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === d) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  /* ---------- XLSX (zip + xml, no library) ---------- */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('المتصفح ده مش بيدعم قراءة xlsx. احفظ الملف CSV وارفعه.'));
    var ds = new DecompressionStream('deflate-raw');
    var w = ds.writable.getWriter(); w.write(data); w.close();
    return new Response(ds.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  function unzip(buf) {
    var b = new Uint8Array(buf), i = b.length - 22, files = {};
    while (i >= 0 && u32(b, i) !== 0x06054b50) i--;
    if (i < 0) throw new Error('الملف مش xlsx صالح.');
    var n = u16(b, i + 10), off = u32(b, i + 16), k, p = off;
    for (k = 0; k < n; k++) {
      if (u32(b, p) !== 0x02014b50) break;
      var method = u16(b, p + 10), csize = u32(b, p + 20), nl = u16(b, p + 28), el = u16(b, p + 30), cl = u16(b, p + 32), lo = u32(b, p + 42);
      var name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
      var ln = u16(b, lo + 26), le = u16(b, lo + 28), ds = lo + 30 + ln + le;
      files[name] = { method: method, data: b.subarray(ds, ds + csize) };
      p += 46 + nl + el + cl;
    }
    return files;
  }
  function entryText(f) {
    if (!f) return Promise.resolve('');
    var p = f.method === 0 ? Promise.resolve(f.data) : inflateRaw(f.data);
    return p.then(function (u) { return new TextDecoder().decode(u); });
  }
  function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(+d); }).replace(/&amp;/g, '&'); }
  function colIdx(ref) { var m = /^([A-Z]+)/.exec(ref), c = 0, i; if (!m) return 0; for (i = 0; i < m[1].length; i++) c = c * 26 + m[1].charCodeAt(i) - 64; return c - 1; }
  function textOf(x) { var out = '', re = /<t[^>]*>([\s\S]*?)<\/t>/g, m; while ((m = re.exec(x))) out += m[1]; return unesc(out); }
  function parseXlsx(buf) {
    var files = unzip(buf), sheets = [];
    return Promise.all([entryText(files['xl/workbook.xml']), entryText(files['xl/_rels/workbook.xml.rels']), entryText(files['xl/sharedStrings.xml'])]).then(function (r) {
      var rels = {}, m, re = /<Relationship\b[^>]*>/g;
      while ((m = re.exec(r[1]))) { var id = /\bId="([^"]+)"/.exec(m[0]), tg = /\bTarget="([^"]+)"/.exec(m[0]); if (id && tg) rels[id[1]] = tg[1].replace(/^\/?(xl\/)?/, 'xl/'); }
      var ss = [], rs = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
      while ((m = rs.exec(r[2]))) ss.push(textOf(m[1]));
      var re2 = /<sheet\b[^>]*>/g;
      while ((m = re2.exec(r[0]))) { var nm = /\bname="([^"]*)"/.exec(m[0]), rid = /\br:id="([^"]+)"/.exec(m[0]); if (nm && rid && rels[rid[1]]) sheets.push({ name: unesc(nm[1]), path: rels[rid[1]] }); }
      return Promise.all(sheets.map(function (sh) {
        return entryText(files[sh.path]).then(function (x) {
          var rows = [], rr = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, rm;
          while ((rm = rr.exec(x))) {
            var row = [], cc = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
            while ((cm = cc.exec(rm[1] || ''))) {
              var at = cm[1], body = cm[2] || '', ref = /\br="([A-Z]+\d+)"/.exec(at), t = /\bt="([^"]+)"/.exec(at), v = /<v>([\s\S]*?)<\/v>/.exec(body), val = '';
              if (t && t[1] === 's' && v) val = ss[+v[1]] || '';
              else if (t && t[1] === 'inlineStr') val = textOf(body);
              else if (v) val = t && (t[1] === 'str' || t[1] === 'e') ? unesc(v[1]) : (isNaN(Number(v[1])) ? unesc(v[1]) : Number(v[1]));
              if (ref) row[colIdx(ref[1])] = val;
            }
            for (var k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = '';
            rows.push(row);
          }
          return { name: sh.name, rows: rows };
        });
      }));
    });
  }
  function readFile(file) {
    var nm = (file.name || '').toLowerCase();
    return file.arrayBuffer().then(function (buf) {
      if (/\.xlsx$|\.xlsm$/.test(nm)) return parseXlsx(buf);
      if (/\.csv$|\.txt$|\.tsv$/.test(nm)) return [{ name: file.name, rows: parseCsv(new TextDecoder().decode(buf)) }];
      if (/\.xls$/.test(nm)) throw new Error('صيغة xls القديمة مش مدعومة. احفظ الملف xlsx أو CSV.');
      throw new Error('ارفع ملف xlsx أو csv.');
    });
  }

  /* ---------- detect columns and rows ---------- */
  function cellStr(v) { return String(v == null ? '' : v).trim(); }
  function detect(rows) {
    var hi = -1, i, j, best = null;
    for (i = 0; i < Math.min(rows.length, 20); i++) {
      var r = rows[i] || [], texts = r.filter(function (c) { return cellStr(c) && isNaN(num(c)); });
      if (texts.length >= 2 && r.some(function (c) { return H_AREA.test(cellStr(c)); })) { hi = i; break; }
    }
    var header = hi >= 0 ? rows[hi].map(cellStr) : [];
    var width = rows.reduce(function (m, r) { return Math.max(m, (r || []).length); }, 0);
    for (j = 0; j < width; j++) if (header[j] === undefined) header[j] = '';
    var col = { area: -1, name: -1, floor: -1, type: -1 };
    header.forEach(function (h, k) {
      if (col.area < 0 && H_AREA.test(h)) col.area = k;
      if (col.floor < 0 && H_FLOOR.test(h)) col.floor = k;
    });
    header.forEach(function (h, k) { if (col.name < 0 && k !== col.area && k !== col.floor && H_NAME.test(h) && !(H_TYPE.test(h) && !/space|name|اسم/i.test(h))) col.name = k; });
    header.forEach(function (h, k) { if (col.type < 0 && k !== col.area && k !== col.floor && k !== col.name && H_TYPE.test(h)) col.type = k; });
    var data = rows.slice(hi + 1);
    if (col.area < 0) {
      /* no header: the numeric column with the most numbers */
      var cnt = []; for (j = 0; j < width; j++) cnt[j] = data.filter(function (r) { return !isNaN(num((r || [])[j])); }).length;
      var mx = Math.max.apply(null, cnt); col.area = mx > 0 ? cnt.indexOf(mx) : -1;
    }
    if (col.name < 0) {
      var tc = []; for (j = 0; j < width; j++) tc[j] = (j === col.area || j === col.floor) ? -1 : data.filter(function (r) { var c = cellStr((r || [])[j]); return c && isNaN(num(c)); }).length;
      var tm = Math.max.apply(null, tc); col.name = tm > 0 ? tc.indexOf(tm) : -1;
    }
    return { headerRow: hi, header: header, col: col, data: data, width: width };
  }
  function classify(name) {
    if (KW_C6.test(name) && !KW_C7.test(name)) return { cat: 'C6', why: 'keyword match' };
    if (KW_C7.test(name) && !KW_C6.test(name)) return { cat: 'C7', why: 'keyword match' };
    return { cat: '', why: 'no match' };
  }
  function buildSpaces(d, col, sheetName) {
    var out = [];
    d.data.forEach(function (r, k) {
      r = r || [];
      var nm = col.name >= 0 ? cellStr(r[col.name]) : '', ar = col.area >= 0 ? num(r[col.area]) : NaN, fl = col.floor >= 0 ? cellStr(r[col.floor]) : (sheetName || ''), ty = col.type >= 0 ? cellStr(r[col.type]) : '';
      if (!nm && isNaN(ar)) return;
      var sp = { src: (d.headerRow + 2 + k), sheet: sheetName || '', type: ty, name: nm || '(no name)', floor: fl, area: ar, cat: '', why: '', custDens: '', custDf: '', excluded: false, note: '' };
      if (KW_TOTAL.test(nm) || KW_TOTAL.test(ty) || (col.floor >= 0 && KW_TOTAL.test(fl))) { sp.excluded = true; sp.note = 'looks like a total row, excluded to avoid double counting'; }
      else if (isNaN(ar) || ar <= 0) { sp.excluded = true; sp.note = 'no valid area'; }
      var c = classify(nm + ' ' + ty);
      sp.cat = c.cat; sp.why = c.why;
      out.push(sp);
    });
    return out;
  }

  /* quick read for the chat card: sheets used, totals per proposed category (no model involved) */
  function summarize(sheets) {
    var out = { spaces: 0, c7: 0, c6: 0, unmapped: 0, unmappedArea: 0, area: 0 };
    sheets.forEach(function (sh) {
      if (H_SUMMARY.test(sh.name)) return;
      var d = detect(sh.rows); if (d.col.area < 0) return;
      buildSpaces(d, d.col, sh.name).forEach(function (s) {
        if (s.excluded) return;
        out.spaces++; out.area += s.area;
        if (s.cat === 'C7') out.c7 += s.area; else if (s.cat === 'C6') out.c6 += s.area; else { out.unmapped++; out.unmappedArea += s.area; }
      });
    });
    return out;
  }

  /* ---------- UI ---------- */
  function mount(body, h) {
    var box = h.el('div', 'ec-card imp-import');
    box.appendChild(h.el('div', 'ec-note', 'Import an areas file (xlsx / csv). The app reads it, proposes a DPS-01 category per space, then asks only the key questions. The numbers come from the calculator and the verified table, never from a model.'));
    var pick = document.createElement('input'); pick.type = 'file'; pick.accept = '.xlsx,.xlsm,.csv,.tsv,.txt'; pick.id = 'imp-file'; pick.className = 'imp-file';
    var lab = h.el('label', 'ec-btn imp-pick', 'Upload areas file'); lab.setAttribute('for', 'imp-file');
    box.appendChild(pick); box.appendChild(lab);
    var msg = h.el('div', 'imp-msg', ''); box.appendChild(msg);
    var area = h.el('div', null); box.appendChild(area);
    body.appendChild(box);
    var state = {};

    function loadFile(f) {
      if (!f) return;
      area.innerHTML = ''; msg.className = 'imp-msg'; msg.textContent = 'Reading ' + f.name + ' ...';
      readFile(f).then(function (sheets) {
        sheets = sheets.filter(function (s) { return s.rows.length; });
        if (!sheets.length) throw new Error('الملف فاضي.');
        state.fileName = f.name; state.sheets = sheets;
        var best = 0, bs = -1; sheets.forEach(function (s, k) { var d = detect(s.rows), sc = d.col.area >= 0 ? d.data.filter(function (r) { return !isNaN(num((r || [])[d.col.area])); }).length : 0; if (sc > bs) { bs = sc; best = k; } });
        state.use = null; msg.textContent = '';
        renderSheet(area, state, h);
      }).catch(function (e) { msg.textContent = e.message || 'Could not read the file.'; msg.className = 'imp-msg ec-err'; });
    }
    pick.addEventListener('change', function () { loadFile(pick.files && pick.files[0]); });
    if (window.EngAreaImport && window.EngAreaImport.pending) { var pf = window.EngAreaImport.pending; window.EngAreaImport.pending = null; loadFile(pf); }
  }

  function renderSheet(area, state, h) {
    area.innerHTML = '';
    state.info = state.sheets.map(function (sh) {
      var d = detect(sh.rows), n = d.col.area >= 0 ? d.data.filter(function (r) { return !isNaN(num((r || [])[d.col.area])); }).length : 0;
      return { d: d, n: n, summary: H_SUMMARY.test(sh.name) };
    });
    if (!state.use) state.use = state.info.map(function (i) { return i.n > 0 && !i.summary; });
    if (!state.use.some(Boolean)) state.use = state.info.map(function (i) { return i.n > 0; });
    var usedIdx = []; state.use.forEach(function (u, k) { if (u) usedIdx.push(k); });
    var d = state.info[usedIdx[0] || 0].d, col = d.col;
    if (state.sheets.length > 1) {
      var sl = h.el('div', 'imp-q'); sl.appendChild(h.el('div', 'imp-q-t', 'Sheets found in the file (tick the ones that hold spaces; summary sheets are off by default to avoid double counting)'));
      state.sheets.forEach(function (sh, k) {
        var lb = h.el('label', 'imp-inc'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!state.use[k];
        cb.addEventListener('change', function () { state.use[k] = cb.checked; renderSheet(area, state, h); });
        lb.appendChild(cb); lb.appendChild(h.el('span', null, sh.name + ' (' + state.info[k].n + ' numeric area rows' + (state.info[k].summary ? ', looks like a summary' : '') + ')')); sl.appendChild(lb);
      });
      area.appendChild(sl);
    }
    var spaces, single = usedIdx.length === 1;
    var map = h.el('div', 'ec-grid');
    function colSel(label, key, optional) {
      var wrap = h.el('label', 'ec-field'); wrap.appendChild(h.el('span', null, label));
      var s = document.createElement('select'); s.className = 'ec-input';
      if (optional) { var o0 = document.createElement('option'); o0.value = -1; o0.textContent = '(none)'; s.appendChild(o0); }
      for (var j = 0; j < d.width; j++) { var o = document.createElement('option'); o.value = j; o.textContent = 'Col ' + (j + 1) + (d.header[j] ? ': ' + d.header[j] : ''); if (j === col[key]) o.selected = true; s.appendChild(o); }
      s.addEventListener('change', function () { col[key] = +s.value; rebuild(); });
      wrap.appendChild(s); map.appendChild(wrap);
    }
    if (single) { colSel('Space name column', 'name'); colSel('Area (m2) column', 'area'); colSel('Floor column', 'floor', true); colSel('Type column', 'type', true); area.appendChild(map); }
    else { var ds = state.info[usedIdx[0]].d; area.appendChild(h.el('div', 'imp-small', 'Columns detected per sheet, e.g. "' + state.sheets[usedIdx[0]].name + '": name = "' + (ds.header[ds.col.name] || '?') + '", area = "' + (ds.header[ds.col.area] || '?') + '", type = "' + (ds.col.type >= 0 ? ds.header[ds.col.type] : '-') + '". Floor comes from the sheet name.')); }
    var tableHost = h.el('div', 'imp-tw'); area.appendChild(tableHost);
    var qHost = h.el('div', null); area.appendChild(qHost);
    var go = h.el('button', 'ec-btn', 'Calculate from this file'); go.type = 'button'; area.appendChild(go);
    var out = h.el('div', 'ec-out'); area.appendChild(out);
    var ans = { cooling: 'undecided', ceil: 'undecided', height: '', rate: '24', special: 'undecided', specialKva: '', supply: 'undecided' };

    function chips(label, key, opts, hint) {
      var g = h.el('div', 'imp-q'); g.appendChild(h.el('div', 'imp-q-t', label));
      var row = h.el('div', 'imp-chips');
      opts.forEach(function (o) {
        var b = h.el('button', 'imp-chip' + (ans[key] === o[0] ? ' on' : ''), o[1]); b.type = 'button'; b.setAttribute('aria-pressed', ans[key] === o[0] ? 'true' : 'false');
        b.addEventListener('click', function () { ans[key] = o[0]; [].forEach.call(row.children, function (c) { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); if (key === 'ceil') hx.style.display = o[0] === 'above' ? '' : 'none'; if (key === 'special') sx.style.display = o[0] === 'add' ? '' : 'none'; });
        row.appendChild(b);
      });
      g.appendChild(row); if (hint) g.appendChild(h.el('div', 'ec-note', hint)); return g;
    }
    var hx = h.el('div', 'imp-q', ''), sx = h.el('div', 'imp-q', '');
    function numInput(host, label, key) {
      host.appendChild(h.el('div', 'imp-q-t', label));
      var i = document.createElement('input'); i.type = 'number'; i.inputMode = 'decimal'; i.step = 'any'; i.className = 'ec-input'; i.value = ans[key]; i.setAttribute('aria-label', label);
      i.addEventListener('input', function () { ans[key] = i.value; }); host.appendChild(i);
    }
    function renderQuestions() {
      qHost.innerHTML = '';
      qHost.appendChild(h.el('div', 'imp-q-h', 'Key questions (each has a proposed default)'));
      qHost.appendChild(chips('Cooling type', 'cooling', [['undecided', 'Not decided (assumption: standard)'], ['standard', 'Standard'], ['winter', 'Winter-peak'], ['district', 'District cooling']], 'Only the standard density is verified in the app. Other choices are recorded in the report but not applied.'));
      qHost.appendChild(chips('Ceiling height above 3.5 m?', 'ceil', [['undecided', 'Not decided (assumption: no extra)'], ['not_above', 'No'], ['above', 'Yes']]));
      hx.innerHTML = ''; numInput(hx, 'Ceiling height (m)', 'height'); hx.style.display = ans.ceil === 'above' ? '' : 'none'; qHost.appendChild(hx);
      qHost.appendChild(chips('Special loads (lifts, pumps, central plant, kitchen)', 'special', [['undecided', 'Not decided (assumption: none)'], ['none', 'None'], ['add', 'Add kVA']]));
      sx.innerHTML = ''; numInput(sx, 'Special loads (kVA)', 'specialKva'); sx.style.display = ans.special === 'add' ? '' : 'none'; qHost.appendChild(sx);
      qHost.appendChild(chips('Supply points', 'supply', [['undecided', 'Not decided (assumption: single)'], ['single', 'Single supply point'], ['multiple', 'Several meters']]));
    }

    function rebuild() {
      spaces = [];
      usedIdx.forEach(function (k) { spaces = spaces.concat(buildSpaces(state.info[k].d, state.info[k].d.col, state.sheets[k].name)); });
      state.spaces = spaces; tableHost.innerHTML = '';
      var tot = spaces.filter(function (s) { return !s.excluded; }).reduce(function (a, s) { return a + s.area; }, 0);
      tableHost.appendChild(h.el('div', 'ec-note', 'Read ' + spaces.length + ' rows (' + spaces.filter(function (s) { return s.excluded; }).length + ' excluded: totals or no valid area) from "' + state.fileName + '" (' + usedIdx.length + ' sheet' + (usedIdx.length > 1 ? 's' : '') + '). Area total of included rows: ' + round2(tot) + ' m2. Check each row; change the category or exclude what does not belong.'));
      var tb = h.el('div', 'imp-list');
      spaces.forEach(function (sp, ix) {
        var card = h.el('div', 'imp-row' + (sp.excluded ? ' imp-ex' : ''));
        var head = h.el('div', 'imp-row-h');
        head.appendChild(h.el('div', 'imp-row-n', (sp.floor ? sp.floor + ' / ' : '') + sp.name));
        head.appendChild(h.el('div', 'imp-row-a', (isNaN(sp.area) ? '-' : round2(sp.area)) + ' m2'));
        card.appendChild(head);
        card.appendChild(h.el('div', 'imp-small', 'Sheet ' + sp.sheet + ', file row ' + sp.src + (sp.note ? ' - ' + sp.note : '')));
        var sel = document.createElement('select'); sel.className = 'ec-input'; sel.setAttribute('aria-label', 'Category for ' + sp.name);
        [['', 'Choose DPS-01 category...'], ['C7', 'Offices (C7) - Table 19/20'], ['C6', 'Restaurant / cafe (C6) - Table 19/20'], ['custom', 'Custom (assumption)']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (sp.cat === o[0]) op.selected = true; sel.appendChild(op); });
        var cust = h.el('div', 'imp-cust', ''); cust.style.display = sp.cat === 'custom' ? '' : 'none';
        var di = document.createElement('input'); di.type = 'number'; di.step = 'any'; di.placeholder = 'Density VA/m2'; di.className = 'ec-input'; di.setAttribute('aria-label', 'Density VA/m2');
        var fi = document.createElement('input'); fi.type = 'number'; fi.step = 'any'; fi.placeholder = 'Demand factor 0-1'; fi.className = 'ec-input'; fi.setAttribute('aria-label', 'Demand factor');
        di.addEventListener('input', function () { sp.custDens = di.value; }); fi.addEventListener('input', function () { sp.custDf = fi.value; });
        cust.appendChild(di); cust.appendChild(fi);
        sel.addEventListener('change', function () { sp.cat = sel.value; sp.touched = true; cust.style.display = sp.cat === 'custom' ? '' : 'none'; });
        card.appendChild(sel); card.appendChild(cust);
        if (sp.why === 'keyword match') card.appendChild(h.el('div', 'imp-small', 'Proposed by keyword match, please confirm'));
        var lb = h.el('label', 'imp-inc'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !sp.excluded;
        cb.addEventListener('change', function () { sp.excluded = !cb.checked; card.className = 'imp-row' + (sp.excluded ? ' imp-ex' : ''); });
        lb.appendChild(cb); lb.appendChild(h.el('span', null, 'Include in the calculation')); card.appendChild(lb);
        tb.appendChild(card);
      });
      tableHost.appendChild(tb);
    }

    go.addEventListener('click', function () {
      out.innerHTML = '';
      h.ensureTables().then(function () {
        var used = state.spaces.filter(function (s) { return !s.excluded; }), bad = used.filter(function (s) { return !s.cat; }), touched = {}, areas = [];
        if (!used.length) { out.appendChild(h.el('div', 'ec-err', 'مفيش صفوف مشمولة.')); return; }
        if (bad.length) { out.appendChild(h.el('div', 'ec-err', 'اختار category لـ: ' + bad.map(function (s) { return s.name; }).join('، ') + ' (أو شيلهم من Include). ما بخمنش category.')); return; }
        var groups = [], gi = {};
        used.forEach(function (s) {
          var key = [s.floor, s.cat, s.custDens, s.custDf].join('|'), g = gi[key];
          if (!g) { g = gi[key] = { floor: s.floor, cat: s.cat, custDens: s.custDens, custDf: s.custDf, area: 0, n: 0, touched: false }; groups.push(g); }
          g.area += s.area; g.n++; if (s.touched) g.touched = true;
        });
        var catName = { C7: 'Offices', C6: 'Restaurant / cafe', custom: 'Custom' };
        groups.forEach(function (g, k) {
          var slot = k + 1; if (g.touched) touched['c' + slot] = true;
          areas.push({ slot: slot, label: (g.floor ? g.floor + ' / ' : '') + (catName[g.cat] || g.cat) + ' (' + g.n + ' spaces)', category: g.cat, areaM2: round2(g.area), densityVaM2: g.custDens === '' ? undefined : Number(g.custDens), demandFactor: g.custDf === '' ? undefined : Number(g.custDf) });
        });
        var res = window.EngLoadEst.calculate({ areas: areas, sensitivity: false, assumptions: {
          touched: touched, cooling: ans.cooling, ceiling: ans.ceil, heightM: ans.height === '' ? undefined : Number(ans.height), rate: ans.rate,
          special: ans.special, specialKva: ans.specialKva === '' ? undefined : Number(ans.specialKva), supply: ans.supply,
          source: 'Areas read from the uploaded file "' + state.fileName + '" (' + used.length + ' spaces grouped by floor and category into ' + groups.length + ' lines; areas summed, no other change), checked by the user before calculating.' } });
        h.showResult(out, res, 'Load Estimate from file (SEC DPS-01)');
        if (res.ok) { var st = h.el('div', null); h.renderResultActions(out, st); out.appendChild(st); }
      }).catch(function (e) { out.appendChild(h.el('div', 'ec-err', e.message || 'Calculation error')); });
    });

    rebuild(); renderQuestions();
  }

  window.EngAreaImport = { summarize: summarize, mount: mount, parseCsv: parseCsv, parseXlsx: parseXlsx, detect: detect, buildSpaces: buildSpaces, classify: classify, readFile: readFile, num: num };
})();
