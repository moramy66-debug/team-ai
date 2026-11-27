/* PFC (power factor correction) and CPC / earthing conductor sizing. Pure logic on window.EngPfcCpc
   (tested in tools/eng-pfccpc-test.js); UI = two Eng Calc tabs. Constants carry status and source. */
(function () {
  'use strict';
  function num(x) { var n = Number(x); return isFinite(n) ? n : NaN; }
  function pos(x) { return isFinite(x) && x > 0; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r3(x) { return Math.round(x * 1000) / 1000; }

  var SRC = {
    sera: { id: 'sera_power_factor_tariff', status: 'verified_secondary', source: 'https://www.sera.gov.sa/ar/consumer/electric-tariff/electric-tariff-categories/power-factor-tariff' },
    k54: { id: 'iec_60364_5_54_annex_a_k_pe', status: 'verified_secondary', source: 'https://www.electrical-installation.org/enwiki/Sizing_of_protective_earthing_conductor (Fig G60, from the applicable standard; source not recorded)' },
    s542: { id: 'iec_60364_5_54_min_pe_simplified', status: 'verified_secondary', source: 'https://www.electrical-installation.org/enwiki/Sizing_of_protective_earthing_conductor (Fig G59, from the applicable standard; source not recorded)' },
    std: { id: 'iec_60228_standard_sizes', status: 'from_memory_needs_review', source: 'Preferred conductor sizes of the applicable standard, listed from memory: confirm against the cable catalogue' },
    bank: { id: 'capacitor_bank_steps', status: 'from_memory_needs_review', source: 'Common capacitor bank step sizes, from memory: confirm with the manufacturer catalogue' }
  };
  /* k for protective conductors: [insulated/bare in contact, multicore core] x [PVC, XLPE/EPR] */
  var K = { Cu: { insulated: { PVC: 143, XLPE: 176 }, multicore: { PVC: 115, XLPE: 143 } }, Al: { insulated: { PVC: 95, XLPE: 116 }, multicore: { PVC: 76, XLPE: 94 } } };
  var SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
  var BANK = [5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500, 600, 800, 1000];
  var TARIFF_PF = 0.95;

  function warnFor(used, extra) {
    var w = (extra || []).slice();
    used.forEach(function (u) { if (!/^verified/.test(u.status)) w.push('الثابت ' + u.id + ' حالته ' + u.status + ': راجعه قبل الاعتماد.'); });
    return w;
  }
  function nextStd(list, x) { for (var i = 0; i < list.length; i++) if (list[i] >= x - 1e-9) return list[i]; return null; }

  /* input: {pKW, pfExisting, pfTarget (0.95), voltageV (400)} */
  function pfc(input) {
    var o = input || {}, P = num(o.pKW), pf1 = num(o.pfExisting), pf2 = (o.pfTarget === undefined || o.pfTarget === null || o.pfTarget === '') ? TARIFF_PF : num(o.pfTarget), V = (o.voltageV === undefined || o.voltageV === null || o.voltageV === '') ? 400 : num(o.voltageV);
    if (!pos(P)) throw new Error('ادخل Load الفعال P (kW) أكبر من صفر.');
    if (!(pf1 > 0 && pf1 <= 1)) throw new Error('ادخل PF الحالي بين 0 و 1.');
    if (!(pf2 > 0 && pf2 <= 1)) throw new Error('ادخل PF المستهدف بين 0 و 1.');
    if (!pos(V)) throw new Error('Voltage غير صالح: لازم يكون أكبر من صفر. سيبه فاضي لو عايز القيمة الافتراضية 400 V.');
    var steps = [], extra = [], used = [SRC.sera, SRC.bank];
    var t1 = Math.tan(Math.acos(pf1)), t2 = Math.tan(Math.acos(pf2));
    var S1 = P / pf1, S2 = P / pf2, Q1 = P * t1, Q2 = P * t2;
    steps.push({ step: 'Power الظاهرة و Reactance الحالية', formula: 'S = P / PF ; Q = P x tan(acos(PF))', substitution: 'S = ' + r1(P) + ' / ' + pf1 + ' ; tan = ' + r3(t1), result: 'S1 = ' + r1(S1) + ' kVA | Q1 = ' + r1(Q1) + ' kVAR', value: Q1, unit: 'kVAR' });
    var Qc = P * (t1 - t2);
    if (Qc <= 0) {
      extra.push('PF الحالي ' + pf1 + ' أعلى من أو يساوي المستهدف ' + pf2 + ': مفيش تعويض مطلوب.');
      Qc = 0;
    }
    steps.push({ step: 'Capacitor Rating المطلوبة', formula: 'Qc = P x (tan(phi1) - tan(phi2))', substitution: r1(P) + ' x (' + r3(t1) + ' - ' + r3(t2) + ')', result: r1(Qc) + ' kVAR', value: Qc, unit: 'kVAR' });
    var std = Qc > 0 ? nextStd(BANK, Qc) : 0;
    if (Qc > 0 && std === null) { extra.push('Required Capacity أكبر من أكبر خطوة في القايمة: قسّمها على أكتر من بنك.'); }
    steps.push({ step: 'أقرب خطوة بنك أعلى', formula: 'أول قيمة من قايمة الخطوات >= Qc', substitution: 'Qc = ' + r1(Qc) + ' kVAR', result: (std === null ? 'خارج القايمة' : std + ' kVAR') + ' (القايمة needs_review، تأكد من كتالوج المصنع)', value: std, unit: 'kVAR' });
    var I1 = S1 * 1000 / (Math.sqrt(3) * V), I2 = S2 * 1000 / (Math.sqrt(3) * V);
    steps.push({ step: 'Current قبل وبعد التعويض', formula: 'I = S x 1000 / (sqrt(3) x V)', substitution: 'S1 = ' + r1(S1) + ' kVA ; S2 = ' + r1(S2) + ' kVA ; V = ' + V + ' V', result: 'قبل ' + r1(I1) + ' A | بعد ' + r1(I2) + ' A | تخفيض ' + r1((1 - I2 / I1) * 100) + ' %', value: I2, unit: 'A' });
    var Sfinal = std ? Math.sqrt(P * P + Math.pow(Q1 - std, 2)) : S1, pfFinal = P / Sfinal;
    if (std) steps.push({ step: 'PF الفعلي بعد تركيب الخطوة القياسية', formula: 'PF = P / sqrt(P^2 + (Q1 - Qstd)^2)', substitution: 'Q1 - Qstd = ' + r1(Q1 - std) + ' kVAR', result: r3(pfFinal), value: pfFinal });
    if (std && Q1 - std < 0) extra.push('الخطوة القياسية أكبر من Reactance الحالية: ممكن يحصل over-compensation (PF leading) عند Load الخفيف. استخدم بنك automatic بخطوات.');
    var capK = num(o.capKVAR), capI = null;
    if (o.capKVAR !== undefined && o.capKVAR !== null && o.capKVAR !== '' && !pos(capK)) throw new Error('Capacitor kVAR غير صالح (' + o.capKVAR + '): لازم يكون أكبر من صفر. سيبه فاضي لو مش محتاج Current البنك.');
    if (pos(capK)) {
      capI = capK * 1000 / (Math.sqrt(3) * V);
      steps.push({ step: 'Current البنك (اختياري)', formula: 'Ic = kVAR x 1000 / (sqrt(3) x V)', substitution: capK + ' x 1000 / (sqrt(3) x ' + V + ')', result: r2(capI) + ' A (3-phase, needs_review)', value: capI, unit: 'A' });
      extra.push('Current البنك المدخل: ' + r2(capI) + ' A عند ' + V + ' V (3-phase). حساب مساعد، needs_review.');
    }
    extra.push('التعريفة: SERA بتحدد PF (0.95) أو أعلى بدون رسوم، وأقل من 0.95 بتتحاسب رسوم إضافية (5 هللة لكل ك.فار.س إضافي حسب صفحة التعريفة). تأكد من التعريفة السارية وقت التصميم.');
    extra.push('لو فيه harmonics (VFD، UPS، LED): استخدم بنك detuned reactor (مثلا 5.67 %) ومتركبش Capacitors عادية بدون قياس THD.');
    return { ok: Qc >= 0, Qc: r1(Qc), qcKVAR: r1(Qc), standardKVAR: std, currentBeforeA: r1(I1), currentAfterA: r1(I2), capacitorCurrentA: capI === null ? null : r2(capI), pfFinal: r3(pfFinal), steps: steps, tablesUsed: used, warnings: warnFor(used, extra),
      summary: 'تعويض PF من ' + pf1 + ' إلى ' + pf2 + ': Qc = ' + r1(Qc) + ' kVAR' + (std ? ' (بنك ' + std + ' kVAR)' : '') + ' | I من ' + r1(I1) + ' إلى ' + r1(I2) + ' A' };
  }

  /* input: {currentA | iscKA, timeS | letThroughKA2s, conductor:'Cu'|'Al', insulation:'PVC'|'XLPE', kind:'insulated'|'multicore', phaseMm2, separated:'none'|'protected'|'unprotected'} */
  function cpc(input) {
    var o = input || {}, cond = String(o.conductor || 'Cu').toLowerCase() === 'al' ? 'Al' : 'Cu', ins = String(o.insulation || 'XLPE').toUpperCase() === 'PVC' ? 'PVC' : 'XLPE', kind = o.kind === 'insulated' ? 'insulated' : 'multicore';
    var I = pos(num(o.iscKA)) ? num(o.iscKA) * 1000 : num(o.currentA), t = num(o.timeS), lt = num(o.letThroughKA2s);
    var steps = [], extra = [], used = [SRC.k54, SRC.s542, SRC.std];
    var i2t, basis;
    if (pos(lt)) { i2t = lt * 1e6; basis = 'datasheet'; }
    else {
      if (!pos(I) || !pos(t)) throw new Error('ادخل Current العطل (A أو kA) وزمن القطع (s)، أو I2t من بيانات Breaker.');
      i2t = I * I * t; basis = 'time';
    }
    var k = K[cond][kind][ins];
    steps.push({ step: 'طاقة العطل', formula: basis === 'datasheet' ? 'I2t = القيمة المدخلة من بيانات Breaker' : 'I2t = I^2 x t', substitution: basis === 'datasheet' ? r3(lt) + ' kA2s x 10^6' : r1(I) + '^2 x ' + t, result: r2(i2t / 1e6) + ' x 10^6 A2s', value: i2t, unit: 'A2s' });
    steps.push({ step: 'Constant k لـ Earthing Conductor', formula: 'k من المعيار المطبق (' + cond + ', ' + ins + ', ' + (kind === 'insulated' ? 'Conductor معزول منفصل / عاري' : 'جزء من Cable multicore') + ')', substitution: cond + ' / ' + ins + ' / ' + kind, result: 'k = ' + k, value: k });
    var Sad = Math.sqrt(i2t) / k;
    steps.push({ step: 'أقل Cross-section بالمعادلة الأديباتيكية', formula: 'S = sqrt(I^2 t) / k', substitution: 'sqrt(' + r2(i2t / 1e6) + ' x 10^6) / ' + k, result: r2(Sad) + ' mm2', value: Sad, unit: 'mm2' });
    var minMech = o.separated === 'unprotected' ? 4 : (o.separated === 'protected' ? 2.5 : 0);
    var Sph = num(o.phaseMm2), Ssimple = null;
    if (pos(Sph)) {
      Ssimple = Sph <= 16 ? Sph : (Sph <= 35 ? 16 : Sph / 2);
      steps.push({ step: 'الطريقة المبسطة (جدول 54.2)', formula: 'Sph <= 16: S = Sph ; 16 < Sph <= 35: 16 ; Sph > 35: Sph / 2', substitution: 'Sph = ' + Sph + ' mm2 (نفس خامة Conductor)', result: r2(Ssimple) + ' mm2', value: Ssimple, unit: 'mm2' });
      extra.push('الطريقة المبسطة صالحة فقط لو Earthing Conductor من نفس خامة Conductor الفاز. لو مختلفة اعتمد الأديباتيكية أو صحح بالتوصيلية.');
    }
    var need = Math.max(Sad, minMech);
    if (minMech) steps.push({ step: 'الحد الأدنى الميكانيكي (Earthing Conductor منفصل عن الفازات)', formula: o.separated === 'unprotected' ? '4 mm2 لو غير محمي ميكانيكيا' : '2.5 mm2 لو محمي ميكانيكيا', substitution: o.separated === 'unprotected' ? 'غير محمي' : 'محمي', result: minMech + ' mm2', value: minMech, unit: 'mm2' });
    var sel = nextStd(SIZES, need);
    steps.push({ step: 'Cross-section القياسي المختار', formula: 'أول Cross-section قياسي >= أكبر من (الأديباتيكي، الحد الميكانيكي)', substitution: r2(need) + ' mm2', result: (sel === null ? 'خارج القايمة' : sel + ' mm2'), value: sel, unit: 'mm2' });
    if (Ssimple !== null) {
      var final = Math.max(sel || 0, 0);
      if (Ssimple > (sel || 0)) extra.push('Cross-section من الطريقة المبسطة (' + r2(Ssimple) + ' mm2) أكبر من الأديباتيكي: اعتمد الأكبر لو محتاج تقليل impedance حلقة العطل (TN).');
    }
    if (basis === 'time' && pos(t) && t > 5) extra.push('زمن القطع أكبر من 5 ثواني: المعادلة الأديباتيكية غير صالحة.');
    if (basis === 'time' && pos(t) && t < 0.1) extra.push('زمن القطع أقل من 0.1 ثانية: استخدم I2t الفعلي لـ Breaker من بيانات المصنع.');
    extra.push('Earth-fault Current ممكن يكون أقل من Isc ثلاثي الفاز: استخدم Current earth-fault الفعلي لو متاح، وإلا النتيجة محافظة.');
    return { ok: true, adiabaticMm2: r2(Sad), simplifiedMm2: Ssimple === null ? null : r2(Ssimple), selectedMm2: sel, k: k, i2t: i2t, basis: basis, steps: steps, tablesUsed: used, warnings: warnFor(used, extra),
      summary: 'Earthing Conductor: S = sqrt(I2t)/k = ' + r2(Sad) + ' mm2 (k = ' + k + ') | Cross-section القياسي ' + (sel === null ? 'خارج القايمة' : sel + ' mm2') + (Ssimple === null ? '' : ' | المبسطة ' + r2(Ssimple) + ' mm2') };
  }

  window.EngPfcCpc = { pfc: pfc, cpc: cpc, constants: { K: K, SIZES: SIZES, BANK: BANK, sources: SRC } };

  /* ---------------- UI ---------------- */
  /* Eng Calc rebuilds a tab when you switch to it, so remember what was typed in the Short-circuit tab. */
  var scMemo = {};
  if (typeof document !== 'undefined') {
    var remember = function (e) { var t = e && e.target; if (t && t.id && t.id.indexOf('ec-sc-') === 0) scMemo[t.id] = t.value; };
    document.addEventListener('input', remember, true);
    document.addEventListener('change', remember, true);
  }

  function register() {
    if (typeof document === 'undefined' || !window.EngUI || typeof window.EngUI.registerTab !== 'function') return false;
    var h = window.EngUI.helpers, el = h.el;
    function pdfFn(title, res) { return function () { return window.EngPDF && window.EngPDF.docFromResult ? window.EngPDF.docFromResult(title, res) : null; }; }
    window.EngUI.registerTab('pfc', 'PFC', function (body) {
      body.appendChild(el('div', 'ec-summary', 'تعويض Power Factor: Qc = P x (tan phi1 - tan phi2). الافتراضي PF مستهدف 0.95 (حد تعريفة SERA).'));
      var g = el('div', 'ec-grid');
      g.appendChild(h.createField('pfc-p', 'Active load P (kW)', 'number', ''));
      g.appendChild(h.createField('pfc-pf1', 'Existing PF', 'number', 0.8));
      g.appendChild(h.createField('pfc-pf2', 'Target PF', 'number', 0.95));
      g.appendChild(h.createField('pfc-v', 'Voltage (V)', 'number', 400));
      g.appendChild(h.createField('pfc-cap', 'Capacitor bank (kVAR) - optional, for current', 'number', ''));
      body.appendChild(g);
      var row = el('div', 'ec-actions'), btn = el('button', 'ec-btn', 'Calculate PFC kVAR'); btn.type = 'button'; row.appendChild(btn); body.appendChild(row);
      var out = el('div', null), status = el('div', 'ec-status'); body.appendChild(out); body.appendChild(status);
      btn.addEventListener('click', function () {
        out.innerHTML = ''; status.textContent = '';
        try {
          var res = pfc({ pKW: h.numVal('pfc-p'), pfExisting: h.numVal('pfc-pf1'), pfTarget: h.numVal('pfc-pf2'), voltageV: h.numVal('pfc-v'), capKVAR: h.numVal('pfc-cap') });
          h.showResult(out, res, 'PFC kVAR');
          h.renderResultActions(out, status, pdfFn('PFC kVAR', res));
        } catch (e) { status.textContent = 'تعذر الحساب: ' + (e && e.message ? e.message : e); }
      });
    });
    window.EngUI.registerTab('cpc', 'CPC', function (body) {
      body.appendChild(el('div', 'ec-summary', 'Earthing Conductor Cross-section: S = sqrt(I2t) / k. ممكن تسحب القيم من تاب Short-circuit.'));
      var g = el('div', 'ec-grid');
      g.appendChild(h.createField('cpc-i', 'Fault current (kA)', 'number', ''));
      g.appendChild(h.createField('cpc-t', 'Clearing time (s)', 'number', ''));
      g.appendChild(h.createField('cpc-lt', 'OR breaker let-through I2t (kA2s)', 'number', ''));
      g.appendChild(h.createField('cpc-cond', 'Conductor', 'select', [{ value: 'Cu', label: 'Copper (Cu)', selected: true }, { value: 'Al', label: 'Aluminium (Al)' }]));
      g.appendChild(h.createField('cpc-ins', 'Insulation', 'select', [{ value: 'XLPE', label: 'XLPE / EPR', selected: true }, { value: 'PVC', label: 'PVC' }]));
      g.appendChild(h.createField('cpc-kind', 'CPC type', 'select', [{ value: 'multicore', label: 'Core of a multicore cable', selected: true }, { value: 'insulated', label: 'Separate insulated / bare in contact' }]));
      g.appendChild(h.createField('cpc-sph', 'Phase conductor (mm2) for simplified method', 'number', ''));
      g.appendChild(h.createField('cpc-sep', 'Separate from phase cable?', 'select', [{ value: 'none', label: 'No (same cable)', selected: true }, { value: 'protected', label: 'Yes, mechanically protected' }, { value: 'unprotected', label: 'Yes, not protected' }]));
      body.appendChild(g);
      var row = el('div', 'ec-actions'), pull = el('button', 'ec-btn ec-btn-sec', 'Use Short-circuit tab values'), btn = el('button', 'ec-btn', 'Size CPC');
      pull.type = 'button'; btn.type = 'button'; row.appendChild(pull); row.appendChild(btn); body.appendChild(row);
      var out = el('div', null), status = el('div', 'ec-status'); body.appendChild(out); body.appendChild(status);
      function setv(id, v) { var n = document.getElementById(id); if (n && v !== undefined && v !== '') n.value = v; }
      pull.addEventListener('click', function () {
        var g2 = function (id) { var n = document.getElementById(id); return n ? n.value : scMemo[id]; };
        if (g2('ec-sc-isc') === undefined && g2('ec-sc-size') === undefined) { status.textContent = 'ادخل القيم في تاب Short-circuit الأول.'; return; }
        setv('cpc-i', g2('ec-sc-isc')); setv('cpc-t', g2('ec-sc-t')); setv('cpc-lt', g2('ec-sc-lt')); setv('cpc-cond', g2('ec-sc-cond')); setv('cpc-ins', g2('ec-sc-ins')); setv('cpc-sph', g2('ec-sc-size'));
        status.textContent = 'تم سحب القيم من تاب Short-circuit. راجع زمن القطع: لازم يكون زمن قطع عطل الأرض.';
      });
      btn.addEventListener('click', function () {
        out.innerHTML = ''; status.textContent = '';
        try {
          var res = cpc({ iscKA: h.numVal('cpc-i'), timeS: h.numVal('cpc-t'), letThroughKA2s: h.numVal('cpc-lt'), conductor: h.val('cpc-cond'), insulation: h.val('cpc-ins'), kind: h.val('cpc-kind'), phaseMm2: h.numVal('cpc-sph'), separated: h.val('cpc-sep') });
          h.showResult(out, res, 'CPC sizing');
          h.renderResultActions(out, status, pdfFn('CPC sizing', res));
        } catch (e) { status.textContent = 'تعذر الحساب: ' + (e && e.message ? e.message : e); }
      });
    });
    return true;
  }
  if (typeof document !== 'undefined') { if (!register()) { var n = 0, iv = setInterval(function () { if (register() || ++n > 40) clearInterval(iv); }, 250); } }
})();
