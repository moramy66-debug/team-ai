/* Runs the 225 external-audit vectors through the real app code and lists mismatches against the audit's hand results.
   Usage: node tools/vectors/run.js [--all]   (exit 0 always; this is a report, not a gate) */
'use strict';
var fs = require('fs'), path = require('path');
var J = path.join(__dirname, '..', '..', 'js');
global.window = {};
['eng-tables', 'eng-calc', 'eng-transformer', 'eng-generator', 'eng-ups', 'eng-lighting', 'eng-cabletray', 'eng-pfc-cpc'].forEach(function (f) { require(path.join(J, f + '.js')); });
window.EngTables.setData(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'eng-tables.json'), 'utf8')));
var W = window;

function parseCsv(txt) {
  var rows = [], row = [], cur = '', q = false, i, c;
  for (i = 0; i < txt.length; i++) {
    c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  var h = rows.shift();
  return rows.filter(function (r) { return r.length > 1; }).map(function (r) { var o = {}; h.forEach(function (k, j) { o[k] = r[j]; }); return o; });
}
function n(x) { return x === '' || x === undefined ? undefined : Number(x); }
function tryRun(fn) { try { var r = fn(); return r; } catch (e) { return { invalid: true, msg: String(e.message || e).slice(0, 80) }; } }
function bad(r) { return !r || r.ok === false; }
function inv(r) { return { invalid: true, msg: (r && r.error || '').slice(0, 80) }; }

var RUN = {
  cab: function (v) {
    var ph = +v.ph, P = +v.P_kW, V = +v.V, pf = +v.PF, L = +v.L_m, par = +v.parallel || 1, ins = v.insul;
    var ca = +v.Ca, cg = +v.Cg;
    if (!(P > 0)) return { invalid: true, msg: 'P<=0' }; if (!(pf > 0 && pf <= 1)) return { invalid: true, msg: 'PF' }; if (!(V > 0)) return { invalid: true, msg: 'V' };
    if (!(ca > 0 && cg > 0)) return { invalid: true, msg: 'Ca/Cg not an app input (app derives them from tables)' };
    var d = W.EngCalc.cableSizing({ phases: ph, powerKW: P, voltageV: V, powerFactor: pf, insulation: ins, conductor: 'Cu', method: 'air' });
    var Ib = d.designCurrentA;
    var br = W.EngCalc.breakerSelection({ designCurrentA: Ib, type: 'any' });
    var Ct = ca * cg, out = { Ib: Ib, In: br.rating_a, Ct: Ct, 'Iz_req/cable': br.rating_a / Ct / par };
    var sizes = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630], i, vd = null;
    if (!(L > 0)) { out.MinS_VD = sizes[0]; out['VD'] = 0; return out; }
    for (i = 0; i < sizes.length; i++) {
      var r = tryRun(function () { return W.EngCalc.voltageDrop({ size_mm2: sizes[i], currentA: Ib / par, lengthM: L, voltageV: V, phases: ph, conductor: 'Cu', insulation: ins, powerFactor: pf }); });
      if (r.invalid) continue;
      if (r.vdropPct <= +v.maxVD_pct) { out.MinS_VD = sizes[i]; out.VD = r.vdropPct; break; }
    }
    return out;
  },
  isc: function (v) {
    var r = tryRun(function () { return W.EngCalc.shortCircuit({ size_mm2: n(v.S_mm2), iscKA: n(v.Isc_kA) > 0 ? n(v.Isc_kA) : (n(v.Isc_kA) === 0 ? 0 : 1), clearingTimeS: n(v.t_s) > 0 ? n(v.t_s) : undefined, letThroughKA2s: n(v.I2t_in_kA2s), conductor: v.cond, insulation: v.insul }); });
    if (r.invalid) return r;
    var SIZES = W.EngPfcCpc.constants.SIZES, std = null, i;
    for (i = 0; i < SIZES.length; i++) if (SIZES[i] >= r.minSizeMm2 - 1e-9) { std = SIZES[i]; break; }
    return { k: r.k, I2t: r.letThroughA2s / 1e6, cap: r.withstandA2s / 1e6, S_min: r.minSizeMm2, StdS: std, Pass: r.ok };
  },
  tx: function (v) {
    var r = W.EngTransformer.calculate({ demandKva: +v.demandKva, growthPct: +v.growthPct, sparePct: +v.sparePct, targetLoadPct: +v.targetPct, vPrimary: +v.V1, vSecondary: +v.V2, impedancePct: +v.Z_pct });
    if (bad(r)) return inv(r);
    return { S_des: r.designKva, S_req: r.requiredRatingKva, Std: r.stdKva, I1: r.iPrimary, I2: r.iSecondary, Isc: r.iscApproxKa };
  },
  gen: function (v) {
    var xd = +v.Xd_pct;
    var r = W.EngGenerator.calculate({ continuousKw: +v.contKw, pf: +v.PF, largestMotorKw: +v.motorKw, startMethod: v.startType, sparePct: +v.sparePct, altitudeM: +v.altM, ambientTempC: +v.ambC });
    if (bad(r)) return inv(r);
    var o = { S_run: r.runningKva, S_start: r.motorStartKva, S_site: r.requiredSiteKva, DF: r.deratingFactor, S_iso: r.requiredIsoKva, Std: r.stdKva, Dip: r.voltageDipPct, _xd: xd };
    return o;
  },
  ups: function (v) {
    var r = W.EngUps.calculate({ loadKw: +v.loadKw, sparePct: +v.sparePct, loadPf: +v.loadPF, upsRatedPf: +v.upsPF, runtimeMin: +v.rtMin, dcVoltageV: +v.Vdc, inverterEff: +v.invEff, eodRatio: +v.eodRatio, ageingFactor: +v.ageing, tempFactor: +v.Tf, designMargin: +v.margin });
    if (bad(r)) return inv(r);
    var g = function (a) { for (var i = 0; i < a.length; i++) if (r[a[i]] !== undefined) return r[a[i]]; };
    return { S_ups: g(['requiredUpsKva']), Std: g(['standardUpsKva']), P_batt: g(['batteryPowerKw']), V_eod: g(['eodVoltageV']), I_dc: g(['dcCurrentEodA']), Ah_req: g(['requiredAh']), Std_Ah: g(['standardAh']) };
  },
  lgt: function (v) {
    var r = W.EngLighting.calculate({ lengthM: +v.L_m, widthM: +v.W_m, mountingHeightM: +v.Hm_m, targetLux: +v.targetLux, lumensPerFixture: +v.lumens, wattPerFixture: +v.watts, uf: +v.UF, mf: +v.MF });
    if (bad(r)) return inv(r);
    return { A: r.A, K: r.K, N_ex: r.N_exact, Grid: r.N_grid, SHR: r.shr, 'W/m2': r.wPerM2 };
  },
  pfc: function (v) {
    var r = tryRun(function () { return W.EngPfcCpc.pfc({ pKW: +v.P_kW, pfExisting: +v.PF1, pfTarget: +v.PF2, voltageV: +v.V_3ph }); });
    if (r.invalid) return r;
    var P = +v.P_kW;
    return { Q1: P * Math.tan(Math.acos(+v.PF1)), Qc: r.Qc, Std: r.standardKVAR, PF_fin: r.pfFinal };
  },
  cpc: function (v) {
    var r = tryRun(function () { return W.EngPfcCpc.cpc({ iscKA: +v.If_kA, timeS: +v.t_s, conductor: v.cond, insulation: v.insul, kind: v.type === 'single' ? 'insulated' : 'multicore', phaseMm2: +v.Sph_mm2, separated: v.protected === 'true' ? 'protected' : 'unprotected' }); });
    if (r.invalid) return r;
    if (!(+v.Sph_mm2 > 0)) return { invalid: true, msg: 'Sph<=0 accepted by app? ' };
    return { k: r.k, S_ad: r.adiabaticMm2, S_std: r.selectedMm2, S_simp: r.simplifiedMm2 };
  },
  ct: function (v) {
    var r = W.EngCableTray.calculate({ cableCount: +v.count, outerDiaMm: +v.diaMm, arrangement: v.type === 'single-core' ? 'single_core' : 'multicore', sparePct: +v.sparePct, trayDepthMm: +v.depthMm, fillLimitPct: +v.fillLimitPct });
    if (bad(r)) return inv(r);
    return { W_area: r.reqWidthByArea, W_lay: r.layoutWidthMm, W_req: r.requiredWidthMm, Std: r.stdWidthMm, Fill: r.actualFillPct };
  }
};
var ALIAS = { Std_Ah: 'Std' };

function parseHand(s) {
  if (/^INVALID_INPUT/.test(s)) return { invalid: true };
  var o = {}, re = /([A-Za-z_\/0-9]+)=([-0-9.]+|None|True|False)/g, m;
  var gm = s.match(/Grid=\d+x\d+=(\d+)/); s = s.replace(/Grid=\d+x\d+=\d+/, '');
  while ((m = re.exec(s))) o[m[1]] = m[2] === 'True' ? true : m[2] === 'False' ? false : m[2] === 'None' ? null : Number(m[2]);
  if (gm) o.Grid = Number(gm[1]);
  return o;
}
function close(a, b, key) {
  if (typeof b === 'boolean') return a === b;
  if (b === null) return a === null || a === undefined;
  if (typeof a !== 'number') return false;
  var tol = key === 'Std' || /^(Std|StdS|S_std|MinS_VD)$/.test(key) ? 1e-9 : Math.max(2e-3 * Math.abs(b), 2e-3);
  return Math.abs(a - b) <= tol;
}
var files = ['cab', 'isc', 'tx', 'gen', 'ups', 'lgt', 'pfc', 'cpc', 'ct'], total = 0, mism = [], matched = 0;
files.forEach(function (f) {
  parseCsv(fs.readFileSync(path.join(__dirname, f + '.csv'), 'utf8')).forEach(function (v) {
    total++;
    var hand = parseHand(v.hand_result), app = tryRun(function () { return RUN[f](v); });
    var diffs = [];
    if (hand.invalid) { if (!app.invalid) diffs.push('model expects error, app accepted (' + JSON.stringify(app).slice(0, 110) + ')'); }
    else if (app.invalid) diffs.push('app rejects (' + app.msg + '), model computed a result');
    else {
      Object.keys(hand).forEach(function (k) {
        if (f === 'ups' && k === 'Std') return;
        var got = app[k];
        if (got === undefined) return;
        if (!close(got, hand[k], k)) diffs.push(k + ': model ' + hand[k] + ' app ' + (typeof got === 'number' ? Math.round(got * 1e4) / 1e4 : got));
      });
      if (f === 'ups') { var mah = v.hand_result.match(/Ah_req=[-0-9.]+Ah \(Std=(\d+|None)\)/); if (mah && String(app.Std_Ah) !== mah[1] && !(mah[1]==='None' && app.Std_Ah==null)) diffs.push('Std_Ah: model ' + mah[1] + ' app ' + app.Std_Ah); var m2 = v.hand_result.match(/S_ups=[-0-9.]+kVA \(Std=(\d+|None)\)/); if (m2 && String(app.Std) !== m2[1] && !(m2[1] === 'None' && app.Std == null)) diffs.push('Std_kVA: model ' + m2[1] + ' app ' + app.Std); }
      if (f === 'gen' && app._xd !== 15) diffs.push('Xd=' + app._xd + ' not an app input (app fixed Xd); Dip compare uses app constant');
    }
    if (diffs.length) mism.push(v.id + ' | ' + diffs.join(' ; ')); else matched++;
  });
});
console.log('vectors: ' + total + ' | matched: ' + matched + ' | mismatched: ' + mism.length);
mism.forEach(function (m) { console.log(m); });
