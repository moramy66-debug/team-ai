/* Source info: tap a marker to see where a number or table comes from.
   Shows only what the data holds. Missing page / clause / edition is shown as "غير مسجل". */
(function (g) {
  'use strict';
  var NR = 'المصدر غير مسجل', NA = 'غير مسجل';
  var OFFICIAL = /(^|\.)(gov\.sa|iec\.ch|iso\.org|bsigroup\.com)$/i;

  function tableMeta(id) {
    try { return g.EngTables && g.EngTables.get && id ? g.EngTables.get(id) : null; } catch (e) { return null; }
  }
  function host(u) { try { return new URL(u).hostname; } catch (e) { return ''; } }

  function describe(u) {
    u = u || {};
    var m = tableMeta(u.id) || {};
    var url = u.source_url || u.source || m.source || null;
    var isUrl = typeof url === 'string' && /^https?:\/\//i.test(url);
    var h = isUrl ? host(url) : '';
    var st = u.status || m.status || NA;
    var kind;
    if (!url) kind = NR;
    else if (!isUrl) kind = 'نص مرجعي (مش رابط)';
    else if (OFFICIAL.test(h)) kind = 'موقع الجهة (' + h + ')';
    else kind = 'موقع منشور تاني (mirror) مش النص الرسمي (' + h + ')';
    return {
      id: u.id || '',
      title: u.title || m.title || u.topic || null,
      status: st,
      url: url ? String(url) : null,
      isUrl: isUrl,
      kind: kind,
      page: u.page || m.page || null,
      clause: u.clause || m.clause || null,
      edition: u.edition || m.edition || m.edition_note || u.edition_note || null,
      note: u.source_note || m.note || null,
      checked: u.checked_on || null
    };
  }

  /* one plain-text block, used by the PDF and copy */
  function text(u, n) {
    var d = describe(u);
    var parts = [];
    if (d.title) parts.push(d.title);
    parts.push('الحالة: ' + d.status);
    parts.push('المصدر: ' + (d.url || NR));
    if (d.url) parts.push('نوع المصدر: ' + d.kind);
    parts.push('الصفحة: ' + (d.page || NA));
    parts.push('البند: ' + (d.clause || NA));
    parts.push('الإصدار: ' + (d.edition || NA));
    return (n ? '[' + n + '] ' : '') + d.id + '  |  ' + parts.join('  |  ');
  }

  var CSS = '.si-bd{position:fixed;inset:0;z-index:10000;background:rgba(5,8,15,.6);display:none}' +
    '.si-bd.si-open{display:block}' +
    '.si-sheet{position:fixed;left:0;right:0;bottom:0;max-height:82vh;overflow:auto;box-sizing:border-box;background:var(--card,#181b22);color:var(--tx,#e8eaf0);border:1px solid var(--line,#2a2f3a);border-radius:16px 16px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));direction:rtl;text-align:right;box-shadow:0 -10px 40px rgba(0,0,0,.4)}' +
    '@media(min-width:700px){.si-sheet{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:560px;border-radius:16px}}' +
    '.si-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}' +
    '.si-h b{font-size:16px}' +
    '.si-x{min-width:44px;min-height:44px;border-radius:10px;border:1px solid var(--line,#2a2f3a);background:var(--card2,transparent);color:inherit;font-size:20px;cursor:pointer}' +
    '.si-hint{font-size:13px;color:var(--mut,#8b93a5);margin:0 0 8px}' +
    '.si-it{border:1px solid var(--line,#2a2f3a);border-radius:12px;padding:10px 12px;margin-top:8px;font-size:14px;line-height:1.7}' +
    '.si-it.si-hl{border-color:var(--ac,#6366f1)}' +
    '.si-t{font-weight:700;margin-bottom:2px;unicode-bidi:plaintext}' +
    '.si-r{display:flex;gap:6px;flex-wrap:wrap}.si-k{color:var(--mut,#8b93a5);min-width:72px}' +
    '.si-v{unicode-bidi:plaintext;word-break:break-word;flex:1}' +
    '.si-na{color:var(--er,#ef5b5b)}' +
    '.si-url{direction:ltr;text-align:left;unicode-bidi:isolate;word-break:break-all;color:var(--ac,#6366f1)}' +
    '.si-st{display:inline-block;padding:0 8px;border-radius:999px;border:1px solid var(--line,#2a2f3a);font-size:12px}' +
    '.si-mk{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;margin:-12px -8px;padding:0;background:transparent;border:0;color:var(--ac,#6366f1);font-size:15px;font-weight:700;cursor:pointer;vertical-align:middle}' +
    '.si-mk span{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1.5px solid currentColor;border-radius:50%;font-size:12px;line-height:1;font-style:italic;font-family:Georgia,serif}';

  var bd, sheet, listEl, titleEl, lastFocus;

  function ensure() {
    if (bd) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    bd = document.createElement('div'); bd.className = 'si-bd';
    bd.innerHTML = '<div class="si-sheet" role="dialog" aria-modal="true" aria-labelledby="siTitle" tabindex="-1">' +
      '<div class="si-h"><b id="siTitle"></b><button type="button" class="si-x" aria-label="إغلاق">&times;</button></div>' +
      '<p class="si-hint"></p><div class="si-list"></div></div>';
    document.body.appendChild(bd);
    sheet = bd.firstChild; listEl = sheet.querySelector('.si-list'); titleEl = sheet.querySelector('#siTitle');
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    sheet.querySelector('.si-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && bd.classList.contains('si-open')) close(); });
  }

  function row(k, v, na, isUrl) {
    var r = document.createElement('div'); r.className = 'si-r';
    var a = document.createElement('span'); a.className = 'si-k'; a.textContent = k;
    var b = document.createElement('span'); b.className = 'si-v' + (na ? ' si-na' : '');
    if (isUrl && v) {
      var l = document.createElement('a'); l.href = v; l.target = '_blank'; l.rel = 'noopener noreferrer'; l.className = 'si-url'; l.textContent = v;
      b.appendChild(l);
    } else b.textContent = v;
    r.appendChild(a); r.appendChild(b); return r;
  }

  function open(list, hl, title, hint) {
    ensure();
    lastFocus = document.activeElement;
    titleEl.textContent = title || 'مصدر القيم';
    sheet.querySelector('.si-hint').textContent = hint || '';
    listEl.textContent = '';
    (list || []).forEach(function (u, i) {
      var d = describe(u), it = document.createElement('div');
      it.className = 'si-it' + (hl === i ? ' si-hl' : '');
      var t = document.createElement('div'); t.className = 'si-t'; t.textContent = '[' + (i + 1) + '] ' + (d.title || d.id || NA); it.appendChild(t);
      if (d.title && d.id) it.appendChild(row('المعرّف', d.id, false));
      var stRow = row('الحالة', d.status, false); it.appendChild(stRow);
      it.appendChild(row('المصدر', d.url || NR, !d.url, d.isUrl));
      if (d.url) it.appendChild(row('نوع المصدر', d.kind, false));
      it.appendChild(row('الصفحة', d.page || NA, !d.page));
      it.appendChild(row('البند / Clause', d.clause || NA, !d.clause));
      it.appendChild(row('الإصدار', d.edition || NA, !d.edition));
      if (d.note) it.appendChild(row('ملاحظة', d.note, false));
      if (d.checked) it.appendChild(row('آخر فحص', d.checked, false));
      if (/needs_review/.test(d.status)) it.appendChild(row('تنبيه', 'القيمة محتاجة مراجعة قبل أي اعتماد', true));
      listEl.appendChild(it);
    });
    if (!(list || []).length) { var e = document.createElement('div'); e.className = 'si-it si-na'; e.textContent = NR; listEl.appendChild(e); }
    bd.classList.add('si-open');
    sheet.querySelector('.si-x').focus();
  }
  function close() { if (!bd) return; bd.classList.remove('si-open'); if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } } }

  function marker(list, hl, label) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'si-mk';
    b.setAttribute('aria-label', label || 'مصدر القيمة');
    var s = document.createElement('span'); s.textContent = hl >= 0 && hl != null ? String(hl + 1) : 'i'; b.appendChild(s);
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(list, hl >= 0 ? hl : -1, hl >= 0 ? 'مصدر الجدول' : 'مصادر الحساب ده', hl >= 0 ? '' : 'دي كل المصادر اللي استخدمها الحساب. ربط كل رقم بمصدر بعينه مش مسجل في البيانات.'); });
    return b;
  }

  g.SourceInfo = { describe: describe, text: text, open: open, close: close, marker: marker, NR: NR, NA: NA };
})(window);
