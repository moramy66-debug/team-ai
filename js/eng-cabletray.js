(function () {
  'use strict';

  var AR_WARNING = 'تحذير: حسابات حامل Cables (Cable Tray) تعتمد على معاملات ملء وتمديد إرشادية (needs_review). يجب مراجعة حدود الملء الفعلية و Thermal Capacity Derating Factors (Grouping/Derating) وفق الكود المعتمد (المعيار المطبق).';

  var CONSTANTS = {
    standardWidthsMm: { value: [50, 75, 100, 150, 200, 300, 450, 600, 750, 900, 1000], unit: 'mm', status: 'needs_review', source_url: null, source_note: 'عروض حوامل Cables القياسية الشائعة؛ تُراجع مع المورد المعتمد' },
    defaultFillLimitPct: { value: 40, unit: '%', status: 'needs_review', source_url: null, source_note: 'نسبة ملء إرشادية شائعة (40%) لترك احتياطي مستقبلي وتهوية' },
    defaultTrayDepthMm: { value: 100, unit: 'mm', status: 'needs_review', source_url: null, source_note: 'عمق حامل قياسي افتراضي 100 mm؛ يُراجع حسب نوع الحامل' },
    singleLayerDiaThresholdMm: { value: 50, unit: 'mm', status: 'needs_review', source_url: null, source_note: 'حد القطر الإرشادي (50 mm) الذي يستلزم التمديد في طبقة واحدة فقط' }
  };

  function calculate(inp) {
    var count = Number(inp.cableCount);
    var d = Number(inp.outerDiaMm);
    function given(x) { return !(x === undefined || x === null || x === ''); }
    var depth = given(inp.trayDepthMm) ? Number(inp.trayDepthMm) : CONSTANTS.defaultTrayDepthMm.value;
    var fillLimitPct = given(inp.fillLimitPct) ? Number(inp.fillLimitPct) : CONSTANTS.defaultFillLimitPct.value;
    var arrangement = inp.arrangement || 'multicore';
    var sparePct = Number(inp.sparePct || 0);

    if (!(count > 0 && d > 0 && depth > 0 && fillLimitPct > 0 && fillLimitPct <= 100) || sparePct < 0) {
      return { ok: false, error: 'أدخل قيماً موجبة صحيحة لعدد Cables والقطر الخارجي وعمق الحامل ونسبة الملء.' };
    }

    var singleCableArea = Math.PI * Math.pow(d / 2, 2);
    var totalCableArea = count * singleCableArea;
    var effectiveArea = totalCableArea * (1 + sparePct / 100);

    var reqWidthByArea = effectiveArea / (depth * (fillLimitPct / 100));
    var arrangementLabel = '';
    var layoutWidthMm = 0;

    if (arrangement === 'single_core') {
      var trefoilGroups = Math.ceil(count / 3);
      layoutWidthMm = trefoilGroups * (2 * d) * (1 + sparePct / 100);
      arrangementLabel = 'أحادي القلب مثلثي (Single-Core Trefoil): ' + trefoilGroups + ' مجموعة';
    } else {
      layoutWidthMm = count * d * (1 + sparePct / 100);
      arrangementLabel = 'متعدد القلوب (Multicore)';
    }

    var requiredWidthMm = Math.max(reqWidthByArea, layoutWidthMm);
    var stdWidths = CONSTANTS.standardWidthsMm.value;
    var stdWidthMm = stdWidths[stdWidths.length - 1];
    var fitsStandard = false;
    for (var i = 0; i < stdWidths.length; i++) {
      if (stdWidths[i] >= requiredWidthMm) {
        stdWidthMm = stdWidths[i];
        fitsStandard = true;
        break;
      }
    }

    var trayCrossArea = stdWidthMm * depth;
    var actualFillPct = (totalCableArea / trayCrossArea) * 100;

    var warnings = [AR_WARNING];
    if (d > CONSTANTS.singleLayerDiaThresholdMm.value) {
      warnings.push('تحذير: قطر Cable (' + d + ' mm) أكبر من ' + CONSTANTS.singleLayerDiaThresholdMm.value + ' mm؛ يجب تمديد Cables في طبقة واحدة (Single Layer) مع تثبيت مناسب ومنع التراكم الحراري.');
    }
    if (!fitsStandard) {
      warnings.push('تحذير: العرض المطلوب (' + requiredWidthMm.toFixed(1) + ' mm) يتجاوز أكبر مقاس قياسي (' + stdWidthMm + ' mm)؛ يلزم تقسيم المسار على أكثر من حامل.');
    }

    return {
      ok: true,
      summary: 'مساحة Cables ' + totalCableArea.toFixed(0) + ' mm² | العرض المطلوب ' + requiredWidthMm.toFixed(1) + ' mm | المقاس القياسي ' + stdWidthMm + ' mm | نسبة الملء الفعلية ' + actualFillPct.toFixed(1) + '%',
      totalCableArea: totalCableArea, singleCableArea: singleCableArea,
      effectiveArea: effectiveArea,
      reqWidthByArea: reqWidthByArea,
      layoutWidthMm: layoutWidthMm,
      requiredWidthMm: requiredWidthMm,
      stdWidthMm: stdWidthMm,
      actualFillPct: actualFillPct,
      arrangement: arrangement,
      warnings: warnings,
      constants: CONSTANTS,
      steps: [
        { step: 'الترتيب المختار', formula: '-', substitution: arrangementLabel, result: '-' },
        { step: 'مساحة Cable الواحد', formula: 'a = π × (D/2)²', substitution: 'π × (' + d + '/2)²', result: singleCableArea.toFixed(1) + ' mm²' },
        { step: 'مساحة Cables Grouped', formula: 'A_total = n × a ; مع الاحتياطي × (1 + spare/100)', substitution: count + ' × ' + singleCableArea.toFixed(1) + ' ; spare ' + sparePct + '%', result: totalCableArea.toFixed(1) + ' mm² (مع الاحتياطي ' + effectiveArea.toFixed(1) + ' mm²)' },
        { step: 'العرض حسب مساحة الملء', formula: 'W = A_eff / (depth × fill%)', substitution: effectiveArea.toFixed(1) + ' / (' + depth + ' × ' + (fillLimitPct / 100).toFixed(2) + ')', result: reqWidthByArea.toFixed(1) + ' mm' },
        { step: 'العرض حسب الترتيب الهندسي', formula: 'Multicore: n × D ; Trefoil: ceil(n/3) × 2D ; × (1 + spare/100)', substitution: arrangementLabel, result: layoutWidthMm.toFixed(1) + ' mm' },
        { step: 'العرض الحاكم والقياسي', formula: 'max(بالمساحة , بالترتيب) -> أول مقاس قياسي >=', substitution: requiredWidthMm.toFixed(1) + ' mm', result: stdWidthMm + ' mm' },
        { step: 'نسبة الملء الفعلية', formula: 'Fill% = A_total / (W_std × depth) × 100', substitution: totalCableArea.toFixed(1) + ' / (' + stdWidthMm + ' × ' + depth + ') × 100', result: actualFillPct.toFixed(2) + '%' }
      ],
      extra: [
        { k: 'نوع التمديد', v: arrangementLabel },
        { k: 'مساحة Cables Grouped', v: totalCableArea.toFixed(1) + ' mm²' },
        { k: 'العرض المطلوب (Tray Width)', v: requiredWidthMm.toFixed(1) + ' mm' },
        { k: 'العرض القياسي المختار', v: stdWidthMm + ' × ' + depth + ' mm' },
        { k: 'نسبة الملء الفعلية', v: actualFillPct.toFixed(2) + '%' }
      ],
      used: [
        'count=' + count + ', D=' + d + 'mm, depth=' + depth + 'mm, fillLimit=' + fillLimitPct + '%, spare=' + sparePct + '%',
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
    window.EngUI.registerTab('cabletray', 'Cable Tray', function (body) { var panel = body;
        panel.appendChild(h.el('div', 'ec-note', AR_WARNING));
        var grid = h.el('div', 'ec-grid');
        grid.appendChild(h.createField('ct-arr', 'Cable Arrangement', 'select', [
          { value: 'multicore', label: 'Multicore (Cables متعددة القلوب)', selected: true },
          { value: 'single_core', label: 'Single-Core Trefoil (أحادي القلب مثلثي)' }
        ]));
        grid.appendChild(h.createField('ct-cnt', 'Number of Cables', 'number', '6'));
        grid.appendChild(h.createField('ct-dia', 'Outer Diameter D (mm)', 'number', '32'));
        grid.appendChild(h.createField('ct-dep', 'Tray Depth (mm)', 'number', String(CONSTANTS.defaultTrayDepthMm.value)));
        grid.appendChild(h.createField('ct-fill', 'Max Fill Limit (%)', 'number', String(CONSTANTS.defaultFillLimitPct.value)));
        grid.appendChild(h.createField('ct-spare', 'Future Spare (%)', 'number', '20'));
        panel.appendChild(grid);
        var btn = h.el('button', 'ec-btn', 'Calculate Cable Tray Size');
        btn.type = 'button';
        panel.appendChild(btn);
        var out = h.el('div', 'ec-out');
        panel.appendChild(out);
        btn.addEventListener('click', function () {
          var res = calculate({
            arrangement: h.val('ct-arr'),
            cableCount: h.numVal('ct-cnt'),
            outerDiaMm: h.numVal('ct-dia'),
            trayDepthMm: h.numVal('ct-dep'),
            fillLimitPct: h.numVal('ct-fill'),
            sparePct: h.numVal('ct-spare')
          });
          out.innerHTML = '';
          h.showResult(out, res, 'Cable Tray Sizing');
          if (res.ok) h.renderResultActions(out, 'needs_review', pdfFn('Cable Tray Sizing', res));
        });
  
    });
    return true;
  }

  window.EngCableTray = {
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
