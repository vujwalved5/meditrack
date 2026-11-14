// ============================================================
// MEDITRACK HOMEPAGE CONTROLLER (home.js)
// ============================================================

(function () {
  'use strict';

  const demoTabs = {
    Overview: {
      sub: 'MONDAY / SYSTEM SNAPSHOT',
      title: 'Hospital Operational Overview',
      stats: [
        { label: 'Available', val: '51', hint: 'Ready to allocate', cls: 'mp-green-text' },
        { label: 'In use', val: '06', hint: 'Currently checked out', cls: '' },
        { label: 'Needs attention', val: '06', hint: 'Maintenance / out of order', cls: 'mp-amber-text' }
      ],
      rows: [
        { id: 'MT-IC-001', name: 'Ventilator A', dept: 'ICU', status: 'In use', tone: 'red', updated: 'Checked out · 09:42' },
        { id: 'MT-EM-014', name: 'Infusion Pump B', dept: 'Emergency', status: 'Available', tone: 'green', updated: 'Ready for allocation' },
        { id: 'MT-RD-008', name: 'Portable Monitor', dept: 'Radiology', status: 'Maintenance', tone: 'amber', updated: 'Inspection required' }
      ]
    },
    Inventory: {
      sub: 'MONDAY / EQUIPMENT OVERVIEW',
      title: 'Equipment inventory',
      stats: [
        { label: 'Available', val: '51', hint: 'Ready to allocate', cls: 'mp-green-text' },
        { label: 'In use', val: '06', hint: 'Currently checked out', cls: '' },
        { label: 'Needs attention', val: '06', hint: 'Maintenance / out of order', cls: 'mp-amber-text' }
      ],
      rows: [
        { id: 'MT-IC-001', name: 'Ventilator A', dept: 'ICU', status: 'In use', tone: 'red', updated: 'Checked out · 09:42' },
        { id: 'MT-EM-014', name: 'Infusion Pump B', dept: 'Emergency', status: 'Available', tone: 'green', updated: 'Ready for allocation' },
        { id: 'MT-RD-008', name: 'Portable Monitor', dept: 'Radiology', status: 'Maintenance', tone: 'amber', updated: 'Inspection required' },
        { id: 'MT-OT-003', name: 'Anaesthesia Machine', dept: 'Operation Theatre', status: 'Available', tone: 'green', updated: 'Verified sterile' }
      ]
    },
    Requests: {
      sub: 'MONDAY / ACTIVE DISPATCHES',
      title: 'Inter-department Requests',
      stats: [
        { label: 'Pending', val: '02', hint: 'Awaiting triage', cls: 'mp-amber-text' },
        { label: 'Fulfilled', val: '14', hint: 'Dispatched today', cls: 'mp-green-text' },
        { label: 'Avg Turnaround', val: '8m', hint: 'Door-to-door', cls: '' }
      ],
      rows: [
        { id: 'REQ-104', name: 'ICU requests Infusion Pump', dept: 'To Bed 4', status: 'In review', tone: 'amber', updated: 'Requested 12m ago' },
        { id: 'REQ-103', name: 'Emergency requests Crash Cart', dept: 'Trauma Bay 1', status: 'Dispatched', tone: 'green', updated: 'En route' }
      ]
    },
    Maintenance: {
      sub: 'BIOMED / SERVICE QUEUE',
      title: 'Maintenance & Inspections',
      stats: [
        { label: 'In Service', val: '04', hint: 'Bench calibration', cls: 'mp-amber-text' },
        { label: 'Scheduled', val: '02', hint: 'Safety checks due', cls: '' },
        { label: 'Cleared', val: '19', hint: 'This month', cls: 'mp-green-text' }
      ],
      rows: [
        { id: 'MT-RD-008', name: 'Portable Monitor', dept: 'Radiology', status: 'Sensor Error', tone: 'red', updated: 'Replaced cable' },
        { id: 'MT-GW-022', name: 'ECG Recorder', dept: 'General Ward', status: 'Calibration', tone: 'amber', updated: 'Annual check' }
      ]
    },
    'Audit log': {
      sub: 'SECURITY & COMPLIANCE',
      title: 'Chain-of-Custody Audit Log',
      stats: [
        { label: 'Total Events', val: '515', hint: 'Tamper-proof', cls: 'mp-green-text' },
        { label: 'Staff Active', val: '28', hint: 'Across 6 units', cls: '' },
        { label: 'Exceptions', val: '0', hint: 'Zero untracked', cls: 'mp-green-text' }
      ],
      rows: [
        { id: 'AUD-992', name: 'Admin1 checked out Ventilator A', dept: 'ICU (Bed 2)', status: 'Verified', tone: 'green', updated: '09:42:15' },
        { id: 'AUD-991', name: 'Nurse2 returned Infusion Pump B', dept: 'Emergency', status: 'Cleaned', tone: 'green', updated: '08:15:02' }
      ]
    }
  };

  window.switchDemoTab = function (tabName) {
    const data = demoTabs[tabName] || demoTabs.Inventory;
    const buttons = document.querySelectorAll('.demo-tab-btn');
    buttons.forEach((b) => {
      if (b.getAttribute('data-tab') === tabName) {
        b.classList.add('mp-side-active');
      } else {
        b.classList.remove('mp-side-active');
      }
    });

    const subEl = document.getElementById('demo-tab-sub');
    if (subEl) subEl.textContent = data.sub;

    const headingEl = document.getElementById('demo-tab-heading');
    if (headingEl) headingEl.textContent = data.title;

    const statsEl = document.getElementById('demo-stats-strip');
    if (statsEl) {
      statsEl.innerHTML = data.stats
        .map(
          (s) =>
            `<div><small>${s.label}</small><b>${s.val}</b><span class="${s.cls}">${s.hint}</span></div>`
        )
        .join('');
    }

    const tableEl = document.getElementById('demo-table-content');
    if (tableEl) {
      tableEl.innerHTML = data.rows
        .map(
          (r) =>
            `<div class="mp-equipment-row">
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

    // Trigger check immediately for elements in initial viewport
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
