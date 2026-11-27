/* Eng Calc "Isc Network" tab: network short-circuit current by the MVA method, a given fault level, the ohmic method,
   and the peak current with a given kappa. Hand formulas only. Every value is needs_review (guide values, not a study).
   No standard or clause numbers are quoted. */
(function () {
  'use strict';
  var S3 = Math.sqrt(3);
  function num(x) { var n = Number(x); return (x === '' || x === null || x === undefined) ? NaN : (isFinite(n) ? n : NaN); }
  function pos(x) { return isFinite(x) && x > 0; }
  function r(x, d) { var p = Math.pow(10, d); return Math.round(x * p) / p; }
  function fail(msg) { return { ok: false, error: msg }; }
  var WARN = [
    'تحذير: النتيجة تقديرية (needs_review). الحساب بسيط ولا يشمل مساهمة المحركات ولا تفاصيل الشبكة. لازم Short-circuit Study وبيانات شركة الكهرباء قبل الاعتماد.'
  ];

  function calculate(o) {
    o = o || {};
    var method = o.method || 'mva';
    var V = num(o.vLL);
    if (!pos(V)) return fail('Line voltage (V) لازم يكون رقم أكبر من صفر.');
    var steps = [], extra = [], warnings = WARN.slice(), res = { ok: true }, ik = NaN;
    if (method === 'mva' || method === 'mvasc') {
      var mvaSc;
      if (method === 'mvasc') {
        mvaSc = num(o.mvaSc);
        if (!pos(mvaSc)) return fail('Fault level (MVA) لازم يكون رقم أكبر من صفر.');
        steps.push({ step: 'Fault level المعطى', formula: 'MVA_sc (given)', substitution: String(mvaSc), result: r(mvaSc, 3) + ' MVA' });
      } else {
        var txKva = num(o.txKva), z = num(o.txZPct);
        if (!pos(txKva)) return fail('Transformer kVA لازم يكون رقم أكبر من صفر.');
        if (!pos(z)) return fail('Transformer Z (%) لازم يكون رقم أكبر من صفر.');
        var mvaTx = (txKva / 1000) / (z / 100);
        steps.push({ step: 'Transformer fault level', formula: 'MVA_tx = (kVA / 1000) / (Z% / 100)', substitution: '(' + txKva + ' / 1000) / (' + z + ' / 100)', result: r(mvaTx, 3) + ' MVA' });
        var gridRaw = o.gridMva, hasGrid = !(gridRaw === undefined || gridRaw === null || gridRaw === '');
        if (hasGrid) {
          var g = num(gridRaw);
          if (!pos(g)) return fail('Grid fault level (MVA) لازم يكون رقم أكبر من صفر (أو سيبه فاضي لشبكة لانهائية).');
          mvaSc = 1 / (1 / g + 1 / mvaTx);
          steps.push({ step: 'Grid + Transformer', formula: 'MVA_sc = 1 / (1/MVA_grid + 1/MVA_tx)', substitution: '1 / (1/' + g + ' + 1/' + r(mvaTx, 3) + ')', result: r(mvaSc, 3) + ' MVA' });
        } else {
          mvaSc = mvaTx;
          warnings.push('Grid fault level فاضي: الشبكة اتحسبت لانهائية (Infinite Bus). النتيجة أعلى من الواقع.');
        }
      }
      ik = mvaSc * 1000 / (S3 * V);
      steps.push({ step: 'Short-circuit current', formula: 'Isc = MVA_sc x 1000 / (sqrt(3) x V)', substitution: r(mvaSc, 3) + ' x 1000 / (sqrt(3) x ' + V + ')', result: r(ik, 3) + ' kA' });
      res.mvaSc = mvaSc;
    } else if (method === 'ohmic') {
      var R = num(o.rOhm), X = num(o.xOhm);
      var len = num(o.cableLenM), rc = num(o.rCableOhmKm), xc = num(o.xCableOhmKm);
      var hasCable = isFinite(len) || isFinite(rc) || isFinite(xc);
      if (!isFinite(R)) R = 0; if (!isFinite(X)) X = 0;
      if (R < 0 || X < 0) return fail('R و X لازم يكونوا صفر أو أكبر.');
      var Rt = R, Xt = X;
      if (hasCable) {
        if (!(isFinite(len) && len > 0 && isFinite(rc) && rc >= 0 && isFinite(xc) && xc >= 0)) return fail('للـ Cable: ادخل Length أكبر من صفر و R و X (ohm/km) صفر أو أكبر.');
        var Rc = rc * len / 1000, Xc = xc * len / 1000;
        steps.push({ step: 'Cable impedance', formula: 'Rc = r x L / 1000 ; Xc = x x L / 1000', substitution: rc + ' x ' + len + ' / 1000 ; ' + xc + ' x ' + len + ' / 1000', result: 'Rc = ' + r(Rc, 5) + ' ohm ; Xc = ' + r(Xc, 5) + ' ohm' });
        Rt = R + Rc; Xt = X + Xc;
      }
      var Z = Math.sqrt(Rt * Rt + Xt * Xt);
      if (!pos(Z)) return fail('Total impedance صفر: التيار لانهائي. ادخل R أو X أكبر من صفر.');
      var c = num(o.cFactor); if (!isFinite(c)) { c = 1; warnings.push('Voltage factor c فاضي: اتحسب c = 1.0 (assumption، needs_review).'); }
      if (!(c > 0 && c <= 1.5)) return fail('Voltage factor c لازم يكون أكبر من صفر وأقل من أو يساوي 1.5.');
      steps.push({ step: 'Total impedance', formula: 'Z = sqrt(Rt^2 + Xt^2)', substitution: 'sqrt(' + r(Rt, 5) + '^2 + ' + r(Xt, 5) + '^2)', result: r(Z, 5) + ' ohm' });
      ik = c * V / S3 / Z / 1000;
      steps.push({ step: 'Short-circuit current (3-phase)', formula: 'Isc = c x V / (sqrt(3) x Z) / 1000', substitution: c + ' x ' + V + ' / (sqrt(3) x ' + r(Z, 5) + ') / 1000', result: r(ik, 3) + ' kA' });
      res.zTotalOhm = Z;
    } else if (method === 'peak') {
      ik = num(o.ikKa);
      if (!pos(ik)) return fail('Symmetrical Isc (kA) لازم يكون أكبر من صفر.');
      steps.push({ step: 'Symmetrical Isc المعطى', formula: 'Ik (given)', substitution: String(ik), result: r(ik, 3) + ' kA' });
    } else {
      return fail('Method غير معروف.');
    }
    res.iscKA = ik;
    var kap = num(o.kappa);
    if (isFinite(kap)) {
      if (!(kap >= 1 && kap <= 2)) return fail('kappa لازم يكون بين 1 و 2.');
      var ip = kap * Math.SQRT2 * ik;
      steps.push({ step: 'Peak current', formula: 'ip = kappa x sqrt(2) x Isc', substitution: kap + ' x sqrt(2) x ' + r(ik, 3), result: r(ip, 3) + ' kA' });
      res.ipPeakKA = ip;
      extra.push({ k: 'Peak current ip', v: r(ip, 2) + ' kA (kappa ' + kap + ' entered manually, needs_review)' });
    } else if (method === 'peak') {
      return fail('ادخل kappa (من 1 إلى 2).');
    }
    extra.unshift({ k: 'Isc', v: r(ik, 2) + ' kA' });
    res.summary = 'Isc = ' + r(ik, 2) + ' kA' + (res.ipPeakKA ? ' | ip = ' + r(res.ipPeakKA, 2) + ' kA' : '') + ' (needs_review)';
    res.steps = steps; res.extra = extra; res.warnings = warnings;
    res.used = ['method=' + method + ', V=' + V + ' V'];
    return res;
  }

  function register() {
    if (typeof document === 'undefined' || !window.EngUI || typeof window.EngUI.registerTab !== 'function' || !window.EngUI.helpers) return false;
    var h = window.EngUI.helpers;
    window.EngUI.registerTab('isc', 'Isc Network', function (body) {
      body.appendChild(h.el('div', 'ec-note', WARN[0]));
      var grid = h.el('div', 'ec-grid');
      grid.appendChild(h.createField('isc-m', 'Method', 'select', [
        { value: 'mva', label: 'MVA method (grid + transformer)', selected: true },
        { value: 'mvasc', label: 'Given fault level (MVA)' },
        { value: 'ohmic', label: 'Ohmic method (R, X)' },
        { value: 'peak', label: 'Peak from given Isc' }
      ]));
      grid.appendChild(h.createField('isc-v', 'Line voltage V (V)', 'number', '400'));
      grid.appendChild(h.createField('isc-grid', 'MVA: Grid fault level (MVA) - blank = infinite', 'number', ''));
      grid.appendChild(h.createField('isc-tx', 'MVA: Transformer (kVA)', 'number', '1000'));
      grid.appendChild(h.createField('isc-z', 'MVA: Transformer Z (%)', 'number', '5'));
      grid.appendChild(h.createField('isc-mvasc', 'Given fault level (MVA)', 'number', ''));
      grid.appendChild(h.createField('isc-r', 'Ohmic: R upstream or total (ohm)', 'number', ''));
      grid.appendChild(h.createField('isc-x', 'Ohmic: X upstream or total (ohm)', 'number', ''));
      grid.appendChild(h.createField('isc-len', 'Ohmic: Cable length (m) - optional', 'number', ''));
      grid.appendChild(h.createField('isc-rc', 'Ohmic: Cable R (ohm/km)', 'number', ''));
      grid.appendChild(h.createField('isc-xc', 'Ohmic: Cable X (ohm/km)', 'number', ''));
      grid.appendChild(h.createField('isc-c', 'Ohmic: Voltage factor c - blank = 1.0', 'number', ''));
      grid.appendChild(h.createField('isc-ik', 'Peak: Symmetrical Isc (kA)', 'number', ''));
      grid.appendChild(h.createField('isc-k', 'Peak: kappa (1 to 2) - optional', 'number', ''));
      body.appendChild(grid);
      var btn = h.el('button', 'ec-btn', 'Calculate Isc');
      btn.type = 'button';
      body.appendChild(btn);
      var out = h.el('div', 'ec-out');
      body.appendChild(out);
      btn.addEventListener('click', function () {
        out.innerHTML = '';
        var res = calculate({
          method: h.val('isc-m'), vLL: h.numVal('isc-v'), gridMva: h.numVal('isc-grid'), txKva: h.numVal('isc-tx'), txZPct: h.numVal('isc-z'),
          mvaSc: h.numVal('isc-mvasc'), rOhm: h.numVal('isc-r'), xOhm: h.numVal('isc-x'), cableLenM: h.numVal('isc-len'),
          rCableOhmKm: h.numVal('isc-rc'), xCableOhmKm: h.numVal('isc-xc'), cFactor: h.numVal('isc-c'), ikKa: h.numVal('isc-ik'), kappa: h.numVal('isc-k')
        });
        h.showResult(out, res, 'Isc Network');
        if (res.ok) { var st = h.el('div', null); h.renderResultActions(out, st); out.appendChild(st); }
      });
    });
    return true;
  }

  window.EngIsc = { calculate: calculate, register: register };
  if (typeof document !== 'undefined') {
    if (!register()) { var n = 0; var iv = setInterval(function () { if (register() || ++n > 40) clearInterval(iv); }, 100); }
  }
})();
