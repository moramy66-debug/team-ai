/* Team AI engineering calculators (deterministic, no model calls).
   Reads the tables from window.EngTables (data/eng-tables.json). Pure functions:
   every result carries steps (formula, substitution, result), warnings and tablesUsed. */
(function () {
  'use strict';

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function pos(x) { return isNum(x) && x > 0; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function f(x, d) { return Number(x).toFixed(d === undefined ? 2 : d); }

  function api(tablesApi) {
    var a = tablesApi || window.EngTables;
    if (!a || typeof a.get !== 'function' || typeof a.meta !== 'function') {
      throw new Error('جداول الهندسة غير محملة (EngTables).');
    }
    return a;
  }

  function need(a, id) {
    var t = a.get(id);
    if (!t) throw new Error('الجدول غير موجود في ملف البيانات: ' + id);
    return t;
  }

  function col(t, name) {
    var i = (t.columns || []).indexOf(name);
    if (i < 0) throw new Error('العمود غير موجود في الجدول: ' + name);
    return i;
  }

  function useTable(used, a, id) {
    var m = a.meta(id) || {};
    if (!used.some(function (u) { return u.id === id; })) {
      used.push({ id: id, source: m.source || '', status: m.status || 'unknown', title: m.title || '' });
    }
    return m;
  }

  function isVerified(status) {
    return String(status || '').indexOf('verified') === 0;
  }

  function buildWarnings(used, extra) {
    var w = (extra || []).slice();
    used.forEach(function (u) {
      if (!isVerified(u.status)) {
        w.push('الجدول ' + u.id + ' حالته ' + u.status + ': مش من مصدر متأكد منه، لازم مراجعة قبل أي اعتماد.');
      } else if (u.status === 'verified_mirror_old_edition') {
        w.push('الجدول ' + u.id + ' من إصدار قديم، راجع الإصدار الحالي.');
      }
    });
    if (used.some(function (u) { return u.status === 'verified_mirror' || u.status === 'verified_secondary'; })) {
      w.push('الأرقام من نسخة منشورة للجداول (مش من الكود الرسمي المدفوع). راجعها مع IEC 60364-5-52 / BS 7671 قبل الاعتماد في تصميم مختوم.');
    }
    return w.filter(function (x, i) { return w.indexOf(x) === i; });
  }

  /* ---------- design current ---------- */
  function designCurrent(o, steps) {
    var phases = Number(o.phases) === 1 ? 1 : 3;
    var V = pos(o.voltageV) ? o.voltageV : (phases === 1 ? 230 : 400);
    var pf = pos(o.powerFactor) && o.powerFactor <= 1 ? o.powerFactor : 0.85;
    var P = pos(o.powerKW) ? o.powerKW : (pos(o.powerKw) ? o.powerKw : null);
    var Ib;
    if (pos(o.currentA)) {
      Ib = o.currentA;
      steps.push({ step: 'تيار التصميم Ib', formula: 'Ib = I (مدخل)', substitution: 'I = ' + f(Ib) + ' A', result: f(Ib) + ' A', value: Ib, unit: 'A' });
    } else if (P) {
      Ib = phases === 1 ? (P * 1000) / (V * pf) : (P * 1000) / (Math.sqrt(3) * V * pf);
      steps.push({
        step: 'تيار التصميم Ib',
        formula: phases === 1 ? 'Ib = P x 1000 / (V x PF)' : 'Ib = P x 1000 / (sqrt(3) x V x PF)',
        substitution: phases === 1 ? f(P) + ' x 1000 / (' + V + ' x ' + pf + ')' : f(P) + ' x 1000 / (1.732 x ' + V + ' x ' + pf + ')',
        result: f(Ib) + ' A', value: Ib, unit: 'A'
      });
    } else {
      throw new Error('ادخل التيار (A) أو القدرة (kW).');
    }
    return { Ib: Ib, phases: phases, V: V, pf: pf };
  }

  /* ---------- breakers ---------- */
  function ratingsFor(a, type, used, warnings) {
    var t = String(type || 'any').toUpperCase();
    if (t === 'ACB') throw new Error('جدول ACB مش موجود في البيانات. اختار MCB أو MCCB.');
    var mcb = need(a, 'mcb_iec60898_rated_currents'), mccb = need(a, 'mccb_iec60947_2_typical_ratings');
    if (t === 'MCB') { useTable(used, a, 'mcb_iec60898_rated_currents'); return { type: 'MCB', values: mcb.values }; }
    if (t === 'MCCB') { useTable(used, a, 'mccb_iec60947_2_typical_ratings'); return { type: 'MCCB', values: mccb.values }; }
    return { any: true, mcb: mcb.values, mccb: mccb.values };
  }

  function pickBreaker(a, type, minIn, used, warnings) {
    var r = ratingsFor(a, type, used, warnings), i, sel = null;
    if (r.any) {
      for (i = 0; i < r.mcb.length; i++) if (r.mcb[i] >= minIn) { sel = { type: 'MCB', rating: r.mcb[i] }; break; }
      if (sel) { useTable(used, a, 'mcb_iec60898_rated_currents'); return sel; }
      for (i = 0; i < r.mccb.length; i++) if (r.mccb[i] >= minIn) { sel = { type: 'MCCB', rating: r.mccb[i] }; break; }
      if (sel) { useTable(used, a, 'mccb_iec60947_2_typical_ratings'); }
      return sel;
    }
    for (i = 0; i < r.values.length; i++) if (r.values[i] >= minIn) return { type: r.type, rating: r.values[i] };
    return null;
  }

  function breakerSelection(input, tablesApi) {
    var o = input || {}, a = api(tablesApi), used = [], steps = [];
    var Ib = Number(o.designCurrentA || o.currentA || o.ib);
    if (!pos(Ib)) throw new Error('ادخل تيار التصميم Ib (رقم موجب).');
    var sf = pos(o.safetyFactor) ? o.safetyFactor : 1;
    var need_In = Ib * sf;
    steps.push({ step: 'التيار المطلوب للقاطع', formula: 'In_min = Ib x SF', substitution: f(Ib) + ' x ' + sf, result: f(need_In) + ' A', value: need_In, unit: 'A' });
    var sel = pickBreaker(a, o.type, need_In, used);
    if (!sel) throw new Error('مفيش قاطع في الجداول أكبر من ' + f(need_In) + ' A.');
    steps.push({ step: 'اختيار القاطع القياسي', formula: 'أقرب In قياسي >= In_min', substitution: sel.type + ': In >= ' + f(need_In) + ' A', result: 'In = ' + sel.rating + ' A (' + sel.type + ')', value: sel.rating, unit: 'A' });
    var Iz = pos(o.cableAmpacityA) ? o.cableAmpacityA : (pos(o.iz) ? o.iz : null);
    var coordinated = sel.rating >= Ib && (Iz === null || sel.rating <= Iz);
    if (Iz !== null) {
      steps.push({ step: 'تنسيق القاطع مع الكابل', formula: 'Ib <= In <= Iz', substitution: f(Ib) + ' <= ' + sel.rating + ' <= ' + f(Iz), result: coordinated ? 'متحقق' : 'غير متحقق', value: coordinated, unit: '' });
      if (!coordinated) steps.push({ step: 'ملاحظة', formula: 'In > Iz', substitution: sel.rating + ' > ' + f(Iz), result: 'كبّر مقطع الكابل أو اختار قاطع أصغر', value: null, unit: '' });
    }
    var warnings = [];
    if (pos(o.iscKA) && pos(o.icuKA)) {
      var ok = o.icuKA >= o.iscKA;
      steps.push({ step: 'قدرة القطع', formula: 'Icu >= Isc', substitution: f(o.icuKA) + ' >= ' + f(o.iscKA) + ' kA', result: ok ? 'متحقق' : 'غير متحقق', value: ok, unit: 'kA' });
    }
    warnings.push('تنسيق الحماية (I2 <= 1.45 Iz) محتاج مراجعة مع بيانات المصنع وقاعدة IEC 60364-4-43.');
    var table = a.meta(sel.type === 'MCB' ? 'mcb_iec60898_rated_currents' : 'mccb_iec60947_2_typical_ratings');
    return {
      rating_a: sel.rating, type: sel.type, designCurrentA: r2(Ib), cableAmpacityA: Iz, coordinated: coordinated,
      table: table, steps: steps, tablesUsed: used, warnings: buildWarnings(used, warnings),
      summary: 'القاطع: ' + sel.rating + ' A (' + sel.type + ') | Ib = ' + f(Ib) + ' A'
    };
  }

  /* ---------- voltage drop ---------- */
  function resistance(a, used, size, conductor) {
    var t = need(a, 'iec_60228_conductor_resistance_20c');
    useTable(used, a, 'iec_60228_conductor_resistance_20c');
    var rows = String(conductor).toLowerCase() === 'al' ? t.rows_Al : t.rows_Cu;
    var hit = (rows || []).filter(function (r) { return r[0] === size; })[0];
    if (!hit) throw new Error('مقاومة ' + conductor + ' ' + size + ' mm2 غير موجودة في الجدول.');
    var alpha = t.temp_coefficient_per_c && t.temp_coefficient_per_c[String(conductor).toLowerCase() === 'al' ? 'Al' : 'Cu'];
    return { r20: hit[1], alpha: alpha, x: t.reactance_ohm_per_km_typical };
  }

  function voltageDrop(input, tablesApi) {
    var o = input || {}, a = api(tablesApi), used = [], steps = [], extra = [];
    var size = Number(o.size_mm2), I = Number(o.currentA), L = Number(o.lengthM);
    var phases = Number(o.phases) === 1 ? 1 : 3;
    var V = pos(o.voltageV) ? o.voltageV : (phases === 1 ? 230 : 400);
    var cond = String(o.conductor || 'Cu'), ins = String(o.insulation || 'XLPE').toUpperCase();
    var pf = pos(o.powerFactor) && o.powerFactor <= 1 ? o.powerFactor : 0.85;
    if (!pos(size) || !pos(I) || !pos(L)) throw new Error('ادخل المقطع والتيار والطول (أرقام موجبة).');
    var dv, rOp = null, x = null, theta = null, methodUsed;
    var use4d1b = (o.method === '4d1b' || !o.method || o.method === 'auto') && cond.toLowerCase() === 'cu' && ins === 'PVC' && size <= 16;
    if (use4d1b) {
      var t = need(a, 'bs7671_4d1b_voltage_drop_cu_70c_upto16mm2');
      useTable(used, a, 'bs7671_4d1b_voltage_drop_cu_70c_upto16mm2');
      var row = t.rows.filter(function (r) { return r[0] === size; })[0];
      if (!row) { use4d1b = false; }
      else {
        var mv = row[col(t, phases === 1 ? '1ph_AB' : '3ph_AB')];
        dv = mv * I * L / 1000;
        methodUsed = 'bs7671_4d1b';
        steps.push({ step: 'قيمة mV/A/m من الجدول', formula: 'mV/A/m (BS 7671 4D1B, ' + (phases === 1 ? '1-phase' : '3-phase') + ')', substitution: size + ' mm2 Cu PVC 70C', result: mv + ' mV/A/m', value: mv, unit: 'mV/A/m' });
        steps.push({ step: 'هبوط الجهد', formula: 'dV = mV/A/m x I x L / 1000', substitution: mv + ' x ' + f(I) + ' x ' + f(L) + ' / 1000', result: f(dv, 3) + ' V', value: dv, unit: 'V' });
      }
    }
    if (!use4d1b) {
      var res = resistance(a, used, size, cond);
      theta = pos(o.operatingTempC) ? o.operatingTempC : (ins === 'PVC' ? 70 : 90);
      x = isNum(o.reactanceOhmKm) ? o.reactanceOhmKm : res.x;
      rOp = res.r20 * (1 + res.alpha * (theta - 20));
      var sin = Math.sqrt(Math.max(0, 1 - pf * pf)), k = phases === 1 ? 2 : Math.sqrt(3);
      dv = k * I * (L / 1000) * (rOp * pf + x * sin);
      methodUsed = 'computed_r_x';
      steps.push({ step: 'مقاومة الموصل عند درجة التشغيل', formula: 'R = R20 x (1 + a x (theta - 20))', substitution: f(res.r20, 4) + ' x (1 + ' + res.alpha + ' x (' + theta + ' - 20))', result: f(rOp, 4) + ' ohm/km', value: rOp, unit: 'ohm/km' });
      steps.push({ step: 'هبوط الجهد', formula: phases === 1 ? 'dV = 2 x I x L/1000 x (R cos(phi) + X sin(phi))' : 'dV = sqrt(3) x I x L/1000 x (R cos(phi) + X sin(phi))', substitution: (phases === 1 ? '2' : '1.732') + ' x ' + f(I) + ' x ' + f(L / 1000, 3) + ' x (' + f(rOp, 4) + ' x ' + pf + ' + ' + x + ' x ' + f(sin, 3) + ')', result: f(dv, 3) + ' V', value: dv, unit: 'V' });
      extra.push('المفاعلة X = ' + x + ' ohm/km قيمة نموذجية مش متأكد منها من معيار (الحالة needs_review): داتاشيتات الكابلات بتدي 0.081 لـ 0.094، راجعها مع داتاشيت الكابل.');
      extra.push('هبوط الجهد هنا محسوب من المقاومة والمفاعلة (مش من جدول BS 7671 4D1B)' + (size > 16 ? ': جدول 4D1B للمقاطع 25 mm2 فأكتر مش متاح في البيانات.' : ': الجدول متاح لنحاس PVC لحد 16 mm2 بس.') + ' المقاومة والمفاعلة من الذاكرة وتحتاج مراجعة.');
    }
    var pct = dv / V * 100;
    steps.push({ step: 'نسبة الهبوط', formula: 'dV% = dV / V x 100', substitution: f(dv, 3) + ' / ' + V + ' x 100', result: f(pct, 3) + ' %', value: pct, unit: '%' });
    return {
      size_mm2: size, vdropV: r3(dv), vdropPct: r3(pct), voltageV: V, phases: phases, conductor: cond,
      operatingTempC: theta, rOpOhmKm: rOp === null ? null : r3(rOp), xOhmKm: x, methodUsed: methodUsed,
      table: a.meta(use4d1b ? 'bs7671_4d1b_voltage_drop_cu_70c_upto16mm2' : 'iec_60228_conductor_resistance_20c'),
      steps: steps, tablesUsed: used, warnings: buildWarnings(used, extra),
      summary: 'هبوط الجهد: ' + f(dv, 2) + ' V (' + f(pct, 2) + ' %) | ' + size + ' mm2 ' + cond
    };
  }

  /* ---------- cable sizing ---------- */
  var AMP_TABLE = { 'PVC2': 2, 'XLPE2': 3, 'PVC3': 4, 'XLPE3': 5 };
  var METHODS = { air: 'C', ground: 'D2', duct: 'D1' };

  function ampTable(ins, cond, loaded) {
    var n = AMP_TABLE[ins + loaded];
    if (!n) throw new Error('نوع عزل غير مدعوم: ' + ins);
    return 'iec_b52_' + n + '_' + ins.toLowerCase() + '_' + cond.toLowerCase() + '_' + loaded + 'loaded';
  }

  function ambientFactor(a, used, method, ins, amb, steps) {
    var ground = method === 'D1' || method === 'D2';
    var id = ground ? 'iec_b52_15_ambient_ground_k1' : 'iec_b52_14_ambient_air_k1';
    var t = need(a, id); useTable(used, a, id);
    var base = ground ? 20 : 30;
    var c = col(t, ins === 'PVC' ? 'PVC' : 'XLPE_EPR');
    var T = isNum(amb) ? amb : base, hit = null, i;
    for (i = 0; i < t.rows.length; i++) { if (t.rows[i][0] >= T && isNum(t.rows[i][c])) { hit = t.rows[i]; break; } }
    if (!hit) throw new Error('درجة الحرارة ' + T + ' C خارج جدول التصحيح للعزل ' + ins + '.');
    steps.push({ step: 'معامل الحرارة Ca', formula: 'Ca من ' + (ground ? 'B.52.15' : 'B.52.14') + ' (أول صف >= الحرارة)', substitution: 'T = ' + T + ' C -> صف ' + hit[0] + ' C', result: f(hit[c], 2), value: hit[c], unit: '' });
    return hit[c];
  }

  var SPACING_D2 = { touching: 'touching', one_diameter: 'one_cable_diameter', '0.125': '0.125m', '0.25': '0.25m', '0.5': '0.5m' };
  var SPACING_D1 = { touching: 'ducts_touching', '0.25': '0.25m', '0.5': '0.5m', '1.0': '1.0m', '1': '1.0m' };

  function buriedGrouping(a, used, method, o, n, steps, extra) {
    var sp = String(o.spacing || 'touching');
    var id, cname;
    if (method === 'D2') {
      id = 'iec_b52_18_grouping_buried_direct_d2'; cname = SPACING_D2[sp];
    } else {
      id = String(o.ductCable) === 'single' ? 'iec_b52_19_grouping_ducts_d1_singlecore' : 'iec_b52_19_grouping_ducts_d1_multicore';
      cname = SPACING_D1[sp];
    }
    if (!cname) throw new Error('المسافة "' + sp + '" غير متاحة في جدول ' + (method === 'D2' ? 'B.52.18 (كابلات مدفونة مباشرة)' : 'B.52.19 (مواسير مدفونة)') + '.');
    var t = need(a, id); useTable(used, a, id);
    var ci = col(t, cname), rows = t.rows.slice().sort(function (p, q) { return p[0] - q[0]; }), hit = null, i;
    if (n <= 1) {
      steps.push({ step: 'معامل التجميع Cg', formula: 'دايرة واحدة: مفيش تخفيض', substitution: 'n = 1', result: '1.00', value: 1, unit: '' });
      return 1;
    }
    for (i = 0; i < rows.length; i++) { if (rows[i][0] >= n) { hit = rows[i]; break; } }
    if (!hit) { hit = rows[rows.length - 1]; extra.push('عدد الدوائر أكبر من 20: استخدمت معامل 20 دايرة.'); }
    var cg = hit[ci];
    (t.suspect_cells || []).forEach(function (sc) {
      if (sc.n_circuits === hit[0] && sc.column === cname) extra.push('القيمة المستخدمة من الجدول ' + id + ' (' + sc.n_circuits + ' دوائر، ' + sc.column + ') ظاهرة في النسخة المنشورة بشكل غير متسق (' + sc.reason + '). راجع الجدول الرسمي.');
    });
    steps.push({ step: 'معامل التجميع Cg', formula: 'Cg من ' + (method === 'D2' ? 'B.52.18' : 'B.52.19') + ' (أول عدد >= عدد الدوائر، المسافة ' + sp + ')', substitution: n + ' دايرة -> صف ' + hit[0] + ' | عمود ' + cname, result: f(cg, 2), value: cg, unit: '' });
    return cg;
  }

  function groupingFactor(a, used, method, o, steps, extra) {
    var circuits = o.circuits;
    var n = pos(circuits) ? Math.round(circuits) : 1;
    if (method === 'D1' || method === 'D2') return buriedGrouping(a, used, method, o, n, steps, extra);
    var t = need(a, 'iec_b52_17_grouping_k2'); useTable(used, a, 'iec_b52_17_grouping_k2');
    var item = t.items['1_bunched_in_air_surface_embedded_enclosed'];
    var idx = -1, i;
    for (i = 0; i < t.n_circuits.length; i++) { if (t.n_circuits[i] >= n) { idx = i; break; } }
    if (idx < 0) { idx = t.n_circuits.length - 1; extra.push('عدد الدوائر أكبر من 20: استخدمت معامل 20 دايرة.'); }
    var cg = item[idx];
    steps.push({ step: 'معامل التجميع Cg', formula: 'Cg من B.52.17 بند 1 (مجمعة، أول عدد >= عدد الدوائر)', substitution: n + ' دايرة -> ' + t.n_circuits[idx], result: f(cg, 2), value: cg, unit: '' });
    return cg;
  }

  function cableSizing(input, tablesApi) {
    var o = input || {}, a = api(tablesApi), used = [], steps = [], extra = [];
    var d = designCurrent(o, steps);
    var ins = String(o.insulation || 'XLPE').toUpperCase(), cond = String(o.conductor || 'Cu');
    var loaded = d.phases === 1 ? 2 : 3;
    var mkey = METHODS[String(o.method || 'air').toLowerCase()] || String(o.method).toUpperCase();
    var tid = ampTable(ins, cond, loaded);
    var t = need(a, tid); useTable(used, a, tid);
    var mc = col(t, mkey);
    var ca = ambientFactor(a, used, mkey, ins, o.ambientC, steps);
    var cg = groupingFactor(a, used, mkey, o, steps, extra);
    var ct = ca * cg;
    steps.push({ step: 'المعامل الكلي', formula: 'Ct = Ca x Cg', substitution: f(ca, 2) + ' x ' + f(cg, 2), result: f(ct, 3), value: ct, unit: '' });
    var minIn = d.Ib * (pos(o.safetyFactor) ? o.safetyFactor : 1);
    var br = pos(o.inA) ? { type: String(o.breakerType || 'MCB').toUpperCase(), rating: o.inA } : pickBreaker(a, o.breakerType || 'any', minIn, used);
    if (!br) throw new Error('مفيش قاطع قياسي مناسب للتيار ' + f(d.Ib) + ' A.');
    steps.push({ step: 'القاطع المختار In', formula: 'Ib <= In (أقرب قيمة قياسية)', substitution: f(d.Ib) + ' A -> ' + br.type, result: 'In = ' + br.rating + ' A', value: br.rating, unit: 'A' });
    var izReq = br.rating / ct;
    steps.push({ step: 'السعة المطلوبة من الجدول', formula: 'Iz_tab >= In / Ct', substitution: br.rating + ' / ' + f(ct, 3), result: f(izReq) + ' A', value: izReq, unit: 'A' });
    var rows = t.rows.slice().sort(function (p, q) { return p[0] - q[0]; });
    var useVd = pos(o.lengthM) && pos(o.maxVdropPct);
    var chosen = null, vd = null, upsized = false, i, firstOk = null;
    for (i = 0; i < rows.length; i++) {
      var tab = rows[i][mc];
      if (!isNum(tab) || tab < izReq) continue;
      if (!firstOk) firstOk = rows[i];
      if (useVd) {
        var tmp = voltageDrop({ size_mm2: rows[i][0], currentA: d.Ib, lengthM: o.lengthM, voltageV: d.V, phases: d.phases, conductor: cond, insulation: ins, powerFactor: d.pf, operatingTempC: o.operatingTempC }, a);
        if (tmp.vdropPct > o.maxVdropPct) { vd = tmp; continue; }
        vd = tmp;
      }
      chosen = rows[i]; break;
    }
    if (!chosen) {
      return {
        compliant: false, size_mm2: null, baseAmpacityA: null, deratedAmpacityA: null,
        designCurrentA: r2(d.Ib), requiredBaseAmpacityA: r2(izReq), factors: { ca: ca, cg: cg, combined: r3(ct) },
        table: a.meta(tid), vdrop: vd, breaker: { rating_a: br.rating, type: br.type },
        steps: steps, tablesUsed: used, warnings: buildWarnings(used, extra.concat(['مفيش مقطع في الجدول يحقق الشروط (السعة أو هبوط الجهد). قسّم على كابلين أو غيّر الشروط.'])),
        summary: 'مفيش مقطع مناسب في الجدول'
      };
    }
    upsized = firstOk && chosen[0] !== firstOk[0];
    var base = chosen[mc], iz = base * ct;
    steps.push({ step: 'اختيار المقطع', formula: 'Iz_tab >= In / Ct', substitution: tid + ' [' + mkey + '] : ' + base + ' A >= ' + f(izReq) + ' A', result: chosen[0] + ' mm2' + (upsized ? ' (اترفع من ' + firstOk[0] + ' mm2 بسبب هبوط الجهد)' : ''), value: chosen[0], unit: 'mm2' });
    steps.push({ step: 'تحقق الحماية', formula: 'Ib <= In <= Iz', substitution: f(d.Ib) + ' <= ' + br.rating + ' <= ' + f(iz) + ' (Iz = ' + base + ' x ' + f(ct, 3) + ')', result: (d.Ib <= br.rating && br.rating <= iz) ? 'متحقق' : 'غير متحقق', value: br.rating <= iz, unit: '' });
    if (useVd && vd) {
      steps.push({ step: 'تحقق هبوط الجهد', formula: 'dV% <= الحد', substitution: f(vd.vdropPct, 2) + ' % <= ' + o.maxVdropPct + ' %', result: vd.vdropPct <= o.maxVdropPct ? 'متحقق' : 'غير متحقق', value: vd.vdropPct, unit: '%' });
      vd.steps.forEach(function (s) { steps.push({ step: 'هبوط الجهد: ' + s.step, formula: s.formula, substitution: s.substitution, result: s.result, value: s.value, unit: s.unit }); });
      vd.warnings.forEach(function (w) { if (extra.indexOf(w) < 0 && w.indexOf('نسخة منشورة') < 0) extra.push(w); });
      vd.tablesUsed.forEach(function (u) { if (!used.some(function (x) { return x.id === u.id; })) used.push(u); });
    } else if (!useVd) {
      extra.push('هبوط الجهد لم يتحقق منه (الطول أو الحد غير مدخل).');
    }
    extra.push('لم تُحسب شروط short-circuit (I2t) ولا طريقة التركيب بالتفصيل. راجع.');
    return {
      compliant: true, size_mm2: chosen[0], baseAmpacityA: base, deratedAmpacityA: r2(iz),
      designCurrentA: r2(d.Ib), requiredBaseAmpacityA: r2(izReq), factors: { ca: ca, cg: cg, combined: r3(ct) },
      table: a.meta(tid), vdrop: vd, breaker: { rating_a: br.rating, type: br.type },
      steps: steps, tablesUsed: used, warnings: buildWarnings(used, extra),
      summary: 'المقطع: ' + chosen[0] + ' mm2 | القاطع: ' + br.rating + ' A | Iz = ' + f(iz, 1) + ' A | Ib = ' + f(d.Ib, 1) + ' A' + (vd ? ' | dV = ' + f(vd.vdropPct, 2) + ' %' : '')
    };
  }

  /* ---------- short-circuit withstand (adiabatic, I2t <= k2 S2) ---------- */
  function shortCircuit(input, tablesApi) {
    var o = input || {}, a = api(tablesApi), used = [], steps = [], extra = [];
    var S = Number(o.size_mm2), Isc = Number(o.iscKA) * 1000;
    if (!pos(S) || !pos(Isc)) throw new Error('ادخل المقطع (mm2) وتيار القصر Isc (kA).');
    var ins = String(o.insulation || 'XLPE').toUpperCase(), cond = String(o.conductor || 'Cu').toLowerCase() === 'al' ? 'al' : 'cu';
    var kt = need(a, 'iec_60364_4_43_k_factors'); useTable(used, a, 'iec_60364_4_43_k_factors');
    var key = ins === 'PVC' ? (S > 300 ? 'PVC_over_300mm2' : 'PVC_up_to_300mm2') : 'XLPE_EPR';
    var krow = kt.rows.filter(function (r) { return r[0] === key; })[0];
    var k = krow[cond === 'al' ? 2 : 1];
    steps.push({ step: 'ثابت k', formula: 'k من IEC 60364-4-43 Table 43A (' + key + ', ' + (cond === 'al' ? 'Al' : 'Cu') + ', ' + krow[3] + ' إلى ' + krow[4] + ' C)', substitution: key + ' / ' + cond.toUpperCase(), result: k + ' A.s^0.5/mm2', value: k, unit: 'A.s^0.5/mm2' });
    var withstand = k * k * S * S;
    steps.push({ step: 'تحمل الكابل', formula: 'I2t_cable = k^2 x S^2', substitution: k + '^2 x ' + S + '^2', result: f(withstand / 1e6, 4) + ' x 10^6 A2s', value: withstand, unit: 'A2s' });
    var letThrough, basis, t = null;
    if (pos(o.letThroughKA2s)) {
      letThrough = o.letThroughKA2s * 1e6;
      basis = 'datasheet';
      steps.push({ step: 'طاقة القاطع I2t (من بيانات المصنع)', formula: 'I2t_device = القيمة المدخلة', substitution: f(o.letThroughKA2s, 4) + ' kA2s x 10^6', result: f(letThrough / 1e6, 4) + ' x 10^6 A2s', value: letThrough, unit: 'A2s' });
    } else if (pos(o.clearingTimeS)) {
      t = o.clearingTimeS;
      letThrough = Isc * Isc * t;
      basis = 'time';
      steps.push({ step: 'طاقة القصر المتوقعة', formula: 'I2t = Isc^2 x t', substitution: f(Isc / 1000, 2) + ' kA ^2 x ' + t + ' s', result: f(letThrough / 1e6, 4) + ' x 10^6 A2s', value: letThrough, unit: 'A2s' });
      if (t > 5) extra.push('زمن القطع أكبر من 5 ثواني: المعادلة الأديباتيكية غير صالحة، استخدم منحنى التحمل الحراري للكابل.');
      if (t < 0.1) extra.push('زمن القطع أقل من 0.1 ثانية: لازم تستخدم قيمة I2t الفعلية للقاطع من بيانات المصنع (الطاقة المحدودة) بدل Isc^2 x t.');
    } else {
      throw new Error('ادخل طاقة القاطع I2t (kA2s) من بيانات المصنع أو زمن القطع (s).');
    }
    var ok = letThrough <= withstand;
    steps.push({ step: 'التحقق', formula: 'I2t_device <= k^2 x S^2', substitution: f(letThrough / 1e6, 4) + ' x 10^6 <= ' + f(withstand / 1e6, 4) + ' x 10^6', result: ok ? 'الكابل يتحمل (متحقق)' : 'الكابل لا يتحمل (غير متحقق)', value: ok, unit: '' });
    var Smin = Math.sqrt(letThrough) / k;
    steps.push({ step: 'أقل مقطع مطلوب', formula: 'S_min = sqrt(I2t) / k', substitution: 'sqrt(' + f(letThrough / 1e6, 4) + ' x 10^6) / ' + k, result: f(Smin, 2) + ' mm2', value: Smin, unit: 'mm2' });
    var tmax = withstand / (Isc * Isc);
    steps.push({ step: 'أقصى زمن قطع مسموح عند Isc', formula: 't_max = k^2 S^2 / Isc^2', substitution: f(withstand / 1e6, 4) + ' x 10^6 / (' + f(Isc / 1000, 2) + ' kA)^2', result: f(tmax, 3) + ' s', value: tmax, unit: 's' });
    if (basis === 'time') extra.push('طاقة القاطع محسوبة من زمن القطع المدخل (تقدير). للاعتماد استخدم I2t الفعلي من بيانات المصنع عند Isc.');
    extra.push('جدول طاقة القاطع (let-through) غير موجود في البيانات: القيمة المدخلة من المستخدم أو من بيانات المصنع.');
    return {
      ok: ok, size_mm2: S, k: k, withstandA2s: withstand, letThroughA2s: letThrough, minSizeMm2: r2(Smin), maxTimeS: r3(tmax), basis: basis,
      table: a.meta('iec_60364_4_43_k_factors'), steps: steps, tablesUsed: used, warnings: buildWarnings(used, extra),
      summary: (ok ? 'الكابل يتحمل: ' : 'الكابل لا يتحمل: ') + S + ' mm2 | k^2S^2 = ' + f(withstand / 1e6, 4) + 'e6 A2s | I2t القاطع = ' + f(letThrough / 1e6, 4) + 'e6 A2s | أقل مقطع ' + f(Smin, 2) + ' mm2'
    };
  }

  window.EngCalc = { cableSizing: cableSizing, voltageDrop: voltageDrop, breakerSelection: breakerSelection, shortCircuit: shortCircuit };
})();
