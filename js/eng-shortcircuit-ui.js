/* Eng Calc "Short-circuit" tab: cable withstand (k2 S2) vs breaker let-through I2t.
   Registers itself on EngUI; calculation lives in EngCalc.shortCircuit. */
(function () {
  'use strict';
  function register() {
    if (!window.EngUI || typeof window.EngUI.registerTab !== 'function' || !window.EngCalc) return false;
    var h = window.EngUI.helpers;
    window.EngUI.registerTab('shortcircuit', 'Short-circuit', function (body) {
      var grid = h.el('div', 'ec-grid');
      grid.appendChild(h.createField('ec-sc-size', 'Cable Size (mm2)', 'number', 16));
      grid.appendChild(h.createField('ec-sc-cond', 'Conductor', 'select', [
        { value: 'Cu', label: 'Copper (Cu)', selected: true }, { value: 'Al', label: 'Aluminium (Al)' }
      ]));
      grid.appendChild(h.createField('ec-sc-ins', 'Insulation', 'select', [
        { value: 'XLPE', label: 'XLPE / EPR (90C)', selected: true }, { value: 'PVC', label: 'PVC (70C)' }
      ]));
      grid.appendChild(h.createField('ec-sc-isc', 'Prospective Isc (kA)', 'number', 10));
      grid.appendChild(h.createField('ec-sc-lt', 'Breaker let-through I2t (kA2s) - from datasheet', 'number', ''));
      grid.appendChild(h.createField('ec-sc-t', 'OR clearing time (s) - estimate', 'number', ''));
      body.appendChild(grid);
      body.appendChild(h.el('div', 'ec-warn', 'Let-through I2t is not in the tables: take it from the breaker datasheet at this Isc (kA2s). If you only enter a clearing time, the result is an estimate (Isc^2 x t).'));
      var row = h.el('div', 'ec-actions');
      var btn = h.el('button', 'ec-btn', 'Check Short-circuit Withstand');
      btn.type = 'button';
      row.appendChild(btn);
      body.appendChild(row);
      var out = h.el('div', null);
      body.appendChild(out);
      btn.addEventListener('click', function () {
        out.innerHTML = '';
        h.ensureTables().then(function () {
          var res = window.EngCalc.shortCircuit({
            size_mm2: h.numVal('ec-sc-size'), conductor: h.val('ec-sc-cond'), insulation: h.val('ec-sc-ins'),
            iscKA: h.numVal('ec-sc-isc'), letThroughKA2s: h.numVal('ec-sc-lt'), clearingTimeS: h.numVal('ec-sc-t')
          });
          h.showResult(out, res, 'Short-circuit Withstand Result');
          out.insertBefore(h.el('div', res.ok ? 'ec-cx ec-cx-ok' : 'ec-cx ec-cx-warn', res.ok ? 'النتيجة: متحقق. الكابل يتحمل طاقة القصر.' : 'النتيجة: غير متحقق. كبّر المقطع لـ ' + res.minSizeMm2 + ' mm2 على الأقل أو استخدم قاطع بطاقة let-through أقل.'), out.firstChild);
          var st = h.el('div', null);
          h.renderResultActions(out, st);
          out.appendChild(st);
        }).catch(function (err) { out.appendChild(h.el('div', 'ec-err', err.message || 'Calculation error')); });
      });
    });
    return true;
  }
  if (!register()) { document.addEventListener('DOMContentLoaded', register); setTimeout(register, 500); }
})();
