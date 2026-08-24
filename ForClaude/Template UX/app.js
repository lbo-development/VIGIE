/* =====================================================================
   GPMM — Socle JS commun des applications métier
   Chaque fonction ci-dessous est un module indépendant : elle ne fait
   rien si les éléments qu'elle cible sont absents de la page. Une appli
   qui n'utilise pas un composant n'est pas pénalisée par sa présence ici.
   Ce fichier ne doit contenir QUE du comportement générique de design
   system — toute logique métier (chargement de données, appels API,
   règles propres à une appli) va dans un fichier JS séparé.
   ===================================================================== */
(function () {
  'use strict';

  /* ============================= SHELL =============================
     Structure applicative commune : header, sidebar rétractable, onglets
     de navigation principale (scroll horizontal), thème clair/sombre.
     ================================================================= */
  function initShell() {
    const root = document.documentElement;
    const shell = document.getElementById('appShell');
    const sidebar = document.getElementById('appSidebar');
    const railToggle = document.getElementById('sidebarRailToggle');
    const railIconUse = document.getElementById('sidebarRailIconUse');
    const themeToggle = document.getElementById('themeToggle');
    const themeLabel = document.getElementById('themeLabel');
    const themeIconUse = document.getElementById('themeIconUse');

    if (shell && sidebar && railToggle) {
      const overlayMq = window.matchMedia('(max-width: 1199px)');
      const isOverlayMode = () => overlayMq.matches;

      function updateRailState() {
        const overlay = isOverlayMode();
        const open = shell.classList.contains('sidebar-open');
        const collapsed = shell.classList.contains('sidebar-collapsed');
        const expanded = overlay ? open : !collapsed;

        railToggle.setAttribute('aria-expanded', String(expanded));
        railToggle.setAttribute('aria-label', expanded ? 'Escamoter la navigation' : 'Afficher la navigation');
        const href = expanded ? '#i-chevron-left' : '#i-chevron-right';
        if (railIconUse) {
          railIconUse.setAttribute('href', href);
          railIconUse.setAttribute('xlink:href', href);
        }
        sidebar.setAttribute('aria-hidden', String(overlay && !open));
      }

      function toggleSidebar() {
        if (isOverlayMode()) {
          shell.classList.toggle('sidebar-open');
          shell.classList.remove('sidebar-collapsed');
        } else {
          shell.classList.toggle('sidebar-collapsed');
          shell.classList.remove('sidebar-open');
        }
        updateRailState();
      }

      railToggle.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleSidebar();
      });

      // La languette est volontairement l'unique commande d'ouverture/fermeture.
      // Les clics, le scroll, les sous-menus, les paramètres et le thème ne ferment pas la sidebar.
      sidebar.addEventListener('click', function (event) { event.stopPropagation(); });

      function syncLayout() {
        if (isOverlayMode()) {
          shell.classList.remove('sidebar-collapsed');
          shell.classList.remove('sidebar-open');
        } else {
          shell.classList.remove('sidebar-open');
          shell.classList.remove('sidebar-collapsed');
        }
        updateRailState();
      }
      if (overlayMq.addEventListener) overlayMq.addEventListener('change', syncLayout);
      else if (overlayMq.addListener) overlayMq.addListener(syncLayout);

      document.querySelectorAll('.menu-trigger').forEach(function (trigger) {
        trigger.addEventListener('click', function (event) {
          event.preventDefault();
          const group = trigger.closest('.menu-group');
          if (!group) return;
          const willOpen = !group.classList.contains('is-open');
          group.classList.toggle('is-open', willOpen);
          trigger.setAttribute('aria-expanded', String(willOpen));
        });
      });

      updateRailState();
    }

    // Onglets de navigation principale (header) : scroll horizontal tactile + indicateurs.
    const headerTabs = document.getElementById('headerTabs');
    const tabsScrollLeft = document.getElementById('tabsScrollLeft');
    const tabsScrollRight = document.getElementById('tabsScrollRight');

    function updateTabScrollIndicators() {
      if (!headerTabs || !tabsScrollLeft || !tabsScrollRight) return;
      const maxScroll = Math.max(0, headerTabs.scrollWidth - headerTabs.clientWidth);
      const overflow = maxScroll > 2;
      tabsScrollLeft.hidden = !overflow || headerTabs.scrollLeft <= 2;
      tabsScrollRight.hidden = !overflow || headerTabs.scrollLeft >= maxScroll - 2;
    }
    function scrollTabs(direction) {
      if (!headerTabs) return;
      headerTabs.scrollBy({ left: direction * Math.max(140, headerTabs.clientWidth * .58), behavior: 'smooth' });
    }
    if (headerTabs) {
      headerTabs.addEventListener('scroll', updateTabScrollIndicators, { passive: true });
      window.addEventListener('resize', updateTabScrollIndicators);
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateTabScrollIndicators).observe(headerTabs);
    }
    if (tabsScrollLeft) tabsScrollLeft.addEventListener('click', () => scrollTabs(-1));
    if (tabsScrollRight) tabsScrollRight.addEventListener('click', () => scrollTabs(1));

    // Panneaux de contenu associés à chaque onglet principal : un élément portant
    // [data-main-panel="xxx"] est montré quand l'onglet [data-main-tab="xxx"] est actif.
    // Optionnel — une appli à page unique n'a pas besoin de définir de panneaux.
    const mainPanels = [...document.querySelectorAll('[data-main-panel]')];
    function showMainPanel(key) {
      if (!mainPanels.length) return;
      mainPanels.forEach(p => p.hidden = p.dataset.mainPanel !== key);
    }

    document.querySelectorAll('[data-main-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('[data-main-tab]').forEach(t => t.setAttribute('aria-selected', 'false'));
        tab.setAttribute('aria-selected', 'true');
        const crumb = document.querySelector('.breadcrumbs strong');
        if (crumb) crumb.textContent = tab.textContent.trim();
        showMainPanel(tab.dataset.mainTab);
        try { tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch (e) {}
        window.setTimeout(updateTabScrollIndicators, 220);
      });
    });
    // État initial : montrer le panneau correspondant à l'onglet déjà sélectionné au chargement.
    const initialMainTab = document.querySelector('[data-main-tab][aria-selected="true"]');
    if (initialMainTab) showMainPanel(initialMainTab.dataset.mainTab);

    // Thème clair / sombre : mémorisé (localStorage), avec repli sur la préférence système.
    function safeGetTheme() {
      try { return localStorage.getItem('gpmm-theme'); } catch (e) { return null; }
    }
    function safeSaveTheme(theme) {
      try { localStorage.setItem('gpmm-theme', theme); } catch (e) {}
    }
    function applyTheme(theme) {
      const normalized = theme === 'dark' ? 'dark' : 'light';
      root.dataset.theme = normalized;
      const dark = normalized === 'dark';
      if (themeLabel) themeLabel.textContent = dark ? 'Clair' : 'Sombre';
      if (themeIconUse) {
        const href = dark ? '#i-sun' : '#i-moon';
        themeIconUse.setAttribute('href', href);
        themeIconUse.setAttribute('xlink:href', href);
      }
      if (themeToggle) themeToggle.setAttribute('aria-pressed', String(dark));
      safeSaveTheme(normalized);
    }
    let initialTheme = safeGetTheme();
    if (!initialTheme) {
      try { initialTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
      catch (e) { initialTheme = 'light'; }
    }
    applyTheme(initialTheme);
    if (themeToggle) {
      themeToggle.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
      });
    }

    window.setTimeout(updateTabScrollIndicators, 0);
  }

  /* ======================= CHIPS (slicers A) =======================
     Chips à bascule simple (filtres multi-sélection) et tuiles avec
     compteurs (slicers D). Un clic bascule l'état actif.
     ================================================================= */
  function initChipsAndTiles() {
    document.querySelectorAll('[data-chip], .gp-chip').forEach(function (chip) {
      if (chip.dataset.gpBound) return;
      chip.dataset.gpBound = '1';
      chip.addEventListener('click', function () {
        if (chip.classList.contains('is-disabled')) return;
        chip.classList.toggle('is-on');
      });
    });
    document.querySelectorAll('[data-tile]').forEach(function (tile) {
      tile.addEventListener('click', function () {
        if (tile.classList.contains('is-disabled')) return;
        tile.classList.toggle('is-on');
      });
    });
    // Presets (ex. plages de dates) : sélection exclusive au sein du même groupe.
    document.querySelectorAll('[data-preset]').forEach(function (preset) {
      preset.addEventListener('click', function () {
        preset.parentElement.querySelectorAll('[data-preset]').forEach(x => x.classList.remove('is-on'));
        preset.classList.add('is-on');
      });
    });
  }

  /* =================== SLICER — liste à cocher ===================
     Compteur de sélection + bouton « Effacer ».
     ================================================================= */
  function initCheckSlicers() {
    document.querySelectorAll('[data-slicer]').forEach(function (sl) {
      const boxes = [...sl.querySelectorAll('.gp-check')];
      const foot = sl.querySelector('[data-count]');
      if (!foot) return;
      const update = () => {
        const n = boxes.filter(b => b.checked).length;
        foot.textContent = n + (n > 1 ? ' sélectionnées' : ' sélectionnée');
      };
      boxes.forEach(b => b.addEventListener('change', update));
      const clearBtn = sl.querySelector('[data-clear]');
      if (clearBtn) clearBtn.addEventListener('click', () => { boxes.forEach(b => b.checked = false); update(); });
      update();
    });
  }

  /* ======================= SLICER — dropdown ========================
     Menu déroulant à cases à cocher avec récapitulatif dans le déclencheur.
     ================================================================= */
  function initDropdownSlicers() {
    document.querySelectorAll('[data-dd]').forEach(function (dd) {
      const trigger = dd.querySelector('[data-dd-trigger]');
      if (!trigger) return;
      trigger.addEventListener('click', () => dd.classList.toggle('is-open'));
      const val = trigger.querySelector('span');
      dd.querySelectorAll('.gp-check').forEach(function (b) {
        b.addEventListener('change', () => {
          const n = [...dd.querySelectorAll('.gp-check')].filter(x => x.checked).length;
          if (val) val.textContent = n ? n + (n > 1 ? ' sélectionnées' : ' sélectionnée') : 'Aucune';
        });
      });
      document.addEventListener('click', e => { if (!dd.contains(e.target)) dd.classList.remove('is-open'); });
    });
  }

  /* ========================= COMBOBOX ============================
     Champ + liste filtrable simple (non slicer). Clic pour ouvrir,
     clic à l'extérieur pour fermer.
     ================================================================= */
  function initCombobox() {
    document.querySelectorAll('.gp-combobox:not([data-dd])').forEach(function (cb) {
      const trig = cb.querySelector('[data-cb-trigger]');
      const val = cb.querySelector('[data-cb-value]');
      if (!trig || !val) return;
      trig.addEventListener('click', () => cb.classList.toggle('is-open'));
      cb.querySelectorAll('[data-cb-opt]').forEach(function (o) {
        o.addEventListener('click', () => {
          val.textContent = o.textContent;
          val.style.color = 'var(--gp-text)';
          cb.classList.remove('is-open');
        });
      });
      document.addEventListener('click', e => { if (!cb.contains(e.target)) cb.classList.remove('is-open'); });
    });
  }

  /* ==================== SLICER — plage (range) =====================
     Curseur double (min/max) avec remplissage visuel, bulles de valeur
     optionnelles, et synchronisation avec des champs numériques associés.
     ================================================================= */
  function initRangeSliders() {
    document.querySelectorAll('.gp-range[data-range]').forEach(function (rg) {
      const ins = [...rg.querySelectorAll('input[type=range]')];
      const fill = rg.querySelector('.gp-range__fill');
      if (ins.length < 2 || !fill) return;
      const mn = +ins[0].min, mx = +ins[0].max;
      const pct = v => (v - mn) / (mx - mn) * 100;
      const bMin = rg.querySelector('[data-bub-min]');
      const bMax = rg.querySelector('[data-bub-max]');
      const fields = rg.parentElement.querySelectorAll('[data-range-field]');
      function update() {
        let a = +ins[0].value, b = +ins[1].value;
        if (a > b) { [a, b] = [b, a]; }
        fill.style.left = pct(a) + '%';
        fill.style.width = (pct(b) - pct(a)) + '%';
        if (bMin) { bMin.style.left = pct(a) + '%'; bMin.textContent = a; }
        if (bMax) { bMax.style.left = pct(b) + '%'; bMax.textContent = b; }
        if (fields.length) { fields[0].value = a; fields[1].value = b; }
      }
      ins.forEach(i => i.addEventListener('input', update));
      fields.forEach((f, i) => f.addEventListener('change', () => { ins[i].value = f.value; update(); }));
      update();
    });
  }

  /* ========================= SPIN BUTTON ==========================
     Champ numérique incrément/décrément (forme desktop chevrons et
     forme tactile − valeur +). Respecte min/max/step du champ.
     ================================================================= */
  function initSpinButtons() {
    document.querySelectorAll('[data-spin]').forEach(function (sp) {
      const input = sp.querySelector('input');
      if (!input) return;
      const inc = sp.querySelector('[data-inc]');
      const dec = sp.querySelector('[data-dec]');
      const step = +(input.step) || 1;
      const min = input.min !== '' ? +input.min : -Infinity;
      const max = input.max !== '' ? +input.max : Infinity;
      const clamp = v => Math.min(max, Math.max(min, v));
      function sync() {
        const v = +input.value;
        if (dec) dec.disabled = v <= min;
        if (inc) inc.disabled = v >= max;
      }
      function nudge(d) { input.value = clamp((+input.value || 0) + d * step); sync(); }
      if (inc) inc.addEventListener('click', () => nudge(1));
      if (dec) dec.addEventListener('click', () => nudge(-1));
      input.addEventListener('input', sync);
      sync();
    });
  }

  /* ==================== LISTBOX — sélection simple ==================
     Liste toujours visible, une seule ligne sélectionnable à la fois
     (surlignage + coche). Les options désactivées ne réagissent pas.
     ================================================================= */
  function initSingleListbox() {
    document.querySelectorAll('[data-single-listbox]').forEach(function (lb) {
      lb.querySelectorAll('.gp-opt').forEach(function (opt) {
        if (opt.classList.contains('is-disabled')) return;
        opt.addEventListener('click', () => {
          lb.querySelectorAll('.gp-opt').forEach(function (o) {
            o.classList.remove('is-selected', 'is-focus');
            o.querySelectorAll('.js-check').forEach(c => c.remove());
          });
          opt.classList.add('is-selected');
          opt.insertAdjacentHTML('beforeend', '<svg class="ti js-check"><use href="#i-check"></use></svg>');
        });
      });
    });
  }

  /* ============================ TOASTS ============================
     File de notifications empilées en haut à droite (haut pleine
     largeur sur mobile). API : gpmmToast({type, title, text, auto}).
     Un déclencheur avec [data-toast="info|success|warning|danger"] et
     [data-toast-title]/[data-toast-text] optionnels affiche un exemple.
     ================================================================= */
  function initToasts() {
    let region = document.getElementById('toastRegion');
    if (!region) {
      region = document.createElement('div');
      region.className = 'gp-toast-region';
      region.id = 'toastRegion';
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }

    const ICONS = { info: 'i-info-circle', success: 'i-circle-check', warning: 'i-alert-triangle', danger: 'i-alert-circle' };

    function showToast(opts) {
      const type = opts.type || 'info';
      const auto = opts.auto !== undefined ? opts.auto : (type === 'info' || type === 'success');
      const el = document.createElement('div');
      el.className = 'gp-toast gp-toast--' + type;
      el.innerHTML = '<svg class="ti gp-toast__icon"><use href="#' + (ICONS[type] || ICONS.info) + '"></use></svg>' +
        '<div style="flex:1"><p class="gp-toast__title">' + (opts.title || '') + '</p>' +
        '<p class="gp-toast__text">' + (opts.text || '') + '</p></div>' +
        '<button class="gp-toast__close" aria-label="Fermer"><svg class="ti"><use href="#i-x"></use></svg></button>' +
        (auto ? '<div class="gp-toast__bar"></div>' : '');
      el.querySelector('.gp-toast__close').addEventListener('click', () => el.remove());
      region.appendChild(el);
      if (auto) {
        const bar = el.querySelector('.gp-toast__bar');
        bar.style.width = '100%';
        bar.style.transition = 'width 5s linear';
        requestAnimationFrame(() => bar.style.width = '0%');
        setTimeout(() => el.remove(), 5000);
      }
      return el;
    }
    window.gpmmToast = showToast;

    document.querySelectorAll('[data-toast]').forEach(function (b) {
      b.addEventListener('click', () => showToast({
        type: b.dataset.toast,
        title: b.dataset.toastTitle || 'Notification',
        text: b.dataset.toastText || '',
        auto: b.dataset.toastAuto === undefined ? undefined : b.dataset.toastAuto !== 'false'
      }));
    });
  }

  /* ============================ MODALES ============================
     Ouverture via [data-open-modal="idDeLaModale"], fermeture via
     [data-close] à l'intérieur, clic sur le voile, ou touche Échap.
     ================================================================= */
  function initModals() {
    function openModal(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.classList.add('is-open');
      const f = m.querySelector('[autofocus]') || m.querySelector('button');
      if (f) f.focus();
    }
    function closeModal(m) { m.classList.remove('is-open'); }

    document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
      btn.addEventListener('click', () => openModal(btn.dataset.openModal));
    });
    document.querySelectorAll('.gp-overlay').forEach(function (o) {
      o.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(o)));
      o.addEventListener('click', e => { if (e.target === o) closeModal(o); });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.gp-overlay.is-open').forEach(closeModal);
    });

    window.gpmmOpenModal = openModal;
    window.gpmmCloseModal = (id) => { const m = document.getElementById(id); if (m) closeModal(m); };
  }

  /* ====================== ONGLETS EN PAGE (gp-tabs) ==================
     Onglets génériques utilisés à l'intérieur d'un panneau de contenu
     (distincts des onglets de navigation principale du header, qui
     utilisent [data-main-tab] et sont gérés dans initShell).
     ================================================================= */
  function initPageTabs() {
    document.querySelectorAll('.gp-tabs').forEach(function (bar) {
      const tabs = [...bar.querySelectorAll('.gp-tab[data-tab]')];
      if (!tabs.length) return;
      const scope = bar.parentElement;
      tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(x => x.setAttribute('aria-selected', 'false'));
        t.setAttribute('aria-selected', 'true');
        scope.querySelectorAll('.gp-tabpanel').forEach(p => p.hidden = p.dataset.panel !== t.dataset.tab);
      }));
    });
    // Sélecteur segmenté (bascule d'une même vue : jour / semaine / mois…)
    document.querySelectorAll('.gp-seg').forEach(function (seg) {
      seg.querySelectorAll('.gp-seg__item').forEach(it => it.addEventListener('click', () => {
        seg.querySelectorAll('.gp-seg__item').forEach(x => x.classList.remove('is-active'));
        it.classList.add('is-active');
      }));
    });
  }

  /* ========== CASE MAÎTRE (indéterminée) — groupe checkbox =========
     Toute case cochée avec [data-master] pilote l'état (coché / décoché
     / indéterminé) des cases portant le même [data-group].
     ================================================================= */
  function initMasterCheckboxes() {
    document.querySelectorAll('[data-master]').forEach(function (master) {
      const group = master.dataset.master;
      const subs = [...document.querySelectorAll('[data-group="' + group + '"]')];
      if (!subs.length) return;
      function sync() {
        const n = subs.filter(c => c.checked).length;
        master.checked = n === subs.length;
        master.indeterminate = n > 0 && n < subs.length;
      }
      subs.forEach(c => c.addEventListener('change', sync));
      master.addEventListener('change', () => subs.forEach(c => c.checked = master.checked));
      sync();
    });
  }

  /* ============================ TABLEAU ============================
     Tri (clic sur l'en-tête, multi-colonnes avec Maj optionnelle),
     sélection de lignes (case maître + cases de ligne), redimension-
     nement des colonnes (bord droit) et réordonnancement (glisser la
     poignée). Chaque instance de table.gp-table avec [data-table] sur
     son conteneur bénéficie de tout cela automatiquement.
     ================================================================= */
  function initTables() {
    document.querySelectorAll('table.gp-table').forEach(function (tbl) {
      if (!tbl.tHead || !tbl.tBodies.length) return;
      const headRow = tbl.tHead.rows[0];
      const body = tbl.tBodies[0];
      const sortState = [];
      const parseDate = s => { const p = s.split('/'); return (+p[2]) * 1e4 + (+p[1]) * 100 + (+p[0]); };
      const cmp = (a, b, t) => t === 'date' ? parseDate(a) - parseDate(b) : a.localeCompare(b, 'fr', { numeric: true });

      function applySort() {
        if (!sortState.length) return;
        [...body.rows].sort((ra, rb) => {
          for (const s of sortState) {
            const i = s.th.cellIndex, t = s.th.dataset.type || 'text';
            const c = cmp(ra.cells[i].innerText.trim(), rb.cells[i].innerText.trim(), t);
            if (c) return s.dir === 'asc' ? c : -c;
          }
          return 0;
        }).forEach(r => body.appendChild(r));
      }
      function updateInd() {
        headRow.querySelectorAll('[data-sort]').forEach(function (el) {
          const ind = el.querySelector('.gp-th__ind'), pri = el.querySelector('.gp-th__pri');
          if (!ind) return;
          ind.querySelector('use').setAttribute('href', '#i-selector');
          ind.style.color = '';
          if (pri) { pri.hidden = true; pri.textContent = ''; }
        });
        sortState.forEach((s, idx) => {
          const el = s.th.querySelector('[data-sort]');
          if (!el) return;
          const ind = el.querySelector('.gp-th__ind'), pri = el.querySelector('.gp-th__pri');
          ind.querySelector('use').setAttribute('href', s.dir === 'asc' ? '#i-arrow-up' : '#i-arrow-down');
          ind.style.color = 'var(--gp-primary)';
          if (sortState.length > 1 && pri) { pri.hidden = false; pri.textContent = idx + 1; }
        });
      }
      headRow.querySelectorAll('[data-sort]').forEach(function (el) {
        el.addEventListener('click', () => {
          const th = el.closest('th');
          const ex = sortState.find(s => s.th === th);
          if (!ex) sortState.push({ th, dir: 'asc' });
          else if (ex.dir === 'asc') ex.dir = 'desc';
          else sortState.splice(sortState.indexOf(ex), 1);
          applySort(); updateInd();
        });
      });

      const selAll = tbl.querySelector('[data-selall]');
      const boxes = () => [...body.querySelectorAll('[data-rowcheck]')];
      function syncSelAll() {
        const b = boxes(), n = b.filter(x => x.checked).length;
        if (selAll) { selAll.checked = n === b.length && n > 0; selAll.indeterminate = n > 0 && n < b.length; }
      }
      boxes().forEach(b => b.addEventListener('change', () => {
        b.closest('tr').classList.toggle('is-sel', b.checked);
        syncSelAll();
      }));
      if (selAll) selAll.addEventListener('change', () => boxes().forEach(b => {
        b.checked = selAll.checked;
        b.closest('tr').classList.toggle('is-sel', b.checked);
      }));

      headRow.querySelectorAll('[data-rz]').forEach(function (rz) {
        rz.addEventListener('mousedown', e => {
          e.preventDefault();
          const th = rz.closest('th'), sx = e.clientX, sw = th.offsetWidth;
          const mm = ev => th.style.width = Math.max(60, sw + ev.clientX - sx) + 'px';
          const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
          document.addEventListener('mousemove', mm);
          document.addEventListener('mouseup', mu);
        });
      });

      let dragIdx = null;
      function moveColumn(from, to) {
        if (from === to) return;
        [headRow, ...body.rows].forEach(row => {
          const cell = row.cells[from], ref = row.cells[to];
          from < to ? ref.after(cell) : ref.before(cell);
        });
      }
      headRow.querySelectorAll('.gp-th__grip').forEach(function (g) {
        g.addEventListener('dragstart', e => { dragIdx = g.closest('th').cellIndex; e.dataTransfer.effectAllowed = 'move'; });
      });
      headRow.querySelectorAll('th[data-col]').forEach(function (th) {
        th.addEventListener('dragover', e => { if (dragIdx !== null) { e.preventDefault(); th.classList.add('drag-over'); } });
        th.addEventListener('dragleave', () => th.classList.remove('drag-over'));
        th.addEventListener('drop', e => {
          e.preventDefault();
          th.classList.remove('drag-over');
          const to = th.cellIndex;
          if (dragIdx !== null && to !== dragIdx) moveColumn(dragIdx, to);
          dragIdx = null;
        });
      });
    });
  }

  /* ========================= CALENDRIER (DATEPICKER) =========================
     Saisie d'une date seule (.gp-dp[data-dp]) : dropdown sous le champ, mode
     grille par défaut (mois/année cliquables), bascule automatique en saisie
     directe JJ/MM/AAAA dès que l'utilisateur tape, colonnes Sa/Di en bande.
     ================================================================= */
  function initDatepicker() {
    const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
    const WE = [5, 6]; // index 0=Lu … 6=Di
    function pad(n) { return String(n).padStart(2, '0'); }
    function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
    function firstDow(y, m) { let d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

    document.querySelectorAll('[data-dp]').forEach(function (dp) {
      const inp = dp.querySelector('[data-dp-input]');
      const panel = dp.querySelector('[data-dp-panel]');
      const direct = dp.querySelector('[data-dp-direct]');
      const hint = dp.querySelector('[data-dp-hint]');
      const grid = dp.querySelector('[data-dp-grid]');
      const msel = dp.querySelector('[data-dp-msel]');
      const ysel = dp.querySelector('[data-dp-ysel]');
      const ddEl = dp.querySelector('[data-dp-dd]');
      const mmEl = dp.querySelector('[data-dp-mm]');
      const yyEl = dp.querySelector('[data-dp-yy]');
      if (!inp || !panel || !grid) return;

      const now = new Date();
      let cur = { y: now.getFullYear(), m: now.getMonth() };
      let sel = null; // {d,m,y}

      function open() { panel.classList.add('is-open'); render(); }
      function close() { panel.classList.remove('is-open'); direct.classList.remove('is-visible'); if (hint) hint.hidden = true; }

      function render() {
        msel.textContent = MONTHS[cur.m];
        ysel.textContent = cur.y;
        const dow = firstDow(cur.y, cur.m);
        const dim = daysInMonth(cur.y, cur.m);
        const prev = daysInMonth(cur.y, cur.m - 1);
        let html = '';
        DAYS.forEach((d, i) => { html += '<span class="gp-dp__dow' + (WE.includes(i) ? ' we' : '') + '">' + d + '</span>'; });
        // cases avant
        for (let i = 0; i < dow; i++) {
          const d = prev - dow + 1 + i;
          const col = (i + 7) % 7;
          html += '<span class="gp-dp__day other' + (WE.includes(col) ? ' we' : '') + '">' + d + '</span>';
        }
        for (let d = 1; d <= dim; d++) {
          const col = (dow + d - 1) % 7;
          const isWe = WE.includes(col);
          const isSel = sel && sel.d === d && sel.m === cur.m && sel.y === cur.y;
          const isToday = d === now.getDate() && cur.m === now.getMonth() && cur.y === now.getFullYear();
          html += '<span class="gp-dp__day' + (isWe ? ' we' : '') + (isSel ? ' sel' : '') + (isToday ? ' today' : '') + '" data-day="' + d + '">' + d + '</span>';
        }
        // cases après
        const total = dow + dim;
        const after = total % 7 === 0 ? 0 : 7 - total % 7;
        for (let i = 1; i <= after; i++) {
          const col = (total + i - 1) % 7;
          html += '<span class="gp-dp__day other' + (WE.includes(col) ? ' we' : '') + '">' + i + '</span>';
        }
        grid.innerHTML = html;
        grid.querySelectorAll('[data-day]').forEach(el => el.addEventListener('click', () => {
          sel = { d: +el.dataset.day, m: cur.m, y: cur.y };
          inp.value = pad(sel.d) + '/' + pad(sel.m + 1) + '/' + sel.y;
          render();
        }));
      }

      function syncDirect() {
        const v = inp.value;
        const parts = v.split('/');
        if (ddEl) ddEl.textContent = parts[0] || '--';
        if (mmEl) mmEl.textContent = parts[1] || '--';
        if (yyEl) yyEl.textContent = parts[2] || '----';
        [ddEl, mmEl, yyEl].forEach(el => el && el.classList.remove('is-focus'));
        if (v.length <= 2) { if (ddEl) ddEl.classList.add('is-focus'); }
        else if (v.length <= 5) { if (mmEl) mmEl.classList.add('is-focus'); }
        else if (yyEl) yyEl.classList.add('is-focus');
      }

      const trigger = dp.querySelector('[data-dp-trigger]');
      if (trigger) trigger.addEventListener('click', () => { panel.classList.contains('is-open') ? close() : open(); });

      const prevBtn = dp.querySelector('[data-dp-prev]');
      if (prevBtn) prevBtn.addEventListener('click', e => { e.stopPropagation(); cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } render(); });

      const nextBtn = dp.querySelector('[data-dp-next]');
      if (nextBtn) nextBtn.addEventListener('click', e => { e.stopPropagation(); cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } render(); });

      const todayBtn = dp.querySelector('[data-dp-today]');
      if (todayBtn) todayBtn.addEventListener('click', e => {
        e.stopPropagation();
        sel = { d: now.getDate(), m: now.getMonth(), y: now.getFullYear() };
        cur = { y: sel.y, m: sel.m };
        inp.value = pad(sel.d) + '/' + pad(sel.m + 1) + '/' + sel.y;
        render();
      });

      const okBtn = dp.querySelector('[data-dp-ok]');
      if (okBtn) okBtn.addEventListener('click', e => { e.stopPropagation(); close(); });

      inp.addEventListener('input', () => {
        const v = inp.value.replace(/[^0-9/]/g, '');
        inp.value = v;
        direct.classList.add('is-visible');
        if (hint) hint.hidden = false;
        syncDirect();
        if (v.length === 10) {
          const [dd, mm, yy] = v.split('/').map(Number);
          if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2100) {
            sel = { d: dd, m: mm - 1, y: yy }; cur = { y: yy, m: mm - 1 }; render();
          }
        }
      });

      inp.addEventListener('keydown', e => {
        if (e.key === 'Escape') close();
        if (e.key === 'Enter' && sel) close();
      });

      document.addEventListener('click', e => { if (!dp.contains(e.target)) close(); });
    });
  }

  /* ============================= INIT ============================= */
  function init() {
    initShell();
    initChipsAndTiles();
    initCheckSlicers();
    initDropdownSlicers();
    initCombobox();
    initRangeSliders();
    initSpinButtons();
    initSingleListbox();
    initToasts();
    initModals();
    initPageTabs();
    initMasterCheckboxes();
    initTables();
    initDatepicker();
  }


  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
