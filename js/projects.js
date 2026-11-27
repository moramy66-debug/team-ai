/* Projects (phase 1): group chats under a project, keep short pinned notes per project,
   and add those notes to the instructions of chats in that project.
   Chats stay in teamai.hist untouched. A separate map says which project a chat belongs to,
   so chats with no entry are simply "No project" and nothing needs migrating. */
(function (g) {
  'use strict';
  var KEY = 'teamai.projects';
  var MAX_NOTES_CHARS = 1200;   /* about 300-400 tokens: keeps the free-tier cost small */
  var MAX_NOTE_CHARS = 500;
  var MAX_PROJECTS = 30;

  var state = { projects: [], chatMap: {}, active: null };
  var store = null;             /* { get(): string|null, set(str) } */

  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function normalize(raw) {
    var o = { projects: [], chatMap: {}, active: null };
    if (!raw || typeof raw !== 'object') return o;
    (Array.isArray(raw.projects) ? raw.projects : []).forEach(function (p) {
      if (!p || !p.id || !clean(p.name)) return;
      o.projects.push({
        id: String(p.id), name: clean(p.name).slice(0, 60), created: p.created || 0,
        notes: (Array.isArray(p.notes) ? p.notes : []).filter(function (n) { return n && clean(n.text); })
          .map(function (n) { return { id: String(n.id || uid()), text: clean(n.text).slice(0, MAX_NOTE_CHARS) }; })
      });
    });
    var ids = {}; o.projects.forEach(function (p) { ids[p.id] = 1; });
    if (raw.chatMap && typeof raw.chatMap === 'object') Object.keys(raw.chatMap).forEach(function (k) { if (ids[raw.chatMap[k]]) o.chatMap[k] = raw.chatMap[k]; });
    if (raw.active && ids[raw.active]) o.active = raw.active;
    return o;
  }

  function save() {
    var s = JSON.stringify(state);
    try { if (store) store.set(s); } catch (e) { }
    try { if (g.TeamAIStorage && g.TeamAIStorage.setItem) g.TeamAIStorage.setItem('meta', 'projects', JSON.parse(s)).catch(function () { }); } catch (e) { }
  }

  function find(id) { for (var i = 0; i < state.projects.length; i++) if (state.projects[i].id === id) return state.projects[i]; return null; }

  function notesSize(p) { return p ? p.notes.reduce(function (n, x) { return n + x.text.length; }, 0) : 0; }

  var core = {
    MAX_NOTES_CHARS: MAX_NOTES_CHARS, MAX_NOTE_CHARS: MAX_NOTE_CHARS,
    init: function (st, initial) { store = st; state = normalize(initial); },
    state: function () { return state; },
    create: function (name) {
      name = clean(name).slice(0, 60);
      if (!name || state.projects.length >= MAX_PROJECTS) return null;
      var p = { id: uid(), name: name, created: Date.now(), notes: [] };
      state.projects.push(p); save(); return p;
    },
    rename: function (id, name) { var p = find(id); name = clean(name).slice(0, 60); if (!p || !name) return false; p.name = name; save(); return true; },
    remove: function (id) {
      var i = state.projects.findIndex ? state.projects.findIndex(function (p) { return p.id === id; }) : -1;
      if (i < 0) return false;
      state.projects.splice(i, 1);
      Object.keys(state.chatMap).forEach(function (k) { if (state.chatMap[k] === id) delete state.chatMap[k]; });
      if (state.active === id) state.active = null;
      save(); return true;
    },
    addNote: function (id, text) {
      var p = find(id); text = clean(text).slice(0, MAX_NOTE_CHARS);
      if (!p || !text) return { ok: false, reason: 'empty' };
      if (notesSize(p) + text.length > MAX_NOTES_CHARS) return { ok: false, reason: 'too_big' };
      p.notes.push({ id: uid(), text: text }); save(); return { ok: true };
    },
    delNote: function (id, noteId) { var p = find(id); if (!p) return false; p.notes = p.notes.filter(function (n) { return n.id !== noteId; }); save(); return true; },
    assign: function (chatId, projectId) {
      if (!chatId) return false;
      if (!projectId) delete state.chatMap[chatId]; else if (find(projectId)) state.chatMap[chatId] = projectId; else return false;
      save(); return true;
    },
    setActive: function (id) { state.active = (id && find(id)) ? id : null; save(); },
    projectOf: function (chatId) { return state.chatMap[chatId] || null; },
    size: notesSize,
    /* the text added to the system instructions; empty string when the project has no notes */
    context: function (projectId) {
      var p = find(projectId);
      if (!p || !p.notes.length) return '';
      return 'Project: ' + p.name + '\nPinned notes for this project (written by the user, treat as given facts):\n' +
        p.notes.map(function (n, i) { return (i + 1) + '. ' + n.text; }).join('\n');
    },
    get: find
  };
  g.Projects = { core: core };

  if (typeof document === 'undefined' || !document.getElementById || !document.addEventListener) return;

  /* ---------- storage + hooks (browser only) ---------- */
  var ls = { get: function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } }, set: function (s) { try { localStorage.setItem(KEY, s); } catch (e) { } } };
  var initial = null; try { initial = JSON.parse(ls.get() || 'null'); } catch (e) { }
  core.init(ls, initial);
  if (!initial && g.TeamAIStorage && g.TeamAIStorage.getItem) {
    g.TeamAIStorage.getItem('meta', 'projects', null).then(function (v) { if (v && !core.state().projects.length) { core.init(ls, v); refresh(); } }).catch(function () { });
  }

  function savedChat(id) { try { var h = LS.get('teamai.hist', []); return h.some(function (x) { return x.id === id; }); } catch (e) { return false; } }
  function currentProject() {
    try {
      if (typeof current !== 'undefined' && current && savedChat(current.id)) return core.projectOf(current.id);
    } catch (e) { }
    return core.state().active;
  }

  function hook() {
    if (typeof g.sys === 'function' && !g.sys.__prj) {
      var o = g.sys;
      g.sys = function (a) {
        var s = o.apply(this, arguments);
        var pid = currentProject(), c = pid ? core.context(pid) : '';
        return c ? s + '\n' + c : s;
      };
      g.sys.__prj = 1;
    }
    if (typeof g.saveCurrent === 'function' && !g.saveCurrent.__prj) {
      var s0 = g.saveCurrent;
      g.saveCurrent = function () {
        var pid = null;
        try { if (current && !savedChat(current.id)) pid = core.state().active; } catch (e) { }
        var r = s0.apply(this, arguments);
        try { if (pid && current && !core.projectOf(current.id)) core.assign(current.id, pid); } catch (e) { }
        filterHist(); refresh(true);
        return r;
      };
      g.saveCurrent.__prj = 1;
    }
    if (typeof g.renderHist === 'function' && !g.renderHist.__prj) {
      var r0 = g.renderHist;
      g.renderHist = function () { var r = r0.apply(this, arguments); filterHist(); return r; };
      g.renderHist.__prj = 1;
    }
  }

  var FILTER_ALL = '__all__';
  var filterVal = FILTER_ALL;
  function filterHist() {
    try {
      var h = LS.get('teamai.hist', []), box = document.getElementById('hist');
      if (!box) return;
      for (var i = 0; i < box.children.length && i < h.length; i++) {
        var pid = core.projectOf(h[i].id);
        var show = filterVal === FILTER_ALL || (filterVal === '' ? !pid : pid === filterVal);
        box.children[i].style.display = show ? '' : 'none';
      }
    } catch (e) { }
  }

  /* ---------- UI ---------- */
  var CSS = '.prj-bar{display:flex;gap:8px;align-items:center;margin:0 0 10px}' +
    '.prj-bar select{flex:1;min-width:0;min-height:44px;font-size:16px}' +
    '.prj-bar button{min-height:44px;white-space:nowrap}' +
    '.prj-bd{position:fixed;inset:0;z-index:10000;background:rgba(5,8,15,.6);display:flex;align-items:flex-end;justify-content:center}' +
    '.prj-sheet{width:100%;max-width:560px;max-height:88vh;overflow:auto;box-sizing:border-box;background:var(--card,#181b22);color:var(--tx,#e8eaf0);border:1px solid var(--line,#2a2f3a);border-radius:16px 16px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));direction:rtl;text-align:right}' +
    '@media(min-width:700px){.prj-bd{align-items:center}.prj-sheet{border-radius:16px}}' +
    '.prj-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}' +
    '.prj-h b{font-size:16px}' +
    '.prj-hint{font-size:13px;color:var(--mut,#8b93a5);margin:4px 0 8px}' +
    '.prj-row{display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap}' +
    '.prj-row input[type=text],.prj-sheet textarea,.prj-sheet select{flex:1;min-width:0;font-size:16px;box-sizing:border-box}' +
    '.prj-sheet textarea{width:100%;min-height:72px}' +
    '.prj-sheet button{min-height:44px}' +
    '.prj-item{border:1px solid var(--line,#2a2f3a);border-radius:12px;padding:8px 10px;margin:8px 0}' +
    '.prj-note{display:flex;gap:8px;align-items:flex-start;border-top:1px solid var(--line,#2a2f3a);padding:6px 0;font-size:14px;line-height:1.6}' +
    '.prj-note span{flex:1;min-width:0;overflow-wrap:anywhere;unicode-bidi:plaintext}' +
    '.prj-size{font-size:13px;color:var(--mut,#8b93a5)}.prj-size.prj-over{color:var(--er,#ef5b5b)}' +
    '.prj-warn{font-size:13px;color:var(--mut,#8b93a5);border:1px solid var(--line,#2a2f3a);border-radius:10px;padding:8px 10px;margin:8px 0}';
  var styled = false;
  function style() { if (styled) return; styled = true; var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls, fn) { var b = el('button', cls || 'sec', text); b.type = 'button'; b.addEventListener('click', fn); return b; }

  var sel = null;
  function fillSelect() {
    if (!sel) return;
    var keep = filterVal;
    sel.innerHTML = '';
    function opt(v, t) { var o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
    opt(FILTER_ALL, 'All chats');
    opt('', 'No project');
    core.state().projects.forEach(function (p) { opt(p.id, p.name); });
    var exists = keep === FILTER_ALL || keep === '' || !!core.get(keep);
    filterVal = exists ? keep : FILTER_ALL;
    sel.value = filterVal;
  }
  function refresh(light) { fillSelect(); filterHist(); }

  function mountBar() {
    var card = document.getElementById('histCard');
    if (!card || document.getElementById('prjBar')) return;
    style();
    var bar = el('div', 'prj-bar'); bar.id = 'prjBar';
    sel = el('select'); sel.setAttribute('aria-label', 'Project filter');
    sel.addEventListener('change', function () {
      filterVal = sel.value;
      /* new chats go into the selected project; "All chats" and "No project" mean no project */
      core.setActive(filterVal !== FILTER_ALL && filterVal !== '' ? filterVal : null);
      filterHist();
    });
    var manage = btn('Projects', 'sec', openSheet); manage.id = 'prjManage';
    bar.appendChild(sel); bar.appendChild(manage);
    var first = card.firstElementChild;
    card.insertBefore(bar, first && first.nextSibling ? first.nextSibling : card.firstChild);
    var a = core.state().active; if (a) filterVal = a;
    fillSelect(); filterHist();
  }

  var bd = null, view = null;
  function closeSheet() { if (bd && bd.parentNode) bd.parentNode.removeChild(bd); bd = null; refresh(); }
  function openSheet(editId) {
    style();
    if (!bd) {
      bd = el('div', 'prj-bd');
      var sh = el('div', 'prj-sheet'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
      bd.appendChild(sh); view = sh;
      bd.addEventListener('click', function (e) { if (e.target === bd) closeSheet(); });
      document.body.appendChild(bd);
    }
    typeof editId === 'string' && editId ? renderEdit(editId) : renderList();
  }

  function head(title, onBack) {
    var h = el('div', 'prj-h'); h.appendChild(el('b', null, title));
    var x = btn('\u00d7', 'sec', closeSheet); x.setAttribute('aria-label', 'Close'); x.style.minWidth = '44px';
    if (onBack) h.appendChild(btn('Back', 'sec', onBack));
    h.appendChild(x); return h;
  }

  function renderList() {
    view.innerHTML = '';
    view.appendChild(head('Projects'));
    view.appendChild(el('p', 'prj-hint', 'كل مشروع ليه ملاحظات مثبتة قصيرة. الملاحظات بتتضاف على تعليمات أي شات جديد جوه المشروع ده.'));
    var row = el('div', 'prj-row');
    var inp = el('input'); inp.type = 'text'; inp.placeholder = 'اسم المشروع'; inp.maxLength = 60; inp.setAttribute('aria-label', 'Project name');
    var add = btn('Create', null, function () {
      var p = core.create(inp.value); if (!p) { inp.focus(); return; }
      core.setActive(p.id); filterVal = p.id; renderEdit(p.id);
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add.click(); });
    row.appendChild(inp); row.appendChild(add); view.appendChild(row);

    var ps = core.state().projects;
    if (!ps.length) view.appendChild(el('p', 'prj-hint', 'مفيش مشاريع لسه. الشاتات القديمة كلها تحت "No project".'));
    ps.forEach(function (p) {
      var it = el('div', 'prj-item');
      var r = el('div', 'prj-row');
      var nm = el('b', null, p.name); nm.style.flex = '1'; nm.style.unicodeBidi = 'plaintext';
      r.appendChild(nm);
      r.appendChild(btn('Open', 'sec', function () { renderEdit(p.id); }));
      it.appendChild(r);
      var cnt = 0; try { var h = LS.get('teamai.hist', []); h.forEach(function (x) { if (core.projectOf(x.id) === p.id) cnt++; }); } catch (e) { }
      it.appendChild(el('div', 'prj-size', cnt + ' chats | ' + p.notes.length + ' notes | ' + core.size(p) + ' chars'));
      view.appendChild(it);
    });

    try {
      if (typeof current !== 'undefined' && current && savedChat(current.id)) {
        var r2 = el('div', 'prj-row'); r2.appendChild(el('span', null, 'This chat:'));
        var s2 = el('select'); s2.setAttribute('aria-label', 'Move this chat');
        var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'No project'; s2.appendChild(o0);
        ps.forEach(function (p) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.name; s2.appendChild(o); });
        s2.value = core.projectOf(current.id) || '';
        s2.addEventListener('change', function () { core.assign(current.id, s2.value || null); filterHist(); });
        r2.appendChild(s2); view.appendChild(r2);
      }
    } catch (e) { }
    view.appendChild(privacy());
  }

  function privacy() { return el('div', 'prj-warn', 'خصوصية: ملاحظات المشروع بتتبعت مع التعليمات لمزوّد الـ AI اللي بتختاره (Gemini / Groq / OpenRouter وغيرهم). متكتبش بيانات سرية أو بيانات عميل.'); }

  function renderEdit(id) {
    var p = core.get(id); if (!p) { renderList(); return; }
    view.innerHTML = '';
    view.appendChild(head('Project', renderList));
    var r = el('div', 'prj-row');
    var inp = el('input'); inp.type = 'text'; inp.value = p.name; inp.maxLength = 60; inp.setAttribute('aria-label', 'Project name');
    r.appendChild(inp);
    r.appendChild(btn('Rename', 'sec', function () { if (core.rename(id, inp.value)) renderEdit(id); }));
    view.appendChild(r);

    var size = core.size(p);
    var sz = el('div', 'prj-size' + (size > core.MAX_NOTES_CHARS ? ' prj-over' : ''), 'Notes size: ' + size + ' / ' + core.MAX_NOTES_CHARS + ' characters (added to every new chat in this project)');
    view.appendChild(sz);
    p.notes.forEach(function (n) {
      var row = el('div', 'prj-note'); row.appendChild(el('span', null, n.text));
      var d = btn('Delete', 'sec', function () { core.delNote(id, n.id); renderEdit(id); });
      row.appendChild(d); view.appendChild(row);
    });
    if (!p.notes.length) view.appendChild(el('p', 'prj-hint', 'مفيش ملاحظات لسه. اكتب معلومة قصيرة تحتاجها كل الشاتات (مثلاً: Voltage 400 V, 3 Phase, Ambient 45 C).'));

    var ta = el('textarea'); ta.maxLength = core.MAX_NOTE_CHARS; ta.placeholder = 'ملاحظة جديدة (أقصى ' + core.MAX_NOTE_CHARS + ' حرف)'; ta.setAttribute('aria-label', 'New note');
    view.appendChild(ta);
    var msg = el('div', 'prj-size');
    var r2 = el('div', 'prj-row');
    r2.appendChild(btn('Add note', null, function () {
      var res = core.addNote(id, ta.value);
      if (res.ok) renderEdit(id); else msg.textContent = res.reason === 'too_big' ? 'الملاحظات وصلت الحد (' + core.MAX_NOTES_CHARS + ' حرف). امسح ملاحظة قديمة الأول.' : 'اكتب الملاحظة الأول.';
    }));
    r2.appendChild(btn('Pin current result', 'sec', function () {
      var f = document.getElementById('final'), t = f ? f.textContent.trim() : '';
      if (!t) { msg.textContent = 'مفيش نتيجة حالية تتثبت.'; return; }
      ta.value = t.slice(0, core.MAX_NOTE_CHARS); msg.textContent = 'راجع النص وبعدين اضغط Add note. الحد ' + core.MAX_NOTE_CHARS + ' حرف.';
    }));
    view.appendChild(r2); view.appendChild(msg);

    var act = el('div', 'prj-row');
    act.appendChild(btn('Use for new chats', 'sec', function () { core.setActive(id); filterVal = id; msg.textContent = 'الشاتات الجديدة هتتحفظ في المشروع ده.'; refresh(); }));
    var del = btn('Delete project', 'sec', function () {
      if (del.dataset.arm !== '1') { del.dataset.arm = '1'; del.textContent = 'Tap again to delete (chats are kept)'; return; }
      core.remove(id); if (filterVal === id) filterVal = FILTER_ALL; renderList();
    });
    act.appendChild(del); view.appendChild(act);
    view.appendChild(privacy());
  }

  function boot() { hook(); mountBar(); }
  /* app.js defines sys/saveCurrent/renderHist; wait until it has run */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); }); else setTimeout(boot, 0);
  g.Projects.open = openSheet;
})(typeof window !== 'undefined' ? window : globalThis);
