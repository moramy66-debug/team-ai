(function () {
  'use strict';

  var AR_WARN = 'قيمة استرشادية من الذاكرة الهندسية تحتاج مراجعة وتدقيق من كتالوج المصنع والمعيار المطبق قبل الاعتماد.';

  var CONSTANTS = {
    STANDARD_UPS_KVA: {
      value: [1, 2, 3, 5, 6, 10, 15, 20, 30, 40, 60, 80, 100, 120, 160, 200, 250, 300, 400, 500, 600, 800, 1000],
      unit: 'kVA',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    },
    STANDARD_BATTERY_AH: {
      value: [7, 9, 12, 18, 24, 26, 33, 40, 50, 65, 75, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000],
      unit: 'Ah',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    },
    DEFAULT_LOAD_PF: {
      value: 0.8,
      unit: 'pu',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    },
    DEFAULT_UPS_RATED_PF: {
      value: 0.9,
      unit: 'pu',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    },
    DEFAULT_INVERTER_EFF: {
      value: 0.94,
      unit: 'pu',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    },
    DEFAULT_EOD_RATIO: {
      value: 0.875,
      unit: 'pu',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    },
    DEFAULT_AGEING_FACTOR: {
      value: 1.25,
      unit: 'pu',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    },
    DEFAULT_TEMP_FACTOR: {
      value: 1.0,
      unit: 'pu',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    },
    DEFAULT_DESIGN_MARGIN: {
      value: 1.1,
      unit: 'pu',
      status: 'from_memory_needs_review',
      source: null,
      warning: AR_WARN
    }
  };

  function isFinitePos(n) {
    return typeof n === 'number' && isFinite(n) && n > 0;
  }

  function pickStandard(val, table) {
    for (var i = 0; i < table.length; i++) {
      if (table[i] >= val - 1e-9) return table[i];
    }
    return null;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function calculate(input) {
    if (!input || typeof input !== 'object') {
      return { ok: false, error: 'Invalid input object.' };
    }

    var loadKw = Number(input.loadKw);
    var loadPf = input.loadPf !== undefined ? Number(input.loadPf) : CONSTANTS.DEFAULT_LOAD_PF.value;
    var upsRatedPf = input.upsRatedPf !== undefined ? Number(input.upsRatedPf) : CONSTANTS.DEFAULT_UPS_RATED_PF.value;
    var sparePct = input.sparePct !== undefined ? Number(input.sparePct) : 0;
    var runtimeMin = Number(input.runtimeMin);
    var dcVoltageV = input.dcVoltageV !== undefined ? Number(input.dcVoltageV) : 240;
    var inverterEff = input.inverterEff !== undefined ? Number(input.inverterEff) : CONSTANTS.DEFAULT_INVERTER_EFF.value;
    var eodRatio = input.eodRatio !== undefined ? Number(input.eodRatio) : CONSTANTS.DEFAULT_EOD_RATIO.value;
    var ageingFactor = input.ageingFactor !== undefined ? Number(input.ageingFactor) : CONSTANTS.DEFAULT_AGEING_FACTOR.value;
    var tempFactor = input.tempFactor !== undefined ? Number(input.tempFactor) : CONSTANTS.DEFAULT_TEMP_FACTOR.value;
    var designMargin = input.designMargin !== undefined ? Number(input.designMargin) : CONSTANTS.DEFAULT_DESIGN_MARGIN.value;

    var hasUpsEff = input.upsEff !== undefined && input.upsEff !== null && input.upsEff !== '' && !(typeof input.upsEff === 'number' && isNaN(input.upsEff));
    var upsEff = hasUpsEff ? Number(input.upsEff) : null;

    var hasInstalledAh = input.installedAh !== undefined && input.installedAh !== null && input.installedAh !== '';
    var installedAh = hasInstalledAh ? Number(input.installedAh) : null;

    if (!isFinitePos(loadKw)) return { ok: false, error: 'Active load (kW) must be a positive finite number.' };
    if (!isFinitePos(loadPf) || loadPf > 1) return { ok: false, error: 'Load power factor must be > 0 and <= 1.' };
    if (!isFinitePos(upsRatedPf) || upsRatedPf > 1) return { ok: false, error: 'UPS rated power factor must be > 0 and <= 1.' };
    if (typeof sparePct !== 'number' || !isFinite(sparePct) || sparePct < 0 || sparePct > 200) {
      return { ok: false, error: 'Spare percentage must be between 0 and 200.' };
    }
    if (!isFinitePos(runtimeMin)) return { ok: false, error: 'Backup runtime (min) must be a positive finite number.' };
    if (!isFinitePos(dcVoltageV)) return { ok: false, error: 'DC bus voltage (V) must be a positive finite number.' };
    if (!isFinitePos(inverterEff) || inverterEff > 1) return { ok: false, error: 'Inverter efficiency must be > 0 and <= 1.' };
    if (hasUpsEff && (!isFinitePos(upsEff) || upsEff > 1)) return { ok: false, error: 'UPS efficiency must be > 0 and <= 1.' };
    if (!isFinitePos(eodRatio) || eodRatio > 1) return { ok: false, error: 'End-of-discharge ratio must be > 0 and <= 1.' };
    if (typeof ageingFactor !== 'number' || !isFinite(ageingFactor) || ageingFactor < 1) {
      return { ok: false, error: 'Ageing factor must be >= 1.' };
    }
    if (!isFinitePos(tempFactor)) return { ok: false, error: 'Temperature correction factor must be > 0.' };
    if (typeof designMargin !== 'number' || !isFinite(designMargin) || designMargin < 1) {
      return { ok: false, error: 'Design margin factor must be >= 1.' };
    }
    if (hasInstalledAh && (typeof installedAh !== 'number' || !isFinite(installedAh) || installedAh < 0)) {
      return { ok: false, error: 'Installed battery Ah must be a non-negative finite number.' };
    }

    var loadKva = loadKw / loadPf;
    var growthMult = 1 + sparePct / 100;
    var requiredKw = loadKw * growthMult;
    var requiredKvaByLoad = loadKva * growthMult;
    var requiredKvaByUpsPf = requiredKw / upsRatedPf;
    var requiredUpsKvaBase = Math.max(requiredKvaByLoad, requiredKvaByUpsPf);
    var requiredUpsKva = hasUpsEff ? requiredUpsKvaBase / upsEff : requiredUpsKvaBase;
    var standardUpsKva = pickStandard(requiredUpsKva, CONSTANTS.STANDARD_UPS_KVA.value);
    var upsLoadingPct = standardUpsKva ? (requiredUpsKva / standardUpsKva) * 100 : null;

    var batteryPowerKw = requiredKw / inverterEff;
    var eodVoltageV = dcVoltageV * eodRatio;
    var dcCurrentEodA = (batteryPowerKw * 1000) / eodVoltageV;

    var runtimeHours = runtimeMin / 60;
    var rawEnergyKwh = batteryPowerKw * runtimeHours;
    var combinedDerating = ageingFactor * tempFactor * designMargin;
    var correctedEnergyKwh = rawEnergyKwh * combinedDerating;
    var rawAh = dcCurrentEodA * runtimeHours;
    var requiredAh = rawAh * combinedDerating;
    var standardAh = pickStandard(requiredAh, CONSTANTS.STANDARD_BATTERY_AH.value);

    var reverseCheck = null;
    if (hasInstalledAh && installedAh > 0) {
      var effectiveAvailableAh = installedAh / combinedDerating;
      var estimatedRuntimeHours = effectiveAvailableAh / dcCurrentEodA;
      var estimatedRuntimeMin = estimatedRuntimeHours * 60;
      reverseCheck = {
        installedAh: installedAh,
        effectiveAvailableAh: effectiveAvailableAh,
        estimatedRuntimeMin: estimatedRuntimeMin,
        meetsRequiredRuntime: estimatedRuntimeMin >= runtimeMin
      };
    }

    var warnings = [AR_WARN];
    if (hasUpsEff) {
      warnings.push('UPS efficiency was entered, so the required UPS kVA is divided by it (more conservative). This is an optional assumption with no source recorded (needs_review).');
    } else {
      warnings.push('Note: the UPS kVA above is the output rating for the load. UPS efficiency affects input power and heat, not the output kVA rating.');
    }
    if (standardUpsKva === null) {
      warnings.push('Required UPS kVA (' + round2(requiredUpsKva) + ' kVA) exceeds max standard table size (1000 kVA). Consider parallel UPS modules.');
    }
    if (standardAh === null) {
      warnings.push('Required battery capacity (' + round2(requiredAh) + ' Ah) exceeds max standard table size (1000 Ah). Consider parallel battery strings.');
    }
    if (reverseCheck && !reverseCheck.meetsRequiredRuntime) {
      warnings.push('Installed battery bank (' + installedAh + ' Ah) gives ' + round1(reverseCheck.estimatedRuntimeMin) + ' min, which is below required ' + runtimeMin + ' min.');
    }

    var rows = [
      { label: 'Active Load with Spare', value: round2(requiredKw) + ' kW' },
      { label: 'Required UPS Size', value: round2(requiredUpsKva) + ' kVA' },
      { label: 'Standard UPS Size', value: standardUpsKva !== null ? standardUpsKva + ' kVA (' + round1(upsLoadingPct) + '% load)' : 'Exceeds 1000 kVA (Parallel required)' },
      { label: 'Battery Power (DC)', value: round2(batteryPowerKw) + ' kW' },
      { label: 'EOD DC Voltage', value: round2(eodVoltageV) + ' V' },
      { label: 'DC Current at EOD', value: round2(dcCurrentEodA) + ' A' },
      { label: 'Raw Battery Energy / Capacity', value: round2(rawEnergyKwh) + ' kWh / ' + round2(rawAh) + ' Ah' },
      { label: 'Corrected Battery Energy (with ageing/temp/margin)', value: round2(correctedEnergyKwh) + ' kWh' },
      { label: 'Required Battery Capacity', value: round2(requiredAh) + ' Ah' },
      { label: 'Standard Battery Bank', value: standardAh !== null ? standardAh + ' Ah' : 'Exceeds 1000 Ah (Parallel strings)' }
    ];

    if (reverseCheck) {
      rows.push({
        label: 'Reverse Runtime Check (' + installedAh + ' Ah)',
        value: round1(reverseCheck.estimatedRuntimeMin) + ' min (' + (reverseCheck.meetsRequiredRuntime ? 'PASS' : 'FAIL') + ')'
      });
    }

    var steps = [];
    steps.push({ step: 'Load Power مع النمو', formula: 'P = Pload x (1 + spare/100) ; S = (Pload / PF) x (1 + spare/100)', substitution: 'P = ' + loadKw + ' x ' + round2(growthMult) + ' ; S = (' + loadKw + ' / ' + loadPf + ') x ' + round2(growthMult), result: 'P = ' + round2(requiredKw) + ' kW | S = ' + round2(requiredKvaByLoad) + ' kVA', value: requiredKvaByLoad, unit: 'kVA' });
    steps.push({ step: 'حجم الـ UPS المطلوب', formula: 'S_ups = max(S ; P / PF_ups)', substitution: 'max(' + round2(requiredKvaByLoad) + ' ; ' + round2(requiredKw) + ' / ' + upsRatedPf + ')', result: round2(requiredUpsKva) + ' kVA | أقرب حجم قياسي ' + (standardUpsKva !== null ? standardUpsKva + ' kVA (تحميل ' + round1(upsLoadingPct) + '%)' : 'خارج القايمة') + ' (القايمة needs_review)', value: requiredUpsKva, unit: 'kVA' });
    if (hasUpsEff) {
      steps.push({ step: 'UPS Efficiency (اختياري، needs_review)', formula: 'S_ups_eff = S_ups / eff_ups', substitution: round2(requiredUpsKvaBase) + ' / ' + upsEff, result: round2(requiredUpsKva) + ' kVA', value: requiredUpsKva, unit: 'kVA' });
    }
    steps.push({ step: 'Battery Power و DC Current', formula: 'Pdc = P / eff_inv ; Veod = Vdc x ratio ; Idc = Pdc x 1000 / Veod', substitution: 'Pdc = ' + round2(requiredKw) + ' / ' + inverterEff + ' ; Veod = ' + dcVoltageV + ' x ' + eodRatio + ' ; Idc = ' + round2(batteryPowerKw) + ' x 1000 / ' + round2(eodVoltageV), result: 'Pdc = ' + round2(batteryPowerKw) + ' kW | Veod = ' + round2(eodVoltageV) + ' V | Idc = ' + round2(dcCurrentEodA) + ' A', value: dcCurrentEodA, unit: 'A' });
    steps.push({ step: 'Capacity Battery', formula: 'Ah = Idc x (t/60) x ageing x temp x margin', substitution: round2(dcCurrentEodA) + ' x (' + runtimeMin + ' / 60) x ' + ageingFactor + ' x ' + tempFactor + ' x ' + designMargin, result: 'خام ' + round2(rawAh) + ' Ah | مصحح ' + round2(requiredAh) + ' Ah | قياسي ' + (standardAh !== null ? standardAh + ' Ah' : 'خارج القايمة') + ' | طاقة مصححة ' + round2(correctedEnergyKwh) + ' kWh (القايمة needs_review)', value: requiredAh, unit: 'Ah' });
    if (reverseCheck) {
      steps.push({ step: 'فحص زمن التشغيل العكسي', formula: 't = (Ah_installed / (ageing x temp x margin)) / Idc x 60', substitution: '(' + installedAh + ' / ' + round2(combinedDerating) + ') / ' + round2(dcCurrentEodA) + ' x 60', result: round1(reverseCheck.estimatedRuntimeMin) + ' min (' + (reverseCheck.meetsRequiredRuntime ? 'PASS' : 'FAIL') + ' مقابل ' + runtimeMin + ' min)', value: reverseCheck.estimatedRuntimeMin, unit: 'min' });
    }
    var used = [{ id: 'eng_ups_defaults_and_standard_sizes', status: 'from_memory_needs_review', source: null }];
    var summary = 'UPS ' + (standardUpsKva !== null ? standardUpsKva + ' kVA' : round2(requiredUpsKva) + ' kVA') + ' | Battery ' + round2(requiredAh) + ' Ah عند ' + round2(eodVoltageV) + ' V | كل الثوابت needs_review';

    return {
      ok: true,
      steps: steps,
      summary: summary,
      tablesUsed: used,
      loadKva: loadKva,
      requiredKw: requiredKw,
      requiredUpsKva: requiredUpsKva,
      standardUpsKva: standardUpsKva,
      upsLoadingPct: upsLoadingPct,
      batteryPowerKw: batteryPowerKw,
      eodVoltageV: eodVoltageV,
      dcCurrentEodA: dcCurrentEodA,
      rawEnergyKwh: rawEnergyKwh,
      correctedEnergyKwh: correctedEnergyKwh,
      rawAh: rawAh,
      requiredAh: requiredAh,
      standardAh: standardAh,
      combinedDerating: combinedDerating,
      reverseCheck: reverseCheck,
      rows: rows,
      warnings: warnings,
      status: 'from_memory_needs_review'
    };
  }

  function pdfDoc(title, res) {
    return {
      title: title || 'UPS + Battery Sizing',
      status: 'from_memory_needs_review',
      sections: [
        {
          title: 'UPS & Battery Sizing Summary',
          rows: res && res.rows ? res.rows : []
        }
      ],
      warnings: res && res.warnings ? res.warnings : [AR_WARN]
    };
  }

  function register() {
    if (!window.EngUI || !window.EngUI.registerTab || !window.EngUI.helpers) return false;
    var h = window.EngUI.helpers;

    window.EngUI.registerTab('ups', 'UPS', function (body) {
      var note = h.el('div', 'ec-note');
      note.textContent = AR_WARN;
      body.appendChild(note);

      var grid = h.el('div', 'ec-grid');
      grid.appendChild(h.createField('ups-load-kw', 'Active Load (kW)', 'number', 40));
      grid.appendChild(h.createField('ups-load-pf', 'Load Power Factor (0-1)', 'number', CONSTANTS.DEFAULT_LOAD_PF.value));
      grid.appendChild(h.createField('ups-rated-pf', 'UPS Rated PF (0-1)', 'number', CONSTANTS.DEFAULT_UPS_RATED_PF.value));
      grid.appendChild(h.createField('ups-spare-pct', 'Spare / Growth (%)', 'number', 15));
      grid.appendChild(h.createField('ups-runtime-min', 'Backup Runtime (min)', 'number', 15));
      grid.appendChild(h.createField('ups-dc-v', 'Nominal DC Bus Voltage (V)', 'number', 240));
      grid.appendChild(h.createField('ups-inv-eff', 'Inverter Efficiency (0-1)', 'number', CONSTANTS.DEFAULT_INVERTER_EFF.value));
      grid.appendChild(h.createField('ups-eod-ratio', 'EOD Voltage Ratio (0-1)', 'number', CONSTANTS.DEFAULT_EOD_RATIO.value));
      grid.appendChild(h.createField('ups-ageing', 'Ageing Factor (>=1)', 'number', CONSTANTS.DEFAULT_AGEING_FACTOR.value));
      grid.appendChild(h.createField('ups-temp', 'Temperature Factor (>0)', 'number', CONSTANTS.DEFAULT_TEMP_FACTOR.value));
      grid.appendChild(h.createField('ups-margin', 'Design Margin (>=1)', 'number', CONSTANTS.DEFAULT_DESIGN_MARGIN.value));
      grid.appendChild(h.createField('ups-eff', 'UPS Efficiency (0-1, optional, divides UPS kVA)', 'number', ''));
      grid.appendChild(h.createField('ups-installed-ah', 'Installed Battery Ah (optional reverse check)', 'number', ''));
      body.appendChild(grid);

      var btn = h.el('button', 'ec-btn');
      btn.textContent = 'Calculate UPS & Battery';
      body.appendChild(btn);

      var out = h.el('div', 'ec-out');
      body.appendChild(out);

      btn.addEventListener('click', function () {
        var installedRaw = h.val('ups-installed-ah');
        var res = calculate({
          loadKw: h.numVal('ups-load-kw'),
          loadPf: h.numVal('ups-load-pf'),
          upsRatedPf: h.numVal('ups-rated-pf'),
          sparePct: h.numVal('ups-spare-pct'),
          runtimeMin: h.numVal('ups-runtime-min'),
          dcVoltageV: h.numVal('ups-dc-v'),
          inverterEff: h.numVal('ups-inv-eff'),
          eodRatio: h.numVal('ups-eod-ratio'),
          ageingFactor: h.numVal('ups-ageing'),
          tempFactor: h.numVal('ups-temp'),
          designMargin: h.numVal('ups-margin'),
          upsEff: h.val('ups-eff') !== '' ? Number(h.val('ups-eff')) : null,
          installedAh: installedRaw !== '' ? Number(installedRaw) : null
        });
        out.innerHTML = '';
        h.showResult(out, res, 'UPS + Battery Sizing');
        if (res.ok) {
          h.renderResultActions(out, 'from_memory_needs_review', pdfDoc('UPS + Battery Sizing', res));
        }
      });
    });
    return true;
  }

  register();

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

  window.EngUps = {
    CONSTANTS: CONSTANTS,
    calculate: calculate,
    pdfDoc: pdfDoc,
    register: register
  };
})();
