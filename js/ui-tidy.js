(function () {
  'use strict';

  var CATEGORIES = [
    { id: 'all', label: 'الكل' },
    { id: 'elec', label: 'حسابات كهربائية' },
    { id: 'review', label: 'مراجعة واعتمادات' },
    { id: 'comms', label: 'مراسلات وتلخيص' }
  ];

  var KEYWORDS_COMMS = ['لخص', 'خطاب', 'رد على إيميل', 'Humanize'];
  var KEYWORDS_ELEC = ['حسابات', 'أحمال', 'كميات', 'BOQ', 'كبل', 'هبوط', 'تكييف', 'إنشائ'];
  var KEYWORDS_REVIEW = ['راجع', 'قارن', 'مخطط', 'اعتماد', 'حريق', 'Submittal'];

  var activeCategory = 'all';

  function injectStyles() {
    if (document.getElementById('ut-styles')) return;
    var style = document.createElement('style');
    style.id = 'ut-styles';
    style.textContent = [
      'html, body { max-width: 100%; overflow-x: hidden; }',
      '.topbar { max-width: 100%; box-sizing: border-box; z-index: 60; }',
      '.topbar button { min-height: 44px; }',
      '#utMoreWrap { position: relative; display: inline-flex; align-items: center; margin-inline-start: auto; }',
      '#utMoreBtn { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; cursor: pointer; box-sizing: border-box; }',
      '#utMoreBtn svg { width: 18px; height: 18px; flex-shrink: 0; }',
      '#utMoreMenu { position: fixed; top: 60px; left: 8px; min-width: 210px; max-width: calc(100vw - 24px); background: var(--card, #111827); border: 1px solid var(--border, rgba(255,255,255,0.16)); border-radius: 10px; padding: 6px; box-shadow: 0 10px 28px rgba(0,0,0,0.35); z-index: 1200; display: none; flex-direction: column; gap: 4px; box-sizing: border-box; }',
      '#utMoreMenu.open { display: flex; }',
      '#utMoreMenu button, #utMoreMenu a { min-height: 44px; width: 100%; display: flex; align-items: center; justify-content: flex-start; gap: 8px; padding: 8px 12px; border-radius: 8px; box-sizing: border-box; margin: 0; }',
      '#utTmplFilters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; max-width: 100%; box-sizing: border-box; }',
      '#utTmplFilters .ut-filter-btn { min-height: 44px; padding: 8px 14px; border-radius: 10px; border: 1px solid var(--border, rgba(255,255,255,0.18)); background: transparent; color: inherit; cursor: pointer; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }',
      '#utTmplFilters .ut-filter-btn.active { background: var(--accent, #2563eb); color: #ffffff; border-color: var(--accent, #2563eb); }',
      '#tmpls button { min-height: 44px; }',
      '@media (max-width: 420px) {',
      '  .topbar { gap: 6px; padding-inline: 8px; }',
      '  #utTmplFilters { gap: 6px; }',
      '  #utTmplFilters .ut-filter-btn { flex: 1 1 calc(50% - 6px); min-width: 0; font-size: 12px; padding: 8px 10px; }',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function createMoreIcon() {
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    [5, 12, 19].forEach(function (cy) {
      var c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', '12');
      c.setAttribute('cy', String(cy));
      c.setAttribute('r', '1.5');
      c.setAttribute('fill', 'currentColor');
      svg.appendChild(c);
    });
    return svg;
  }

  function isStandaloneLetterheadBtn(el) {
    if (!el || el.tagName !== 'BUTTON') return false;
    var id = (el.id || '').toLowerCase();
    var txt = (el.textContent || '').trim().toLowerCase();
    if (id === 'menuBtn'.toLowerCase() || id === 'utmorebtn') return false;
    return id.indexOf('letterhead') !== -1 || txt.indexOf('letterhead') !== -1 || txt.indexOf('ترويسة') !== -1 || txt.indexOf('ورق رسمي') !== -1;
  }

  function setupTopbarMore() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;

    var wrap = document.getElementById('utMoreWrap');
    var btn = document.getElementById('utMoreBtn');
    var menu = document.getElementById('utMoreMenu');

    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'utMoreWrap';

      btn = document.createElement('button');
      btn.id = 'utMoreBtn';
      btn.type = 'button';
      btn.className = 'sec';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(createMoreIcon());
      var lbl = document.createElement('span');
      lbl.textContent = 'More';
      btn.appendChild(lbl);

      menu = document.createElement('div');
      menu.id = 'utMoreMenu';
      menu.setAttribute('role', 'menu');

      wrap.appendChild(btn);
      wrap.appendChild(menu);
      topbar.appendChild(wrap);

      function closeMenu() {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }

      function toggleMenu(e) {
        if (e) e.stopPropagation();
        var isOpen = menu.classList.toggle('open');
        if (isOpen) {
          var br = btn.getBoundingClientRect();
          var mw = Math.max(210, menu.offsetWidth || 210);
          var left = Math.min(Math.max(8, br.right - mw), window.innerWidth - mw - 8);
          menu.style.top = (br.bottom + 6) + 'px';
          menu.style.left = Math.max(8, left) + 'px';
        }
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }

      btn.addEventListener('click', toggleMenu);

      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) closeMenu();
      });

      document.addEventListener('touchend', function (e) {
        if (!wrap.contains(e.target)) closeMenu();
      }, { passive: true });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
      });

      menu.addEventListener('click', function (e) {
        if (e.target && e.target.closest('button')) closeMenu();
      });
    }

    function moveIntoMenu(el) {
      if (!el || el.parentElement === menu) return;
      el.setAttribute('role', 'menuitem');
      menu.appendChild(el);
    }

    moveIntoMenu(document.getElementById('backupBtn'));
    moveIntoMenu(document.getElementById('helpBtn'));

    var topbarButtons = topbar.querySelectorAll('button');
    for (var i = 0; i < topbarButtons.length; i++) {
      if (isStandaloneLetterheadBtn(topbarButtons[i])) {
        moveIntoMenu(topbarButtons[i]);
      }
    }
  }

  function classifyTemplateText(text) {
    var t = (text || '').trim();
    var i;
    for (i = 0; i < KEYWORDS_COMMS.length; i++) {
      if (t.indexOf(KEYWORDS_COMMS[i]) !== -1) return 'comms';
    }
    for (i = 0; i < KEYWORDS_ELEC.length; i++) {
      if (t.indexOf(KEYWORDS_ELEC[i]) !== -1) return 'elec';
    }
    for (i = 0; i < KEYWORDS_REVIEW.length; i++) {
      if (t.indexOf(KEYWORDS_REVIEW[i]) !== -1) return 'review';
    }
    return 'review';
  }

  function applyTemplateFilter(category) {
    activeCategory = category || 'all';
    var filtersEl = document.getElementById('utTmplFilters');
    if (filtersEl) {
      var fBtns = filtersEl.querySelectorAll('.ut-filter-btn');
      for (var i = 0; i < fBtns.length; i++) {
        var isActive = fBtns[i].getAttribute('data-ut-cat') === activeCategory;
        fBtns[i].classList.toggle('active', isActive);
        fBtns[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    }

    var tmpls = document.getElementById('tmpls');
    if (!tmpls) return;
    var btns = tmpls.querySelectorAll('button');
    for (var j = 0; j < btns.length; j++) {
      var b = btns[j];
      var cat = classifyTemplateText(b.textContent);
      b.setAttribute('data-ut-category', cat);
      b.style.display = (activeCategory === 'all' || cat === activeCategory) ? '' : 'none';
    }
  }

  function setupTemplateFilters() {
    var tmpls = document.getElementById('tmpls');
    if (!tmpls || !tmpls.parentNode) return;

    if (!document.getElementById('utTmplFilters')) {
      var row = document.createElement('div');
      row.id = 'utTmplFilters';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'تصنيف القوالب');

      CATEGORIES.forEach(function (cat) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ut-filter-btn' + (cat.id === activeCategory ? ' active' : '');
        b.setAttribute('data-ut-cat', cat.id);
        b.setAttribute('aria-pressed', cat.id === activeCategory ? 'true' : 'false');
        b.textContent = cat.label;
        b.addEventListener('click', function () {
          applyTemplateFilter(cat.id);
        });
        row.appendChild(b);
      });

      tmpls.parentNode.insertBefore(row, tmpls);
    }

    applyTemplateFilter(activeCategory);
  }

  function observeDynamicChanges() {
    if (typeof MutationObserver === 'undefined') return;
    var topbar = document.querySelector('.topbar');
    if (topbar) {
      var topbarObs = new MutationObserver(function () {
        setupTopbarMore();
      });
      topbarObs.observe(topbar, { childList: true });
    }

    var tmpls = document.getElementById('tmpls');
    if (tmpls) {
      var tmplsObs = new MutationObserver(function () {
        applyTemplateFilter(activeCategory);
      });
      tmplsObs.observe(tmpls, { childList: true });
    }
  }

  function init() {
    injectStyles();
    setupTopbarMore();
    setupTemplateFilters();
    observeDynamicChanges();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
