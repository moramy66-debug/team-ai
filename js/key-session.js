/* Session-only API keys: when the flag is on, keys are kept in sessionStorage
   (cleared when the tab closes) and stripped from the localStorage copy. */
(function () {
  'use strict';
  var FLAG = 'teamai.keysSession', SK = 'teamai.sk.';
  if (typeof Storage === 'undefined') return;
  var os = Storage.prototype.setItem, og = Storage.prototype.getItem;
  function isLS(o) { try { return o === window.localStorage; } catch (e) { return false; } }
  function on() { try { return og.call(window.localStorage, FLAG) === '1'; } catch (e) { return false; } }
  function sensitive(k) { return k === 'teamai.cfg' || k === 'teamai.ejs'; }
  function split(k, o) {
    var sec = {};
    if (k === 'teamai.cfg') {
      Object.keys(o || {}).forEach(function (p) { if (o[p] && typeof o[p] === 'object' && o[p].key) { sec[p] = o[p].key; o[p].key = ''; } });
    } else if (o && o.k) { sec.k = o.k; o.k = ''; }
    return sec;
  }
  function merge(k, o, sec) {
    if (k === 'teamai.cfg') { Object.keys(sec).forEach(function (p) { if (o[p] && typeof o[p] === 'object') o[p].key = sec[p]; }); }
    else if (sec.k) o.k = sec.k;
    return o;
  }
  Storage.prototype.setItem = function (k, v) {
    if (isLS(this) && sensitive(k) && on()) {
      try {
        var o = JSON.parse(v), sec = split(k, o);
        window.sessionStorage.setItem(SK + k, JSON.stringify(sec));
        v = JSON.stringify(o);
      } catch (e) { /* fall through, store unchanged */ }
    }
    return os.call(this, k, v);
  };
  Storage.prototype.getItem = function (k) {
    var r = og.call(this, k);
    if (r && isLS(this) && sensitive(k) && on()) {
      try {
        var sec = JSON.parse(window.sessionStorage.getItem(SK + k) || '{}');
        return JSON.stringify(merge(k, JSON.parse(r), sec));
      } catch (e) { return r; }
    }
    return r;
  };
  function init() {
    var cb = document.getElementById('keysSession');
    if (!cb) return;
    cb.checked = on();
    cb.addEventListener('change', function () {
      try {
        if (cb.checked) {
          var keep = {};
          ['teamai.cfg', 'teamai.ejs'].forEach(function (k) { keep[k] = og.call(window.localStorage, k); });
          os.call(window.localStorage, FLAG, '1');
          Object.keys(keep).forEach(function (k) { if (keep[k]) window.localStorage.setItem(k, keep[k]); });
        } else {
          window.localStorage.removeItem(FLAG);
        }
      } catch (e) { /* storage blocked */ }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
