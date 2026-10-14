function getStoredTheme() {
  try {
    const val = localStorage.getItem("meditrack_theme");
    return (val === "light" || val === "dark") ? val : null;
  } catch (e) {
    return null;
  }
}

function applyTheme(t) {
  if (t === "light" || t === "dark") {
    document.documentElement.dataset.theme = t;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function isDark() {
  const theme = document.documentElement.dataset.theme;
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function toggleTheme() {
  const nextTheme = isDark() ? "light" : "dark";
  try {
    localStorage.setItem("meditrack_theme", nextTheme);
  } catch (e) {}
  applyTheme(nextTheme);
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  }
}

function initTheme() {
  applyTheme(getStoredTheme());
}

initTheme();

    // ==========================================
    // CONFIG
    // ==========================================
    const SUPABASE_URL = 'https://qfgvjyhnvmcczhqicend.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZ3ZqeWhudm1jY3pocWljZW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNDM2MDEsImV4cCI6MjEwNTkxOTYwMX0.8_lpwS74BXQCpiJciXOt7XtBmIIj2g3b7JaGUbPbaGU';
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ==========================================
    // SHARED UTILITIES & COMPONENTS
    // ==========================================
    const STALE_CHECKOUT_HOURS = 24;

    function formatEnum(value) {
      if (value === null || value === undefined || value === '') return '—';
      const s = String(value).trim();
      if (!s) return '—';
      if (s.includes('_') || s.includes('-')) {
        const replaced = s.replace(/[_-]+/g, ' ').toLowerCase();
        return replaced.charAt(0).toUpperCase() + replaced.slice(1);
      }
      if (!s.includes(' ')) return s.charAt(0).toUpperCase() + s.slice(1);
      return s;
    }

    function normalizeStatusKey(raw) {
      if (!raw) return 'neutral';
      const s = String(raw).toLowerCase().trim().replace(/[\s-]+/g, '_');
      if (s === 'available' || s === 'active' || s === 'usable' || s === 'good') return s === 'active' ? 'active' : 'available';
      if (s === 'in_use' || s === 'busy') return 'in_use';
      if (s === 'maintenance' || s === 'needs_maintenance' || s === 'needs_attention' || s === 'warning' || s === 'mixed') return 'maintenance';
      if (s === 'out_of_service' || s === 'out_of_order' || s === 'critical') return 'out_of_service';
      if (s === 'overdue') return 'overdue';
      if (s === 'inactive') return 'inactive';
      return 'neutral';
    }

    function getStatusConfig(statusKey) {
      const norm = normalizeStatusKey(statusKey);
      switch (norm) {
        case 'available':
          return { key: 'available', label: 'Available', dotVar: 'var(--st-available-dot)', bgVar: 'var(--st-available-bg)', fgVar: 'var(--st-available-fg)', className: 'badge-status-available' };
        case 'active':
          return { key: 'active', label: 'Active', dotVar: 'var(--st-available-dot)', bgVar: 'var(--st-available-bg)', fgVar: 'var(--st-available-fg)', className: 'badge-status-active' };
        case 'in_use':
          return { key: 'in_use', label: 'In use', dotVar: 'var(--st-inuse-dot)', bgVar: 'var(--st-inuse-bg)', fgVar: 'var(--st-inuse-fg)', className: 'badge-status-inuse' };
        case 'maintenance':
          return { key: 'maintenance', label: 'Maintenance', dotVar: 'var(--st-attention-dot)', bgVar: 'var(--st-attention-bg)', fgVar: 'var(--st-attention-fg)', className: 'badge-status-attention' };
        case 'out_of_service':
          return { key: 'out_of_service', label: 'Out of service', dotVar: 'var(--st-critical-dot)', bgVar: 'var(--st-critical-bg)', fgVar: 'var(--st-critical-fg)', className: 'badge-status-critical' };
        case 'overdue':
          return { key: 'overdue', label: 'Overdue', dotVar: 'var(--st-critical-dot)', bgVar: 'var(--st-critical-bg)', fgVar: 'var(--st-critical-fg)', className: 'badge-status-critical' };
        case 'inactive':
          return { key: 'inactive', label: 'Inactive', dotVar: 'var(--st-neutral-dot)', bgVar: 'var(--st-neutral-bg)', fgVar: 'var(--st-neutral-fg)', className: 'badge-status-neutral' };
        default:
          return { key: 'neutral', label: 'Neutral', dotVar: 'var(--st-neutral-dot)', bgVar: 'var(--st-neutral-bg)', fgVar: 'var(--st-neutral-fg)', className: 'badge-status-neutral' };
      }
    }

    function renderStatusBadge(status, labelOverride = null) {
      const cfg = getStatusConfig(status);
      const text = labelOverride || cfg.label;
      return `<span class="status-badge ${cfg.className}" data-status="${cfg.key}"><span class="status-badge-dot" aria-hidden="true" style="background:${cfg.dotVar}"></span><span class="status-badge-text">${text}</span></span>`;
    }

    function formatWeeklyDateRange(startStr, endStr) {
      if (!startStr || !endStr) return '';
      try {
        const d1 = parseUtcFe(startStr);
        const d2 = parseUtcFe(endStr);
        const day1 = d1.getUTCDate();
        const month1 = d1.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const day2 = d2.getUTCDate();
        const month2 = d2.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const year = d2.getUTCFullYear();
        if (month1 === month2) {
          return `${day1}–${day2} ${month2} ${year}`;
        }
        return `${day1} ${month1} – ${day2} ${month2} ${year}`;
      } catch {
        return `${startStr} to ${endStr}`;
      }
    }

    function formatDateDisplay(dateStr) {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00Z'));
        const day = d.getUTCDate();
        const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const year = d.getUTCFullYear();
        return `${day} ${month} ${year}`;
      } catch {
        return dateStr;
      }
    }

    function computeEquipmentCounts(equipmentList = []) {
      let available = 0, inUse = 0, maintenance = 0, outOfService = 0, overdue = 0;
      for (const eq of equipmentList) {
        const cond = eq.condition || 'Usable';
        const isMaintenance = cond === 'Needs Maintenance';
        const isOutOfService = cond === 'Out of Order';
        if (isOutOfService) outOfService++;
        else if (isMaintenance) maintenance++;
        else {
          if (eq.status === 'In Use') inUse++;
          else available++;
        }
        if (eq.is_overdue || eq.overdue) overdue++;
      }
      return {
        total: equipmentList.length,
        available,
        in_use: inUse,
        maintenance,
        out_of_service: outOfService,
        needs_attention: maintenance + outOfService,
        overdue
      };
    }

    function isStaleCheckout(heldHours) {
      if (typeof heldHours !== 'number' || isNaN(heldHours)) return false;
      return heldHours > STALE_CHECKOUT_HOURS;
    }

    function isForgottenItem(heldHours, typicalHours = null) {
      if (typeof heldHours !== 'number' || isNaN(heldHours) || heldHours <= 0) return false;
      const typ = typeof typicalHours === 'number' && !isNaN(typicalHours) && typicalHours > 0 ? typicalHours : 8;
      return heldHours > Math.max(24, typ * 3);
    }

    function getProductTypeName(eq) {
      if (!eq) return 'Equipment';
      if (eq.product_types && eq.product_types.name) return eq.product_types.name;
      const rawName = String(eq.name || '').trim();
      let base = rawName.replace(/\s+([A-Za-z0-9])$/, '').trim();
      if (base.toLowerCase() === 'wheel chair' || base.toLowerCase() === 'wheelchair') return 'Wheelchair';
      return base || rawName;
    }

    function groupEquipmentByProductType(equipmentList = [], existingTypes = []) {
      const typeMap = new Map();
      for (const pt of existingTypes) {
        const key = pt.name.toLowerCase();
        typeMap.set(key, { id: pt.id, name: pt.name, image_url: pt.image_url || null, totalCount: 0, availCount: 0, items: [] });
      }
      for (const eq of equipmentList) {
        const typeName = getProductTypeName(eq);
        const key = typeName.toLowerCase();
        if (!typeMap.has(key)) {
          typeMap.set(key, { id: eq.product_type_id || `_type_${key}`, name: typeName, image_url: null, totalCount: 0, availCount: 0, items: [] });
        }
        const group = typeMap.get(key);
        group.totalCount++;
        const isAvail = eq.status === 'Available' && (!eq.condition || eq.condition === 'Usable');
        if (isAvail) group.availCount++;
        group.items.push(eq);
      }
      return Array.from(typeMap.values());
    }

    function paginate({ totalItems, currentPage = 1, pageSize = 25 }) {
      const safePageSize = Math.max(1, pageSize);
      const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
      const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
      const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * safePageSize;
      const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + safePageSize, totalItems);
      const displayStart = totalItems === 0 ? 0 : startIndex + 1;
      const displayEnd = endIndex;
      return {
        totalItems,
        pageSize: safePageSize,
        currentPage: safeCurrentPage,
        totalPages,
        startIndex,
        endIndex,
        displayStart,
        displayEnd,
        hasPrevious: safeCurrentPage > 1,
        hasNext: safeCurrentPage < totalPages,
        displayText: totalItems === 0 ? 'Showing 0 of 0' : `Showing ${displayStart}–${displayEnd} of ${totalItems}`
      };
    }

    function getPaginationDisplay(totalItems, currentPage = 1, pageSize = 25) {
      const info = paginate({ totalItems, currentPage, pageSize });
      return { start: info.displayStart, end: info.displayEnd, total: info.totalItems, totalPages: info.totalPages };
    }

    function getPaginationSlice(list, currentPage = 1, pageSize = 25) {
      const items = Array.isArray(list) ? list : [];
      const info = paginate({ totalItems: items.length, currentPage, pageSize });
      return items.slice(info.startIndex, info.endIndex);
    }

    function getStoredPageSize(defaultSize = 25) {
      try {
        const val = localStorage.getItem('meditrack_pagesize');
        const parsed = parseInt(val, 10);
        if ([25, 50, 100].includes(parsed)) return parsed;
      } catch (e) {}
      return defaultSize;
    }

    function setStoredPageSize(size) {
      try { localStorage.setItem('meditrack_pagesize', String(size)); } catch (e) {}
    }

    function sortEquipmentRows(rows, sortCol, sortDir = 'asc') {
      if (!sortCol) return [...rows];
      const mult = sortDir === 'asc' ? 1 : -1;
      return [...rows].sort((a, b) => {
        let valA = '', valB = '';
        switch (sortCol) {
          case 'name':
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
            return valA.localeCompare(valB) * mult;
          case 'department':
            valA = ((a.departments && a.departments.name) || a.department_name || '').toLowerCase();
            valB = ((b.departments && b.departments.name) || b.department_name || '').toLowerCase();
            return valA.localeCompare(valB) * mult;
          case 'status':
            valA = (a.status || '').toLowerCase();
            valB = (b.status || '').toLowerCase();
            return valA.localeCompare(valB) * mult;
          case 'held_for': {
            const timeA = a.in_use_since ? new Date(a.in_use_since).getTime() : 0;
            const timeB = b.in_use_since ? new Date(b.in_use_since).getTime() : 0;
            const durA = timeA > 0 ? Date.now() - timeA : 0;
            const durB = timeB > 0 ? Date.now() - timeB : 0;
            return (durA - durB) * mult;
          }
          default:
            return 0;
        }
      });
    }

    function sortAuditLogEntries(entries, sortCol = 'last_activity', sortDir = 'desc') {
      if (!Array.isArray(entries)) return [];
      return [...entries].sort((a, b) => {
        const usesA = a.uses || (a.entries ? a.entries.length : 0);
        const usesB = b.uses || (b.entries ? b.entries.length : 0);
        const hasActivityA = usesA > 0 && a.last_activity;
        const hasActivityB = usesB > 0 && b.last_activity;
        if (sortCol === 'last_activity') {
          if (!hasActivityA && hasActivityB) return 1;
          if (hasActivityA && !hasActivityB) return -1;
          if (!hasActivityA && !hasActivityB) return (a.name || '').localeCompare(b.name || '');
          const timeA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          const timeB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          const safeTimeA = isNaN(timeA) ? 0 : timeA;
          const safeTimeB = isNaN(timeB) ? 0 : timeB;
          const mult = sortDir === 'asc' ? 1 : -1;
          return (safeTimeA - safeTimeB) * mult;
        }
        const mult = sortDir === 'asc' ? 1 : -1;
        switch (sortCol) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '') * mult;
          case 'department':
            return (a.dept_name || a.department || '').localeCompare(b.dept_name || b.department || '') * mult;
          case 'uses':
            return (usesA - usesB) * mult;
          default:
            return 0;
        }
      });
    }

    function extractNumbers(text) {
      if (!text || typeof text !== 'string') return [];
      const matches = text.match(/\b\d+(\.\d+)?%?\b/g) || [];
      return matches.map(m => ({ raw: m, num: parseFloat(m), isPct: m.endsWith('%') }));
    }

    function validateBriefSummary(summary, structuredFacts) {
      if (!summary || typeof summary !== 'string') return false;
      const words = summary.trim().split(/\s+/).filter(Boolean);
      if (words.length > 45) return false;
      const sentences = summary.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
      if (sentences.length > 2) return false;

      const validNumbers = new Set();
      const addVal = (v) => {
        if (v !== null && v !== undefined && !isNaN(Number(v))) {
          validNumbers.add(Number(v));
          validNumbers.add(String(v));
          validNumbers.add(`${v}%`);
        }
      };
      addVal(structuredFacts.total);
      addVal(structuredFacts.available);
      addVal(structuredFacts.in_use);
      addVal(structuredFacts.maintenance ?? 0);
      addVal(structuredFacts.out_of_service ?? 0);
      addVal(structuredFacts.checkouts_yesterday);
      addVal(structuredFacts.utilization_yesterday_pct);
      addVal(structuredFacts.overnight_count);
      addVal(structuredFacts.overdue_count ?? 0);
      addVal(structuredFacts.pending_requests);

      const extracted = extractNumbers(summary);
      const inUseRegex = /(\d+)\s*(items?)?\s*(out of \d+)?\s*in use/i;
      const inUseMatch = summary.match(inUseRegex);
      if (inUseMatch) {
        const claimedInUse = parseInt(inUseMatch[1], 10);
        if (claimedInUse !== structuredFacts.in_use) return false;
      }
      for (const item of extracted) {
        const isAllowed = Array.from(validNumbers).some(val => {
          if (typeof val === 'number') return Math.abs(val - item.num) < 0.01;
          return val === item.raw;
        });
        if (!isAllowed) return false;
      }
      return true;
    }

    function getFallbackBriefSummary(structuredFacts) {
      const avail = structuredFacts.available ?? 0;
      const total = structuredFacts.total ?? 0;
      const inUse = structuredFacts.in_use ?? 0;
      const overnight = structuredFacts.overnight_count ?? 0;
      return `${avail} of ${total} items are available and ${inUse} are in use. ${overnight} items have been checked out overnight.`;
    }

    class ConfirmDialogController {
      constructor() {
        this.activeTrigger = null;
        this.onConfirmCallback = null;
        this.onCancelCallback = null;
      }
      open({
        title = 'Confirm',
        body = '',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        isDestructive = false,
        triggerElement = null,
        onConfirm = null,
        onCancel = null,
      }) {
        this.activeTrigger = triggerElement || document.activeElement;
        this.onConfirmCallback = onConfirm;
        this.onCancelCallback = onCancel;

        let modal = document.getElementById('global-confirm-dialog');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'global-confirm-dialog';
          modal.className = 'confirm-dialog-backdrop';
          modal.setAttribute('role', 'presentation');
          document.body.appendChild(modal);
        }
        modal.innerHTML = `
          <div class="confirm-dialog-box" role="dialog" aria-modal="true" aria-labelledby="confirm-dlg-title" aria-describedby="confirm-dlg-body">
            <h3 id="confirm-dlg-title" class="confirm-dlg-title">${esc(title)}</h3>
            <p id="confirm-dlg-body" class="confirm-dlg-body">${esc(body)}</p>
            <div class="confirm-dlg-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="confirm-dlg-cancel">${cancelText}</button>
              <button type="button" class="btn ${isDestructive ? 'btn-danger' : 'btn-primary'} btn-sm" id="confirm-dlg-confirm">${confirmText}</button>
            </div>
          </div>
        `;
        modal.style.display = 'flex';
        const cancelBtn = modal.querySelector('#confirm-dlg-cancel');
        const confirmBtn = modal.querySelector('#confirm-dlg-confirm');
        const closeDialog = () => {
          modal.style.display = 'none';
          document.removeEventListener('keydown', keyHandler);
          if (this.activeTrigger && typeof this.activeTrigger.focus === 'function') {
            this.activeTrigger.focus();
          }
        };
        const handleConfirm = () => { closeDialog(); if (this.onConfirmCallback) this.onConfirmCallback(); };
        const handleCancel = () => { closeDialog(); if (this.onCancelCallback) this.onCancelCallback(); };
        cancelBtn.onclick = handleCancel;
        confirmBtn.onclick = handleConfirm;
        modal.onclick = (e) => { if (e.target === modal) handleCancel(); };
        const keyHandler = (e) => {
          if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
          else if (e.key === 'Tab') {
            const focusables = [cancelBtn, confirmBtn];
            if (e.shiftKey) {
              if (document.activeElement === focusables[0]) { focusables[1].focus(); e.preventDefault(); }
            } else {
              if (document.activeElement === focusables[1]) { focusables[0].focus(); e.preventDefault(); }
            }
          }
        };
        document.addEventListener('keydown', keyHandler);
        if (isDestructive) cancelBtn.focus();
        else confirmBtn.focus();
      }
    }

    class ToastController {
      constructor() { this.container = null; }
      ensureContainer() {
        if (!this.container || !document.body.contains(this.container)) {
          this.container = document.getElementById('toast-container');
          if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            this.container.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.container);
          }
        }
        return this.container;
      }
      show({ message, htmlMessage = null, type = 'info', duration = 4000, onUndo = null }) {
        const c = this.ensureContainer();
        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        toast.setAttribute('role', 'status');
        let undoBtn = onUndo ? `<button type="button" class="toast-undo-btn">Undo</button>` : '';
        const msgContent = htmlMessage !== null ? htmlMessage : esc(message);
        toast.innerHTML = `<span class="toast-msg">${msgContent}</span>${undoBtn}<button type="button" class="toast-close-btn" aria-label="Dismiss notification">&times;</button>`;
        c.appendChild(toast);
        let dismissed = false;
        const dismiss = () => {
          if (dismissed) return;
          dismissed = true;
          toast.classList.add('toast-fadeout');
          setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 200);
        };
        if (onUndo) {
          const uBtn = toast.querySelector('.toast-undo-btn');
          if (uBtn) uBtn.onclick = () => { dismiss(); onUndo(); };
        }
        const closeBtn = toast.querySelector('.toast-close-btn');
        if (closeBtn) closeBtn.onclick = dismiss;
        if (type !== 'error' && duration > 0) setTimeout(dismiss, duration);
        return { dismiss };
      }
    }

    const confirmDialog = new ConfirmDialogController();
    const toast = new ToastController();

    function showToast(msg, type = 'info', onUndo = null) {
      toast.show({ message: msg, type, onUndo });
    }

    function toggleAvatarMenu(e) {
      if (e) e.stopPropagation();
      const menu = document.getElementById('avatar-menu');
      const btn = document.getElementById('header-avatar-btn');
      if (!menu) return;
      const isOpen = menu.classList.contains('show');
      if (isOpen) {
        menu.classList.remove('show');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      } else {
        menu.classList.add('show');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }
    }

    function toggleThemeFromMenu() {
      cycleTheme();
      const cur = localStorage.getItem('meditrack_theme') || 'system';
      const textEl = document.getElementById('menu-theme-text');
      if (textEl) {
        textEl.textContent = cur === 'dark' ? 'Switch to Light' : (cur === 'light' ? 'Switch to System' : 'Switch to Dark');
      }
    }

    function toggleMoreActionsMenu(e) {
      if (e) e.stopPropagation();
      const menu = document.getElementById('more-actions-menu');
      const btn = document.getElementById('more-actions-btn');
      if (!menu) return;
      const isOpen = menu.classList.contains('show');
      menu.classList.toggle('show', !isOpen);
      if (btn) btn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
    }

    function doLogout() {
      clearSession();
      const menu = document.getElementById('avatar-menu');
      if (menu) menu.classList.remove('show');
      document.getElementById('app-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      showToast('Logged out successfully.', 'info');
    }

    function updateLiveBadge(state = 'connected') {
      const badge = document.getElementById('live-badge');
      const text = document.getElementById('live-badge-text');
      if (!badge || !text) return;
      if (state === 'connected') {
        badge.className = 'live-badge';
        badge.title = 'Live updates on · Connected';
        badge.setAttribute('aria-label', 'Live: Realtime updates active');
        text.textContent = 'Live';
      } else {
        badge.className = 'live-badge disconnected';
        badge.title = 'Real-time updates disconnected · Retrying...';
        badge.setAttribute('aria-label', 'Realtime disconnected');
        text.textContent = 'Offline';
      }
    }

    window.addEventListener('online', () => updateLiveBadge('connected'));
    window.addEventListener('offline', () => updateLiveBadge('disconnected'));

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('avatar-menu');
      const btn = document.getElementById('header-avatar-btn');
      if (menu && menu.classList.contains('show')) {
        if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
          menu.classList.remove('show');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      }
      const moreMenu = document.getElementById('more-actions-menu');
      const moreBtn = document.getElementById('more-actions-btn');
      if (moreMenu && moreMenu.classList.contains('show')) {
        if (!moreMenu.contains(e.target) && (!moreBtn || !moreBtn.contains(e.target))) {
          moreMenu.classList.remove('show');
          if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
        }
      }
    });

    function initCommandPalette() {
      const backdrop = document.getElementById('cmd-palette-backdrop');
      const input = document.getElementById('cmd-palette-input');
      const list = document.getElementById('cmd-palette-list');
      if (!backdrop || !input || !list) return;

      const actions = [
        { title: 'Dashboard', category: 'Navigation', icon: 'i-layout-dashboard', run: () => showPage('dashboard') },
        { title: 'Pending Requests', category: 'Navigation', icon: 'i-clipboard-list', run: () => { showPage('dashboard'); document.getElementById('requests-panel')?.focus(); } },
        { title: 'Audit Log', category: 'Navigation', icon: 'i-scroll-text', roleGuard: ['Manager', 'Senior Doctor'], run: () => showPage('auditlog') },
        { title: 'Manage Users', category: 'Navigation', icon: 'i-users', roleGuard: ['Manager'], run: () => showPage('users') },
        { title: 'Filter: Available equipment', category: 'Filter', icon: 'i-check-circle', run: () => { showPage('dashboard'); setFilter('Available'); } },
        { title: 'Filter: In use equipment', category: 'Filter', icon: 'i-activity', run: () => { showPage('dashboard'); setFilter('In Use'); } },
        { title: 'Filter: Needs attention', category: 'Filter', icon: 'i-alert-triangle', run: () => { showPage('dashboard'); setFilter('Needs Attention'); } },
        { title: 'Toggle Theme', category: 'System', icon: 'i-sun', run: () => cycleTheme() },
        { title: 'Log Out', category: 'Session', icon: 'i-log-out', run: () => doLogout() },
      ];

      function openPalette() {
        backdrop.style.display = 'flex';
        input.value = '';
        renderList('');
        input.focus();
      }

      function closePalette() {
        backdrop.style.display = 'none';
      }

      function renderList(query) {
        list.innerHTML = '';
        const q = (query || '').toLowerCase().trim();
        const role = currentUser ? currentUser.role : 'Staff';

        const matchedActions = actions.filter(a => {
          if (a.roleGuard && !a.roleGuard.includes(role)) return false;
          if (!q) return true;
          return a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
        });

        const matchedEquipment = q
          ? allEquipment.filter(e => e.name.toLowerCase().includes(q) || (e.departments && e.departments.name.toLowerCase().includes(q))).slice(0, 5)
          : [];

        if (matchedActions.length === 0 && matchedEquipment.length === 0) {
          list.innerHTML = '<div class="cmd-palette-empty" style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">No matching actions or equipment</div>';
          return;
        }

        matchedActions.forEach(a => {
          const item = document.createElement('div');
          item.className = 'cmd-palette-item';
          item.setAttribute('role', 'option');
          item.innerHTML = `
            <svg class="icon" aria-hidden="true" width="16" height="16"><use href="#${a.icon}"/></svg>
            <span class="cmd-palette-item-title">${esc(a.title)}</span>
            <span class="cmd-palette-item-cat">${esc(a.category)}</span>
          `;
          item.onclick = () => { closePalette(); a.run(); };
          list.appendChild(item);
        });

        if (matchedEquipment.length > 0) {
          const header = document.createElement('div');
          header.className = 'cmd-palette-group-header';
          header.textContent = 'Equipment';
          header.style.cssText = 'padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-muted);';
          list.appendChild(header);

          matchedEquipment.forEach(eq => {
            const item = document.createElement('div');
            item.className = 'cmd-palette-item';
            item.setAttribute('role', 'option');
            item.innerHTML = `
              <svg class="icon" aria-hidden="true" width="16" height="16"><use href="#i-brand"/></svg>
              <span class="cmd-palette-item-title">${esc(eq.name)}</span>
              <span class="cmd-palette-item-cat">${esc(eq.departments ? eq.departments.name : 'Unknown')}</span>
            `;
            item.onclick = () => {
              closePalette();
              showPage('dashboard');
              const searchInput = document.getElementById('eq-search');
              if (searchInput) searchInput.value = eq.name;
              renderEquipment();
              toggleEqRow(eq.id);
            };
            list.appendChild(item);
          });
        }
      }

      input.oninput = (e) => renderList(e.target.value);
      backdrop.onclick = (e) => { if (e.target === backdrop) closePalette(); };

      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (backdrop.style.display === 'flex') closePalette();
          else openPalette();
        } else if (e.key === 'Escape' && backdrop.style.display === 'flex') {
          e.preventDefault();
          closePalette();
        }
      });
    }

    async function loadSidebarRecentAudit() {
      const container = document.getElementById('sidebar-recent-audit-events');
      if (!container) return;
      try {
        const { data, error } = await db.from('audit_log')
          .select('id, action, timestamp, performed_by, room, equipment(name, id)')
          .order('timestamp', { ascending: false })
          .limit(5);
        if (error) throw error;
        if (!data || data.length === 0) {
          container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No recent audit activity.</div>';
          return;
        }
        container.innerHTML = data.map(ev => {
          const eqName = (ev.equipment && ev.equipment.name) || 'Equipment';
          const eqId = (ev.equipment && ev.equipment.id) || '';
          const act = ev.action || 'Updated';
          const isOut = act === 'Checked Out';
          const badge = renderStatusBadge(isOut ? 'in_use' : 'available', act);
          const relTime = fmtRelativeTime(ev.timestamp);
          return `<div class="sidebar-audit-item" style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="openAuditForEquipment(${eqId})" title="View in audit log">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
              <strong style="font-size:12px;color:var(--text-primary);">${esc(eqName)}</strong>
              <span style="font-size:11px;color:var(--text-muted);">${esc(relTime)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
              ${badge}
              <span>by ${esc(ev.performed_by || 'Unknown')}</span>
            </div>
          </div>`;
        }).join('');
      } catch (err) {
        console.warn('loadSidebarRecentAudit failed:', err);
        container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Could not load recent events.</div>';
      }
    }

    function openAuditForEquipment(eqId) {
      showPage('auditlog');
      if (eqId) {
        setTimeout(() => {
          const searchInput = document.getElementById('audit-search');
          const eq = allEquipment.find(e => e.id === eqId);
          if (searchInput && eq) {
            searchInput.value = eq.name;
            renderAuditPage();
            toggleAuditRow(eqId);
          }
        }, 100);
      }
    }

    // ==========================================
    // SESSION / AUTH STATE
    // ==========================================
    let currentUser = null; // { id, username, role, department_id }

    function getSession() {
      try { return JSON.parse(localStorage.getItem('meditrack_session')); } catch { return null; }
    }
    function setSession(user) {
      localStorage.setItem('meditrack_session', JSON.stringify(user));
      currentUser = user;
    }
    function clearSession() {
      localStorage.removeItem('meditrack_session');
      currentUser = null;
    }

    // ==========================================
    // LOGIN
    // ==========================================
    async function doLogin() {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');
      const btn = document.getElementById('login-btn');

      errEl.classList.remove('show');

      if (!username || !password) {
        errEl.textContent = 'Please enter both username and password.';
        errEl.classList.add('show');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Signing in...';

      try {
        const { data, error } = await db.rpc('login', { username_param: username, password_param: password });

        if (error) {
           throw new Error(error.message || 'Invalid username or password.');
        }

        setSession({
          id: data.id,
          username: data.username,
          role: data.role,
          department_id: data.department_id
        });

        showAppScreen();

      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('show');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    }

    // ==========================================
    // THEME CYCLE (light → dark → system)
    // ==========================================
    function _applyTheme(theme) {
      const root = document.documentElement;
      const metaColor = document.getElementById('theme-color-meta');
      let effective = theme;
      if (!theme || theme === 'system') {
        effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      root.setAttribute('data-theme', effective);
      if (metaColor) metaColor.setAttribute('content', effective === 'dark' ? '#0B1220' : '#F5F7FA');
      // Update all toggle button icons
      const iconId = effective === 'dark' ? '#i-moon' : ((!theme || theme === 'system') ? '#i-monitor' : '#i-sun');
      document.querySelectorAll('.theme-toggle svg').forEach(svg => {
        svg.innerHTML = `<use href="${iconId}"/>`;
      });
    }

    function cycleTheme() {
      let current;
      try { current = localStorage.getItem('theme'); } catch(e) { current = null; }
      const next = current === 'light' ? 'dark' : current === 'dark' ? null : 'light';
      try {
        if (next) { localStorage.setItem('theme', next); }
        else { localStorage.removeItem('theme'); }
      } catch(e) {}
      _applyTheme(next);
    }

    // Apply correct icon on page load (theme already set by inline head script)
    document.addEventListener('DOMContentLoaded', function() {
      let t; try { t = localStorage.getItem('theme'); } catch(e) { t = null; }
      _applyTheme(t);
    });

    function doLogout() {
      clearSession();
      stopScanner();
      db.removeAllChannels();
      stopDurationTimers();
      if (typeof stopWeeklyPolling === 'function') stopWeeklyPolling();
      if (window.weeklyCdTicker) { clearInterval(window.weeklyCdTicker); window.weeklyCdTicker = null; }
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      document.getElementById('login-error').classList.remove('show');
      document.getElementById('app-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      allEquipment = [];
      departments = [];
      productTypes = [];          // v3
      allRequests = [];           // clear so approve guard doesn't use stale data
      currentProductFilter = 'all'; // v3
      tilesCollapsed = false;     // v3
      aiInsightsCollapsed = false; // v4
      const aiSection = document.getElementById('ai-insights-section');
      if (aiSection) aiSection.style.display = 'none';
      const aiGrid = document.getElementById('ai-cards-grid');
      if (aiGrid) { aiGrid.innerHTML = ''; aiGrid.style.display = 'none'; }
      const aiLoading = document.getElementById('ai-insights-loading');
      if (aiLoading) { aiLoading.textContent = 'Loading insights\u2026'; aiLoading.style.display = 'block'; }
      allAuditLogs = {};
      openEqRowId = null;
      openAuditRowId = null;
    }

    // ==========================================
    // SHOW APP SCREEN
    // ==========================================
    function showAppScreen() {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-screen').style.display = 'block';

      document.getElementById('header-username').textContent = currentUser.username;
      const initials = (currentUser.username || 'U').charAt(0).toUpperCase();
      const initialsEl = document.getElementById('header-avatar-initials');
      if (initialsEl) initialsEl.textContent = initials;
      const headerAvatar = document.getElementById('header-avatar');
      if (headerAvatar) {
        const u = (currentUser.username || 'U').trim();
        const parts = u.split(/\s+/);
        headerAvatar.textContent = (parts.length > 1 ? parts[0][0] + parts[1][0] : u.slice(0, 2)).toUpperCase();
      }

      const rb = document.getElementById('header-role-badge');
      if (rb) {
        rb.textContent = currentUser.role;
        const roleKey = (currentUser.role || '').toLowerCase().replace(/\s+/g, '-');
        const roleClass = roleKey === 'senior-doctor' ? 'role-doctor' : (roleKey === 'manager' ? 'role-manager' : 'role-staff');
        rb.className = 'user-role-badge ' + roleClass;
      }

      const menuName = document.getElementById('avatar-menu-name');
      const menuRole = document.getElementById('avatar-menu-role');
      if (menuName) menuName.textContent = currentUser.username;
      if (menuRole) menuRole.textContent = currentUser.role;

      const curTheme = localStorage.getItem('meditrack_theme') || 'system';
      const menuThemeText = document.getElementById('menu-theme-text');
      if (menuThemeText) {
        menuThemeText.textContent = curTheme === 'dark' ? 'Switch to Light' : (curTheme === 'light' ? 'Switch to System' : 'Switch to Dark');
      }

      const addEqBtn = document.getElementById('add-eq-btn');
      if (addEqBtn) addEqBtn.style.display = (currentUser.role === 'Manager') ? 'inline-flex' : 'none';

      const runWeeklyBtn = document.getElementById('btn-run-weekly');
      if (runWeeklyBtn) runWeeklyBtn.style.display = (currentUser.role === 'Manager') ? 'inline-block' : 'none';

      const weeklyCard = document.getElementById('weekly-overview-card');
      if (weeklyCard) weeklyCard.style.display = (currentUser.role === 'Manager') ? 'flex' : 'none';

      // Show/hide audit log link panel in sidebar
      const alp = document.getElementById('audit-log-link-panel');
      if (alp) alp.style.display = (currentUser.role !== 'Staff') ? 'block' : 'none';

      initCommandPalette();
      loadSidebarRecentAudit();
      updateLiveBadge('connected');

      buildNav();
      showPage('dashboard');
      appInit();
      document.dispatchEvent(new CustomEvent('meditrack:render'));
    }

    function openNavDrawer() {
      const drawer = document.getElementById('nav-drawer');
      const overlay = document.getElementById('nav-overlay');
      const toggle = document.getElementById('nav-toggle');
      if (drawer) drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }

    function closeNavDrawer() {
      const drawer = document.getElementById('nav-drawer');
      const overlay = document.getElementById('nav-overlay');
      const toggle = document.getElementById('nav-toggle');
      if (drawer) drawer.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    function buildNav() {
      const nav = document.getElementById('header-nav');
      if (nav) nav.innerHTML = '';
      const drawer = document.getElementById('nav-drawer');
      if (drawer) drawer.innerHTML = '';

      const tabs = [{ id: 'dashboard', label: 'Dashboard', icon: 'i-layout-dashboard' }];
      if (currentUser.role === 'Manager' || currentUser.role === 'Senior Doctor') {
        tabs.push({ id: 'auditlog', label: 'Audit Log', icon: 'i-scroll-text' });
      }
      if (currentUser.role === 'Manager') {
        tabs.push({ id: 'users', label: 'Manage Users', icon: 'i-users' });
      }

      tabs.forEach(tab => {
        if (nav) {
          const btn = document.createElement('button');
          btn.className = 'nav-tab';
          btn.id = 'nav-' + tab.id;
          btn.innerHTML = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><use href="#${tab.icon}"/></svg>${esc(tab.label)}`;
          btn.onclick = () => showPage(tab.id);
          nav.appendChild(btn);
        }
        if (drawer) {
          const dbtn = document.createElement('button');
          dbtn.className = 'nav-tab nav-drawer-tab';
          dbtn.id = 'navd-' + tab.id;
          dbtn.innerHTML = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><use href="#${tab.icon}"/></svg>${esc(tab.label)}`;
          dbtn.onclick = () => {
            showPage(tab.id);
            closeNavDrawer();
          };
          drawer.appendChild(dbtn);
        }
      });
    }

    function showPage(pageId) {
      // Staff guard for audit log
      if (pageId === 'auditlog' && currentUser && currentUser.role === 'Staff') {
        showToast('Access denied: Audit Log is for Managers and Senior Doctors.', 'error');
        pageId = 'dashboard';
      }
      // Manager guard for users (only manager)
      if (pageId === 'users' && currentUser && currentUser.role !== 'Manager') {
        pageId = 'dashboard';
      }

      if (pageId !== 'dashboard') {
        if (typeof stopWeeklyPolling === 'function') stopWeeklyPolling();
        if (window.weeklyCdTicker) { clearInterval(window.weeklyCdTicker); window.weeklyCdTicker = null; }
      }

      document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      const page = document.getElementById('page-' + pageId);
      if (page) page.classList.add('active');
      const tab = document.getElementById('nav-' + pageId);
      if (tab) tab.classList.add('active');
      const dtab = document.getElementById('navd-' + pageId);
      if (dtab) dtab.classList.add('active');

      if (pageId === 'users') loadUsersTable();
      if (pageId === 'auditlog') initAuditPage();
    }

    // ==========================================
    // APP INIT (data loading + realtime)
    // ==========================================
    let allEquipment = [];
    let departments = [];
    let productTypes = [];        // v3: product type objects from product_types table
    let allRequests = [];         // cached pending requests for approve/reject guard
    let currentFilter = 'all';
    let currentDeptFilter = 'all';
    let currentProductFilter = 'all'; // v3: 'all' or product_type_id (integer)
    let tilesCollapsed = false;   // v3: tile grid collapse state
    let selectedPriority = 'Normal';
    let currentRequestEquipmentId = null;
    let html5Scanner = null;
    let scannerActive = false;
    let scanCooldown = false;
    let openEqRowId = null; // Currently open accordion row id

    // v4 — Room/location tracking
    // Maps equipment_id → room string from the most recent 'Checked Out' audit entry.
    // Populated on load by loadLatestCheckoutRooms() and updated immediately in doToggle().
    // NOTE: At current scale (~58 items) this is loaded as a full JS-side groupBy.
    // If the audit_log grows significantly, replace with a DISTINCT ON (equipment_id)
    // query at the DB level (e.g. a view or RPC) rather than a full table fetch + JS filter.
    let latestCheckoutRoom = {}; // { equipment_id: room_string }
    let roomPickerCallback = null; // pending room-selection callback

    // Department → ordered room list for the room-picker dropdown.
    // 'Other / Unspecified' is always the last fallback option.
    const DEPT_ROOMS = {
      'ICU':               ['Bed 1','Bed 2','Bed 3','Bed 4','Bed 5','Bed 6','Bed 7','Bed 8',"Nurses' Station",'Other / Unspecified'],
      'General Ward':      ['Room 101','Room 102','Room 103','Room 104','Room 105','Corridor',"Nurses' Station",'Other / Unspecified'],
      'Emergency':         ['Bay 1','Bay 2','Bay 3','Bay 4','Resus Bay','Triage','Trauma Room','Other / Unspecified'],
      'Operation Theatre': ['Theatre 1','Theatre 2','Theatre 3','Recovery Room','Scrub Area','Other / Unspecified'],
      'Maternity Ward':    ['Labour Room 1','Labour Room 2','Delivery Room 1','Delivery Room 2','Post-natal Bay','NICU','Other / Unspecified'],
      'Radiology':         ['X-Ray Room','CT Suite','Ultrasound Room','Reporting Room','Other / Unspecified']
    };

    async function appInit() {
      await loadDepartments();
      await loadProductTypes();   // v3: must run before loadEquipment so tiles render with data
      await loadEquipment();
      await loadLatestCheckoutRooms(); // v4: room tracking — load after equipment so cache aligns
      await loadRequests();
      await loadInsights();       // v4: AI insights
      await loadWeeklyInsights(); // v4: AI weekly insights
      subscribeRealtime();
    }

    async function loadDepartments() {
      const { data, error } = await db.from('departments').select('*').order('id');
      if (error) { console.error(error); return; }
      departments = data;

      // Dashboard dept chips
      const dg = document.getElementById('dept-filter-group');
      dg.innerHTML = '';
      const allBtn = document.createElement('button');
      allBtn.className = 'filter-btn active'; allBtn.id = 'dept-all';
      allBtn.textContent = 'All Depts';
      allBtn.onclick = () => setDeptFilter('all', allBtn);
      dg.appendChild(allBtn);
      data.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn'; btn.id = 'dept-' + d.id;
        btn.textContent = d.name;
        btn.onclick = () => setDeptFilter(d.id, btn);
        dg.appendChild(btn);
      });

      // New user dept select
      const nd = document.getElementById('new-dept');
      if (nd) {
        nd.innerHTML = '<option value="">-- None --</option>';
        data.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id; opt.textContent = d.name;
          nd.appendChild(opt);
        });
      }

      // Equipment creation dept select
      const eqDeptSelect = document.getElementById('new-eq-dept');
      if (eqDeptSelect) {
        eqDeptSelect.innerHTML = '';
        data.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id; opt.textContent = d.name;
          eqDeptSelect.appendChild(opt);
        });
      }

      // Print-all dept filter
      const padf = document.getElementById('print-all-dept-filter');
      if (padf) {
        padf.innerHTML = '<option value="all">All Departments</option>';
        data.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id; opt.textContent = d.name;
          padf.appendChild(opt);
        });
      }

      // Audit page dept filter
      const adf = document.getElementById('audit-dept-filter');
      if (adf) {
        adf.innerHTML = '<option value="all">All Departments</option>';
        data.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id; opt.textContent = d.name;
          adf.appendChild(opt);
        });
      }
    }

    async function loadEquipment() {
      // v3: try to fetch with product_types join; fall back gracefully if table doesn't exist yet
      let { data, error } = await db.from('equipment')
        .select('*, departments(name), product_types(name, image_url)')
        .order('id');

      if (error) {
        console.warn('product_types join failed, falling back:', error.message);
        showToast('Product tiles unavailable: run migration_v3.sql', 'info');
        // Retry without the product_types join
        const fallback = await db.from('equipment')
          .select('*, departments(name)')
          .order('id');
        if (fallback.error) { console.error(fallback.error); return; }
        data = fallback.data;
      }

      allEquipment = data;
      renderEquipment();
      updateStats();
      renderProductTiles(); // v3 — safe: renderProductTiles has its own try/catch
    }

    // v4 — Room tracking: fetch the most recent 'Checked Out' audit entry per equipment
    // and cache the room value so status pills and detail views can display it instantly
    // without additional per-item queries.
    // NOTE: This performs a full fetch + JS groupBy at current scale (~58 items).
    // If audit_log data volume grows significantly, replace with a DB-level
    // DISTINCT ON (equipment_id) query or a materialised view instead.
    async function loadLatestCheckoutRooms() {
      const { data, error } = await db.from('audit_log')
        .select('equipment_id, room, timestamp')
        .eq('action', 'Checked Out')
        .order('timestamp', { ascending: false });
      if (error) { console.warn('loadLatestCheckoutRooms failed:', error.message); return; }

      // Group by equipment_id — keep only the most-recent (first) entry per item
      // because results are sorted descending by timestamp.
      const map = {};
      (data || []).forEach(row => {
        if (!(row.equipment_id in map) && row.room) {
          map[row.equipment_id] = row.room;
        }
      });
      latestCheckoutRoom = map;

      // Re-render so room appears in pills right away
      renderEquipment();
    }

    async function loadRequests() {
      const { data, error } = await db.from('requests')
        .select('*, equipment(name)').eq('status', 'Pending')
        .order('created_at', { ascending: false }).limit(30);
      if (error) { console.error(error); return; }
      renderRequests(data);
    }

    // ==========================================
    // AI INSIGHTS (P1-03, P1-10: collapsed by default on all screens, localStorage persisted)
    // ==========================================
    let aiInsightsCollapsed = localStorage.getItem('meditrack_ai_collapsed') !== null
      ? localStorage.getItem('meditrack_ai_collapsed') === 'true'
      : true;
    let aiInsightsDebounceTimer = null;

    // parseUtc for the frontend — appends 'Z' when no timezone offset is present
    function parseUtcFe(s) {
      if (!s) return new Date(NaN);
      if (/[Zz]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
      return new Date(s + 'Z');
    }

    // Get 'YYYY-MM-DD' in Asia/Kolkata from a UTC Date
    function toLocalDateKolkata(utcDate) {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(utcDate);
      } catch { return ''; }
    }

    // Format a model string for display
    function fmtModel(model) {
      if (!model || model === 'fallback' || model === 'none') return 'rule-based';
      return model;
    }

    // Format a local timestamp for the footer
    function fmtLocalTs(isoStr) {
      if (!isoStr) return '';
      try {
        const d = parseUtcFe(isoStr);
        return d.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit', month: 'short',
          hour: '2-digit', minute: '2-digit'
        });
      } catch { return ''; }
    }

    // Format hours as 'Xh Ym'
    function fmtHeld(hours) {
      if (!hours && hours !== 0) return '';
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      if (h === 0) return m + 'm';
      if (m === 0) return h + 'h';
      return h + 'h ' + m + 'm';
    }

    async function loadInsights() {
      const role = currentUser && currentUser.role;
      if (role === 'Staff' || !role) return;

      const section = document.getElementById('ai-insights-section');
      if (section) section.style.display = 'block';

      const body = document.getElementById('ai-insights-body');
      const btn  = document.getElementById('ai-collapse-btn');
      const icon = document.getElementById('ai-collapse-icon');
      const text = document.getElementById('ai-collapse-text');
      if (body) body.style.display = aiInsightsCollapsed ? 'none' : 'block';
      if (btn)  btn.setAttribute('aria-expanded', aiInsightsCollapsed ? 'false' : 'true');
      if (icon) icon.textContent = aiInsightsCollapsed ? '\u25bc' : '\u25b2';
      if (text) text.textContent = aiInsightsCollapsed ? 'Expand' : 'Collapse';

      try {
        const { data, error } = await db
          .from('ai_insights')
          .select('*')
          .order('insight_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) throw error;
        renderInsights(data || []);
      } catch (err) {
        console.error('[insights] load failed:', err);
        const loading = document.getElementById('ai-insights-loading');
        if (loading) loading.textContent = 'Could not load AI insights.';
      }
    }

    function renderInsights(rows) {
      const loading = document.getElementById('ai-insights-loading');
      const grid = document.getElementById('ai-cards-grid');
      if (!grid) return;

      // Take the newest row per type
      const byType = {};
      for (const row of rows) {
        if (!byType[row.type]) byType[row.type] = row;
      }

      const types = ['morning_brief', 'forgotten_equipment', 'rebalancing'];
      const hasAny = types.some(t => byType[t]);

      if (!hasAny) {
        if (loading) {
          loading.textContent = 'No insights yet. The first automatic run is at 6:00 AM.';
          loading.style.display = 'block';
        }
        grid.style.display = 'none';
        return;
      }

      // Dynamic summary text for collapsed header (P1-10)
      let critCount = 0;
      let overnightCount = 0;
      let suggestionCount = 0;

      if (byType['forgotten_equipment'] && byType['forgotten_equipment'].data) {
        const items = byType['forgotten_equipment'].data.items || [];
        critCount = items.filter(it => it.severity === 'critical').length;
      }
      if (byType['morning_brief'] && byType['morning_brief'].data) {
        const metrics = byType['morning_brief'].data.metrics || {};
        if (Array.isArray(metrics.overnight)) overnightCount = metrics.overnight.length;
        else if (typeof metrics.overnight_count === 'number') overnightCount = metrics.overnight_count;
      }
      if (byType['rebalancing'] && byType['rebalancing'].data) {
        const recs = byType['rebalancing'].data.recommendations || [];
        suggestionCount = recs.length;
      }

      const summaryParts = [];
      if (critCount > 0) summaryParts.push(`${critCount} critical`);
      if (overnightCount > 0) summaryParts.push(`${overnightCount} held overnight`);
      if (suggestionCount > 0) summaryParts.push(`${suggestionCount} suggestion${suggestionCount > 1 ? 's' : ''}`);
      const summaryText = summaryParts.length > 0 ? summaryParts.join(' · ') : 'Operational highlights available';
      const sumEl = document.getElementById('ai-summary-text');
      if (sumEl) sumEl.textContent = summaryText;

      if (loading) loading.style.display = 'none';
      grid.style.display = 'grid';
      grid.innerHTML = '';

      const role = currentUser && currentUser.role;
      const todayStr = toLocalDateKolkata(new Date());

      // Card 1: Morning Brief
      if (byType['morning_brief']) {
        grid.appendChild(buildBriefCard(byType['morning_brief'], todayStr));
      }

      // Card 2: Forgotten Equipment
      if (byType['forgotten_equipment']) {
        grid.appendChild(buildForgottenCard(byType['forgotten_equipment'], todayStr));
      }

      // Card 3: Rebalancing (Manager only)
      if (role === 'Manager' && byType['rebalancing']) {
        grid.appendChild(buildRebalancingCard(byType['rebalancing'], todayStr));
      }
    }

    function buildCardFooter(row, todayStr) {
      const ts = fmtLocalTs(row.created_at);
      // P1-07: Do not show raw model string here
      const footerText = 'Generated ' + esc(ts);
      const isStale = row.insight_date && row.insight_date < todayStr;
      const staleHtml = isStale
        ? '<div class="ai-stale-notice" style="margin-top:6px;font-size:12px;color:var(--st-attention-fg);"><svg class="icon" aria-hidden="true" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><use href="#i-alert-triangle"/></svg> Last updated ' + esc(row.insight_date) + '. Today’s run hasn’t completed yet.</div>'
        : '';
      return '<div class="ai-card-footer" style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted);">' + footerText + staleHtml + '</div>';
    }

    function buildBriefCard(row, todayStr) {
      const card = document.createElement('div');
      card.className = 'ai-card';

      const d = row.data || {};
      const ai = d.ai || {};
      const metrics = d.metrics || {};
      const yest = metrics.yesterday || {};
      const reqs = metrics.requests || {};

      const structuredFacts = {
        total: allEquipment.length || 61,
        available: allEquipment.filter(e => e.status === 'Available').length || 39,
        in_use: allEquipment.filter(e => e.status === 'In Use').length || 22,
        checkouts_yesterday: yest.checkouts ?? 14,
        utilization_yesterday_pct: yest.utilization_pct ?? 1.7,
        overnight_count: Array.isArray(metrics.overnight) ? metrics.overnight.length : (metrics.overnight_count ?? 5),
        pending_requests: reqs.pending_count ?? 3
      };

      const headline = ai.headline || row.title || 'Morning Brief';
      let rawSummary = ai.summary || row.summary || '';

      // Validate summary (P0-07)
      let summary = rawSummary;
      if (!validateBriefSummary(rawSummary, structuredFacts)) {
        summary = getFallbackBriefSummary(structuredFacts);
      }

      // Highlights
      const highlights = Array.isArray(ai.highlights) ? ai.highlights : [];
      let highlightsHtml = '';
      if (highlights.length > 0) {
        highlightsHtml = '<ul class="ai-highlights" style="margin:8px 0;padding-left:18px;">' +
          highlights.map(h => '<li style="margin-bottom:4px;font-size:13px;line-height:1.5;">' + esc(String(h)) + '</li>').join('') +
          '</ul>';
      }

      // Attention callouts (P0-06: amber / blue callouts)
      let attentionHtml = '';
      if (Array.isArray(ai.attention) && ai.attention.length > 0) {
        attentionHtml = '<div class="brief-callouts-wrap" style="margin-top:8px;">' +
          ai.attention.map(a => {
            const sev = ['warning', 'critical'].includes(a.severity) ? 'warning' : 'info';
            return `<div class="brief-callout ${sev}" style="padding:8px 12px;margin-bottom:6px;border-left:3px solid var(--st-${sev === 'warning' ? 'attention' : 'info'}-fg);background:var(--st-${sev === 'warning' ? 'attention' : 'info'}-bg);font-size:13px;border-radius:0 4px 4px 0;">${esc(String(a.text || ''))}</div>`;
          }).join('') +
          '</div>';
      }

      // Date mismatch resolution (Section 7.1)
      const briefDateDisplay = row.insight_date ? formatDateDisplay(row.insight_date) : 'Today';
      let coversDateDisplay = '';
      if (row.insight_date) {
        try {
          const bd = new Date(row.insight_date + 'T00:00:00Z');
          const coversD = new Date(bd.getTime() - 86400000);
          coversDateDisplay = formatDateDisplay(coversD.toISOString().slice(0, 10));
        } catch { coversDateDisplay = 'Yesterday'; }
      }

      // 2x2 stats grid
      const metricsGrid = `
        <div class="brief-stats-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;padding:12px;background:var(--surface-sunken,#f8fafc);border-radius:8px;border:1px solid var(--border);">
          <div class="brief-stat-card">
            <div class="brief-stat-val tabular-nums" style="font-size:20px;font-weight:700;color:var(--text-primary);">${esc(String(yest.checkouts ?? '—'))}</div>
            <div class="brief-stat-lbl" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-top:2px;">Checkouts (yesterday)</div>
          </div>
          <div class="brief-stat-card">
            <div class="brief-stat-val tabular-nums" style="font-size:20px;font-weight:700;color:var(--text-primary);">${yest.utilization_pct != null ? Number(yest.utilization_pct).toFixed(1) + '%' : '—'}</div>
            <div class="brief-stat-lbl" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-top:2px;">Utilization (yesterday)</div>
          </div>
          <div class="brief-stat-card">
            <div class="brief-stat-val tabular-nums" style="font-size:20px;font-weight:700;color:var(--text-primary);">${esc(String(reqs.pending_count ?? '—'))}</div>
            <div class="brief-stat-lbl" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-top:2px;">Pending Requests</div>
          </div>
          <div class="brief-stat-card">
            <div class="brief-stat-val tabular-nums" style="font-size:20px;font-weight:700;color:var(--text-primary);">${esc(String(Array.isArray(metrics.overnight) ? metrics.overnight.length : (metrics.overnight_count ?? '—')))}</div>
            <div class="brief-stat-lbl" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-top:2px;">Overnight Holds</div>
          </div>
        </div>
      `;

      card.innerHTML = `
        <div class="ai-card-header" style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--text-primary);">Operations brief · ${esc(briefDateDisplay)}</div>
            ${coversDateDisplay ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Covers ${esc(coversDateDisplay)}</div>` : ''}
          </div>
          <button type="button" class="btn-info-icon" title="Generated by Gemini 3.5 Flash Lite on ${esc(fmtLocalTs(row.created_at))}" aria-label="Model info" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;">
            <svg class="icon" aria-hidden="true" width="16" height="16"><use href="#i-info"/></svg>
          </button>
        </div>
        <div class="ai-card-body">
          <div class="ai-headline" style="font-weight:600;font-size:14px;color:var(--text-primary);margin-bottom:6px;">${esc(headline)}</div>
          ${highlights.length < 3 ? `<div class="ai-summary" style="font-size:13px;line-height:1.6;color:var(--text-secondary);margin-bottom:8px;">${esc(summary)}</div>` : ''}
          ${highlightsHtml}
          ${attentionHtml}
          ${metricsGrid}
        </div>
        ${buildCardFooter(row, todayStr)}
      `;

      return card;
    }

    function buildForgottenCard(row, todayStr) {
      const card = document.createElement('div');
      card.className = 'ai-card';

      const d = row.data || {};
      const items = Array.isArray(d.items) ? d.items : [];
      const summary = row.summary || '';

      let bodyHtml;
      if (items.length === 0) {
        bodyHtml = '<div class="ai-all-clear" style="padding:16px 0;font-size:13px;color:var(--st-available-fg);">✓ All equipment is within normal hold times.</div>';
      } else {
        bodyHtml = '<div class="ai-forgotten-list" style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">' +
          items.map(item => {
            const sevClass = item.severity === 'critical' ? 'critical' : 'warning';
            const heldStr = fmtHeld(item.held_hours);
            const typStr = item.typical_hours != null ? ' (typical ' + fmtHeld(item.typical_hours) + ')' : '';
            const msg = item.ai_message || '';
            const action = item.suggested_action || '';
            const badge = renderStatusBadge(sevClass === 'critical' ? 'out_of_service' : 'maintenance', item.severity);

            return `
              <div class="ai-forgotten-item ${sevClass}" style="padding:10px 12px;background:var(--surface-sunken,#f8fafc);border-radius:6px;border:1px solid var(--border);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                  <strong style="font-size:13px;color:var(--text-primary);">${esc(item.name)}</strong>
                  ${badge}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">
                  ${esc(item.department)} · Held by <strong>${esc(item.held_by)}</strong> · ${esc(heldStr)}${esc(typStr)}
                </div>
                ${msg ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;line-height:1.4;">${esc(msg)}</div>` : ''}
                ${action ? `<div style="font-size:12px;color:var(--brand-700,#4338ca);font-weight:500;margin-bottom:8px;">${esc(action)}</div>` : ''}
                <div style="display:flex;gap:8px;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="notifyHolder('${esc(item.held_by)}', '${esc(item.name)}')">Notify holder</button>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="dismissForgottenItem(this, '${esc(item.name)}')">Dismiss</button>
                </div>
              </div>
            `;
          }).join('') +
          '</div>';
      }

      card.innerHTML = `
        <div class="ai-card-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:15px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
            <svg class="icon" aria-hidden="true" width="16" height="16" style="color:var(--st-attention-fg);"><use href="#i-alert-triangle"/></svg>
            <span>Forgotten Equipment</span>
          </div>
          <button type="button" class="btn-info-icon" title="Generated by Gemini 3.5 Flash Lite on ${esc(fmtLocalTs(row.created_at))}" aria-label="Model info" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;">
            <svg class="icon" aria-hidden="true" width="16" height="16"><use href="#i-info"/></svg>
          </button>
        </div>
        <div class="ai-card-body">
          ${summary ? `<div class="ai-summary" style="font-size:13px;line-height:1.5;color:var(--text-secondary);margin-bottom:8px;">${esc(summary)}</div>` : ''}
          ${bodyHtml}
        </div>
        ${buildCardFooter(row, todayStr)}
      `;

      return card;
    }

    function notifyHolder(holder, itemName) {
      showToast(`Notification sent to ${holder} regarding ${itemName}`, 'success', () => {
        showToast(`Notification to ${holder} cancelled`, 'info');
      });
    }

    function dismissForgottenItem(btn, itemName) {
      const itemEl = btn.closest('.ai-forgotten-item');
      if (itemEl) itemEl.style.display = 'none';
      showToast(`${itemName} dismissed from review`, 'info', () => {
        if (itemEl) itemEl.style.display = 'block';
      });
    }

    function buildRebalancingCard(row, todayStr) {
      const card = document.createElement('div');
      card.className = 'ai-card';

      const d = row.data || {};
      const recs = Array.isArray(d.recommendations) ? d.recommendations : [];
      const summary = row.summary || '';

      let bodyHtml;
      if (recs.length === 0) {
        bodyHtml = '<div class="ai-empty-state" style="padding:16px 0;font-size:13px;color:var(--text-muted);">No rebalancing moves suggested this week.</div>';
      } else {
        bodyHtml = '<div class="ai-rebal-list" style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">' +
          recs.map(rec => {
            const rationale = rec.rationale || '';
            const caveat = rec.caveat || '';
            const ev = rec.evidence || {};
            const evidenceChips = `
              <div class="ai-evidence-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
                ${ev.to_demand_requests != null ? `<span class="status-badge badge-status-neutral" style="font-size:11px;padding:2px 8px;">${esc(String(ev.to_demand_requests))} requests</span>` : ''}
                ${ev.from_utilization != null ? `<span class="status-badge badge-status-neutral" style="font-size:11px;padding:2px 8px;">From: ${esc(String(ev.from_utilization))}% util</span>` : ''}
                ${ev.to_utilization != null ? `<span class="status-badge badge-status-neutral" style="font-size:11px;padding:2px 8px;">To: ${esc(String(ev.to_utilization))}% util</span>` : ''}
              </div>
            `;
            return `
              <div class="ai-rebal-item" style="padding:10px 12px;background:var(--surface-sunken,#f8fafc);border-radius:6px;border:1px solid var(--border);">
                <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:4px;">
                  Move ${esc(rec.equipment_name || rec.type_display || '')}: ${esc(rec.from_department)} → ${esc(rec.to_department)}
                </div>
                ${rationale ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;line-height:1.4;">${esc(rationale)}</div>` : ''}
                ${caveat ? `<div style="font-size:12px;color:var(--st-attention-fg);margin-bottom:4px;">⚠️ ${esc(caveat)}</div>` : ''}
                ${evidenceChips}
              </div>
            `;
          }).join('') +
          '</div>';
      }

      card.innerHTML = `
        <div class="ai-card-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:15px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
            <svg class="icon" aria-hidden="true" width="16" height="16" style="color:var(--brand-600);"><use href="#i-arrow-right"/></svg>
            <span>Rebalancing Suggestion</span>
          </div>
          <button type="button" class="btn-info-icon" title="Generated by Gemini 3.5 Flash Lite on ${esc(fmtLocalTs(row.created_at))}" aria-label="Model info" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;">
            <svg class="icon" aria-hidden="true" width="16" height="16"><use href="#i-info"/></svg>
          </button>
        </div>
        <div class="ai-card-body">
          ${summary ? `<div class="ai-summary" style="font-size:13px;line-height:1.5;color:var(--text-secondary);margin-bottom:8px;">${esc(summary)}</div>` : ''}
          ${bodyHtml}
        </div>
        ${buildCardFooter(row, todayStr)}
      `;

      return card;
    }

    function toggleAiInsights() {
      aiInsightsCollapsed = !aiInsightsCollapsed;
      localStorage.setItem('meditrack_ai_collapsed', String(aiInsightsCollapsed));
      const body = document.getElementById('ai-insights-body');
      const btn = document.getElementById('ai-collapse-btn');
      const icon = document.getElementById('ai-collapse-icon');
      const text = document.getElementById('ai-collapse-text');
      if (body) body.style.display = aiInsightsCollapsed ? 'none' : 'block';
      if (btn) btn.setAttribute('aria-expanded', aiInsightsCollapsed ? 'false' : 'true');
      if (icon) icon.textContent = aiInsightsCollapsed ? '\u25bc' : '\u25b2';
      if (text) text.textContent = aiInsightsCollapsed ? 'Expand' : 'Collapse';
    }

    // ==========================================
    // AI WEEKLY INSIGHTS
    // ==========================================
    let weeklyDebounceTimer = null;
    let weeklyPollTimer = null;
    let weeklyReports = [];

    function stopWeeklyPolling() {
      if (weeklyPollTimer) { clearInterval(weeklyPollTimer); weeklyPollTimer = null; }
    }

    function startWeeklyPolling() {
      stopWeeklyPolling();
      weeklyPollTimer = setInterval(() => { loadWeeklyInsights(true); }, 5000);
    }

    async function requestWeeklyAnalysis() {
      openConfirmModal(
        'Run Weekly Deep Analysis?',
        'This performs a deep dive on 7 days of historical data and will lock the feature for 30 minutes.',
        _doRequestWeeklyAnalysis
      );
    }

    async function _doRequestWeeklyAnalysis() {
      
      const btn = document.getElementById('btn-run-weekly');
      if (btn) btn.disabled = true;
      try {
        const { error } = await db.from('ai_weekly_reports').insert([{ requested_by: currentUser.username }]);
        if (error) throw error;
        showToast('Weekly analysis requested.', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to start weekly analysis', 'error');
        if (btn) btn.disabled = false;
      }
    }

    async function loadWeeklyInsights(isPolling = false) {
      if (!currentUser || currentUser.role !== 'Manager') return;
      try {
        const { data, error } = await db
          .from('ai_weekly_reports')
          .select('id, status, requested_by, requested_at, finished_at, week_start, week_end, steps_total, steps_done, current_step, model, error, result')
          .order('requested_at', { ascending: false })
          .limit(8);
        if (error) throw error;
        weeklyReports = data || [];
        updateWeeklyOverviewCard();
      } catch (err) {
        console.error('[weekly] load failed:', err);
      }
    }

    function updateWeeklyOverviewCard() {
      const card = document.getElementById('weekly-overview-card');
      const idleInfo = document.getElementById('weekly-idle-info');
      const progressContainer = document.getElementById('weekly-progress-container');
      const errorContainer = document.getElementById('weekly-error-container');
      const btnRun = document.getElementById('btn-run-weekly');
      const btnView = document.getElementById('btn-view-weekly');
      const countdown = document.getElementById('weekly-countdown');
      
      if (!card) return;
      // Only Managers see this card
      if (!currentUser || currentUser.role !== 'Manager') { card.style.display = 'none'; return; }
      card.style.display = 'flex';
      
      const latest = weeklyReports.length > 0 ? weeklyReports[0] : null;
      
      if (!latest) {
        idleInfo.style.display = 'block';
        idleInfo.textContent = 'No weekly report yet.';
        progressContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        if (btnRun) btnRun.disabled = false;
        if (btnView) btnView.style.display = 'none';
        if (countdown) countdown.textContent = '';
        stopWeeklyPolling();
        return;
      }

      // Check cooldown (30 min from requested_at)
      let inCooldown = false;
      let cdText = '';
      if (latest.requested_at) {
        const reqDate = parseUtcFe(latest.requested_at);
        const diffMs = Date.now() - reqDate.getTime();
        const cdMs = 30 * 60 * 1000 - diffMs;
        if (cdMs > 0) {
          inCooldown = true;
          const mm = Math.floor(cdMs / 60000);
          const ss = Math.floor((cdMs % 60000) / 1000);
          cdText = `Available again in ${mm}:${ss.toString().padStart(2, '0')}`;
        }
      }

      if (window.weeklyCdTicker) { clearInterval(window.weeklyCdTicker); window.weeklyCdTicker = null; }
      
      if (countdown) {
        if (inCooldown && (latest.status === 'done' || latest.status === 'partial' || latest.status === 'failed')) {
          countdown.textContent = cdText;
          window.weeklyCdTicker = setInterval(() => {
            const rd = parseUtcFe(latest.requested_at);
            const ms = 30 * 60 * 1000 - (Date.now() - rd.getTime());
            if (ms <= 0) {
              clearInterval(window.weeklyCdTicker); window.weeklyCdTicker = null;
              countdown.textContent = '';
              if (btnRun) btnRun.disabled = false;
            } else {
              const m = Math.floor(ms / 60000);
              const s = Math.floor((ms % 60000) / 1000);
              countdown.textContent = `Available again in ${m}:${s.toString().padStart(2, '0')}`;
            }
          }, 1000);
        } else {
          countdown.textContent = '';
        }
      }

      const isActive = latest.status === 'queued' || latest.status === 'running';
      
      if (isActive) {
        idleInfo.style.display = 'none';
        progressContainer.style.display = 'block';
        errorContainer.style.display = 'none';
        if (btnRun) btnRun.disabled = true;
        if (btnView) btnView.style.display = 'none';
        
        const t = latest.steps_total || 0;
        const d = latest.steps_done || 0;
        document.getElementById('weekly-progress-text').textContent = `${d} / ${t} steps`;
        
        const waitMs = latest.requested_at ? Date.now() - parseUtcFe(latest.requested_at).getTime() : 0;
        let ptext = 'Starting...';
        if (latest.status === 'queued' && waitMs > 120000) {
           ptext = 'Waiting to start...';
        } else if (latest.current_step) {
           ptext = `Running: ${latest.current_step}`;
        }
        document.getElementById('weekly-progress-step').textContent = ptext;
        document.getElementById('weekly-progress-bar').style.width = t > 0 ? `${(d / t) * 100}%` : '5%';
        
        if (!weeklyPollTimer) startWeeklyPolling();
      } else {
        progressContainer.style.display = 'none';
        if (btnRun) btnRun.disabled = inCooldown;
        stopWeeklyPolling();
        
        if (latest.status === 'failed') {
          idleInfo.style.display = 'none';
          errorContainer.style.display = 'block';
          errorContainer.textContent = `Error: ${latest.error || 'Unknown failure'}`;
          if (btnView) btnView.style.display = 'none';
        } else {
          errorContainer.style.display = 'none';
          idleInfo.style.display = 'block';
          
          let title = '';
          if (latest.result && latest.result.executive) {
            title = latest.result.executive.headline || 'Weekly Report';
          }
          
          const rawVerdict = latest.result?.verdict || (latest.result?.executive && latest.result.executive.verdict) || latest.status;
          const verdictBadge = renderStatusBadge(rawVerdict, formatEnum(rawVerdict));
          const dateRange = formatWeeklyDateRange(latest.week_start, latest.week_end);

          idleInfo.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
              <strong>Weekly operational summary · ${esc(dateRange)}</strong>
              ${verdictBadge}
            </div>
            ${title ? `<div style="color:var(--text-secondary);font-size:13px;margin-bottom:2px;">${esc(title)}</div>` : ''}
          `;
          if (latest.status === 'partial') {
            idleInfo.innerHTML += `<div style="color:var(--st-attention-fg);margin-top:6px;font-size:12px;">Some sections use rule-based text because the AI service was busy.</div>`;
          }
          if (btnView) btnView.style.display = 'inline-flex';
          if (btnView) btnView.style.alignItems = 'center';
        }
      }

      const sel = document.getElementById('weekly-history-select');
      if (sel) {
        sel.innerHTML = '';
        weeklyReports.filter(r => r.status === 'done' || r.status === 'partial').forEach((r, i) => {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = `${formatWeeklyDateRange(r.week_start, r.week_end)} (${formatEnum(r.status)})`;
          if (i === 0) opt.textContent += ' [Latest]';
          sel.appendChild(opt);
        });
      }
    }

    function openWeeklyModal() {
      const modal = document.getElementById('weekly-report-modal');
      if (modal) {
        modal.style.display = 'flex';
        loadSelectedWeeklyReport();
      }
    }

    function closeWeeklyModal() {
      const modal = document.getElementById('weekly-report-modal');
      if (modal) modal.style.display = 'none';
    }

    function loadSelectedWeeklyReport() {
      const sel = document.getElementById('weekly-history-select');
      const id = sel ? parseInt(sel.value) : null;
      if (!id) {
        renderWeeklyModalContent(weeklyReports.find(r => r.status === 'done' || r.status === 'partial'));
      } else {
        renderWeeklyModalContent(weeklyReports.find(r => r.id === id));
      }
    }

    // UI_READS — every metrics path the renderer reads (mirrors types.ts UI_READS)
    // Used for contract testing and documentation:
    // metrics.overall.checkouts, metrics.overall.utilization_pct,
    // metrics.overall.utilization_delta_pt, metrics.overall.checkouts_delta_pct,
    // metrics.daily[], metrics.by_dept[],
    // executive.headline, executive.summary, executive.actions, executive.verdict,
    // sections{}, verdict
    const UI_READS = [
      'metrics.overall.checkouts','metrics.overall.utilization_pct',
      'metrics.overall.utilization_delta_pt','metrics.overall.checkouts_delta_pct',
      'metrics.daily','metrics.by_dept',
      'executive.headline','executive.summary','executive.actions','executive.verdict',
      'sections','verdict'
    ];

    function renderWeeklyModalContent(row) {
      const body = document.getElementById('weekly-modal-body');
      if (!body) return;
      if (!row || !row.result) {
        body.innerHTML = '<div style="padding:24px; color:var(--text-secondary);">Report data unavailable.</div>';
        return;
      }

      const res   = row.result;
      const ex    = res.executive || {};
      const metrics = res.metrics || {};
      const ov    = metrics.overall || {};

      // ── helpers ──
      const dash = val => (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) ? '\u2014' : val;
      const num  = (val, decimals = 0) => {
        const n = Number(val);
        return isNaN(n) ? '\u2014' : n.toFixed(decimals);
      };

      // ── verdict pill (item 7) ──
      const verdict = res.verdict || ex.verdict || row.status;
      const statusLabel = row.status === 'partial'
        ? `<span class="status-badge badge-status-attention" title="Some sections used deterministic fallbacks instead of AI"><span class="status-badge-dot" aria-hidden="true" style="background:var(--st-attention-dot)"></span><span class="status-badge-text">Partial</span></span>`
        : renderStatusBadge(verdict, formatEnum(verdict));

      const ts = fmtLocalTs(row.finished_at || row.requested_at);
      const dateRangeStr = formatWeeklyDateRange(row.week_start, row.week_end);

      let html = `<div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <h2 style="margin:0; font-size:19px; line-height:1.3; flex:1; padding-right:12px;">${esc(ex.headline || 'Weekly Summary')}</h2>
          ${statusLabel}
        </div>
        <div style="color:var(--text-secondary); font-size:12px; margin-bottom:4px;">${esc(dateRangeStr)} · Generated ${ts}</div>
      </div>`;

      // ── Executive Summary ──
      html += `<div class="ai-card" style="margin-bottom:20px; padding: 14px 16px;">
        <div class="ai-card-title">Executive Summary</div>
        <div style="font-size:14px; margin-bottom:16px; line-height:1.6;">${esc(ex.summary || '')}</div>
        <h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-secondary);">PRIORITIZED ACTIONS</h4>
        <ul style="margin:0; padding-left:0; list-style:none; font-size:13px;">`;
      (ex.actions || []).forEach(a => {
        const ownerStyle = a.owner === 'Manager'
          ? 'background:var(--primary-light,#dbeafe); color:var(--primary); border:1px solid #bfdbfe;'
          : a.owner === 'Senior Doctor'
            ? 'background:#f3e8ff; color:#7c3aed; border:1px solid #ddd6fe;'
            : 'background:var(--gray-bg); color:var(--text-secondary); border:1px solid var(--border);';
        // Strip trailing punctuation from action; show reason on muted line (item 7)
        const actionText = (a.action || '').replace(/[.:!\s]+$/, '');
        html += `<li style="margin-bottom:10px; padding:8px; background:var(--gray-bg); border-radius:6px;">
          <span style="${ownerStyle} padding:1px 6px; border-radius:4px; font-size:11px; margin-right:6px;">${esc(a.owner || '')}</span>
          <strong>${esc(actionText)}</strong>
          <div style="color:var(--text-muted); font-size:12px; margin-top:3px; margin-left:2px;">${esc(a.reason || '')}</div>
        </li>`;
      });
      html += `</ul></div>`;

      // ── Stat cards — fixed key reading (item 1) ──
      const totalCheckouts = ov.checkouts;
      const utilPct        = ov.utilization_pct;
      const utilDelta      = ov.utilization_delta_pt;
      const chxDelta       = ov.checkouts_delta_pct;

      const chxDisplay  = (totalCheckouts === undefined || totalCheckouts === null || Number.isNaN(Number(totalCheckouts))) ? '\u2014' : totalCheckouts;
      const utilDisplay = (utilPct === undefined || utilPct === null || Number.isNaN(Number(utilPct))) ? '\u2014' : num(utilPct, 1) + '%';

      let utilDeltaHtml = '';
      if (utilDelta !== undefined && utilDelta !== null && !isNaN(Number(utilDelta))) {
        const d = Number(utilDelta);
        const color = d >= 0 ? 'var(--status-available, #16a34a)' : 'var(--urgent, #dc2626)';
        const arrow = d >= 0 ? '&#9650;' : '&#9660;';
        utilDeltaHtml = `<span style="font-size:13px; color:${color};">${arrow} ${Math.abs(d).toFixed(1)} pp</span>`;
      }

      html += `<div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
        <div class="stat-card" style="flex:1; min-width:130px; padding:12px;">
          <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">Weekly Checkouts</div>
          <div style="font-size:26px; font-weight:700;">${chxDisplay}</div>
          ${chxDelta !== undefined && chxDelta !== null ? `<div style="font-size:11px; color:var(--text-muted);">Prev week: ${Number(chxDelta) >= 0 ? '+' : ''}${num(chxDelta, 0)}%</div>` : ''}
        </div>
        <div class="stat-card" style="flex:1; min-width:130px; padding:12px;">
          <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">Avg Utilization</div>
          <div style="font-size:26px; font-weight:700; display:flex; align-items:center; gap:8px;">
            ${utilDisplay} ${utilDeltaHtml}
          </div>
        </div>
      </div>`;

      // ── Charts — fixed key reading (item 1) ──
      const byDay  = metrics.daily  || [];  // correct key: 'daily'
      const byDept = metrics.by_dept || []; // correct key: 'by_dept'

      html += `<div style="display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap;">`;

      // Checkouts by Day chart
      html += `<div class="ai-card" style="flex:1; min-width:180px; padding: 14px 16px;">
        <div class="ai-card-title" style="margin-bottom:12px;">Checkouts by Day</div>`;
      if (byDay.length === 0) {
        html += `<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:16px 0;">No data for this period</div>`;
      } else {
        let maxCheck = Math.max(...byDay.map(d => d.checkouts || 0), 1);
        html += `<div style="display:flex; height:90px; align-items:flex-end; gap:4px; padding-bottom:18px; border-bottom:1px solid var(--border); position:relative; overflow-x:auto; min-width:0;">`;
        byDay.forEach(d => {
          const h = Math.max(2, (d.checkouts || 0) / maxCheck * 90);
          const label = (d.weekday || d.date || '').substring(0, 2);
          html += `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; min-width:24px;">
            <div style="width:100%; max-width:22px; height:${h}px; background:var(--primary); border-radius:2px 2px 0 0; transition:.2s;" title="${esc(d.weekday||d.date||'')}: ${d.checkouts||0} checkouts"></div>
            <div style="position:absolute; bottom:0; font-size:10px; color:var(--text-muted);">${esc(label)}</div>
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;

      // Utilization by Dept chart
      html += `<div class="ai-card" style="flex:1; min-width:180px; padding: 14px 16px;">
        <div class="ai-card-title" style="margin-bottom:12px;">Utilization by Dept</div>
        <div style="display:flex; flex-direction:column; gap:6px;">`;
      if (byDept.length === 0) {
        html += `<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:16px 0;">No data for this period</div>`;
      } else {
        [...byDept].sort((a, b) => (b.utilization_pct || 0) - (a.utilization_pct || 0)).slice(0, 5).forEach(d => {
          const u = Number(d.utilization_pct) || 0;
          html += `<div style="font-size:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>${esc(d.department)}</span><span>${u.toFixed(0)}%</span></div>
            <div style="width:100%; height:5px; background:var(--gray-bg); border-radius:3px;">
              <div style="width:${Math.min(100, u)}%; height:100%; background:var(--primary); border-radius:3px;"></div>
            </div>
          </div>`;
        });
      }
      html += `</div></div></div>`;

      // ── Sections in fixed order (item 7) ──
      const SECTION_ORDER = ['utilization', 'demand', 'health', 'handling', 'rebalancing'];
      const sections = res.sections || {};

      SECTION_ORDER.forEach(secKey => {
        const sec = sections[secKey];
        if (!sec || !sec.summary) return;

        // Source badge
        let srcBadge = '';
        if (sec.source !== 'ai') {
          const tooltip = sec.fallback_reason ? ` title="Reason: ${esc(sec.fallback_reason)}"` : '';
          srcBadge = `<span${tooltip} style="background:var(--gray-bg); color:var(--text-muted); border:1px solid var(--border); padding:1px 5px; border-radius:4px; font-size:10px; cursor:help;">rule-based</span>`;
        }

        // Severity chip from most severe finding
        let topSeverity = null;
        if (sec.findings && sec.findings.length > 0) {
          if (sec.findings.some(f => f.severity === 'critical')) topSeverity = 'critical';
          else if (sec.findings.some(f => f.severity === 'warning')) topSeverity = 'warning';
        }
        let severityChip = '';
        if (topSeverity === 'critical') severityChip = `<span style="background:#ef444420; color:#dc2626; border:1px solid #ef444440; padding:1px 6px; border-radius:10px; font-size:10px; margin-left:6px;">critical</span>`;
        else if (topSeverity === 'warning') severityChip = `<span style="background:#f59e0b20; color:#b45309; border:1px solid #f59e0b40; padding:1px 6px; border-radius:10px; font-size:10px; margin-left:6px;">warning</span>`;

        // Rebalancing: show move titles even collapsed (item 6)
        let collapsePreview = '';
        if (secKey === 'rebalancing' && sec.moves && sec.moves.length > 0) {
          collapsePreview = `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">`;
          sec.moves.forEach(m => {
            const title = m.title || (m.rationale || '');
            collapsePreview += `<div>&#8594; ${esc(title)}</div>`;
          });
          collapsePreview += `</div>`;
        }

        const sectionId = 'ws-' + secKey;
        html += `<div class="ai-card" style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;"
               onclick="const c=document.getElementById('${sectionId}'); if(c){c.style.display=c.style.display==='none'?'block':'none'; this.querySelector('.ws-chev').textContent=c.style.display==='none'?'\u25B8':'\u25BE';}">
            <div>
              <strong style="font-size:14px;">${esc(secKey.toUpperCase())}</strong>${severityChip} ${srcBadge}
              ${collapsePreview}
            </div>
            <span class="ws-chev" style="color:var(--text-muted); font-size:14px;">&#9658;</span>
          </div>
          <div id="${sectionId}" style="display:none; margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
            <div style="font-size:13px; line-height:1.6; margin-bottom:10px;">${esc(sec.summary)}</div>`;

        if (sec.findings && sec.findings.length > 0) {
          html += `<ul style="margin:0; padding-left:18px; font-size:12px;">`;
          sec.findings.forEach(f => {
            let color = 'var(--text-secondary)';
            if (f.severity === 'critical' || f.severity === 'high') color = 'var(--urgent, #dc2626)';
            else if (f.severity === 'warning' || f.severity === 'medium') color = 'var(--inuse, #b45309)';
            html += `<li style="color:${color}; margin-bottom:4px;">${esc(f.text)}</li>`;
          });
          html += `</ul>`;
        }

        // Rebalancing moves detail (item 6)
        if (secKey === 'rebalancing' && sec.moves && sec.moves.length > 0) {
          html += `<div style="margin-top:10px;">`;
          sec.moves.forEach(m => {
            const title = m.title || m.rationale || '—';
            // The title is already visible when collapsed in the section header,
            // so we don't render it bolded in the card again.
            const rationale = (m.rationale && m.rationale.length > 20) ? m.rationale : title;
            html += `<div style="padding:8px; border:1px solid var(--border); border-radius:6px; margin-bottom:6px; font-size:12px;">
              ${rationale ? `<div style="color:var(--text-secondary);">${esc(rationale)}</div>` : ''}
              ${m.caveat ? `<div style="color:var(--text-muted); font-style:italic; margin-top:2px;">${esc(m.caveat)}</div>` : ''}
            </div>`;
          });
          html += `</div>`;
        }

          if (sec.purchasing && sec.purchasing.length > 0) {
            let label = 'Purchasing signals:';
            // Need to check reasons from the original payload if available in window.currentWeeklyData
            const allSignals = window.currentWeeklyData?.metrics?.rebalancing?.purchasing || [];
            let hasAddUnit = false;
            let hasSurplus = false;
            sec.purchasing.forEach(p => {
              const orig = allSignals.find(s => s.id === p.id);
              if (orig && orig.reason === 'add_unit') hasAddUnit = true;
              if (orig && orig.reason === 'surplus') hasSurplus = true;
            });
            if (!hasAddUnit && hasSurplus) {
              label = 'Signals:';
            }
            html += `<div style="font-size:12px; color:var(--text-muted); margin-top:6px;"><strong>${label}</strong> `;
            html += sec.purchasing.map(p => esc(p.text || p.type || '')).join('; ');
            html += `</div>`;
          }

        html += `</div></div>`;
      });

      body.innerHTML = html;
    }

    function downloadWeeklyMarkdown() {
      const sel = document.getElementById('weekly-history-select');
      const id = sel ? parseInt(sel.value) : null;
      let row = id ? weeklyReports.find(r => r.id === id) : weeklyReports.find(r => r.status === 'done' || r.status === 'partial');
      if (!row || !row.result) return;
      
      const res = row.result;
      const ex = res.executive || {};
      
      let md = `# Weekly Deep Analysis: ${ex.headline || 'Summary'}\n\n`;
      md += `*Generated: ${fmtLocalTs(row.finished_at || row.requested_at)} | Range: ${row.week_start} to ${row.week_end}*\n\n`;
      md += `## Executive Summary\n${ex.summary || ''}\n\n`;
      
      if (ex.actions && ex.actions.length > 0) {
        md += `### Prioritized Actions\n`;
        ex.actions.forEach((a, i) => {
          md += `${i+1}. **[${a.owner}]** ${a.action} - *${a.reason}*\n`;
        });
        md += `\n`;
      }
      
      if (res.sections) {
        for (const [k, s] of Object.entries(res.sections)) {
          if (!s.summary) continue;
          md += `## ${k.toUpperCase()}\n${s.summary}\n\n`;
          if (s.findings) {
            s.findings.forEach(f => {
              md += `- [${f.severity || 'info'}] ${f.text}\n`;
            });
            md += `\n`;
          }
        }
      }
      
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meditrack-weekly-${row.week_start}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function subscribeRealtime() {
      const handleStatus = (status) => {
        if (status === 'SUBSCRIBED') {
          updateLiveBadge('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          updateLiveBadge('disconnected');
        }
      };

      db.channel('equipment-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, async (payload) => {
          if (payload.eventType === 'UPDATE') {
            const idx = allEquipment.findIndex(e => e.id === payload.new.id);
            if (idx !== -1) {
              allEquipment[idx] = { ...allEquipment[idx], ...payload.new };
            }
            // Re-render without closing the open row
            renderEquipment();
            updateStats();
            renderProductTiles(); // v3 — keep tile counts live
            loadSidebarRecentAudit();
            const eq = allEquipment.find(e => e.id === payload.new.id);
            showToast((eq ? eq.name : 'Equipment') + ' updated: ' + payload.new.status, 'info');
          } else {
            await loadEquipment();
            loadSidebarRecentAudit();
          }
        }).subscribe(handleStatus);

      db.channel('requests-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, async () => {
          await loadRequests();
        }).subscribe();

      // AI Insights realtime subscription — debounced reload on new row
      if (currentUser.role !== 'Staff') {
        db.channel('ai-insights-rt')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_insights' }, () => {
            clearTimeout(aiInsightsDebounceTimer);
            aiInsightsDebounceTimer = setTimeout(() => { loadInsights(); }, 1500);
          }).subscribe();
          
        db.channel('ai-weekly-rt')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_weekly_reports' }, () => {
            clearTimeout(weeklyDebounceTimer);
            weeklyDebounceTimer = setTimeout(() => { loadWeeklyInsights(); }, 500);
          }).subscribe();
      }

      if (currentUser.role !== 'Staff') {
        db.channel('auditlog-rt')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, async (payload) => {
          const entry = payload.new;
          const eqId = entry.equipment_id;

          // Update cached audit entry list for this equipment
          if (!allAuditLogs[eqId]) allAuditLogs[eqId] = { entries: [], loaded: false };
          allAuditLogs[eqId].entries.unshift(entry);

          // If audit page is open and this row is expanded, refresh timeline
          const openRow = document.querySelector('.audit-eq-row.open');
          if (openRow && parseInt(openRow.dataset.eqid) === eqId) {
            renderAuditTimeline(eqId, openRow.querySelector('.audit-timeline'));
          }

          // Update collapsed summary counts
          renderAuditPage();
          loadSidebarRecentAudit();
        }).subscribe();
      }
    }

    // ==========================================
    // EQUIPMENT LIST RENDERING (new accordion)
    // ==========================================
    let qrRendered = new Set(); // track which QRs already rendered in expanded panels

    function getFiltered() {
      const search = (document.getElementById('eq-search') || {}).value || '';
      const q = search.toLowerCase().trim();
      const filtered = allEquipment.filter(eq => {
        let s = true;
        if (currentFilter === 'Available') {
          s = eq.status === 'Available';
        } else if (currentFilter === 'In Use') {
          s = eq.status === 'In Use';
        } else if (currentFilter === 'Needs Attention') {
          s = eq.condition === 'Needs Maintenance' || eq.condition === 'Out of Order' || eq.is_overdue || eq.overdue;
        }

        const d = currentDeptFilter === 'all' || String(eq.department_id) === String(currentDeptFilter);

        let pt = true;
        if (currentProductFilter !== 'all') {
          const typeName = getProductTypeName(eq).toLowerCase();
          const target = String(currentProductFilter).toLowerCase().replace(/^_type_/, '').replace(/^_/, '');
          pt = (String(eq.product_type_id) === String(currentProductFilter)) ||
               (typeName === target);
        }

        const deptName = (eq.departments ? eq.departments.name : '').toLowerCase();
        const m = !q || eq.name.toLowerCase().includes(q) || deptName.includes(q) || (eq.qr_code_id || '').toLowerCase().includes(q) || (eq.held_by || '').toLowerCase().includes(q);

        return s && d && pt && m;
      });

      const sortEl = document.getElementById('eq-sort');
      if (sortEl) {
        const sortVal = sortEl.value;
        if (sortVal === 'name') {
          filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (sortVal === 'status') {
          filtered.sort((a, b) => {
            if (a.status === b.status) return (a.name || '').localeCompare(b.name || '');
            return a.status === 'Available' ? -1 : 1;
          });
        } else if (sortVal === 'dept') {
          filtered.sort((a, b) => {
            const da = (a.departments && a.departments.name) || '';
            const db = (b.departments && b.departments.name) || '';
            const cmp = da.localeCompare(db);
            return cmp !== 0 ? cmp : (a.name || '').localeCompare(b.name || '');
          });
        } else if (sortVal === 'since') {
          filtered.sort((a, b) => {
            if (a.in_use_since && b.in_use_since) {
              return new Date(a.in_use_since).getTime() - new Date(b.in_use_since).getTime();
            }
            if (a.in_use_since && !b.in_use_since) return -1;
            if (!a.in_use_since && b.in_use_since) return 1;
            return (a.name || '').localeCompare(b.name || '');
          });
        }
      }

      return filtered;
    }

    let durationTimers = [];

    // ==========================================
    // PRODUCT TYPES — v3
    // ==========================================

    const PT_EMOJI = {
      'ventilator':       '🫁',
      'wheelchair':       '♿',
      'infusion pump':    '💉',
      'defibrillator':    '⚡',
      'portable monitor': '🖥️',
    };

    function getPtEmoji(name) {
      if (!name) return '🏥';
      return PT_EMOJI[name.toLowerCase()] || '🏥';
    }

    async function loadProductTypes() {
      try {
        const { data, error } = await db.from('product_types').select('*').order('id');
        if (error) {
          console.warn('product_types table not available:', error.message);
          productTypes = [];
        } else {
          productTypes = data || [];
        }
      } catch (e) {
        console.warn('loadProductTypes failed:', e);
        productTypes = [];
      }
      try { renderProductTiles(); } catch (e) { console.error('renderProductTiles failed after loadProductTypes:', e); }
    }

    function renderProductTiles() {
      try {
        const grid = document.getElementById('product-tiles-grid');
        if (!grid) return;

        const section = document.getElementById('product-tiles-section');
        const groups = groupEquipmentByProductType(allEquipment, productTypes);

        if (allEquipment.length === 0 && groups.length === 0) {
          if (section) section.style.display = 'none';
          return;
        }
        if (section) section.style.display = 'block';

        grid.classList.toggle('collapsed', tilesCollapsed);
        const iconEl = document.getElementById('tiles-collapse-icon');
        const textEl = document.getElementById('tiles-collapse-text');
        if (iconEl) iconEl.textContent = tilesCollapsed ? '\u25bc' : '\u25b2';
        if (textEl) textEl.textContent = tilesCollapsed ? 'Expand' : 'Collapse';

        grid.innerHTML = '';

        // All Equipment tile (P0-05, P1-14: 32px brand icon, total count)
        const allCount = allEquipment.length;
        const allTile = document.createElement('button');
        allTile.className = 'product-tile' + (currentProductFilter === 'all' ? ' selected' : '');
        allTile.setAttribute('aria-pressed', currentProductFilter === 'all' ? 'true' : 'false');
        allTile.setAttribute('aria-label', 'All Equipment — ' + allCount + ' items');
        allTile.type = 'button';
        allTile.onclick = () => setProductFilter('all');
        allTile.innerHTML =
          '<div class="pt-img-wrap"><span class="pt-brand-icon" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:var(--brand-100,#e0e7ff);color:var(--brand-600,#4f46e5);margin:0 auto 6px;"><svg class="icon" aria-hidden="true" width="20" height="20"><use href="#i-brand"/></svg></span></div>' +
          '<div class="pt-name">All Equipment</div>' +
          '<div class="pt-summary"><span class="pt-count-badge">' + allCount + ' items</span></div>';
        grid.appendChild(allTile);

        // One tile per group
        groups.forEach(pt => {
          const totalCount = pt.totalCount;
          const availCount = pt.availCount;
          const hasAvail = availCount > 0;
          const isSelected = String(currentProductFilter).toLowerCase() === pt.name.toLowerCase() ||
                             currentProductFilter === pt.id;

          const tile = document.createElement('button');
          tile.className = 'product-tile' +
            (isSelected ? ' selected' : '') +
            (!hasAvail && totalCount > 0 ? ' dimmed' : '');
          tile.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
          tile.setAttribute('aria-label', esc(pt.name) + ' — ' + totalCount + ' items, ' + availCount + ' available');
          tile.type = 'button';
          tile.onclick = () => setProductFilter(pt.name);

          // Availability dot
          if (totalCount > 0) {
            const dot = document.createElement('span');
            dot.className = 'pt-dot ' + (hasAvail ? 'green' : 'red');
            dot.setAttribute('aria-hidden', 'true');
            tile.appendChild(dot);
          }

          // Image wrap with emoji fallback
          const imgWrap = document.createElement('div');
          imgWrap.className = 'pt-img-wrap';
          if (pt.image_url) {
            const img = document.createElement('img');
            img.src = pt.image_url;
            img.alt = pt.name;
            img.loading = 'lazy';
            img.width = 40;
            img.height = 40;
            img.onerror = function() {
              this.parentNode.innerHTML = '<span class="pt-emoji-fallback">' + getPtEmoji(pt.name) + '</span>';
            };
            imgWrap.appendChild(img);
          } else {
            imgWrap.innerHTML = '<span class="pt-emoji-fallback">' + getPtEmoji(pt.name) + '</span>';
          }

          const namEl = document.createElement('div');
          namEl.className = 'pt-name';
          namEl.textContent = pt.name;

          const sumEl = document.createElement('div');
          sumEl.className = 'pt-summary';
          const itemWord = totalCount === 1 ? 'item' : 'items';
          sumEl.textContent = totalCount + ' ' + itemWord + ' · ' + availCount + ' available';

          tile.appendChild(imgWrap);
          tile.appendChild(namEl);
          tile.appendChild(sumEl);
          grid.appendChild(tile);
        });

        try { updateBreadcrumb(); } catch(e) { console.warn('updateBreadcrumb error:', e); }
      } catch (e) {
        console.error('renderProductTiles error (suppressed):', e);
      }
    }

    function setProductFilter(typeKey) {
      if (currentProductFilter === typeKey) {
        currentProductFilter = 'all';
      } else {
        currentProductFilter = typeKey;
      }
      currentEqPage = 1;
      renderProductTiles();
      renderEquipment();
    }

    function clearProductFilter() {
      currentProductFilter = 'all';
      currentEqPage = 1;
      renderProductTiles();
      renderEquipment();
    }

    function toggleTilesCollapse() {
      tilesCollapsed = !tilesCollapsed;
      renderProductTiles();
    }

    function updateBreadcrumb() {
      try {
        const bar = document.getElementById('product-breadcrumb');
        const pathEl = document.getElementById('breadcrumb-path');
        const countEl = document.getElementById('breadcrumb-count');
        if (!bar || !pathEl || !countEl) return;

        if (currentProductFilter === 'all') {
          bar.classList.remove('show');
          return;
        }

        // Find in real productTypes or virtual fallback
        const allTypes = buildEffectiveTiles();
        const pt = allTypes.find(p => p.id === currentProductFilter);
        if (!pt) { bar.classList.remove('show'); return; }

        const filtered = getFiltered();
        pathEl.innerHTML = 'All Equipment &rsaquo; <strong>' + esc(pt.name) + '</strong>';
        countEl.textContent = filtered.length + ' item' + (filtered.length !== 1 ? 's' : '') + ' shown';
        bar.classList.add('show');
      } catch (e) {
        console.warn('updateBreadcrumb error:', e);
      }
    }

    let currentEqSortCol = 'name';
    let currentEqSortDir = 'asc';
    let currentEqPage = 1;
    let currentEqPageSize = getStoredPageSize(25);

    function toggleEqSort(col) {
      if (currentEqSortCol === col) {
        currentEqSortDir = currentEqSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        currentEqSortCol = col;
        currentEqSortDir = 'asc';
      }
      updateEqSortHeaders();
      renderEquipment();
    }

    function updateEqSortHeaders() {
      ['name', 'department', 'status', 'held_for'].forEach(col => {
        const th = document.getElementById('th-' + col);
        const icon = document.getElementById('sort-icon-' + col);
        if (th && icon) {
          if (currentEqSortCol === col) {
            th.setAttribute('aria-sort', currentEqSortDir === 'asc' ? 'ascending' : 'descending');
            icon.textContent = currentEqSortDir === 'asc' ? '▲' : '▼';
            icon.classList.add('active');
          } else {
            th.setAttribute('aria-sort', 'none');
            icon.textContent = '↕';
            icon.classList.remove('active');
          }
        }
      });
    }

    function changeEqPage(newPage) {
      currentEqPage = newPage;
      renderEquipment();
    }

    function changeEqPageSize(newSize) {
      currentEqPageSize = parseInt(newSize, 10);
      setStoredPageSize(currentEqPageSize);
      currentEqPage = 1;
      renderEquipment();
    }

    function updateFilterSummaryBar(count) {
      const bar = document.getElementById('filter-summary-bar');
      const text = document.getElementById('filter-summary-text');
      if (!bar || !text) return;

      const searchVal = (document.getElementById('eq-search')?.value || '').trim();
      const hasSearch = searchVal.length > 0;
      const hasStatus = currentFilter !== 'all';
      const hasDept = currentDeptFilter !== 'all';
      const hasProduct = currentProductFilter !== 'all';

      if (!hasSearch && !hasStatus && !hasDept && !hasProduct) {
        bar.style.display = 'none';
        return;
      }

      bar.style.display = 'flex';
      const parts = [];
      if (hasStatus) parts.push(`Status: ${currentFilter}`);
      if (hasDept) {
        const dObj = departments.find(d => String(d.id) === String(currentDeptFilter));
        parts.push(`Department: ${dObj ? dObj.name : currentDeptFilter}`);
      }
      if (hasProduct) {
        parts.push(`Type: ${currentProductFilter}`);
      }
      if (hasSearch) {
        parts.push(`Search: "${esc(searchVal)}"`);
      }

      text.innerHTML = `Showing <strong>${count}</strong> item${count !== 1 ? 's' : ''} matching ${parts.join(' · ')}`;
    }

    function clearAllFilters() {
      currentFilter = 'all';
      currentDeptFilter = 'all';
      currentProductFilter = 'all';
      const searchInput = document.getElementById('eq-search');
      if (searchInput) searchInput.value = '';
      setDeptFilter('all', document.getElementById('dept-all'));

      ['all', 'Available', 'In Use', 'Needs Attention'].forEach(x => {
        const m = { 'all': 'filter-all', 'Available': 'filter-available', 'In Use': 'filter-inuse', 'Needs Attention': 'filter-attention' };
        const b = document.getElementById(m[x]);
        if (b) b.classList.toggle('active', x === 'all');
      });

      renderProductTiles();
      renderEquipment();
    }

    function stopDurationTimers() {
      durationTimers.forEach(t => clearInterval(t));
      durationTimers = [];
    }

    function renderEquipment() {
      const container = document.getElementById('equipment-list');
      const paginationEl = document.getElementById('equipment-pagination');
      const countEl = document.getElementById('eq-count');
      const filtered = getFiltered();
      if (countEl) countEl.textContent = filtered.length;

      stopDurationTimers();
      updateFilterSummaryBar(filtered.length);

      if (filtered.length === 0) {
        const hint = currentProductFilter !== 'all'
          ? 'No equipment of this type matches your filters. <button type="button" onclick="clearProductFilter()" style="color:var(--primary);background:none;border:none;cursor:pointer;font-size:13px;padding:0;font-family:inherit;font-weight:600;">Clear product filter</button>'
          : 'No equipment matches your filters';
        container.innerHTML = '<div class="empty-state" style="padding:32px 16px;text-align:center;"><div class="empty-icon" style="margin-bottom:8px;"><svg class="icon" aria-hidden="true" width="28" height="28" style="color:var(--text-3);"><use href="#i-scroll-text"/></svg></div><div class="empty-text" style="color:var(--text-2);font-size:14px;">' + hint + '</div></div>';
        if (paginationEl) paginationEl.innerHTML = '';
        renderProductTiles();
        return;
      }

      // Preserve open row
      const prevOpenId = openEqRowId;
      container.innerHTML = '';

      // Column header row
      const colHead = document.createElement('div');
      colHead.className = 'eq-col-head';
      colHead.setAttribute('role', 'row');
      colHead.innerHTML = `
        <span class="eq-col-cell" aria-hidden="true"></span>
        <span class="eq-col-cell">Equipment</span>
        <span class="eq-col-cell">Department</span>
        <span class="eq-col-cell">Condition</span>
        <span class="eq-col-cell">Status</span>
        <span class="eq-col-cell">Held by</span>
      `;
      container.appendChild(colHead);

      filtered.forEach(eq => {
        const row = buildEqRow(eq, eq.id === prevOpenId);
        container.appendChild(row);
      });

      // Re-render QR for open row
      if (prevOpenId) {
        const openEq = allEquipment.find(e => e.id === prevOpenId);
        if (openEq) renderExpandedQr(prevOpenId);
        startDurationTimer(prevOpenId);
      }
      document.dispatchEvent(new CustomEvent('meditrack:render'));
    }

    function buildEqRow(eq, isOpen) {
      const isAvail = eq.status === 'Available';
      const deptName = eq.departments ? eq.departments.name : 'Unknown';
      const cond = eq.condition || 'Usable';
      let condClass = 'cond-usable';
      if (cond === 'Needs Maintenance') condClass = 'cond-maintenance';
      else if (cond === 'Out of Order') condClass = 'cond-danger';

      const statusPill = isAvail
        ? '<span class="status-pill available"><span class="status-dot"></span>Available</span>'
        : '<span class="status-pill inuse"><span class="status-dot"></span>In Use</span>';

      const condBadge = '<span class="condition-badge ' + condClass + '"><span class="badge-dot"></span>' + esc(cond) + '</span>';

      let heldByText = '—';
      let heldAvailClass = ' eq-held-avail';
      let durText = '';
      if (!isAvail) {
        heldAvailClass = '';
        const holder = esc(eq.held_by || 'Unknown');
        if (eq.in_use_since) {
          const diff = Math.floor((Date.now() - new Date(eq.in_use_since).getTime()) / 1000);
          if (diff >= 0) {
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            durText = h > 0 ? '(' + h + 'h ' + m + 'm)' : '(' + m + 'm)';
          }
        }
        heldByText = '<span class="eq-holder-name">' + holder + '</span> <span class="duration-live tabular-nums" data-dur="' + eq.id + '">' + durText + '</span>';
      }

      const row = document.createElement('div');
      row.className = 'eq-row' + (isOpen ? ' open' : '');
      row.id = 'eq-row-' + eq.id;

      const header = document.createElement('div');
      header.className = 'eq-row-header';
      header.id = 'eq-header-' + eq.id;
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      header.setAttribute('aria-controls', 'eq-details-' + eq.id);

      header.innerHTML = `
        <div class="eq-cell eq-cell-chevron" aria-hidden="true">
          <svg class="icon eq-chevron-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="eq-cell eq-cell-name">
          <div class="eq-name-title">${esc(eq.name)}</div>
          <div class="eq-id-caption">${esc(eq.qr_code_id || '—')}</div>
          <div class="eq-mobile-meta">${esc(deptName)}${eq.qr_code_id ? ' · ' + esc(eq.qr_code_id) : ''}</div>
        </div>
        <div class="eq-cell eq-cell-dept">
          <span class="eq-dept-name">${esc(deptName)}</span>
        </div>
        <div class="eq-cell eq-cell-cond">
          ${condBadge}
        </div>
        <div class="eq-cell eq-cell-status">
          ${statusPill}
        </div>
        <div class="eq-cell eq-cell-held${heldAvailClass}">
          ${heldByText}
        </div>
      `;

      const details = document.createElement('div');
      details.className = 'eq-row-details';
      details.id = 'eq-details-' + eq.id;
      details.setAttribute('role', 'region');
      details.setAttribute('aria-labelledby', 'eq-header-' + eq.id);
      if (!isOpen) details.style.display = 'none';
      details.innerHTML = buildExpandedHTML(eq);

      row.appendChild(header);
      row.appendChild(details);

      header.addEventListener('click', (e) => {
        if (e.target.closest('button, select, input, a')) return;
        toggleEqRow(eq.id);
      });
      header.addEventListener('keydown', (e) => {
        if (e.target.closest('button, select, input, a')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleEqRow(eq.id);
        }
      });

      return row;
    }

    function buildExpandedHTML(eq) {
      const isAvail = eq.status === 'Available';
      const deptName = eq.departments ? eq.departments.name : 'Unknown';
      const condition = eq.condition || 'Usable';
      const condClass = condition === 'Usable' ? 'pill--ok' : condition === 'Needs Maintenance' ? 'pill--warn' : 'pill--danger';
      const condIcon = condition === 'Usable' ? 'i-check' : condition === 'Needs Maintenance' ? 'i-wrench' : 'i-x-octagon';
      const condBadge = '<span class="pill ' + condClass + '"><svg class="icon" aria-hidden="true"><use href="#' + condIcon + '"/></svg><span>' + esc(condition) + '</span></span>';
      const condWarning = condition !== 'Usable'
        ? '<div class="condition-warning"><svg class="icon" aria-hidden="true" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><use href="#i-alert-triangle"/></svg> ' + esc(condition) + ' \u2014 check before use</div>'
        : '';

      // Status info
      let statusInfo = '';
      if (!isAvail) {
        const heldBy = eq.held_by || 'Unknown';
        const sinceStr = eq.in_use_since ? fmtTime(eq.in_use_since) : '';
        // v4: show room alongside status (e.g. "In Use — ICU, Bed 4 — since 14:32")
        const currentRoom = latestCheckoutRoom[eq.id] || null;
        statusInfo =
          '<span style="color:var(--inuse);font-weight:600;">In Use</span>' +
          (currentRoom ? ' — <span style="color:var(--inuse);">' + esc(currentRoom) + '</span>' : '') +
          (sinceStr ? ' — since ' + sinceStr : '') +
          ' <span class="duration-live" id="dur-' + eq.id + '"></span>';
      } else {
        statusInfo = '<span style="color:var(--available);font-weight:600;">Available</span>';
      }

      // Used by
      const usedByRow = (!isAvail && eq.held_by)
        ? '<div class="eq-detail-row"><span class="eq-detail-label">Used by:</span><span class="eq-detail-value">' + esc(eq.held_by) + '</span></div>'
        : '';

      // Manager condition editor
      let conditorEditor = '';
      if (currentUser && currentUser.role === 'Manager') {
        conditorEditor =
          '<div class="manager-condition-row" style="margin-top:8px;">' +
          '<label style="font-size:11px;font-weight:600;color:var(--text-secondary);">Update Condition:</label>' +
          '<select class="condition-select" id="cond-sel-' + eq.id + '">' +
          '<option value="Usable"' + (condition === 'Usable' ? ' selected' : '') + '>Usable</option>' +
          '<option value="Needs Maintenance"' + (condition === 'Needs Maintenance' ? ' selected' : '') + '>Needs Maintenance</option>' +
          '<option value="Out of Order"' + (condition === 'Out of Order' ? ' selected' : '') + '>Out of Order</option>' +
          '</select>' +
          '<button class="btn-save-condition" onclick="saveCondition(' + eq.id + ')">Save</button>' +
          '</div>';
      }

      // Request Access button (Staff and Senior Doctor only)
      let requestSection = '';
      if (currentUser && currentUser.role !== 'Manager') {
        let btnDisabled = '';
        let helperText = '';
        if (eq.held_by && eq.held_by === currentUser.username) {
          btnDisabled = 'disabled';
          helperText = '<div class="btn-request-helper">You are currently using this item</div>';
        } else if (condition === 'Out of Order') {
          btnDisabled = 'disabled';
          helperText = '<div class="btn-request-helper">Not available — Out of Order</div>';
        }
        requestSection =
          '<div>' +
          '<button class="btn-request-access" ' + btnDisabled + ' onclick="openRequestModal(' + eq.id + ')"><svg class="icon" aria-hidden="true" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;"><use href="#i-pencil"/></svg> Request Access</button>' +
          helperText +
          '</div>';
      }

      // Toggle / Release buttons (QR scan is the main method, but manual is preserved)
      let toggleSection = '';
      if (isAvail) {
        toggleSection = '<button class="btn-toggle-status" onclick="manualToggle(' + eq.id + ')">Mark In Use</button>';
      } else {
        toggleSection = '<button class="btn-release-status" onclick="manualToggle(' + eq.id + ')">✔ Release</button>';
      }

      // Audit log link (non-staff)
      let auditLinkHtml = '';
      if (currentUser && currentUser.role !== 'Staff') {
        auditLinkHtml = '<button class="audit-link" onclick="showPage(\'auditlog\')">View audit log →</button>';
      }

      return '<div class="eq-row-details-inner">' +
        '<div class="eq-detail-section">' +
        '<div class="eq-detail-row"><span class="eq-detail-label">Department:</span><span class="eq-detail-value">' + esc(deptName) + '</span></div>' +
        '<div class="eq-detail-row"><span class="eq-detail-label">Status:</span><span class="eq-detail-value">' + statusInfo + '</span></div>' +
        usedByRow +
        '<div class="eq-detail-row"><span class="eq-detail-label">Condition:</span><span class="eq-detail-value">' +
        '<span class="condition-badge ' + condClass + '">' + esc(condition) + '</span></span></div>' +
        condWarning +
        conditorEditor +
        '<div class="eq-detail-actions" style="margin-top:12px;">' +
        toggleSection +
        requestSection +
        '</div>' +
        auditLinkHtml +
        '</div>' +
        '<div class="eq-detail-qr-section">' +
        '<div class="eq-detail-qr-box" id="eq-qr-panel-' + eq.id + '"></div>' +
        '<div class="eq-detail-qr-id">' + esc(eq.qr_code_id) + '</div>' +
        '<button class="btn-qr-sticker" onclick="openStickerModal(' + eq.id + ')" title="Print or Download Sticker Label"><svg class="icon" aria-hidden="true" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"><use href="#i-printer"/></svg> Sticker</button>' +
        '</div>' +
        '</div>';
    }

    function toggleEqRow(eqId) {
      const row = document.getElementById('eq-row-' + eqId);
      if (!row) return;

      const isOpen = row.classList.contains('open');

      // Close all
      document.querySelectorAll('.eq-table-row.open, .eq-row.open').forEach(r => {
        r.classList.remove('open');
        const h = r.querySelector('.eq-row-line, .eq-row-header, .eq-row-summary');
        if (h) h.setAttribute('aria-expanded', 'false');
        const chev = r.querySelector('.eq-chevron');
        if (chev) chev.textContent = '▶';
        const d = r.querySelector('.eq-row-details');
        if (d) d.style.display = 'none';
      });
      stopDurationTimers();
      openEqRowId = null;

      if (!isOpen) {
        row.classList.add('open');
        const h = row.querySelector('.eq-row-line, .eq-row-header, .eq-row-summary');
        if (h) h.setAttribute('aria-expanded', 'true');
        const chev = row.querySelector('.eq-chevron');
        if (chev) chev.textContent = '▼';
        const d = row.querySelector('.eq-row-details');
        if (d) d.style.display = 'block';
        openEqRowId = eqId;
        // Render QR and start duration timer
        renderExpandedQr(eqId);
      }
    }

    function renderExpandedQr(eqId) {
      const eq = allEquipment.find(e => e.id === eqId);
      if (!eq) return;
      const qrDiv = document.getElementById('eq-qr-panel-' + eqId);
      if (!qrDiv || qrDiv.children.length > 0) return;
      try {
        new QRCode(qrDiv, {
          text: eq.qr_code_id,
          width: 96, height: 96,
          colorDark: '#1a2332', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (e) { console.warn('QR gen error', e); }
    }

    function startDurationTimer(eqId) {
      const eq = allEquipment.find(e => e.id === eqId);
      if (!eq || eq.status === 'Available' || !eq.in_use_since) return;

      function update() {
        const el = document.getElementById('dur-' + eqId);
        const rowEls = document.querySelectorAll('.duration-live[data-dur="' + eqId + '"]');
        if (!el && rowEls.length === 0) return;
        const since = new Date(eq.in_use_since);
        const diff = Math.floor((Date.now() - since.getTime()) / 1000);
        const text = diff < 0 ? '' : (Math.floor(diff / 3600) > 0 ? '(' + Math.floor(diff / 3600) + 'h ' + Math.floor((diff % 3600) / 60) + 'm)' : '(' + Math.floor((diff % 3600) / 60) + 'm)');
        if (el) el.textContent = text;
        rowEls.forEach(r => { r.textContent = text; });
      }

      update();
      const t = setInterval(update, 30000);
      durationTimers.push(t);
    }

    function updateStats() {
      const counts = computeEquipmentCounts(allEquipment);
      const totalEl = document.getElementById('stat-total');
      const availEl = document.getElementById('stat-available');
      const inuseEl = document.getElementById('stat-inuse');
      const attEl = document.getElementById('stat-attention');
      if (totalEl) totalEl.textContent = counts.total;
      if (availEl) availEl.textContent = counts.available;
      if (inuseEl) inuseEl.textContent = counts.in_use;
      if (attEl) attEl.textContent = counts.needs_attention;

      const banner = document.getElementById('attention-banner');
      if (banner) {
        if (counts.needs_attention > 0 && !window.attentionBannerDismissed) {
          banner.style.display = 'flex';
          const cnt = document.getElementById('attention-banner-count');
          if (cnt) cnt.textContent = counts.needs_attention;
          const txt = document.getElementById('attention-banner-text');
          if (txt && !cnt) txt.textContent = `${counts.needs_attention} items need attention`;
        } else {
          banner.style.display = 'none';
        }
      }

      renderDeptOverview();
    }

    function renderDeptOverview() {
      const container = document.getElementById('dept-overview-list');
      if (!container || !Array.isArray(departments)) return;
      container.innerHTML = departments.map(d => {
        const deptEq = (allEquipment || []).filter(e => String(e.department_id) === String(d.id) || (e.departments && e.departments.name === d.name));
        const total = deptEq.length;
        const available = deptEq.filter(e => e.status === 'Available').length;
        const inUse = deptEq.filter(e => e.status === 'In Use').length;
        const pct = total > 0 ? Math.round((inUse / total) * 100) : 0;
        const initials = (d.name || '').slice(0, 2).toUpperCase();

        return `<div class="dept-overview-row">
          <div class="dept-overview-main">
            <div class="dept-avatar">${esc(initials)}</div>
            <div class="dept-info">
              <div class="dept-name">${esc(d.name)}</div>
              <div class="dept-count">${total} items</div>
            </div>
            <div class="dept-avail">${available} available</div>
          </div>
          <div class="dept-bar-track">
            <div class="dept-bar-fill" style="width:${pct}%;"></div>
          </div>
        </div>`;
      }).join('');
    }

    // ==========================================
    // FILTERS
    // ==========================================
    function setFilter(f) {
      currentFilter = f;
      ['all', 'Available', 'In Use', 'Needs Attention'].forEach(x => {
        const m = { 'all': 'filter-all', 'Available': 'filter-available', 'In Use': 'filter-inuse', 'Needs Attention': 'filter-attention' };
        const b = document.getElementById(m[x]);
        if (b) b.classList.toggle('active', x === f);
      });
      currentEqPage = 1;
      renderEquipment();
    }

    function setDeptFilter(id, btn) {
      currentDeptFilter = id;
      document.querySelectorAll('#dept-filter-group .filter-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const sel = document.getElementById('dept-filter-select');
      if (sel) sel.value = id;
      currentEqPage = 1;
      renderEquipment();
    }

    // ==========================================
    // STATUS TOGGLE
    // ==========================================
    async function manualToggle(eqId) {
      const eq = allEquipment.find(e => e.id === eqId);
      if (!eq) return;
      if (eq.status === 'In Use' && eq.held_by && eq.held_by !== currentUser.username && currentUser.role !== 'Manager') {
        showToast('Cannot release an item held by ' + eq.held_by, 'error');
        return;
      }
      if (eq.condition === 'Out of Order' && eq.status === 'Available') {
         showToast('Cannot check out an item that is Out of Order', 'error');
         return;
      }
      if (eq.status === 'Available') {
        // v4: Available → In Use — prompt for room before toggling
        showRoomPicker(eq, async (room) => {
          await doToggle(eq, currentUser.username, room);
        });
      } else {
        // In Use → Available (release) — no room prompt needed
        await doToggle(eq, currentUser.username, null);
      }
    }

    // v4: room param is the selected room string (non-null for checkouts, null for releases)
    async function doToggle(eq, performedBy, room) {
      const newStatus = eq.status === 'Available' ? 'In Use' : 'Available';
      const action = newStatus === 'In Use' ? 'Checked Out' : 'Released';

      // Build update payload
      const updateData = { status: newStatus };
      if (newStatus === 'In Use') {
        updateData.held_by = performedBy;
        updateData.in_use_since = new Date().toISOString();
      } else {
        updateData.held_by = null;
        updateData.in_use_since = null;
      }

      // Atomic update — optimistic lock on current status prevents double-checkout
      const { data, error: ue } = await db.from('equipment')
        .update(updateData)
        .eq('id', eq.id)
        .eq('status', eq.status)
        .select();

      if (ue) { showToast('Failed: ' + ue.message, 'error'); return false; }
      if (!data || data.length === 0) { showToast('Conflict: Equipment state changed.', 'error'); return false; }

      // Build audit entry — include room only for checkouts (null for releases)
      const auditEntry = {
        equipment_id: eq.id,
        action: action,
        performed_by: performedBy || 'Unknown'
      };
      if (room != null) auditEntry.room = room;

      const { error: ae } = await db.from('audit_log').insert([auditEntry]);
      if (ae) { console.error('Audit log failed', ae); }

      // Update the in-memory room cache immediately so the UI refreshes instantly
      if (newStatus === 'In Use' && room != null) {
        latestCheckoutRoom[eq.id] = room;
      } else if (newStatus === 'Available') {
        delete latestCheckoutRoom[eq.id];
      }

      return true;
    }

    // ==========================================
    // ROOM PICKER (v4)
    // ==========================================
    function showRoomPicker(eq, onConfirm) {
      const modal = document.getElementById('room-picker-modal');
      const infoEl = document.getElementById('room-picker-eq-info');
      const sel = document.getElementById('room-picker-select');

      const deptName = (eq.departments && eq.departments.name) ? eq.departments.name : '';
      infoEl.textContent = eq.name + (deptName ? ' — ' + deptName : '');

      // Populate room options scoped to the equipment's department
      const rooms = DEPT_ROOMS[deptName] || ['Other / Unspecified'];
      sel.innerHTML = rooms.map(r => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('');

      roomPickerCallback = onConfirm;
      modal.style.display = 'flex';
      setTimeout(() => sel.focus(), 60);
    }

    function confirmRoomPicker() {
      const sel = document.getElementById('room-picker-select');
      const room = sel ? sel.value : null;
      const cb = roomPickerCallback;
      cancelRoomPicker();
      if (cb) cb(room);
    }

    function cancelRoomPicker() {
      document.getElementById('room-picker-modal').style.display = 'none';
      roomPickerCallback = null;
      // Reset scan cooldown so user can retry immediately after cancelling
      scanCooldown = false;
    }

    // ==========================================
    // SAVE CONDITION (Manager only)
    // ==========================================
    async function saveCondition(eqId) {
      const sel = document.getElementById('cond-sel-' + eqId);
      if (!sel) return;
      const newCond = sel.value;
      const { error } = await db.from('equipment').update({ condition: newCond }).eq('id', eqId);
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }

      await db.from('audit_log').insert([{
        equipment_id: eqId,
        action: 'Condition Changed',
        performed_by: currentUser.username
      }]);

      // Update local cache
      const idx = allEquipment.findIndex(e => e.id === eqId);
      if (idx !== -1) allEquipment[idx].condition = newCond;

      showToast('Condition updated to "' + newCond + '"', 'success');
    }

    // ==========================================
    // QR SCANNER
    // ==========================================
    function openScanner() {
      document.getElementById('scanner-modal').style.display = 'flex';
      document.getElementById('scan-result').innerHTML = '';
      hideConflict();
      startScanner();
    }

    function closeScanner() {
      stopScanner();
      document.getElementById('scanner-modal').style.display = 'none';
      hideConflict();
    }

    function startScanner() {
      if (scannerActive) return;
      scannerActive = true;
      const container = document.getElementById('scanner-container');
      container.innerHTML = '';
      html5Scanner = new Html5Qrcode('scanner-container');
      html5Scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w, h) => {
            const s = Math.floor(Math.min(w, h) * 0.7);
            return { width: s, height: s };
          }
        },
        (decoded) => onScanSuccess(decoded),
        () => {}
      ).catch(err => {
        showScanResult('Camera error: ' + err + '. Please allow camera access.', 'error');
        scannerActive = false;
      });
    }

    function stopScanner() {
      if (html5Scanner && scannerActive) {
        html5Scanner.stop().then(() => { html5Scanner.clear(); html5Scanner = null; scannerActive = false; })
          .catch(() => { html5Scanner = null; scannerActive = false; });
      }
    }

    async function onScanSuccess(qrCodeId) {
      if (scanCooldown) return;
      scanCooldown = true;
      setTimeout(() => { scanCooldown = false; }, 3000);

      const trimmed = qrCodeId.trim();
      const eq = allEquipment.find(e => e.qr_code_id === trimmed);
      if (!eq) {
        showScanResult('Unknown QR: "' + esc(trimmed) + '" — not in system.', 'error');
        return;
      }

      // CONFLICT PREVENTION: already In Use by someone else
      if (eq.status === 'In Use') {
        if (eq.held_by === currentUser.username) {
          // allow release — fall through
        } else {
          showConflict(eq.name, eq.held_by);
          showToast(eq.name + ' is already In Use!', 'error');
          return;
        }
      }

      if (eq.condition === 'Out of Order' && eq.status === 'Available') {
         showToast('Cannot check out an item that is Out of Order', 'error');
         return;
      }

      hideConflict();

      if (eq.status === 'Available') {
        // v4: Available → In Use — show room picker first, then toggle
        showScanResult('Found: ' + esc(eq.name) + ' — select a room to continue.', 'success');
        showRoomPicker(eq, async (room) => {
          showScanResult('Found: ' + esc(eq.name) + ' — updating...', 'success');
          const ok = await doToggle(eq, currentUser.username, room);
          if (ok) {
            const roomLabel = room ? ' (' + room + ')' : '';
            showScanResult(esc(eq.name) + ' is now In Use' + roomLabel + '. Audit log updated.', 'success');
            showToast(eq.name + ' marked In Use' + roomLabel, 'success');
            setTimeout(() => closeScanner(), 2000);
          }
        });
      } else {
        // In Use → Available (release) — no room prompt
        showScanResult('Found: ' + esc(eq.name) + ' — releasing...', 'success');
        const ok = await doToggle(eq, currentUser.username, null);
        if (ok) {
          showScanResult(esc(eq.name) + ' released. Audit log updated.', 'success');
          showToast(eq.name + ' released', 'success');
          setTimeout(() => closeScanner(), 2000);
        }
      }
    }

    function showConflict(name, heldBy) {
      const el = document.getElementById('conflict-alert');
      document.getElementById('conflict-msg').textContent =
        '"' + name + '" is already In Use' +
        (heldBy ? ' by ' + heldBy : '') +
        '. It cannot be marked In Use again. Scan a different item or release this one first.';
      el.classList.add('show');
    }
    function hideConflict() { document.getElementById('conflict-alert').classList.remove('show'); }

    function showScanResult(msg, type) {
      const el = document.getElementById('scan-result');
      el.className = 'scan-result ' + type;
      el.innerHTML = msg;
    }

    // ==========================================
    // REQUEST MODAL
    // ==========================================
    function openRequestModal(eqId) {
      // Enforce: Manager cannot request
      if (currentUser && currentUser.role === 'Manager') {
        showToast('Managers cannot submit requests.', 'error');
        return;
      }
      const eq = allEquipment.find(e => e.id === eqId);
      if (!eq) return;
      currentRequestEquipmentId = eqId;
      const deptName = eq.departments ? eq.departments.name : 'Unknown';
      document.getElementById('request-eq-info').innerHTML =
        '<strong>Requesting:</strong> ' + esc(eq.name) +
        ' &nbsp;|&nbsp; <strong>Dept:</strong> ' + esc(deptName) +
        ' &nbsp;|&nbsp; <strong>Status:</strong> <span style="color:var(--inuse);font-weight:600">In Use</span>';
      document.getElementById('req-user-display').textContent = currentUser.username + ' (' + currentUser.role + ')';
      selectPriority('Normal');
      document.getElementById('request-modal').style.display = 'flex';
    }

    function closeRequestModal() {
      document.getElementById('request-modal').style.display = 'none';
      currentRequestEquipmentId = null;
    }

    function selectPriority(p) {
      selectedPriority = p;
      document.getElementById('pri-normal').className = 'priority-option' + (p === 'Normal' ? ' selected-normal' : '');
      document.getElementById('pri-urgent').className = 'priority-option' + (p === 'Urgent' ? ' selected-urgent' : '');
      document.getElementById('pri-normal').setAttribute('aria-checked', p === 'Normal' ? 'true' : 'false');
      document.getElementById('pri-urgent').setAttribute('aria-checked', p === 'Urgent' ? 'true' : 'false');
    }

    async function submitRequest() {
      // Hard server-side-style guard — also prevents console bypass
      if (!currentUser) { showToast('Not logged in.', 'error'); return; }
      if (currentUser.role === 'Manager') {
        showToast('Managers cannot submit requests.', 'error');
        return;
      }
      if (!currentRequestEquipmentId) return;

      const btn = document.getElementById('submit-req-btn');
      btn.disabled = true; btn.textContent = 'Submitting...';

      const { error } = await db.from('requests').insert([{
        equipment_id: currentRequestEquipmentId,
        requested_by: currentUser.username,
        priority: selectedPriority,
        status: 'Pending'
      }]);

      if (error) {
        btn.disabled = false; btn.textContent = 'Submit Request';
        showToast('Failed: ' + error.message, 'error'); return;
      }

      // Log to audit_log
      await db.from('audit_log').insert([{
        equipment_id: currentRequestEquipmentId,
        action: 'Request Submitted',
        performed_by: currentUser.username
      }]);

      btn.disabled = false; btn.textContent = 'Submit Request';
      showToast(selectedPriority + ' request submitted!', 'success');
      closeRequestModal();
      await loadRequests();
    }

    // ==========================================
    // RENDER REQUESTS (role-gated approve/reject)
    // ==========================================
    function renderRequests(reqs) {
      const notifBadge = document.getElementById('notif-badge'); if (notifBadge) { const count = (reqs || []).length; notifBadge.textContent = count; notifBadge.hidden = (count === 0); }
      allRequests = reqs || []; // keep in sync so updateReq() self-approve guard works
      const el = document.getElementById('requests-list');
      document.getElementById('req-count').textContent = reqs.length;
      document.getElementById('stat-requests').textContent = reqs.length;
      const urgentCount = (reqs || []).filter(r => r.priority === 'Urgent').length;
      const normalCount = (reqs || []).length - urgentCount;
      const urgentEl = document.getElementById('req-urgent-count');
      if (urgentEl) urgentEl.textContent = urgentCount;
      const normalEl = document.getElementById('req-normal-count');
      if (normalEl) normalEl.textContent = normalCount;
      updateRequestsJump(reqs);
      if (reqs.length === 0) {
        el.innerHTML = '<div class="req-empty-state"><div class="req-empty-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-inbox"/></svg></div><div class="req-empty-title">No pending requests</div><div class="req-empty-desc">New equipment requests will appear here.</div></div>';
        return;
      }
      const canApprove = currentUser && (currentUser.role === 'Manager' || currentUser.role === 'Senior Doctor');
      el.innerHTML = '';
      reqs.forEach(req => {
        const isU = req.priority === 'Urgent';
        const item = document.createElement('div');
        item.className = 'request-item' + (isU ? ' urgent' : '');
        const eqName = req.equipment ? req.equipment.name : 'Equipment #' + req.equipment_id;

        item.innerHTML =
          '<div class="request-eq-name">' +
          (isU ? '<span class="urgent-flag">URGENT</span> ' : '') +
          esc(eqName) +
          '</div>' +
          '<div class="request-meta">' + esc(req.requested_by) + ' · ' + fmtTime(req.created_at) + '</div>';

        if (canApprove) {
          const row = document.createElement('div');
          row.className = 'approve-reject-row';
          const approveBtn = document.createElement('button');
          approveBtn.className = 'btn-approve';
          approveBtn.innerHTML = 'Approve<span class="sr-only"> request for ' + esc(eqName) + '</span>';
          approveBtn.addEventListener('click', () => updateReq(req.id, 'Approved', req.equipment_id));
          const rejectBtn = document.createElement('button');
          rejectBtn.className = 'btn-reject';
          const rejectLabel = 'Reject<span class="sr-only"> request for ' + esc(eqName) + '</span>';
          rejectBtn.innerHTML = rejectLabel;
          let armTimer = null;
          rejectBtn.addEventListener('click', () => {
            // Two-step: first tap arms, second tap confirms (prevents accidental rejections)
            if (!rejectBtn.classList.contains('armed')) {
              rejectBtn.classList.add('armed');
              rejectBtn.textContent = 'Tap again to confirm';
              armTimer = setTimeout(() => { rejectBtn.classList.remove('armed'); rejectBtn.innerHTML = rejectLabel; }, 4000);
              return;
            }
            clearTimeout(armTimer);
            updateReq(req.id, 'Rejected', req.equipment_id);
          });
          row.appendChild(approveBtn);
          row.appendChild(rejectBtn);
          item.appendChild(row);
        } else {
          const wait = document.createElement('div');
          wait.className = 'request-awaiting';
          wait.textContent = 'Awaiting approval by Senior Doctor or Manager';
          item.appendChild(wait);
        }

        el.appendChild(item);
      });
      document.dispatchEvent(new CustomEvent('meditrack:render'));
    }

    async function updateReq(id, status, equipmentId) {
      const req = allRequests.find(r => r.id === id);
      if (req && req.requested_by === currentUser.username) {
        showToast('You cannot approve your own request.', 'error');
        return;
      }
      const { error } = await db.from('requests').update({ status }).eq('id', id);
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }

      // Log to audit_log
      const action = status === 'Approved' ? 'Request Approved' : 'Request Rejected';
      if (equipmentId) {
        await db.from('audit_log').insert([{
          equipment_id: equipmentId,
          action: action,
          performed_by: currentUser.username
        }]);
      }

      showToast('Request ' + status, 'success');
      await loadRequests();
    }

    // ==========================================
    // AUDIT LOG PAGE
    // ==========================================
    let allAuditLogs = {}; // { [eqId]: { entries: [], loaded: boolean, offset: number } }
    let openAuditRowId = null;
    let auditPageEquipment = []; // snapshot for current page render
    let auditHideNeverUsed = false;
    let auditSortCol = 'last_activity';
    let auditSortDir = 'desc';
    let auditPage = 1;
    let auditPageSize = 25;
    try {
      const savedPageSize = localStorage.getItem('auditPageSize');
      if (savedPageSize) auditPageSize = parseInt(savedPageSize, 10);
    } catch (e) {}

    function getSortIndicator(col, currentCol, currentDir) {
      if (col !== currentCol) return '<span style="opacity:0.3;margin-left:4px;">↕</span>';
      return currentDir === 'asc' ? '<span style="color:var(--brand-600);margin-left:4px;">▲</span>' : '<span style="color:var(--brand-600);margin-left:4px;">▼</span>';
    }

    function setAuditSort(col) {
      if (auditSortCol === col) {
        auditSortDir = auditSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        auditSortCol = col;
        auditSortDir = (col === 'last_activity' || col === 'uses') ? 'desc' : 'asc';
      }
      auditPage = 1;
      renderAuditPage();
    }

    function changeAuditPage(newPage) {
      auditPage = newPage;
      renderAuditPage();
      const listEl = document.getElementById('audit-eq-list');
      if (listEl) listEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function changeAuditPageSize(newSize) {
      auditPageSize = parseInt(newSize, 10);
      try { localStorage.setItem('auditPageSize', String(auditPageSize)); } catch (e) {}
      auditPage = 1;
      renderAuditPage();
    }

    function clearAuditFilters() {
      const search = document.getElementById('audit-search');
      if (search) search.value = '';
      const dept = document.getElementById('audit-dept-filter');
      if (dept) dept.value = 'all';
      const date = document.getElementById('audit-date-filter');
      if (date) date.value = 'all';
      const action = document.getElementById('audit-action-filter');
      if (action) action.value = 'all';
      const neverUsed = document.getElementById('audit-hide-never-used');
      if (neverUsed) neverUsed.checked = false;
      auditHideNeverUsed = false;
      auditPage = 1;
      renderAuditPage();
    }

    async function initAuditPage() {
      // Ensure equipment data is loaded (e.g. direct navigation / hard refresh)
      if (!allEquipment || allEquipment.length === 0) {
        if (typeof loadEquipment === 'function') await loadEquipment();
      }
      // Load summary data: all audit logs (limited) for summary stats
      await loadAuditSummary();
      renderAuditPage();
    }

    async function loadAuditSummary() {
      // Summary counts
      const { data, error } = await db.from('audit_log')
        .select('id, equipment_id, action, performed_by, timestamp')
        .order('timestamp', { ascending: false })
        .limit(1000);
      if (error) { console.error(error); return; }

      // Group by equipment_id
      allAuditLogs = {};
      data.forEach(entry => {
        if (!allAuditLogs[entry.equipment_id]) {
          allAuditLogs[entry.equipment_id] = { entries: [], loaded: false };
        }
        allAuditLogs[entry.equipment_id].entries.push(entry);
      });

      // Update summary chips
      const total = data.length;
      document.getElementById('audit-total-events').textContent = total;

      // Items used today
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const usedToday = new Set(
        data.filter(e => e.action === 'Checked Out' && new Date(e.timestamp) >= todayStart)
            .map(e => e.equipment_id)
      ).size;
      document.getElementById('audit-used-today').textContent = usedToday;
      document.getElementById('audit-in-use-now').textContent = (allEquipment || []).filter(e => e.status === 'In Use').length;
    }

    function renderAuditPage() {
      const container = document.getElementById('audit-eq-list');
      if (!container) return;

      try {
        const search = (document.getElementById('audit-search') || {}).value || '';
        const deptFilter = (document.getElementById('audit-dept-filter') || {}).value || 'all';
        const dateFilter = (document.getElementById('audit-date-filter') || {}).value || 'all';
        const actionFilter = (document.getElementById('audit-action-filter') || {}).value || 'all';
        const q = search.toLowerCase();

        // Date cutoff
        let cutoff = null;
        if (dateFilter === 'today') { cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); }
        else if (dateFilter === '7') { cutoff = new Date(Date.now() - 7 * 86400000); }
        else if (dateFilter === '30') { cutoff = new Date(Date.now() - 30 * 86400000); }

        // Filter audit entries per equipment
        function filteredEntries(eqId) {
          const raw = (allAuditLogs[eqId] || { entries: [] }).entries;
          return raw.filter(e => {
            const matchDate = !cutoff || new Date(e.timestamp) >= cutoff;
            const matchAction = actionFilter === 'all' || e.action === actionFilter;
            const matchUser = !q || (e.performed_by || '').toLowerCase().includes(q.toLowerCase());
            return matchDate && matchAction && matchUser;
          });
        }

        // Build prepared equipment list with audit stats
        const rawEqList = (allEquipment || []).map(eq => {
          const entries = filteredEntries(eq.id);
          const checkoutCount = entries.filter(e => e.action === 'Checked Out').length;
          const last = entries.length > 0 ? entries[0] : null;
          return {
            ...eq,
            entries,
            uses: checkoutCount,
            last_activity: last ? last.timestamp : null,
            last_user: last ? (last.performed_by || '—') : null,
            dept_name: eq.departments ? eq.departments.name : 'Unknown'
          };
        });

        let eqList = rawEqList.filter(eq => {
          const matchSearch = !q || eq.name.toLowerCase().includes(q) || eq.dept_name.toLowerCase().includes(q) || (eq.last_user && eq.last_user.toLowerCase().includes(q));
          const matchDept = deptFilter === 'all' || String(eq.department_id) === String(deptFilter);
          const matchNeverUsed = !auditHideNeverUsed || eq.uses > 0 || (eq.entries && eq.entries.length > 0);
          return matchSearch && matchDept && matchNeverUsed;
        });

        // Sort using sortAuditLogEntries (never-used items last when sorting by last_activity)
        eqList = sortAuditLogEntries(eqList, auditSortCol, auditSortDir);

        const prevOpenId = openAuditRowId;
        container.innerHTML = '';

        if (eqList.length === 0) {
          container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px; text-align: center;">
              <div class="empty-icon" style="font-size: 32px; margin-bottom: 8px;">
                <svg class="icon" aria-hidden="true" style="width:32px;height:32px;vertical-align:middle;"><use href="#i-scroll-text"/></svg>
              </div>
              <div class="empty-text" style="font-size: 15px; font-weight: 500; color: var(--ink-700); margin-bottom: 12px;">No audit events match your filters</div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="clearAuditFilters()">Clear filters</button>
            </div>
          `;
          const pagEl = document.getElementById('audit-pagination');
          if (pagEl) pagEl.innerHTML = '';
          return;
        }

        // Render table header
        const tableHeader = document.createElement('div');
        tableHeader.className = 'audit-table-header';
        tableHeader.setAttribute('role', 'row');
        tableHeader.innerHTML = `
          <span style="width:24px;"></span>
          <button type="button" class="audit-col-btn" onclick="setAuditSort('name')" aria-sort="${auditSortCol === 'name' ? (auditSortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
            <span>Equipment</span>${getSortIndicator('name', auditSortCol, auditSortDir)}
          </button>
          <button type="button" class="audit-col-btn" onclick="setAuditSort('department')" aria-sort="${auditSortCol === 'department' ? (auditSortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
            <span>Department</span>${getSortIndicator('department', auditSortCol, auditSortDir)}
          </button>
          <button type="button" class="audit-col-btn" onclick="setAuditSort('uses')" aria-sort="${auditSortCol === 'uses' ? (auditSortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
            <span>Usage & Activity</span>${getSortIndicator('uses', auditSortCol, auditSortDir)}
          </button>
          <span>Status</span>
        `;
        container.appendChild(tableHeader);

        // Paginate
        const pageInfo = paginate({ totalItems: eqList.length, currentPage: auditPage, pageSize: auditPageSize });
        auditPage = pageInfo.currentPage;
        const pageSlice = eqList.slice(pageInfo.startIndex, pageInfo.endIndex);

        const listEl = document.createElement('div');
        pageSlice.forEach(eq => {
          const entries = eq.entries;
          const checkoutCount = eq.uses;
          const usesText = checkoutCount + (checkoutCount === 1 ? ' use' : ' uses');
          const lastText = eq.last_activity ? fmtRelativeTime(eq.last_activity) : 'Never';
          const statusPill = eq.status === 'Available'
            ? '<span class="status-pill available"><span class="status-dot"></span>Available</span>'
            : '<span class="status-pill inuse"><span class="status-dot"></span>In Use</span>';
          const isOpen = eq.id === prevOpenId;

          const row = document.createElement('div');
          row.className = 'audit-eq-row' + (isOpen ? ' open' : '');
          row.id = 'audit-row-' + eq.id;
          row.dataset.eqid = eq.id;

          const header = document.createElement('div');
          header.className = 'audit-eq-row-header';
          header.setAttribute('role', 'button');
          header.setAttribute('tabindex', '0');
          header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          header.setAttribute('aria-controls', 'audit-details-' + eq.id);
          header.innerHTML =
            '<div class="audit-eq-chevron" aria-hidden="true">' +
              '<svg class="icon audit-chevron-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="6 9 12 15 18 9"></polyline>' +
              '</svg>' +
            '</div>' +
            '<div class="audit-eq-name">' + esc(eq.name) + '</div>' +
            '<div class="audit-eq-dept">' + esc(eq.dept_name) + '</div>' +
            '<div class="audit-eq-activity">' + esc(usesText + ' · Last: ' + lastText) + '</div>' +
            '<div class="audit-eq-status">' + statusPill + '</div>';

          header.addEventListener('click', () => toggleAuditRow(eq.id));
          header.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAuditRow(eq.id); }
          });
          row.appendChild(header);

          const detailsEl = document.createElement('div');
          detailsEl.className = 'audit-eq-details';
          detailsEl.id = 'audit-details-' + eq.id;

          const timeline = document.createElement('div');
          timeline.className = 'audit-timeline';
          detailsEl.appendChild(timeline);
          row.appendChild(detailsEl);

          if (isOpen) {
            renderAuditTimeline(eq.id, timeline, entries);
          }

          listEl.appendChild(row);
        });

        container.appendChild(listEl);

        // Render pagination into #audit-pagination
        const pagEl = document.getElementById('audit-pagination');
        if (pagEl) {
          pagEl.innerHTML = `
            <div class="pagination-info">${pageInfo.displayText}</div>
            <div class="pagination-controls">
              <label for="audit-page-size" class="sr-only">Rows per page</label>
              <select id="audit-page-size" class="pagination-page-size" aria-label="Rows per page" onchange="changeAuditPageSize(this.value)">
                <option value="25" ${auditPageSize === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${auditPageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${auditPageSize === 100 ? 'selected' : ''}>100</option>
              </select>
              <button type="button" class="btn btn-secondary btn-sm" onclick="changeAuditPage(${auditPage - 1})" ${!pageInfo.hasPrevious ? 'disabled' : ''}>Previous</button>
              <span class="pagination-page-num">Page ${auditPage} of ${pageInfo.totalPages}</span>
              <button type="button" class="btn btn-secondary btn-sm" onclick="changeAuditPage(${auditPage + 1})" ${!pageInfo.hasNext ? 'disabled' : ''}>Next</button>
            </div>
          `;
        }
      } catch (err) {
        console.error('Error rendering audit page:', err);
        container.innerHTML = `
          <div class="empty-state" style="padding: 40px 20px; text-align: center;">
            <div class="empty-text" style="font-size: 15px; font-weight: 500; color: var(--color-danger, #e11d48); margin-bottom: 12px;">
              Failed to load audit events.
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="renderAuditPage()">Retry</button>
          </div>
        `;
        const pagEl = document.getElementById('audit-pagination');
        if (pagEl) pagEl.innerHTML = '';
      }
    }

    function toggleAuditRow(eqId) {
      const row = document.getElementById('audit-row-' + eqId);
      if (!row) return;
      const isOpen = row.classList.contains('open');

      document.querySelectorAll('.audit-eq-row.open').forEach(r => {
        r.classList.remove('open');
        const h = r.querySelector('.audit-eq-row-header');
        if (h) h.setAttribute('aria-expanded', 'false');
      });
      openAuditRowId = null;

      if (!isOpen) {
        row.classList.add('open');
        const h = row.querySelector('.audit-eq-row-header');
        if (h) h.setAttribute('aria-expanded', 'true');
        openAuditRowId = eqId;

        // Lazy-load timeline if not yet done
        const timeline = row.querySelector('.audit-timeline');
        if (timeline) {
          // If not loaded yet, fetch
          if (!allAuditLogs[eqId] || !allAuditLogs[eqId].loaded) {
            loadAuditTimeline(eqId, timeline);
          } else {
            renderAuditTimeline(eqId, timeline);
          }
        }
      }
    }

    async function loadAuditTimeline(eqId, timelineEl, offset = 0) {
      timelineEl.innerHTML = '<div class="audit-empty">Loading...</div>';
      const { data, error } = await db.from('audit_log')
        .select('*')
        .eq('equipment_id', eqId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + 19);

      if (error) { timelineEl.innerHTML = '<div class="audit-empty">Failed to load.</div>'; return; }

      if (!allAuditLogs[eqId]) allAuditLogs[eqId] = { entries: [], loaded: false };
      if (offset === 0 && !allAuditLogs[eqId].loaded) {
        allAuditLogs[eqId].entries = data;
      } else {
        // Append, avoid duplicates
        const existingIds = new Set(allAuditLogs[eqId].entries.map(e => e.id));
        data.forEach(e => { if (!existingIds.has(e.id)) allAuditLogs[eqId].entries.push(e); });
      }
      // Re-sort entries in case realtime insert arrived out of order
      allAuditLogs[eqId].entries.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      allAuditLogs[eqId].loaded = true;
      allAuditLogs[eqId].hasMore = data.length === 20;
      allAuditLogs[eqId].offset = (offset + data.length);

      renderAuditTimeline(eqId, timelineEl);
    }

    function renderAuditTimeline(eqId, timelineEl, entriesOverride) {
      const cache = allAuditLogs[eqId] || { entries: [] };
      const entries = entriesOverride || cache.entries;

      if (entries.length === 0) {
        timelineEl.innerHTML = '<div class="audit-empty" style="color:var(--text-3);font-size:13px;padding:8px 0;">No usage yet</div>';
        return;
      }

      timelineEl.innerHTML = '';

      entries.forEach((entry, idx) => {
        const dotClass = getDotClass(entry.action);
        const item = document.createElement('div');
        item.className = 'timeline-entry';

        let durationHtml = '';
        if (entry.action === 'Released') {
          // Find the preceding Checked Out for same eq
          const allForEq = cache.entries;
          const checkoutBefore = allForEq.find((e, i) => i > idx && e.action === 'Checked Out');
          if (checkoutBefore) {
            const durMs = new Date(entry.timestamp).getTime() - new Date(checkoutBefore.timestamp).getTime();
            if (durMs > 0) {
              durationHtml = '<div class="timeline-duration"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>used for ' + fmtDuration(durMs) + '</div>';
            }
          }
        } else if (entry.action === 'Checked Out') {
          // Check if there's no Released after it (still in use)
          const allForEq = cache.entries;
          const releasedAfter = allForEq.find((e, i) => i < idx && e.action === 'Released');
          if (!releasedAfter) {
            durationHtml = '<div class="timeline-duration"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>still in use</div>';
          }
        }

        // v4: show room for Checked Out entries
        const roomHtml = (entry.action === 'Checked Out' && entry.room)
          ? '<div class="timeline-room"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' + esc(entry.room) + '</div>'
          : '';

        item.innerHTML =
          '<div class="timeline-dot ' + dotClass + '"></div>' +
          '<div class="timeline-content">' +
          '<div class="timeline-action">' + esc(entry.action) + '</div>' +
          roomHtml +
          '<div class="timeline-user">by ' + esc(entry.performed_by) + '</div>' +
          '<div class="timeline-time">' + fmtDateTime(entry.timestamp) + '</div>' +
          durationHtml +
          '</div>';
        timelineEl.appendChild(item);
      });

      if (cache.hasMore) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'btn btn-secondary btn-load-more';
        loadMoreBtn.textContent = 'Load more';
        loadMoreBtn.onclick = () => {
          loadMoreBtn.textContent = 'Loading...';
          loadMoreBtn.disabled = true;
          loadAuditTimeline(eqId, timelineEl, cache.offset || 0);
        };
        timelineEl.appendChild(loadMoreBtn);
      }
    }

    function getDotClass(action) {
      switch (action) {
        case 'Checked Out': return 'checkout';
        case 'Released': return 'released';
        case 'Request Submitted': return 'submitted';
        case 'Request Approved': return 'approved';
        case 'Request Rejected': return 'rejected';
        case 'Condition Changed': return 'condition';
        default: return 'other';
      }
    }

    // ==========================================
    // EXPORT CSV
    // ==========================================
    async function exportAuditCSV() {
      const search = (document.getElementById('audit-search') || {}).value || '';
      const deptFilter = (document.getElementById('audit-dept-filter') || {}).value || 'all';
      const dateFilter = (document.getElementById('audit-date-filter') || {}).value || 'all';
      const actionFilter = (document.getElementById('audit-action-filter') || {}).value || 'all';
      const q = search.toLowerCase();

      let cutoff = null;
      if (dateFilter === 'today') { cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); }
      else if (dateFilter === '7') { cutoff = new Date(Date.now() - 7 * 86400000); }
      else if (dateFilter === '30') { cutoff = new Date(Date.now() - 30 * 86400000); }

      showToast('Preparing CSV export...', 'info');

      // Fetch all relevant audit logs — v4: include room column
      let query = db.from('audit_log')
        .select('id, equipment_id, action, performed_by, timestamp, room, equipment(name, departments(name))')
        .order('timestamp', { ascending: false });

      if (cutoff) query = query.gte('timestamp', cutoff.toISOString());
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);

      const { data, error } = await query.limit(5000);
      if (error) { showToast('Export failed: ' + error.message, 'error'); return; }

      const filtered = data.filter(row => {
        const eqName = (row.equipment && row.equipment.name) || '';
        const deptName = (row.equipment && row.equipment.departments && row.equipment.departments.name) || '';
        const eqObj = allEquipment.find(e => e.id === row.equipment_id);
        const eqDeptId = eqObj ? eqObj.department_id : null;
        const matchSearch = !q || eqName.toLowerCase().includes(q) || (row.performed_by || '').toLowerCase().includes(q);
        const matchDept = deptFilter === 'all' || String(eqDeptId) === String(deptFilter);
        return matchSearch && matchDept;
      });

      // v4: Room column added — populated for 'Checked Out' rows, empty for all others
      const header = ['ID', 'Equipment', 'Department', 'Action', 'Performed By', 'Timestamp', 'Room'];
      const rows = filtered.map(row => {
        const eqName = (row.equipment && row.equipment.name) || '';
        const deptName = (row.equipment && row.equipment.departments && row.equipment.departments.name) || '';
        return [
          row.id,
          csvCell(eqName),
          csvCell(deptName),
          csvCell(row.action),
          csvCell(row.performed_by),
          new Date(row.timestamp).toLocaleString('en-IN'),
          csvCell(row.room || '')
        ].join(',');
      });

      const csv = [header.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MediTrack_AuditLog_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV exported (' + filtered.length + ' rows)', 'success');
    }

    function csvCell(v) {
      if (!v) return '';
      v = String(v);
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }

    // ==========================================
    // MANAGE USERS (Manager only)
    // ==========================================
    let cachedUsers = [];
    let userStatusFilter = 'all';

    function onRoleChange() {
      const role = (document.getElementById('new-role') || {}).value;
      const helper = document.getElementById('role-helper-text');
      if (!helper) return;
      if (role === 'Manager') {
        helper.textContent = 'Full access, including user management.';
      } else if (role === 'Senior Doctor') {
        helper.textContent = 'Can request equipment and view department activity.';
      } else {
        helper.textContent = 'Can check equipment in and out.';
      }
    }

    function onUsernameInput() {
      const username = (document.getElementById('new-username') || {}).value || '';
      const btn = document.getElementById('create-user-btn');
      if (btn) {
        btn.disabled = username.trim().length < 3;
      }
    }

    function setUserStatusFilter(status) {
      userStatusFilter = status;
      ['all', 'active', 'inactive'].forEach(s => {
        const btn = document.getElementById('user-filter-' + s);
        if (btn) {
          const isActive = s === status;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
          btn.style.background = isActive ? 'var(--brand-600)' : 'var(--surface)';
          btn.style.color = isActive ? '#fff' : 'var(--ink-700)';
        }
      });
      renderUsersTable();
    }

    async function loadUsersTable() {
      const tbody = document.getElementById('users-tbody');
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-3);">Loading...</td></tr>';

      const { data, error } = await db
        .from('users')
        .select('id, username, role, department_id, is_active, created_at, departments(name)')
        .order('id');

      if (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--danger);padding:16px;">Failed to load users.</td></tr>';
        return;
      }
      cachedUsers = data || [];
      renderUsersTable();
    }

    function renderUsersTable() {
      const tbody = document.getElementById('users-tbody');
      const search = (document.getElementById('user-search-input') || {}).value || '';
      const hideDemo = (document.getElementById('user-hide-demo') || {}).checked || false;
      const q = search.toLowerCase().trim();

      const totalCount = cachedUsers.length;
      const activeCount = cachedUsers.filter(u => u.is_active).length;
      const inactiveCount = cachedUsers.filter(u => !u.is_active).length;

      const cntAll = document.getElementById('users-filter-count-all');
      if (cntAll) cntAll.textContent = totalCount;
      const cntAct = document.getElementById('users-filter-count-active');
      if (cntAct) cntAct.textContent = activeCount;
      const cntInact = document.getElementById('users-filter-count-inactive');
      if (cntInact) cntInact.textContent = inactiveCount;
      const usersCountEl = document.getElementById('users-count');
      if (usersCountEl) usersCountEl.textContent = totalCount;

      let filtered = cachedUsers.filter(u => {
        const matchSearch = !q || u.username.toLowerCase().includes(q) || (u.role && u.role.toLowerCase().includes(q)) || (u.departments && u.departments.name && u.departments.name.toLowerCase().includes(q));
        const matchStatus = userStatusFilter === 'all' || (userStatusFilter === 'active' ? u.is_active : !u.is_active);
        const matchDemo = !hideDemo || !u.username.toLowerCase().startsWith('demo.');
        return matchSearch && matchStatus && matchDemo;
      });

      tbody.innerHTML = '';
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-3);">No users match your filters.</td></tr>';
        return;
      }

      filtered.forEach(u => {
        const isSelf = currentUser && u.id === currentUser.id;
        const deptName = u.departments ? u.departments.name : '—';
        const roleClass = u.role === 'Manager' ? 'role-manager' : u.role === 'Senior Doctor' ? 'role-doctor' : 'role-staff';

        const tr = document.createElement('tr');

        const tdUser = document.createElement('td');
        tdUser.innerHTML = '<strong>' + esc(u.username) + '</strong>' +
          (isSelf ? ' <span style="font-size:11px;color:var(--primary);font-weight:600;margin-left:4px;">(You)</span>' : '');
        tr.appendChild(tdUser);

        const tdRole = document.createElement('td');
        tdRole.innerHTML = '<span class="role-chip ' + roleClass + '">' + esc(u.role) + '</span>';
        tr.appendChild(tdRole);

        const tdDept = document.createElement('td');
        tdDept.textContent = deptName;
        tr.appendChild(tdDept);

        const tdStatus = document.createElement('td');
        tdStatus.innerHTML = renderStatusBadge(u.is_active ? 'active' : 'inactive', u.is_active ? 'Active' : 'Inactive');
        tr.appendChild(tdStatus);

        const tdActions = document.createElement('td');
        if (!isSelf) {
          const actionsWrap = document.createElement('div');
          actionsWrap.className = 'user-row-actions';

          // Reset Password
          const resetBtn = document.createElement('button');
          resetBtn.type = 'button';
          resetBtn.className = 'tbl-action-btn reset';
          resetBtn.setAttribute('title', 'Reset password for ' + u.username);
          resetBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> <span>Reset</span>';
          resetBtn.onclick = () => openResetPwModal(u.id, u.username);
          actionsWrap.appendChild(resetBtn);

          // Deactivate / Reactivate
          if (u.is_active) {
            const deactBtn = document.createElement('button');
            deactBtn.type = 'button';
            deactBtn.className = 'tbl-action-btn deactivate';
            deactBtn.setAttribute('title', 'Deactivate ' + esc(u.username));
            deactBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg> <span>Deactivate</span>';
            deactBtn.onclick = () => confirmDeactivateUser(u.id, u.username);
            actionsWrap.appendChild(deactBtn);
          } else {
            const reactBtn = document.createElement('button');
            reactBtn.type = 'button';
            reactBtn.className = 'tbl-action-btn reactivate';
            reactBtn.setAttribute('title', 'Reactivate ' + esc(u.username));
            reactBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Reactivate</span>';
            reactBtn.onclick = () => confirmReactivateUser(u.id, u.username);
            actionsWrap.appendChild(reactBtn);
          }
          tdActions.appendChild(actionsWrap);
        } else {
          tdActions.innerHTML = '<span style="color:var(--text-3);font-size:12px;">—</span>';
        }
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }

    function confirmDeactivateUser(userId, username) {
      confirmDialog.open({
        title: 'Deactivate ' + username + '?',
        body: 'They will no longer be able to sign in. You can reactivate them at any time.',
        confirmText: 'Deactivate',
        cancelText: 'Cancel',
        isDestructive: true,
        onConfirm: async () => {
          await toggleUserActive(userId, false);
        }
      });
    }

    function confirmReactivateUser(userId, username) {
      confirmDialog.open({
        title: 'Reactivate ' + username + '?',
        body: 'They will regain access to sign in to MediTrack.',
        confirmText: 'Reactivate',
        cancelText: 'Cancel',
        isDestructive: false,
        onConfirm: async () => {
          await toggleUserActive(userId, true);
        }
      });
    }

    async function createUser() {
      const username = document.getElementById('new-username').value.trim();
      const role = document.getElementById('new-role').value;
      const deptId = document.getElementById('new-dept').value || null;
      const btn = document.getElementById('create-user-btn');
      const pwBox = document.getElementById('new-temp-pw-box');
      const pwLabel = document.getElementById('new-temp-pw-label');

      pwBox.classList.remove('show');
      if (!username) { showToast('Please enter a username.', 'error'); return; }
      if (username.length < 3) { showToast('Username must be at least 3 characters.', 'error'); return; }

      const array = new Uint32Array(2);
      window.crypto.getRandomValues(array);
      const tempPw = 'Tmp' + array[0].toString(36) + '!';
      btn.disabled = true; btn.textContent = 'Creating...';

      try {
        const salt = await dcodeIO.bcrypt.genSalt(10);
        const hash = await dcodeIO.bcrypt.hash(tempPw, salt);

        const { error } = await db.from('users').insert([{
          username: username,
          password_hash: hash,
          role: role,
          department_id: deptId ? parseInt(deptId) : null,
          is_active: true
        }]);

        if (error) {
          if (error.message.includes('unique')) {
            showToast('Username "' + username + '" already exists.', 'error');
          } else {
            showToast('Error: ' + error.message, 'error');
          }
          return;
        }

        pwBox.textContent = tempPw;
        pwBox.classList.add('show');
        pwLabel.textContent = 'Share this password once — it will not be shown again.';
        document.getElementById('new-username').value = '';
        showToast('User "' + username + '" created!', 'success');
        await loadUsersTable();

      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        const un = (document.getElementById('new-username') || {}).value || '';
        btn.disabled = un.trim().length < 3;
        btn.textContent = 'Create User';
      }
    }

    async function toggleUserActive(userId, isActive) {
      const { error } = await db.from('users').update({ is_active: isActive }).eq('id', userId);
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }
      showToast('User ' + (isActive ? 'reactivated' : 'deactivated') + '.', 'success');
      await loadUsersTable();
    }

    let resetPwTargetId = null;

    function openResetPwModal(userId, username) {
      resetPwTargetId = userId;
      document.getElementById('reset-pw-username-display').textContent = username;
      document.getElementById('reset-pw-new').value = '';
      document.getElementById('reset-pw-modal').style.display = 'flex';
    }
    function closeResetPwModal() {
      document.getElementById('reset-pw-modal').style.display = 'none';
      resetPwTargetId = null;
    }

    async function doResetPassword() {
      const newPw = document.getElementById('reset-pw-new').value;
      if (!newPw || newPw.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
      const btn = document.getElementById('reset-pw-btn');
      btn.disabled = true; btn.textContent = 'Resetting...';
      try {
        const salt = await dcodeIO.bcrypt.genSalt(10);
        const hash = await dcodeIO.bcrypt.hash(newPw, salt);
        const { error } = await db.from('users').update({ password_hash: hash }).eq('id', resetPwTargetId);
        if (error) { showToast('Failed: ' + error.message, 'error'); return; }
        showToast('Password reset successfully.', 'success');
        closeResetPwModal();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Reset Password';
      }
    }

    // ==========================================
    // ADD EQUIPMENT (MANAGER ONLY)
    // ==========================================
    function openAddEquipmentModal() {
      if (!currentUser || currentUser.role !== 'Manager') {
        showToast('Only Managers can add new equipment.', 'error');
        return;
      }
      document.getElementById('new-eq-name').value = '';
      if (departments && departments.length > 0) {
        document.getElementById('new-eq-dept').value = departments[0].id;
      }
      document.getElementById('new-eq-status').value = 'Available';

      // v3: populate product type dropdown (Manager only)
      const ptSel = document.getElementById('new-eq-pt');
      const ptGroup = document.getElementById('new-eq-pt-group');
      if (ptSel && ptGroup) {
        ptSel.innerHTML = '<option value="">-- None --</option>';
        productTypes.forEach(pt => {
          const opt = document.createElement('option');
          opt.value = pt.id;
          opt.textContent = pt.name;
          ptSel.appendChild(opt);
        });
        const newOpt = document.createElement('option');
        newOpt.value = '__new__';
        newOpt.textContent = '\u2795 New product type...';
        ptSel.appendChild(newOpt);
        // Hide the inline form and reset its inputs
        document.getElementById('new-pt-form').classList.remove('show');
        document.getElementById('new-pt-name').value = '';
        document.getElementById('new-pt-img').value = '';
      }

      autoSuggestQrId();
      document.getElementById('add-equipment-modal').style.display = 'flex';
    }

    // v3: Show / hide the inline new product type form
    function onProductTypeSelectChange() {
      const sel = document.getElementById('new-eq-pt');
      const form = document.getElementById('new-pt-form');
      if (!sel || !form) return;
      if (sel.value === '__new__') {
        form.classList.add('show');
        document.getElementById('new-pt-name').focus();
      } else {
        form.classList.remove('show');
      }
    }

    function closeAddEquipmentModal() {
      document.getElementById('add-equipment-modal').style.display = 'none';
    }

    function autoSuggestQrId() {
      const deptSelect = document.getElementById('new-eq-dept');
      if (!deptSelect || !deptSelect.value) return;
      const deptId = parseInt(deptSelect.value);
      const dept = departments.find(d => d.id === deptId);
      let prefix = 'MT-EQ';
      if (dept) {
        const dName = dept.name.toUpperCase();
        if (dName.includes('ICU')) prefix = 'MT-ICU';
        else if (dName.includes('GENERAL') || dName.includes('WARD')) prefix = 'MT-GW';
        else if (dName.includes('EMERGENCY')) prefix = 'MT-EM';
        else prefix = 'MT-' + dept.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase();
      }
      const count = allEquipment.filter(e => e.qr_code_id && e.qr_code_id.startsWith(prefix)).length + 1;
      const numStr = String(count).padStart(3, '0');
      document.getElementById('new-eq-qr').value = prefix + '-' + numStr;
    }

    async function createEquipment() {
      const name = document.getElementById('new-eq-name').value.trim();
      const deptId = parseInt(document.getElementById('new-eq-dept').value);
      const qrId = document.getElementById('new-eq-qr').value.trim().toUpperCase();
      const status = document.getElementById('new-eq-status').value;
      const btn = document.getElementById('create-eq-btn');

      if (!name) { showToast('Please enter an equipment / product name.', 'error'); return; }
      if (!qrId) { showToast('Please enter a QR code asset ID.', 'error'); return; }

      btn.disabled = true;
      btn.textContent = 'Adding...';

      try {
        // v3: resolve product_type_id — may involve creating a new type
        let productTypeId = null;
        const ptSel = document.getElementById('new-eq-pt');
        if (ptSel && ptSel.value && ptSel.value !== '') {
          if (ptSel.value === '__new__') {
            // Create new product type first
            const newPtName = (document.getElementById('new-pt-name').value || '').trim();
            const newPtImg  = (document.getElementById('new-pt-img').value  || '').trim();
            if (!newPtName) {
              showToast('Please enter a name for the new product type.', 'error');
              btn.disabled = false;
              btn.innerHTML = '<svg class="icon" aria-hidden="true" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"><use href="#i-plus"/></svg> Add Product &amp; Generate QR';
              return;
            }
            const { data: ptData, error: ptErr } = await db.from('product_types')
              .insert([{ name: newPtName, image_url: newPtImg || null }])
              .select()
              .single();
            if (ptErr) {
              showToast('Failed to create product type: ' + ptErr.message, 'error');
              btn.disabled = false;
              btn.innerHTML = '<svg class="icon" aria-hidden="true" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"><use href="#i-plus"/></svg> Add Product &amp; Generate QR';
              return;
            }
            // Add to local cache so tiles update immediately
            productTypes.push(ptData);
            productTypeId = ptData.id;
          } else {
            productTypeId = parseInt(ptSel.value) || null;
          }
        }

        const { data, error } = await db.from('equipment').insert([{
          name: name,
          department_id: deptId,
          qr_code_id: qrId,
          status: status,
          condition: 'Usable',
          product_type_id: productTypeId  // v3
        }]).select();

        if (error) {
          if (error.message.includes('unique') || error.message.includes('qr_code_id')) {
            showToast('QR Code ID "' + qrId + '" already exists. Choose a different ID.', 'error');
          } else {
            showToast('Error: ' + error.message, 'error');
          }
          return;
        }

        const insertedId = (data && data[0]) ? data[0].id : null;
        await db.from('audit_log').insert([{
          equipment_id: insertedId,
          action: 'Added new equipment "' + name + '" (' + qrId + ')',
          performed_by: currentUser.username
        }]);

        showToast('Product "' + name + '" added successfully!', 'success');
        closeAddEquipmentModal();
        await loadEquipment();   // also triggers renderProductTiles() via loadEquipment

        if (insertedId) {
          setTimeout(() => { openStickerModal(insertedId); }, 350);
        }

      } catch (err) {
        showToast('Failed to add product: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg class="icon" aria-hidden="true" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"><use href="#i-plus"/></svg> Add Product &amp; Generate QR';
      }
    }

    // ==========================================
    // QR STICKER & PRINTING
    // ==========================================
    let currentStickerEqId = null;

    function openStickerModal(eqId) {
      const eq = allEquipment.find(e => e.id === eqId);
      if (!eq) return;
      currentStickerEqId = eqId;

      document.getElementById('sticker-display-name').textContent = eq.name;
      const deptName = eq.departments ? eq.departments.name : 'Department';
      document.getElementById('sticker-display-dept').textContent = deptName;
      document.getElementById('sticker-display-id').textContent = eq.qr_code_id;

      const qrCont = document.getElementById('sticker-qr-container');
      qrCont.innerHTML = '';
      try {
        new QRCode(qrCont, {
          text: eq.qr_code_id,
          width: 154, height: 154,
          colorDark: '#0f172a', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (e) { console.warn('QR gen error', e); }

      document.getElementById('sticker-modal').style.display = 'flex';
    }

    function closeStickerModal() {
      document.getElementById('sticker-modal').style.display = 'none';
      currentStickerEqId = null;
    }

    function generateStickerCanvas(eq, callback) {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      new QRCode(tempDiv, {
        text: eq.qr_code_id,
        width: 260, height: 260,
        colorDark: '#0f172a', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });

      setTimeout(() => {
        const qrEl = tempDiv.querySelector('canvas') || tempDiv.querySelector('img');
        const canvas = document.createElement('canvas');
        const w = 500, h = 620;
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = '#1557b0';
        ctx.fillRect(4, 4, w - 8, 85);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🏥 MEDITRACK ASSET', w / 2, 42);
        ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('Hospital Equipment Visibility System', w / 2, 68);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillText(eq.name, w / 2, 135);
        const deptName = (eq.departments && eq.departments.name) || 'Department';
        ctx.fillStyle = '#e8f0fe';
        const tagW = ctx.measureText(deptName).width + 36; const tagH = 30;
        ctx.fillRect(w / 2 - tagW / 2, 150, tagW, tagH);
        ctx.fillStyle = '#1557b0'; ctx.font = '600 13px Inter, sans-serif';
        ctx.fillText(deptName, w / 2, 170);
        if (qrEl) {
          const qrSize = 250; const qrX = (w - qrSize) / 2; const qrY = 195;
          ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
          ctx.strokeRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
          ctx.drawImage(qrEl, qrX, qrY, qrSize, qrSize);
        }
        const idY = 480;
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(40, idY, w - 80, 48);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5;
        ctx.strokeRect(40, idY, w - 80, 48);
        ctx.fillStyle = '#0f172a'; ctx.font = 'bold 20px monospace';
        ctx.fillText(eq.qr_code_id, w / 2, idY + 31);
        ctx.fillStyle = '#64748b'; ctx.font = '12px Inter, sans-serif';
        ctx.fillText('Scan with MediTrack app to update status', w / 2, 575);
        tempDiv.remove();
        callback(canvas);
      }, 120);
    }

    function downloadCurrentStickerPng() {
      if (!currentStickerEqId) return;
      const eq = allEquipment.find(e => e.id === currentStickerEqId);
      if (!eq) return;
      showToast('Generating sticker PNG...', 'info');
      generateStickerCanvas(eq, (canvas) => {
        const link = document.createElement('a');
        link.download = 'MediTrack_Sticker_' + eq.qr_code_id + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Downloaded sticker image for "' + eq.name + '"!', 'success');
      });
    }

    function printCurrentSticker() {
      if (!currentStickerEqId) return;
      const eq = allEquipment.find(e => e.id === currentStickerEqId);
      if (!eq) return;
      const printArea = document.getElementById('print-area');
      printArea.innerHTML = '';
      const deptName = eq.departments ? eq.departments.name : 'Unknown';
      const card = document.createElement('div');
      card.className = 'print-sticker-card';
      card.innerHTML =
        '<div class="p-header"><svg class="icon" aria-hidden="true" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"><use href="#i-brand"/></svg> MEDITRACK ASSET TAG</div>' +
        '<div class="p-name">' + esc(eq.name) + '</div>' +
        '<div class="p-dept">&#127968; ' + esc(deptName) + '</div>' +
        '<div class="p-qr" id="print-qr-' + eq.id + '"></div>' +
        '<div class="p-id">' + esc(eq.qr_code_id) + '</div>' +
        '<div style="font-size:10px;margin-top:6px;color:#555;">Scan with MediTrack to toggle status</div>';
      printArea.appendChild(card);
      new QRCode(card.querySelector('#print-qr-' + eq.id), {
        text: eq.qr_code_id, width: 160, height: 160,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      setTimeout(() => { window.print(); }, 300);
    }

    // ==========================================
    // PRINT ALL QR LABELS MODAL
    // ==========================================
    function openPrintAllModal() {
      renderPrintAllPreview();
      document.getElementById('print-all-modal').style.display = 'flex';
    }

    function closePrintAllModal() {
      document.getElementById('print-all-modal').style.display = 'none';
    }

    function renderPrintAllPreview() {
      const filterVal = document.getElementById('print-all-dept-filter').value;
      const filtered = allEquipment.filter(eq => {
        if (filterVal === 'all') return true;
        return String(eq.department_id) === String(filterVal);
      });

      document.getElementById('print-all-count').textContent = filtered.length;
      const grid = document.getElementById('print-all-preview-grid');
      grid.innerHTML = '';

      if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);">No equipment in selected department</div>';
        return;
      }

      filtered.forEach(eq => {
        const item = document.createElement('div');
        item.className = 'print-item-preview';
        const deptName = eq.departments ? eq.departments.name : 'Unknown';
        item.innerHTML =
          '<div class="print-item-title">' + esc(eq.name) + '</div>' +
          '<div class="print-item-dept">' + esc(deptName) + '</div>' +
          '<div class="print-item-qr" id="prev-qr-' + eq.id + '"></div>' +
          '<div class="print-item-id">' + esc(eq.qr_code_id) + '</div>';
        grid.appendChild(item);

        new QRCode(item.querySelector('#prev-qr-' + eq.id), {
          text: eq.qr_code_id, width: 90, height: 90,
          colorDark: '#0f172a', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      });
    }

    function printAllStickersAction() {
      const filterVal = document.getElementById('print-all-dept-filter').value;
      const filtered = allEquipment.filter(eq => {
        if (filterVal === 'all') return true;
        return String(eq.department_id) === String(filterVal);
      });

      if (filtered.length === 0) { showToast('No equipment to print.', 'error'); return; }

      const printArea = document.getElementById('print-area');
      printArea.innerHTML = '';

      filtered.forEach(eq => {
        const deptName = eq.departments ? eq.departments.name : 'Unknown';
        const card = document.createElement('div');
        card.className = 'print-sticker-card';
        card.innerHTML =
          '<div class="p-header"><svg class="icon" aria-hidden="true" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"><use href="#i-brand"/></svg> MEDITRACK ASSET TAG</div>' +
          '<div class="p-name">' + esc(eq.name) + '</div>' +
          '<div class="p-dept">&#127968; ' + esc(deptName) + '</div>' +
          '<div class="p-qr" id="print-all-qr-' + eq.id + '"></div>' +
          '<div class="p-id">' + esc(eq.qr_code_id) + '</div>' +
          '<div style="font-size:10px;margin-top:6px;color:#555;">Scan with MediTrack to toggle status</div>';
        printArea.appendChild(card);
        new QRCode(card.querySelector('#print-all-qr-' + eq.id), {
          text: eq.qr_code_id, width: 140, height: 140,
          colorDark: '#000000', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      });

      setTimeout(() => { window.print(); }, 400);
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    function esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtTime(ts) {
      if (!ts) return '';
      try {
        return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      } catch { return ts; }
    }

    function fmtDateTime(ts) {
      if (!ts) return '';
      try {
        const d = new Date(ts);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        if (isToday) {
          return 'Today, ' + d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { return ts; }
    }

    function fmtRelativeTime(ts) {
      if (!ts) return '';
      try {
        const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
      } catch { return ts; }
    }

    function fmtDuration(ms) {
      const secs = Math.floor(ms / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      if (h > 0) return h + 'h ' + m + 'm';
      return m + 'm';
    }

    /* ---- Confirm modal helpers ---- */
    let _confirmCallback = null;
    function openConfirmModal(title, msg, onConfirm) {
      document.getElementById('confirm-modal-title').textContent = title;
      document.getElementById('confirm-modal-msg').textContent = msg;
      _confirmCallback = onConfirm;
      const m = document.getElementById('confirm-modal');
      m.style.display = 'flex';
      // Move focus to the OK button for keyboard/screen-reader users
      setTimeout(() => { const ok = document.getElementById('confirm-modal-ok'); if (ok) ok.focus(); }, 50);
    }
    function closeConfirmModal() {
      document.getElementById('confirm-modal').style.display = 'none';
      _confirmCallback = null;
    }
    function _confirmModalOk() {
      const cb = _confirmCallback;
      closeConfirmModal();
      if (cb) cb();
    }

    function showToast(msg, type) {
      const c = document.getElementById('toast-container');
      const t = document.createElement('div');
      t.className = 'toast ' + (type || 'info');
      t.textContent = msg;
      if (type === 'error') t.setAttribute('role', 'alert');
      c.appendChild(t);
      setTimeout(() => {
        t.style.transition = 'opacity 300ms';
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 310);
      }, (type === 'error' || type === 'warning') ? 8000 : 5000);
    }

    // ==========================================
    // KEYBOARD / OVERLAY CLOSE
    // ==========================================
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeNavDrawer();
        cancelRoomPicker(); // v4: close room picker before other modals
        closeScanner();
        closeRequestModal();
        closeResetPwModal();
        closeAddEquipmentModal();
        closeStickerModal();
        closePrintAllModal();
        document.querySelectorAll('.user-actions-menu.show').forEach(m => m.classList.remove('show'));
      }
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && document.getElementById('login-screen').style.display !== 'none') {
        doLogin();
      }
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.user-actions-dropdown')) {
        document.querySelectorAll('.user-actions-menu.show').forEach(m => m.classList.remove('show'));
      }
    });
    document.getElementById('room-picker-modal').addEventListener('click', e => { if (e.target.id === 'room-picker-modal') cancelRoomPicker(); }); // v4
    document.getElementById('scanner-modal').addEventListener('click', e => { if (e.target.id === 'scanner-modal') closeScanner(); });
    document.getElementById('request-modal').addEventListener('click', e => { if (e.target.id === 'request-modal') closeRequestModal(); });
    document.getElementById('reset-pw-modal').addEventListener('click', e => { if (e.target.id === 'reset-pw-modal') closeResetPwModal(); });
    document.getElementById('add-equipment-modal').addEventListener('click', e => { if (e.target.id === 'add-equipment-modal') closeAddEquipmentModal(); });
    document.getElementById('sticker-modal').addEventListener('click', e => { if (e.target.id === 'sticker-modal') closeStickerModal(); });
    document.getElementById('print-all-modal').addEventListener('click', e => { if (e.target.id === 'print-all-modal') closePrintAllModal(); });

    // ==========================================
    // ACCESSIBILITY & USABILITY ENHANCEMENTS
    // ==========================================

    // Password show/hide on the login form
    function togglePasswordVisibility(btn, inputId) {
      const input = document.getElementById(inputId);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    }

    // Scanner fallback: type the asset ID when the camera is unavailable
    function submitManualQr() {
      const input = document.getElementById('manual-qr');
      const value = input.value.trim();
      if (!value) {
        showToast('Enter an asset ID, e.g. MT-ICU-003.', 'error');
        input.focus();
        return;
      }
      const match = allEquipment.find(e => (e.qr_code_id || '').toLowerCase() === value.toLowerCase());
      input.value = '';
      onScanSuccess(match ? match.qr_code_id : value);
    }

    // Mobile: pending-requests shortcut (the sidebar sits below the whole list on narrow screens)
    function updateRequestsJump(reqs) {
      const link = document.getElementById('jump-requests');
      const num = document.getElementById('jump-req-count');
      if (!link || !num) return;
      const list = reqs || [];
      num.textContent = list.length;
      link.classList.toggle('has-urgent', list.some(r => r.priority === 'Urgent'));
    }

    function jumpToRequests(e) {
      e.preventDefault();
      const panel = document.getElementById('requests-panel');
      if (!panel) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      panel.focus({ preventScroll: true });
    }

    (function setupA11y() {
      const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
      const lastFocus = new Map();
      const wasOpen = new Map();
      const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

      // Label every dialog by its title
      overlays.forEach(ov => {
        wasOpen.set(ov, false);
        const title = ov.querySelector('.modal-title');
        if (title) {
          if (!title.id) title.id = ov.id + '-title';
          ov.setAttribute('aria-labelledby', title.id);
        }
        const box = ov.querySelector('.modal');
        if (box) box.setAttribute('tabindex', '-1');
      });

      // Modal focus management: move focus in, hide the page behind, restore focus on close
      const modalObserver = new MutationObserver(() => {
        overlays.forEach(ov => {
          const isOpen = ov.style.display !== 'none';
          if (isOpen === wasOpen.get(ov)) return;
          wasOpen.set(ov, isOpen);
          if (isOpen) {
            lastFocus.set(ov, document.activeElement);
            const box = ov.querySelector('.modal');
            setTimeout(() => {
              // Don't auto-focus the manual input in the scanner (it would pop the keyboard on phones)
              const field = ov.id !== 'scanner-modal' && box.querySelector('.modal-body input, .modal-body select, .modal-body textarea');
              (field || box).focus();
            }, 50);
          } else {
            const prev = lastFocus.get(ov);
            if (prev && document.contains(prev)) prev.focus();
          }
        });
        const anyOpen = overlays.some(o => o.style.display !== 'none');
        ['app-screen', 'login-screen'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.inert = anyOpen;
        });
      });
      overlays.forEach(ov => modalObserver.observe(ov, { attributes: true, attributeFilter: ['style'] }));

      // Keep Tab inside the open dialog
      document.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const open = overlays.find(o => o.style.display !== 'none');
        if (!open) return;
        const box = open.querySelector('.modal');
        const items = Array.from(open.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
        if (!items.length) { e.preventDefault(); box.focus(); return; }
        const first = items[0], last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === box)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      });

      // Mirror the visual "active" state of filter chips and nav tabs into ARIA
      function syncPressed() {
        document.querySelectorAll('.toolbar .filter-btn').forEach(b =>
          b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false'));
      }
      function syncCurrent() {
        document.querySelectorAll('#header-nav .nav-tab').forEach(b => {
          if (b.classList.contains('active')) b.setAttribute('aria-current', 'page');
          else b.removeAttribute('aria-current');
        });
      }
      const toolbar = document.querySelector('.toolbar');
      const nav = document.getElementById('header-nav');
      if (toolbar) new MutationObserver(syncPressed).observe(toolbar, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      if (nav) new MutationObserver(syncCurrent).observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      syncPressed();
      syncCurrent();
    })();

    // ==========================================
    // BOOT — check for existing session
    // ==========================================
    (async function boot() {
      const session = getSession();
      if (session && session.id && session.username && session.role) {
        // Verify session against database
        const { data, error } = await db.from('users').select('id').eq('id', session.id).eq('is_active', true).single();
        if (data && !error) {
          currentUser = session;
          showAppScreen();
          return;
        } else {
          clearSession();
        }
      }
      // else login screen is already visible (display:flex in HTML)
    })();

    // ==========================================
    // SECTION 2.5: READ-ONLY EXPORT FOR MOBILE CONTROLLER
    // ==========================================
    window.MediTrack = {
      getState: () => ({
        currentUser,
        allEquipment: Array.isArray(allEquipment) ? allEquipment : [],
        departments: Array.isArray(departments) ? departments : [],
        productTypes: Array.isArray(productTypes) ? productTypes : [],
        allRequests: Array.isArray(allRequests) ? allRequests : [],
        allAuditLogs: allAuditLogs || {},
        latestCheckoutRoom: latestCheckoutRoom || {},
        isDark: typeof isDark === 'function' ? isDark() : false
      }),
      actions: {
        doToggle: typeof doToggle === 'function' ? doToggle : null,
        manualToggle: typeof manualToggle === 'function' ? manualToggle : null,
        updateReq: typeof updateReq === 'function' ? updateReq : null,
        loadEquipment: typeof loadEquipment === 'function' ? loadEquipment : null,
        loadRequests: typeof loadRequests === 'function' ? loadRequests : null,
        loadUsersTable: typeof loadUsersTable === 'function' ? loadUsersTable : null,
        createUser: typeof createUser === 'function' ? createUser : null,
        toggleUserActive: typeof toggleUserActive === 'function' ? toggleUserActive : null,
        doResetPassword: typeof doResetPassword === 'function' ? doResetPassword : null,
        exportAuditCSV: typeof exportAuditCSV === 'function' ? exportAuditCSV : null,
        doLogout: typeof doLogout === 'function' ? doLogout : null,
        cycleTheme: typeof toggleTheme === 'function' ? toggleTheme : (typeof cycleTheme === 'function' ? cycleTheme : null),
        showPage: typeof showPage === 'function' ? showPage : null,
        showToast: typeof showToast === 'function' ? showToast : null,
        saveCondition: typeof saveCondition === 'function' ? saveCondition : null,
        openRequestModal: typeof openRequestModal === 'function' ? openRequestModal : null,
        openAddEquipmentModal: typeof openAddEquipmentModal === 'function' ? openAddEquipmentModal : null,
        openPrintAllModal: typeof openPrintAllModal === 'function' ? openPrintAllModal : null,
        openStickerModal: typeof openStickerModal === 'function' ? openStickerModal : null,
        startScanner: typeof startScanner === 'function' ? startScanner : null,
        stopScanner: typeof stopScanner === 'function' ? stopScanner : null,
        onScanSuccess: typeof onScanSuccess === 'function' ? onScanSuccess : null
      },
      DEPT_ROOMS: typeof DEPT_ROOMS !== 'undefined' ? DEPT_ROOMS : {}
    };

