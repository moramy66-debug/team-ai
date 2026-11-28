(function () {
  'use strict';

  var STYLE_ID = 'ec-styles';
  var MODAL_ID = 'ec-modal-backdrop';
  var BTN_ID = 'ec-topbar-btn';
  var activeTab = 'cable';
  var lastReportText = '';
  var lastResult = null;
  var tablesReady = false;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.ec-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.58);display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;}',
      '.ec-modal{width:min(760px,calc(100vw - 16px));max-height:90vh;overflow-y:auto;background:var(--card,#141a29);color:var(--tx,#e5e7eb);border:1px solid var(--line,#2a3347);border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,0.45);padding:16px;box-sizing:border-box;font-family:inherit;}',
      '.ec-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;border-bottom:1px solid var(--line,#2a3347);padding-bottom:10px;}',
      '.ec-title{margin:0;font-size:17px;font-weight:700;color:var(--tx,#e5e7eb);}',
      '.ec-close{min-width:44px;min-height:44px;padding:0 12px;border-radius:8px;border:1px solid var(--line,#2a3347);background:transparent;color:var(--tx,#e5e7eb);cursor:pointer;font-size:16px;font-weight:700;}',
      '.ec-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}',
      '.ec-tab{min-height:44px;padding:8px 12px;border-radius:8px;border:1px solid var(--line,#2a3347);background:transparent;color:var(--mut,#9ca3af);cursor:pointer;font-size:13px;font-weight:600;flex:1 1 auto;text-align:center;}',
      '.ec-tab.ec-active{background:var(--ac,#2563eb);color:#ffffff;border-color:var(--ac,#2563eb);}',
      '.ec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;}',
      '.ec-field{display:flex;flex-direction:column;gap:4px;min-width:0;}',
      '.ec-field label{font-size:12px;color:var(--mut,#9ca3af);font-weight:600;}',
      '.ec-field input,.ec-field select{width:100%;min-height:44px;padding:8px 10px;border-radius:8px;border:1px solid var(--line,#2a3347);background:var(--bg,#0b1020);color:var(--tx,#e5e7eb);font-size:14px;box-sizing:border-box;}',
      '.ec-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;}',
      '.ec-btn{min-height:44px;padding:10px 16px;border-radius:8px;border:1px solid var(--line,#2a3347);background:var(--ac,#2563eb);color:#ffffff;cursor:pointer;font-size:14px;font-weight:600;}',
      '.ec-btn-sec{background:transparent;color:var(--tx,#e5e7eb);}',
      '.ec-btn:disabled{opacity:0.5;cursor:not-allowed;}',
      '.ec-warn{padding:10px 12px;border-radius:8px;border:1px solid #d97706;background:rgba(217,119,6,0.14);color:var(--tx,#e5e7eb);font-size:13px;margin-bottom:10px;line-height:1.5;}',
      '.ec-err{padding:10px 12px;border-radius:8px;border:1px solid #dc2626;background:rgba(220,38,38,0.14);color:var(--tx,#e5e7eb);font-size:13px;margin-bottom:10px;}',
      '.ec-summary{padding:10px 12px;border-radius:8px;border:1px solid var(--line,#2a3347);background:var(--bg,#0b1020);margin-bottom:10px;font-size:14px;line-height:1.6;}',
      '.ec-table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line,#2a3347);border-radius:8px;margin-bottom:10px;}',
      '.ec-table{width:100%;border-collapse:collapse;font-size:13px;text-align:right;direction:rtl;}',
      '.ec-table th,.ec-table td{padding:8px 10px;border-bottom:1px solid var(--line,#2a3347);vertical-align:top;}',
      '.ec-table th{background:var(--bg,#0b1020);color:var(--mut,#9ca3af);font-weight:700;white-space:nowrap;}',
      '.ec-table tr:last-child td{border-bottom:none;}',
      '.ec-ok{padding:6px 10px;border-radius:8px;border:1px solid #16a34a;background:rgba(22,163,74,0.10);color:var(--tx,#e5e7eb);font-size:12px;margin-bottom:8px;line-height:1.5;word-break:break-all;}',
      '.ec-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid var(--line,#2a3347);}',
      '.ec-badge-warn{border-color:#d97706;color:#f59e0b;}',
      '.ec-badge-ok{border-color:#16a34a;color:#22c55e;}',
      '.ec-modal .ec-tab{background:var(--bg,#0b1020)!important;background-image:none!important;color:var(--tx,#e5e7eb)!important;border:1px solid var(--line,#2a3347)!important;box-shadow:none!important;opacity:1!important;text-shadow:none!important;}',
      '.ec-modal .ec-tab.ec-active{background:var(--ac,#2563eb)!important;color:#ffffff!important;border-color:var(--ac,#2563eb)!important;}',
      '.ec-modal .ec-close,.ec-modal .ec-btn-sec{background:var(--bg,#0b1020)!important;background-image:none!important;color:var(--tx,#e5e7eb)!important;box-shadow:none!important;}',
      '.ec-cx{padding:10px 12px;border-radius:8px;margin:10px 0;font-size:13px;line-height:1.6;direction:rtl;text-align:right;color:var(--tx,#e5e7eb);}',
      '.ec-cx-warn{border:1px solid #d97706;background:rgba(217,119,6,0.14);}',
      '.ec-cx-ok{border:1px solid #16a34a;background:rgba(22,163,74,0.10);}',
      '@media (max-width:520px){.ec-modal{padding:12px;width:calc(100vw - 12px);}.ec-grid{grid-template-columns:1fr;}.ec-tab{flex:1 1 45%;font-size:12px;padding:6px 8px;}.ec-actions .ec-btn{flex:1 1 100%;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureTables() {
    if (tablesReady) return Promise.resolve();
    if (!window.EngTables || typeof window.EngTables.load !== 'function') {
      return Promise.reject(new Error('EngTables module is not loaded.'));
    }
    return window.EngTables.load().then(function () {
      tablesReady = true;
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) {
      var t = String(text);
      if (className && /(^| )ec-(warn|note|ok)( |$)/.test(className)) {
        t = t.replace(/from_memory_needs_review/g, 'From memory, needs review').replace(/needs_review/g, 'needs review').replace(/old_edition/g, 'old edition');
      }
      node.textContent = t;
    }
    return node;
  }

  function createField(id, labelText, type, optionsOrVal) {
    var wrap = el('div', 'ec-field');
    var lbl = el('label', null, labelText);
    lbl.setAttribute('for', id);
    wrap.appendChild(lbl);

    if (type === 'select') {
      var sel = document.createElement('select');
      sel.id = id;
      optionsOrVal.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = String(opt.value);
        o.textContent = opt.label;
        if (opt.selected) o.selected = true;
        sel.appendChild(o);
      });
      wrap.appendChild(sel);
    } else {
      var inp = document.createElement('input');
      inp.id = id;
      inp.type = type || 'number';
      if (type === 'number') inp.step = 'any';
      if (optionsOrVal !== undefined) inp.value = String(optionsOrVal);
      wrap.appendChild(inp);
    }
    return wrap;
  }

  function val(id) {
    var node = document.getElementById(id);
    return node ? node.value.trim() : '';
  }

  function numVal(id) {
    var v = val(id);
    if (!v) return undefined;
    var n = Number(v);
    return isFinite(n) ? n : NaN;
  }

  function renderStepsTable(container, steps, used) {
    var wrap = el('div', 'ec-table-wrap');
    var table = el('table', 'ec-table ec-steps');
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['الخطوة', 'المعادلة', 'التعويض', 'النتيجة'].forEach(function (h) {
      hr.appendChild(el('th', null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    steps.forEach(function (s) {
      var tr = document.createElement('tr');
      function cell(t, label) { var c = el('td', null, t); c.setAttribute('data-label', label); return c; }
      tr.appendChild(cell(s.step, 'الخطوة'));
      function mixedCell(t, label) {
        var c = cell('', label);
        var txt = String(t == null ? '' : t).replace(/<=/g, '\u2264').replace(/>=/g, '\u2265').replace(/->/g, '\u2192');
        var hasAr = /[\u0600-\u06FF]/.test(txt);
        var sp = el('span', 'ec-ltr', '');
        sp.setAttribute('dir', hasAr ? 'rtl' : 'ltr');
        if (hasAr) {
          sp.className = 'ec-ltr ec-mixed';
          txt = txt.replace(/\u2192/g, '\u2190');
          var re = /[A-Za-z0-9\u2264\u2265=<>+*\/\u00d7\u00f7%\u00b0][A-Za-z0-9.,%\u00b0\u00b2\u00b3\u00b7\u2264\u2265=<>+\-*\/\u00d7\u00f7^_:;()\[\]\s]*/g;
          var last = 0, m;
          while ((m = re.exec(txt))) {
            var run = m[0], tail = run.match(/[\s().,;:\])]*$/)[0];
            if (tail) run = run.slice(0, run.length - tail.length);
            if (m.index > last) sp.appendChild(document.createTextNode(txt.slice(last, m.index)));
            var bd = document.createElement('bdi'); bd.setAttribute('dir', 'ltr'); bd.textContent = run; sp.appendChild(bd);
            last = m.index + run.length;
            re.lastIndex = last;
          }
          if (last < txt.length) sp.appendChild(document.createTextNode(txt.slice(last)));
        } else sp.textContent = txt;
        c.appendChild(sp); return c;
      }
      tr.appendChild(mixedCell(s.formula, 'المعادلة'));
      tr.appendChild(mixedCell(s.substitution, 'التعويض'));
      var tdr = cell(s.result, 'النتيجة');
      if (window.SourceInfo && used && used.length) tdr.appendChild(window.SourceInfo.marker(used, -1, 'مصادر القيم في الخطوة'));
      tr.appendChild(tdr);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  function renderTableWarning(container, meta) {
    if (!meta) return;
    if (!isOkStatus(meta.status)) {
      var msg = 'تحذير: الجدول المستخدم (' + (meta.key || meta.title || '') + ') حالته "' + meta.status + '"';
      if (meta.source) msg += ' - المصدر: ' + meta.source;
      msg += '. يرجى التحقق من القيم أمام الكود الهندسي المعتمد قبل الاعتماد النهائي.';
      container.appendChild(el('div', 'ec-warn', msg));
    }
  }

  function buildReportText(title, summaryLines, steps, meta) {
    var lines = [title];
    if (meta && (!isOkStatus(meta.status))) {
      lines.push('[تنبيه: بيانات الجدول (' + (meta.key || '') + ') بحالة ' + meta.status + ' - للمراجعة]');
    }
    summaryLines.forEach(function (l) { lines.push(l); });
    lines.push('');
    lines.push('الخطوة | المعادلة | التعويض | النتيجة');
    steps.forEach(function (s) {
      lines.push(s.step + ' | ' + s.formula + ' | ' + s.substitution + ' | ' + s.result);
    });
    return lines.join('\n');
  }

  function isOkStatus(st) { return String(st || '').indexOf('verified') === 0 && String(st).indexOf('old_edition') < 0; }

  function showResult(out, res, title) {
    if (res && res.ok === false) { out.appendChild(el('div', 'ec-err', res.error || 'Calculation error')); return; }
    var used = res.tablesUsed || [];
    used.forEach(function (u) {
      var ok = isOkStatus(u.status);
      var line = el('div', (ok ? 'ec-ok' : 'ec-warn') + ' ec-src');
      var badge = el('span', 'ec-badge ' + (ok ? 'ec-badge-ok' : 'ec-badge-warn'), String(u.status || '').replace(/from_memory_needs_review/g, 'from memory, needs review').replace(/needs_review/g, 'needs review').replace(/old_edition/g, 'old edition').replace(/_/g, ' '));
      var idEl = el('span', 'ec-src-id', u.id);
      var srcEl = el('span', 'ec-src-from', u.source ? u.source : (window.SourceInfo ? window.SourceInfo.NR : 'المصدر غير مسجل'));
      line.appendChild(badge); line.appendChild(idEl); line.appendChild(srcEl);
      if (window.SourceInfo) line.insertBefore(window.SourceInfo.marker(used, used.indexOf(u), 'تفاصيل مصدر الجدول ' + u.id), line.firstChild);
      out.appendChild(line);
    });
    (res.warnings || []).filter(function (w, i, a) { return a.indexOf(w) === i; }).forEach(function (w) { out.appendChild(el('div', 'ec-warn', w)); });
    out.appendChild(el('div', 'ec-summary', res.summary || ''));
    renderStepsTable(out, res.steps || [], used);
    var lines = [title];
    used.forEach(function (u) { lines.push('[الجدول ' + u.id + ' | الحالة: ' + u.status + ' | المصدر: ' + u.source + ']'); });
    (res.warnings || []).filter(function (w, i, a) { return a.indexOf(w) === i; }).forEach(function (w) { lines.push('[تنبيه: ' + w + ']'); });
    lines.push(res.summary || '', '', 'الخطوة | المعادلة | التعويض | النتيجة');
    (res.steps || []).forEach(function (st) { lines.push(st.step + ' | ' + st.formula + ' | ' + st.substitution + ' | ' + st.result); });
    lastReportText = lines.join('\n');
    lastResult = { title: title, res: res };
  }

  function renderResultActions(container, statusNode, pdfDocFn) {
    var row = el('div', 'ec-actions');
    var copyBtn = el('button', 'ec-btn ec-btn-sec', 'Copy');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () {
      if (!lastReportText) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lastReportText).then(function () {
          statusNode.textContent = 'تم نسخ النتيجة إلى الحافظة.';
        }).catch(function () {
          statusNode.textContent = 'تعذر النسخ التلقائي.';
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = lastReportText;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); statusNode.textContent = 'تم نسخ النتيجة.'; } catch (e) {}
        document.body.removeChild(ta);
      }
    });

    var insertBtn = el('button', 'ec-btn ec-btn-sec', 'Insert into task');
    insertBtn.type = 'button';
    insertBtn.addEventListener('click', function () {
      if (!lastReportText) return;
      var task = document.getElementById('task');
      if (!task) {
        statusNode.textContent = 'حقل المهمة (#task) غير موجود في الصفحة.';
        return;
      }
      task.value = task.value.trim() ? (task.value.trim() + '\n\n' + lastReportText) : lastReportText;
      task.dispatchEvent(new Event('input', { bubbles: true }));
      statusNode.textContent = 'تم إدراج النتيجة في حقل المهمة.';
      close();
    });

    row.appendChild(copyBtn);
    row.appendChild(insertBtn);
    var snap = lastResult;
    var pdfBtn = el('button', 'ec-btn ec-btn-sec', 'PDF');
    pdfBtn.type = 'button';
    pdfBtn.addEventListener('click', function () {
      if (!window.EngPDF) { statusNode.textContent = 'وحدة PDF غير محملة.'; return; }
      try {
        var doc = pdfDocFn ? pdfDocFn() : (snap ? window.EngPDF.docFromResult(snap.title, snap.res) : null);
        if (!doc) { statusNode.textContent = 'مفيش نتيجة للتصدير.'; return; }
        var name = window.EngPDF.download(doc);
        statusNode.textContent = 'تم إنشاء الملف: ' + name;
      } catch (e) { statusNode.textContent = 'تعذر إنشاء PDF: ' + (e && e.message ? e.message : e); }
    });
    row.appendChild(pdfBtn);
    var rvBtn = el('button', 'ec-btn ec-btn-sec', 'Copy Review Prompt');
    rvBtn.type = 'button';
    rvBtn.addEventListener('click', function () {
      if (!window.ReviewPrompt || !snap) { statusNode.textContent = 'مفيش نتيجة لعمل Review Prompt.'; return; }
      var txt = window.ReviewPrompt.build({ title: snap.title, res: snap.res, inputs: window.ReviewPrompt.collectInputs(container) });
      window.ReviewPrompt.copy(txt);
    });
    row.appendChild(rvBtn);
    container.appendChild(row);
  }

  function renderCableTab(body) {
    var grid = el('div', 'ec-grid');
    grid.appendChild(createField('ec-cs-phases', 'Phases', 'select', [
      { value: '3', label: '3-Phase', selected: true },
      { value: '1', label: '1-Phase' }
    ]));
    grid.appendChild(createField('ec-cs-volt', 'Voltage (V)', 'number', 400));
    grid.appendChild(createField('ec-cs-curr', 'Current (A) - optional if kW set', 'number', 60));
    grid.appendChild(createField('ec-cs-kw', 'Power (kW) - optional', 'number', ''));
    grid.appendChild(createField('ec-cs-pf', 'Power Factor', 'number', 0.85));
    grid.appendChild(createField('ec-cs-cond', 'Conductor', 'select', [
      { value: 'Cu', label: 'Copper (Cu)', selected: true },
      { value: 'Al', label: 'Aluminium (Al)' }
    ]));
    grid.appendChild(createField('ec-cs-ins', 'Insulation', 'select', [
      { value: 'XLPE', label: 'XLPE (90C)', selected: true },
      { value: 'PVC', label: 'PVC (70C)' }
    ]));
    grid.appendChild(createField('ec-cs-method', 'Method', 'select', [
      { value: 'air', label: 'In Air (Method C)', selected: true },
      { value: 'ground', label: 'Buried direct (D2)' },
      { value: 'duct', label: 'Buried in ducts (D1)' }
    ]));
    grid.appendChild(createField('ec-cs-sp', 'Spacing (buried only)', 'select', [
      { value: 'touching', label: 'Touching', selected: true },
      { value: 'one_diameter', label: 'One cable diameter (D2 only)' },
      { value: '0.125', label: '0.125 m (D2 only)' },
      { value: '0.25', label: '0.25 m' },
      { value: '0.5', label: '0.5 m' },
      { value: '1.0', label: '1.0 m (ducts only)' }
    ]));
    grid.appendChild(createField('ec-cs-dc', 'Cable type (ducts only)', 'select', [
      { value: 'multi', label: 'Multi-core', selected: true },
      { value: 'single', label: 'Single-core' }
    ]));
    grid.appendChild(createField('ec-cs-amb', 'Ambient Temp (C)', 'number', 35));
    grid.appendChild(createField('ec-cs-circ', 'Grouping Circuits', 'number', 1));
    grid.appendChild(createField('ec-cs-len', 'Length (m) - optional', 'number', 50));
    grid.appendChild(createField('ec-cs-maxvd', 'Max Voltage Drop (%)', 'number', 3));
    body.appendChild(grid);

    var calcRow = el('div', 'ec-actions');
    var calcBtn = el('button', 'ec-btn', 'Calculate Cable Size');
    calcBtn.type = 'button';
    calcRow.appendChild(calcBtn);
    body.appendChild(calcRow);

    var out = el('div', null);
    body.appendChild(out);

    calcBtn.addEventListener('click', function () {
      out.innerHTML = '';
      ensureTables().then(function () {
        var input = {
          phases: Number(val('ec-cs-phases')),
          voltageV: numVal('ec-cs-volt'),
          currentA: numVal('ec-cs-curr'),
          powerKW: numVal('ec-cs-kw'),
          powerFactor: numVal('ec-cs-pf'),
          conductor: val('ec-cs-cond'),
          insulation: val('ec-cs-ins'),
          method: val('ec-cs-method'),
          ambientC: numVal('ec-cs-amb'),
          circuits: numVal('ec-cs-circ'),
          spacing: val('ec-cs-sp'),
          ductCable: val('ec-cs-dc'),
          lengthM: numVal('ec-cs-len'),
          maxVdropPct: numVal('ec-cs-maxvd')
        };
        var res = window.EngCalc.cableSizing(input);
        showResult(out, res, 'Cable Sizing Result');
        var statusNode = el('div', null);
        renderResultActions(out, statusNode);
        out.appendChild(statusNode);
      }).catch(function (err) {
        out.appendChild(el('div', 'ec-err', err.message || 'Calculation error'));
      });
    });
  }

  function renderVdropTab(body) {
    var grid = el('div', 'ec-grid');
    grid.appendChild(createField('ec-vd-phases', 'Phases', 'select', [
      { value: '3', label: '3-Phase', selected: true },
      { value: '1', label: '1-Phase' }
    ]));
    grid.appendChild(createField('ec-vd-volt', 'Voltage (V)', 'number', 400));
    grid.appendChild(createField('ec-vd-curr', 'Current (A)', 'number', 45));
    grid.appendChild(createField('ec-vd-size', 'Cable Size (mm2)', 'number', 16));
    grid.appendChild(createField('ec-vd-len', 'Length (m)', 'number', 60));
    grid.appendChild(createField('ec-vd-cond', 'Conductor', 'select', [
      { value: 'Cu', label: 'Copper (Cu)', selected: true },
      { value: 'Al', label: 'Aluminium (Al)' }
    ]));
    grid.appendChild(createField('ec-vd-ins', 'Insulation', 'select', [
      { value: 'XLPE', label: 'XLPE', selected: true },
      { value: 'PVC', label: 'PVC' }
    ]));
    grid.appendChild(createField('ec-vd-pf', 'Power Factor', 'number', 0.85));
    body.appendChild(grid);

    var calcRow = el('div', 'ec-actions');
    var calcBtn = el('button', 'ec-btn', 'Calculate Voltage Drop');
    calcBtn.type = 'button';
    calcRow.appendChild(calcBtn);
    body.appendChild(calcRow);

    var out = el('div', null);
    body.appendChild(out);

    calcBtn.addEventListener('click', function () {
      out.innerHTML = '';
      ensureTables().then(function () {
        var input = {
          phases: Number(val('ec-vd-phases')),
          voltageV: numVal('ec-vd-volt'),
          currentA: numVal('ec-vd-curr'),
          size_mm2: numVal('ec-vd-size'),
          lengthM: numVal('ec-vd-len'),
          conductor: val('ec-vd-cond'),
          insulation: val('ec-vd-ins'),
          powerFactor: numVal('ec-vd-pf')
        };
        var res = window.EngCalc.voltageDrop(input);
        showResult(out, res, 'Voltage Drop Result');
        var statusNode = el('div', null);
        renderResultActions(out, statusNode);
        out.appendChild(statusNode);
      }).catch(function (err) {
        out.appendChild(el('div', 'ec-err', err.message || 'Calculation error'));
      });
    });
  }

  function renderBreakerTab(body) {
    var grid = el('div', 'ec-grid');
    grid.appendChild(createField('ec-br-ib', 'Design Current Ib (A)', 'number', 45));
    grid.appendChild(createField('ec-br-iz', 'Cable Ampacity Iz (A) - optional', 'number', 75));
    grid.appendChild(createField('ec-br-type', 'Breaker Type', 'select', [
      { value: 'any', label: 'Any', selected: true },
      { value: 'MCB', label: 'MCB' },
      { value: 'MCCB', label: 'MCCB' },
      { value: 'ACB', label: 'ACB' }
    ]));
    grid.appendChild(createField('ec-br-sf', 'Safety Factor', 'number', 1.0));
    grid.appendChild(createField('ec-br-i2f', 'Tripping Factor I2/In - optional (datasheet)', 'number', ''));
    body.appendChild(grid);

    var calcRow = el('div', 'ec-actions');
    var calcBtn = el('button', 'ec-btn', 'Select Breaker');
    calcBtn.type = 'button';
    calcRow.appendChild(calcBtn);
    body.appendChild(calcRow);

    var out = el('div', null);
    body.appendChild(out);

    calcBtn.addEventListener('click', function () {
      out.innerHTML = '';
      ensureTables().then(function () {
        var input = {
          designCurrentA: numVal('ec-br-ib'),
          cableAmpacityA: numVal('ec-br-iz'),
          type: val('ec-br-type'),
          safetyFactor: numVal('ec-br-sf'),
          i2Factor: val('ec-br-i2f') !== '' ? numVal('ec-br-i2f') : undefined
        };
        var res = window.EngCalc.breakerSelection(input);
        showResult(out, res, 'Breaker Selection Result');
        var statusNode = el('div', null);
        renderResultActions(out, statusNode);
        out.appendChild(statusNode);
      }).catch(function (err) {
        out.appendChild(el('div', 'ec-err', err.message || 'Calculation error'));
      });
    });
  }

  function renderTablesTab(body) {
    var out = el('div', null, 'Loading tables...');
    body.appendChild(out);
    ensureTables().then(function () {
      out.innerHTML = '';
      var listed = window.EngTables.list();
      var keys = []
        .concat(listed.tables || [])
        .concat(listed.factors || []);

      var hasPlaceholder = false;
      var wrap = el('div', 'ec-table-wrap');
      var table = el('table', 'ec-table');
      var thead = document.createElement('thead');
      var hr = document.createElement('tr');
      ['الجدول', 'الوصف', 'الحالة', 'المصدر'].forEach(function (h) {
        hr.appendChild(el('th', null, h));
      });
      thead.appendChild(hr);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      keys.forEach(function (k) {
        var meta = window.EngTables.meta(k) || { key: k, status: 'unknown', source: '' };
        if (!isOkStatus(meta.status)) {
          hasPlaceholder = true;
        }
        var tr = document.createElement('tr');
        tr.appendChild(el('td', null, meta.key || k));
        tr.appendChild(el('td', null, meta.title || '-'));
        var stTd = document.createElement('td');
        var badgeClass = (!isOkStatus(meta.status)) ? 'ec-badge ec-badge-warn' : 'ec-badge ec-badge-ok';
        stTd.appendChild(el('span', badgeClass, meta.status || 'unknown'));
        tr.appendChild(stTd);
        tr.appendChild(el('td', null, meta.source || '-'));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);

      if (hasPlaceholder) {
        out.appendChild(el('div', 'ec-warn', 'تنبيه: بعض الجداول حالتها from_memory_needs_review أو old_edition ويجب التحقق منها أمام المرجع الهندسي المعتمد.'));
      }
      out.appendChild(wrap);
    }).catch(function (err) {
      out.innerHTML = '';
      out.appendChild(el('div', 'ec-err', err.message || 'Failed to load tables'));
    });
  }

  var extraTabs = [];
  function registerTab(id, label, renderFn) {
    for (var i = 0; i < extraTabs.length; i++) { if (extraTabs[i].id === id) { extraTabs[i] = { id: id, label: label, render: renderFn }; return; } }
    extraTabs.push({ id: id, label: label, render: renderFn });
  }

  function renderModalContent() {
    var modal = document.getElementById('ec-modal');
    if (!modal) return;
    var body = document.getElementById('ec-body');
    if (!body) return;
    body.innerHTML = '';

    var tabs = modal.querySelectorAll('.ec-tab');
    tabs.forEach(function (t) {
      if (t.getAttribute('data-tab') === activeTab) {
        t.classList.add('ec-active');
      } else {
        t.classList.remove('ec-active');
      }
    });

    if (activeTab === 'cable') renderCableTab(body);
    else if (activeTab === 'vdrop') renderVdropTab(body);
    else if (activeTab === 'breaker') renderBreakerTab(body);
    else if (activeTab === 'tables') renderTablesTab(body);
    else extraTabs.forEach(function (x) { if (x.id === activeTab) x.render(body); });
  }

  function open() {
    injectStyles();
    if (document.getElementById(MODAL_ID)) return;

    var backdrop = el('div', 'ec-backdrop');
    backdrop.id = MODAL_ID;
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) close();
    });

    var modal = el('div', 'ec-modal');
    modal.id = 'ec-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    var head = el('div', 'ec-head');
    head.appendChild(el('h2', 'ec-title', 'Engineering Calculator'));
    var closeBtn = el('button', 'ec-close', 'X');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', close);
    head.appendChild(closeBtn);
    modal.appendChild(head);

    var tabsBar = el('div', 'ec-tabs');
    [
      { id: 'cable', label: 'Cable sizing' },
      { id: 'vdrop', label: 'Voltage drop' },
      { id: 'breaker', label: 'Breaker' },
      { id: 'tables', label: 'Tables' }
    ].concat(extraTabs.map(function (x) { return { id: x.id, label: x.label }; })).forEach(function (item) {
      var btn = el('button', 'ec-tab', item.label);
      btn.type = 'button';
      btn.setAttribute('data-tab', item.id);
      btn.addEventListener('click', function () {
        activeTab = item.id;
        renderModalContent();
      });
      tabsBar.appendChild(btn);
    });
    modal.appendChild(tabsBar);

    var body = el('div', null);
    body.id = 'ec-body';
    modal.appendChild(body);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    renderModalContent();
  }

  function close() {
    var backdrop = document.getElementById(MODAL_ID);
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
  }

  function addTopbarButton() {
    if (document.getElementById(BTN_ID)) return;
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;
    var btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = 'sec';
    btn.textContent = 'Eng Calc';
    btn.addEventListener('click', open);
    topbar.appendChild(btn);
  }

  function addSidebarButton() {
    if (document.getElementById('ec-side-btn')) return;
    var foot = document.querySelector('.sidefoot');
    if (!foot) return;
    var b = document.createElement('button');
    b.id = 'ec-side-btn';
    b.type = 'button';
    b.className = 'sec';
    b.textContent = 'Eng Calc';
    b.addEventListener('click', open);
    foot.insertBefore(b, foot.firstChild);
  }

  function init() {
    injectStyles();
    addTopbarButton();
    addSidebarButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.EngUI = {
    open: open,
    close: close,
    openModal: open,
    registerTab: registerTab,
    helpers: { el: el, createField: createField, val: val, numVal: numVal, showResult: showResult, ensureTables: ensureTables, renderResultActions: renderResultActions },
    closeModal: close,
    init: init
  };
})();
