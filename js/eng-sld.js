/* Mini single-line diagram: source/bus -> breaker -> cable -> load.
   build() returns neutral primitives; toSVG() draws them in the UI, EngPDF draws the same primitives on its canvas ('sld' block). */
(function () {
  'use strict';
  function num(x) { var n = Number(x); return isFinite(n) ? n : NaN; }
  function has(x) { return x !== undefined && x !== null && x !== '' && isFinite(Number(x)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function f1(x) { return String(Math.round(num(x) * 10) / 10); }
  function f2(x) { return String(Math.round(num(x) * 100) / 100); }

  /* spec: {source, voltageV, iscKA, breakerA, breakerType, poles, cableMm2, cores, conductor, insulation, lengthM, loadName, loadKW, IbA, dropPct} */
  function build(spec) {
    var s = spec || {}, P = [], W = 560, cx = 230;
    function line(x1, y1, x2, y2, w) { P.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, w: w || 3 }); }
    function text(x, y, str, size, bold, anchor) { P.push({ t: 'text', x: x, y: y, s: String(str), size: size || 16, bold: !!bold, anchor: anchor || 'start' }); }
    var src = s.source || 'Source / Panel';
    var vTxt = has(s.voltageV) ? Number(s.voltageV) + ' V, 3-phase' : '';
    /* source bus */
    P.push({ t: 'rect', x: 60, y: 30, w: 340, h: 12, fill: '#0f172a', stroke: '#0f172a' });
    text(60, 12, src, 17, true);
    if (vTxt) text(400, 40, vTxt, 14, false, 'end');
    if (has(s.iscKA)) text(60, 58, 'Isc = ' + f1(s.iscKA) + ' kA', 14, false);
    /* breaker */
    line(cx, 42, cx, 100);
    P.push({ t: 'rect', x: cx - 16, y: 100, w: 32, h: 44, fill: '#ffffff', stroke: '#0f172a' });
    line(cx - 10, 138, cx + 10, 106, 2);
    var bt = s.breakerType || 'MCCB';
    text(cx + 30, 112, bt + (has(s.breakerA) ? ' ' + f1(s.breakerA) + ' A' : ''), 17, true);
    text(cx + 30, 132, (s.poles || '3P') + ' breaker', 14, false);
    line(cx, 144, cx, 210);
    /* cable */
    var cab = (s.cores || '4C') + ' x ' + (has(s.cableMm2) ? f1(s.cableMm2) + ' mm2' : '? mm2') + ' ' + (s.conductor || 'Cu') + '/' + (s.insulation || 'XLPE');
    text(cx + 14, 160, cab, 16, true);
    if (has(s.lengthM)) text(cx + 14, 180, 'Length ' + f1(s.lengthM) + ' m', 14, false);
    if (has(s.dropPct)) text(cx + 14, 198, 'dV = ' + f2(s.dropPct) + ' %', 14, false);
    /* arrow into load */
    P.push({ t: 'poly', pts: [[cx - 7, 206], [cx + 7, 206], [cx, 220]], fill: '#0f172a' });
    /* load */
    P.push({ t: 'rect', x: cx - 110, y: 222, w: 220, h: 70, fill: '#eef2ff', stroke: '#0f172a' });
    text(cx, 234, s.loadName || 'Load', 17, true, 'middle');
    var l2 = [];
    if (has(s.loadKW)) l2.push(f1(s.loadKW) + ' kW');
    if (has(s.IbA)) l2.push('Ib = ' + f1(s.IbA) + ' A');
    if (l2.length) text(cx, 258, l2.join('   '), 15, false, 'middle');
    return { w: W, h: 310, prims: P };
  }

  function toSVG(d) {
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + d.w + ' ' + d.h + '" width="100%" role="img" aria-label="Single line diagram" direction="ltr" style="direction:ltr;unicode-bidi:isolate;max-width:' + d.w + 'px;background:#fff;border-radius:8px">'];
    d.prims.forEach(function (p) {
      if (p.t === 'line') o.push('<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="#0f172a" stroke-width="' + (p.w || 3) + '"/>');
      else if (p.t === 'rect') o.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + (p.fill || 'none') + '" stroke="' + (p.stroke || 'none') + '" stroke-width="2.5" rx="3"/>');
      else if (p.t === 'poly') o.push('<polygon points="' + p.pts.map(function (q) { return q.join(','); }).join(' ') + '" fill="' + (p.fill || '#0f172a') + '"/>');
      else if (p.t === 'text') o.push('<text x="' + p.x + '" y="' + (p.y + p.size * 0.85) + '" font-size="' + p.size + '" font-family="Arial, Helvetica, sans-serif" fill="#0f172a"' + (p.bold ? ' font-weight="700"' : '') + ' text-anchor="' + p.anchor + '">' + esc(p.s) + '</text>');
    });
    o.push('</svg>');
    return o.join('');
  }

  function fromLoadSchedule(res, extra) {
    if (!res || !res.mainBreakerA) return null;
    var e = extra || {}, inc = res.incomer || {};
    var vd = inc.vdrop || null;
    return { source: e.source || 'Distribution board', voltageV: res.voltageV, iscKA: e.iscKA, breakerA: res.mainBreakerA, breakerType: (inc.breaker && inc.breaker.type) || 'MCCB', cableMm2: res.incomerSizeMm2, cores: '4C',
      conductor: inc.conductor || e.conductor || 'Cu', insulation: inc.insulation || e.insulation || 'XLPE', lengthM: e.lengthM, loadName: e.loadName || 'Panel load', loadKW: res.totals ? res.totals.dkw : undefined, IbA: res.designCurrentA, dropPct: vd && vd.vdropPct };
  }

  var last = null;
  window.EngSLD = { build: build, toSVG: toSVG, fromLoadSchedule: fromLoadSchedule, remember: function (spec) { last = spec; }, recall: function () { return last; } };

  /* ---------------- UI ---------------- */
  function register() {
    if (typeof document === 'undefined' || !window.EngUI || typeof window.EngUI.registerTab !== 'function') return false;
    var h = window.EngUI.helpers, el = h.el;
    window.EngUI.registerTab('sld', 'SLD', function (body) {
      body.appendChild(el('div', 'ec-summary', 'رسم single-line مصغر: مصدر، قاطع، كابل، حمل. املا القيم أو اسحبها من آخر Load Schedule. الرسم بيتضاف في الـ PDF.'));
      var g = el('div', 'ec-grid');
      g.appendChild(h.createField('sld-src', 'Source / panel name', 'text', 'Main DB'));
      g.appendChild(h.createField('sld-v', 'Voltage (V)', 'number', 400));
      g.appendChild(h.createField('sld-isc', 'Isc (kA)', 'number', ''));
      g.appendChild(h.createField('sld-bt', 'Breaker type', 'select', [{ value: 'MCCB', label: 'MCCB', selected: true }, { value: 'MCB', label: 'MCB' }, { value: 'ACB', label: 'ACB' }]));
      g.appendChild(h.createField('sld-in', 'Breaker In (A)', 'number', ''));
      g.appendChild(h.createField('sld-mm', 'Cable (mm2)', 'number', ''));
      g.appendChild(h.createField('sld-cores', 'Cores', 'select', [{ value: '4C', label: '4C', selected: true }, { value: '3C', label: '3C' }, { value: '2C', label: '2C' }, { value: '1C', label: '1C' }]));
      g.appendChild(h.createField('sld-len', 'Length (m)', 'number', ''));
      g.appendChild(h.createField('sld-cond', 'Conductor', 'select', [{ value: 'Cu', label: 'Cu', selected: true }, { value: 'Al', label: 'Al' }]));
      g.appendChild(h.createField('sld-ins', 'Insulation', 'select', [{ value: 'XLPE', label: 'XLPE', selected: true }, { value: 'PVC', label: 'PVC' }]));
      g.appendChild(h.createField('sld-load', 'Load name', 'text', ''));
      g.appendChild(h.createField('sld-kw', 'Load (kW)', 'number', ''));
      g.appendChild(h.createField('sld-ib', 'Ib (A)', 'number', ''));
      g.appendChild(h.createField('sld-dv', 'Voltage drop (%)', 'number', ''));
      body.appendChild(g);
      var row = el('div', 'ec-actions'), pull = el('button', 'ec-btn ec-btn-sec', 'Use last Load Schedule'), btn = el('button', 'ec-btn', 'Draw SLD');
      pull.type = 'button'; btn.type = 'button'; row.appendChild(pull); row.appendChild(btn); body.appendChild(row);
      var out = el('div', null), status = el('div', 'ec-status'); body.appendChild(out); body.appendChild(status);
      function setv(id, v) { var n = document.getElementById(id); if (n && v !== undefined && v !== null && v !== '') n.value = v; }
      pull.addEventListener('click', function () {
        var s = window.EngSLD.recall();
        if (!s) { status.textContent = 'احسب Load Schedule الأول (مع طول الكابل عشان الهبوط).'; return; }
        setv('sld-src', s.source); setv('sld-v', s.voltageV); setv('sld-isc', s.iscKA); setv('sld-bt', s.breakerType); setv('sld-in', s.breakerA); setv('sld-mm', s.cableMm2); setv('sld-cond', s.conductor); setv('sld-ins', s.insulation);
        setv('sld-len', s.lengthM); setv('sld-load', s.loadName); setv('sld-kw', s.loadKW !== undefined ? Math.round(s.loadKW * 10) / 10 : ''); setv('sld-ib', s.IbA); setv('sld-dv', s.dropPct);
        status.textContent = 'تم السحب من آخر Load Schedule.';
      });
      btn.addEventListener('click', function () {
        out.innerHTML = ''; status.textContent = '';
        var spec = { source: h.val('sld-src'), voltageV: h.numVal('sld-v'), iscKA: h.numVal('sld-isc'), breakerType: h.val('sld-bt'), breakerA: h.numVal('sld-in'), cableMm2: h.numVal('sld-mm'), cores: h.val('sld-cores'), conductor: h.val('sld-cond'), insulation: h.val('sld-ins'), lengthM: h.numVal('sld-len'), loadName: h.val('sld-load'), loadKW: h.numVal('sld-kw'), IbA: h.numVal('sld-ib'), dropPct: h.numVal('sld-dv') };
        if (!has(spec.breakerA) && !has(spec.cableMm2)) { status.textContent = 'ادخل In أو مقطع الكابل على الأقل.'; return; }
        var d = build(spec), box = el('div', 'ec-sld'); box.innerHTML = toSVG(d);
        out.appendChild(box);
        var res = { summary: 'Single-line: ' + (spec.breakerType || 'MCCB') + ' ' + (spec.breakerA || '?') + ' A -> ' + (spec.cores || '4C') + 'x' + (spec.cableMm2 || '?') + ' mm2 -> ' + (spec.loadName || 'Load'), steps: [], warnings: [], tablesUsed: [], sld: d };
        h.showResult(out, res, 'Single-line diagram');
        var st = el('div', 'ec-status'); out.appendChild(st);
        h.renderResultActions(out, st, function () {
          var doc = window.EngPDF.docFromResult('Single-line diagram', res); doc.blocks.splice(1, 0, { type: 'sld', heading: 'Single-line diagram', sld: d }); return doc;
        });
      });
    });
    return true;
  }
  if (typeof document !== 'undefined') { if (!register()) { var n = 0, iv = setInterval(function () { if (register() || ++n > 40) clearInterval(iv); }, 250); } }
})();
