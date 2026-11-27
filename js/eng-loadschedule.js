/* Panel load schedule: loads -> R/Y/B distribution, unbalance %, connected and demand kVA, main breaker and incomer cable.
   Pure logic on window.EngLoadSchedule (tested in tools/eng-loadschedule-test.js); UI is an Eng Calc tab. */
(function () {
  'use strict';
  var PH = ['R', 'Y', 'B'];
  function num(x) { var n = Number(x); return isFinite(n) ? n : NaN; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r3(x) { return Math.round(x * 1000) / 1000; }

  /* loads: [{name, qty, kw, pf, df, phase}] phase: '3P' | 'R' | 'Y' | 'B' | 'AUTO' (single phase, auto balanced) */
  function schedule(input, tables) {
    var o = input || {}, loads = (o.loads || []).filter(function (l) { return l && (num(l.kw) > 0); });
    if (!loads.length) throw new Error('ضيف Load واحد على الأقل (kW أكبر من صفر).');
    var vGiven = !(o.voltageV === undefined || o.voltageV === null || o.voltageV === '');
    if (vGiven && !(num(o.voltageV) > 0)) throw new Error('Voltage غير صالح (' + o.voltageV + '): لازم يكون أكبر من صفر. سيبه فاضي لو عايز القيمة الافتراضية (400 V).');
    var V = vGiven ? num(o.voltageV) : 400, vph = V / Math.sqrt(3);
    var div = num(o.diversity) > 0 ? num(o.diversity) : 1, spare = num(o.sparePct) >= 0 ? num(o.sparePct) : 0;
    var steps = [], warnings = [], rows = [], ph = { R: { kva: 0, kw: 0, ckva: 0 }, Y: { kva: 0, kw: 0, ckva: 0 }, B: { kva: 0, kw: 0, ckva: 0 } };

    loads.forEach(function (l, i) {
      var qty = num(l.qty) > 0 ? num(l.qty) : 1, pfGiven = !(l.pf === null || l.pf === undefined || l.pf === ''), dfGiven = !(l.df === null || l.df === undefined || l.df === '');
      if (pfGiven && !(num(l.pf) > 0 && num(l.pf) <= 1)) throw new Error('Power Factor غير صالح في Load رقم ' + (i + 1) + ' (' + l.pf + '): لازم يكون أكبر من 0 وأقل من أو يساوي 1. سيبه فاضي لو عايز 0.85.');
      var pf = pfGiven ? num(l.pf) : 0.85;
      if (dfGiven && !(isFinite(num(l.df)) && num(l.df) >= 0 && num(l.df) <= 1)) throw new Error('Demand factor غير صالح في Load رقم ' + (i + 1) + ' (' + l.df + '): لازم يكون بين 0 و 1. سيبه فاضي لو عايز 1.');
      var df = dfGiven ? num(l.df) : 1;
      var kw = qty * num(l.kw), kva = kw / pf;
      rows.push({ no: i + 1, name: l.name || ('Load ' + (i + 1)), qty: qty, kwEach: num(l.kw), pf: pf, df: df, phase: String(l.phase || '3P').toUpperCase(), kw: kw, kva: kva, dkw: kw * df, dkva: kva * df, assigned: null });
    });

    /* fixed single-phase first, then 3P (even split), then AUTO single-phase largest first onto the least loaded phase */
    rows.forEach(function (r) {
      if (PH.indexOf(r.phase) >= 0) { add(r, r.phase, 1); r.assigned = r.phase; }
      else if (r.phase === '3P') { PH.forEach(function (p) { add(r, p, 1 / 3); }); r.assigned = 'R/Y/B'; }
    });
    rows.filter(function (r) { return r.phase !== '3P' && PH.indexOf(r.phase) < 0; }).sort(function (a, b) { return b.dkva - a.dkva; }).forEach(function (r) {
      var p = PH.slice().sort(function (a, b) { return ph[a].kva - ph[b].kva; })[0];
      add(r, p, 1); r.assigned = p; r.phase = 'AUTO';
    });
    function add(r, p, share) { ph[p].kva += r.dkva * share; ph[p].kw += r.dkw * share; ph[p].ckva += r.kva * share; }

    var tot = rows.reduce(function (a, r) { a.kw += r.kw; a.kva += r.kva; a.dkw += r.dkw; a.dkva += r.dkva; return a; }, { kw: 0, kva: 0, dkw: 0, dkva: 0 });
    steps.push({ step: 'Connected Load', formula: 'Σ (qty x kW) ; kVA = kW / PF', substitution: rows.length + ' Load', result: r1(tot.kw) + ' kW | ' + r1(tot.kva) + ' kVA', value: tot.kva, unit: 'kVA' });
    steps.push({ step: 'Demand Load بعد Demand Factor', formula: 'Σ (kVA x DF)', substitution: 'DF لكل Load من الجدول', result: r1(tot.dkw) + ' kW | ' + r1(tot.dkva) + ' kVA', value: tot.dkva, unit: 'kVA' });
    var dkvaDiv = tot.dkva * div;
    steps.push({ step: 'Diversity Factor للوحة', formula: 'kVA_div = kVA_demand x Diversity', substitution: r1(tot.dkva) + ' x ' + div, result: r1(dkvaDiv) + ' kVA', value: dkvaDiv, unit: 'kVA' });
    var des = dkvaDiv * (1 + spare / 100);
    steps.push({ step: 'Design Load مع الاحتياطي', formula: 'kVA_design = kVA_div x (1 + Spare%)', substitution: r1(dkvaDiv) + ' x (1 + ' + spare + '/100)', result: r1(des) + ' kVA', value: des, unit: 'kVA' });
    var Ib = des * 1000 / (Math.sqrt(3) * V);
    steps.push({ step: 'Design Current لـ Breaker الرئيسي', formula: 'Ib = kVA x 1000 / (sqrt(3) x V)', substitution: r1(des) + ' x 1000 / (1.732 x ' + V + ')', result: r1(Ib) + ' A', value: Ib, unit: 'A' });

    var cur = {}, vals = [];
    PH.forEach(function (p) { cur[p] = r1(ph[p].kva * 1000 / vph); vals.push(ph[p].kva * 1000 / vph); });
    var avg = (vals[0] + vals[1] + vals[2]) / 3, mx = Math.max.apply(null, vals), unb = avg > 0 ? (mx - avg) / avg * 100 : 0;
    steps.push({ step: 'Current كل فاز (Demand Load)', formula: 'I_phase = kVA_phase x 1000 / (V / sqrt(3))', substitution: 'R/Y/B kVA = ' + PH.map(function (p) { return r1(ph[p].kva); }).join(' / '), result: 'IR = ' + cur.R + ' A | IY = ' + cur.Y + ' A | IB = ' + cur.B + ' A', value: null, unit: 'A' });
    steps.push({ step: 'نسبة Unbalance', formula: 'Unbalance % = (Imax - Iavg) / Iavg x 100', substitution: '(' + r1(mx) + ' - ' + r1(avg) + ') / ' + r1(avg), result: r1(unb) + ' %', value: unb, unit: '%' });
    var UNB_LIMIT = num(o.unbalanceLimitPct) > 0 ? num(o.unbalanceLimitPct) : 10;
    if (unb > UNB_LIMIT) warnings.push('Unbalance ' + r1(unb) + ' % أعلى من ' + UNB_LIMIT + ' %. وزّع Loads أحادية الفاز على الفازات. (حد ' + UNB_LIMIT + ' % قيمة تصميمية شائعة وقابلة للتعديل، مش من نص كود، راجع مواصفات المشروع).');

    var res = { rows: rows, totals: tot, phases: { R: ph.R, Y: ph.Y, B: ph.B, currents: cur }, unbalancePct: r1(unb), designKVA: r1(des), designCurrentA: r2(Ib), voltageV: V, steps: steps, tablesUsed: [], warnings: warnings, spare: spare, diversity: div };

    var C = (typeof window !== 'undefined') ? window.EngCalc : null;
    if (C && o.sizeIncomer !== false) {
      try {
        var cs = C.cableSizing({ phases: 3, voltageV: V, currentA: Ib, powerFactor: tot.kw > 0 ? Math.min(1, tot.dkw / tot.dkva) : 0.85, conductor: o.conductor || 'Cu', insulation: o.insulation || 'XLPE', method: o.method || 'air', ambientC: num(o.ambientC) > 0 ? num(o.ambientC) : 35, circuits: num(o.circuits) > 0 ? num(o.circuits) : 1, lengthM: num(o.lengthM) > 0 ? num(o.lengthM) : undefined }, tables);
        res.incomer = cs;
        cs.steps.forEach(function (s) { steps.push(s); });
        res.tablesUsed = cs.tablesUsed || [];
        (cs.warnings || []).forEach(function (w) { res.warnings.push(w); });
        res.mainBreakerA = cs.breaker && cs.breaker.rating_a; res.incomerSizeMm2 = cs.size_mm2;
      } catch (e) {
        res.warnings.push('تعذر اختيار Breaker و Cable من الجداول: ' + (e && e.message ? e.message : e) + ' (قد يحتاج الـ Load إلى Cables على التوازي أو تصميم يدوي).');
      }
    }
    res.summary = 'Connected Load ' + r1(tot.kva) + ' kVA | الطلب ' + r1(tot.dkva) + ' kVA | التصميم ' + r1(des) + ' kVA | Ib = ' + r1(Ib) + ' A | Unbalance ' + r1(unb) + ' %' +
      (res.mainBreakerA ? ' | Breaker الرئيسي ' + res.mainBreakerA + ' A | Cable ' + res.incomerSizeMm2 + ' mm2' : '');
    return res;
  }

  function pdfDoc(res, title) {
    var loadRows = res.rows.map(function (r) { return [String(r.no), r.name, String(r.qty), String(r2(r.kwEach)), String(r.pf), String(r.df), r.assigned, String(r1(r.kva)), String(r1(r.dkva))]; });
    var t = res.totals, ph = res.phases;
    var blocks = [{ type: 'summary', text: res.summary, ok: res.mainBreakerA ? undefined : false }];
    if (res.tablesUsed && res.tablesUsed.length) blocks.push({ type: 'status', tables: res.tablesUsed });
    var sldSpec = window.EngSLD && window.EngSLD.fromLoadSchedule(res, res.sldExtra);
    if (sldSpec) blocks.push({ type: 'sld', heading: 'Single-line diagram', sld: window.EngSLD.build(sldSpec) });
    if (res.warnings.length) blocks.push({ type: 'warnings', items: res.warnings });
    blocks.push({ type: 'table', heading: 'Load Schedule / Load schedule', columns: ['#', 'Load', 'Qty', 'kW', 'PF', 'DF', 'Phase', 'kVA', 'kVA dem.'], rows: loadRows.concat([['', 'Total', '', r1(t.kw), '', '', '', r1(t.kva), r1(t.dkva)].map(String)]), widths: [0.06, 0.28, 0.07, 0.09, 0.08, 0.08, 0.1, 0.1, 0.14], fontSize: 20 });
    blocks.push({ type: 'table', heading: 'توزيع الفازات / Phase balance', columns: ['Phase', 'kVA (demand)', 'kW (demand)', 'Current (A)'], rows: ['R', 'Y', 'B'].map(function (p) { return [p, String(r1(ph[p].kva)), String(r1(ph[p].kw)), String(ph.currents[p])]; }).concat([['Unbalance', '', '', res.unbalancePct + ' %']]), widths: [0.25, 0.25, 0.25, 0.25], fontSize: 22 });
    blocks.push({ type: 'table', heading: 'الحسابات خطوة بخطوة / Calculation steps', columns: ['الخطوة', 'المعادلة', 'التعويض', 'النتيجة'], rows: res.steps.map(function (s) { return [s.step, s.formula, s.substitution, s.result]; }), widths: [0.2, 0.27, 0.31, 0.22], rtl: true, fontSize: 20 });
    return { title: title || 'Load Schedule', subtitle: 'Panel load schedule, demand and main breaker / incomer sizing', blocks: blocks, signature: true, fileBase: 'Load-Schedule' };
  }

  window.EngLoadSchedule = { schedule: schedule, pdfDoc: pdfDoc };

  /* ---------------- UI ---------------- */
  function register() {
    if (typeof document === 'undefined' || !window.EngUI || typeof window.EngUI.registerTab !== 'function') return false;
    var h = window.EngUI.helpers, el = h.el;
    window.EngUI.registerTab('loadschedule', 'Load Schedule', function (body) {
      body.appendChild(el('div', 'ec-summary', 'ضيف Loads (kW لكل وحدة، PF، Demand Factor DF، والفاز). Loads أحادية الفاز اختار لها R/Y/B أو Auto للتوزيع التلقائي. بيحسب الطلب و Unbalance ويقترح Breaker الرئيسي و Cable الـ incomer من الجداول.'));
      var list = el('div', null), seq = 0; body.appendChild(list);
      function addRow(d) {
        d = d || {}; var id = ++seq, card = el('div', 'ec-summary'), g = el('div', 'ec-grid');
        card.setAttribute('data-ls-row', id);
        g.appendChild(h.createField('ls-name-' + id, 'Load name', 'text', d.name || ''));
        g.appendChild(h.createField('ls-qty-' + id, 'Qty', 'number', d.qty || 1));
        g.appendChild(h.createField('ls-kw-' + id, 'kW each', 'number', d.kw || ''));
        g.appendChild(h.createField('ls-pf-' + id, 'PF', 'number', d.pf || 0.85));
        g.appendChild(h.createField('ls-df-' + id, 'Demand factor (0-1)', 'number', d.df || 1));
        g.appendChild(h.createField('ls-ph-' + id, 'Phase', 'select', [{ value: '3P', label: '3-phase', selected: true }, { value: 'R', label: '1-ph on R' }, { value: 'Y', label: '1-ph on Y' }, { value: 'B', label: '1-ph on B' }, { value: 'AUTO', label: '1-ph Auto balance' }]));
        card.appendChild(g);
        var rm = el('button', 'ec-btn ec-btn-sec', 'Remove load'); rm.type = 'button';
        rm.addEventListener('click', function () { if (list.children.length > 1) list.removeChild(card); });
        card.appendChild(rm); list.appendChild(card);
      }
      addRow();
      var acts = el('div', 'ec-actions'), add = el('button', 'ec-btn ec-btn-sec', 'Add load'); add.type = 'button';
      add.addEventListener('click', function () { addRow(); }); acts.appendChild(add); body.appendChild(acts);
      var g2 = el('div', 'ec-grid');
      g2.appendChild(h.createField('ls-v', 'Voltage (V, line-line)', 'number', 400));
      g2.appendChild(h.createField('ls-div', 'Panel diversity factor', 'number', 1));
      g2.appendChild(h.createField('ls-spare', 'Spare capacity (%)', 'number', 20));
      g2.appendChild(h.createField('ls-len', 'Incomer length (m) - optional', 'number', ''));
      g2.appendChild(h.createField('ls-cond', 'Conductor', 'select', [{ value: 'Cu', label: 'Copper (Cu)', selected: true }, { value: 'Al', label: 'Aluminium (Al)' }]));
      g2.appendChild(h.createField('ls-ins', 'Insulation', 'select', [{ value: 'XLPE', label: 'XLPE / EPR (90C)', selected: true }, { value: 'PVC', label: 'PVC (70C)' }]));
      g2.appendChild(h.createField('ls-meth', 'Installation', 'select', [{ value: 'air', label: 'In air (tray)', selected: true }, { value: 'ground', label: 'Buried' }, { value: 'duct', label: 'In ducts' }]));
      g2.appendChild(h.createField('ls-amb', 'Ambient (C)', 'number', 35));
      body.appendChild(g2);
      var row = el('div', 'ec-actions'), go = el('button', 'ec-btn', 'Build Load Schedule'); go.type = 'button'; row.appendChild(go); body.appendChild(row);
      var status = el('div', 'ec-summary', ''), out = el('div', null); body.appendChild(status); body.appendChild(out);
      go.addEventListener('click', function () {
        out.innerHTML = ''; status.textContent = '';
        var loads = [].slice.call(list.children).map(function (card) {
          var id = card.getAttribute('data-ls-row');
          return { name: h.val('ls-name-' + id), qty: h.numVal('ls-qty-' + id), kw: h.numVal('ls-kw-' + id), pf: h.numVal('ls-pf-' + id), df: h.numVal('ls-df-' + id), phase: h.val('ls-ph-' + id) };
        });
        h.ensureTables().then(function () {
          var res = schedule({ loads: loads, voltageV: h.numVal('ls-v'), diversity: h.numVal('ls-div'), sparePct: h.numVal('ls-spare'), lengthM: h.numVal('ls-len'), conductor: h.val('ls-cond'), insulation: h.val('ls-ins'), method: h.val('ls-meth'), ambientC: h.numVal('ls-amb') });
          h.showResult(out, res, 'Load Schedule');
          res.sldExtra = { lengthM: h.numVal('ls-len'), conductor: h.val('ls-cond'), insulation: h.val('ls-ins'), loadName: 'Panel load' };
          if (window.EngSLD && res.mainBreakerA) {
            var spec = window.EngSLD.fromLoadSchedule(res, res.sldExtra);
            if (spec) {
              window.EngSLD.remember(spec);
              var sumNode = out.querySelector('.ec-summary'), sbox = el('div', 'ec-sld'); sbox.style.margin = '10px 0'; sbox.innerHTML = window.EngSLD.toSVG(window.EngSLD.build(spec));
              if (sumNode && sumNode.nextSibling) out.insertBefore(sbox, sumNode.nextSibling); else out.appendChild(sbox);
            }
          }
          h.renderResultActions(out, status, function () { return pdfDoc(res, 'Load Schedule'); });
        }).catch(function (e) { status.textContent = 'تعذر الحساب: ' + (e && e.message ? e.message : e); });
      });
    });
    return true;
  }
  if (typeof document !== 'undefined') { if (!register()) { var n = 0, iv = setInterval(function () { if (register() || ++n > 40) clearInterval(iv); }, 250); } }
})();
