/* Advisory cross-check: compares numbers in the model's final answer with the deterministic
   Eng Calc result when the task contains enough inputs. Never blocks, never edits the answer. */
(function () {
  'use strict';

  function num(x) { var n = parseFloat(String(x).replace(',', '.')); return isFinite(n) ? n : null; }
  function first(re, t) { var m = re.exec(t); return m ? num(m[1]) : null; }

  function parseTask(t) {
    t = String(t || '');
    var o = {};
    o.voltageV = first(/(\d{3,4})\s*(?:v\b|volts?\b|فولت)/i, t);
    o.currentA = first(/(\d+(?:[.,]\d+)?)\s*(?:a\b|amps?\b|amperes?\b|أمبير|امبير)(?![a-z])/i, t);
    o.powerKW = first(/(\d+(?:[.,]\d+)?)\s*kw\b/i, t);
    o.lengthM = first(/(\d+(?:[.,]\d+)?)\s*(?:m\b|meters?\b|metres?\b|متر)/i, t);
    o.size_mm2 = first(/(\d+(?:[.,]\d+)?)\s*(?:mm2|mm²|sq\.?\s?mm|مم2|مم²)/i, t);
    o.powerFactor = first(/(?:pf|power factor|معامل (?:ال)?قدرة)\D{0,8}(0?[.,]\d+)/i, t);
    o.ambientC = first(/(\d{2})\s*(?:°|º|deg(?:rees)?)?\s*c\b/i, t);
    o.circuits = first(/(\d+)\s*(?:circuits?|دوائر|دايرة|دائرة)/i, t);
    o.maxVdropPct = first(/(?:voltage drop|هبوط)[^%\d]{0,25}(\d+(?:[.,]\d+)?)\s*%/i, t);
    var ph = /\b(1|3)[\s-]*(?:phase|ph)\b|(\d)\s*فاز|three[\s-]phase|single[\s-]phase|ثلاثي|احادي|أحادي/i.exec(t);
    if (ph) {
      if (/three|ثلاثي|^3|\b3\b|3\s*فاز/i.test(ph[0])) o.phases = 3; else o.phases = 1;
    } else if (o.voltageV) o.phases = o.voltageV >= 380 ? 3 : 1;
    o.conductor = /\bal(?:uminium|uminum)?\b|ألومنيوم|المنيوم|ألمنيوم/i.test(t) ? 'Al' : 'Cu';
    o.insulation = /\bpvc\b/i.test(t) ? 'PVC' : 'XLPE';
    o.method = /buried|underground|in ground|مدفون|تحت الأرض/i.test(t) ? 'ground' : 'air';
    o.topicVd = /voltage drop|v\.?drop|هبوط/i.test(t);
    o.topicBreaker = /breaker|mccb|\bmcb\b|قاطع/i.test(t);
    o.topicSize = /cable|كابل|مقطع|sizing|size/i.test(t);
    return o;
  }

  function parseModel(f) {
    f = String(f || '');
    var m = { sizes: [], breakers: [], vdPct: [] }, re, x;
    re = /(\d+(?:[.,]\d+)?)\s*(?:mm2|mm²|sq\.?\s?mm|مم2|مم²)/gi;
    while ((x = re.exec(f))) { var n = num(x[1]); if (n !== null && m.sizes.indexOf(n) < 0) m.sizes.push(n); }
    re = /(?:mccb|\bmcb\b|breaker|قاطع)[^\n]{0,30}?(\d+(?:[.,]\d+)?)\s*(?:a\b|amps?\b|أمبير|امبير)/gi;
    while ((x = re.exec(f))) { var b = num(x[1]); if (b !== null && m.breakers.indexOf(b) < 0) m.breakers.push(b); }
    re = /(?:voltage drop|v\.?\s?drop|هبوط)[^\n%]{0,60}?(\d+(?:[.,]\d+)?)\s*%/gi;
    while ((x = re.exec(f))) { var p = num(x[1]); if (p !== null) m.vdPct.push(p); }
    return m;
  }

  function compare(task, finalText, tablesApi) {
    var t = parseTask(task), m = parseModel(finalText), items = [], notes = [], C = window.EngCalc;
    if (!C) return null;
    var hasLoad = (t.currentA > 0) || (t.powerKW > 0);
    if (!hasLoad && !(t.size_mm2 > 0 && t.currentA > 0)) return null;
    var common = { phases: t.phases || 3, voltageV: t.voltageV, currentA: t.currentA, powerKW: t.powerKW, powerFactor: t.powerFactor, conductor: t.conductor, insulation: t.insulation };
    var assume = [(common.phases) + '-phase', (t.voltageV || (common.phases === 1 ? 230 : 400)) + ' V', 'PF ' + (t.powerFactor || 0.85), t.conductor, t.insulation];
    var Ib = null, cs = null, vd = null, br = null;
    try {
      if (t.size_mm2 > 0 && t.lengthM > 0 && hasLoad) {
        var ib = t.currentA > 0 ? t.currentA : null;
        if (ib === null) { var tmp = C.cableSizing(Object.assign({}, common, { method: t.method, ambientC: t.ambientC || 35, circuits: t.circuits || 1 }), tablesApi); ib = tmp.designCurrentA; }
        vd = C.voltageDrop({ size_mm2: t.size_mm2, currentA: ib, lengthM: t.lengthM, voltageV: t.voltageV, phases: common.phases, conductor: t.conductor, insulation: t.insulation, powerFactor: t.powerFactor }, tablesApi);
        Ib = ib;
      } else if (!(t.size_mm2 > 0)) {
        var inp = Object.assign({}, common, { method: t.method, ambientC: t.ambientC || 35, circuits: t.circuits || 1 });
        if (t.lengthM > 0) { inp.lengthM = t.lengthM; inp.maxVdropPct = t.maxVdropPct || 3; }
        cs = C.cableSizing(inp, tablesApi);
        Ib = cs.designCurrentA;
        assume.push('ambient ' + (t.ambientC || 35) + ' C', t.circuits ? t.circuits + ' circuits' : '1 circuit', t.method === 'ground' ? 'buried D2' : 'in air (method C)');
        if (inp.lengthM) assume.push('max dV ' + inp.maxVdropPct + ' %');
      }
      if (Ib && (t.topicBreaker || m.breakers.length)) br = C.breakerSelection({ designCurrentA: Ib, type: 'any' }, tablesApi);
    } catch (e) { return null; }

    if (cs && cs.compliant && m.sizes.length) {
      var ok = m.sizes.indexOf(cs.size_mm2) >= 0;
      items.push({ label: 'مقطع الكابل', model: m.sizes.join(' / ') + ' mm2', calc: cs.size_mm2 + ' mm2', ok: ok });
    }
    if (br && m.breakers.length) {
      var okb = m.breakers.indexOf(br.rating_a) >= 0;
      items.push({ label: 'قاطع الحماية', model: m.breakers.join(' / ') + ' A', calc: br.rating_a + ' A (' + br.type + ')', ok: okb });
    }
    var vdRes = vd || (cs && cs.vdrop);
    if (vdRes && m.vdPct.length) {
      var mp = m.vdPct[0], cp = vdRes.vdropPct, okv = Math.abs(mp - cp) <= Math.max(0.3, 0.15 * cp);
      items.push({ label: 'هبوط الجهد', model: mp + ' %', calc: cp.toFixed(2) + ' %', ok: okv });
    }
    if (!items.length) return null;
    var bad = items.filter(function (i) { return !i.ok; });
    return { items: items, diverge: bad.length > 0, assumptions: assume.join(', '), tables: ((cs && cs.tablesUsed) || (vdRes && vdRes.tablesUsed) || []).map(function (u) { return u.id + ' (' + u.status + ')'; }) };
  }

  function render(res) {
    var old = document.getElementById('ecxBox'); if (old) old.remove();
    var host = document.getElementById('finalView'); if (!res || !host) return;
    var box = document.createElement('div'); box.id = 'ecxBox';
    box.className = 'ec-cx ' + (res.diverge ? 'ec-cx-warn' : 'ec-cx-ok');
    box.setAttribute('dir', 'rtl');
    var h = document.createElement('div'); h.style.fontWeight = '700';
    h.textContent = res.diverge ? 'تنبيه (استشاري): أرقام الموديل مختلفة عن حاسبة Eng Calc' : 'مطابقة: أرقام الموديل متوافقة مع حاسبة Eng Calc';
    box.appendChild(h);
    res.items.forEach(function (i) {
      var d = document.createElement('div');
      d.textContent = (i.ok ? '✔ ' : '✕ ') + i.label + ': الموديل ' + i.model + ' | الحاسبة ' + i.calc;
      box.appendChild(d);
    });
    var a = document.createElement('div'); a.style.fontSize = '12px'; a.style.opacity = '0.85';
    a.textContent = 'افتراضات الحاسبة: ' + res.assumptions + '. الفرق ممكن يكون بسبب افتراضات مختلفة. راجع قبل الاعتماد (الجداول: ' + (res.tables.join(', ') || '-') + ').';
    box.appendChild(a);
    host.parentNode.insertBefore(box, host);
  }

  function run() {
    try {
      var task = (document.getElementById('task') || {}).value || '';
      var fin = (document.getElementById('final') || {}).textContent || '';
      var old = document.getElementById('ecxBox'); if (old) old.remove();
      if (!window.EngTables || !window.EngCalc || !fin) return Promise.resolve(null);
      return window.EngTables.load().then(function () { var r = compare(task, fin); render(r); return r; }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function hook() {
    if (typeof window.renderFinal !== 'function' || window.renderFinal.__ecx) return;
    var orig = window.renderFinal;
    var w = function () { var r = orig.apply(this, arguments); setTimeout(run, 50); return r; };
    w.__ecx = true;
    window.renderFinal = w;
  }

  window.EngCross = { parseTask: parseTask, parseModel: parseModel, compare: compare, run: run };
  if (typeof document !== 'undefined') {
    hook();
    document.addEventListener('DOMContentLoaded', hook);
    setTimeout(hook, 800);
    setTimeout(hook, 2500);
  }
})();
