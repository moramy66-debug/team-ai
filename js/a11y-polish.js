/* Accessibility polish: aria-labels for unlabeled controls and dir=ltr for key/model fields.
   Runs on load and when the DOM changes. Only adds attributes, never changes values or behavior. */
(function () {
  'use strict';
  var PROV = { gemini: 'Gemini', groq: 'Groq', groq2: 'Groq (second)', openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic' };
  var LABELS = {
    rules: 'قواعد الأسلوب والتقارير', mem: 'الميموري', task: 'نص المهمة', follow: 'سؤال المتابعة',
    sigFile: 'ملف صورة التوقيع', file: 'رفع ملف المهمة', cdName: 'اسم الكود', cdText: 'نص الكود', cdFile: 'ملف الكود',
    ejsS: 'EmailJS Service ID', ejsT: 'EmailJS Template ID', ejsK: 'EmailJS Public Key',
    ptLhName: 'اسم المكتب', ptLhDesc: 'وصف المكتب'
  };
  function labelFor(id) {
    var m = /^([km])_(.+)$/.exec(id);
    if (m && PROV[m[2]]) return PROV[m[2]] + (m[1] === 'k' ? ' API key' : ' model name');
    return LABELS[id] || null;
  }
  function hasLabel(e) {
    return e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') ||
      (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label');
  }
  function apply() {
    var list = document.querySelectorAll('input,select,textarea');
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.type === 'hidden') continue;
      if (e.id && /^[km]_/.test(e.id)) { e.setAttribute('dir', 'ltr'); e.style.textAlign = 'left'; }
      if (hasLabel(e)) continue;
      var t = (e.id && labelFor(e.id)) || e.getAttribute('placeholder');
      if (t) e.setAttribute('aria-label', t);
    }
  }
  function start() {
    apply();
    if (typeof MutationObserver === 'function') {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(apply, 200); })
        .observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  if (typeof window !== 'undefined') window.A11yPolish = { apply: apply, labelFor: labelFor };
})();
