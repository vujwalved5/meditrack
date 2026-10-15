/**
 * MediTrack Mobile Controller (mobile.js)
 * Additive only: scoped to max-width: 767px.
 * Reads real app state from window.MediTrack and calls existing app functions.
 */

(function() {
  'use strict';

  const MQ = window.matchMedia('(max-width: 767px)');
  let isActive = false;
  let activeTab = 'home'; // 'home' | 'requests' | 'audit' | 'more'
  let currentFilterStatus = 'all';
  let currentFilterDept = 'all';
  let currentFilterType = 'all';
  let currentSearchQuery = '';
  let listLimit = 30;
  let activeSheet = null;
  let historyPushed = false;
  let previousFocusEl = null;
  let activeEqId = null;
  let selectedSheetRoom = null;
  let mobileScanner = null;
  let scannerActive = false;
  let currentTorchTrack = null;
  let torchOn = false;
  let isOffline = !navigator.onLine;

  // Check safety valve: Classic view preference
  function isClassicView() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mobile') === '1') {
        localStorage.removeItem('meditrack.classicView');
        return false;
      }
      return localStorage.getItem('meditrack.classicView') === '1';
    } catch (e) {
      return false;
    }
  }

  // Helper to access host app state
  function getApp() {
    return window.MediTrack || null;
  }

  function getState() {
    const app = getApp();
    return app ? app.getState() : {
      currentUser: null,
      cachedUsers: [],
      allEquipment: [],
      departments: [],
      productTypes: [],
      allRequests: [],
      allAuditLogs: {},
      latestCheckoutRoom: {},
      isDark: false
    };
  }

  function getActions() {
    const app = getApp();
    return app ? app.actions : {};
  }

  function getDeptRooms() {
    const app = getApp();
    return (app && app.DEPT_ROOMS) ? app.DEPT_ROOMS : {};
  }

  // ==========================================
  // SYNC & MOUNT LIFECYCLE
  // ==========================================
  function sync() {
    if (isClassicView()) {
      document.body.classList.add('m-classic');
      unmountMobile();
      return;
    } else {
      document.body.classList.remove('m-classic');
    }

    const state = getState();
    const isAuthenticated = !!(state.currentUser && state.currentUser.id);

    if (MQ.matches) {
      if (isAuthenticated && !isActive) {
        mountMobile();
      } else if (!isAuthenticated && isActive) {
        unmountMobile();
      }
    } else if (isActive) {
      unmountMobile();
    }
  }

  function mountMobile() {
    isActive = true;
    document.body.classList.add('m-active');
    document.documentElement.classList.remove('m-boot');

    let shell = document.getElementById('m-app');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'm-app';
      shell.setAttribute('role', 'region');
      shell.setAttribute('aria-label', 'Mobile MediTrack Application');
      document.body.appendChild(shell);
    }

    renderMobileShell();
    renderActiveView();
  }

  function unmountMobile() {
    isActive = false;
    document.body.classList.remove('m-active', 'm-keyboard-open');
    document.documentElement.classList.remove('m-boot');

    closeAllSheets(false);
    stopMobileScanner();

    const shell = document.getElementById('m-app');
    if (shell) shell.innerHTML = '';
    const toastContainer = document.getElementById('m-toast-container');
    if (toastContainer) toastContainer.remove();
    const nav = document.querySelector('.m-nav');
    if (nav) nav.remove();

    // Restore body overflow
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
  }

  // ==========================================
  // SHELL & NAV RENDERING
  // ==========================================
  function renderMobileShell() {
    const shell = document.getElementById('m-app');
    if (!shell) return;

    const state = getState();
    const user = state.currentUser || { username: 'User', role: 'Staff' };
    const initials = (user.username || 'U').slice(0, 2).toUpperCase();
    const roleKey = (user.role || '').toLowerCase();
    const roleClass = roleKey.includes('doctor') ? 'doctor' : (roleKey.includes('manager') ? 'manager' : 'staff');

    // Header (M-02)
    const headerHtml = `
      <header class="m-header" role="banner">
        <div class="m-header-left">
          <div class="m-logo-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <span class="m-logo-text">MediTrack</span>
          <div class="m-live-chip ${isOffline ? 'offline' : ''}" id="m-live-chip" role="status" aria-live="polite">
            <span class="m-live-dot" aria-hidden="true"></span>
            <span id="m-live-label">${isOffline ? 'Offline' : 'Live'}</span>
          </div>
        </div>

        <div class="m-header-right">
          <span class="m-role-pill ${roleClass}">${escapeHtml(user.role)}</span>
          <button class="m-avatar-btn" id="m-avatar-btn" aria-label="Account details and settings">
            <div class="m-avatar-circle">${escapeHtml(initials)}</div>
          </button>
        </div>
      </header>

      <div class="m-offline-banner ${isOffline ? 'show' : ''}" id="m-offline-banner" role="alert">
        You're offline — showing last known data. Actions are temporarily disabled.
      </div>

      <main id="m-main" style="flex:1; display:flex; flex-direction:column; width:100%;">
        <div id="m-view-home" class="m-view ${activeTab === 'home' ? 'm-view-active' : ''}"></div>
        <div id="m-view-requests" class="m-view ${activeTab === 'requests' ? 'm-view-active' : ''}"></div>
        <div id="m-view-audit" class="m-view ${activeTab === 'audit' ? 'm-view-active' : ''}"></div>
        <div id="m-view-more" class="m-view ${activeTab === 'more' ? 'm-view-active' : ''}"></div>
      </main>
    `;

    // Bottom Navigation (M-03, PL-24)
    // Audit Log is role-gated: hidden for Staff!
    const canSeeAudit = user.role === 'Manager' || user.role === 'Senior Doctor';
    const pendingReqCount = (state.allRequests || []).length;

    let nav = document.querySelector('.m-nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'm-nav';
      nav.setAttribute('aria-label', 'Primary');
      document.body.appendChild(nav);
    }

    nav.innerHTML = `
      <button class="m-nav-item" data-tab="home" ${activeTab === 'home' ? 'aria-current="page"' : ''} aria-label="Equipment feed">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
        <span class="m-nav-label">Equipment</span>
      </button>

      <button class="m-nav-item" data-tab="requests" ${activeTab === 'requests' ? 'aria-current="page"' : ''} aria-label="Requests, ${pendingReqCount} pending">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
        <span class="m-nav-label">Requests</span>
        ${pendingReqCount > 0 ? `<span class="m-nav-badge" id="m-nav-req-count">${pendingReqCount}</span>` : ''}
      </button>

      <div class="m-fab-wrap">
        <button class="m-fab-scan" id="m-fab-scan" aria-label="Scan equipment QR code">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
          <span>Scan</span>
        </button>
      </div>

      ${canSeeAudit ? `
      <button class="m-nav-item" data-tab="audit" ${activeTab === 'audit' ? 'aria-current="page"' : ''} aria-label="Audit log">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/></svg>
        <span class="m-nav-label">Audit</span>
      </button>` : ''}

      <button class="m-nav-item" data-tab="more" ${activeTab === 'more' ? 'aria-current="page"' : ''} aria-label="More options, AI brief, and settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        <span class="m-nav-label">More</span>
      </button>
    `;

    // Toast Container (M-18)
    let toastContainer = document.getElementById('m-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'm-toast-container';
      toastContainer.className = 'm-toast-container';
      document.body.appendChild(toastContainer);
    }

    shell.innerHTML = headerHtml;

    // Avatar opens More tab account card
    document.getElementById('m-avatar-btn')?.addEventListener('click', () => switchTab('more'));
  }

  // ==========================================
  // TAB SWITCHING
  // ==========================================
  function switchTab(tabId) {
    activeTab = tabId;
    ['home', 'requests', 'audit', 'more'].forEach(t => {
      const v = document.getElementById('m-view-' + t);
      if (v) v.classList.toggle('m-view-active', t === tabId);
    });

    document.querySelectorAll('.m-nav-item').forEach(btn => {
      const isCurrent = btn.dataset.tab === tabId;
      if (isCurrent) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    // Render newly selected tab content
    if (tabId === 'home') renderHomeView();
    else if (tabId === 'requests') renderRequestsView();
    else if (tabId === 'audit') renderAuditView();
    else if (tabId === 'more') renderMoreView();
  }

  // ==========================================
  // VIEW 1: HOME (EQUIPMENT FEED)
  // ==========================================
  function renderHomeView() {
    const container = document.getElementById('m-view-home');
    if (!container) return;

    const state = getState();
    const equipment = state.allEquipment || [];
    const depts = state.departments || [];
    const productTypes = state.productTypes || [];
    const requests = state.allRequests || [];

    // Real KPI counts (PL-13, PL-23)
    let availCount = 0;
    let inuseCount = 0;
    let alertCount = 0;

    equipment.forEach(eq => {
      const cond = eq.condition || 'Usable';
      const isMaint = cond === 'Needs Maintenance' || cond === 'Out of Order';
      if (isMaint) alertCount++;
      else if (eq.status === 'In Use') inuseCount++;
      else availCount++;
    });

    const productCountsById = new Map();
    const productCountsByName = new Map();
    equipment.forEach(eq => {
      if (eq.product_type_id !== null && eq.product_type_id !== undefined) {
        productCountsById.set(eq.product_type_id, (productCountsById.get(eq.product_type_id) || 0) + 1);
      }
      const typeName = eq.product_types ? eq.product_types.name : (eq.product_type_name || '');
      if (typeName) {
        productCountsByName.set(typeName, (productCountsByName.get(typeName) || 0) + 1);
      }
    });

    // Filter equipment
    const q = currentSearchQuery.toLowerCase().trim();
    const filtered = equipment.filter(eq => {
      const cond = eq.condition || 'Usable';
      const isMaint = cond === 'Needs Maintenance' || cond === 'Out of Order';

      // Status filter
      let matchStatus = true;
      if (currentFilterStatus === 'Available') matchStatus = eq.status === 'Available' && !isMaint;
      else if (currentFilterStatus === 'In Use') matchStatus = eq.status === 'In Use';
      else if (currentFilterStatus === 'Attention') matchStatus = isMaint;

      // Dept filter
      let matchDept = true;
      if (currentFilterDept !== 'all') {
        matchDept = String(eq.department_id) === String(currentFilterDept) ||
          (eq.departments && eq.departments.name === currentFilterDept);
      }

      // Product type filter
      let matchType = true;
      if (currentFilterType !== 'all') {
        const typeName = eq.product_types ? eq.product_types.name : (eq.product_type_name || '');
        matchType = String(eq.product_type_id) === String(currentFilterType) || typeName === currentFilterType;
      }

      // Search query
      let matchQ = true;
      if (q) {
        const name = (eq.name || '').toLowerCase();
        const qr = (eq.qr_code_id || '').toLowerCase();
        const holder = (eq.held_by || '').toLowerCase();
        const dept = ((eq.departments && eq.departments.name) || '').toLowerCase();
        const room = ((state.latestCheckoutRoom && state.latestCheckoutRoom[eq.id]) || '').toLowerCase();
        matchQ = name.includes(q) || qr.includes(q) || holder.includes(q) || dept.includes(q) || room.includes(q);
      }

      return matchStatus && matchDept && matchType && matchQ;
    });

    // Attention Banner (M-05, PL-03)
    const showBanner = alertCount > 0;
    const bannerHtml = showBanner ? `
      <div class="m-banner-alert" role="region" aria-label="Equipment attention alert">
        <button class="m-banner-text-btn" id="m-banner-filter-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span><strong>${alertCount} items</strong> need maintenance or attention</span>
        </button>
        <button class="m-banner-link-btn" id="m-banner-brief-btn">AI Brief →</button>
      </div>
    ` : '';

    // Product Pills (M-06)
    const productPillsHtml = `
      <div class="m-product-pills-wrap">
        <div class="m-product-pills" role="radiogroup" aria-label="Filter by product type">
          <button class="m-pill" data-ptype="all" aria-pressed="${currentFilterType === 'all'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            <span>All</span>
            <span class="m-pill-count">${equipment.length}</span>
          </button>
          ${productTypes.map(pt => {
            const count = productCountsById.get(pt.id) || productCountsByName.get(pt.name) || 0;
            const isSelected = String(currentFilterType) === String(pt.id) || currentFilterType === pt.name;
            return `
              <button class="m-pill" data-ptype="${escapeHtml(pt.id)}" aria-pressed="${isSelected}">
                ${pt.image_url ? `<img class="m-pill-img" src="${escapeHtml(pt.image_url)}" alt="">` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`}
                <span>${escapeHtml(pt.name)}</span>
                <span class="m-pill-count">${count}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Department Chips (M-07)
    const deptChipsHtml = `
      <div class="m-dept-chips" role="radiogroup" aria-label="Filter by department">
        <button class="m-dept-chip ${currentFilterDept === 'all' ? 'active' : ''}" data-dept="all" aria-pressed="${currentFilterDept === 'all'}">All Depts</button>
        ${depts.map(d => `
          <button class="m-dept-chip ${String(currentFilterDept) === String(d.id) ? 'active' : ''}" data-dept="${escapeHtml(d.id)}" aria-pressed="${String(currentFilterDept) === String(d.id)}">${escapeHtml(d.name)}</button>
        `).join('')}
      </div>
    `;

    const isFiltered = currentFilterStatus !== 'all' || currentFilterDept !== 'all' || currentFilterType !== 'all' || q !== '';
    const slice = filtered.slice(0, listLimit);

    container.innerHTML = `
      <!-- M-04: KPI Strip -->
      <section class="m-kpi-strip" aria-label="Key statistics">
        <button class="m-kpi-tile" id="m-kpi-avail" aria-pressed="${currentFilterStatus === 'Available'}" aria-label="Available, ${availCount} items. Filter list.">
          <div class="m-kpi-header">
            <span class="m-kpi-label">Available</span>
            <span class="m-kpi-dot avail" aria-hidden="true"></span>
          </div>
          <div class="m-kpi-num">${availCount}</div>
        </button>

        <button class="m-kpi-tile" id="m-kpi-inuse" aria-pressed="${currentFilterStatus === 'In Use'}" aria-label="In use, ${inuseCount} items. Filter list.">
          <div class="m-kpi-header">
            <span class="m-kpi-label">In use</span>
            <span class="m-kpi-dot inuse" aria-hidden="true"></span>
          </div>
          <div class="m-kpi-num">${inuseCount}</div>
        </button>

        <button class="m-kpi-tile" id="m-kpi-alert" aria-pressed="${currentFilterStatus === 'Attention'}" aria-label="Alerts, ${alertCount} items. Filter list.">
          <div class="m-kpi-header">
            <span class="m-kpi-label">Alerts</span>
            <span class="m-kpi-dot alert" aria-hidden="true"></span>
          </div>
          <div class="m-kpi-num">${alertCount}</div>
        </button>

        <button class="m-kpi-tile" id="m-kpi-reqs" aria-label="Requests, ${requests.length} pending. Open tab.">
          <div class="m-kpi-header">
            <span class="m-kpi-label">Requests</span>
            <span class="m-kpi-dot reqs" aria-hidden="true"></span>
          </div>
          <div class="m-kpi-num">${requests.length}</div>
        </button>
      </section>

      ${bannerHtml}
      ${productPillsHtml}

      <!-- M-07: Sticky Search & Filters Bar -->
      <div class="m-sticky-bar">
        <div class="m-sticky-row-1">
          <div class="m-search-wrap">
            <svg class="m-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" class="m-search-input" id="m-search-input" placeholder="Search equipment, ID…" value="${escapeHtml(currentSearchQuery)}" autocomplete="off" autocapitalize="off">
            <button class="m-search-clear ${q ? 'show' : ''}" id="m-search-clear" aria-label="Clear search">✕</button>
          </div>

          <div class="m-segmented" role="radiogroup" aria-label="Filter status">
            <button class="m-segment-btn ${currentFilterStatus === 'all' ? 'active' : ''}" data-status="all">All</button>
            <button class="m-segment-btn ${currentFilterStatus === 'Available' ? 'active' : ''}" data-status="Available">Avail</button>
            <button class="m-segment-btn ${currentFilterStatus === 'In Use' ? 'active' : ''}" data-status="In Use">In Use</button>
          </div>
        </div>

        ${deptChipsHtml}

        ${isFiltered ? `
          <div class="m-filter-summary-line">
            <span>Showing ${filtered.length} of ${equipment.length} items</span>
            <button class="m-clear-filters-btn" id="m-clear-filters-btn">Clear filters</button>
          </div>
        ` : ''}
      </div>

      <!-- M-08: Equipment List -->
      <section class="m-eq-list" aria-label="Equipment list">
        ${filtered.length === 0 ? `
          <div style="padding:48px 16px; text-align:center; color:var(--text-2);">
            <p style="font-size:14px; margin-bottom:8px;">No equipment matches your filters</p>
            <button class="m-clear-filters-btn" id="m-empty-reset-btn" style="font-size:13px; text-decoration:underline;">Reset all filters</button>
          </div>
        ` : slice.map(eq => renderEquipmentRow(eq, state)).join('')}

        ${filtered.length > slice.length ? `
          <div class="m-show-more-wrap">
            <button class="m-btn-show-more" id="m-btn-show-more">Show ${Math.min(30, filtered.length - slice.length)} more (${filtered.length - slice.length} remaining)</button>
          </div>
        ` : ''}
      </section>
    `;

    bindHomeEvents();
  }

  function renderEquipmentRow(eq, state) {
    const isAvail = eq.status === 'Available';
    const cond = eq.condition || 'Usable';
    const isMaint = cond === 'Needs Maintenance' || cond === 'Out of Order';
    const deptName = eq.departments ? eq.departments.name : 'Unknown';

    let badgeClass = 'avail';
    let badgeLabel = 'Available';
    if (isMaint) {
      badgeClass = cond === 'Out of Order' ? 'critical' : 'maint';
      badgeLabel = cond;
    } else if (!isAvail) {
      badgeClass = 'inuse';
      badgeLabel = 'In Use';
    }

    let metaLine = '';
    if (isAvail) {
      metaLine = `${escapeHtml(deptName)} · ${escapeHtml(cond)}`;
    } else {
      const room = (state.latestCheckoutRoom && state.latestCheckoutRoom[eq.id]) || 'Ward';
      const holder = eq.held_by || 'Unknown';
      let durStr = '';
      if (eq.in_use_since) {
        const diff = Math.floor((Date.now() - new Date(eq.in_use_since).getTime()) / 1000);
        if (diff >= 0) {
          const h = Math.floor(diff / 3600);
          const m = Math.floor((diff % 3600) / 60);
          durStr = h > 0 ? `held for ${h}h ${m}m` : `held for ${m}m`;
        }
      }
      metaLine = `${escapeHtml(deptName)} · ${escapeHtml(room)} · ${escapeHtml(holder)}${durStr ? ` (${durStr})` : ''}`;
    }

    return `
      <button class="m-eq-row" data-eqid="${eq.id}" aria-label="${escapeHtml(eq.name)}, ${escapeHtml(deptName)}, ${badgeLabel}. Open details.">
        <div class="m-eq-row-main">
          <div class="m-eq-row-title">${escapeHtml(eq.name)}</div>
          <div class="m-eq-row-meta">${metaLine}</div>
        </div>
        <div class="m-eq-row-side">
          <span class="m-status-badge ${badgeClass}">
            <span class="m-status-dot" aria-hidden="true"></span>
            <span>${badgeLabel}</span>
          </span>
          <svg class="m-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </button>
    `;
  }

  function bindHomeEvents() {
    // KPI buttons
    document.getElementById('m-kpi-avail')?.addEventListener('click', () => {
      currentFilterStatus = currentFilterStatus === 'Available' ? 'all' : 'Available';
      renderHomeView();
    });
    document.getElementById('m-kpi-inuse')?.addEventListener('click', () => {
      currentFilterStatus = currentFilterStatus === 'In Use' ? 'all' : 'In Use';
      renderHomeView();
    });
    document.getElementById('m-kpi-alert')?.addEventListener('click', () => {
      currentFilterStatus = currentFilterStatus === 'Attention' ? 'all' : 'Attention';
      renderHomeView();
    });
    document.getElementById('m-kpi-reqs')?.addEventListener('click', () => switchTab('requests'));

    // Banner buttons
    document.getElementById('m-banner-filter-btn')?.addEventListener('click', () => {
      currentFilterStatus = 'Attention';
      renderHomeView();
    });
    document.getElementById('m-banner-brief-btn')?.addEventListener('click', () => switchTab('more'));

    // Product pills
    document.querySelectorAll('.m-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const ptype = pill.dataset.ptype;
        currentFilterType = currentFilterType === ptype && ptype !== 'all' ? 'all' : ptype;
        renderHomeView();
      });
    });

    // Search input
    const searchInput = document.getElementById('m-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        const clearBtn = document.getElementById('m-search-clear');
        if (clearBtn) clearBtn.classList.toggle('show', !!currentSearchQuery);
        renderHomeView();
      });
    }

    document.getElementById('m-search-clear')?.addEventListener('click', () => {
      currentSearchQuery = '';
      renderHomeView();
    });

    // Segmented status buttons
    document.querySelectorAll('.m-segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilterStatus = btn.dataset.status;
        renderHomeView();
      });
    });

    // Dept chips
    document.querySelectorAll('.m-dept-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const dept = chip.dataset.dept;
        currentFilterDept = currentFilterDept === dept && dept !== 'all' ? 'all' : dept;
        renderHomeView();
      });
    });

    // Clear filters
    const clearFilters = () => {
      currentFilterStatus = 'all';
      currentFilterDept = 'all';
      currentFilterType = 'all';
      currentSearchQuery = '';
      listLimit = 30;
      renderHomeView();
    };
    document.getElementById('m-clear-filters-btn')?.addEventListener('click', clearFilters);
    document.getElementById('m-empty-reset-btn')?.addEventListener('click', clearFilters);

    // Show more
    document.getElementById('m-btn-show-more')?.addEventListener('click', () => {
      listLimit += 30;
      renderHomeView();
    });

    // Row clicks -> open Equipment Bottom Sheet (M-09)
    document.querySelectorAll('.m-eq-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = parseInt(row.dataset.eqid, 10);
        openEquipmentSheet(id);
      });
    });
  }

  // ==========================================
  // M-09: EQUIPMENT DETAIL BOTTOM SHEET
  // ==========================================
  function openEquipmentSheet(eqId) {
    activeEqId = eqId;
    selectedSheetRoom = null;
    const state = getState();
    const eq = (state.allEquipment || []).find(e => e.id === eqId);
    if (!eq) return;

    const user = state.currentUser || { username: 'User', role: 'Staff' };
    const isAvail = eq.status === 'Available';
    const deptName = eq.departments ? eq.departments.name : 'Unknown';
    const cond = eq.condition || 'Usable';
    const isOutOfOrder = cond === 'Out of Order';
    const isHolder = eq.held_by === user.username;
    const isManager = user.role === 'Manager';
    const canRelease = !isAvail && (isHolder || isManager);
    const canRequest = !isAvail && !isHolder && user.role !== 'Manager';
    const canForceRelease = !isAvail && !isHolder && isManager;

    const deptRooms = getDeptRooms();
    const rooms = deptRooms[deptName] || ['Bed 1', 'Room 101', 'Bay 1', 'Other / Unspecified'];

    const contentHtml = `
      <div style="margin-bottom:14px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div>
            <span style="font-family:monospace; font-size:11px; padding:2px 6px; border-radius:6px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-2);">${escapeHtml(eq.qr_code_id)}</span>
            <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:17px; font-weight:700; margin-top:6px; color:var(--text);">${escapeHtml(eq.name)}</h3>
            <p style="font-size:12.5px; color:var(--text-2); margin-top:2px;">${escapeHtml(deptName)} · Condition: <strong>${escapeHtml(cond)}</strong></p>
          </div>
          <span class="m-status-badge ${isAvail ? 'avail' : 'inuse'}">
            <span class="m-status-dot" aria-hidden="true"></span>
            <span>${isAvail ? 'Available' : 'In Use'}</span>
          </span>
        </div>
      </div>

      <!-- QR Code & Sticker Section (PL-07) -->
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div id="m-sheet-qr-box" style="width:72px; height:72px; background:#fff; padding:4px; border-radius:8px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center;"></div>
          <div>
            <div style="font-size:11px; font-weight:600; color:var(--text-2);">ASSET TAG QR</div>
            <div style="font-family:monospace; font-size:13px; font-weight:700; color:var(--text);">${escapeHtml(eq.qr_code_id)}</div>
            <div style="font-size:11px; color:var(--text-2); margin-top:2px;">Scan with any ward device</div>
          </div>
        </div>
        <button id="m-sheet-print-btn" style="height:36px; padding:0 12px; border-radius:8px; background:var(--surface); border:1px solid var(--border); font-size:12px; font-weight:600; color:var(--text); cursor:pointer;">
          Print Sticker
        </button>
      </div>

      ${!isAvail ? `
        <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:14px; font-size:12.5px;">
          <div>📍 <strong>Location:</strong> ${escapeHtml(deptName)} — ${escapeHtml((state.latestCheckoutRoom && state.latestCheckoutRoom[eq.id]) || 'Ward')}</div>
          <div style="margin-top:4px;">👤 <strong>Held by:</strong> ${escapeHtml(eq.held_by || 'Unknown')}</div>
          ${eq.in_use_since ? `<div style="margin-top:4px; color:var(--text-2);">⏱ <strong>In use since:</strong> ${new Date(eq.in_use_since).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</div>` : ''}
        </div>
      ` : ''}

      ${isAvail ? `
        <!-- M-10: 1-Tap Room Chips (PL-05: NO PRE-SELECTION) -->
        <div style="margin-top:6px;">
          <div class="m-room-chips-title">Select Room / Location to Check Out:</div>
          <div class="m-room-chips-grid" id="m-sheet-room-chips" role="radiogroup" aria-label="Room selection">
            ${rooms.map(r => `
              <button class="m-room-chip" data-room="${escapeHtml(r)}" aria-pressed="false">${escapeHtml(r)}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Conflict Notice Placeholder (PL-17) -->
      <div id="m-live-conflict-notice" style="display:none;" class="m-conflict-card" role="alert"></div>
    `;

    // Footer actions
    let footerHtml = '';
    if (isAvail) {
      footerHtml = `
        <button id="m-sheet-checkout-btn" class="m-btn-approve" style="width:100%; opacity:0.5; cursor:not-allowed;" disabled>
          Select a room
        </button>
      `;
    } else {
      footerHtml = `
        ${canRelease ? `
          <button id="m-sheet-release-btn" class="m-btn-approve" style="flex:1; background:var(--danger);">
            Release Equipment
          </button>
        ` : ''}
        ${canForceRelease ? `
          <button id="m-sheet-force-release-btn" class="m-btn-reject" style="flex:1; color:var(--danger); border-color:var(--danger);">
            Force Release
          </button>
        ` : ''}
        ${canRequest ? `
          <button id="m-sheet-request-btn" class="m-btn-approve" style="flex:1;">
            Request Access
          </button>
        ` : ''}
      `;
    }

    mOpenSheet({
      id: 'equipment-detail',
      title: 'Equipment Details',
      bodyHtml: contentHtml,
      footerHtml: footerHtml,
      onMounted: () => {
        // Generate QR Code (PL-07)
        const qrBox = document.getElementById('m-sheet-qr-box');
        if (qrBox && typeof QRCode !== 'undefined') {
          try {
            new QRCode(qrBox, {
              text: eq.qr_code_id,
              width: 64,
              height: 64,
              colorDark: '#1a2332',
              colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.M
            });
          } catch (e) {
            console.warn('QR render error', e);
          }
        }

        // Print sticker handler
        document.getElementById('m-sheet-print-btn')?.addEventListener('click', () => {
          const actions = getActions();
          if (actions.openStickerModal) actions.openStickerModal(eq.id);
        });

        // Room chip selection (PL-05: No pre-selection; enable button upon choice)
        const checkoutBtn = document.getElementById('m-sheet-checkout-btn');
        document.querySelectorAll('#m-sheet-room-chips .m-room-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            selectedSheetRoom = chip.dataset.room;
            document.querySelectorAll('#m-sheet-room-chips .m-room-chip').forEach(c => {
              c.setAttribute('aria-pressed', 'false');
            });
            chip.setAttribute('aria-pressed', 'true');

            if (checkoutBtn) {
              checkoutBtn.disabled = false;
              checkoutBtn.style.opacity = '1';
              checkoutBtn.style.cursor = 'pointer';
              checkoutBtn.textContent = `Confirm Check-Out to ${selectedSheetRoom}`;
            }
          });
        });

        // Checkout action
        checkoutBtn?.addEventListener('click', async () => {
          if (!selectedSheetRoom) return;
          if (isOffline) {
            mToast('You are offline. Actions are disabled.', 'error');
            return;
          }
          checkoutBtn.disabled = true;
          checkoutBtn.textContent = 'Checking out…';
          const actions = getActions();
          if (actions.doToggle) {
            const ok = await actions.doToggle(eq, user.username, selectedSheetRoom);
            if (ok) {
              mToast(`${eq.name} checked out to ${selectedSheetRoom}`, 'success');
              mCloseSheet();
              if (actions.loadEquipment) await actions.loadEquipment();
            } else {
              checkoutBtn.disabled = false;
              checkoutBtn.textContent = `Confirm Check-Out to ${selectedSheetRoom}`;
            }
          }
        });

        // Release action
        document.getElementById('m-sheet-release-btn')?.addEventListener('click', async () => {
          if (isOffline) {
            mToast('You are offline. Actions are disabled.', 'error');
            return;
          }
          const actions = getActions();
          if (actions.doToggle) {
            const ok = await actions.doToggle(eq, user.username, null);
            if (ok) {
              mToast(`${eq.name} released and available`, 'success');
              mCloseSheet();
              if (actions.loadEquipment) await actions.loadEquipment();
            }
          }
        });

        // Force release (PL-06: Manager only, with confirm sheet)
        document.getElementById('m-sheet-force-release-btn')?.addEventListener('click', () => {
          if (isOffline) {
            mToast('You are offline. Actions are disabled.', 'error');
            return;
          }
          openConfirmSheet({
            title: `Force Release ${eq.name}?`,
            body: `This equipment is currently checked out by ${eq.held_by}. Forcing release will make it available to others immediately.`,
            confirmLabel: 'Force Release',
            isDestructive: true,
            onConfirm: async () => {
              const actions = getActions();
              if (actions.doToggle) {
                const ok = await actions.doToggle(eq, user.username, null);
                if (ok) {
                  mToast(`${eq.name} force-released by Manager`, 'success');
                  mCloseSheet();
                  if (actions.loadEquipment) await actions.loadEquipment();
                }
              }
            }
          });
        });

        // Request access (Staff / Senior Doctor)
        document.getElementById('m-sheet-request-btn')?.addEventListener('click', () => {
          mCloseSheet();
          const actions = getActions();
          if (actions.openRequestModal) actions.openRequestModal(eq.id);
        });
      }
    });
  }

  // ==========================================
  // VIEW 2: REQUESTS TAB (M-12)
  // ==========================================
  function renderRequestsView() {
    const container = document.getElementById('m-view-requests');
    if (!container) return;

    const state = getState();
    const requests = state.allRequests || [];
    const user = state.currentUser || { username: 'User', role: 'Staff' };
    const canApprove = user.role === 'Manager' || user.role === 'Senior Doctor';

    container.innerHTML = `
      <div class="m-audit-header-bar">
        <div>
          <h2 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:16px; font-weight:700; margin:0;">Pending Requests</h2>
          <p style="font-size:12px; color:var(--text-2); margin:2px 0 0;">Approve or reject equipment handover requests</p>
        </div>
        <span class="m-nav-badge" style="position:static;">${requests.length}</span>
      </div>

      <div style="padding:14px; flex:1; overflow-y:auto;">
        ${requests.length === 0 ? `
          <div style="padding:48px 16px; text-align:center; color:var(--text-2); background:var(--surface); border:1px solid var(--border); border-radius:14px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px; opacity:0.6;"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;">No pending requests</div>
            <div style="font-size:12px;">New equipment handover requests will appear here.</div>
          </div>
        ` : requests.map(r => {
          const isUrgent = r.priority === 'Urgent';
          const eqName = r.equipment ? r.equipment.name : ('Equipment #' + r.equipment_id);
          const qr = r.equipment ? r.equipment.qr_code_id : '';
          const timeStr = r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' }) : 'Recently';

          return `
            <div class="m-request-card" data-reqid="${r.id}" data-eqid="${r.equipment_id}">
              <div class="m-req-header">
                <span class="m-priority-badge ${isUrgent ? 'urgent' : 'normal'}">${isUrgent ? 'URGENT' : 'NORMAL'}</span>
                <span class="m-req-time">${timeStr}</span>
              </div>
              <div class="m-req-title">${escapeHtml(eqName)} ${qr ? `<span style="font-family:monospace; font-size:11px; color:var(--text-2); font-weight:normal;">(${escapeHtml(qr)})</span>` : ''}</div>
              <div class="m-req-meta">Requested by <strong>${escapeHtml(r.requested_by)}</strong></div>

              ${canApprove ? `
                <div class="m-req-actions">
                  <button class="m-btn-approve m-req-approve-btn" data-reqid="${r.id}" data-eqid="${r.equipment_id}" data-name="${escapeHtml(eqName)}">✓ Approve</button>
                  <button class="m-btn-reject m-req-reject-btn" data-reqid="${r.id}" data-eqid="${r.equipment_id}" data-name="${escapeHtml(eqName)}">✕ Reject</button>
                </div>
              ` : `
                <div style="font-size:11.5px; font-style:italic; color:var(--text-2); margin-top:4px;">Awaiting approval by Senior Doctor or Manager</div>
              `}
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Approve & Reject listeners
    container.querySelectorAll('.m-req-approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (isOffline) {
          mToast('You are offline. Actions are disabled.', 'error');
          return;
        }
        const reqId = parseInt(btn.dataset.reqid, 10);
        const eqId = parseInt(btn.dataset.eqid, 10);
        const name = btn.dataset.name;
        const actions = getActions();
        if (actions.updateReq) {
          btn.disabled = true;
          btn.textContent = 'Approving…';
          await actions.updateReq(reqId, 'Approved', eqId);
          mToast(`Request approved for ${name}`, 'success');
        }
      });
    });

    // Reject with confirm sheet (PL-27)
    container.querySelectorAll('.m-req-reject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isOffline) {
          mToast('You are offline. Actions are disabled.', 'error');
          return;
        }
        const reqId = parseInt(btn.dataset.reqid, 10);
        const eqId = parseInt(btn.dataset.eqid, 10);
        const name = btn.dataset.name;

        openConfirmSheet({
          title: `Reject Request for ${name}?`,
          body: `This request will be marked as rejected in the audit trail.`,
          confirmLabel: 'Reject Request',
          isDestructive: true,
          onConfirm: async () => {
            const actions = getActions();
            if (actions.updateReq) {
              await actions.updateReq(reqId, 'Rejected', eqId);
              mToast(`Request rejected for ${name}`, 'info');
            }
          }
        });
      });
    });
  }

  // ==========================================
  // VIEW 3: AUDIT TAB (M-13, PL-21)
  // ==========================================
  function renderAuditView() {
    const container = document.getElementById('m-view-audit');
    if (!container) return;

    const state = getState();
    const equipment = state.allEquipment || [];
    const auditLogs = state.allAuditLogs || {};

    // Compute summary numbers
    let totalEvents = 0;
    Object.values(auditLogs).forEach(item => {
      totalEvents += (item.entries || []).length;
    });

    const inUseNow = equipment.filter(e => e.status === 'In Use').length;

    container.innerHTML = `
      <div class="m-audit-header-bar">
        <div>
          <h2 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:16px; font-weight:700; margin:0;">Audit Trail</h2>
          <p style="font-size:12px; color:var(--text-2); margin:2px 0 0;">Real-time checkout and room history</p>
        </div>
        <button id="m-audit-export-csv" style="height:36px; padding:0 12px; border-radius:8px; background:var(--surface-2); border:1px solid var(--border); font-size:12px; font-weight:600; color:var(--text); cursor:pointer;">
          Export CSV
        </button>
      </div>

      <!-- Summary Chips -->
      <div class="m-audit-summary-chips">
        <div class="m-audit-chip">
          <span style="font-weight:700; color:var(--primary); font-size:13px;">${totalEvents}</span>
          <span style="color:var(--text-2);">Total Events</span>
        </div>
        <div class="m-audit-chip">
          <span style="font-weight:700; color:var(--danger); font-size:13px;">${inUseNow}</span>
          <span style="color:var(--text-2);">In Use Now</span>
        </div>
        <div class="m-audit-chip">
          <span style="font-weight:700; color:var(--success); font-size:13px;">${equipment.length}</span>
          <span style="color:var(--text-2);">Tracked Items</span>
        </div>
      </div>

      <!-- Equipment Audit List -->
      <div style="flex:1; overflow-y:auto;">
        ${equipment.map(eq => {
          const logData = auditLogs[eq.id] || { entries: [] };
          const entries = logData.entries || [];
          const last = entries.length > 0 ? entries[0] : null;
          const deptName = eq.departments ? eq.departments.name : 'Unknown';

          return `
            <div class="m-audit-row" data-eqid="${eq.id}">
              <div>
                <div style="font-size:14px; font-weight:600; color:var(--text);">${escapeHtml(eq.name)}</div>
                <div style="font-size:12px; color:var(--text-2); margin-top:2px;">
                  ${escapeHtml(deptName)} · ${entries.length} events ${last ? `· Last: ${escapeHtml(last.action)} by ${escapeHtml(last.performed_by || 'Unknown')}` : ''}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-2);"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Export CSV handler
    document.getElementById('m-audit-export-csv')?.addEventListener('click', async () => {
      const actions = getActions();
      if (actions.exportAuditCSV) {
        await actions.exportAuditCSV();
        mToast('Audit log CSV exported', 'success');
      }
    });

    // Per-equipment row tap -> opens event history sheet
    container.querySelectorAll('.m-audit-row').forEach(row => {
      row.addEventListener('click', () => {
        const eqId = parseInt(row.dataset.eqid, 10);
        openAuditHistorySheet(eqId);
      });
    });
  }

  function openAuditHistorySheet(eqId) {
    const state = getState();
    const eq = (state.allEquipment || []).find(e => e.id === eqId);
    if (!eq) return;

    const logData = (state.allAuditLogs && state.allAuditLogs[eqId]) || { entries: [] };
    const entries = logData.entries || [];

    const historyHtml = `
      <div style="margin-bottom:12px;">
        <span style="font-family:monospace; font-size:11px; padding:2px 6px; border-radius:6px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-2);">${escapeHtml(eq.qr_code_id)}</span>
        <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:16px; font-weight:700; margin-top:4px;">${escapeHtml(eq.name)}</h3>
        <p style="font-size:12px; color:var(--text-2); margin-top:2px;">Event History (${entries.length} records)</p>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${entries.length === 0 ? `
          <div style="padding:24px; text-align:center; color:var(--text-2); font-size:13px;">No recorded events for this item.</div>
        ` : entries.map(e => `
          <div style="padding:10px 12px; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:700; color:var(--text);">${escapeHtml(e.action)}</span>
              <span style="font-size:11px; color:var(--text-2);">${e.timestamp ? new Date(e.timestamp).toLocaleString([], { dateStyle:'short', timeStyle:'short' }) : ''}</span>
            </div>
            <div style="color:var(--text-2); font-size:12px;">
              By <strong>${escapeHtml(e.performed_by || 'Unknown')}</strong> ${e.room ? `· 📍 Location: <strong>${escapeHtml(e.room)}</strong>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    mOpenSheet({
      id: 'audit-history',
      title: 'Item History',
      bodyHtml: historyHtml,
      footerHtml: `
        <button onclick="window.MediTrackMobile.closeSheet()" style="width:100%; height:44px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); font-weight:600; font-size:13px; cursor:pointer;">
          Close
        </button>
      `
    });
  }

  // ==========================================
  // VIEW 4: MORE TAB (M-16, M-17, PL-08, PL-10)
  // ==========================================
  function renderMoreView() {
    const container = document.getElementById('m-view-more');
    if (!container) return;

    const state = getState();
    const user = state.currentUser || { username: 'User', role: 'Staff' };
    const initials = (user.username || 'U').slice(0, 2).toUpperCase();
    const isManager = user.role === 'Manager';
    const isDoctor = user.role === 'Senior Doctor';
    const equipment = state.allEquipment || [];
    const depts = state.departments || [];

    // Department availability calculation (PL-11)
    const deptRowsHtml = depts.map(d => {
      const deptEq = equipment.filter(e => String(e.department_id) === String(d.id) || (e.departments && e.departments.name === d.name));
      const total = deptEq.length;
      const available = deptEq.filter(e => e.status === 'Available' && (!e.condition || e.condition === 'Usable')).length;
      const pct = total > 0 ? Math.round((available / total) * 100) : 0;

      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
            <span style="font-weight:600; color:var(--text);">${escapeHtml(d.name)} (${total} items)</span>
            <span style="font-weight:600; color:var(--success);">${available} of ${total} available</span>
          </div>
          <div style="height:6px; border-radius:999px; background:var(--surface-2); overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:var(--primary); border-radius:999px;"></div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="padding:14px 0; overflow-y:auto;">
        <!-- 1. Account Card (M-16, PL-08) -->
        <div class="m-card">
          <div class="m-account-row">
            <div class="m-account-info">
              <div class="m-account-avatar">${escapeHtml(initials)}</div>
              <div>
                <div class="m-account-name">${escapeHtml(user.username)}</div>
                <div style="font-size:12px; color:var(--text-2); margin-top:2px;">Role: <strong>${escapeHtml(user.role)}</strong></div>
              </div>
            </div>

            <div class="m-account-actions">
              <button class="m-btn-theme-toggle" id="m-more-theme-btn" aria-label="Toggle dark mode">
                <span>🌙</span>
                <span>Theme</span>
              </button>
              <button class="m-btn-logout" id="m-more-logout-btn">Log out</button>
            </div>
          </div>
        </div>

        <!-- 2. AI Operations Insights (PL-10) -->
        <div class="m-card">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; font-weight:700; margin:0; color:var(--text);">AI Clinical Insights</h3>
            <span style="font-size:11px; font-weight:600; color:var(--primary); background:var(--primary-tint); padding:2px 8px; border-radius:10px;">Operations</span>
          </div>
          <p style="font-size:12.5px; color:var(--text-2); line-height:1.45; margin-bottom:12px;">
            Daily briefing automatically analyzes overnight holds, idle equipment, and urgent ward requirements.
          </p>

          ${isManager ? `
            <div style="border-top:1px solid var(--border); padding-top:10px; display:flex; gap:8px;">
              <button id="m-btn-run-weekly" style="flex:1; height:40px; border-radius:10px; background:var(--primary); color:#fff; border:none; font-size:12.5px; font-weight:600; cursor:pointer;">
                Run Weekly Analysis
              </button>
            </div>
          ` : ''}
        </div>

        <!-- 3. Department Availability (PL-11) -->
        <div class="m-card">
          <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; font-weight:700; margin:0 0 12px 0; color:var(--text);">Department Availability</h3>
          ${deptRowsHtml}
        </div>

        <!-- 4. Manager Tools (M-17, PL-09) -->
        ${isManager ? `
          <div class="m-card">
            <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; font-weight:700; margin:0 0 10px 0; color:var(--text);">Manager Controls</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
              <button id="m-mgr-add-product" style="padding:12px; border-radius:12px; background:var(--surface-2); border:1px solid var(--border); text-align:left; cursor:pointer;">
                <div style="font-size:16px; margin-bottom:2px;">➕</div>
                <div style="font-size:13px; font-weight:700; color:var(--text);">Add Product</div>
                <div style="font-size:11px; color:var(--text-2);">Auto QR asset tag</div>
              </button>

              <button id="m-mgr-print-stickers" style="padding:12px; border-radius:12px; background:var(--surface-2); border:1px solid var(--border); text-align:left; cursor:pointer;">
                <div style="font-size:16px; margin-bottom:2px;">🖨️</div>
                <div style="font-size:13px; font-weight:700; color:var(--text);">Print Stickers</div>
                <div style="font-size:11px; color:var(--text-2);">${equipment.length} labels</div>
              </button>
            </div>

            <button id="m-mgr-manage-users" style="width:100%; height:44px; border-radius:12px; background:var(--primary-tint); border:1px solid var(--primary); color:var(--primary); font-size:13px; font-weight:700; cursor:pointer;">
              Manage Staff & Users →
            </button>
          </div>
        ` : ''}

        <!-- 5. Classic View Switch -->
        <div style="padding:12px 14px; text-align:center;">
          <button id="m-btn-switch-classic" style="background:none; border:none; color:var(--primary); font-size:12.5px; font-weight:600; text-decoration:underline; cursor:pointer;">
            Switch to classic (desktop) view
          </button>
        </div>
      </div>
    `;

    // Theme toggle
    document.getElementById('m-more-theme-btn')?.addEventListener('click', () => {
      const actions = getActions();
      if (actions.cycleTheme) actions.cycleTheme();
    });

    // Logout
    document.getElementById('m-more-logout-btn')?.addEventListener('click', () => {
      const actions = getActions();
      if (actions.doLogout) actions.doLogout();
    });

    // Weekly analysis
    document.getElementById('m-btn-run-weekly')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-run-weekly');
      if (btn) btn.click();
      mToast('Weekly analysis initiated', 'info');
    });

    // Add product
    document.getElementById('m-mgr-add-product')?.addEventListener('click', () => {
      const actions = getActions();
      if (actions.openAddEquipmentModal) actions.openAddEquipmentModal();
    });

    // Print stickers
    document.getElementById('m-mgr-print-stickers')?.addEventListener('click', () => {
      const actions = getActions();
      if (actions.openPrintAllModal) actions.openPrintAllModal();
    });

    // Manage users sheet
    document.getElementById('m-mgr-manage-users')?.addEventListener('click', () => {
      openManageUsersSheet();
    });

    // Classic view switch
    document.getElementById('m-btn-switch-classic')?.addEventListener('click', () => {
      try {
        localStorage.setItem('meditrack.classicView', '1');
      } catch (e) {}
      window.location.reload();
    });
  }

  // ==========================================
  // M-17: MANAGE USERS SHEET (MANAGER ONLY)
  // ==========================================
  let mUsersFilterStatus = 'all'; // 'all' | 'active' | 'inactive'
  let mUsersSearchQuery = '';

  async function openManageUsersSheet() {
    const state = getState();
    const currentUser = state.currentUser;
    if (!currentUser || currentUser.role !== 'Manager') {
      mToast('Only managers can access user management.', 'error');
      return;
    }

    const actions = getActions();

    let cached = state.cachedUsers || window.cachedUsers || [];
    const isLoading = (!cached || cached.length === 0);

    const renderUsersContent = (usersList) => {
      const q = mUsersSearchQuery.toLowerCase().trim();
      const allCount = usersList.length;
      const actCount = usersList.filter(u => u.is_active).length;
      const inactCount = usersList.filter(u => !u.is_active).length;

      const filtered = usersList.filter(u => {
        const matchStatus = mUsersFilterStatus === 'all' || (mUsersFilterStatus === 'active' ? u.is_active : !u.is_active);
        const matchSearch = !q ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.role && u.role.toLowerCase().includes(q)) ||
          (u.departments && u.departments.name && u.departments.name.toLowerCase().includes(q));
        return matchStatus && matchSearch;
      });

      return `
        <!-- Top bar with Count + Create button -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:16px; font-weight:700; margin:0; color:var(--text);">Staff & Users (${allCount})</h3>
            <div style="font-size:12px; color:var(--text-2); margin-top:2px;">Manage system accounts and access</div>
          </div>
          <button id="m-btn-create-user" style="height:36px; padding:0 12px; border-radius:8px; background:var(--primary); color:#fff; border:none; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
            <span>+</span> Create User
          </button>
        </div>

        <!-- Search input -->
        <div style="position:relative; margin-bottom:10px;">
          <input type="search" id="m-users-search" placeholder="Search staff by name or role…" value="${escapeHtml(mUsersSearchQuery)}" style="width:100%; height:40px; padding:0 12px 0 34px; border-radius:10px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:13.5px; box-sizing:border-box;">
          <svg style="position:absolute; left:10px; top:12px; width:16px; height:16px; color:var(--text-2); pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>

        <!-- Segmented Filter (All, Active, Inactive) -->
        <div style="display:flex; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:3px; margin-bottom:14px;">
          <button type="button" class="m-user-filter-btn" data-status="all" style="flex:1; height:32px; border:none; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; background:${mUsersFilterStatus === 'all' ? 'var(--primary)' : 'transparent'}; color:${mUsersFilterStatus === 'all' ? '#fff' : 'var(--text-2)'}; transition:all 0.15s ease;">
            All (${allCount})
          </button>
          <button type="button" class="m-user-filter-btn" data-status="active" style="flex:1; height:32px; border:none; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; background:${mUsersFilterStatus === 'active' ? 'var(--primary)' : 'transparent'}; color:${mUsersFilterStatus === 'active' ? '#fff' : 'var(--text-2)'}; transition:all 0.15s ease;">
            Active (${actCount})
          </button>
          <button type="button" class="m-user-filter-btn" data-status="inactive" style="flex:1; height:32px; border:none; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; background:${mUsersFilterStatus === 'inactive' ? 'var(--primary)' : 'transparent'}; color:${mUsersFilterStatus === 'inactive' ? '#fff' : 'var(--text-2)'}; transition:all 0.15s ease;">
            Inactive (${inactCount})
          </button>
        </div>

        <!-- Users List -->
        <div id="m-users-list" style="display:flex; flex-direction:column; gap:8px;">
          ${filtered.length === 0 ? `
            <div style="padding:32px 16px; text-align:center; color:var(--text-2); background:var(--surface-2); border:1px solid var(--border); border-radius:12px;">
              <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;">No users found</div>
              <div style="font-size:12px;">No accounts match your search or filter.</div>
            </div>
          ` : filtered.map(u => {
            const isSelf = u.id === currentUser.id;
            const deptName = u.departments ? u.departments.name : '—';
            const roleKey = (u.role || '').toLowerCase();
            const roleClass = roleKey.includes('doctor') ? 'doctor' : (roleKey.includes('manager') ? 'manager' : 'staff');

            return `
              <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
                <div style="flex:1; min-width:0; padding-right:10px;">
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    <span style="font-size:14px; font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(u.username)}</span>
                    ${isSelf ? '<span style="font-size:11px; color:var(--primary); font-weight:700; background:var(--primary-tint); padding:1px 6px; border-radius:6px;">You</span>' : ''}
                  </div>
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:11.5px; color:var(--text-2);">
                    <span class="m-role-pill ${roleClass}">${escapeHtml(u.role)}</span>
                    <span>·</span>
                    <span>${escapeHtml(deptName)}</span>
                    <span>·</span>
                    <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:1px 6px; border-radius:6px; background:${u.is_active ? 'var(--success-tint)' : 'var(--surface)'}; color:${u.is_active ? 'var(--success)' : 'var(--text-2)'}; border:1px solid ${u.is_active ? 'transparent' : 'var(--border)'};">
                      <span style="width:5px; height:5px; border-radius:50%; background:currentColor;"></span>
                      ${u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                ${!isSelf ? `
                  <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button class="m-user-reset-btn" data-userid="${u.id}" data-username="${escapeHtml(u.username)}" style="height:32px; padding:0 10px; border-radius:8px; background:var(--surface); border:1px solid var(--border); color:var(--text); font-size:11.5px; font-weight:600; cursor:pointer;" aria-label="Reset password for ${escapeHtml(u.username)}">
                      Reset
                    </button>
                    <button class="m-user-toggle-btn" data-userid="${u.id}" data-username="${escapeHtml(u.username)}" data-active="${u.is_active}" style="height:32px; padding:0 10px; border-radius:8px; background:var(--surface); border:1px solid var(--border); font-size:11.5px; font-weight:600; cursor:pointer; color:${u.is_active ? 'var(--danger)' : 'var(--success)'};" aria-label="${u.is_active ? 'Deactivate' : 'Reactivate'} ${escapeHtml(u.username)}">
                      ${u.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    };

    const attachSheetListeners = (currentList) => {
      // Filter segmented buttons
      document.querySelectorAll('.m-user-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          mUsersFilterStatus = btn.dataset.status;
          const bodyEl = document.getElementById('m-sheet-body-content');
          if (bodyEl) {
            bodyEl.innerHTML = renderUsersContent(currentList);
            attachSheetListeners(currentList);
          }
        });
      });

      // Search input
      const searchInput = document.getElementById('m-users-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          mUsersSearchQuery = e.target.value;
          const bodyEl = document.getElementById('m-sheet-body-content');
          if (bodyEl) {
            bodyEl.innerHTML = renderUsersContent(currentList);
            attachSheetListeners(currentList);
            const newSearch = document.getElementById('m-users-search');
            if (newSearch) {
              newSearch.focus();
              newSearch.setSelectionRange(mUsersSearchQuery.length, mUsersSearchQuery.length);
            }
          }
        });
      }

      // Create user button
      document.getElementById('m-btn-create-user')?.addEventListener('click', () => {
        openCreateUserSheet();
      });

      // Reset password button
      document.querySelectorAll('.m-user-reset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = parseInt(btn.dataset.userid, 10);
          const uname = btn.dataset.username;
          openResetPasswordSheet(uid, uname);
        });
      });

      // Toggle active / deactive button
      document.querySelectorAll('.m-user-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = parseInt(btn.dataset.userid, 10);
          const uname = btn.dataset.username;
          const isActive = btn.dataset.active === 'true';

          openConfirmSheet({
            title: `${isActive ? 'Deactivate' : 'Reactivate'} ${uname}?`,
            body: isActive ? 'They will no longer be able to sign in. You can reactivate them at any time.' : 'They will regain access to sign in.',
            confirmLabel: isActive ? 'Deactivate' : 'Reactivate',
            isDestructive: isActive,
            onConfirm: async () => {
              if (actions.toggleUserActive) {
                await actions.toggleUserActive(uid, !isActive);
                const updated = getState().cachedUsers || window.cachedUsers || [];
                const bodyEl = document.getElementById('m-sheet-body-content');
                if (bodyEl) {
                  bodyEl.innerHTML = renderUsersContent(updated);
                  attachSheetListeners(updated);
                }
              }
            }
          });
        });
      });
    };

    // Open sheet
    mOpenSheet({
      id: 'manage-users',
      title: 'Manage Users',
      bodyHtml: isLoading ? `
        <div style="padding:32px 16px; text-align:center; color:var(--text-2);">
          <div style="font-size:24px; margin-bottom:8px;">⏳</div>
          <div style="font-size:14px; font-weight:600; color:var(--text);">Loading users…</div>
        </div>
      ` : renderUsersContent(cached),
      footerHtml: `
        <button onclick="window.MediTrackMobile.closeSheet()" style="width:100%; height:44px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); font-weight:600; font-size:13px; cursor:pointer;">
          Done
        </button>
      `,
      onMounted: async () => {
        if (!isLoading) {
          attachSheetListeners(cached);
        }
        // Always ensure fresh user list from DB
        if (actions.loadUsersTable) {
          const fresh = await actions.loadUsersTable();
          const list = (fresh && fresh.length) ? fresh : (getState().cachedUsers || window.cachedUsers || []);
          const bodyEl = document.getElementById('m-sheet-body-content');
          if (bodyEl) {
            bodyEl.innerHTML = renderUsersContent(list);
            attachSheetListeners(list);
          }
        }
      }
    });
  }

  // ==========================================
  // CREATE USER SHEET (M-17 SUB-SCREEN)
  // ==========================================
  function openCreateUserSheet() {
    const state = getState();
    const depts = state.departments || [];
    const actions = getActions();

    const bodyHtml = `
      <form id="m-form-create-user" style="display:flex; flex-direction:column; gap:14px;" onsubmit="return false;">
        <div>
          <label for="m-new-username" style="display:block; font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:6px;">Username *</label>
          <input type="text" id="m-new-username" autocomplete="off" placeholder="e.g. nurse.sarah" style="width:100%; height:44px; padding:0 12px; border-radius:10px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:16px; box-sizing:border-box;">
          <div id="m-new-user-error" style="font-size:11.5px; color:var(--danger); margin-top:4px; display:none;"></div>
        </div>

        <div>
          <label for="m-new-role" style="display:block; font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:6px;">Role *</label>
          <select id="m-new-role" style="width:100%; height:44px; padding:0 12px; border-radius:10px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:16px; box-sizing:border-box;">
            <option value="Staff">Staff</option>
            <option value="Senior Doctor">Senior Doctor</option>
            <option value="Manager">Manager</option>
          </select>
          <div id="m-role-helper" style="font-size:11.5px; color:var(--text-2); margin-top:4px;">Can check equipment in and out.</div>
        </div>

        <div>
          <label for="m-new-dept" style="display:block; font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:6px;">Department</label>
          <select id="m-new-dept" style="width:100%; height:44px; padding:0 12px; border-radius:10px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:16px; box-sizing:border-box;">
            <option value="">— No Department —</option>
            ${depts.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>

        <div style="background:var(--primary-tint); border:1px solid var(--border); border-radius:10px; padding:10px 12px; font-size:12px; color:var(--text-2);">
          💡 A temporary password will be auto-generated and shown once upon creation.
        </div>
      </form>
    `;

    const footerHtml = `
      <div style="display:flex; gap:10px; width:100%;">
        <button id="m-create-user-cancel" style="flex:1; height:44px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); font-weight:600; font-size:13.5px; cursor:pointer;">
          Cancel
        </button>
        <button id="m-create-user-submit" disabled style="flex:1; height:44px; border-radius:10px; background:var(--primary); border:none; color:#fff; font-weight:700; font-size:13.5px; cursor:pointer; opacity:0.5;">
          Create User
        </button>
      </div>
    `;

    mOpenSheet({
      id: 'create-user',
      title: 'Create User',
      bodyHtml,
      footerHtml,
      onMounted: () => {
        const usernameInput = document.getElementById('m-new-username');
        const roleSelect = document.getElementById('m-new-role');
        const deptSelect = document.getElementById('m-new-dept');
        const roleHelper = document.getElementById('m-role-helper');
        const submitBtn = document.getElementById('m-create-user-submit');
        const cancelBtn = document.getElementById('m-create-user-cancel');
        const errorDiv = document.getElementById('m-new-user-error');

        roleSelect?.addEventListener('change', () => {
          const role = roleSelect.value;
          if (role === 'Manager') {
            roleHelper.textContent = 'Full access, including user management and equipment catalog.';
          } else if (role === 'Senior Doctor') {
            roleHelper.textContent = 'Can request equipment and view department activity.';
          } else {
            roleHelper.textContent = 'Can check equipment in and out.';
          }
        });

        usernameInput?.addEventListener('input', () => {
          const val = usernameInput.value.trim();
          if (errorDiv) errorDiv.style.display = 'none';
          if (val.length >= 3) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
          }
        });

        cancelBtn?.addEventListener('click', () => {
          openManageUsersSheet();
        });

        submitBtn?.addEventListener('click', async () => {
          const username = usernameInput.value.trim();
          const role = roleSelect.value;
          const deptId = deptSelect.value;

          if (username.length < 3) {
            if (errorDiv) {
              errorDiv.textContent = 'Username must be at least 3 characters.';
              errorDiv.style.display = 'block';
            }
            return;
          }

          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating user…';

          try {
            if (!actions.createUserAccount) {
              throw new Error('User creation is not available.');
            }
            const result = await actions.createUserAccount(username, role, deptId);
            openUserCreatedSuccessSheet(result.username, result.tempPw);
          } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create User';
            if (errorDiv) {
              errorDiv.textContent = err.message || 'Failed to create user.';
              errorDiv.style.display = 'block';
            }
            mToast(err.message || 'Failed to create user.', 'error');
          }
        });

        usernameInput?.focus();
      }
    });
  }

  // ==========================================
  // TEMPORARY PASSWORD DISPLAY SHEET (M-17 SUB-SCREEN)
  // ==========================================
  function openUserCreatedSuccessSheet(username, tempPw) {
    const bodyHtml = `
      <div style="text-align:center; padding:12px 0;">
        <div style="width:48px; height:48px; border-radius:50%; background:var(--success-tint); color:var(--success); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; font-size:24px;">✓</div>
        <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:17px; font-weight:700; margin:0 0 6px; color:var(--text);">User Created Successfully</h3>
        <p style="font-size:13px; color:var(--text-2); margin:0 0 16px;"><strong>${escapeHtml(username)}</strong> has been added to MediTrack.</p>

        <div style="background:var(--surface-2); border:1.5px dashed var(--primary); border-radius:12px; padding:16px; margin-bottom:12px;">
          <div style="font-size:11px; text-transform:uppercase; font-weight:700; letter-spacing:0.5px; color:var(--primary); margin-bottom:6px;">Temporary Password</div>
          <div id="m-temp-pw-text" style="font-family:monospace; font-size:22px; font-weight:700; color:var(--text); letter-spacing:1px; user-select:all;">${escapeHtml(tempPw)}</div>
        </div>

        <button id="m-btn-copy-temp-pw" style="width:100%; height:44px; border-radius:10px; background:var(--primary); color:#fff; border:none; font-size:13.5px; font-weight:700; cursor:pointer; margin-bottom:12px; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
          <span>📋</span> <span id="m-copy-pw-label">Copy Temporary Password</span>
        </button>

        <p style="font-size:11.5px; color:var(--text-2); margin:0; line-height:1.4;">
          ⚠️ Share this password once with the user — it will not be shown again.
        </p>
      </div>
    `;

    const footerHtml = `
      <button id="m-success-done" style="width:100%; height:44px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); font-weight:600; font-size:13.5px; cursor:pointer;">
        Done & Return to Users
      </button>
    `;

    mOpenSheet({
      id: 'user-created-success',
      title: 'Temporary Password',
      bodyHtml,
      footerHtml,
      onMounted: () => {
        document.getElementById('m-btn-copy-temp-pw')?.addEventListener('click', () => {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(tempPw);
          } else {
            const ta = document.createElement('textarea');
            ta.value = tempPw;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
          }
          const label = document.getElementById('m-copy-pw-label');
          if (label) label.textContent = 'Copied to Clipboard!';
          mToast('Temporary password copied!', 'success');
        });

        document.getElementById('m-success-done')?.addEventListener('click', () => {
          openManageUsersSheet();
        });
      }
    });
  }

  // ==========================================
  // RESET PASSWORD SHEET (M-17 SUB-SCREEN)
  // ==========================================
  function openResetPasswordSheet(userId, username) {
    const actions = getActions();

    const bodyHtml = `
      <form id="m-form-reset-pw" style="display:flex; flex-direction:column; gap:14px;" onsubmit="return false;">
        <div>
          <div style="font-size:13.5px; color:var(--text-2); margin-bottom:12px;">
            Set a new password for <strong>${escapeHtml(username)}</strong>.
          </div>
          <label for="m-reset-pw-input" style="display:block; font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:6px;">New Password (min 6 chars) *</label>
          <div style="position:relative;">
            <input type="text" id="m-reset-pw-input" placeholder="Enter new password…" style="width:100%; height:44px; padding:0 12px; border-radius:10px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:16px; box-sizing:border-box;">
          </div>
          <div id="m-reset-pw-error" style="font-size:11.5px; color:var(--danger); margin-top:4px; display:none;"></div>
        </div>

        <button type="button" id="m-btn-generate-pw" style="height:36px; padding:0 12px; border-radius:8px; background:var(--surface-2); border:1px solid var(--border); color:var(--primary); font-size:12.5px; font-weight:600; cursor:pointer; align-self:flex-start;">
          ⚡ Generate Random Password
        </button>
      </form>
    `;

    const footerHtml = `
      <div style="display:flex; gap:10px; width:100%;">
        <button id="m-reset-pw-cancel" style="flex:1; height:44px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); font-weight:600; font-size:13.5px; cursor:pointer;">
          Cancel
        </button>
        <button id="m-reset-pw-submit" disabled style="flex:1; height:44px; border-radius:10px; background:var(--primary); border:none; color:#fff; font-weight:700; font-size:13.5px; cursor:pointer; opacity:0.5;">
          Save Password
        </button>
      </div>
    `;

    mOpenSheet({
      id: 'reset-user-password',
      title: 'Reset Password',
      bodyHtml,
      footerHtml,
      onMounted: () => {
        const pwInput = document.getElementById('m-reset-pw-input');
        const genBtn = document.getElementById('m-btn-generate-pw');
        const submitBtn = document.getElementById('m-reset-pw-submit');
        const cancelBtn = document.getElementById('m-reset-pw-cancel');
        const errorDiv = document.getElementById('m-reset-pw-error');

        const validate = () => {
          const val = pwInput.value;
          if (errorDiv) errorDiv.style.display = 'none';
          if (val.length >= 6) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
          }
        };

        pwInput?.addEventListener('input', validate);

        genBtn?.addEventListener('click', () => {
          const array = new Uint32Array(2);
          window.crypto.getRandomValues(array);
          const generated = 'Tmp' + array[0].toString(36) + '!';
          pwInput.value = generated;
          validate();
        });

        cancelBtn?.addEventListener('click', () => {
          openManageUsersSheet();
        });

        submitBtn?.addEventListener('click', async () => {
          const newPw = pwInput.value;
          if (newPw.length < 6) {
            if (errorDiv) {
              errorDiv.textContent = 'Password must be at least 6 characters.';
              errorDiv.style.display = 'block';
            }
            return;
          }

          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving…';

          try {
            if (!actions.resetUserPasswordDirect) {
              throw new Error('Password reset is not available.');
            }
            await actions.resetUserPasswordDirect(userId, newPw);
            mToast(`Password updated for ${username}`, 'success');
            openUserCreatedSuccessSheet(username, newPw);
          } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Password';
            if (errorDiv) {
              errorDiv.textContent = err.message || 'Failed to reset password.';
              errorDiv.style.display = 'block';
            }
            mToast(err.message || 'Failed to reset password.', 'error');
          }
        });

        pwInput?.focus();
      }
    });
  }

  // ==========================================
  // M-11: SCANNER FLOW
  // ==========================================
  function openScannerFlow() {
    if (isOffline) {
      mToast('Camera scan disabled while offline.', 'error');
      return;
    }

    const scannerHtml = `
      <div class="m-viewfinder-wrap">
        <div id="m-scanner-mount"></div>
        <div class="m-scan-frame-target">
          <div class="m-scan-laser-line"></div>
        </div>
        <div class="m-viewfinder-overlay">
          <span>Rear Camera</span>
          <button class="m-torch-btn" id="m-torch-btn" style="display:none;">🔦 Torch</button>
        </div>
      </div>

      <!-- Manual code input fallback -->
      <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:12px;">
        <label for="m-manual-code-input" style="font-size:11px; font-weight:600; color:var(--text-2); display:block; margin-bottom:6px;">OR ENTER CODE MANUALLY:</label>
        <div style="display:flex; gap:8px;">
          <input type="text" id="m-manual-code-input" placeholder="e.g. MT-OT-001" style="flex:1; height:40px; padding:0 10px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-family:monospace; text-transform:uppercase;">
          <button id="m-manual-code-submit" style="height:40px; padding:0 14px; border-radius:8px; background:var(--primary); color:#fff; border:none; font-weight:700; font-size:12px; cursor:pointer;">Submit</button>
        </div>
      </div>

      <div id="m-scanner-feedback" style="display:none;" class="m-conflict-card"></div>
    `;

    mOpenSheet({
      id: 'qr-scanner',
      title: 'Scan Equipment QR',
      bodyHtml: scannerHtml,
      footerHtml: `
        <button id="m-close-scanner-btn" style="width:100%; height:44px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); font-weight:600; font-size:13px; cursor:pointer;">
          Close Scanner
        </button>
      `,
      onMounted: () => {
        document.getElementById('m-close-scanner-btn')?.addEventListener('click', () => mCloseSheet());

        // Manual code submit
        const manualInput = document.getElementById('m-manual-code-input');
        document.getElementById('m-manual-code-submit')?.addEventListener('click', () => {
          const val = (manualInput?.value || '').trim();
          if (val) handleScannedCode(val);
        });

        // Start real camera scanner (PL-20)
        startMobileCamera();
      },
      onClose: () => {
        stopMobileCamera();
      }
    });
  }

  function startMobileCamera() {
    if (typeof Html5Qrcode === 'undefined') {
      showScannerError('Camera scanner library not loaded. Please enter code manually.');
      return;
    }

    try {
      mobileScanner = new Html5Qrcode('m-scanner-mount');
      scannerActive = true;

      mobileScanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w, h) => {
            const s = Math.floor(Math.min(w, h) * 0.7);
            return { width: s, height: s };
          }
        },
        (decodedText) => {
          handleScannedCode(decodedText);
        },
        () => {}
      ).then(() => {
        // Check for torch capability
        try {
          const track = mobileScanner.videoElement?.srcObject?.getVideoTracks()?.[0];
          if (track && track.getCapabilities && track.getCapabilities().torch) {
            currentTorchTrack = track;
            const torchBtn = document.getElementById('m-torch-btn');
            if (torchBtn) {
              torchBtn.style.display = 'inline-flex';
              torchBtn.onclick = () => {
                torchOn = !torchOn;
                track.applyConstraints({ advanced: [{ torch: torchOn }] });
                torchBtn.textContent = torchOn ? '🔦 Torch On' : '🔦 Torch Off';
              };
            }
          }
        } catch (e) {}
      }).catch(err => {
        showScannerError('Camera permission denied or camera unavailable. Please enter code manually.');
        scannerActive = false;
      });
    } catch (e) {
      showScannerError('Camera initialization failed. Please use manual entry.');
    }
  }

  function stopMobileCamera() {
    if (mobileScanner && scannerActive) {
      mobileScanner.stop().then(() => {
        mobileScanner.clear();
        mobileScanner = null;
        scannerActive = false;
      }).catch(() => {
        mobileScanner = null;
        scannerActive = false;
      });
    }
    currentTorchTrack = null;
    torchOn = false;
  }

  function showScannerError(msg) {
    const feedback = document.getElementById('m-scanner-feedback');
    if (feedback) {
      feedback.style.display = 'block';
      feedback.innerHTML = `<div class="m-conflict-title">Camera Notice</div><div>${escapeHtml(msg)}</div>`;
    }
  }

  function handleScannedCode(qrCode) {
    stopMobileCamera();
    mCloseSheet();

    const state = getState();
    const cleanCode = qrCode.trim().toUpperCase();
    const eq = (state.allEquipment || []).find(e => (e.qr_code_id || '').toUpperCase() === cleanCode);

    if (!eq) {
      mToast(`No equipment found matching code "${cleanCode}"`, 'error');
      return;
    }

    if (navigator.vibrate) navigator.vibrate(15);
    openEquipmentSheet(eq.id);
  }

  // ==========================================
  // SHARED BOTTOM SHEET SYSTEM (M-14, PL-15)
  // ==========================================
  function mOpenSheet({ id, title, bodyHtml, footerHtml, onMounted, onClose }) {
    closeAllSheets(false);

    let backdrop = document.getElementById('m-sheet-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'm-sheet-backdrop';
      backdrop.className = 'm-sheet-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      document.body.appendChild(backdrop);
    }

    backdrop.innerHTML = `
      <div class="m-sheet" id="m-sheet-${id}">
        <div class="m-sheet-grabber-wrap" id="m-sheet-grabber">
          <div class="m-sheet-grabber"></div>
        </div>
        <div class="m-sheet-header">
          <div class="m-sheet-title">${escapeHtml(title)}</div>
          <button class="m-sheet-close-btn" id="m-sheet-close" aria-label="Close sheet">✕</button>
        </div>
        <div class="m-sheet-body" id="m-sheet-body-content">
          ${bodyHtml}
        </div>
        ${footerHtml ? `<div class="m-sheet-footer">${footerHtml}</div>` : ''}
      </div>
    `;

    // Lock body scroll (iOS-safe)
    previousFocusEl = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Android / browser Back button handling
    try {
      history.pushState({ mSheet: id }, '');
      historyPushed = true;
    } catch (e) {}

    backdrop.classList.add('open');
    activeSheet = { id, onClose };

    // Close handlers
    document.getElementById('m-sheet-close')?.addEventListener('click', () => mCloseSheet());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) mCloseSheet();
    });

    if (onMounted) onMounted();

    // Trap focus inside sheet
    const focusable = backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) focusable[0].focus();
  }

  function mCloseSheet() {
    if (!activeSheet) return;

    if (activeSheet.onClose) {
      activeSheet.onClose();
    }

    const backdrop = document.getElementById('m-sheet-backdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      backdrop.innerHTML = '';
    }

    // Restore body scroll
    document.body.style.overflow = '';
    if (previousFocusEl && previousFocusEl.focus) {
      previousFocusEl.focus();
    }

    if (historyPushed) {
      historyPushed = false;
      try {
        if (history.state && history.state.mSheet) {
          history.back();
        }
      } catch (e) {}
    }

    activeSheet = null;
    activeEqId = null;
  }

  function closeAllSheets(navigateBack = true) {
    if (activeSheet) {
      if (activeSheet.onClose) activeSheet.onClose();
      activeSheet = null;
    }
    const backdrop = document.getElementById('m-sheet-backdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      backdrop.innerHTML = '';
    }
    const confirmBackdrop = document.getElementById('m-confirm-backdrop');
    if (confirmBackdrop) {
      confirmBackdrop.classList.remove('open');
      confirmBackdrop.innerHTML = '';
    }
    document.body.style.overflow = '';
  }

  // ==========================================
  // M-15: CONFIRM SHEET
  // ==========================================
  function openConfirmSheet({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', isDestructive = false, onConfirm }) {
    let backdrop = document.getElementById('m-confirm-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'm-confirm-backdrop';
      backdrop.className = 'm-sheet-backdrop m-confirm-backdrop';
      backdrop.style.zIndex = '65';
      backdrop.setAttribute('role', 'alertdialog');
      backdrop.setAttribute('aria-modal', 'true');
      document.body.appendChild(backdrop);
    }

    backdrop.innerHTML = `
      <div class="m-sheet" style="max-height:50vh;">
        <div class="m-sheet-grabber-wrap">
          <div class="m-sheet-grabber"></div>
        </div>
        <div class="m-sheet-header">
          <div class="m-sheet-title">${escapeHtml(title)}</div>
          <button class="m-sheet-close-btn" id="m-confirm-close">✕</button>
        </div>
        <div class="m-sheet-body" style="font-size:13.5px; color:var(--text-2); line-height:1.5;">
          ${escapeHtml(body)}
        </div>
        <div class="m-sheet-footer">
          <button id="m-confirm-cancel" style="flex:1; height:44px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); font-weight:600; font-size:13px; cursor:pointer;">
            ${escapeHtml(cancelLabel)}
          </button>
          <button id="m-confirm-ok" style="flex:1; height:44px; border-radius:10px; background:${isDestructive ? 'var(--danger)' : 'var(--primary)'}; color:#fff; border:none; font-weight:700; font-size:13px; cursor:pointer;">
            ${escapeHtml(confirmLabel)}
          </button>
        </div>
      </div>
    `;

    backdrop.classList.add('open');

    const closeConfirm = () => {
      backdrop.classList.remove('open');
      backdrop.innerHTML = '';
    };

    document.getElementById('m-confirm-close')?.addEventListener('click', closeConfirm);
    document.getElementById('m-confirm-cancel')?.addEventListener('click', closeConfirm);
    document.getElementById('m-confirm-ok')?.addEventListener('click', async () => {
      closeConfirm();
      if (onConfirm) await onConfirm();
    });
  }

  // ==========================================
  // M-18: TOAST SYSTEM (PL-14)
  // ==========================================
  function mToast(msg, type = 'info') {
    let container = document.getElementById('m-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'm-toast-container';
      container.className = 'm-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `m-toast ${type === 'error' ? 'error' : ''}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;

    container.appendChild(toast);

    const dismissTimeout = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, dismissTimeout);
  }

  // ==========================================
  // REALTIME & EVENT BINDINGS
  // ==========================================
  function bindEvents() {
    // Tab click delegation
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.m-nav-item');
      if (navItem && navItem.dataset.tab) {
        switchTab(navItem.dataset.tab);
        return;
      }

      if (e.target.closest('#m-fab-scan')) {
        openScannerFlow();
        return;
      }
    });

    // Keyboard detection (PL-16)
    document.addEventListener('focusin', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        document.body.classList.add('m-keyboard-open');
      }
    });

    document.addEventListener('focusout', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        setTimeout(() => {
          if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
            document.body.classList.remove('m-keyboard-open');
          }
        }, 100);
      }
    });

    // Android Back button
    window.addEventListener('popstate', (e) => {
      if (activeSheet) {
        mCloseSheet();
      }
    });

    // Esc key closes sheets
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeSheet) {
        mCloseSheet();
      }
    });

    // Online / Offline handlers (M-19)
    window.addEventListener('online', () => {
      isOffline = false;
      const chip = document.getElementById('m-live-chip');
      if (chip) chip.classList.remove('offline');
      const label = document.getElementById('m-live-label');
      if (label) label.textContent = 'Live';
      const banner = document.getElementById('m-offline-banner');
      if (banner) banner.classList.remove('show');
      mToast('Connection restored', 'success');
    });

    window.addEventListener('offline', () => {
      isOffline = true;
      const chip = document.getElementById('m-live-chip');
      if (chip) chip.classList.add('offline');
      const label = document.getElementById('m-live-label');
      if (label) label.textContent = 'Offline';
      const banner = document.getElementById('m-offline-banner');
      if (banner) banner.classList.add('show');
      mToast('Connection lost — running in offline mode', 'error');
    });

    // Listen to real app render updates (Section 2.5)
    document.addEventListener('meditrack:render', () => {
      if (!isActive) {
        sync();
        return;
      }
      refreshMobileNavState();
      renderActiveView();

      // In-place conflict check if sheet is open (PL-17)
      if (activeSheet && activeSheet.id === 'equipment-detail' && activeEqId) {
        const state = getState();
        const currentEq = (state.allEquipment || []).find(e => e.id === activeEqId);
        if (currentEq && currentEq.status === 'In Use') {
          const conflictNotice = document.getElementById('m-live-conflict-notice');
          if (conflictNotice) {
            conflictNotice.style.display = 'block';
            conflictNotice.innerHTML = `
              <div class="m-conflict-title">⚠️ Status Changed Live</div>
              <div>This item was just marked In Use by <strong>${escapeHtml(currentEq.held_by || 'another user')}</strong>.</div>
            `;
          }
          const checkoutBtn = document.getElementById('m-sheet-checkout-btn');
          if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.5';
            checkoutBtn.textContent = 'Unavailable';
          }
        }
      }
    });
  }

  function renderAllViews() {
    if (!isActive) return;
    if (!document.getElementById('m-app')?.firstElementChild) {
      renderMobileShell();
    } else {
      refreshMobileNavState();
    }
    renderActiveView();
  }

  function renderActiveView() {
    if (activeTab === 'home') renderHomeView();
    else if (activeTab === 'requests') renderRequestsView();
    else if (activeTab === 'audit') renderAuditView();
    else if (activeTab === 'more') renderMoreView();
  }

  function refreshMobileNavState() {
    const state = getState();
    const pendingReqCount = (state.allRequests || []).length;
    const reqNavBtn = document.querySelector('.m-nav-item[data-tab="requests"]');
    if (!reqNavBtn) return;
    reqNavBtn.setAttribute('aria-label', `Requests, ${pendingReqCount} pending`);
    let badge = document.getElementById('m-nav-req-count');
    if (pendingReqCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'm-nav-badge';
        badge.id = 'm-nav-req-count';
        reqNavBtn.appendChild(badge);
      }
      badge.textContent = String(pendingReqCount);
    } else if (badge) {
      badge.remove();
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Public debug API
  window.MediTrackMobile = {
    sync,
    mount: mountMobile,
    unmount: unmountMobile,
    switchTab,
    openSheet: mOpenSheet,
    closeSheet: mCloseSheet,
    toast: mToast,
    openScanner: openScannerFlow
  };

  // Bind global event listeners once on load
  bindEvents();

  // Listen to viewport resizing / orientation change
  MQ.addEventListener('change', sync);

  // Initialize on script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }
})();
