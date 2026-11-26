(function () {
  'use strict';

  var STYLE_ID = 'ec-styles';
  var MODAL_ID = 'ec-modal-backdrop';
  var BTN_ID = 'ec-topbar-btn';
  var activeTab = 'cable';
  var lastReportText = '';
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
      '.ec-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid var(--line,#2a3347);}',
      '.ec-badge-warn{border-color:#d97706;color:#f59e0b;}',
      '.ec-badge-ok{border-color:#16a34a;color:#22c55e;}',
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
    if (text !== undefined && text !== null) node.textContent = String(text);
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

  function renderStepsTable(container, steps) {
    var wrap = el('div', 'ec-table-wrap');
    var table = el('table', 'ec-table');
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
      tr.appendChild(el('td', null, s.step));
      tr.appendChild(el('td', null, s.formula));
      tr.appendChild(el('td', null, s.substitution));
      tr.appendChild(el('td', null, s.result));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  function renderTableWarning(container, meta) {
    if (!meta) return;
    if (meta.status === 'placeholder' || meta.status === 'from_memory') {
      var msg = 'تحذير: الجدول المستخدم (' + (meta.key || meta.title || '') + ') حالته "' + meta.status + '"';
      if (meta.source) msg += ' - المصدر: ' + meta.source;
      msg += '. يرجى التحقق من القيم أمام الكود الهندسي المعتمد قبل الاعتماد النهائي.';
      container.appendChild(el('div', 'ec-warn', msg));
    }
  }

  function buildReportText(title, summaryLines, steps, meta) {
    var lines = [title];
    if (meta && (meta.status === 'placeholder' || meta.status === 'from_memory')) {
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

  function renderResultActions(container, statusNode) {
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
      { value: 'air', label: 'In Air', selected: true },
      { value: 'ground', label: 'In Ground' }
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
          lengthM: numVal('ec-cs-len'),
          maxVdropPct: numVal('ec-cs-maxvd')
        };
        var res = window.EngCalc.cableSizing(input);
        renderTableWarning(out, res.table);

        var summaryText = 'المقطع المختار: ' + res.size_mm2 + ' mm2 | السعة المصححة: ' +
          res.deratedAmpacityA.toFixed(1) + ' A | تيار التصميم: ' + res.designCurrentA.toFixed(1) + ' A';
        if (res.vdrop) {
          summaryText += ' | هبوط الجهد: ' + res.vdrop.vdropV.toFixed(2) + ' V (' + res.vdrop.vdropPct.toFixed(2) + '%)';
        }
        out.appendChild(el('div', 'ec-summary', summaryText));

        var steps = [
          {
            step: '1. تيار التصميم Ib',
            formula: input.currentA > 0 ? 'Ib = I' : 'Ib = (P * 1000) / (k * V * PF)',
            substitution: input.currentA > 0 ? String(input.currentA) : 'P=' + input.powerKW + ' kW, V=' + input.voltageV + ' V, PF=' + input.powerFactor,
            result: res.designCurrentA.toFixed(2) + ' A'
          },
          {
            step: '2. معاملات التصحيح',
            formula: 'Ct = Ca * Cg',
            substitution: res.factors.ca.toFixed(3) + ' * ' + res.factors.cg.toFixed(3),
            result: res.factors.combined.toFixed(3)
          },
          {
            step: '3. السعة الأساسية المطلوبة',
            formula: 'Iz_req = Ib / Ct',
            substitution: res.designCurrentA.toFixed(2) + ' / ' + res.factors.combined.toFixed(3),
            result: res.requiredBaseAmpacityA.toFixed(2) + ' A'
          },
          {
            step: '4. اختيار المقطع من الجدول',
            formula: 'Iz_table >= Iz_req',
            substitution: (res.table ? res.table.key : 'table') + ' -> ' + res.baseAmpacityA + ' A',
            result: res.size_mm2 + ' mm2 (مصحح ' + res.deratedAmpacityA.toFixed(1) + ' A)'
          }
        ];
        if (res.vdrop) {
          steps.push({
            step: '5. التحقق من هبوط الجهد',
            formula: 'dV% = (dV / V) * 100 <= ' + (input.maxVdropPct || 5) + '%',
            substitution: res.vdrop.vdropV.toFixed(2) + ' / ' + res.vdrop.voltageV,
            result: res.vdrop.vdropPct.toFixed(2) + '%'
          });
        }
        renderStepsTable(out, steps);
        var statusNode = el('div', null);
        lastReportText = buildReportText('Cable Sizing Result', [summaryText], steps, res.table);
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
        renderTableWarning(out, res.table);

        var summaryText = 'هبوط الجهد: ' + res.vdropV.toFixed(2) + ' V (' + res.vdropPct.toFixed(2) + '%) | الطريقة: ' + res.methodUsed;
        out.appendChild(el('div', 'ec-summary', summaryText));

        var steps = [
          {
            step: '1. المعطيات',
            formula: 'I, L, S, V, PF',
            substitution: input.currentA + ' A, ' + input.lengthM + ' m, ' + input.size_mm2 + ' mm2, ' + input.voltageV + ' V, PF=' + input.powerFactor,
            result: input.phases + '-Phase ' + input.conductor
          },
          {
            step: '2. حساب هبوط الجهد',
            formula: res.methodUsed === 'mv_a_m' ? 'dV = (mV/A/m * I * L) / 1000' : 'dV = k * I * L * (R*cos + X*sin) / 1000',
            substitution: 'جدول: ' + (res.table ? res.table.key : res.methodUsed),
            result: res.vdropV.toFixed(2) + ' V'
          },
          {
            step: '3. النسبة المئوية',
            formula: 'dV% = (dV / V) * 100',
            substitution: '(' + res.vdropV.toFixed(2) + ' / ' + res.voltageV + ') * 100',
            result: res.vdropPct.toFixed(2) + '%'
          }
        ];
        renderStepsTable(out, steps);
        var statusNode = el('div', null);
        lastReportText = buildReportText('Voltage Drop Result', [summaryText], steps, res.table);
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
          safetyFactor: numVal('ec-br-sf')
        };
        var res = window.EngCalc.breakerSelection(input);
        renderTableWarning(out, res.table);

        var coordText = res.coordinated === null ? 'غير محدد' : (res.coordinated ? 'متوافق (In <= Iz)' : 'غير متوافق (In > Iz)');
        var summaryText = 'القاطع المختار: ' + res.rating_a + ' A (' + res.type + ') | التنسيق: ' + coordText;
        out.appendChild(el('div', 'ec-summary', summaryText));

        var steps = [
          {
            step: '1. تيار التصميم المضروب بالمعامل',
            formula: 'I_req = Ib * SF',
            substitution: input.designCurrentA + ' * ' + (input.safetyFactor || 1),
            result: (input.designCurrentA * (input.safetyFactor || 1)).toFixed(2) + ' A'
          },
          {
            step: '2. اختيار المقاس القياسي',
            formula: 'In >= I_req',
            substitution: 'الجدول: ' + (res.table ? res.table.key : 'standard_breakers'),
            result: res.rating_a + ' A (' + res.type + ')'
          },
          {
            step: '3. التحقق من التنسيق مع الكابل',
            formula: 'Ib <= In <= Iz',
            substitution: input.designCurrentA + ' <= ' + res.rating_a + ' <= ' + (input.cableAmpacityA || '-'),
            result: coordText
          }
        ];
        renderStepsTable(out, steps);
        var statusNode = el('div', null);
        lastReportText = buildReportText('Breaker Selection Result', [summaryText], steps, res.table);
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
        if (meta.status === 'placeholder' || meta.status === 'from_memory') {
          hasPlaceholder = true;
        }
        var tr = document.createElement('tr');
        tr.appendChild(el('td', null, meta.key || k));
        tr.appendChild(el('td', null, meta.title || '-'));
        var stTd = document.createElement('td');
        var badgeClass = (meta.status === 'placeholder' || meta.status === 'from_memory') ? 'ec-badge ec-badge-warn' : 'ec-badge ec-badge-ok';
        stTd.appendChild(el('span', badgeClass, meta.status || 'unknown'));
        tr.appendChild(stTd);
        tr.appendChild(el('td', null, meta.source || '-'));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);

      if (hasPlaceholder) {
        out.appendChild(el('div', 'ec-warn', 'تنبيه: بعض الجداول حالتها placeholder أو from_memory ويجب التحقق منها أمام المرجع الهندسي المعتمد.'));
      }
      out.appendChild(wrap);
    }).catch(function (err) {
      out.innerHTML = '';
      out.appendChild(el('div', 'ec-err', err.message || 'Failed to load tables'));
    });
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
    ].forEach(function (item) {
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

  function init() {
    injectStyles();
    addTopbarButton();
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
    closeModal: close,
    init: init
  };
})();
