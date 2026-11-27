(function () {
  'use strict';

  var AR_WARNING = 'تحذير: الحسابات مبنية على طريقة Lumen التقديرية وثوابت افتراضية (needs_review). يجب مراجعة معامل الاستخدام (UF) من كتالوج الكشاف ومعامل الصيانة (MF) وفق ظروف التشغيل الفعلية قبل الاعتماد التصميمي.';

  var CONSTANTS = {
    defaultTargetLux: { value: 500, unit: 'lux', status: 'needs_review', source_url: null, source_note: 'Illuminance إرشادية للمكاتب؛ تُراجع حسب الكود المعتمد' },
    defaultUF: { value: 0.65, unit: 'ratio', status: 'needs_review', source_url: null, source_note: 'معامل استخدام تقديري (UF) يعتمد على جدول الكشاف ومعامل الغرفة K' },
    defaultMF: { value: 0.80, unit: 'ratio', status: 'needs_review', source_url: null, source_note: 'معامل صيانة تقديري (MF) يعتمد على بيئة المكان وجدول التنظيف' },
    maxSHR: { value: 1.5, unit: 'ratio', status: 'needs_review', source_url: null, source_note: 'أقصى نسبة تباعد إلى ارتفاع (SHR) إرشادية؛ تُراجع من بيانات الشركة المصنعة' }
  };

  function calculate(inp) {
    var L = Number(inp.lengthM);
    var W = Number(inp.widthM);
    var Hm = Number(inp.mountingHeightM);
    var E = Number(inp.targetLux);
    var F = Number(inp.lumensPerFixture);
    var P = Number(inp.wattPerFixture || 0);
    var UF = Number(inp.uf);
    var MF = Number(inp.mf);

    if (!(L > 0 && W > 0 && Hm > 0 && E > 0 && F > 0 && UF > 0 && MF > 0) || P < 0) {
      return { ok: false, error: 'أدخل قيماً موجبة صحيحة للأبعاد والارتفاع و Lighting و Lumen و UF و MF.' };
    }

    var A = L * W;
    var K = (L * W) / (Hm * (L + W));
    var N_exact = (E * A) / (F * UF * MF);
    var N = Math.ceil(N_exact);

    var cols = Math.max(1, Math.round(Math.sqrt(N * (L / W))));
    var rows = Math.ceil(N / cols);
    if (cols * rows < N) cols += 1;
    var N_grid = rows * cols;

    var spacingX = L / cols;
    var spacingY = W / rows;
    var shr = Math.max(spacingX, spacingY) / Hm;
    var actualLux = (N_grid * F * UF * MF) / A;
    var totalWatts = N_grid * P;
    var wPerM2 = totalWatts / A;
    var actualLuxN = (N * F * UF * MF) / A;
    var wPerM2N = (N * P) / A;

    var warnings = [AR_WARNING];
    if (shr > CONSTANTS.maxSHR.value) {
      warnings.push('تحذير: نسبة التباعد إلى الارتفاع (' + shr.toFixed(2) + ') تتجاوز الحد الإرشادي ' + CONSTANTS.maxSHR.value + '؛ قد يحدث عدم تجانس في Lighting.');
    }

    return {
      ok: true,
      summary: 'العدد المطلوب ' + N + ' وحدة | التوزيع الشبكي ' + cols + ' x ' + rows + ' (' + N_grid + ' وحدة) | Actual Illuminance عند N=' + N + ': ' + actualLuxN.toFixed(0) + ' lux (' + wPerM2N.toFixed(2) + ' W/m²) | عند الشبكة ' + N_grid + ': ' + actualLux.toFixed(0) + ' lux (' + wPerM2.toFixed(2) + ' W/m²)',
      A: A, K: K, N_exact: N_exact, N: N, N_grid: N_grid, rows: rows, cols: cols,
      spacingX: spacingX, spacingY: spacingY, shr: shr, actualLux: actualLux, actualLuxN: actualLuxN, wPerM2N: wPerM2N,
      totalWatts: totalWatts, wPerM2: wPerM2, warnings: warnings, constants: CONSTANTS,
      steps: [
        { step: 'مساحة الغرفة', formula: 'A = L × W', substitution: L + ' × ' + W, result: A.toFixed(2) + ' m²' },
        { step: 'معامل الغرفة', formula: 'K = (L × W) / (Hm × (L + W))', substitution: '(' + L + ' × ' + W + ') / (' + Hm + ' × (' + L + ' + ' + W + '))', result: K.toFixed(2) },
        { step: 'عدد الكشافات النظري', formula: 'N = (E × A) / (F × UF × MF)', substitution: '(' + E + ' × ' + A.toFixed(2) + ') / (' + F + ' × ' + UF + ' × ' + MF + ')', result: N_exact.toFixed(2) + ' -> ' + N + ' وحدة' },
        { step: 'التوزيع الشبكي', formula: 'cols × rows >= N ; التباعد = L / cols , W / rows', substitution: cols + ' × ' + rows + ' ; ' + spacingX.toFixed(2) + ' m × ' + spacingY.toFixed(2) + ' m', result: N_grid + ' وحدة (SHR = ' + shr.toFixed(2) + ')' },
        { step: 'Actual Illuminance عند العدد المحسوب (N)', formula: 'E_N = (N × F × UF × MF) / A', substitution: '(' + N + ' × ' + F + ' × ' + UF + ' × ' + MF + ') / ' + A.toFixed(2), result: actualLuxN.toFixed(1) + ' lux' },
        { step: 'Actual Illuminance عند التوزيع الشبكي', formula: 'E_grid = (N_grid × F × UF × MF) / A', substitution: '(' + N_grid + ' × ' + F + ' × ' + UF + ' × ' + MF + ') / ' + A.toFixed(2), result: actualLux.toFixed(1) + ' lux' },
        { step: 'Power Density عند N', formula: 'W/m² = (N × P) / A', substitution: (N * P).toFixed(0) + ' W / ' + A.toFixed(2) + ' m²', result: wPerM2N.toFixed(2) + ' W/m²' },
        { step: 'Power Density عند الشبكة', formula: 'W/m² = (N_grid × P) / A', substitution: totalWatts.toFixed(0) + ' W / ' + A.toFixed(2) + ' m²', result: wPerM2.toFixed(2) + ' W/m²' }
      ],
      extra: [
        { k: 'معامل الغرفة (K)', v: K.toFixed(2) },
        { k: 'عدد الوحدات المحسوب (N)', v: String(N) },
        { k: 'التوزيع الشبكي (أعمدة × صفوف)', v: cols + ' × ' + rows + ' (' + N_grid + ' وحدة)' },
        { k: 'Actual Illuminance عند N (lux)', v: actualLuxN.toFixed(1) + ' lux' },
        { k: 'Power Density عند N (W/m²)', v: wPerM2N.toFixed(2) + ' W/m²' },
        { k: 'Actual Illuminance عند الشبكة (lux)', v: actualLux.toFixed(1) + ' lux' },
        { k: 'Power Density عند الشبكة (W/m²)', v: wPerM2.toFixed(2) + ' W/m²' },
        { k: 'نسبة التباعد للارتفاع (SHR)', v: shr.toFixed(2) }
      ],
      used: [
        'L=' + L + 'm, W=' + W + 'm, Hm=' + Hm + 'm',
        'E=' + E + 'lux, F=' + F + 'lm, UF=' + UF + ', MF=' + MF + ', P=' + P + 'W/unit',
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
    window.EngUI.registerTab('lighting', 'Lighting', function (body) {
      body.appendChild(h.el('div', 'ec-note', AR_WARNING));
        var grid = h.el('div', 'ec-grid');
        grid.appendChild(h.createField('lt-l', 'Room Length L (m)', 'number', '10'));
        grid.appendChild(h.createField('lt-w', 'Room Width W (m)', 'number', '8'));
        grid.appendChild(h.createField('lt-hm', 'Mounting Height Hm (m)', 'number', '2.5'));
        grid.appendChild(h.createField('lt-lux', 'Target Illuminance E (lux)', 'number', String(CONSTANTS.defaultTargetLux.value)));
        grid.appendChild(h.createField('lt-lm', 'Lumens per Fixture F (lm)', 'number', '4000'));
        grid.appendChild(h.createField('lt-watt', 'Watts per Fixture (W)', 'number', '36'));
        grid.appendChild(h.createField('lt-uf', 'Utilization Factor (UF)', 'number', String(CONSTANTS.defaultUF.value)));
        grid.appendChild(h.createField('lt-mf', 'Maintenance Factor (MF)', 'number', String(CONSTANTS.defaultMF.value)));
      body.appendChild(grid);
        var btn = h.el('button', 'ec-btn', 'حساب Lighting (Lumen Method)');
        btn.type = 'button';
      body.appendChild(btn);
        var out = h.el('div', 'ec-out');
      body.appendChild(out);
        btn.addEventListener('click', function () {
          var res = calculate({
            lengthM: h.numVal('lt-l'),
            widthM: h.numVal('lt-w'),
            mountingHeightM: h.numVal('lt-hm'),
            targetLux: h.numVal('lt-lux'),
            lumensPerFixture: h.numVal('lt-lm'),
            wattPerFixture: h.numVal('lt-watt'),
            uf: h.numVal('lt-uf'),
            mf: h.numVal('lt-mf')
          });
          h.showResult(out, res, 'Lighting — Lumen Method');
          if (res.ok) h.renderResultActions(out, 'needs_review', pdfFn('Lighting — Lumen Method', res));
        });
    });
    return true;
  }

  window.EngLighting = {
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
