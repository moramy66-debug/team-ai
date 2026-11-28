/* Ramz - chat to calculator bridge for free text.
   Fixed keyword rules pick the calculator, a deterministic parser reads the numbers, the user confirms
   every field (read from text / missing / default), then the verified Eng Calc runs. No model is involved,
   so no number, category, table or clause number can come from model text. */
(function () {
  'use strict';
  var SRC_TEXT = 'from your text', SRC_USER = 'you entered', SRC_DEF = 'default (assumption)';

  function has(re, t) { return re.test(t); }
  function detect(t) {
    t = String(t || '');
    var vd = has(/voltage drop|v\.?\s*drop|هبوط\s*(ال)?(جهد|فولت)/i, t);
    var cabStrong = has(/cable siz|size (the |a )?cable|cable selection|مقطع\s*(ال)?كابل|اختيار\s*(ال)?كابل|حجم\s*(ال)?كابل|اختار\s*(ال)?كابل/i, t);
    var cab = cabStrong || has(/cable|كابل/i, t);
    var brk = has(/breaker|mccb|\bmcb\b|قاطع/i, t);
    if (vd && !cabStrong) return 'vdrop';
    if (cab) return 'cable';
    if (brk) return 'breaker';
    return null;
  }
  function parse(t) {
    var P = (window.EngCross && window.EngCross.parseTask) ? window.EngCross.parseTask(t) : {};
    t = String(t || '');
    var o = { src: {} };
    function put(k, v, from) { if (v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v))) { o[k] = v; o.src[k] = from || SRC_TEXT; } }
    put('currentA', P.currentA); put('powerKW', P.powerKW); put('voltageV', P.voltageV); put('lengthM', P.lengthM);
    put('size_mm2', P.size_mm2); put('powerFactor', P.powerFactor); put('ambientC', P.ambientC); put('circuits', P.circuits);
    put('maxVdropPct', P.maxVdropPct);
    if (/\b(1|3)[\s-]*(phase|ph)\b|\d\s*فاز|three[\s-]phase|single[\s-]phase|ثلاثي|احادي|أحادي/i.test(t)) put('phases', P.phases);
    if (/\bcu\b|copper|نحاس|\bal(?:uminium|uminum)?\b|ألومنيوم|المنيوم|ألمنيوم/i.test(t)) put('conductor', P.conductor);
    if (/\bpvc\b|xlpe/i.test(t)) put('insulation', P.insulation);
    if (/buried|underground|in ground|مدفون|تحت الأرض|in air|free air|tray|هوا/i.test(t)) put('method', P.method);
    return o;
  }

  /* field specs per calculator. req: needs a value. hint: what the calculator assumes when blank */
  var SPECS = {
    vdrop: {
      title: 'Voltage Drop', fn: 'voltageDrop',
      fields: [
        { k: 'size_mm2', l: 'Cross-section (mm2)', t: 'number', req: true },
        { k: 'currentA', l: 'Current (A)', t: 'number', req: true },
        { k: 'lengthM', l: 'Length (m)', t: 'number', req: true },
        { k: 'voltageV', l: 'Voltage (V)', t: 'number', hint: '400 V for 3-phase, 230 V for 1-phase' },
        { k: 'phases', l: 'Phases', t: 'select', opts: ['', '3', '1'], req: true },
        { k: 'conductor', l: 'Conductor', t: 'select', opts: ['', 'Cu', 'Al'], hint: 'Cu' },
        { k: 'insulation', l: 'Insulation', t: 'select', opts: ['', 'XLPE', 'PVC'], hint: 'XLPE' },
        { k: 'powerFactor', l: 'Power factor', t: 'number', hint: '0.85' }
      ]
    },
    cable: {
      title: 'Cable Sizing', fn: 'cableSizing',
      fields: [
        { k: 'currentA', l: 'Design current Ib (A)', t: 'number', alt: 'powerKW' },
        { k: 'powerKW', l: 'or Power (kW)', t: 'number', alt: 'currentA' },
        { k: 'voltageV', l: 'Voltage (V)', t: 'number', hint: '400 V for 3-phase, 230 V for 1-phase' },
        { k: 'phases', l: 'Phases', t: 'select', opts: ['', '3', '1'], req: true },
        { k: 'powerFactor', l: 'Power factor (used with kW)', t: 'number', hint: '0.85' },
        { k: 'conductor', l: 'Conductor', t: 'select', opts: ['', 'Cu', 'Al'], hint: 'Cu' },
        { k: 'insulation', l: 'Insulation', t: 'select', opts: ['', 'XLPE', 'PVC'], hint: 'XLPE' },
        { k: 'method', l: 'Installation', t: 'select', opts: ['', 'air', 'ground', 'duct'], hint: 'air' },
        { k: 'ambientC', l: 'Ambient (C)', t: 'number', hint: 'calculator default, see the report' },
        { k: 'circuits', l: 'Circuits grouped together', t: 'number', hint: '1' },
        { k: 'lengthM', l: 'Length (m)', t: 'number', hint: 'blank = voltage drop NOT checked', opt: true },
        { k: 'maxVdropPct', l: 'Max voltage drop (%)', t: 'number', hint: 'blank = voltage drop NOT checked', opt: true }
      ]
    },
    breaker: {
      title: 'Breaker Selection', fn: 'breakerSelection',
      fields: [
        { k: 'currentA', l: 'Design current Ib (A)', t: 'number', req: true },
        { k: 'type', l: 'Breaker type', t: 'select', opts: ['', 'MCB', 'MCCB'], hint: 'any (first standard rating that fits)', opt: true },
        { k: 'cableAmpacityA', l: 'Cable ampacity Iz (A), optional', t: 'number', hint: 'blank = overload check skipped', opt: true }
      ]
    }
  };

  function cell(x) { return String(x == null ? '' : x).replace(/\|/g, '/').replace(/\s+/g, ' ').trim(); }

  function kpisFor(kind, res) {
    var k = [];
    if (kind === 'vdrop') { k.push({ l: 'Voltage drop', v: String(res.vdropV), u: 'V' }); k.push({ l: 'Voltage drop', v: String(res.vdropPct), u: '%' }); }
    else if (kind === 'cable') {
      if (res.compliant === false) k.push({ l: 'Cross-section', v: 'none found', u: '', bad: true });
      else { k.push({ l: 'Cross-section', v: String(res.size_mm2), u: 'mm\u00b2' }); k.push({ l: 'Breaker', v: String(res.breaker && res.breaker.rating_a), u: 'A' }); k.push({ l: 'Derated ampacity Iz', v: String(res.deratedAmpacityA), u: 'A' }); }
      k.push({ l: 'Design current Ib', v: String(res.designCurrentA), u: 'A' });
      if (res.vdrop && res.vdrop.vdropPct !== undefined) k.push({ l: 'Voltage drop', v: String(res.vdrop.vdropPct), u: '%' });
    } else if (kind === 'breaker') { k.push({ l: 'Breaker rating', v: String(res.rating_a), u: 'A' }); k.push({ l: 'Type', v: String(res.type), u: '' }); k.push({ l: 'Design current Ib', v: String(res.designCurrentA), u: 'A' }); }
    return k;
  }
  function buildSheet(kind, vals, srcs, res) {
    var S = SPECS[kind], E = window.EngSheet, blanks = [], inRows = [];
    S.fields.forEach(function (f) {
      var v = vals[f.k];
      if (v === '' || v === undefined) { if (f.hint) { inRows.push({ head: f.l, cells: [['Value', 'not given'], ['Source', SRC_DEF + ': ' + f.hint]] }); blanks.push(f.l + ': ' + f.hint); } return; }
      inRows.push({ head: f.l, cells: [['Value', String(v)], ['Source', srcs[f.k] || SRC_USER]] });
    });
    var q = [];
    if (kind === 'cable' && (vals.lengthM === '' || vals.maxVdropPct === '')) q.push('Length and maximum voltage drop were not both given, so voltage drop was not part of the check.');
    if (blanks.length) q.push('Confirm the defaults listed under Assumptions, or enter your own value and run again.');
    q.push('Number of parallel cables per phase: not available in this calculator yet.');
    var used = res.tablesUsed || [], notes = (res.warnings || []).filter(function (w, i, a) { return a.indexOf(w) === i; });
    return {
      title: S.title, edition: 'Eng Calc (verified tables)', ok: res.compliant === false ? false : undefined,
      meta: E.baseMeta(S.title + ' (Eng Calc)', 'App tables, status shown below'),
      kpis: kpisFor(kind, res),
      sections: [
        { type: 'cards', title: 'Inputs \u00b7 \u0627\u0644\u0645\u062f\u062e\u0644\u0627\u062a', rows: inRows },
        { type: 'steps', title: 'Calculation steps \u00b7 \u062e\u0637\u0648\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628', rows: (res.steps || []).map(function (st) { return { step: st.step, formula: st.formula, substitution: st.substitution, result: st.result }; }) },
        { type: 'box', kind: 'assump', title: 'Assumptions and notes \u00b7 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u0627\u062a', items: blanks.map(function (b) { return 'Not given, calculator default used: ' + b; }).concat(notes) },
        { type: 'box', kind: 'question', title: 'Open questions \u00b7 \u0623\u0633\u0626\u0644\u0629 \u0645\u0641\u062a\u0648\u062d\u0629', items: q },
        { type: 'box', kind: 'basis', title: 'Code basis \u00b7 \u0623\u0633\u0627\u0633 \u0627\u0644\u0643\u0648\u062f', items: used.length ? used.map(function (u) { return u.id + ' | status: ' + u.status + ' | ' + (u.source || 'المصدر غير مسجل'); }) : ['No table used.'] }
      ].filter(function (s) { return s.type !== 'box' || s.items.length; }),
      summaryText: res.summary || ''
    };
  }
  function buildReport(kind, vals, srcs, res) { var sh = buildSheet(kind, vals, srcs, res); sh.md = window.EngSheet.markdown(sh); return sh.md; }

  function flow(task) {
    var kind = detect(task), h = window.EngUI && window.EngUI.helpers, calc = window.EngCalc;
    if (!kind || !h || !calc) return Promise.resolve(null);
    var P = parse(task), S = SPECS[kind];
    var found = S.fields.filter(function (f) { return P[f.k] !== undefined; }).length;
    if (found < 2) return Promise.resolve(null);
    return new Promise(function (resolve, reject) {
      var fc = document.getElementById('finalCard'); if (!fc || !fc.parentNode) { resolve(null); return; }
      var old = document.getElementById('imp-chat-calc'); if (old) old.remove();
      var wrap = document.createElement('div'); wrap.id = 'imp-chat-calc'; wrap.className = 'card imp-chat-flow';
      fc.parentNode.insertBefore(wrap, fc);
      var t = document.createElement('div'); t.className = 'imp-chat-t'; t.textContent = S.title + ': the app read these values from your text. Check each one, fill what is missing, then run. Nothing is calculated before you confirm. The calculator gives the numbers, not the AI.';
      wrap.appendChild(t);
      var inputs = {}, badges = {}, msg = document.createElement('div'); msg.className = 'ec-err'; msg.style.display = 'none';
      function badge(f) {
        var el = inputs[f.k], v = el.value, b = badges[f.k];
        if (v !== '' && P[f.k] !== undefined && String(P[f.k]) === v) b.textContent = SRC_TEXT;
        else if (v !== '') b.textContent = SRC_USER;
        else if (f.req) b.textContent = 'missing (required)';
        else if (f.alt) b.textContent = 'give this or the other one';
        else b.textContent = f.hint ? (f.opt ? 'optional: ' + f.hint : 'missing, required (common value: ' + f.hint + ')') : 'optional';
      }
      S.fields.forEach(function (f) {
        var row = document.createElement('div'); row.className = 'imp-row';
        var lb = document.createElement('label'); lb.className = 'imp-small'; lb.textContent = f.l;
        var el;
        if (f.t === 'select') {
          el = document.createElement('select'); el.className = 'ec-input';
          f.opts.forEach(function (o) { var op = document.createElement('option'); op.value = o; op.textContent = o === '' ? 'Not given' : o; el.appendChild(op); });
        } else { el = document.createElement('input'); el.type = 'number'; el.step = 'any'; el.className = 'ec-input'; }
        if (P[f.k] !== undefined) el.value = String(P[f.k]);
        el.setAttribute('aria-label', f.l);
        var b = document.createElement('div'); b.className = 'imp-small';
        inputs[f.k] = el; badges[f.k] = b;
        el.addEventListener('input', function () { badge(f); }); el.addEventListener('change', function () { badge(f); });
        badge(f);
        row.appendChild(lb); row.appendChild(el); row.appendChild(b); wrap.appendChild(row);
      });
      wrap.appendChild(msg);
      var run = document.createElement('button'); run.type = 'button'; run.className = 'ec-btn'; run.textContent = 'Confirm and Run';
      var skip = document.createElement('button'); skip.type = 'button'; skip.className = 'imp-chip'; skip.textContent = 'Skip: let the AI team answer';
      function end() { try { wrap.remove(); } catch (e) {} }
      skip.addEventListener('click', function () { end(); resolve(null); });
      run.addEventListener('click', function () {
        msg.style.display = 'none';
        var vals = {}, srcs = {}, miss = [];
        S.fields.forEach(function (f) {
          var v = inputs[f.k].value; vals[f.k] = v; srcs[f.k] = (P[f.k] !== undefined && String(P[f.k]) === v) ? SRC_TEXT : SRC_USER;
        });
        S.fields.forEach(function (f) { if (f.req && vals[f.k] === '') miss.push(f.l); });
        if (kind === 'cable' && vals.currentA === '' && vals.powerKW === '') miss.push('Design current or Power');
        S.fields.forEach(function (f) { if (f.hint && !f.opt && !f.req && vals[f.k] === '' && !(f.k === 'powerFactor' && kind === 'cable' && vals.powerKW === '')) miss.push(f.l + ' (no silent default)'); });
        if (miss.length) { msg.textContent = 'Missing: ' + miss.join(', ') + '.'; msg.style.display = ''; return; }
        var inp = {};
        S.fields.forEach(function (f) {
          var v = vals[f.k]; if (v === '') return;
          inp[f.k] = f.t === 'number' ? Number(v) : (f.k === 'phases' ? Number(v) : v);
        });
        h.ensureTables().then(function () {
          var res;
          try { res = calc[S.fn](inp); } catch (e) { msg.textContent = e && e.message ? e.message : 'Calculation error'; msg.style.display = ''; return; }
          var text; try { var sh = buildSheet(kind, vals, srcs, res); sh.md = window.EngSheet.markdown(sh); window.__detSheet = sh; text = sh.md; } catch (e2) { msg.textContent = 'Report error: ' + e2.message; msg.style.display = ''; return; }
          end(); resolve(text);
        }, function (e) { msg.textContent = (e && e.message) || 'Tables not loaded'; msg.style.display = ''; });
      });
      var bar = document.createElement('div'); bar.appendChild(run); bar.appendChild(skip); wrap.appendChild(bar);
      try { if (typeof abort !== 'undefined' && abort && abort.signal) abort.signal.addEventListener('abort', function () { end(); var e = new Error('Aborted'); e.name = 'AbortError'; reject(e); }); } catch (e) {}
      setTimeout(function () { try { wrap.scrollIntoView({ block: 'start' }); } catch (e) {} }, 300);
    });
  }

  window.EngChatCalc = { detect: detect, parse: parse, flow: flow, buildReport: buildReport, buildSheet: buildSheet, SPECS: SPECS };
})();
