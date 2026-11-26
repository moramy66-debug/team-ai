(function () {
  'use strict';

  var LH_KEY = 'teamai.letterhead';
  var BACKUP_KEYS = ['teamai.rules', 'mem', 'teamai.codes', 'teamai.hist', LH_KEY];

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

  function calcCurrent() {
    var ph = document.getElementById('ptCurPh').value;
    var kw = parseFloat(document.getElementById('ptCurKw').value);
    var v = parseFloat(document.getElementById('ptCurV').value);
    var pf = parseFloat(document.getElementById('ptCurPf').value);
    var out = document.getElementById('ptCurRes');
    if (!(kw > 0) || !(v > 0) || !(pf > 0 && pf <= 1)) {
      out.textContent = 'أدخل قيماً صحيحة (kW > 0، V > 0، 0 < PF <= 1).';
      return null;
    }
    var factor = ph === '3' ? Math.sqrt(3) : 1;
    var amps = (kw * 1000) / (factor * v * pf);
    var kva = kw / pf;
    out.innerHTML = 'التيار المحسوب: <strong>' + amps.toFixed(2) + ' A</strong> | القدرة الظاهرية: <strong>' + kva.toFixed(2) + ' kVA</strong>';
    return { ph: ph, kw: kw, v: v, pf: pf, amps: amps, kva: kva };
  }

  function calcVdrop() {
    var ph = document.getElementById('ptVdPh').value;
    var i = parseFloat(document.getElementById('ptVdI').value);
    var l = parseFloat(document.getElementById('ptVdL').value);
    var a = parseFloat(document.getElementById('ptVdA').value);
    var v = parseFloat(document.getElementById('ptVdV').value);
    var rho = parseFloat(document.getElementById('ptVdMat').value);
    var out = document.getElementById('ptVdRes');
    if (!(i > 0) || !(l > 0) || !(a > 0) || !(v > 0)) {
      out.textContent = 'أدخل قيماً صحيحة للتيار والطول والمقطع والجهد.';
      return null;
    }
    var k = ph === '3' ? Math.sqrt(3) : 2;
    var dv = (k * i * l * rho) / a;
    var pct = (dv / v) * 100;
    out.innerHTML = 'هبوط الجهد: <strong>' + dv.toFixed(2) + ' V</strong> | النسبة: <strong>' + pct.toFixed(2) + '%</strong>';
    return { ph: ph, i: i, l: l, a: a, v: v, dv: dv, pct: pct };
  }

  function insertIntoTask() {
    var task = document.getElementById('task');
    var msg = document.getElementById('ptCalcMsg');
    if (!task) {
      if (msg) msg.textContent = 'لم يتم العثور على حقل المهمة (#task).';
      return;
    }
    var c = calcCurrent();
    var vd = calcVdrop();
    var lines = [];
    if (c) {
      lines.push('حساب تيار الحمل (' + (c.ph === '3' ? '3-Phase' : '1-Phase') + '): ' +
        c.kw + ' kW، ' + c.v + ' V، PF=' + c.pf + ' => I = ' + c.amps.toFixed(2) + ' A (' + c.kva.toFixed(2) + ' kVA)');
    }
    if (vd) {
      lines.push('حساب هبوط الجهد (' + (vd.ph === '3' ? '3-Phase' : '1-Phase') + '): I=' +
        vd.i + ' A، L=' + vd.l + ' m، S=' + vd.a + ' mm²، V=' + vd.v + ' V => ΔV = ' +
        vd.dv.toFixed(2) + ' V (' + vd.pct.toFixed(2) + '%)');
    }
    if (!lines.length) {
      if (msg) msg.textContent = 'احسب قيمة واحدة على الأقل قبل الإدراج.';
      return;
    }
    var snippet = lines.join('\n');
    task.value = task.value.trim() ? (task.value.trim() + '\n\n' + snippet) : snippet;
    task.dispatchEvent(new Event('input', { bubbles: true }));
    task.dispatchEvent(new Event('change', { bubbles: true }));
    try { localStorage.setItem('teamai.draft', task.value); } catch (_) {}
    if (msg) msg.textContent = 'تم إدراج النتيجة في المهمة وتحديث المسودة.';
  }

  async function exportBackup() {
    var msg = document.getElementById('ptBkMsg');
    try {
      var data = {};
      data['teamai.rules'] = safeParse(localStorage.getItem('teamai.rules'), null);
      data['mem'] = safeParse(localStorage.getItem('mem'), null);
      data[LH_KEY] = getLetterhead();

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
    try {
      var text = await file.text();
      var parsed = JSON.parse(text);
      var src = (parsed && parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
      if (!src || typeof src !== 'object') throw new Error('صيغة JSON غير صالحة');

      for (var idx = 0; idx < BACKUP_KEYS.length; idx++) {
        var key = BACKUP_KEYS[idx];
        if (/^k_/i.test(key) || !(key in src) || src[key] == null) continue;
        var val = src[key];

        if (key === 'teamai.codes') {
          if (window.TeamAIStorage && typeof window.TeamAIStorage.saveCodes === 'function' && Array.isArray(val)) {
            await window.TeamAIStorage.saveCodes(val);
          }
          localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        } else if (key === 'teamai.hist') {
          if (window.TeamAIStorage && typeof window.TeamAIStorage.saveHistory === 'function' && Array.isArray(val)) {
            await window.TeamAIStorage.saveHistory(val);
          }
          localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        } else if (key === LH_KEY) {
          saveLetterhead(typeof val === 'object' ? val : {});
        } else {
          localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        }
      }
      syncLetterheadForm();
      if (msg) msg.textContent = 'تمت استعادة النسخة الاحتياطية بأمان. يُنصح بتحديث الصفحة لتطبيق كافة التغييرات.';
    } catch (err) {
      if (msg) msg.textContent = 'فشل الاستيراد: ' + (err && err.message ? err.message : err);
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
      '    <button type="button" class="pt-tab active" data-pt-tab="calc">حاسبات هندسية</button>',
      '    <button type="button" class="pt-tab" data-pt-tab="backup">النسخ الاحتياطي</button>',
      '    <button type="button" class="pt-tab" data-pt-tab="lh">ترويسة المكتب</button>',
      '  </div>',
      '  <div class="pt-body">',
      '    <div class="pt-panel active" data-pt-panel="calc">',
      '      <div class="pt-card">',
      '        <h4>1) حساب تيار الحمل (Load Current)</h4>',
      '        <div class="pt-grid">',
      '          <div class="pt-field"><label>الطور (Phase)</label><select id="ptCurPh"><option value="3">3-Phase</option><option value="1">1-Phase</option></select></div>',
      '          <div class="pt-field"><label>القدرة (kW)</label><input id="ptCurKw" type="number" step="any" value="15"></div>',
      '          <div class="pt-field"><label>الجهد (V)</label><input id="ptCurV" type="number" step="any" value="380"></div>',
      '          <div class="pt-field"><label>معامل القدرة (PF)</label><input id="ptCurPf" type="number" step="0.01" min="0.1" max="1" value="0.85"></div>',
      '        </div>',
      '        <div class="pt-res" id="ptCurRes"></div>',
      '      </div>',
      '      <div class="pt-card">',
      '        <h4>2) نسبة هبوط الجهد (Voltage Drop %)</h4>',
      '        <div class="pt-grid">',
      '          <div class="pt-field"><label>الطور</label><select id="ptVdPh"><option value="3">3-Phase</option><option value="1">1-Phase</option></select></div>',
      '          <div class="pt-field"><label>التيار (A)</label><input id="ptVdI" type="number" step="any" value="26.8"></div>',
      '          <div class="pt-field"><label>الطول (m)</label><input id="ptVdL" type="number" step="any" value="45"></div>',
      '          <div class="pt-field"><label>المقطع (mm²)</label><input id="ptVdA" type="number" step="any" value="10"></div>',
      '          <div class="pt-field"><label>الجهد (V)</label><input id="ptVdV" type="number" step="any" value="380"></div>',
      '          <div class="pt-field"><label>الموصل</label><select id="ptVdMat"><option value="0.0175">نحاس (Cu)</option><option value="0.0282">ألمنيوم (Al)</option></select></div>',
      '        </div>',
      '        <div class="pt-res" id="ptVdRes"></div>',
      '      </div>',
      '      <div class="pt-row">',
      '        <button type="button" class="pt-btn ok" id="ptInsertTaskBtn">إدراج النتيجة في المهمة</button>',
      '      </div>',
      '      <div class="pt-msg" id="ptCalcMsg"></div>',
      '    </div>',
      '    <div class="pt-panel" data-pt-panel="backup">',
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
      switchTab(tabName || 'calc');
      syncLetterheadForm();
      pendingLogo = getLetterhead().logo;
      calcCurrent();
      calcVdrop();
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

    ['ptCurPh', 'ptCurKw', 'ptCurV', 'ptCurPf'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', calcCurrent);
      document.getElementById(id).addEventListener('change', calcCurrent);
    });
    ['ptVdPh', 'ptVdI', 'ptVdL', 'ptVdA', 'ptVdV', 'ptVdMat'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', calcVdrop);
      document.getElementById(id).addEventListener('change', calcVdrop);
    });

    document.getElementById('ptInsertTaskBtn').addEventListener('click', insertIntoTask);
    document.getElementById('ptExportBtn').addEventListener('click', exportBackup);
    document.getElementById('ptImportInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importBackup(f);
      e.target.value = '';
    });

    document.getElementById('ptLhLogoInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
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
      saveLetterhead({
        name: document.getElementById('ptLhName').value,
        desc: document.getElementById('ptLhDesc').value,
        logo: pendingLogo
      });
      var m = document.getElementById('ptLhMsg');
      if (m) m.textContent = 'تم حفظ ترويسة وشعار المكتب.';
    });

    calcCurrent();
    calcVdrop();
    syncLetterheadForm();
  }

  function addTopbarButtons() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;
    if (!document.getElementById('calcBtn')) {
      var calcBtn = document.createElement('button');
      calcBtn.id = 'calcBtn';
      calcBtn.type = 'button';
      calcBtn.className = 'sec';
      calcBtn.title = 'حاسبات هندسية فورية';
      calcBtn.textContent = 'حاسبات';
      calcBtn.addEventListener('click', function () {
        buildModal();
        document.getElementById('ptModalBackdrop').__openTab('calc');
      });
      topbar.appendChild(calcBtn);
    }
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

  function init() {
    injectStyles();
    addTopbarButtons();
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
