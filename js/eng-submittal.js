/* Submittal / offer review: spec requirements vs contractor offer -> ordered consultant remarks + approval code.
   Pure logic is exposed on window.EngSubmittal (tested in tools/eng-submittal-test.js). UI is an Eng Calc tab. */
(function () {
  'use strict';

  var MANDATORY = /\b(shall|must|required|mandatory|minimum|maximum|not less than|not more than|at least|comply|complying)\b|يجب|يلزم|مطلوب|إلزام|لا يقل|لا يزيد|لا تقل|لا تزيد/i;
  var MIN_RE = /\b(min|minimum|at least|not less than|no less than)\b|≥|>=|لا يقل|لا تقل|على الأقل|حد أدنى/i;
  var MAX_RE = /\b(max|maximum|not more than|not exceed|up to)\b|≤|<=|لا يزيد|لا تزيد|حد أقصى|لا يتجاوز/i;
  var STOP = /^(that|this|with|shall|will|from|have|been|should|which|their|there|where|shall|each|every|الذي|التي|على|هذا|هذه|يجب|عند|كما|أو|مع|في|من|إلى|الى)$/i;
  var STD_RE = /\b(IEC|BS|EN|IEEE|NFPA|UL|SASO|SBC|SEC|ISO|ASTM|NEMA|DIN|VDE)\s*-?\s*\d[\dA-Za-z\-.:]*/gi;
  var UNIT_RE = /(\d+(?:\.\d+)?)\s*(kA|kV|kVA|kVAR|kW|MVA|VA|mm2|mm²|mm|Hz|°C|V|A|W|%|m)(?![A-Za-z])/g;
  var IP_RE = /\bIP\s?\d{2}\b/gi;

  var TYPE_LABEL = { missing: 'بند ناقص (Missing)', deviation: 'مخالفة للمواصفات (Deviation)', clarification: 'يحتاج توضيح (Clarification)' };
  var SEV_LABEL = { critical: 'جوهرية', major: 'مهمة', minor: 'ثانوية' };
  var SEV_ORDER = { critical: 0, major: 1, minor: 2 };
  var CODES = {
    A: 'A - معتمد (Approved)',
    B: 'B - معتمد مع الملاحظات (Approved as Noted)',
    C: 'C - يعاد التقديم بعد التعديل (Revise and Resubmit)',
    D: 'D - مرفوض (Rejected)'
  };

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
      .replace(/[\u064B-\u065F\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function stdKey(s) { return norm(s).replace(/[\s\-:.]/g, ''); }

  function splitRequirements(spec) {
    var raw = norm0(spec).split(/\n+|(?<=[^\d\s][.;؛])\s+(?=\S)/), out = [];
    raw.forEach(function (line) {
      var m = /^\s*(?:[-•*●▪]\s*|\(?([0-9]+(?:\.[0-9]+)*)[.)\-:]?\s+|\(?([a-z])\)\s+)/i.exec(line);
      var clause = m ? (m[1] || m[2] || '') : '';
      var text = (m ? line.slice(m[0].length) : line).trim();
      if (!text) return;
      var words = text.split(/\s+/).length, hasTok = hasTokens(text);
      if (text.length < 12 || (words < 4 && !hasTok)) return;
      if (!/[A-Za-z\u0600-\u06FF]/.test(text)) return;
      out.push({ no: out.length + 1, clause: clause, text: text, mandatory: MANDATORY.test(text) });
    });
    return out.slice(0, 60);
  }
  function norm0(s) { return String(s == null ? '' : s).replace(/\r/g, ''); }
  function hasTokens(t) { return !!(t.match(STD_RE) || t.match(UNIT_RE) || t.match(IP_RE)); }

  function unitValues(text) {
    var out = [], t = String(text).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); }), m;
    UNIT_RE.lastIndex = 0;
    while ((m = UNIT_RE.exec(t))) out.push({ v: parseFloat(m[1]), u: m[2].replace('²', '2').toLowerCase() });
    return out;
  }
  function wordsOf(t) {
    return norm(t).split(/[^a-z0-9\u0600-\u06FF]+/).filter(function (w) {
      return (/[a-z]/.test(w) ? w.length >= 4 : w.length >= 3) && !STOP.test(w) && !/^\d+$/.test(w);
    });
  }

  function checkRequirement(req, offerNorm, offerRaw) {
    var issues = [], t = req.text, tn = norm(t);
    var stds = (t.match(STD_RE) || []).map(stdKey);
    var offerStdText = stdKey(offerRaw);
    var stdMissing = stds.filter(function (s) { return offerStdText.indexOf(s) < 0; });
    var ips = (t.match(IP_RE) || []).map(function (s) { return s.replace(/\s/g, '').toLowerCase(); });
    var ipMissing = ips.filter(function (s) { return offerNorm.replace(/\s/g, '').indexOf(s) < 0; });
    var uv = unitValues(t), ov = unitValues(offerRaw), uvBad = [], uvNo = [];
    var min = MIN_RE.test(t), max = MAX_RE.test(t);
    uv.forEach(function (x) {
      var same = ov.filter(function (o) { return o.u === x.u; });
      if (same.some(function (o) { return o.v === x.v; })) return;
      if (min && same.some(function (o) { return o.v >= x.v; })) return;
      if (max && same.some(function (o) { return o.v <= x.v; })) return;
      if (same.length) uvBad.push({ x: x, found: same.map(function (o) { return o.v + ' ' + o.u; }) });
      else uvNo.push(x);
    });
    var ws = wordsOf(t), hit = ws.filter(function (w) { return offerNorm.indexOf(w) >= 0; }).length, cov = ws.length ? hit / ws.length : 0;
    var hasTok = stds.length || ips.length || uv.length;
    var q = { no: req.no, clause: req.clause, quote: t };
    if (stdMissing.length) issues.push(mk(req, 'missing', req.mandatory ? 'critical' : 'major', 'المرجع القياسي المطلوب (' + (t.match(STD_RE) || []).join('، ') + ') غير مذكور في العرض المقدم.', 'يلزم تأكيد المطابقة مع المرجع المذكور وتقديم شهادة اختبار أو بيان مطابقة معتمد.'));
    if (ipMissing.length) issues.push(mk(req, 'missing', req.mandatory ? 'critical' : 'major', 'درجة الحماية المطلوبة (' + (t.match(IP_RE) || []).join('، ') + ') غير مذكورة في العرض.', 'يلزم تقديم Datasheet يوضح درجة الحماية المطلوبة.'));
    uvBad.forEach(function (b) { issues.push(mk(req, 'deviation', req.mandatory ? 'major' : 'minor', 'المتطلب يحدد القيمة ' + b.x.v + ' ' + b.x.u + '، بينما يذكر العرض لنفس الوحدة القيم: ' + b.found.join('، ') + '، ولا يتضمن القيمة المطلوبة.', 'يلزم توضيح القيمة المعتمدة وتقديم المستند الداعم، وإلا تُعدّ مخالفة للمواصفات.')); });
    uvNo.forEach(function (x) { issues.push(mk(req, 'missing', req.mandatory ? 'critical' : 'major', 'القيمة المطلوبة ' + x.v + ' ' + x.u + ' غير مذكورة في العرض المقدم.', 'يلزم تقديم البيانات الفنية التي تثبت استيفاء هذه القيمة.')); });
    if (!issues.length) {
      if (!hasTok && cov < 0.2) issues.push(mk(req, 'missing', req.mandatory ? 'critical' : 'major', 'لم يتم العثور في العرض المقدم على ما يفي بهذا المتطلب.', 'يلزم تقديم ما يثبت المطابقة (كتالوج أو Datasheet أو شهادة اختبار).'));
      else if (!hasTok && cov < 0.5) issues.push(mk(req, 'clarification', 'minor', 'العرض يتناول هذا المتطلب جزئيًا فقط، ولا يظهر استيفاؤه بوضوح.', 'يلزم توضيح المطابقة بند ببند مع المرجع في المستند المقدم.'));
    }
    return issues;
  }
  function mk(req, type, sev, finding, action) {
    return { req: req.no, clause: req.clause, quote: req.text, type: type, severity: sev, finding: finding, action: action, src: 'rule', verified: true };
  }

  function ruleReview(spec, offer) {
    var reqs = splitRequirements(spec), on = norm(offer), items = [];
    reqs.forEach(function (r) { items = items.concat(checkRequirement(r, on, offer)); });
    return { reqs: reqs, items: items };
  }

  function sortItems(items) {
    return items.slice().sort(function (a, b) { return (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || ((a.req || 0) - (b.req || 0)); });
  }

  /* Proposed rule, shown in the UI: critical>=1 or major>=3 -> C; major 1-2 or any minor -> B; none -> A. D is manual only. */
  function conclusion(items) {
    var c = { critical: 0, major: 0, minor: 0 };
    items.forEach(function (i) { if (c[i.severity] != null) c[i.severity]++; });
    var code = (c.critical >= 1 || c.major >= 3) ? 'C' : ((c.major >= 1 || c.minor >= 1) ? 'B' : 'A');
    return { code: code, label: CODES[code], counts: c, rule: 'القاعدة المقترحة: ملاحظة جوهرية واحدة أو أكثر، أو 3 ملاحظات مهمة أو أكثر = C. ملاحظة أو ملاحظتان مهمتان أو أي ملاحظة ثانوية = B. لا ملاحظات = A. الكود D يحدده المراجع يدويًا. عدّل الكود حسب جدول الأكواد في العقد.' };
  }

  function buildPrompt(reqs, offer, meta) {
    var list = reqs.map(function (r) { return r.no + '. ' + r.text; }).join('\n');
    return 'You are a senior consultant engineer reviewing a contractor technical submittal against the project specification requirements. Compare ONLY what is written. Never invent data that is not in the OFFER text. Output JSON only, no prose.\n' +
      'Discipline: ' + (meta.discipline || 'Electrical') + '\n\nSPEC REQUIREMENTS (numbered):\n' + list + '\n\nCONTRACTOR OFFER TEXT:\n' + offer + '\n\n' +
      'For every requirement that is NOT clearly satisfied by the offer, return one item. Skip requirements that are clearly satisfied. Schema: {"items":[{"req":<requirement number>,"type":"missing|deviation|clarification","severity":"critical|major|minor","offer_quote":"exact short quote copied from the OFFER text that supports the finding, or empty string if the offer is silent","finding_ar":"formal Arabic sentence stating the finding","action_ar":"formal Arabic sentence stating the required action"}]}\n' +
      'Rules: missing = the offer does not address it. deviation = the offer states something different from the requirement (state both values). clarification = unclear or partial. critical = a mandatory (shall/must) requirement is missing or contradicted. Write finding_ar and action_ar in formal Modern Standard Arabic, keep engineering terms, units and standard numbers in English.';
  }

  function mergeModel(modelItems, reqs, offer, ruleItems) {
    var byNo = {}, on = norm(offer), out = [], covered = {};
    reqs.forEach(function (r) { byNo[r.no] = r; });
    (modelItems || []).forEach(function (m) {
      var r = byNo[Number(m.req)];
      if (!r || !m.finding_ar) return;
      var type = TYPE_LABEL[m.type] ? m.type : 'clarification', sev = SEV_ORDER[m.severity] != null ? m.severity : 'minor';
      var oq = String(m.offer_quote || '').trim(), verified = !oq || on.indexOf(norm(oq)) >= 0;
      var f = String(m.finding_ar).trim() + (oq && verified ? ' (من العرض: «' + oq + '»)' : '');
      out.push({ req: r.no, clause: r.clause, quote: r.text, type: type, severity: sev, finding: f, action: String(m.action_ar || '').trim() || 'يلزم تقديم المستند الداعم.', src: 'model', verified: verified });
      covered[r.no] = true;
    });
    ruleItems.forEach(function (i) { if (!covered[i.req]) out.push(i); });
    return out;
  }

  function reportText(rev) {
    var L = [], n = 0, p = rev.project || {};
    L.push('مراجعة فنية للمستند المقدم');
    L.push('المشروع: ' + (p.name || '-') + ' | المستند: ' + (rev.title || '-') + ' | التاريخ: ' + rev.date);
    L.push('');
    L.push('أولاً: ملاحظات المراجعة');
    if (!rev.items.length) L.push('لم تظهر ملاحظات على المتطلبات التي تمت مراجعتها.');
    sortItems(rev.items).forEach(function (i) {
      n++;
      L.push(n + '. [' + TYPE_LABEL[i.type] + ' - أهمية ' + SEV_LABEL[i.severity] + '] المتطلب رقم ' + i.req + (i.clause ? ' (بند ' + i.clause + ')' : '') + ': «' + i.quote + '»');
      L.push('   الملاحظة: ' + i.finding + (i.verified ? '' : ' [اقتباس غير مطابق للعرض، يحتاج مراجعة يدوية]'));
      L.push('   الإجراء المطلوب: ' + i.action);
    });
    L.push('');
    L.push('ثانيًا: الخلاصة وكود الاعتماد');
    L.push('عدد المتطلبات التي تمت مراجعتها: ' + rev.reqCount + '. الملاحظات: جوهرية ' + rev.concl.counts.critical + '، مهمة ' + rev.concl.counts.major + '، ثانوية ' + rev.concl.counts.minor + '.');
    L.push('كود الاعتماد المقترح: ' + rev.concl.label);
    L.push('يلزم على المقاول معالجة الملاحظات أعلاه وإعادة التقديم عند الحاجة قبل التوريد أو التنفيذ.');
    L.push('طريقة المراجعة: ' + rev.method);
    return L.join('\n');
  }

  function pdfDoc(rev) {
    var rows = sortItems(rev.items).map(function (i, k) { return [String(k + 1), TYPE_LABEL[i.type] + ' / ' + SEV_LABEL[i.severity], 'المتطلب ' + i.req + ': ' + i.quote, i.finding + (i.verified ? '' : ' [يحتاج مراجعة يدوية]'), i.action]; });
    var blocks = [{ type: 'summary', text: 'كود الاعتماد المقترح: ' + rev.concl.label + ' | جوهرية ' + rev.concl.counts.critical + ' | مهمة ' + rev.concl.counts.major + ' | ثانوية ' + rev.concl.counts.minor, ok: rev.concl.code === 'A' ? true : (rev.concl.code === 'B' ? undefined : false) }];
    blocks.push({ type: 'text', heading: 'نطاق المراجعة', text: 'المستند: ' + (rev.title || '-') + '. عدد المتطلبات: ' + rev.reqCount + '. طريقة المراجعة: ' + rev.method + '. ' + rev.concl.rule });
    if (rows.length) blocks.push({ type: 'table', heading: 'ملاحظات المراجعة / Review remarks', columns: ['م', 'النوع', 'المتطلب', 'الملاحظة', 'الإجراء المطلوب'], rows: rows, widths: [0.05, 0.15, 0.24, 0.31, 0.25], rtl: true, fontSize: 19 });
    return { title: 'Submittal Review', subtitle: rev.title || 'Technical submittal review', blocks: blocks, signature: true, fileBase: 'Submittal-Review' };
  }

  async function review(spec, offer, meta) {
    meta = meta || {};
    var rr = ruleReview(spec, offer), reqs = rr.reqs, items = rr.items, method = 'فحص آلي بالقواعد فقط (مطابقة نصية للمراجع والقيم والكلمات المفتاحية)، دون موديل ذكاء اصطناعي. النتيجة تقريبية وتحتاج مراجعة المهندس.', warnings = [];
    var a = null, G = window;
    if (reqs.length && typeof G.agents === 'function' && typeof G.ask === 'function' && typeof G.pickVerifier === 'function') {
      var off = String(offer), cut = off.length > 14000;
      if (cut) { off = off.slice(0, 14000); warnings.push('نص العرض أطول من 14000 حرف، وتمت مراجعة أول 14000 حرف فقط.'); }
      var prompt = buildPrompt(reqs, off, meta);
      try {
        a = G.pickVerifier(prompt);
        if (a) {
          var raw = await G.ask(a, 'You are a precise consultant engineer. Output valid JSON only.', prompt, true);
          var j = G.parseJ ? G.parseJ(raw) : null;
          if (j && Array.isArray(j.items)) {
            items = mergeModel(j.items, reqs, offer, rr.items);
            method = 'مراجعة بموديل ' + a.name + ' مع التحقق من الاقتباسات، مدعومة بفحص آلي بالقواعد للبنود التي لم يغطها الموديل.';
          } else warnings.push('رد الموديل لم يكن بصيغة JSON صالحة، لذا استُخدم الفحص الآلي فقط.');
        }
      } catch (e) {
        warnings.push('تعذر استدعاء الموديل (' + (e && e.message ? e.message : e) + ')، لذا استُخدم الفحص الآلي فقط.');
      }
    } else if (!reqs.length) warnings.push('لم يتم التعرف على متطلبات في نص المواصفات. ضع كل متطلب في سطر مستقل.');
    var concl = conclusion(items);
    return { items: items, reqCount: reqs.length, concl: concl, method: method, warnings: warnings, modelUsed: method.indexOf('بموديل') === 0 };
  }

  window.EngSubmittal = { norm: norm, splitRequirements: splitRequirements, ruleReview: ruleReview, conclusion: conclusion, mergeModel: mergeModel, buildPrompt: buildPrompt, reportText: reportText, pdfDoc: pdfDoc, review: review, sortItems: sortItems, CODES: CODES };

  /* ---------------- UI ---------------- */
  function register() {
    if (typeof document === 'undefined' || !window.EngUI || typeof window.EngUI.registerTab !== 'function') return false;
    var h = window.EngUI.helpers, el = h.el;
    window.EngUI.registerTab('submittal', 'Submittal', function (body) {
      var last = null;
      var info = el('div', 'ec-summary', 'ألصق متطلبات المواصفات (كل متطلب في سطر) ونص عرض المقاول، وهيطلع ملاحظات المراجعة مرتبة بكود اعتماد مقترح. تقدر ترفع ملف txt أو PDF.');
      body.appendChild(info);
      function area(id, label) {
        var w = el('div', 'ec-field'), lb = el('label', null, label); lb.setAttribute('for', id);
        var ta = document.createElement('textarea'); ta.id = id; ta.rows = 6; ta.setAttribute('dir', 'auto');
        ta.style.cssText = 'width:100%;min-height:120px;padding:8px 10px;border-radius:8px;border:1px solid var(--line,#2a3347);background:var(--bg,#0b1020);color:var(--tx,#e5e7eb);font-size:14px;box-sizing:border-box;font-family:inherit;';
        var fl = document.createElement('input'); fl.type = 'file'; fl.accept = '.txt,.md,.csv,.pdf,text/plain,application/pdf'; fl.setAttribute('aria-label', label + ' file');
        fl.style.cssText = 'min-height:44px;font-size:13px;color:var(--mut,#9ca3af);max-width:100%;';
        fl.addEventListener('change', function () {
          var f = fl.files && fl.files[0]; if (!f) return;
          var done = function (t) { ta.value = t; status.textContent = 'تم تحميل ' + f.name + ' (' + t.length + ' حرف).'; };
          if (/\.pdf$/i.test(f.name) && typeof window.pdfText === 'function') window.pdfText(f).then(function (t) { done(Array.isArray(t) ? t.join('\n') : String(t)); }).catch(function () { status.textContent = 'تعذر قراءة الـ PDF. الصق النص يدويًا.'; });
          else f.text().then(done);
        });
        w.appendChild(lb); w.appendChild(ta); w.appendChild(fl); return w;
      }
      var g0 = el('div', 'ec-grid');
      g0.appendChild(h.createField('ec-sb-title', 'Submittal title', 'text', ''));
      g0.appendChild(h.createField('ec-sb-disc', 'Discipline', 'select', [{ value: 'Electrical', label: 'Electrical', selected: true }, { value: 'Mechanical', label: 'Mechanical' }, { value: 'Fire Fighting', label: 'Fire Fighting' }, { value: 'Other', label: 'Other' }]));
      body.appendChild(g0);
      var status = el('div', 'ec-summary', '');
      var s1 = area('ec-sb-spec', 'Spec requirements (متطلبات المواصفات)'), s2 = area('ec-sb-offer', 'Contractor offer (عرض المقاول)');
      body.appendChild(s1); body.appendChild(s2);
      var row = el('div', 'ec-actions'), go = el('button', 'ec-btn', 'Review Submittal'); go.type = 'button'; row.appendChild(go); body.appendChild(row);
      body.appendChild(status);
      var out = el('div', null); body.appendChild(out);

      function render(rev) {
        out.innerHTML = '';
        rev.warnings.forEach(function (w) { out.appendChild(el('div', 'ec-warn', w)); });
        var cls = rev.concl.code === 'A' ? 'ec-cx ec-cx-ok' : 'ec-cx ec-cx-warn';
        out.appendChild(el('div', cls, 'كود الاعتماد المقترح: ' + rev.concl.label + ' | جوهرية ' + rev.concl.counts.critical + ' | مهمة ' + rev.concl.counts.major + ' | ثانوية ' + rev.concl.counts.minor));
        out.appendChild(el('div', 'ec-summary', rev.method + ' ' + rev.concl.rule));
        var items = sortItems(rev.items);
        if (!items.length) out.appendChild(el('div', 'ec-ok', 'لم تظهر ملاحظات على ' + rev.reqCount + ' متطلب.'));
        items.forEach(function (i, k) {
          var c = el('div', 'ec-summary'); c.style.direction = 'rtl'; c.style.textAlign = 'right';
          c.appendChild(el('div', null, (k + 1) + '. ' + TYPE_LABEL[i.type] + ' | أهمية ' + SEV_LABEL[i.severity] + ' | المتطلب ' + i.req + (i.src === 'rule' ? ' | فحص آلي' : '')));
          c.firstChild.style.fontWeight = '700';
          c.appendChild(el('div', null, 'المتطلب: ' + i.quote));
          c.appendChild(el('div', null, 'الملاحظة: ' + i.finding + (i.verified ? '' : ' [اقتباس غير مطابق للعرض، يحتاج مراجعة يدوية]')));
          c.appendChild(el('div', null, 'الإجراء المطلوب: ' + i.action));
          out.appendChild(c);
        });
        var acts = el('div', 'ec-actions'), cp = el('button', 'ec-btn ec-btn-sec', 'Copy remarks'), pd = el('button', 'ec-btn ec-btn-sec', 'PDF');
        cp.type = 'button'; pd.type = 'button';
        cp.addEventListener('click', function () {
          var t = reportText(rev);
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { status.textContent = 'تم نسخ الملاحظات.'; }, function () { status.textContent = 'تعذر النسخ التلقائي.'; });
          else status.textContent = 'النسخ غير مدعوم في هذا المتصفح.';
        });
        pd.addEventListener('click', function () {
          if (!window.EngPDF) { status.textContent = 'وحدة PDF غير محملة.'; return; }
          try { status.textContent = 'تم إنشاء الملف: ' + window.EngPDF.download(pdfDoc(rev)); } catch (e) { status.textContent = 'تعذر إنشاء PDF: ' + (e && e.message ? e.message : e); }
        });
        acts.appendChild(cp); acts.appendChild(pd); out.appendChild(acts);
      }

      go.addEventListener('click', function () {
        var spec = document.getElementById('ec-sb-spec').value, offer = document.getElementById('ec-sb-offer').value;
        if (spec.trim().length < 20 || offer.trim().length < 20) { status.textContent = 'ألصق متطلبات المواصفات ونص العرض الأول.'; return; }
        go.disabled = true; status.textContent = 'جاري المراجعة...'; out.innerHTML = '';
        var meta = { discipline: h.val('ec-sb-disc'), title: h.val('ec-sb-title') };
        review(spec, offer, meta).then(function (r) {
          r.title = meta.title; r.date = new Date().toISOString().slice(0, 10);
          r.project = window.EngPDF ? window.EngPDF.projectInfo() : {};
          last = r; render(r); status.textContent = 'تمت المراجعة: ' + r.items.length + ' ملاحظة على ' + r.reqCount + ' متطلب.';
        }).catch(function (e) { status.textContent = 'تعذرت المراجعة: ' + (e && e.message ? e.message : e); }).then(function () { go.disabled = false; });
      });
    });
    return true;
  }
  if (typeof document !== 'undefined') {
    if (!register()) { var n = 0, iv = setInterval(function () { if (register() || ++n > 40) clearInterval(iv); }, 250); }
  }
})();
