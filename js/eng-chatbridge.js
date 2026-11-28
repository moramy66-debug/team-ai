/* Ramz - chat bridge: when an areas file (xlsx / csv) is attached to a task, the app reads it itself
   and offers to open it in the Load Estimate calculator. The model never produces the numbers. */
(function () {
  'use strict';
  var CARD = 'imp-chat-card';
  function fmt(x) { return (Math.round(x * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function show(file, sum) {
    var old = document.getElementById(CARD); if (old) old.remove();
    var host = document.getElementById('chips'); if (!host || !host.parentNode) return;
    var c = document.createElement('div'); c.id = CARD; c.className = 'imp-chat-card';
    var t = document.createElement('div'); t.className = 'imp-chat-t';
    t.textContent = 'Areas file read by the app: ' + file.name;
    var d = document.createElement('div'); d.className = 'imp-small';
    d.textContent = sum.spaces + ' spaces, ' + fmt(sum.area) + ' m2. Offices (C7): ' + fmt(sum.c7) + ' m2. Restaurant / cafe (C6): ' + fmt(sum.c6) + ' m2.' + (sum.unmapped ? ' Unmapped: ' + sum.unmapped + ' spaces (' + fmt(sum.unmappedArea) + ' m2), you will choose a category for them.' : '') + ' Press Run: the app asks you to confirm each category, then calculates here. The load numbers come from the calculator, not from the AI.';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ec-btn'; b.textContent = 'Open in Load Estimate (optional)';
    b.addEventListener('click', function () {
      window.EngAreaImport.pending = file;
      var top = document.getElementById('ec-topbar-btn'); if (top) top.click();
      setTimeout(function () {
        var tab = [].slice.call(document.querySelectorAll('button')).filter(function (x) { return x.offsetParent && x.textContent.trim() === 'Load Estimate'; })[0];
        if (tab) tab.click();
      }, 300);
    });
    c.appendChild(t); c.appendChild(d); c.appendChild(b); host.parentNode.insertBefore(c, host.nextSibling);
  }
  function onFiles(files) {
    if (!window.EngAreaImport) return;
    [].slice.call(files || []).some(function (f) {
      if (!/\.(xlsx|xlsm|csv)$/i.test(f.name)) return false;
      window.EngAreaImport.chatFile = null;
      window.EngAreaImport.readFile(f).then(function (sheets) {
        var s = window.EngAreaImport.summarize(sheets);
        if (s.spaces > 0) window.EngAreaImport.chatFile = f;
        if (s.spaces > 0 && (s.c7 > 0 || s.c6 > 0)) show(f, s);
      }).catch(function () {});
      return true;
    });
  }
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'file') onFiles(e.target.files); }, true);
})();
