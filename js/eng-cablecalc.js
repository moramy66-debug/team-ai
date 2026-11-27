/* Eng Calc "Direct Formulas" tab: direct hand formulas when the user already has the factors.
   Methods: design current from kW, required tabulated ampacity from In / (Ca x Cg), voltage drop from given R and X,
   voltage drop from given mV/A/m, the continuous-load multiplier, generator voltage dip from given kVA and Xd, and cable tray fill for mixed cables. Every result is needs_review.
   No tables are read and no standard or clause numbers are quoted. */
(function () {
  'use strict';
  var S3 = Math.sqrt(3);
  function num(x) { var n = Number(x); return (x === '' || x === null || x === undefined) ? NaN : (isFinite(n) ? n : NaN); }
  function given(x) { return !(x === '' || x === null || x === undefined || (typeof x === 'number' && isNaN(x))); }
  function pos(x) { return isFinite(x) && x > 0; }
  function r(x, d) { var p = Math.pow(10, d); return Math.round(x * p) / p; }
  function fail(msg) { return { ok: false, error: msg }; }
  var WARN = 'تحذير: النتيجة بمعادلة يدوية بالقيم اللي انت دخلتها (needs_review). القيم والمعاملات مسؤوليتك ولازم تتراجع من الجدول والـ Datasheet المعتمدين قبل الاعتماد.';

  function phasesOf(o) { var p = given(o.phases) ? num(o.phases) : 3; return (p === 1 || p === 3) ? p : NaN; }

  function calculate(o) {
    o = o || {};
    var method = o.method || 'ib';
    var steps = [], extra = [], warnings = [WARN], res = { ok: true, method: method };

    if (method === 'ib') {
      var P = num(o.kw), V = num(o.voltageV), ph = phasesOf(o), pf = num(o.pf);
      var effGiven = given(o.eff), eff = effGiven ? num(o.eff) : 1;
      if (!pos(P)) return fail('Power (kW) لازم يكون رقم أكبر من صفر.');
      if (!pos(V)) return fail('Voltage (V) لازم يكون رقم أكبر من صفر.');
      if (isNaN(ph)) return fail('Phases لازم تكون 1 أو 3.');
      if (!(pf > 0 && pf <= 1)) return fail('Power Factor لازم يكون أكبر من 0 وأقل من أو يساوي 1.');
      if (effGiven && !(eff > 0 && eff <= 1)) return fail('Efficiency لازم تكون أكبر من 0 وأقل من أو يساوي 1. سيبها فاضية لو مش عايز تستخدمها.');
      var k = ph === 3 ? S3 : 1;
      var ib = (P * 1000) / (k * V * pf * eff);
      steps.push({ step: 'Design Current Ib', formula: ph === 3 ? 'Ib = P x 1000 / (sqrt(3) x V x PF x eff)' : 'Ib = P x 1000 / (V x PF x eff)', substitution: P + ' x 1000 / (' + (ph === 3 ? 'sqrt(3) x ' : '') + V + ' x ' + pf + ' x ' + eff + ')', result: r(ib, 3) + ' A', value: ib, unit: 'A' });
      if (!effGiven) warnings.push('Efficiency فاضية فاتحسبت 1.0 (يعني P هي الـ Input الكهربائي). لو P هي قدرة العمود (Shaft) للمحرك ادخل الـ Efficiency.');
      extra.push({ k: 'Ib', v: r(ib, 2) + ' A' });
      res.ibA = ib;
      res.summary = 'Ib = ' + r(ib, 2) + ' A (needs_review)';
    } else if (method === 'it') {
      var In = num(o.inA), ca = num(o.ca), cg = num(o.cg);
      if (!pos(In)) return fail('Breaker In (A) لازم يكون رقم أكبر من صفر.');
      if (!pos(ca)) return fail('Ca لازم يكون رقم أكبر من صفر.');
      if (!pos(cg)) return fail('Cg لازم يكون رقم أكبر من صفر.');
      var it = In / (ca * cg);
      steps.push({ step: 'Required Tabulated Ampacity It', formula: 'It = In / (Ca x Cg)', substitution: In + ' / (' + ca + ' x ' + cg + ')', result: r(it, 3) + ' A', value: it, unit: 'A' });
      if (ca > 1.5 || cg > 1) warnings.push('Ca أو Cg أكبر من المعتاد. راجع القيم من الجدول.');
      extra.push({ k: 'It', v: r(it, 2) + ' A' });
      res.itA = it;
      res.summary = 'It = ' + r(it, 2) + ' A (needs_review)';
    } else if (method === 'vdrx' || method === 'vdmv') {
      var I = num(o.currentA), L = num(o.lengthM), Vn = num(o.voltageV), ph2 = phasesOf(o);
      if (!pos(I)) return fail('Current (A) لازم يكون رقم أكبر من صفر.');
      if (!pos(L)) return fail('Length (m) لازم يكون رقم أكبر من صفر.');
      if (!pos(Vn)) return fail('Voltage (V) لازم يكون رقم أكبر من صفر.');
      if (isNaN(ph2)) return fail('Phases لازم تكون 1 أو 3.');
      var dv;
      if (method === 'vdrx') {
        var R = num(o.rOhmKm), pf2 = num(o.pf);
        var xGiven = given(o.xOhmKm), X = xGiven ? num(o.xOhmKm) : 0;
        if (!pos(R)) return fail('R (ohm/km) لازم يكون رقم أكبر من صفر.');
        if (xGiven && !(X >= 0)) return fail('X (ohm/km) لازم يكون صفر أو أكبر.');
        if (!(pf2 > 0 && pf2 <= 1)) return fail('Power Factor لازم يكون أكبر من 0 وأقل من أو يساوي 1.');
        var sin = Math.sqrt(1 - pf2 * pf2);
        var kk = ph2 === 3 ? S3 : 2;
        var Lk = L / 1000;
        dv = kk * I * Lk * (R * pf2 + X * sin);
        steps.push({ step: 'sin(phi)', formula: 'sin(phi) = sqrt(1 - PF^2)', substitution: 'sqrt(1 - ' + pf2 + '^2)', result: r(sin, 4), value: sin, unit: '' });
        steps.push({ step: 'Voltage Drop', formula: (ph2 === 3 ? 'dV = sqrt(3)' : 'dV = 2') + ' x I x L(km) x (R x PF + X x sin(phi))', substitution: (ph2 === 3 ? 'sqrt(3)' : '2') + ' x ' + I + ' x ' + r(Lk, 4) + ' x (' + R + ' x ' + pf2 + ' + ' + X + ' x ' + r(sin, 4) + ')', result: r(dv, 3) + ' V', value: dv, unit: 'V' });
        if (!xGiven) warnings.push('X فاضية فاتحسبت صفر (Resistive بس). ادخل X لو متاحة.');
      } else {
        var mv = num(o.mvAm);
        if (!pos(mv)) return fail('mV/A/m لازم يكون رقم أكبر من صفر.');
        dv = (mv * I * L) / 1000;
        steps.push({ step: 'Voltage Drop', formula: 'dV = (mV/A/m x I x L) / 1000', substitution: '(' + mv + ' x ' + I + ' x ' + L + ') / 1000', result: r(dv, 3) + ' V', value: dv, unit: 'V' });
        warnings.push('قيمة mV/A/m المدخلة بتفترض إنها تخص نفس عدد الـ Phases والكابل. راجعها من الـ Datasheet.');
      }
      var pct = dv / Vn * 100;
      steps.push({ step: 'Voltage Drop %', formula: 'dV% = dV / V x 100', substitution: r(dv, 3) + ' / ' + Vn + ' x 100', result: r(pct, 3) + ' %', value: pct, unit: '%' });
      extra.push({ k: 'dV', v: r(dv, 2) + ' V (' + r(pct, 2) + ' %)' });
      res.vdropV = dv; res.vdropPct = pct;
      res.summary = 'dV = ' + r(dv, 2) + ' V = ' + r(pct, 2) + ' % (needs_review)';
    } else if (method === 'cont') {
      var Ic = num(o.contA), Inc = given(o.nonContA) ? num(o.nonContA) : 0, m = num(o.mult);
      if (!pos(Ic)) return fail('Continuous load (A) لازم يكون رقم أكبر من صفر.');
      if (!(Inc >= 0)) return fail('Non-continuous load (A) لازم يكون صفر أو أكبر.');
      if (!(m >= 1)) return fail('Continuous multiplier لازم يكون 1 أو أكبر (مثلا 1.25). ادخله بنفسك.');
      var req = Ic * m + Inc;
      steps.push({ step: 'Required Rating', formula: 'I_req = I_cont x multiplier + I_noncont', substitution: Ic + ' x ' + m + ' + ' + Inc, result: r(req, 3) + ' A', value: req, unit: 'A' });
      warnings.push('الـ multiplier اللي دخلته فرضية منك ومش مسجل لها مصدر في التطبيق (needs_review). مفيش اختيار لحجم Breaker قياسي هنا.');
      extra.push({ k: 'I_req', v: r(req, 2) + ' A' });
      res.requiredA = req;
      res.summary = 'I_req = ' + r(req, 2) + ' A (needs_review)';
    } else if (method === 'dip') {
      var Ss = num(o.startKva), Gk = num(o.genKva), xd = num(o.xdPu);
      if (!pos(Ss)) return fail('Motor start (kVA) لازم يكون رقم أكبر من صفر.');
      if (!pos(Gk)) return fail('Generator (kVA) لازم يكون رقم أكبر من صفر.');
      if (!(xd > 0 && xd <= 1)) return fail('Xd (pu) لازم يكون أكبر من 0 وأقل من أو يساوي 1 (مثلا 0.15). ادخله بنفسك.');
      var sx = Ss * xd, dip = sx / (Gk + sx) * 100;
      steps.push({ step: 'Voltage Dip', formula: 'Dip% = (S_start x Xd) / (S_gen + S_start x Xd) x 100', substitution: '(' + Ss + ' x ' + xd + ') / (' + Gk + ' + ' + Ss + ' x ' + xd + ') x 100', result: r(dip, 3) + ' %', value: dip, unit: '%' });
      warnings.push('معادلة Voltage Dip تقريبية وغير مربوطة بمعيار في التطبيق، وقيمة Xd من عندك (needs_review). راجع بيانات المصنع.');
      extra.push({ k: 'Dip', v: r(dip, 2) + ' %' });
      res.dipPct = dip;
      res.summary = 'Dip = ' + r(dip, 2) + ' % (needs_review)';
    } else if (method === 'trayfill') {
      var groups = o.groups || [], tot = 0, W = num(o.widthMm), D = num(o.depthMm), parts = [], used = 0;
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi] || {};
        if (!given(g.count) && !given(g.odMm)) continue;
        var n = num(g.count), od = num(g.odMm);
        if (!pos(n) || Math.floor(n) !== n) return fail('Cable group ' + (gi + 1) + ': العدد لازم يكون رقم صحيح أكبر من صفر.');
        if (!pos(od)) return fail('Cable group ' + (gi + 1) + ': القطر الخارجي (mm) لازم يكون أكبر من صفر.');
        var area = n * Math.PI * od * od / 4;
        tot += area; used++;
        steps.push({ step: 'Cable group ' + (gi + 1), formula: 'A = n x pi x OD^2 / 4', substitution: n + ' x pi x ' + od + '^2 / 4', result: r(area, 3) + ' mm2', value: area, unit: 'mm2' });
      }
      if (!used) return fail('ادخل Cable group واحد على الأقل (العدد والقطر).');
      if (!pos(W)) return fail('Tray width (mm) لازم يكون رقم أكبر من صفر.');
      if (!pos(D)) return fail('Tray depth (mm) لازم يكون رقم أكبر من صفر.');
      var fill = tot / (W * D) * 100;
      steps.push({ step: 'Total Cable Area', formula: 'A_total = sum of groups', substitution: 'sum of ' + used + ' group(s)', result: r(tot, 3) + ' mm2', value: tot, unit: 'mm2' });
      steps.push({ step: 'Fill %', formula: 'Fill% = A_total / (W x D) x 100', substitution: r(tot, 3) + ' / (' + W + ' x ' + D + ') x 100', result: r(fill, 3) + ' %', value: fill, unit: '%' });
      warnings.push('النتيجة مساحة مقاطع الكابلات على مساحة الحامل بس، من غير مسافات أو ترتيب. مفيش حد Fill مسجل هنا (needs_review).');
      extra.push({ k: 'Total area', v: r(tot, 1) + ' mm2' }, { k: 'Fill', v: r(fill, 2) + ' %' });
      res.totalAreaMm2 = tot; res.fillPct = fill;
      res.summary = 'Area = ' + r(tot, 1) + ' mm2 | Fill = ' + r(fill, 2) + ' % (needs_review)';
    } else {
      return fail('Method غير معروف.');
    }
    res.steps = steps; res.extra = extra; res.warnings = warnings;
    res.used = [];
    return res;
  }

  function register() {
    if (typeof document === 'undefined' || !window.EngUI || typeof window.EngUI.registerTab !== 'function' || !window.EngUI.helpers) return false;
    var h = window.EngUI.helpers;
    window.EngUI.registerTab('cablecalc', 'Direct Formulas', function (body) {
      body.appendChild(h.el('div', 'ec-note', WARN));
      var grid = h.el('div', 'ec-grid');
      grid.appendChild(h.createField('cf-m', 'Method', 'select', [
        { value: 'ib', label: 'Design Current Ib from kW', selected: true },
        { value: 'it', label: 'Required It = In / (Ca x Cg)' },
        { value: 'vdrx', label: 'Voltage Drop from given R, X' },
        { value: 'vdmv', label: 'Voltage Drop from given mV/A/m' },
        { value: 'cont', label: 'Continuous load multiplier' },
        { value: 'dip', label: 'Generator Voltage Dip (given kVA, Xd)' },
        { value: 'trayfill', label: 'Cable Tray fill, mixed cables' }
      ]));
      grid.appendChild(h.createField('cf-kw', 'Ib: Power (kW)', 'number', ''));
      grid.appendChild(h.createField('cf-eff', 'Ib: Efficiency (0-1) - blank = not used', 'number', ''));
      grid.appendChild(h.createField('cf-in', 'It: Breaker In (A)', 'number', ''));
      grid.appendChild(h.createField('cf-ca', 'It: Ca', 'number', ''));
      grid.appendChild(h.createField('cf-cg', 'It: Cg', 'number', ''));
      grid.appendChild(h.createField('cf-i', 'Vdrop: Current (A)', 'number', ''));
      grid.appendChild(h.createField('cf-len', 'Vdrop: Length (m)', 'number', ''));
      grid.appendChild(h.createField('cf-r', 'Vdrop: R (ohm/km)', 'number', ''));
      grid.appendChild(h.createField('cf-x', 'Vdrop: X (ohm/km) - blank = 0', 'number', ''));
      grid.appendChild(h.createField('cf-mv', 'Vdrop: mV/A/m', 'number', ''));
      grid.appendChild(h.createField('cf-ic', 'Continuous load (A)', 'number', ''));
      grid.appendChild(h.createField('cf-inc', 'Non-continuous load (A) - optional', 'number', ''));
      grid.appendChild(h.createField('cf-mult', 'Continuous multiplier (assumption, needs_review)', 'number', '1.25'));
      grid.appendChild(h.createField('cf-sk', 'Dip: Motor start (kVA)', 'number', ''));
      grid.appendChild(h.createField('cf-gk', 'Dip: Generator (kVA)', 'number', ''));
      grid.appendChild(h.createField('cf-xd', 'Dip: Xd (pu, e.g. 0.15)', 'number', ''));
      grid.appendChild(h.createField('cf-n1', 'Tray: Group 1 count', 'number', ''));
      grid.appendChild(h.createField('cf-d1', 'Tray: Group 1 OD (mm)', 'number', ''));
      grid.appendChild(h.createField('cf-n2', 'Tray: Group 2 count - optional', 'number', ''));
      grid.appendChild(h.createField('cf-d2', 'Tray: Group 2 OD (mm)', 'number', ''));
      grid.appendChild(h.createField('cf-n3', 'Tray: Group 3 count - optional', 'number', ''));
      grid.appendChild(h.createField('cf-d3', 'Tray: Group 3 OD (mm)', 'number', ''));
      grid.appendChild(h.createField('cf-tw', 'Tray: Width (mm)', 'number', ''));
      grid.appendChild(h.createField('cf-td', 'Tray: Depth (mm)', 'number', ''));
      grid.appendChild(h.createField('cf-v', 'Voltage V (V)', 'number', '400'));
      grid.appendChild(h.createField('cf-ph', 'Phases (1 or 3)', 'number', '3'));
      grid.appendChild(h.createField('cf-pf', 'Power Factor (0-1)', 'number', '0.85'));
      body.appendChild(grid);
      var btn = h.el('button', 'ec-btn', 'Calculate Formula');
      btn.type = 'button';
      body.appendChild(btn);
      var out = h.el('div', 'ec-out');
      body.appendChild(out);
      btn.addEventListener('click', function () {
        out.innerHTML = '';
        var res = calculate({
          method: h.val('cf-m'), kw: h.numVal('cf-kw'), eff: h.numVal('cf-eff'), inA: h.numVal('cf-in'), ca: h.numVal('cf-ca'), cg: h.numVal('cf-cg'),
          currentA: h.numVal('cf-i'), lengthM: h.numVal('cf-len'), rOhmKm: h.numVal('cf-r'), xOhmKm: h.numVal('cf-x'), mvAm: h.numVal('cf-mv'),
          contA: h.numVal('cf-ic'), nonContA: h.numVal('cf-inc'), mult: h.numVal('cf-mult'),
          startKva: h.numVal('cf-sk'), genKva: h.numVal('cf-gk'), xdPu: h.numVal('cf-xd'), widthMm: h.numVal('cf-tw'), depthMm: h.numVal('cf-td'),
          groups: [{ count: h.numVal('cf-n1'), odMm: h.numVal('cf-d1') }, { count: h.numVal('cf-n2'), odMm: h.numVal('cf-d2') }, { count: h.numVal('cf-n3'), odMm: h.numVal('cf-d3') }],
          voltageV: h.numVal('cf-v'), phases: h.numVal('cf-ph'), pf: h.numVal('cf-pf')
        });
        h.showResult(out, res, 'Direct Formulas');
        if (res.ok) { var st = h.el('div', null); h.renderResultActions(out, st); out.appendChild(st); }
      });
    });
    return true;
  }

  window.EngCableCalc = { calculate: calculate, register: register };
  if (typeof document !== 'undefined') {
    if (!register()) { var n = 0; var iv = setInterval(function () { if (register() || ++n > 40) clearInterval(iv); }, 100); }
  }
})();
