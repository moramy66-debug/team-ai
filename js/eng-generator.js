(function () {
  'use strict';

  var AR_WARNING = 'تحذير: حسابات حجم المولد وتخفيض القدرة (Derating) ونسبة هبوط الجهد التقريبية (Voltage Dip) تعتمد على معاملات إرشادية (needs_review). يجب التحقق من منحنيات الشركة المصنعة للمولد (ISO 8528) وخصائص بدء المحرك الفعلية قبل الاعتماد.';

  var CONSTANTS = {
    standardRatingsKva: { value: [20, 30, 45, 60, 80, 100, 125, 150, 200, 250, 300, 350, 400, 500, 625, 750, 800, 1000, 1250, 1500, 2000, 2500], unit: 'kVA', status: 'needs_review', source_url: null, source_note: 'السعات القياسية الشائعة لمجموعات التوليد؛ تُراجع مع كتالوج الشركة المصنعة' },
    startingMultipliers: {
      value: { 'DOL': 6.0, 'Star-Delta': 2.0, 'Soft-Starter': 3.0, 'VFD': 1.25 },
      unit: 'xFLC',
      status: 'needs_review',
      source_url: null,
      source_note: 'مضاعفات تيار/قدرة البدء التقريبية لطرق بدء المحركات؛ تُراجع من بيانات المحرك والبادئ'
    },
    motorEfficiency: { value: 0.90, unit: 'ratio', status: 'needs_review', source_url: null, source_note: 'كفاءة/معامل تحويل تقديري للمحرك لحساب kVA البدء' },
    xdSubtransientPct: { value: 15, unit: '%', status: 'needs_review', source_url: null, source_note: 'الممانعة العابرة التحتية التقريبية للمولد Xd" (15%) لحساب هبوط الجهد التقريبي' },
    maxRecommendedDipPct: { value: 15, unit: '%', status: 'needs_review', source_url: null, source_note: 'حد هبوط الجهد اللحظي الإرشادي (15%) عند بدء أكبر محرك' },
    altitudeBaseM: { value: 1000, unit: 'm', status: 'needs_review', source_url: null, source_note: 'الارتفاع المرجعي قبل التخفيض (1000 m)، مع تخفيض تقديري 1% لكل 100 m إضافية' },
    tempBaseC: { value: 40, unit: 'C', status: 'needs_review', source_url: null, source_note: 'درجة الحرارة المرجعية (40°C)، مع تخفيض تقديري 0.5% لكل 1°C إضافية' }
  };

  function calculate(inp) {
    var contKw = Number(inp.continuousKw);
    var pf = Number(inp.pf || 0.8);
    var motorKw = Number(inp.largestMotorKw || 0);
    var startMethod = inp.startMethod || 'DOL';
    var altM = Number(inp.altitudeM || 0);
    var tempC = Number(inp.ambientTempC || 40);
    var sparePct = Number(inp.sparePct || 0);

    var multMap = CONSTANTS.startingMultipliers.value;
    var mult = multMap[startMethod] || multMap['DOL'];

    if (!(contKw > 0 && pf > 0 && pf <= 1) || motorKw < 0 || altM < 0 || sparePct < 0) {
      return { ok: false, error: 'أدخل قيماً موجبة صحيحة للأحمال المستمرة (kW) ومعامل القدرة PF (بين 0 و 1) وبقية المدخلات.' };
    }

    var runningKva = contKw / pf;
    var motorStartKva = motorKw > 0 ? (motorKw / CONSTANTS.motorEfficiency.value) * mult : 0;
    var runningWithSpareKva = runningKva * (1 + sparePct / 100);
    var stepLoadKva = runningKva + motorStartKva;
    var requiredSiteKva = Math.max(runningWithSpareKva, stepLoadKva);

    var altDeratePct = altM > CONSTANTS.altitudeBaseM.value ? ((altM - CONSTANTS.altitudeBaseM.value) / 100) * 1.0 : 0;
    var tempDeratePct = tempC > CONSTANTS.tempBaseC.value ? (tempC - CONSTANTS.tempBaseC.value) * 0.5 : 0;
    var totalDeratePct = Math.min(50, altDeratePct + tempDeratePct);
    var deratingFactor = 1 - totalDeratePct / 100;

    var requiredIsoKva = requiredSiteKva / deratingFactor;

    var stdList = CONSTANTS.standardRatingsKva.value;
    var stdKva = stdList[stdList.length - 1];
    var fitsStandard = false;
    for (var i = 0; i < stdList.length; i++) {
      if (stdList[i] >= requiredIsoKva) {
        stdKva = stdList[i];
        fitsStandard = true;
        break;
      }
    }

    var stdSiteKva = stdKva * deratingFactor;
    var xd = CONSTANTS.xdSubtransientPct.value;
    var voltageDipPct = motorStartKva > 0 ? (motorStartKva * xd) / (stdSiteKva + motorStartKva * (xd / 100)) : 0;

    var warnings = [AR_WARNING];
    if (voltageDipPct > CONSTANTS.maxRecommendedDipPct.value) {
      warnings.push('تحذير: نسبة هبوط الجهد التقريبية (' + voltageDipPct.toFixed(1) + '%) تتجاوز الحد الإرشادي ' + CONSTANTS.maxRecommendedDipPct.value + '%؛ يُنصح بتغيير طريقة البدء أو زيادة سعة المولد.');
    }
    if (!fitsStandard) {
      warnings.push('تحذير: السعة المطلوبة (' + requiredIsoKva.toFixed(1) + ' kVA) تتجاوز أكبر مقاس قياسي (' + stdKva + ' kVA)؛ يلزم تشغيل مولدات على التوازي.');
    }

    return {
      ok: true,
      summary: 'المقاس القياسي ' + stdKva + ' kVA | المطلوب بعد Derating ' + requiredIsoKva.toFixed(1) + ' kVA | هبوط الجهد التقريبي ' + voltageDipPct.toFixed(1) + '%',
      runningKva: runningKva,
      motorStartKva: motorStartKva,
      requiredSiteKva: requiredSiteKva,
      deratingFactor: deratingFactor,
      requiredIsoKva: requiredIsoKva,
      stdKva: stdKva, stepLoadKva: stepLoadKva, stdSiteKva: stdSiteKva,
      voltageDipPct: voltageDipPct,
      warnings: warnings,
      constants: CONSTANTS,
      steps: [
        'الأحمال المستمرة الظاهرية = ' + contKw + ' / ' + pf + ' = ' + runningKva.toFixed(2) + ' kVA (مع الاحتياطي ' + sparePct + '% = ' + runningWithSpareKva.toFixed(2) + ' kVA)',
        'قدرة بدء أكبر موتور (' + motorKw + ' kW، طريقة ' + startMethod + ' × ' + mult + ') = ' + motorStartKva.toFixed(2) + ' kVA',
        'حمل الذروة الخطوي (مستمر + بدء الموتور) = ' + stepLoadKva.toFixed(2) + ' kVA -> المطلوب بالموقع = ' + requiredSiteKva.toFixed(2) + ' kVA',
        'تصحيح الارتفاع (' + altM + ' m: -' + altDeratePct.toFixed(1) + '%) والحرارة (' + tempC + '°C: -' + tempDeratePct.toFixed(1) + '%) -> معامل Derating = ' + deratingFactor.toFixed(3),
        'السعة القياسية المطلوبة (ISO) = ' + requiredSiteKva.toFixed(2) + ' / ' + deratingFactor.toFixed(3) + ' = ' + requiredIsoKva.toFixed(2) + ' kVA -> المقاس القياسي = ' + stdKva + ' kVA',
        'نسبة هبوط الجهد التقريبية Voltage Dip ≈ (kVA_start × Xd") / (kVA_site + kVA_start × Xd"/100) = ' + voltageDipPct.toFixed(2) + '%'
      ],
      extra: [
        { k: 'الأحمال المستمرة (kVA)', v: runningKva.toFixed(1) + ' kVA' },
        { k: 'قدرة بدء أكبر موتور (' + startMethod + ')', v: motorStartKva.toFixed(1) + ' kVA' },
        { k: 'معامل تصحيح الارتفاع والحرارة', v: deratingFactor.toFixed(3) + ' (تخفيض ' + totalDeratePct.toFixed(1) + '%)' },
        { k: 'السعة المطلوبة (ISO)', v: requiredIsoKva.toFixed(1) + ' kVA' },
        { k: 'المقاس القياسي للمولد', v: stdKva + ' kVA' },
        { k: 'نسبة هبوط الجهد التقريبية (Voltage Dip)', v: voltageDipPct.toFixed(2) + '%' }
      ],
      used: [
        'continuousKw=' + contKw + 'kW, PF=' + pf + ', largestMotor=' + motorKw + 'kW (' + startMethod + ')',
        'altitude=' + altM + 'm, ambientTemp=' + tempC + 'C, spare=' + sparePct + '%',
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
    window.EngUI.registerTab('generator', 'Generator', function (body) { var panel = body;
        panel.appendChild(h.el('div', 'ec-note', AR_WARNING));
        var grid = h.el('div', 'ec-grid');
        grid.appendChild(h.createField('gn-kw', 'Continuous Loads (kW)', 'number', '200'));
        grid.appendChild(h.createField('gn-pf', 'Load Power Factor (PF)', 'number', '0.85'));
        grid.appendChild(h.createField('gn-mkw', 'Largest Motor (kW)', 'number', '45'));
        grid.appendChild(h.createField('gn-sm', 'Motor Starting Method', 'select', [
          { value: 'DOL', label: 'DOL (Direct On Line)', selected: true },
          { value: 'Star-Delta', label: 'Star-Delta' },
          { value: 'Soft-Starter', label: 'Soft-Starter' },
          { value: 'VFD', label: 'VFD (Variable Frequency Drive)' }
        ]));
        grid.appendChild(h.createField('gn-alt', 'Site Altitude (m)', 'number', '600'));
        grid.appendChild(h.createField('gn-tmp', 'Ambient Temperature (°C)', 'number', '45'));
        grid.appendChild(h.createField('gn-spr', 'Spare Margin (%)', 'number', '15'));
        panel.appendChild(grid);
        var btn = h.el('button', 'ec-btn', 'حساب حجم المولد');
        btn.type = 'button';
        panel.appendChild(btn);
        var out = h.el('div', 'ec-out');
        panel.appendChild(out);
        btn.addEventListener('click', function () {
          var res = calculate({
            continuousKw: h.numVal('gn-kw'),
            pf: h.numVal('gn-pf'),
            largestMotorKw: h.numVal('gn-mkw'),
            startMethod: h.val('gn-sm'),
            altitudeM: h.numVal('gn-alt'),
            ambientTempC: h.numVal('gn-tmp'),
            sparePct: h.numVal('gn-spr')
          });
          h.showResult(out, res, 'Generator Sizing');
          if (res.ok) h.renderResultActions(out, 'needs_review', pdfFn('Generator Sizing', res));
        });
  
    });
    return true;
  }

  window.EngGenerator = {
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
