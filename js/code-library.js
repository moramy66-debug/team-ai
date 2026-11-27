(function () {
  'use strict';

  var DATA_URL = './data/code-library.json';
  var STYLE_ID = 'code-library-styles';
  var MODAL_ID = 'codeLibraryModal';
  var BTN_ID = 'codeRefBtn';

  var itemsCache = null;
  var activeCode = 'all';
  var searchQuery = '';

  function normalizeArabic(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
      .replace(/\u0629/g, '\u0647')
      .replace(/\u0649/g, '\u064A')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function codeLabel(code) {
    if (code === 'sbc401') return 'SBC 401';
    if (code === 'sec_dc') return 'SEC DC';
    if (code === 'sec_dps') return 'SEC DPS';
    return String(code || '').toUpperCase();
  }

  function statusInfo(status) {
    if (status === 'verified_mirror') {
      return { text: 'Verified Mirror', cls: 'cl-badge-verified' };
    }
    if (status === 'verified_secondary') {
      return { text: 'Verified Secondary', cls: 'cl-badge-secondary' };
    }
    return { text: 'Needs Review', cls: 'cl-badge-review' };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.cl-backdrop {',
      '  position: fixed; inset: 0; z-index: 9999;',
      '  background: rgba(15, 23, 42, 0.72);',
      '  display: none; align-items: center; justify-content: center;',
      '  padding: 10px; box-sizing: border-box;',
      '}',
      '.cl-backdrop.cl-open { display: flex; }',
      '.cl-modal {',
      '  width: min(720px, calc(100vw - 20px));',
      '  max-height: 88vh;',
      '  background: var(--bg-card, #1e293b);',
      '  color: var(--text-primary, #f8fafc);',
      '  border: 1px solid var(--border-color, rgba(148, 163, 184, 0.28));',
      '  border-radius: 14px;',
      '  display: flex; flex-direction: column;',
      '  overflow: hidden; box-sizing: border-box;',
      '  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);',
      '}',
      '.cl-header {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  gap: 8px; padding: 12px 14px;',
      '  border-bottom: 1px solid var(--border-color, rgba(148, 163, 184, 0.2));',
      '}',
      '.cl-title { margin: 0; font-size: 1rem; font-weight: 700; }',
      '.cl-close {',
      '  min-width: 44px; min-height: 44px;',
      '  padding: 0 12px; border-radius: 10px;',
      '  border: 1px solid var(--border-color, rgba(148, 163, 184, 0.3));',
      '  background: transparent; color: inherit;',
      '  font-size: 0.95rem; font-weight: 600; cursor: pointer;',
      '}',
      '.cl-controls {',
      '  padding: 10px 14px; display: flex; flex-direction: column; gap: 10px;',
      '  border-bottom: 1px solid var(--border-color, rgba(148, 163, 184, 0.2));',
      '}',
      '.cl-search {',
      '  width: 100%; min-height: 44px; padding: 8px 12px;',
      '  box-sizing: border-box; border-radius: 10px;',
      '  border: 1px solid var(--border-color, rgba(148, 163, 184, 0.32));',
      '  background: var(--bg-input, rgba(15, 23, 42, 0.5));',
      '  color: inherit; font-size: 0.95rem;',
      '}',
      '.cl-filters { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.cl-filter-btn {',
      '  min-height: 44px; min-width: 44px; padding: 0 12px;',
      '  border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 600;',
      '  border: 1px solid var(--border-color, rgba(148, 163, 184, 0.3));',
      '  background: transparent; color: inherit;',
      '}',
      '.cl-filter-btn.cl-active {',
      '  background: var(--accent-color, #2563eb);',
      '  border-color: var(--accent-color, #2563eb); color: #ffffff;',
      '}',
      '.cl-list {',
      '  padding: 12px 14px; overflow-y: auto; flex: 1 1 auto;',
      '  display: flex; flex-direction: column; gap: 10px;',
      '}',
      '.cl-item {',
      '  border: 1px solid var(--border-color, rgba(148, 163, 184, 0.25));',
      '  border-radius: 10px; overflow: hidden;',
      '  background: rgba(15, 23, 42, 0.22);',
      '}',
      '.cl-item-head {',
      '  width: 100%; min-height: 44px; padding: 10px 12px;',
      '  background: transparent; border: 0; color: inherit;',
      '  display: flex; flex-direction: column; align-items: stretch; gap: 6px;',
      '  text-align: start; cursor: pointer; box-sizing: border-box;',
      '}',
      '.cl-item-top {',
      '  display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;',
      '}',
      '.cl-item-topic { font-size: 0.95rem; font-weight: 600; line-height: 1.4; }',
      '.cl-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
      '.cl-badge {',
      '  display: inline-block; padding: 2px 8px; border-radius: 999px;',
      '  font-size: 0.75rem; font-weight: 600;',
      '}',
      '.cl-badge-code { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }',
      '.cl-badge-verified { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }',
      '.cl-badge-secondary { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }',
      '.cl-badge-review { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }',
      '.cl-item-body {',
      '  display: none; padding: 0 12px 12px; font-size: 0.9rem; line-height: 1.6;',
      '  border-top: 1px solid var(--border-color, rgba(148, 163, 184, 0.16));',
      '}',
      '.cl-item.cl-expanded .cl-item-body { display: block; }',
      '.cl-item-text { margin: 10px 0 8px; }',
      '.cl-meta { font-size: 0.8rem; opacity: 0.85; margin: 4px 0; word-break: break-word; }',
      '.cl-source-link {',
      '  display: inline-flex; align-items: center; min-height: 44px;',
      '  color: #60a5fa; text-decoration: underline; word-break: break-all;',
      '  font-size: 0.82rem;',
      '}',
      '.cl-empty { text-align: center; padding: 24px 12px; opacity: 0.8; font-size: 0.92rem; }',
      '#codeRefBtn { min-height: 44px; min-width: 44px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderList(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    if (!Array.isArray(itemsCache)) {
      var loading = document.createElement('div');
      loading.className = 'cl-empty';
      loading.textContent = 'Loading code library...';
      container.appendChild(loading);
      return;
    }

    var normQ = normalizeArabic(searchQuery);
    var filtered = itemsCache.filter(function (item) {
      if (activeCode !== 'all' && item.code !== activeCode) return false;
      if (!normQ) return true;
      var haystack = normalizeArabic([
        item.id,
        item.code,
        codeLabel(item.code),
        item.topic,
        item.text,
        item.clause,
        item.source_note
      ].join(' '));
      return haystack.indexOf(normQ) !== -1;
    });

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'cl-empty';
      empty.textContent = 'No matching clauses found.';
      container.appendChild(empty);
      return;
    }

    filtered.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'cl-item';

      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'cl-item-head';
      head.setAttribute('aria-expanded', 'false');

      var top = document.createElement('div');
      top.className = 'cl-item-top';

      var badges = document.createElement('div');
      badges.className = 'cl-badges';

      var codeBadge = document.createElement('span');
      codeBadge.className = 'cl-badge cl-badge-code';
      codeBadge.textContent = item.clause
        ? codeLabel(item.code) + ' - ' + item.clause
        : codeLabel(item.code);
      badges.appendChild(codeBadge);

      var st = statusInfo(item.status);
      var statusBadge = document.createElement('span');
      statusBadge.className = 'cl-badge ' + st.cls;
      statusBadge.textContent = st.text;
      badges.appendChild(statusBadge);

      var toggleHint = document.createElement('span');
      toggleHint.className = 'cl-meta';
      toggleHint.textContent = 'Details';

      top.appendChild(badges);
      top.appendChild(toggleHint);

      var topicEl = document.createElement('div');
      topicEl.className = 'cl-item-topic';
      topicEl.textContent = item.topic || '';

      head.appendChild(top);
      head.appendChild(topicEl);

      var body = document.createElement('div');
      body.className = 'cl-item-body';

      var textEl = document.createElement('p');
      textEl.className = 'cl-item-text';
      textEl.textContent = item.text || '';
      body.appendChild(textEl);

      if (item.source_note) {
        var noteEl = document.createElement('div');
        noteEl.className = 'cl-meta';
        noteEl.textContent = item.source_note;
        body.appendChild(noteEl);
      }

      if (item.checked_on) {
        var checkedEl = document.createElement('div');
        checkedEl.className = 'cl-meta';
        checkedEl.textContent = 'Checked: ' + item.checked_on;
        body.appendChild(checkedEl);
      }

      if (typeof item.source_url === 'string' && /^https?:\/\//i.test(item.source_url)) {
        var linkEl = document.createElement('a');
        linkEl.className = 'cl-source-link';
        linkEl.href = item.source_url;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.textContent = item.source_url;
        body.appendChild(linkEl);
      }

      head.addEventListener('click', function () {
        var expanded = card.classList.toggle('cl-expanded');
        head.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });

      card.appendChild(head);
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  function ensureModal() {
    var existing = document.getElementById(MODAL_ID);
    if (existing) return existing;

    injectStyles();

    var backdrop = document.createElement('div');
    backdrop.id = MODAL_ID;
    backdrop.className = 'cl-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Code Reference Library');

    var modal = document.createElement('div');
    modal.className = 'cl-modal';

    var header = document.createElement('div');
    header.className = 'cl-header';

    var title = document.createElement('h2');
    title.className = 'cl-title';
    title.textContent = 'Code Reference (SBC 401 / SEC)';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cl-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = 'Close';

    header.appendChild(title);
    header.appendChild(closeBtn);

    var controls = document.createElement('div');
    controls.className = 'cl-controls';

    var searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'cl-search';
    searchInput.placeholder = 'Search SBC 401 / SEC...';
    searchInput.setAttribute('aria-label', 'Search code library');

    var filters = document.createElement('div');
    filters.className = 'cl-filters';

    var list = document.createElement('div');
    list.className = 'cl-list';

    var filterDefs = [
      { id: 'all', label: 'All' },
      { id: 'sbc401', label: 'SBC 401' },
      { id: 'sec_dc', label: 'SEC DC' },
      { id: 'sec_dps', label: 'SEC DPS' }
    ];

    filterDefs.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cl-filter-btn' + (f.id === activeCode ? ' cl-active' : '');
      btn.textContent = f.label;
      btn.addEventListener('click', function () {
        activeCode = f.id;
        var allBtns = filters.querySelectorAll('.cl-filter-btn');
        for (var i = 0; i < allBtns.length; i++) {
          allBtns[i].classList.remove('cl-active');
        }
        btn.classList.add('cl-active');
        renderList(list);
      });
      filters.appendChild(btn);
    });

    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value || '';
      renderList(list);
    });

    controls.appendChild(searchInput);
    controls.appendChild(filters);

    modal.appendChild(header);
    modal.appendChild(controls);
    modal.appendChild(list);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function closeModal() {
      backdrop.classList.remove('cl-open');
    }

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && backdrop.classList.contains('cl-open')) {
        closeModal();
      }
    });

    backdrop._renderList = function () {
      renderList(list);
    };
    backdrop._showError = function (msg) {
      while (list.firstChild) list.removeChild(list.firstChild);
      var err = document.createElement('div');
      err.className = 'cl-empty';
      err.textContent = msg;
      list.appendChild(err);
    };

    return backdrop;
  }

  function openModal() {
    var modal = ensureModal();
    modal.classList.add('cl-open');
    modal._renderList();

    if (itemsCache === null) {
      fetch(DATA_URL)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          itemsCache = Array.isArray(data) ? data : [];
          modal._renderList();
        })
        .catch(function () {
          modal._showError('Failed to load code library data.');
        });
    }
  }

  function attachMenuButton() {
    var menu = document.getElementById('utMoreMenu');
    if (!menu || document.getElementById(BTN_ID)) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = BTN_ID;
    btn.className = 'ut-more-item';
    btn.textContent = 'Code Ref';
    btn.addEventListener('click', function () {
      menu.classList.remove('open', 'show');
      openModal();
    });
    menu.appendChild(btn);
  }

  function init() {
    attachMenuButton();
    if (!document.getElementById(BTN_ID) && typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () {
        attachMenuButton();
        if (document.getElementById(BTN_ID)) {
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
