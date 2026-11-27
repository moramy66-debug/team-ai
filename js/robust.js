(function () {
  'use strict';
  var d = document;
  var bar = null, lastQuota = 0, lastErr = 0;

  function ensureBar() {
    if (bar && bar.isConnected) return bar;
    bar = d.createElement('div');
    bar.id = 'rzToasts';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    (d.body || d.documentElement).appendChild(bar);
    return bar;
  }

  function toast(id, text, opts) {
    opts = opts || {};
    var host = ensureBar();
    var old = d.getElementById('rz-' + id);
    if (old) old.remove();
    var t = d.createElement('div');
    t.className = 'rz-toast' + (opts.warn ? ' warn' : '');
    t.id = 'rz-' + id;
    var s = d.createElement('span');
    s.textContent = text;
    t.appendChild(s);
    if (opts.action) {
      var a = d.createElement('button');
      a.type = 'button';
      a.className = 'rz-act';
      a.textContent = opts.action.label;
      a.onclick = opts.action.fn;
      t.appendChild(a);
    }
    var x = d.createElement('button');
    x.type = 'button';
    x.className = 'rz-x';
    x.setAttribute('aria-label', 'إغلاق التنبيه');
    x.textContent = '\u00d7';
    x.onclick = function () { t.remove(); };
    t.appendChild(x);
    host.appendChild(t);
    if (opts.ms) setTimeout(function () { if (t.isConnected) t.remove(); }, opts.ms);
    return t;
  }
  window.RzToast = toast;

  window.__lsQuota = function (e) {
    if (!e) return;
    var q = e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014;
    if (!q) return;
    var now = Date.now();
    if (now - lastQuota < 20000) return;
    lastQuota = now;
    toast('quota', 'مساحة التخزين في المتصفح ممتلئة، آخر تغيير ممكن ما يكونش اتحفظ. صدّر نسخة احتياطية وامسح السجل القديم.', { warn: true });
  };

  function offlineState() {
    if (navigator.onLine === false) {
      toast('offline', 'أنت أوفلاين. الحاسبات والملفات المحفوظة شغالة، لكن تشغيل النماذج محتاج إنترنت.', { warn: true });
    } else {
      var o = d.getElementById('rz-offline');
      if (o) o.remove();
    }
  }
  window.addEventListener('online', offlineState);
  window.addEventListener('offline', offlineState);

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    var hadController = !!navigator.serviceWorker.controller;
    var shown = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      if (shown) return;
      shown = true;
      toast('update', 'فيه نسخة جديدة من التطبيق جاهزة.', { action: { label: 'تحديث', fn: function () { location.reload(); } } });
    });
  }

  window.addEventListener('error', function (ev) {
    try {
      var f = ev && ev.filename || '';
      if (!f || f.indexOf(location.origin) !== 0) return;
      console.error('[Ramz]', ev.message, f, ev.lineno);
      var now = Date.now();
      if (now - lastErr < 60000) return;
      lastErr = now;
      toast('err', 'حصل خطأ غير متوقع. لو اتكرر، صدّر نسخة احتياطية وحدّث الصفحة.', { warn: true, ms: 12000 });
    } catch (_) { }
  });
  window.addEventListener('unhandledrejection', function (ev) {
    try {
      var r = ev && ev.reason;
      console.error('[Ramz] unhandled', r);
      if (r && (r.name === 'QuotaExceededError' || r.code === 22)) window.__lsQuota(r);
    } catch (_) { }
  });

  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var c = d.getElementById('ptCloseBtn');
    var m = d.getElementById('ptModalBackdrop');
    if (c && m && m.classList.contains('open')) { c.click(); return; }
    var hb = d.getElementById('ptHelpBackdrop');
    var hc = d.getElementById('ptHelpClose');
    if (hb && hc && hb.offsetParent !== null) hc.click();
  });

  function boot() {
    offlineState();
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { });
    } catch (_) { }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
