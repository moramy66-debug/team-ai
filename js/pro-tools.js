(function () {
  'use strict';

  var LH_KEY = 'teamai.letterhead';
  var BACKUP_KEYS = ['teamai.rules', 'teamai.memory', 'mem', 'teamai.codes', 'teamai.hist', LH_KEY, 'teamai.projects', 'teamai.project', 'teamai.sig', 'teamai.email', 'teamai.mailAuto'];
  var PLAIN_KEYS = ['teamai.rules', 'teamai.memory', 'mem', 'teamai.projects', 'teamai.project', 'teamai.sig', 'teamai.email', 'teamai.mailAuto'];
  var STRING_KEYS = ['teamai.rules', 'teamai.memory', 'mem', 'teamai.sig', 'teamai.email'];
  var MAX_BACKUP_BYTES = 25 * 1024 * 1024;
  function isQuota(e) { return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeParse(str, fallback) {
    if (str == null || str === '') return fallback;
    try { return JSON.parse(str); } catch (_) { return str; }
  }

  function getLetterhead() {
    var raw = localStorage.getItem(LH_KEY);
    var obj = safeParse(raw, null);
    if (!obj || typeof obj !== 'object') return { name: '', desc: '', logo: '' };
    return {
      name: typeof obj.name === 'string' ? obj.name : '',
      desc: typeof obj.desc === 'string' ? obj.desc : '',
      logo: typeof obj.logo === 'string' && /^data:image\//i.test(obj.logo) ? obj.logo : ''
    };
  }

  function saveLetterhead(lh) {
    localStorage.setItem(LH_KEY, JSON.stringify({
      name: String(lh.name || '').trim(),
      desc: String(lh.desc || '').trim(),
      logo: typeof lh.logo === 'string' && /^data:image\//i.test(lh.logo) ? lh.logo : ''
    }));
  }

  function wrapReportHTML() {
    if (typeof window.reportHTML !== 'function' || window.reportHTML.__ptWrapped) return;
    var origReportHTML = window.reportHTML;
    var wrapped = function (full) {
      var html = origReportHTML.apply(this, arguments);
      if (typeof html !== 'string' || !html) return html;
      var lh = getLetterhead();
      if (!lh.name && !lh.desc && !lh.logo) return html;

      var logoHtml = lh.logo
        ? '<td style="width:76px;vertical-align:middle;padding-left:14px">' +
          '<img src="' + esc(lh.logo) + '" alt="Logo" style="max-width:72px;max-height:72px;object-fit:contain;border-radius:6px;display:block"></td>'
        : '';
      var textHtml = '<td style="vertical-align:middle;text-align:right;font-family:Tahoma,Arial,sans-serif">' +
        (lh.name ? '<div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:4px">' + esc(lh.name) + '</div>' : '') +
        (lh.desc ? '<div style="font-size:13px;color:#475569;line-height:1.5">' + esc(lh.desc) + '</div>' : '') +
        '</td>';

      var banner = '<table role="presentation" width="720" cellpadding="0" cellspacing="0" align="center" ' +
        'style="width:100%;max-width:720px;margin:0 auto 12px auto;background:#ffffff;border:1px solid #e2e8f0;border-bottom:3px solid #0ea5e9;border-radius:8px;direction:rtl">' +
        '<tr><td style="padding:14px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        logoHtml + textHtml +
        '</tr></table></td></tr></table>';

      if (/<body[^>]*>/i.test(html)) {
        return html.replace(/(<body[^>]*>)/i, '$1' + banner);
      }
      if (/<div[^>]*dir=["']rtl["'][^>]*>/i.test(html)) {
        return html.replace(/(<div[^>]*dir=["']rtl["'][^>]*>)/i, '$1' + banner);
      }
      return banner + html;
    };
    wrapped.__ptWrapped = true;
    window.reportHTML = wrapped;
  }

  function injectStyles() {
    if (document.getElementById('proToolsStyle')) return;
    var st = document.createElement('style');
    st.id = 'proToolsStyle';
    st.textContent = [
      '.pt-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.65);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;direction:rtl}',
      '.pt-backdrop.open{display:flex}',
      '.pt-modal{width:100%;max-width:640px;max-height:90vh;overflow:auto;background:#0f172a;color:#f1f5f9;border:1px solid #334155;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.45);font-family:inherit}',
      '.pt-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #1e293b}',
      '.pt-head h3{margin:0;font-size:16px;font-weight:700}',
      '.pt-close{background:transparent;border:1px solid #334155;color:#cbd5e1;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:14px}',
      '.pt-tabs{display:flex;gap:6px;padding:10px 18px;border-bottom:1px solid #1e293b;flex-wrap:wrap}',
      '.pt-tab{background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}',
      '.pt-tab.active{background:#0284c7;color:#fff;border-color:#0284c7}',
      '.pt-body{padding:16px 18px}',
      '.pt-panel{display:none}.pt-panel.active{display:block}',
      '.pt-card{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px 14px;margin-bottom:12px}',
      '.pt-card h4{margin:0 0 10px 0;font-size:14px;color:#38bdf8}',
      '.pt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}',
      '.pt-field label{display:block;font-size:12px;color:#94a3b8;margin-bottom:4px}',
      '.pt-field input,.pt-field select,.pt-field textarea{width:100%;box-sizing:border-box;background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:8px;padding:7px 9px;font-size:13px}',
      '.pt-res{margin-top:10px;padding:9px 12px;background:#0f172a;border:1px dashed #38bdf8;border-radius:8px;font-size:13px;line-height:1.6}',
      '.pt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}',
      '.pt-btn{background:#0284c7;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:600}',
      '.pt-btn.sec{background:#334155;color:#f1f5f9}',
      '.pt-btn.ok{background:#059669}',
      '.pt-msg{margin-top:8px;font-size:12px;color:#34d399;min-height:18px}',
      '.pt-logo-prev{max-width:96px;max-height:64px;border-radius:6px;border:1px solid #334155;background:#fff;padding:4px;display:none}'
    ].join('');
    document.head.appendChild(st);
  }







  async function exportBackup() {
    var msg = document.getElementById('ptBkMsg');
    try {
      var data = {};
      data['teamai.rules'] = safeParse(localStorage.getItem('teamai.rules'), null);
      data['mem'] = safeParse(localStorage.getItem('mem'), null);
      data[LH_KEY] = getLetterhead();
      PLAIN_KEYS.forEach(function (k) {
        if (k === 'mem') return;
        var v = safeParse(localStorage.getItem(k), null);
        if (v != null) data[k] = v;
      });

      if (window.TeamAIStorage && typeof window.TeamAIStorage.getCodes === 'function') {
        data['teamai.codes'] = await window.TeamAIStorage.getCodes();
      } else {
        data['teamai.codes'] = safeParse(localStorage.getItem('teamai.codes'), []);
      }

      if (window.TeamAIStorage && typeof window.TeamAIStorage.getHistory === 'function') {
        data['teamai.hist'] = await window.TeamAIStorage.getHistory();
      } else {
        data['teamai.hist'] = safeParse(localStorage.getItem('teamai.hist'), []);
      }

      Object.keys(data).forEach(function (k) {
        if (/^k_/i.test(k)) delete data[k];
      });

      var payload = { version: 1, exportedAt: new Date().toISOString(), data: data };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'teamai-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      if (msg) msg.textContent = 'تم تصدير النسخة الاحتياطية (teamai-backup.json) بنجاح.';
    } catch (err) {
      if (msg) msg.textContent = 'تعذر التصدير: ' + (err && err.message ? err.message : err);
    }
  }

  async function importBackup(file) {
    var msg = document.getElementById('ptBkMsg');
    if (!file) return;
    function say(t, bad) { if (msg) { msg.textContent = t; msg.style.color = bad ? '#f87171' : ''; } }
    var snapshot = {};
    var touched = [];
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('الملف كبير جدا (أكتر من 25 ميجا). ده مش ملف نسخة احتياطية من Ramz.');
      var text = await file.text();
      var parsed;
      try { parsed = JSON.parse(text); } catch (_) { throw new Error('الملف مش JSON صالح. اختار ملف teamai-backup.json اللي اتصدّر من التطبيق.'); }
      var src = (parsed && parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
      if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('صيغة النسخة الاحتياطية غير صالحة');
      var known = BACKUP_KEYS.filter(function (k) { return k in src && src[k] != null; });
      if (!known.length) throw new Error('الملف مفيهوش أي بيانات يعرفها التطبيق. تأكد إنه نسخة Ramz الاحتياطية.');

      BACKUP_KEYS.forEach(function (k) { try { snapshot[k] = localStorage.getItem(k); } catch (_) { snapshot[k] = null; } });
      var skipped = [];

      for (var idx = 0; idx < known.length; idx++) {
        var key = known[idx];
        if (/^k_/i.test(key)) continue;
        var val = src[key];

        if (key === 'teamai.codes' || key === 'teamai.hist') {
          if (!Array.isArray(val)) { skipped.push(key); continue; }
          if (key === 'teamai.codes' && window.TeamAIStorage && typeof window.TeamAIStorage.saveCodes === 'function') await window.TeamAIStorage.saveCodes(val);
          if (key === 'teamai.hist' && window.TeamAIStorage && typeof window.TeamAIStorage.saveHistory === 'function') await window.TeamAIStorage.saveHistory(val);
          touched.push(key);
          localStorage.setItem(key, JSON.stringify(val));
        } else if (key === LH_KEY) {
          if (typeof val !== 'object' || Array.isArray(val)) { skipped.push(key); continue; }
          touched.push(key);
          saveLetterhead(val);
        } else {
          if (STRING_KEYS.indexOf(key) >= 0 && typeof val !== 'string') { skipped.push(key); continue; }
          touched.push(key);
          localStorage.setItem(key, JSON.stringify(val));
        }
      }
      syncLetterheadForm();
      say('تمت استعادة النسخة الاحتياطية (' + (touched.length) + ' عنصر).' + (skipped.length ? ' اتجاهل ' + skipped.length + ' عنصر شكله غير صالح.' : '') + ' يُنصح بتحديث الصفحة لتطبيق كافة التغييرات.', false);
    } catch (err) {
      var rolled = false;
      if (touched.length) {
        touched.forEach(function (k) {
          try { if (snapshot[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, snapshot[k]); } catch (_) { }
        });
        rolled = true;
      }
      var m = isQuota(err) ? 'مساحة التخزين في المتصفح ممتلئة. امسح السجل القديم أو ملفات كبيرة وجرب تاني.' : (err && err.message ? err.message : String(err));
      say('فشل الاستيراد: ' + m + (rolled ? ' (رجّعت البيانات الحالية زي ما كانت)' : ''), true);
    }
  }

  function syncLetterheadForm() {
    var lh = getLetterhead();
    var n = document.getElementById('ptLhName');
    var d = document.getElementById('ptLhDesc');
    var prev = document.getElementById('ptLhPrev');
    if (n) n.value = lh.name;
    if (d) d.value = lh.desc;
    if (prev) {
      if (lh.logo) {
        prev.src = lh.logo;
        prev.style.display = 'block';
      } else {
        prev.removeAttribute('src');
        prev.style.display = 'none';
      }
    }
  }

  function buildModal() {
    if (document.getElementById('ptModalBackdrop')) return;
    var bd = document.createElement('div');
    bd.id = 'ptModalBackdrop';
    bd.className = 'pt-backdrop';
    bd.innerHTML = [
      '<div class="pt-modal" role="dialog" aria-modal="true" aria-label="أدوات هندسية واحترافية">',
      '  <div class="pt-head">',
      '    <h3>الأدوات الهندسية والنسخ الاحتياطي</h3>',
      '    <button type="button" class="pt-close" id="ptCloseBtn">إغلاق</button>',
      '  </div>',
      '  <div class="pt-tabs">',
      '    <button type="button" class=pt-tab active" data-pt-tab="backup">النسخ الاحتياطي</button>',
      '    <button type="button" class="pt-tab" data-pt-tab="lh">ترويسة المكتب</button>',
      '  </div>',
      '  <div class="pt-body">',
      '    <div class="pt-panel active" data-pt-panel="backup">',
      '      <div class="pt-card">',
      '        <h4>تصدير واستيراد البيانات (بدون مفاتيح API)</h4>',
      '        <p style="font-size:12px;color:#94a3b8;margin:0 0 10px 0">يشمل: القواعد، الذاكرة، الأكواد، السجل، وترويسة المكتب (يستثني مفاتيح k_*).</p>',
      '        <div class="pt-row">',
      '          <button type="button" class="pt-btn" id="ptExportBtn">تصدير نسخة احتياطية (JSON)</button>',
      '          <label class="pt-btn sec" style="display:inline-block">استيراد نسخة احتياطية<input id="ptImportInput" type="file" accept=".json,application/json" style="display:none"></label>',
      '        </div>',
      '        <div class="pt-msg" id="ptBkMsg"></div>',
      '      </div>',
      '    </div>',
      '    <div class="pt-panel" data-pt-panel="lh">',
      '      <div class="pt-card">',
      '        <h4>ترويسة وشعار المكتب لتقارير Word و PDF</h4>',
      '        <div class="pt-field" style="margin-bottom:10px"><label>اسم المكتب الهندسي</label><input id="ptLhName" type="text" placeholder="مثال: مكتب الراشد للاستشارات الهندسية"></div>',
      '        <div class="pt-field" style="margin-bottom:10px"><label>الوصف / بيانات التواصل</label><textarea id="ptLhDesc" rows="2" placeholder="الرياض - هاتف: ... - البريد: ..."></textarea></div>',
      '        <div class="pt-row">',
      '          <label class="pt-btn sec" style="display:inline-block">رفع شعار المكتب<input id="ptLhLogoInput" type="file" accept="image/*" style="display:none"></label>',
      '          <button type="button" class="pt-btn sec" id="ptLhClearLogo">حذف الشعار</button>',
      '          <img id="ptLhPrev" class="pt-logo-prev" alt="شعار المكتب">',
      '        </div>',
      '        <div class="pt-row">',
      '          <button type="button" class="pt-btn ok" id="ptLhSaveBtn">حفظ الترويسة</button>',
      '        </div>',
      '        <div class="pt-msg" id="ptLhMsg"></div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(bd);

    var pendingLogo = getLetterhead().logo;

    function switchTab(tabName) {
      bd.querySelectorAll('.pt-tab').forEach(function (t) {
        t.classList.toggle('active', t.getAttribute('data-pt-tab') === tabName);
      });
      bd.querySelectorAll('.pt-panel').forEach(function (p) {
        p.classList.toggle('active', p.getAttribute('data-pt-panel') === tabName);
      });
    }

    bd.__openTab = function (tabName) {
      switchTab(tabName || 'backup');
      syncLetterheadForm();
      pendingLogo = getLetterhead().logo;

      bd.classList.add('open');
    };

    bd.querySelectorAll('.pt-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-pt-tab'));
      });
    });

    document.getElementById('ptCloseBtn').addEventListener('click', function () {
      bd.classList.remove('open');
    });
    bd.addEventListener('click', function (e) {
      if (e.target === bd) bd.classList.remove('open');
    });



    document.getElementById('ptExportBtn').addEventListener('click', exportBackup);
    document.getElementById('ptImportInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importBackup(f);
      e.target.value = '';
    });

    document.getElementById('ptLhLogoInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 1024 * 1024 || !/^image\//i.test(f.type || '')) {
        var lm = document.getElementById('ptLhMsg') || document.getElementById('ptBkMsg');
        if (lm) { lm.textContent = 'الشعار لازم يكون صورة أقل من 1 ميجا.'; lm.style.color = '#f87171'; }
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        var lm = document.getElementById('ptLhMsg') || document.getElementById('ptBkMsg');
        if (lm) { lm.textContent = 'مقدرتش أقرا الصورة.'; lm.style.color = '#f87171'; }
      };
      reader.onload = function () {
        pendingLogo = typeof reader.result === 'string' ? reader.result : '';
        var prev = document.getElementById('ptLhPrev');
        if (prev && pendingLogo) {
          prev.src = pendingLogo;
          prev.style.display = 'block';
        }
      };
      reader.readAsDataURL(f);
    });

    document.getElementById('ptLhClearLogo').addEventListener('click', function () {
      pendingLogo = '';
      var prev = document.getElementById('ptLhPrev');
      if (prev) {
        prev.removeAttribute('src');
        prev.style.display = 'none';
      }
    });

    document.getElementById('ptLhSaveBtn').addEventListener('click', function () {
      var m = document.getElementById('ptLhMsg');
      try {
        saveLetterhead({
          name: document.getElementById('ptLhName').value,
          desc: document.getElementById('ptLhDesc').value,
          logo: pendingLogo
        });
        if (m) { m.textContent = 'تم حفظ ترويسة وشعار المكتب.'; m.style.color = ''; }
      } catch (err) {
        if (m) { m.textContent = isQuota(err) ? 'مساحة التخزين ممتلئة، الترويسة ما اتحفظتش. جرب شعار أصغر أو امسح السجل القديم.' : 'تعذر الحفظ: ' + (err && err.message ? err.message : err); m.style.color = '#f87171'; }
      }
    });


    syncLetterheadForm();
  }

  function addTopbarButtons() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;
 
    if (!document.getElementById('backupBtn')) {
      var bkBtn = document.createElement('button');
      bkBtn.id = 'backupBtn';
      bkBtn.type = 'button';
      bkBtn.className = 'sec';
      bkBtn.title = 'النسخ الاحتياطي وترويسة المكتب';
      bkBtn.textContent = 'نسخ احتياطي';
      bkBtn.addEventListener('click', function () {
        buildModal();
        document.getElementById('ptModalBackdrop').__openTab('backup');
      });
      topbar.appendChild(bkBtn);
    }
  }
  function openHelpModal() {
var id = 'ptHelpBackdrop';
var el = document.getElementById(id);
if (!el) {
el = document.createElement('div');
el.id = id;
el.className = 'pt-backdrop';
el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;';
el.innerHTML = '<div class="pt-modal" role="dialog" aria-modal="true" aria-labelledby="ptHelpTitle" style="max-width:520px;width:100%;direction:rtl;">' +
'<div class="pt-head"><h3 id="ptHelpTitle">الدليل السريع للاستخدام</h3>' +
'<button type="button" class="pt-close" id="ptHelpClose" aria-label="إغلاق">×</button></div>' +
'<div class="pt-body">' +
'<ol class="pt-help-list" style="margin:0;padding-inline-start:20px;line-height:1.85;">' +
'<li><strong>إضافة مفتاح API:</strong> افتح الإعدادات وأدخل مفتاح Gemini API لتفعيل التحليل والبث المباشر.</li>' +
'<li><strong>رفع الأكواد الهندسية:</strong> من مكتبة الأكواد اختر الكود المعتمد أو ارفع ملفاتك الهندسية المرجعية.</li>' +
'<li><strong>Eng Calc:</strong> افتح حاسبة الهندسة (Eng Calc) من شريط الأدوات للحسابات الكهربائية وتصدير PDF.</li>' +
'<li><strong>النسخ الاحتياطي:</strong> صدّر واستورد القواعد والأكواد والسجل والترويسة كملف JSON للحفظ والاستعادة.</li>' +
'</ol>' +
'<p style="margin:12px 0 0"><a href="./guide.html" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;min-height:44px;color:#8fb0f0">الدليل الكامل بالعربي</a></p>' +
'</div></div>';
document.body.appendChild(el);
el.addEventListener('click', function (e) { if (e.target === el) { el.classList.remove('open'); el.style.display = 'none'; } });
document.getElementById('ptHelpClose').addEventListener('click', function () { el.classList.remove('open'); el.style.display = 'none'; });
}
el.classList.add('open');
el.style.display = 'flex';
}
function initHelpGuide() {
var topbar = document.querySelector('.topbar');
if (topbar && !document.getElementById('helpBtn')) {
var hBtn = document.createElement('button');
hBtn.id = 'helpBtn';
hBtn.type = 'button';
hBtn.className = 'sec';
hBtn.title = 'الدليل السريع';
hBtn.setAttribute('aria-label', 'الدليل السريع');
hBtn.textContent = '?';
hBtn.addEventListener('click', openHelpModal);
topbar.appendChild(hBtn);
}
}
  
  function init() {
    injectStyles();
    addTopbarButtons();
initHelpGuide();
    buildModal();
    wrapReportHTML();
    setTimeout(wrapReportHTML, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
