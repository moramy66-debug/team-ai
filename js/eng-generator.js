(function () {
  'use strict';

  var AR_WARNING = 'تحذير: حسابات حجم Generator وتخفيض Power (Derating) ونسبة Voltage Drop التقريبية (Voltage Dip) تعتمد على معاملات إرشادية (needs_review). يجب التحقق من منحنيات الشركة المصنعة لـ Generator (ISO 8528) وخصائص بدء المحرك الفعلية قبل الاعتماد.';

  var CONSTANTS = {
    standardRatingsKva: { value: [20, 30, 45, 60, 80, 100, 125, 150, 200, 250, 300, 350, 400, 500, 625, 750, 800, 1000, 1250, 1500, 2000, 2500], unit: 'kVA', status: 'needs_review', source_url: null, source_note: 'السعات القياسية الشائعة لمجموعات التوليد؛ تُراجع مع كتالوج الشركة المصنعة' },
    startingMultipliers: {
      value: { 'DOL': 6.0, 'Star-Delta': 2.0, 'Soft-Starter': 3.0, 'VFD': 1.25 },
      unit: 'xFLC',
      status: 'needs_review',
      source_url: null,
      source_note: 'مضاعفات Current/Power البدء التقريبية لطرق بدء المحركات؛ تُراجع من بيانات المحرك والبادئ'
    },
    motorPowerFactor: { value: 0.85, unit: 'ratio', status: 'needs_review', source_url: null, source_note: 'معامل قدرة افتراضي للموتور (افتراض، قابل للتعديل)؛ يُؤخذ من Nameplate الموتور' },
    motorEfficiency: { value: 0.90, unit: 'ratio', status: 'needs_review', source_url: null, source_note: 'كفاءة/معامل تحويل تقديري للمحرك لحساب kVA البدء' },
    xdSubtransientPct: { value: 15, unit: '%', status: 'needs_review', source_url: null, source_note: 'Impedance العابرة التحتية التقريبية لـ Generator Xd" (15%) لحساب Voltage Drop التقريبي' },
    maxRecommendedDipPct: { value: 15, unit: '%', status: 'needs_review', source_url: null, source_note: 'حد Voltage Drop اللحظي الإرشادي (15%) عند بدء أكبر محرك' },
    altitudeBaseM: { value: 1000, unit: 'm', status: 'needs_review', source_url: null, source_note: 'الارتفاع المرجعي قبل التخفيض (1000 m)، مع تخفيض تقديري 1% لكل 100 m إضافية' },
    tempBaseC: { value: 40, unit: 'C', status: 'needs_review', source_url: null, source_note: 'Temperature المرجعية (40°C)، مع تخفيض تقديري 0.5% لكل 1°C إضافية' }
  };

  function calculate(inp) {
    var contKw = Number(inp.continuousKw);
    var pf = (inp.pf === undefined || inp.pf === null || inp.pf === '') ? 0.8 : Number(inp.pf);
    var motorKw = Number(inp.largestMotorKw || 0);
    var mpfGiven = !(inp.motorPf === undefined || inp.motorPf === null || inp.motorPf === '');
    var motorPf = mpfGiven ? Number(inp.motorPf) : CONSTANTS.motorPowerFactor.value;
    if (mpfGiven && !(motorPf > 0 && motorPf <= 1)) return { ok: false, error: 'Motor Power Factor غير صالح (' + inp.motorPf + '): لازم يكون أكبر من 0 وأقل من أو يساوي 1. سيبه فاضي لو عايز الافتراض ' + CONSTANTS.motorPowerFactor.value + '.' };
    var startMethod = inp.startMethod || 'DOL';
    var altM = Number(inp.altitudeM || 0);
    var tempC = Number(inp.ambientTempC || 40);
    var sparePct = Number(inp.sparePct || 0);

    var multMap = CONSTANTS.startingMultipliers.value;
    var mult = multMap[startMethod] || multMap['DOL'];

    if (!(contKw > 0 && pf > 0 && pf <= 1) || motorKw < 0 || altM < 0 || sparePct < 0) {
      return { ok: false, error: 'أدخل قيماً موجبة صحيحة لـ Loads المستمرة (kW) و Power Factor PF (بين 0 و 1) وبقية المدخلات.' };
    }

    var runningKva = contKw / pf;
    var motorStartKva = motorKw > 0 ? (motorKw / (CONSTANTS.motorEfficiency.value * motorPf)) * mult : 0;
    var runningWithSpareKva = runningKva * (1 + sparePct / 100);
    var stepLoadKva = runningKva + motorStartKva;
    var requiredSiteKva = Math.max(runningWithSpareKva, stepLoadKva);

    var altDeratePct = altM > CONSTANTS.altitudeBaseM.value ? ((altM - CONSTANTS.altitudeBaseM.value) / 100) * 1.0 : 0;
    var tempDeratePct = tempC > CONSTANTS.tempBaseC.value ? (tempC - CONSTANTS.tempBaseC.value) * 0.5 : 0;
    var totalDeratePct = Math.min(50, altDeratePct + tempDeratePct);
    var deratingFactor = 1 - totalDeratePct / 100;
    var dfGiven = !(inp.deratingFactor === undefined || inp.deratingFactor === null || inp.deratingFactor === '');
    if (dfGiven) {
      var dfIn = Number(inp.deratingFactor);
      if (!(dfIn > 0 && dfIn <= 1)) return { ok: false, error: 'Derating factor غير صالح (' + inp.deratingFactor + '): لازم يكون أكبر من 0 وأقل من أو يساوي 1. سيبه فاضي لو عايز الحساب التلقائي من الارتفاع والحرارة.' };
      deratingFactor = dfIn; totalDeratePct = (1 - dfIn) * 100;
    }

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
      warnings.push('تحذير: نسبة Voltage Drop التقريبية (' + voltageDipPct.toFixed(1) + '%) تتجاوز الحد الإرشادي ' + CONSTANTS.maxRecommendedDipPct.value + '%؛ يُنصح بتغيير طريقة البدء أو زيادة Generator Capacity.');
    }
    if (!fitsStandard) {
      warnings.push('تحذير: Required Capacity (' + requiredIsoKva.toFixed(1) + ' kVA) تتجاوز أكبر مقاس قياسي (' + stdKva + ' kVA)؛ يلزم تشغيل Generators على التوازي.');
    }

    return {
      ok: true,
      summary: 'المقاس القياسي ' + stdKva + ' kVA | المطلوب بعد Derating ' + requiredIsoKva.toFixed(1) + ' kVA | Voltage Drop التقريبي ' + voltageDipPct.toFixed(1) + '%',
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
        { step: 'Loads المستمرة الظاهرية', formula: 'S_run = kW / PF', substitution: contKw + ' / ' + pf + ' ; مع الاحتياطي ' + sparePct + '%', result: runningKva.toFixed(2) + ' kVA (مع الاحتياطي ' + runningWithSpareKva.toFixed(2) + ' kVA)' },
        { step: 'Starting Power لأكبر موتور', formula: 'S_start = (kW / (η × PF_motor)) × مضاعف البدء', substitution: '(' + motorKw + ' / (' + CONSTANTS.motorEfficiency.value + ' × ' + motorPf + ')) × ' + mult + ' (' + startMethod + ')', result: motorStartKva.toFixed(2) + ' kVA' },
        { step: 'Load الذروة والمطلوب بالموقع', formula: 'S_step = S_run + S_start ; S_site = max(S_run مع الاحتياطي , S_step)', substitution: runningKva.toFixed(2) + ' + ' + motorStartKva.toFixed(2), result: stepLoadKva.toFixed(2) + ' kVA -> ' + requiredSiteKva.toFixed(2) + ' kVA' },
        { step: 'معامل Derating', formula: 'DF = 1 - (ارتفاع + Temperature)%', substitution: altM + ' m: -' + altDeratePct.toFixed(1) + '% ; ' + tempC + '°C: -' + tempDeratePct.toFixed(1) + '%', result: deratingFactor.toFixed(3) },
        { step: 'Standard Rating المطلوبة (ISO)', formula: 'S_iso = S_site / DF -> أول مقاس قياسي >=', substitution: requiredSiteKva.toFixed(2) + ' / ' + deratingFactor.toFixed(3), result: requiredIsoKva.toFixed(2) + ' kVA -> ' + stdKva + ' kVA' },
        { step: 'Voltage Drop التقريبي (Voltage Dip)', formula: 'Dip% ≈ (S_start × Xd") / (S_site_std + S_start × Xd"/100)', substitution: '(' + motorStartKva.toFixed(1) + ' × ' + CONSTANTS.xdSubtransientPct.value + ') / (' + stdSiteKva.toFixed(1) + ' + ' + motorStartKva.toFixed(1) + ' × ' + (CONSTANTS.xdSubtransientPct.value / 100) + ')', result: voltageDipPct.toFixed(2) + '%' }
      ],
      extra: [
        { k: 'Loads المستمرة (kVA)', v: runningKva.toFixed(1) + ' kVA' },
        { k: 'Starting Power لأكبر موتور (' + startMethod + ')', v: motorStartKva.toFixed(1) + ' kVA' },
        { k: 'Motor Power Factor المستخدم', v: motorPf + (mpfGiven ? '' : ' (افتراض 0.85، غيّره من خانة Motor PF)') },
        { k: 'Altitude and Temperature Correction Factor', v: deratingFactor.toFixed(3) + ' (تخفيض ' + totalDeratePct.toFixed(1) + '%)' + (dfGiven ? ' - مُدخل يدويًا (manual, needs_review)' : '') },
        { k: 'Required Capacity (ISO)', v: requiredIsoKva.toFixed(1) + ' kVA' },
        { k: 'المقاس القياسي لـ Generator', v: stdKva + ' kVA' },
        { k: 'نسبة Voltage Drop التقريبية (Voltage Dip)', v: voltageDipPct.toFixed(2) + '%' }
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
        grid.appendChild(h.createField('gn-mpf', 'Motor Power Factor (PF) - assumed 0.85, editable', 'number', '0.85'));
        grid.appendChild(h.createField('gn-sm', 'Motor Starting Method', 'select', [
          { value: 'DOL', label: 'DOL (Direct On Line)', selected: true },
          { value: 'Star-Delta', label: 'Star-Delta' },
          { value: 'Soft-Starter', label: 'Soft-Starter' },
          { value: 'VFD', label: 'VFD (Variable Frequency Drive)' }
        ]));
        grid.appendChild(h.createField('gn-alt', 'Site Altitude (m)', 'number', '600'));
        grid.appendChild(h.createField('gn-tmp', 'Ambient Temperature (°C)', 'number', '45'));
        grid.appendChild(h.createField('gn-spr', 'Spare Margin (%)', 'number', '15'));
        grid.appendChild(h.createField('gn-df', 'Derating factor - optional manual override (0-1)', 'number', ''));
        panel.appendChild(grid);
        var btn = h.el('button', 'ec-btn', 'حساب حجم Generator');
        btn.type = 'button';
        panel.appendChild(btn);
        var out = h.el('div', 'ec-out');
        panel.appendChild(out);
        btn.addEventListener('click', function () {
          var res = calculate({
            continuousKw: h.numVal('gn-kw'),
            pf: h.numVal('gn-pf'),
            largestMotorKw: h.numVal('gn-mkw'),
            motorPf: h.numVal('gn-mpf'),
            startMethod: h.val('gn-sm'),
            altitudeM: h.numVal('gn-alt'),
            ambientTempC: h.numVal('gn-tmp'),
            sparePct: h.numVal('gn-spr'),
            deratingFactor: h.numVal('gn-df')
          });
          out.innerHTML = '';
          h.showResult(out, res, 'Generator Sizing');
          if (res.ok) h.renderResultActions(out, 'needs_review', pdfFn('Generator Sizing', res));
        });
  
    });
    return true;
  }

    /* reject overflow: any non-finite number in a successful result becomes an error */
  function hasNonFinite(x, depth) {
    if (typeof x === 'number') return !isFinite(x);
    if (!x || typeof x !== 'object' || (depth || 0) > 6) return false;
    for (var k in x) { if (hasNonFinite(x[k], (depth || 0) + 1)) return true; }
    return false;
  }
  var calculateRaw = calculate;
  calculate = function (inp) {
    var r = calculateRaw(inp);
    if (r && r.ok && hasNonFinite(r)) return { ok: false, error: 'القيمة المدخلة كبيرة جدا وطلعت نتيجة غير منتهية (overflow). صحح المدخلات.' };
    return r;
  };

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
