/* Load Estimate: area x density from the DPS-01 table, then demand factor once. Anything not in the table is an assumption and is labeled as one. */
(function () {
  'use strict';
  var TID = 'sec_dps01_load_density_demand';
  function num(x) { return x === undefined || x === null || x === '' ? NaN : Number(x); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function pos(x) { return typeof x === 'number' && isFinite(x) && x > 0; }

  function calculate(inp, tablesApi) {
    var a = tablesApi || window.EngTables, o = inp || {};
    var t = a && a.get ? a.get(TID) : null;
    if (!t) return { ok: false, error: 'الجدول غير موجود في ملف البيانات: ' + TID };
    var rowsIn = o.areas || [];
    if (!rowsIn.length) return { ok: false, error: 'ضيف مساحة واحدة على الأقل.' };
    var steps = [], warnings = [], rows = [], tot = { area: 0, cl: 0, dl: 0 }, tot15 = { cl: 0, dl: 0, dl2: 0 }, anyCustom = false, i;
    var sens = t.sensitivity_edition_2015;
    for (i = 0; i < rowsIn.length; i++) {
      var r = rowsIn[i], cat = String(r.category || ''), area = num(r.areaM2), dens, df, src, name = r.label || cat, row15 = null;
      if (!pos(area)) return { ok: false, error: 'المساحة في الصف ' + (i + 1) + ' غير صالحة (' + r.areaM2 + '): لازم تكون أكبر من صفر.' };
      if (cat === 'custom') {
        dens = num(r.densityVaM2); df = num(r.demandFactor);
        if (!pos(dens)) return { ok: false, error: 'Density في الصف ' + (i + 1) + ' لازم تكون أكبر من صفر (VA/m2).' };
        if (!(df > 0 && df <= 1)) return { ok: false, error: 'Demand factor في الصف ' + (i + 1) + ' لازم يكون بين 0 و1.' };
        src = 'assumption (user entered, not from DPS-01)'; anyCustom = true;
      } else {
        var tr = t.rows.filter(function (x) { return x[0] === cat; })[0];
        if (!tr) return { ok: false, error: 'Category غير معروفة (' + cat + '): المتاح C7 أو C6 أو custom.' };
        name = tr[1]; dens = tr[2]; df = tr[3]; src = 'DPS-01 (2023) Table 19 / Table 20, code ' + cat;
        if (sens && sens.density[cat]) row15 = sens.density[cat];
      }
      var cl = area * dens / 1000, dl = cl * df;
      tot.area += area; tot.cl += cl; tot.dl += dl;
      if (row15) { var c15 = area * row15 / 1000; tot15.cl += c15; tot15.dl += c15 * sens.demand_factor_candidates[0]; tot15.dl2 += c15 * sens.demand_factor_candidates[1]; } else if (sens) { tot15.skip = true; }
      rows.push({ label: name, category: cat, areaM2: area, densityVaM2: dens, demandFactor: df, connectedKva: cl, demandKva: dl, basis: src });
      steps.push({ step: name + ' (' + cat + ')', formula: 'CL = area x density / 1000 ; DL = CL x DF', substitution: area + ' x ' + dens + ' / 1000 = ' + r2(cl) + ' kVA ; ' + r2(cl) + ' x ' + df, result: 'CL = ' + r2(cl) + ' kVA | DL = ' + r2(dl) + ' kVA | ' + src, value: dl, unit: 'kVA' });
    }
    steps.push({ step: 'Total', formula: 'sum of rows (demand factor applied once per row, no extra diversity)', substitution: rows.length + ' rows', result: 'CL = ' + r2(tot.cl) + ' kVA | DL = ' + r2(tot.dl) + ' kVA', value: tot.dl, unit: 'kVA' });
    var ch = [], asm = [], A = o.assumptions || {}, extraCl = 0, extraDl = 0;
    if (A.ceiling === 'above' && pos(num(A.heightM)) && num(A.heightM) > 3.5) {
      var rate = Number(A.rate) === 30 ? 30 : 24, exV = tot.area * (num(A.heightM) - 3.5);
      extraCl = exV * rate / 1000; extraDl = extraCl;
      ch.push('Ceiling height ' + num(A.heightM) + ' m (above 3.5 m): extra ' + rate + ' VA/m3 of excess volume = ' + r2(extraCl) + ' kVA, added after the demand factor (' + (rate === 24 ? 'DPS-01 2023 sec 2.4' : 'SERA Electricity Service Guide 9th ed. (2025)') + ', per the sourced sheet; clause not checked here). One ceiling height is applied to the total area of all rows. Whether the demand factor applies to it is an assumption.');
      steps.push({ step: 'Ceiling above 3.5 m', formula: 'extra = area x (H - 3.5) x rate / 1000', substitution: r2(tot.area) + ' x (' + num(A.heightM) + ' - 3.5) x ' + rate + ' / 1000', result: r2(extraCl) + ' kVA (added, not multiplied by DF: assumption)', value: extraCl, unit: 'kVA' });
    } else if (A.ceiling === 'above') {
      return { ok: false, error: 'Ceiling height لازم يكون أكبر من 3.5 m لما تختار "Yes, above 3.5 m" (القيمة المدخلة: ' + A.heightM + '). اكتب الارتفاع أو اختار "No".' };
    } else if (A.ceiling === 'not_above') ch.push('Ceiling height: not above 3.5 m (no extra load).');
    else asm.push('Ceiling height not chosen: no extra load applied for ceilings over 3.5 m (assumption).');
    if (A.special === 'add' && pos(num(A.specialKva))) {
      extraDl += num(A.specialKva); extraCl += num(A.specialKva);
      ch.push('Special loads (lifts, pumps, central plant, kitchen): ' + num(A.specialKva) + ' kVA entered by the user, added as is to connected and demand.');
      steps.push({ step: 'Special loads', formula: 'added as entered', substitution: num(A.specialKva) + ' kVA', result: num(A.specialKva) + ' kVA (user entered)', value: num(A.specialKva), unit: 'kVA' });
    } else if (A.special === 'none') ch.push('Special loads: none declared.');
    else asm.push('Special loads not chosen: none included (assumption).');
    if (A.supply === 'single') ch.push('Supply: single supply point selected, coincidence factor 1.');
    else if (A.supply === 'multiple') asm.push('Several meters chosen: the coincidence factor table was not retrieved, so none is applied (unsourced).');
    else asm.push('Supply points not chosen: single supply point assumed, coincidence factor 1 (assumption).');
    var cats = rows.map(function (x) { return x.category; });
    var T = A.touched || {}, catUser = [], catDef = [];
    rows.forEach(function (x, ix) { var d = x.label + ' = ' + (x.category === 'custom' ? 'custom (assumption)' : x.category); (T['c' + (rowsIn[ix].slot || (ix + 1))] ? catUser : catDef).push(d); });
    if (catUser.length) ch.push('Category per space: ' + catUser.join('; ') + '.');
    if (catDef.length) asm.push('Category left at the default selection: ' + catDef.join('; ') + '. Confirm each space is really that DPS-01 category.');
    ch.push('Demand factor source: ' + (anyCustom ? 'Table 20 for coded rows, user-entered for custom rows (assumption).' : 'DPS-01 (2023) Table 20.'));
    if (extraDl) { tot.dl += extraDl; tot.cl += extraCl; steps.push({ step: 'Total with additions', formula: 'DL + additions', substitution: '', result: 'CL = ' + r2(tot.cl) + ' kVA | DL = ' + r2(tot.dl) + ' kVA', value: tot.dl, unit: 'kVA' }); }
    ch.forEach(function (x) { warnings.push('User entered: ' + x); });
    asm.forEach(function (x) { warnings.push('Default / assumption: ' + x); });
    warnings.push('Not in the DPS-01 table, so never labeled "from the code": the ceiling-height extra, special loads and the coincidence factor. They count only as the choices or assumptions listed above.');
    warnings.push('Demand factor is applied once, from Table 20. No separate diversity factor is stacked on it because no source was given for one.');
    if (anyCustom) warnings.push('Rows marked "assumption" use values the user entered. They are not from DPS-01.');
    var sensTxt = null;
    if (sens && o.sensitivity && tot15.skip) warnings.push('2015 sensitivity skipped: a Custom row has no 2015 value in the table.');
    if (sens && o.sensitivity && !tot15.skip) {
      sensTxt = 'Sensitivity only (previous edition DPS-01 Rev-02, Sep 2015, needs_review): CL = ' + r2(tot15.cl) + ' kVA, DL = ' + r2(tot15.dl) + ' kVA if DF 0.6 or ' + r2(tot15.dl2) + ' kVA if DF 0.70 (the 2015 demand factor is unconfirmed)';
      warnings.push(sensTxt + '. Do not use for design.');
      steps.push({ step: 'Sensitivity (2015 edition)', formula: 'same method with 2015 densities (offices 220, restaurant 235 VA/m2), DF 0.6 or 0.70 unconfirmed', substitution: 'for comparison only', result: sensTxt, value: tot15.dl, unit: 'kVA' });
    }
    var used = [{ id: TID, source: (a.meta(TID) || {}).source || '', status: (a.meta(TID) || {}).status || 'unknown', title: (a.meta(TID) || {}).title || '' }];
    return { ok: true, rows: rows, totalAreaM2: tot.area, connectedKva: tot.cl, demandKva: tot.dl, sensitivity: sens && o.sensitivity && !tot15.skip ? { connectedKva: tot15.cl, demandKva: tot15.dl, demandKvaDf070: tot15.dl2 } : null,
      steps: steps, tablesUsed: used, warnings: warnings,
      summary: 'Connected ' + r1(tot.cl) + ' kVA | Demand ' + r1(tot.dl) + ' kVA | Area ' + r1(tot.area) + ' m2 | Source: SEC DPS-01 Rev-02 (Nov 2023), Table 19 pp.26-27 and Table 20 pp.29-30 as reported by a reviewer (secondary copies, not official SEC)' + (anyCustom || asm.length || extraDl ? ' | includes custom rows, additions or default assumptions, see the list' : '') };
  }

  function register() {
    if (!window.EngUI || !window.EngUI.registerTab || !window.EngUI.helpers) return false;
    var h = window.EngUI.helpers;
    window.EngUI.registerTab('loadest', 'Load Estimate', function (body) {
      body.appendChild(h.el('div', 'ec-note', 'التقدير ده بيستخدم جدول SEC DPS-01 (إصدار 2023) المسجل في التطبيق. أي قيمة مش في الجدول بتظهر في التقرير كـ assumption.'));
      var grid = h.el('div', 'ec-grid');
      var cats = [{ value: 'C7', label: 'Offices (C7)', selected: true }, { value: 'C6', label: 'Restaurant / cafe (C6)' }, { value: 'custom', label: 'Custom (assumption)' }];
      [1, 2, 3].forEach(function (n) {
        grid.appendChild(h.createField('le-c' + n, 'Space ' + n + ' - Category', 'select', n === 2 ? [{ value: 'C7', label: 'Offices (C7)' }, { value: 'C6', label: 'Restaurant / cafe (C6)', selected: true }, { value: 'custom', label: 'Custom (assumption)' }] : cats.map(function (c) { return { value: c.value, label: c.label, selected: n === 1 && c.value === 'C7' }; })));
        grid.appendChild(h.createField('le-a' + n, 'Space ' + n + ' - Area (m2)', 'number', ''));
        grid.appendChild(h.createField('le-d' + n, 'Space ' + n + ' - Density VA/m2 (custom only)', 'number', ''));
        grid.appendChild(h.createField('le-f' + n, 'Space ' + n + ' - Demand factor (custom only)', 'number', ''));
      });
      grid.appendChild(h.createField('le-ceil', 'Ceiling height above 3.5 m?', 'select', [{ value: 'undecided', label: 'Not decided (assumption: no extra)', selected: true }, { value: 'not_above', label: 'No, 3.5 m or lower' }, { value: 'above', label: 'Yes, above 3.5 m' }]));
      grid.appendChild(h.createField('le-h', 'Ceiling height (m) - if above', 'number', ''));
      grid.appendChild(h.createField('le-rate', 'Extra load rate - if above', 'select', [{ value: '24', label: '24 VA/m3 (DPS-01 2023)', selected: true }, { value: '30', label: '30 VA/m3 (SERA guide V8)' }]));
      grid.appendChild(h.createField('le-sp', 'Special loads (lifts, pumps, central plant, kitchen)', 'select', [{ value: 'undecided', label: 'Not decided (assumption: none)', selected: true }, { value: 'none', label: 'None' }, { value: 'add', label: 'Add kVA below' }]));
      grid.appendChild(h.createField('le-spk', 'Special loads (kVA) - if add', 'number', ''));
      grid.appendChild(h.createField('le-sup', 'Supply points', 'select', [{ value: 'undecided', label: 'Not decided (assumption: single)', selected: true }, { value: 'single', label: 'Single supply point' }, { value: 'multiple', label: 'Several meters (no factor applied)' }]));
      grid.appendChild(h.createField('le-s', 'Show 2015 edition sensitivity', 'select', [{ value: '0', label: 'No', selected: true }, { value: '1', label: 'Yes' }]));
      body.appendChild(grid);
      var btn = h.el('button', 'ec-btn', 'Calculate Load Estimate'); btn.type = 'button'; body.appendChild(btn);
      var out = h.el('div', 'ec-out'); body.appendChild(out);
      var touched = {};
      [1, 2, 3].forEach(function (n) { var e = document.getElementById('le-c' + n); if (e) e.addEventListener('change', function () { touched['c' + n] = true; }); });
      btn.addEventListener('click', function () {
        out.innerHTML = '';
        h.ensureTables().then(function () {
          var areas = [];
          [1, 2, 3].forEach(function (n) {
            var ar = h.numVal('le-a' + n);
            if (ar === undefined) return;
            areas.push({ slot: n, category: h.val('le-c' + n), areaM2: ar, densityVaM2: h.numVal('le-d' + n), demandFactor: h.numVal('le-f' + n) });
          });
          var res = calculate({ areas: areas, sensitivity: h.val('le-s') === '1', assumptions: { touched: touched, ceiling: h.val('le-ceil'), heightM: h.numVal('le-h'), rate: h.val('le-rate'), special: h.val('le-sp'), specialKva: h.numVal('le-spk'), supply: h.val('le-sup') } });
          h.showResult(out, res, 'Load Estimate (SEC DPS-01)');
          if (res.ok) { var st = h.el('div', null); h.renderResultActions(out, st); out.appendChild(st); }
        }).catch(function (e) { out.appendChild(h.el('div', 'ec-err', e.message || 'Calculation error')); });
      });
    });
    return true;
  }

  window.EngLoadEst = { calculate: calculate, register: register };
  if (typeof document !== 'undefined') {
    if (!register()) { var n = 0; var iv = setInterval(function () { if (register() || ++n > 40) clearInterval(iv); }, 100); }
  }
})();
