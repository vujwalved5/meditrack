import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const htmlContent = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

describe('DOM & Integration Tests (T-03, T-04, T-05, T-08, T-12, T-13, T-14)', () => {
  let doc;

  beforeEach(() => {
    const parser = new DOMParser();
    doc = parser.parseFromString(htmlContent, 'text/html');
  });

  describe('T-03: No raw HTML entities in user-facing text', () => {
    it('ensures no &middot;, &bull;, &#9654;, or other raw entities exist in rendered strings', () => {
      // Check visible body text and innerHTML of template/markup elements
      const bodyHtml = doc.body.innerHTML;
      
      // Specifically assert no un-decoded entities in text nodes or attribute values that show to user
      const rawEntityRegex = /&(middot|bull|mdash|ndash|rarr|larr|hellip);|&#(9654|183|8226);/g;
      const matches = bodyHtml.match(rawEntityRegex) || [];
      expect(matches).toEqual([]);
    });

    it('ensures literal middle dot · and arrow → are real characters, not entities', () => {
      expect(doc.body.innerHTML).toContain('·');
    });
  });

  describe('T-04: No snake_case tokens in status/badge elements', () => {
    it('ensures status badges and chip elements do not contain snake_case strings', () => {
      const badgeElements = doc.querySelectorAll('.status-badge, .role-chip, .active-badge, .badge, .chip');
      const snakeCaseRegex = /\b[a-z]+_[a-z]+\b/;

      badgeElements.forEach(badge => {
        const text = badge.textContent.trim();
        expect(text).not.toMatch(snakeCaseRegex);
      });
    });
  });

  describe('T-05: Model name (gemini) not present in DOM while popovers are closed', () => {
    it('ensures gemini-3.5-flash-lite is hidden behind info popover and not directly rendered in card headers/footers', () => {
      const headers = doc.querySelectorAll('.ai-card-header, .card-header, .panel-header');
      headers.forEach(h => {
        expect(h.textContent.toLowerCase()).not.toContain('gemini');
      });

      const footers = doc.querySelectorAll('.ai-card-footer, .card-footer');
      footers.forEach(f => {
        expect(f.textContent.toLowerCase()).not.toContain('gemini');
      });
    });
  });

  describe('T-08: Equipment filters and filter summary bar', () => {
    it('has filter controls for status, department, and a clear filters summary bar', () => {
      const filterSummaryBar = doc.getElementById('filter-summary-bar');
      expect(filterSummaryBar).not.toBeNull();

      const clearBtn = doc.getElementById('clear-filters-btn');
      expect(clearBtn).not.toBeNull();
      expect(clearBtn.textContent).toContain('Clear filters');

      const statusGroup = doc.getElementById('status-filter-group');
      expect(statusGroup).not.toBeNull();

      const deptContainer = doc.getElementById('dept-filter-group');
      expect(deptContainer).not.toBeNull();
    });
  });

  describe('T-12: AI Daily Insights collapsed by default and KPI hierarchy', () => {
    it('renders KPI bar above AI Insights', () => {
      const kpiRow = doc.getElementById('kpi-stats-bar');
      const aiSection = doc.getElementById('ai-insights-section');
      expect(kpiRow).not.toBeNull();
      expect(aiSection).not.toBeNull();

      // Assert KPI row appears before AI Insights section in document tree
      const position = kpiRow.compareDocumentPosition(aiSection);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('has AI insights content collapsed by default with summary text line', () => {
      const aiBody = doc.getElementById('ai-insights-body');
      expect(aiBody).not.toBeNull();
      expect(aiBody.style.display).toBe('none');

      const summaryText = doc.getElementById('ai-summary-text');
      expect(summaryText).not.toBeNull();

      const toggleBtn = doc.getElementById('ai-collapse-btn');
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    });

    it('has exactly 4 KPI cards including NEEDS ATTENTION', () => {
      const kpiCards = doc.querySelectorAll('#kpi-stats-bar .stat-card');
      expect(kpiCards.length).toBe(4);

      const labels = Array.from(kpiCards).map(c => c.querySelector('.stat-label')?.textContent.trim());
      expect(labels).toContain('NEEDS ATTENTION');
      expect(labels).toContain('TOTAL EQUIPMENT');
      expect(labels).toContain('AVAILABLE');
      expect(labels).toContain('IN USE');
    });
  });

  describe('T-13: Header avatar menu structure and interactions', () => {
    it('has a single avatar button with initials and a dropdown menu', () => {
      const avatarBtn = doc.getElementById('header-avatar-btn');
      expect(avatarBtn).not.toBeNull();
      expect(avatarBtn.getAttribute('aria-haspopup')).toBe('menu');

      const avatarMenu = doc.getElementById('avatar-menu');
      expect(avatarMenu).not.toBeNull();
      expect(avatarMenu.getAttribute('role')).toBe('menu');

      const themeToggle = doc.getElementById('menu-theme-btn');
      expect(themeToggle).not.toBeNull();

      const logoutBtn = doc.getElementById('menu-logout-btn');
      expect(logoutBtn).not.toBeNull();
    });

    it('renders live status badge with tooltip', () => {
      const liveBadge = doc.getElementById('live-badge');
      expect(liveBadge).not.toBeNull();
      expect(liveBadge.getAttribute('title')).toBeTruthy();
    });
  });

  describe('T-14: User management controls, kebab menu, and confirmation dialog', () => {
    it('has user search input, segmented status filter, and hide demo checkbox', () => {
      const searchInput = doc.getElementById('user-search-input');
      expect(searchInput).not.toBeNull();
      expect(searchInput.getAttribute('placeholder')).toBe('Search users…');

      const filterAll = doc.getElementById('user-filter-all');
      const filterActive = doc.getElementById('user-filter-active');
      const filterInactive = doc.getElementById('user-filter-inactive');
      expect(filterAll).not.toBeNull();
      expect(filterActive).not.toBeNull();
      expect(filterInactive).not.toBeNull();

      const hideDemoCheckbox = doc.getElementById('user-hide-demo');
      expect(hideDemoCheckbox).not.toBeNull();
    });

    it('has create user form with dynamic role hint and disabled submit button', () => {
      const roleSelect = doc.getElementById('new-role');
      expect(roleSelect).not.toBeNull();

      const roleHelper = doc.getElementById('role-helper-text');
      expect(roleHelper).not.toBeNull();

      const createBtn = doc.getElementById('create-user-btn');
      expect(createBtn).not.toBeNull();
      expect(createBtn.disabled).toBe(true);

      const deptSelect = doc.getElementById('new-dept');
      expect(deptSelect.innerHTML).toContain('No department (optional)');
    });

    it('has confirm dialog component in place for destructive actions', () => {
      const dialogModal = doc.getElementById('confirm-modal');
      expect(dialogModal).not.toBeNull();

      const cancelBtn = doc.querySelector('#confirm-modal .btn-cancel');
      const confirmBtn = doc.getElementById('confirm-modal-ok');
      expect(cancelBtn).not.toBeNull();
      expect(confirmBtn).not.toBeNull();
    });
  });

  describe('P1-12: Audit Log Screen Elements', () => {
    it('has hide-never-used toggle switch, export CSV button, and filters', () => {
      const hideNeverUsed = doc.getElementById('audit-hide-never-used');
      expect(hideNeverUsed).not.toBeNull();

      const exportBtn = doc.getElementById('audit-export-btn');
      expect(exportBtn).not.toBeNull();

      const searchInput = doc.getElementById('audit-search');
      expect(searchInput).not.toBeNull();

      const deptFilter = doc.getElementById('audit-dept-filter');
      expect(deptFilter).not.toBeNull();

      const dateFilter = doc.getElementById('audit-date-filter');
      expect(dateFilter).not.toBeNull();

      const actionFilter = doc.getElementById('audit-action-filter');
      expect(actionFilter).not.toBeNull();
    });
  });

  describe('P3-11: Landmarks & Heading Hierarchy', () => {
    it('has skip link and main landmark structure', () => {
      const skipLink = doc.querySelector('.skip-link');
      expect(skipLink).not.toBeNull();
      expect(skipLink.getAttribute('href')).toBe('#main-content');

      const header = doc.querySelector('header');
      expect(header).not.toBeNull();

      const nav = doc.querySelector('nav#header-nav');
      expect(nav).not.toBeNull();
      expect(nav.getAttribute('aria-label')).toBe('Main navigation');

      const main = doc.querySelector('main#main-content');
      expect(main).not.toBeNull();
    });

    it('ensures each screen has exactly one h1 element', () => {
      const pages = ['#page-dashboard', '#page-auditlog', '#page-users'];
      pages.forEach(selector => {
        const page = doc.querySelector(selector);
        expect(page).not.toBeNull();
        const h1s = page.querySelectorAll('h1');
        expect(h1s.length).toBe(1);
      });
    });
  });

  describe('P3-03 & P3-04: Toast & Command Palette Elements', () => {
    it('has command palette backdrop and search input', () => {
      const palette = doc.getElementById('cmd-palette-backdrop');
      expect(palette).not.toBeNull();
      const paletteInput = doc.getElementById('cmd-palette-input');
      expect(paletteInput).not.toBeNull();

      const kbdHint = doc.querySelector('.search-kbd-hint');
      expect(kbdHint).not.toBeNull();
      expect(kbdHint.textContent).toContain('Ctrl K');
    });

    it('has toast container with status role', () => {
      const toastContainer = doc.getElementById('toast-container');
      expect(toastContainer).not.toBeNull();
      expect(toastContainer.getAttribute('role')).toBe('status');
    });
  });
});
