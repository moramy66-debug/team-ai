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
    var ans = { cooling: 'undecided', ceil: 'undecided', height: '', rate: '24', special: 'undecided', specialKva: '', supply: 'undecided', meters: '', reserve: '' };

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
      qHost.appendChild(chips('Cooling type', 'cooling', [['undecided', 'Not answered yet (required)'], ['standard', 'Standard'], ['winter', 'Winter-peak'], ['district', 'District cooling']], 'Only the standard density is verified in the app. Other choices are recorded in the report but not applied.'));
      qHost.appendChild(chips('Ceiling height above 3.5 m?', 'ceil', [['undecided', 'Not answered yet (required)'], ['not_above', 'No'], ['above', 'Yes']]));
      hx.innerHTML = ''; numInput(hx, 'Ceiling height (m)', 'height'); hx.style.display = ans.ceil === 'above' ? '' : 'none'; qHost.appendChild(hx);
      qHost.appendChild(chips('Special loads (lifts, pumps, central plant, kitchen)', 'special', [['undecided', 'Not answered yet (required)'], ['none', 'None'], ['add', 'Add kVA']]));
      sx.innerHTML = ''; numInput(sx, 'Special loads (kVA)', 'specialKva'); sx.style.display = ans.special === 'add' ? '' : 'none'; qHost.appendChild(sx);
      function quick(host, text, key, val) { var b = h.el('button', 'imp-chip', text); b.type = 'button'; b.addEventListener('click', function () { ans[key] = val; host.querySelector('input').value = val; }); host.appendChild(b); }
      var mx = h.el('div', 'imp-q', ''); numInput(mx, 'REQUIRED: number of meters / units N (for the coincidence factor CF(N))', 'meters'); quick(mx, 'One meter (N = 1, CF = 1)', 'meters', '1'); qHost.appendChild(mx);
      var rx = h.el('div', 'imp-q', ''); numInput(rx, 'REQUIRED: reserve % (your own allowance, not from the code)', 'reserve'); quick(rx, 'No reserve (0%)', 'reserve', '0'); qHost.appendChild(rx);
    }

    function rebuild() {
      spaces = [];
      usedIdx.forEach(function (k) { spaces = spaces.concat(buildSpaces(state.info[k].d, state.info[k].d.col, state.sheets[k].name)); });
      state.spaces = spaces; tableHost.innerHTML = '';
      var tot = spaces.filter(function (s) { return !s.excluded; }).reduce(function (a, s) { return a + s.area; }, 0);
      tableHost.appendChild(h.el('div', 'ec-note', 'Read ' + spaces.length + ' rows (' + spaces.filter(function (s) { return s.excluded; }).length + ' excluded: totals or no valid area) from "' + state.fileName + '" (' + usedIdx.length + ' sheet' + (usedIdx.length > 1 ? 's' : '') + '). Area total of included rows: ' + round2(tot) + ' m2. Review the groups below.'));
      var groups = [], gm = {};
      spaces.forEach(function (sp) {
        if (sp.excluded) return;
        var key = (sp.type || sp.name.replace(/[\s\-\u2013_.]*\d+[\s\-\u2013_.\d]*$/, '')).trim() || sp.name, g = gm[key];
        if (!g) { g = gm[key] = { key: key, spaces: [], area: 0, cat: sp.cat, why: sp.why, proposed: sp.cat, confirmed: false, custDens: '', custDf: '' }; groups.push(g); }
        g.spaces.push(sp); g.area += sp.area;
        if (g.proposed !== sp.cat) { g.proposed = ''; g.cat = ''; g.why = 'mixed'; }
      });
      state.groups = groups;
      var TBL = null; try { TBL = window.EngTables.get('sec_dps01_load_density_demand'); } catch (e) { TBL = null; }
      var tb = h.el('div', 'imp-list');
      tb.appendChild(h.el('div', 'imp-q-h', 'Confirm the DPS-01 category for each space group (nothing is calculated until you confirm every group)'));
      var cnt = h.el('div', 'imp-small', ''); tb.appendChild(cnt);
      function upd() { var n = groups.filter(function (g) { return g.cat === 'exclude' || g.confirmed; }).length; cnt.textContent = 'Confirmed ' + n + ' of ' + groups.length + ' groups.'; }
      groups.forEach(function (g) {
        var card = h.el('div', 'imp-row');
        var head = h.el('div', 'imp-row-h'); head.appendChild(h.el('div', 'imp-row-n', g.key)); head.appendChild(h.el('div', 'imp-row-a', round2(g.area) + ' m2')); card.appendChild(head);
        card.appendChild(h.el('div', 'imp-small', g.spaces.length + ' spaces. ' + (g.proposed ? 'App proposal: ' + g.proposed + ' (keyword match on the name / type column). Not applied until you confirm.' : 'No proposal: the name does not match a category in the app table.')));
        var sel = document.createElement('select'); sel.className = 'ec-input'; sel.setAttribute('aria-label', 'Category for ' + g.key);
        [['', 'Choose a DPS-01 category...'], ['C7', 'C7 Offices (Table 19 / Table 20)'], ['C6', 'C6 Restaurants / cafes (Table 19 / Table 20)'], ['custom', 'Alternative: Custom assumption (my own density and DF)'], ['exclude', 'Exclude this group']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (g.cat === o[0]) op.selected = true; sel.appendChild(op); });
        var basis = h.el('div', 'imp-basis', ''), cust = h.el('div', 'imp-cust', '');
        var di = document.createElement('input'); di.type = 'number'; di.step = 'any'; di.placeholder = 'Density VA/m2'; di.className = 'ec-input'; di.setAttribute('aria-label', 'Density VA/m2');
        var fi = document.createElement('input'); fi.type = 'number'; fi.step = 'any'; fi.placeholder = 'Demand factor 0-1'; fi.className = 'ec-input'; fi.setAttribute('aria-label', 'Demand factor');
        di.addEventListener('input', function () { g.custDens = di.value; }); fi.addEventListener('input', function () { g.custDf = fi.value; });
        cust.appendChild(di); cust.appendChild(fi);
        var btn = h.el('button', 'imp-chip', 'Confirm this category'); btn.type = 'button';
        function refresh() {
          cust.style.display = g.cat === 'custom' ? '' : 'none';
          var row = TBL && TBL.rows ? TBL.rows.filter(function (x) { return x[0] === g.cat; })[0] : null;
          if (row) basis.textContent = 'Code basis: SEC DPS-01 Rev-02 (Nov 2023). Density ' + row[2] + ' VA/m2 from Table 19 pp.26-27 (' + g.cat + ', standard / with AC). Demand factor ' + row[3] + ' from Table 20 p.29. Status: verified_secondary (third-party mirror, not the official SEC file). Appendix 1 tables cover C1 and C2 only, so they do not apply here.';
          else if (g.cat === 'custom') basis.textContent = 'Alternative assumption: your own density and demand factor. Not from DPS-01. Use it for other categories (C1-C5, C8-C29 are not in the app table; read the value from Table 19 yourself).';
          else if (g.cat === 'exclude') basis.textContent = 'This group is left out of the load total.';
          else basis.textContent = 'Choose a category to see its code basis.';
          btn.style.display = g.cat && g.cat !== 'exclude' ? '' : 'none';
          btn.className = 'imp-chip' + (g.confirmed ? ' on' : ''); btn.textContent = g.confirmed ? 'Confirmed' : 'Confirm this category'; btn.setAttribute('aria-pressed', g.confirmed ? 'true' : 'false');
          upd();
        }
        sel.addEventListener('change', function () { g.cat = sel.value; g.confirmed = false; refresh(); });
        btn.addEventListener('click', function () { g.confirmed = !g.confirmed; refresh(); });
        card.appendChild(sel); card.appendChild(cust); card.appendChild(basis); card.appendChild(btn);
        var det = document.createElement('details'); var sm = document.createElement('summary'); sm.textContent = 'Rows in this group'; det.appendChild(sm);
        g.spaces.forEach(function (sp) { det.appendChild(h.el('div', 'imp-small', sp.sheet + ' row ' + sp.src + ': ' + sp.name + ' - ' + round2(sp.area) + ' m2')); });
        card.appendChild(det);
        refresh(); tb.appendChild(card);
      });
      upd();
      tableHost.appendChild(tb);
    }

    go.addEventListener('click', function () {
      out.innerHTML = '';
      h.ensureTables().then(function () {
        var gs = state.groups || [], unconf = gs.filter(function (g) { return g.cat !== 'exclude' && !g.confirmed; });
        var nN = Number(ans.meters), nR = Number(ans.reserve);
        var need = []; if (ans.cooling === 'undecided') need.push('Cooling type'); if (ans.ceil === 'undecided') need.push('Ceiling height above 3.5 m?'); if (ans.special === 'undecided') need.push('Special loads');
        if (need.length) { out.appendChild(h.el('div', 'ec-err', 'Answer first (no silent assumptions): ' + need.join(', ') + '.')); return; }
        if (ans.cooling === 'winter' || ans.cooling === 'district') { out.appendChild(h.el('div', 'ec-err', 'Winter-peak / district cooling densities are not verified in the app, so they are not applied. Use the Custom category per group with your own density and demand factor, or choose Standard.')); return; }
        if (ans.ceil === 'above' && !(Number(ans.height) > 3.5)) { out.appendChild(h.el('div', 'ec-err', 'Enter the ceiling height (more than 3.5 m).')); return; }
        if (ans.special === 'add' && !(Number(ans.specialKva) > 0)) { out.appendChild(h.el('div', 'ec-err', 'Enter the special loads in kVA.')); return; }
        if (ans.meters === '' || !(nN >= 1) || Math.round(nN) !== nN) { out.appendChild(h.el('div', 'ec-err', 'Answer first: number of meters / units N (a whole number, or tap "One meter").')); return; }
        if (ans.reserve === '' || !(nR >= 0)) { out.appendChild(h.el('div', 'ec-err', 'Answer first: reserve % (tap "No reserve (0%)" or enter your own).')); return; }
        if (unconf.length) { out.appendChild(h.el('div', 'ec-err', 'Confirm the category for every group first. Not confirmed: ' + unconf.map(function (g) { return g.key; }).join(', ') + '.')); return; }
        gs.forEach(function (g) { g.spaces.forEach(function (sp) { sp.cat = g.cat === 'exclude' ? '' : g.cat; sp.custDens = g.custDens; sp.custDf = g.custDf; sp.touched = true; if (g.cat === 'exclude') sp.excluded = true; }); });
        var used = state.spaces.filter(function (s) { return !s.excluded; }), bad = used.filter(function (s) { return !s.cat; }), touched = {}, areas = [];
        if (!used.length) { out.appendChild(h.el('div', 'ec-err', 'No included rows.')); return; }
        if (bad.length) { out.appendChild(h.el('div', 'ec-err', 'Choose a category for: ' + bad.map(function (s) { return s.name; }).join(', '))); return; }
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
          special: ans.special, specialKva: ans.specialKva === '' ? undefined : Number(ans.specialKva), supply: (Number(ans.meters) === 1 ? 'single' : 'undecided'),
          source: 'Areas read from the uploaded file "' + state.fileName + '" (' + used.length + ' spaces grouped by floor and category into ' + groups.length + ' lines; areas summed, no other change), categories confirmed by the user per group (' + gs.filter(function (g) { return g.cat !== 'exclude'; }).map(function (g) { return g.key + ' = ' + g.cat; }).join('; ') + '), code basis SEC DPS-01 Rev-02 Nov 2023 Table 19 pp.26-27 and Table 20 p.29 (secondary copy).' } });
        h.showResult(out, res, 'Load Estimate from file (SEC DPS-01)');
        if (res.ok) { var st = h.el('div', null); h.renderResultActions(out, st); out.appendChild(st); }
        if (res.ok && window.EngAreaImport && typeof window.EngAreaImport.onResult === 'function') window.EngAreaImport.onResult(res, { lines: groups, gs: gs, used: used, fileName: state.fileName, ans: ans });
      }).catch(function (e) { out.appendChild(h.el('div', 'ec-err', e.message || 'Calculation error')); });
    });

    h.ensureTables().then(function () { rebuild(); renderQuestions(); }, function () { rebuild(); renderQuestions(); });
  }


  /* ---------- chat flow: confirmation panel, then one deterministic report (no model text) ---------- */
  function cell(x) { return String(x == null ? '' : x).replace(/\|/g, '/').replace(/\s+/g, ' ').trim(); }
  function n2(x) { return (Math.round(x * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var CAT = { C7: 'C7 Offices', C6: 'C6 Restaurant / cafe', custom: 'Custom (user assumption)' };
  function buildSheet(res, ctx) {
    var lines = ctx.lines || [], ans = ctx.ans || {}, rows = res.rows || [], i, S = window.EngSheet;
    var sCl = 0, sDl = 0, sA = 0, sN = 0, byFloor = {}, byCat = {}, fo = [], co = [], inputs = [];
    for (i = 0; i < rows.length; i++) {
      var r = rows[i], ln = lines[i] || {}, fl = ln.floor || '-', cc = CAT[r.category] || r.category;
      inputs.push({ head: fl + ' \u00b7 ' + cc, cells: [['Spaces', String(ln.n || '')], ['Area', n2(r.areaM2) + ' m\u00b2'], ['Density', r.densityVaM2 + ' VA/m\u00b2'], ['Demand factor', String(r.demandFactor)], ['Connected', n2(r.connectedKva) + ' kVA'], ['Demand', n2(r.demandKva) + ' kVA']] });
      sCl += r.connectedKva; sDl += r.demandKva; sA += r.areaM2; sN += (ln.n || 0);
      if (!byFloor[fl]) { byFloor[fl] = { a: 0, cl: 0, dl: 0 }; fo.push(fl); } byFloor[fl].a += r.areaM2; byFloor[fl].cl += r.connectedKva; byFloor[fl].dl += r.demandKva;
      if (!byCat[cc]) { byCat[cc] = { a: 0, cl: 0, dl: 0 }; co.push(cc); } byCat[cc].a += r.areaM2; byCat[cc].cl += r.connectedKva; byCat[cc].dl += r.demandKva;
    }
    function tri(o) { return [['Area', n2(o.a) + ' m\u00b2'], ['Connected', n2(o.cl) + ' kVA'], ['Demand', n2(o.dl) + ' kVA']]; }
    var addCl = res.connectedKva - sCl, addDl = res.demandKva - sDl;
    var totals = [{ head: 'Table rows total', cells: [['Connected', n2(sCl) + ' kVA'], ['Demand', n2(sDl) + ' kVA']] }];
    if (Math.abs(addCl) > 0.004 || Math.abs(addDl) > 0.004) totals.push({ head: 'Additions (ceiling / special loads you entered)', cells: [['Connected', n2(addCl) + ' kVA'], ['Demand', n2(addDl) + ' kVA']] });
    totals.push({ head: 'Total (connected / demand before coincidence)', total: true, cells: [['Connected', n2(res.connectedKva) + ' kVA'], ['Demand', n2(res.demandKva) + ' kVA']] });
    var N = ans.meters === '' || ans.meters == null ? NaN : Number(ans.meters), nOk = isFinite(N) && N >= 1 && Math.round(N) === N;
    var CF = !nOk || N === 1 ? 1 : (0.67 + 0.33 / Math.sqrt(N)) / 1.25, cdl = res.demandKva * CF;
    var rp = Number(ans.reserve === '' || ans.reserve == null ? 0 : ans.reserve); if (!isFinite(rp) || rp < 0) rp = 0;
    var withRes = cdl * (1 + rp / 100);
    function f3(x) { return (Math.round(x * 1000) / 1000).toFixed(3); }
    var dem = [
      { head: 'Total demand (sum CL x DF, with additions)', cells: [['Value', n2(res.demandKva) + ' kVA']] },
      { head: 'Meters / units N', cells: [['Value', nOk ? String(N) : 'not given']] },
      { head: 'Coincidence factor CF(N)' + (nOk ? '' : ' (assumed 1)'), cells: [['Value', f3(CF)]] },
      { head: 'Diversity factor = 1 / CF', cells: [['Value', f3(1 / CF)]] },
      { head: 'CDL = total demand x CF(N)', cells: [['Value', n2(cdl) + ' kVA']] },
      { head: 'Reserve (user-entered, not from the code)', cells: [['Value', rp + ' %']] },
      { head: 'Total with reserve = CDL x (1 + reserve)', total: true, cells: [['Value', n2(withRes) + ' kVA']] }
    ];
    var cfNote = nOk ? 'CF(N) for N = ' + N + ' = ' + (N === 1 ? '1.000' : '(0.67 + 0.33 / sqrt(N)) / 1.25 = ' + f3(CF)) + ' (formula as relayed from the DPS-01 full-PDF check; compare with Table 21 before submission).' : 'Number of meters N was not given: CF = 1 assumed, so the demand is shown before any coincidence.';
    var ue = [], da = [], nt = [];
    (res.warnings || []).forEach(function (w) { if (/oincidence factor|Supply:|Supply points/i.test(w)) return; if (/^User entered:/.test(w)) ue.push('You entered: ' + w.replace(/^User entered:\s*/, '')); else if (/^Default \/ assumption:/.test(w)) da.push('Assumption: ' + w.replace(/^Default \/ assumption:\s*/, '')); else nt.push(w); });
    var q = [];
    if (ans.ceil !== 'above' && ans.ceil !== 'not_above') q.push('Is any ceiling above 3.5 m? DPS-01 2023 sec 2.4 (as recorded in the app) adds 24 VA/m3 of the volume above 3.5 m. It was NOT applied. Answer the ceiling question and run again. The app takes one height for the whole file, so say the height per floor if they differ.');
    if (ans.cooling !== 'standard') q.push('Cooling type (standard, winter-peak or district cooling): standard density used. Only the standard density is verified in the app table.');
    if (ans.special !== 'none' && ans.special !== 'add') q.push('Special loads (lifts, pumps, central plant, kitchen equipment): none included.');
    q.push('Category sum: adding C7 and C6 results is an assumption. DPS-01 states per-category addition only for combined C1 + C2 buildings (sec 2.4), not for C3 to C29 mixes.');
    if (ans.ceil === 'above') q.push('Ceiling rule: the 24 VA/m3 rule is written for categories C1 and C2 (sec 2.4 p.25). Applying it to C7 / C6 is your decision, not the code. It is also added after the demand factor here (assumption); the code text adds it to the total connected load.');
    if (!nOk) q.push('Number of meters / units N: needed for CF(N) (DPS-01 coincidence step, Diversity = 1 / CF). Not applied until you enter N.');
    if (!q.length) q.push('None. All key questions were answered.');
    var meta = S.baseMeta('Load Estimate (SEC DPS-01)', 'SEC DPS-01 Rev-02 (Nov 2023) \u00b7 verified_secondary', [['Input file', ctx.fileName + ' (' + ctx.used.length + ' spaces)']]);
    return {
      title: 'Load Estimate', edition: 'SEC DPS-01 Rev-02 (Nov 2023)', meta: meta,
      kpis: [{ l: 'Connected load', v: n2(res.connectedKva), u: 'kVA' }, { l: 'Demand load', v: n2(res.demandKva), u: 'kVA' }, { l: 'Total area', v: n2(sA), u: 'm\u00b2' }, { l: 'CDL (after CF)', v: n2(cdl), u: 'kVA' }, { l: 'Total with reserve', v: n2(withRes), u: 'kVA', sticky: true }, { l: 'CF(N)', v: f3(CF), u: nOk ? 'N=' + N : 'assumed' }],
      sections: [
        { type: 'cards', title: 'Inputs \u00b7 \u0627\u0644\u0645\u062f\u062e\u0644\u0627\u062a (categories confirmed by you)', rows: inputs.concat([{ head: 'Total', total: true, cells: [['Spaces', String(sN)], ['Area', n2(sA) + ' m\u00b2'], ['Density', ''], ['Demand factor', ''], ['Connected', n2(sCl) + ' kVA'], ['Demand', n2(sDl) + ' kVA']] }]) },
        { type: 'cards', title: 'Per floor \u00b7 \u0644\u0643\u0644 \u062f\u0648\u0631', rows: fo.map(function (k) { return { head: k, cells: tri(byFloor[k]) }; }) },
        { type: 'cards', title: 'Per category \u00b7 \u0644\u0643\u0644 \u0641\u0626\u0629', rows: co.map(function (k) { return { head: k, cells: tri(byCat[k]) }; }) },
        { type: 'cards', title: 'Totals \u00b7 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a', rows: totals },
        { type: 'cards', title: 'Coincidence and reserve \u00b7 \u0627\u0644\u062a\u0632\u0627\u0645\u0646 \u0648\u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637\u064a', rows: dem },
        { type: 'steps', title: 'Calculation steps \u00b7 \u062e\u0637\u0648\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628', rows: (res.steps || []).map(function (st) { return { step: st.step, formula: st.formula, substitution: st.substitution, result: st.result }; }).concat([{ step: 'Coincidence (CDL)', formula: 'CDL = sum(CL x DF) x CF(N)', substitution: n2(res.demandKva) + ' x ' + f3(CF), result: n2(cdl) + ' kVA' }, { step: 'Reserve (your entry)', formula: 'Total = CDL x (1 + reserve %)', substitution: n2(cdl) + ' x (1 + ' + rp + '/100)', result: n2(withRes) + ' kVA' }]) },
        { type: 'box', kind: 'assump', title: 'Assumptions \u00b7 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u0627\u062a', items: ue.concat(['You entered: reserve ' + rp + ' % (your own allowance, not from the code; default 0)']).concat(nOk ? ['You entered: N = ' + N + ' meters / units'] : []).concat(da).concat([cfNote]) },
        { type: 'box', kind: 'question', title: 'Open questions \u00b7 \u0623\u0633\u0626\u0644\u0629 \u0645\u0641\u062a\u0648\u062d\u0629', items: q },
        { type: 'box', kind: 'basis', title: 'Code basis \u00b7 \u0623\u0633\u0627\u0633 \u0627\u0644\u0643\u0648\u062f', items: ['Densities: SEC DPS-01 Rev-02 (Nov 2023) Table 19 pp.26-27 (with AC). Demand factors: Table 20 p.29 (other sources say p.30, please check). Status: verified_secondary (third-party mirror, not the official SEC file). Appendix 1 tables cover C1/C2 only and do not apply to C6/C7.'].concat(nt) }
      ]
    };
  }
  function buildReport(res, ctx) { var sh = buildSheet(res, ctx); sh.md = window.EngSheet.markdown(sh); return sh.md; }
  function chatFlow() {
    var EAI = window.EngAreaImport, file = EAI && EAI.chatFile, h = window.EngUI && window.EngUI.helpers;
    if (!file || !h) return Promise.resolve(null);
    return new Promise(function (resolve, reject) {
      var old = document.getElementById('imp-chat-flow'); if (old) old.remove();
      var wrap = document.createElement('div'); wrap.id = 'imp-chat-flow'; wrap.className = 'card imp-chat-flow';
      var fc = document.getElementById('finalCard'); if (!fc || !fc.parentNode) { resolve(null); return; }
      fc.parentNode.insertBefore(wrap, fc);
      var t = document.createElement('div'); t.className = 'imp-chat-t'; t.textContent = 'Load Estimate: confirm the categories here, then the app calculates and writes the report. Nothing is calculated before you confirm.';
      wrap.appendChild(t);
      function done() { EAI.onResult = null; }
      EAI.onResult = function (res, ctx) { var text; try { var sh = buildSheet(res, ctx); sh.md = window.EngSheet.markdown(sh); window.__detSheet = sh; text = sh.md; } catch (e) { done(); wrap.remove(); reject(e); return; } done(); wrap.remove(); resolve(text); };
      try { if (typeof abort !== 'undefined' && abort && abort.signal) abort.signal.addEventListener('abort', function () { done(); wrap.remove(); var e = new Error('Aborted'); e.name = 'AbortError'; reject(e); }); } catch (e) {}
      EAI.pending = file;
      mount(wrap, h);
      try { var nt0 = wrap.querySelector('.imp-import .ec-note'); if (nt0) nt0.style.display = 'none'; var pk0 = wrap.querySelector('.imp-pick'); if (pk0) pk0.style.display = 'none'; } catch (e) {}
      setTimeout(function () { try { wrap.scrollIntoView({ block: 'start' }); } catch (e) {} }, 300);
    });
  }

  window.EngAreaImport = { summarize: summarize, mount: mount, parseCsv: parseCsv, parseXlsx: parseXlsx, detect: detect, buildSpaces: buildSpaces, classify: classify, readFile: readFile, num: num, chatFlow: chatFlow, buildReport: buildReport, buildSheet: buildSheet };
})();
