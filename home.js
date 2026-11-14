// ============================================================
// MEDITRACK HOMEPAGE CONTROLLER (home.js)
// ============================================================

(function () {
  'use strict';

  // Equipment dataset matching MediTrackHomepage.tsx
  const equipmentRows = [
    { id: 'MT-IC-001', name: 'Ventilator A', dept: 'ICU', status: 'In use', tone: 'red', updated: 'Checked out · 09:42' },
    { id: 'MT-EM-014', name: 'Infusion Pump B', dept: 'Emergency', status: 'Available', tone: 'green', updated: 'Ready for allocation' },
    { id: 'MT-RD-008', name: 'Portable Monitor', dept: 'Radiology', status: 'Maintenance', tone: 'amber', updated: 'Inspection required' },
    { id: 'MT-OT-003', name: 'Anaesthesia Machine', dept: 'Operation Theatre', status: 'Available', tone: 'green', updated: 'Verified sterile' }
  ];

  const demoTabs = {
    Overview: {
      sub: 'MONDAY / SYSTEM SNAPSHOT',
      title: 'Hospital Operational Overview',
      tableTitle: 'Equipment status',
      stats: [
        { label: 'Available', val: '51', hint: 'Ready to allocate', cls: 'mp-green-text' },
        { label: 'In use', val: '06', hint: 'Currently checked out', cls: '' },
        { label: 'Needs attention', val: '06', hint: 'Maintenance / out of order', cls: 'mp-amber-text' }
      ],
      rows: equipmentRows
    },
    Inventory: {
      sub: 'MONDAY / EQUIPMENT OVERVIEW',
      title: 'Equipment inventory',
      tableTitle: 'Equipment status',
      stats: [
        { label: 'Available', val: '51', hint: 'Ready to allocate', cls: 'mp-green-text' },
        { label: 'In use', val: '06', hint: 'Currently checked out', cls: '' },
        { label: 'Needs attention', val: '06', hint: 'Maintenance / out of order', cls: 'mp-amber-text' }
      ],
      rows: equipmentRows
    },
    Requests: {
      sub: 'MONDAY / ACTIVE DISPATCHES',
      title: 'Inter-department Requests',
      tableTitle: 'Request queue',
      stats: [
        { label: 'Pending', val: '02', hint: 'Awaiting triage', cls: 'mp-amber-text' },
        { label: 'Approved', val: '01', hint: 'Ready to allocate', cls: 'mp-green-text' },
        { label: 'Turnaround', val: '8m', hint: 'Door-to-door', cls: '' }
      ],
      rows: [
        { id: 'RQ-006', name: 'Defibrillator', dept: 'Emergency', status: 'Pending', tone: 'amber', updated: 'Awaiting approval' },
        { id: 'RQ-004', name: 'Patient Monitor', dept: 'ICU', status: 'Approved', tone: 'green', updated: 'Ready to allocate' }
      ]
    },
    Maintenance: {
      sub: 'BIOMED / SERVICE QUEUE',
      title: 'Maintenance & Inspections',
      tableTitle: 'Maintenance watch',
      stats: [
        { label: 'In Service', val: '02', hint: 'Inspection due', cls: 'mp-amber-text' },
        { label: 'Scheduled', val: '04', hint: 'Bench calibration', cls: '' },
        { label: 'Cleared', val: '19', hint: 'This month', cls: 'mp-green-text' }
      ],
      rows: [
        { id: 'MT-RD-008', name: 'Portable Monitor', dept: 'Radiology', status: 'Maintenance', tone: 'amber', updated: 'Inspection required' },
        { id: 'MT-OT-002', name: 'Anaesthesia Machine', dept: 'Operation Theatre', status: 'Needs service', tone: 'amber', updated: 'Service due' }
      ]
    },
    'Audit log': {
      sub: 'SECURITY & COMPLIANCE',
      title: 'Recent activity',
      tableTitle: 'Recent activity',
      stats: [
        { label: 'Total Events', val: '515', hint: 'Tamper-proof', cls: 'mp-green-text' },
        { label: 'Staff Active', val: '28', hint: 'Across 6 units', cls: '' },
        { label: 'Exceptions', val: '0', hint: 'Zero untracked', cls: 'mp-green-text' }
      ],
      rows: [
        { id: 'EV-515', name: 'Ventilator A', dept: 'ICU', status: 'Checked out', tone: 'red', updated: 'Today · 09:42' },
        { id: 'EV-514', name: 'Wheelchair', dept: 'General Ward', status: 'Returned', tone: 'green', updated: 'Today · 08:15' }
      ]
    }
  };

  // Demo Tab Switching
  window.switchDemoTab = function (tabName) {
    const data = demoTabs[tabName] || demoTabs.Inventory;
    const buttons = document.querySelectorAll('.demo-tab-btn');
    buttons.forEach((b) => {
      const isSelected = b.getAttribute('data-tab') === tabName;
      b.classList.toggle('mp-side-active', isSelected);
      b.setAttribute('aria-pressed', String(isSelected));
    });

    const subEl = document.getElementById('demo-tab-sub');
    if (subEl) subEl.textContent = data.sub;

    const headingEl = document.getElementById('demo-tab-heading');
    if (headingEl) headingEl.textContent = data.title;

    const tableTitleEl = document.getElementById('demo-table-title');
    if (tableTitleEl) tableTitleEl.textContent = data.tableTitle;

    const statsEl = document.getElementById('demo-stats-strip');
    if (statsEl && data.stats) {
      statsEl.innerHTML = data.stats
        .map(
          (s) =>
            `<div><small>${s.label}</small><b>${s.val}</b><span class="${s.cls}">${s.hint}</span></div>`
        )
        .join('');
    }

    const tableEl = document.getElementById('demo-table-content');
    if (tableEl && data.rows) {
      tableEl.innerHTML = data.rows
        .map(
          (r) => `
        <div class="mp-equipment-row">
          <span class="mp-equipment-glyph" aria-hidden="true">▤</span>
          <div class="mp-equipment-name">
            <b>${r.name}</b>
            <small>${r.id} · ${r.dept}</small>
          </div>
          <small class="mp-equipment-updated">${r.updated}</small>
          <span class="mp-status mp-status-${r.tone}">${r.status}</span>
        </div>`
        )
        .join('');
    }
  };

  // Time-Lost Interactive Calculator
  window.updateTimeLostCalc = function () {
    const minEl = document.getElementById('mp-calc-minutes');
    const searchEl = document.getElementById('mp-calc-searches');
    const shiftEl = document.getElementById('mp-calc-shifts');
    if (!minEl || !searchEl || !shiftEl) return;

    const m = parseInt(minEl.value, 10) || 5;
    const s = parseInt(searchEl.value, 10) || 8;
    const sh = parseInt(shiftEl.value, 10) || 18;

    const mVal = document.getElementById('mp-calc-minutes-val');
    if (mVal) mVal.textContent = m + ' min';

    const sVal = document.getElementById('mp-calc-searches-val');
    if (sVal) sVal.textContent = s;

    const shVal = document.getElementById('mp-calc-shifts-val');
    if (shVal) shVal.textContent = sh;

    const hours = ((m * s * sh) / 60).toFixed(1);
    const hrsEl = document.getElementById('mp-calc-hours');
    if (hrsEl) hrsEl.textContent = hours;

    const eqEl = document.getElementById('mp-calc-equation');
    if (eqEl) eqEl.textContent = `${m} min × ${s} searches × ${sh} shifts ÷ 60`;
  };

  // FAQ Accordion
  window.toggleFaq = function (btn) {
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.mp-faq-item button').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
      const icon = b.querySelector('b');
      if (icon) icon.textContent = '+';
      const panel = b.nextElementSibling;
      if (panel) panel.hidden = true;
    });

    if (!isExpanded) {
      btn.setAttribute('aria-expanded', 'true');
      const icon = btn.querySelector('b');
      if (icon) icon.textContent = '−';
      const panel = btn.nextElementSibling;
      if (panel) panel.hidden = false;
    }
  };

  // Mobile Navigation Menu Toggle
  window.toggleMobileNav = function () {
    const nav = document.getElementById('mp-nav-links');
    const btn = document.querySelector('.mp-mobile-menu');
    if (!nav) return;
    const isOpen = nav.classList.toggle('mp-nav-links-open');
    if (btn) {
      btn.setAttribute('aria-expanded', String(isOpen));
      btn.textContent = isOpen ? '×' : '☰';
    }
  };

  window.closeMobileNav = function () {
    const nav = document.getElementById('mp-nav-links');
    const btn = document.querySelector('.mp-mobile-menu');
    if (nav && nav.classList.contains('mp-nav-links-open')) {
      nav.classList.remove('mp-nav-links-open');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '☰';
      }
    }
  };

  // CountUp Animation for Metric Numbers
  function initCountUp() {
    const elements = document.querySelectorAll('.mp-countup');
    if (!elements.length) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((el) => {
        const target = parseInt(el.getAttribute('data-target') || el.textContent, 10);
        el.textContent = target >= 10 ? String(target).padStart(2, '0') : String(target).padStart(2, '0');
      });
      return;
    }

    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => {
        const target = parseInt(el.getAttribute('data-target') || el.textContent, 10);
        el.textContent = target >= 10 ? String(target).padStart(2, '0') : String(target).padStart(2, '0');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target') || el.textContent, 10);
          const start = performance.now();
          const duration = 1050;

          function tick(now) {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const count = Math.round(target * eased);
            el.textContent = String(count).padStart(2, '0');
            if (progress < 1) {
              requestAnimationFrame(tick);
            } else {
              el.textContent = String(target).padStart(2, '0');
            }
          }
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.55 }
    );

    elements.forEach((el) => observer.observe(el));
  }

  // Fallback Scroll Progress Indicator (if CSS animation-timeline is unsupported)
  function initScrollProgress() {
    const bar = document.querySelector('.mp-scroll-progress');
    if (!bar) return;
    if (window.CSS && CSS.supports && CSS.supports('animation-timeline', 'scroll()')) {
      return; // Native CSS scroll driven animation is active
    }
    function onScroll() {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const progress = Math.min(1, Math.max(0, window.scrollY / docHeight));
      bar.style.transform = 'scaleX(' + progress + ')';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Screen Switching Logic
  window.showHomeScreen = function () {
    const home = document.getElementById('home-screen');
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app-screen');
    if (home) home.style.display = 'block';
    if (login) login.style.display = 'none';
    if (app) app.style.display = 'none';
    if (window.location.hash === '#login' || window.location.hash === '#app') {
      try {
        history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateHomeUserStatus();
  };

  window.showLoginScreen = function () {
    if (window.currentUser) {
      if (typeof window.showAppScreen === 'function') {
        window.showAppScreen();
        return;
      }
    }
    const home = document.getElementById('home-screen');
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app-screen');
    if (home) home.style.display = 'none';
    if (app) app.style.display = 'none';
    if (login) login.style.display = 'flex';
    try {
      window.location.hash = '#login';
    } catch (e) {}
    const usernameInput = document.getElementById('login-username');
    if (usernameInput) {
      setTimeout(() => usernameInput.focus(), 50);
    }
  };

  function updateHomeUserStatus() {
    const ctaBtns = document.querySelectorAll('#landing-login-btn, #hero-portal-btn, #footer-portal-btn');
    if (window.currentUser) {
      ctaBtns.forEach((btn) => {
        btn.innerHTML = `Open Dashboard <span>↗</span>`;
        btn.onclick = function () {
          if (typeof window.showAppScreen === 'function') window.showAppScreen();
        };
      });
    } else {
      ctaBtns.forEach((btn) => {
        btn.innerHTML = `Staff Portal <span>↗</span>`;
        btn.onclick = function () {
          window.showLoginScreen();
        };
      });
    }
  }

  // Scroll Reveal Animations
  function initScrollReveal() {
    const nodes = Array.from(document.querySelectorAll('.mp-reveal'));
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('mp-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('mp-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px 150px 0px' }
    );
    nodes.forEach((n) => observer.observe(n));

    setTimeout(() => {
      nodes.forEach((n) => {
        const rect = n.getBoundingClientRect();
        if (rect.top < window.innerHeight + 100) {
          n.classList.add('mp-visible');
        }
      });
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.switchDemoTab('Inventory');
    window.updateTimeLostCalc();
    initScrollReveal();
    initCountUp();
    initScrollProgress();

    // Check initial route / hash
    const hash = window.location.hash;
    if (hash === '#login') {
      window.showLoginScreen();
    } else if (hash === '#app' && window.currentUser) {
      if (typeof window.showAppScreen === 'function') window.showAppScreen();
    } else {
      window.showHomeScreen();
    }
  });

  window.updateHomeUserStatus = updateHomeUserStatus;
})();
