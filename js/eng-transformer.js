(function () {
  'use strict';

  var AR_WARNING = 'تحذير: حسابات حجم المحول وتيار القصر (Isc = Is / Z%) تعتمد على ثوابت إرشادية (needs_review) وتقريب المصدر اللانهائي (Infinite Bus) دون احتساب ممانعة الشبكة الأمامية أو مساهمة المحركات. يلزم التحقق من شركة الكهرباء ودراسة القصر التفصيلية قبل الاعتماد.';

  var CONSTANTS = {
    standardRatingsKva: { value: [50, 100, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150], unit: 'kVA', status: 'needs_review', source_url: null, source_note: 'السعات القياسية الشائعة للمحولات ثلاثية الطور؛ تُراجع مع شركة الكهرباء والمورد' },
    defaultTargetLoadPct: { value: 80, unit: '%', status: 'needs_review', source_url: null, source_note: 'نسبة التحميل التصميمية الإرشادية (80%) لتحقيق الكفاءة وعمر تشغيلي مناسب' },
    defaultImpedancePct: { value: 5.0, unit: '%', status: 'needs_review', source_url: null, source_note: 'نسبة المعاوقة الإرشادية Z%؛ تُراجع من لوحة بيانات المحول (Nameplate)' },
    defaultVPrimary: { value: 13800, unit: 'V', status: 'needs_review', source_url: null, source_note: 'جهد ابتدائي افتراضي 13.8 kV؛ يُعدل حسب جهد شبكة التوزيع المحلية' },
    defaultVSecondary: { value: 400, unit: 'V', status: 'needs_review', source_url: null, source_note: 'جهد ثانوي افتراضي 400 V ثلاثي الطور؛ يُعدل حسب النظام المعتمد' }
  };

  function calculate(inp) {
    var demandKva = Number(inp.demandKva);
    var growthPct = Number(inp.growthPct || 0);
    var sparePct = Number(inp.sparePct || 0);
    var targetLoadPct = Number(inp.targetLoadPct || CONSTANTS.defaultTargetLoadPct.value);
    var vPrimary = Number(inp.vPrimary || CONSTANTS.defaultVPrimary.value);
    var vSecondary = Number(inp.vSecondary || CONSTANTS.defaultVSecondary.value);
    var impedancePct = Number(inp.impedancePct || CONSTANTS.defaultImpedancePct.value);

    if (!(demandKva > 0 && targetLoadPct > 0 && targetLoadPct <= 100 && vPrimary > 0 && vSecondary > 0 && impedancePct > 0) || growthPct < 0 || sparePct < 0) {
      return { ok: false, error: 'أدخل قيماً موجبة صحيحة للحمل المطلوب ونسبة التحميل والجهود ونسبة المعاوقة Z%.' };
    }

    var designKva = demandKva * (1 + growthPct / 100) * (1 + sparePct / 100);
    var requiredRatingKva = designKva / (targetLoadPct / 100);

    var stdList = CONSTANTS.standardRatingsKva.value;
    var stdKva = stdList[stdList.length - 1];
    var fitsStandard = false;
    for (var i = 0; i < stdList.length; i++) {
      if (stdList[i] >= requiredRatingKva) {
        stdKva = stdList[i];
        fitsStandard = true;
        break;
      }
    }

    var actualLoadPct = (designKva / stdKva) * 100;
    var iPrimary = (stdKva * 1000) / (Math.sqrt(3) * vPrimary);
    var iSecondary = (stdKva * 1000) / (Math.sqrt(3) * vSecondary);
    var iscApproxKa = (iSecondary / (impedancePct / 100)) / 1000;

    var warnings = [AR_WARNING];
    if (!fitsStandard) {
      warnings.push('تحذير: السعة المطلوبة (' + requiredRatingKva.toFixed(1) + ' kVA) تتجاوز أكبر مقاس قياسي في القائمة (' + stdKva + ' kVA)؛ يلزم استخدام أكثر من محول.');
    }

    return {
      ok: true,
      summary: 'المقاس القياسي ' + stdKva + ' kVA | الحمل التصميمي ' + designKva.toFixed(1) + ' kVA (' + actualLoadPct.toFixed(1) + '%) | Ip=' + iPrimary.toFixed(1) + ' A | Is=' + iSecondary.toFixed(1) + ' A | Isc≈' + iscApproxKa.toFixed(2) + ' kA (Infinite Bus)',
      demandKva: demandKva,
      designKva: designKva,
      requiredRatingKva: requiredRatingKva,
      stdKva: stdKva,
      actualLoadPct: actualLoadPct,
      iPrimary: iPrimary,
      iSecondary: iSecondary,
      iscApproxKa: iscApproxKa,
      warnings: warnings,
      constants: CONSTANTS,
      steps: [
        { step: 'الحمل التصميمي بعد النمو والاحتياطي', formula: 'S = D × (1 + g/100) × (1 + s/100)', substitution: demandKva + ' × (1 + ' + growthPct + '/100) × (1 + ' + sparePct + '/100)', result: designKva.toFixed(2) + ' kVA' },
        { step: 'السعة المطلوبة عند التحميل المستهدف', formula: 'S_req = S / (load% / 100)', substitution: designKva.toFixed(2) + ' / ' + (targetLoadPct / 100).toFixed(2), result: requiredRatingKva.toFixed(2) + ' kVA' },
        { step: 'المقاس القياسي', formula: 'أول مقاس قياسي >= S_req ; Load% = S / S_std', substitution: 'S_std = ' + stdKva + ' kVA', result: stdKva + ' kVA (تحميل فعلي ' + actualLoadPct.toFixed(1) + '%)' },
        { step: 'التيار الابتدائي', formula: 'Ip = S_std × 1000 / (√3 × Vp)', substitution: stdKva + ' × 1000 / (√3 × ' + vPrimary + ')', result: iPrimary.toFixed(2) + ' A' },
        { step: 'التيار الثانوي', formula: 'Is = S_std × 1000 / (√3 × Vs)', substitution: stdKva + ' × 1000 / (√3 × ' + vSecondary + ')', result: iSecondary.toFixed(2) + ' A' },
        { step: 'تيار القصر التقريبي (Infinite Bus)', formula: 'Isc = Is / (Z% / 100)', substitution: iSecondary.toFixed(1) + ' A / ' + (impedancePct / 100).toFixed(4) + ' = ' + (iscApproxKa * 1000).toFixed(0) + ' A', result: iscApproxKa.toFixed(2) + ' kA' }
      ],
      extra: [
        { k: 'الحمل التصميمي (kVA)', v: designKva.toFixed(1) + ' kVA' },
        { k: 'المقاس القياسي للمحول', v: stdKva + ' kVA' },
        { k: 'نسبة التحميل الفعلية', v: actualLoadPct.toFixed(1) + '%' },
        { k: 'تيار الابتدائي (Ip)', v: iPrimary.toFixed(2) + ' A' },
        { k: 'تيار الثانوي (Is)', v: iSecondary.toFixed(2) + ' A' },
        { k: 'تيار القصر التقريبي (Infinite Bus)', v: iscApproxKa.toFixed(2) + ' kA (Isc = Is / Z%)' }
      ],
      used: [
        'demandKva=' + demandKva + ', growthPct=' + growthPct + '%, sparePct=' + sparePct + '%, targetLoadPct=' + targetLoadPct + '%',
        'vPrimary=' + vPrimary + 'V, vSecondary=' + vSecondary + 'V, Z%=' + impedancePct + '%',
        'تحذير: ' + warnings.join(' | ')
      ]
    };
  }

  function pdfDoc(title, res) {
    if (window.EngPDF && typeof window.EngPDF.docFromResult === 'function') {
      return window.EngPDF.docFromResult(title, res);
    }
    return { title: title, subtitle: res && res.summary ? res.summary : '', blocks: [] };
  }

  function pdfFn(title, res) {
    return function () { return pdfDoc(title, res); };
  }

  function register() {
    if (!window.EngUI || !window.EngUI.registerTab || !window.EngUI.helpers) return false;
    var h = window.EngUI.helpers;
    window.EngUI.registerTab('transformer', 'Transformer', function (body) { var panel = body;
        panel.appendChild(h.el('div', 'ec-note', AR_WARNING));
        var grid = h.el('div', 'ec-grid');
        grid.appendChild(h.createField('tr-dem', 'Demand Load (demandKva)', 'number', '650'));
        grid.appendChild(h.createField('tr-gro', 'Future Growth (growthPct %)', 'number', '10'));
        grid.appendChild(h.createField('tr-spr', 'Spare Margin (sparePct %)', 'number', '10'));
        grid.appendChild(h.createField('tr-tgt', 'Target Loading (targetLoadPct %)', 'number', String(CONSTANTS.defaultTargetLoadPct.value)));
        grid.appendChild(h.createField('tr-vp', 'Primary Voltage vPrimary (V)', 'number', String(CONSTANTS.defaultVPrimary.value)));
        grid.appendChild(h.createField('tr-vs', 'Secondary Voltage vSecondary (V)', 'number', String(CONSTANTS.defaultVSecondary.value)));
        grid.appendChild(h.createField('tr-z', 'Impedance (impedancePct %)', 'number', String(CONSTANTS.defaultImpedancePct.value)));
        panel.appendChild(grid);
        var btn = h.el('button', 'ec-btn', 'حساب حجم المحول');
        btn.type = 'button';
        panel.appendChild(btn);
        var out = h.el('div', 'ec-out');
        panel.appendChild(out);
        btn.addEventListener('click', function () {
          var res = calculate({
            demandKva: h.numVal('tr-dem'),
            growthPct: h.numVal('tr-gro'),
            sparePct: h.numVal('tr-spr'),
            targetLoadPct: h.numVal('tr-tgt'),
            vPrimary: h.numVal('tr-vp'),
            vSecondary: h.numVal('tr-vs'),
            impedancePct: h.numVal('tr-z')
          });
          h.showResult(out, res, 'Transformer Sizing');
          if (res.ok) h.renderResultActions(out, 'needs_review', pdfFn('Transformer Sizing', res));
        });
  
    });
    return true;
  }

  window.EngTransformer = {
    CONSTANTS: CONSTANTS,
    calculate: calculate,
    pdfDoc: pdfDoc,
    register: register
  };

  if (typeof document !== 'undefined') {
    if (!register()) {
      var n = 0;
      var iv = setInterval(function () { if (register() || ++n > 40) clearInterval(iv); }, 100);
    }
  }
})();
