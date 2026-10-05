import { describe, it, expect } from 'vitest';
import { formatEnum } from '../src/utils/formatEnum.js';
import { renderStatusBadge, getStatusConfig } from '../src/components/StatusBadge.js';
import { paginate } from '../src/utils/pagination.js';
import { sortEquipmentRows, sortAuditLogEntries } from '../src/utils/sorting.js';
import {
  computeEquipmentCounts,
  isStaleCheckout,
  isForgottenItem,
  groupEquipmentByProductType,
} from '../src/utils/equipmentStats.js';
import {
  validateBriefSummary,
  validateForgottenItems,
  processBriefSummaryWithFallback,
} from '../src/utils/briefValidator.js';

describe('T-01: formatEnum table from Section 4.1', () => {
  it('converts machine strings to title case and handles edge cases', () => {
    expect(formatEnum('needs_attention')).toBe('Needs attention');
    expect(formatEnum('in_use')).toBe('In use');
    expect(formatEnum('out_of_service')).toBe('Out of service');
    expect(formatEnum('available')).toBe('Available');
    expect(formatEnum('')).toBe('—');
    expect(formatEnum(null)).toBe('—');
    expect(formatEnum(undefined)).toBe('—');
    expect(formatEnum('already Fine')).toBe('already Fine');
  });
});

describe('T-02: StatusBadge rendering', () => {
  const statuses = [
    { status: 'available', expectedLabel: 'Available', expectedClass: 'badge-status-available' },
    { status: 'in_use', expectedLabel: 'In use', expectedClass: 'badge-status-inuse' },
    { status: 'maintenance', expectedLabel: 'Maintenance', expectedClass: 'badge-status-attention' },
    { status: 'out_of_service', expectedLabel: 'Out of service', expectedClass: 'badge-status-critical' },
    { status: 'overdue', expectedLabel: 'Overdue', expectedClass: 'badge-status-critical' },
    { status: 'inactive', expectedLabel: 'Inactive', expectedClass: 'badge-status-neutral' },
    { status: 'active', expectedLabel: 'Active', expectedClass: 'badge-status-active' },
  ];

  it.each(statuses)('renders correct badge for %s', ({ status, expectedLabel, expectedClass }) => {
    const html = renderStatusBadge(status);
    expect(html).toContain(expectedClass);
    expect(html).toContain(expectedLabel);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('status-badge-dot');
  });
});

describe('T-06: Pagination helper', () => {
  it('handles N = 0, 1, 25, 26, 61 items across page sizes 25, 50, 100', () => {
    // N = 0
    const p0 = paginate({ totalItems: 0, currentPage: 1, pageSize: 25 });
    expect(p0.totalPages).toBe(1);
    expect(p0.displayText).toBe('Showing 0 of 0');
    expect(p0.hasPrevious).toBe(false);
    expect(p0.hasNext).toBe(false);

    // N = 1
    const p1 = paginate({ totalItems: 1, currentPage: 1, pageSize: 25 });
    expect(p1.totalPages).toBe(1);
    expect(p1.displayText).toBe('Showing 1–1 of 1');

    // N = 25
    const p25 = paginate({ totalItems: 25, currentPage: 1, pageSize: 25 });
    expect(p25.totalPages).toBe(1);
    expect(p25.displayText).toBe('Showing 1–25 of 25');

    // N = 26
    const p26_p1 = paginate({ totalItems: 26, currentPage: 1, pageSize: 25 });
    expect(p26_p1.totalPages).toBe(2);
    expect(p26_p1.displayText).toBe('Showing 1–25 of 26');
    expect(p26_p1.hasNext).toBe(true);

    const p26_p2 = paginate({ totalItems: 26, currentPage: 2, pageSize: 25 });
    expect(p26_p2.displayText).toBe('Showing 26–26 of 26');
    expect(p26_p2.hasNext).toBe(false);

    // N = 61 at size 25
    const p61_p3 = paginate({ totalItems: 61, currentPage: 3, pageSize: 25 });
    expect(p61_p3.totalPages).toBe(3);
    expect(p61_p3.displayText).toBe('Showing 51–61 of 61');
    expect(p61_p3.hasNext).toBe(false);

    // N = 61 at size 50
    const p61_s50 = paginate({ totalItems: 61, currentPage: 2, pageSize: 50 });
    expect(p61_s50.totalPages).toBe(2);
    expect(p61_s50.displayText).toBe('Showing 51–61 of 61');

    // N = 61 at size 100
    const p61_s100 = paginate({ totalItems: 61, currentPage: 1, pageSize: 100 });
    expect(p61_s100.totalPages).toBe(1);
    expect(p61_s100.displayText).toBe('Showing 1–61 of 61');
  });
});

describe('T-07: Equipment table sorting', () => {
  const mockEquipment = [
    { id: 1, name: 'Ventilator B', department_name: 'ICU', status: 'In Use', in_use_since: '2026-10-04T10:00:00Z' },
    { id: 2, name: 'Infusion Pump A', department_name: 'General Ward', status: 'Available', in_use_since: null },
    { id: 3, name: 'Defibrillator A', department_name: 'Emergency', status: 'In Use', in_use_since: '2026-10-05T08:00:00Z' },
  ];

  it('sorts by name ascending and descending', () => {
    const asc = sortEquipmentRows(mockEquipment, 'name', 'asc');
    expect(asc[0].name).toBe('Defibrillator A');
    expect(asc[2].name).toBe('Ventilator B');

    const desc = sortEquipmentRows(mockEquipment, 'name', 'desc');
    expect(desc[0].name).toBe('Ventilator B');
    expect(desc[2].name).toBe('Defibrillator A');
  });

  it('sorts by department', () => {
    const sorted = sortEquipmentRows(mockEquipment, 'department', 'asc');
    expect(sorted[0].department_name).toBe('Emergency');
    expect(sorted[2].department_name).toBe('ICU');
  });

  it('sorts by held-for time', () => {
    const sorted = sortEquipmentRows(mockEquipment, 'held_for', 'desc');
    // Longer held time comes first (earlier in_use_since)
    expect(sorted[0].name).toBe('Ventilator B');
  });
});

describe('T-09: Inventory reconciliation counts', () => {
  it('asserts Total = Available + In use + Maintenance + Out of service', () => {
    const fixture = [
      ...Array(39).fill(null).map((_, i) => ({ id: i, status: 'Available', condition: 'Usable' })),
      ...Array(17).fill(null).map((_, i) => ({ id: 40 + i, status: 'In Use', condition: 'Usable' })),
      ...Array(3).fill(null).map((_, i) => ({ id: 60 + i, status: 'Available', condition: 'Needs Maintenance' })),
      ...Array(2).fill(null).map((_, i) => ({ id: 70 + i, status: 'Available', condition: 'Out of Order' })),
    ];

    const counts = computeEquipmentCounts(fixture);
    expect(counts.total).toBe(61);
    expect(counts.available).toBe(39);
    expect(counts.in_use).toBe(17);
    expect(counts.maintenance).toBe(3);
    expect(counts.out_of_service).toBe(2);
    expect(counts.needs_attention).toBe(5);
    expect(counts.available + counts.in_use + counts.maintenance + counts.out_of_service).toBe(counts.total);
  });
});

describe('T-10: Stale checkout & Forgotten equipment functions', () => {
  it('correctly flags stale checkouts (> 24 hours)', () => {
    expect(isStaleCheckout(24.5)).toBe(true);
    expect(isStaleCheckout(23.9)).toBe(false);
    expect(isStaleCheckout(null)).toBe(false);
  });

  it('correctly decides forgotten items using shared single-sourced threshold', () => {
    // Typical hold: 3.8 hours -> threshold = max(24, 3 * 3.8 = 11.4) = 24 hours
    expect(isForgottenItem(43.5, 3.8)).toBe(true);
    expect(isForgottenItem(12.0, 3.8)).toBe(false);

    // Typical hold: 10 hours -> threshold = max(24, 30) = 30 hours
    expect(isForgottenItem(28, 10)).toBe(false);
    expect(isForgottenItem(32, 10)).toBe(true);
  });
});

describe('T-11: LLM Validator', () => {
  const structuredFacts = {
    total: 61,
    available: 39,
    in_use: 22,
    checkouts_yesterday: 0,
    utilization_yesterday_pct: 1.7,
    overnight_count: 5,
    pending_requests: 0,
  };

  it('rejects wrong statement (39 items out of 61 in use)', () => {
    const wrongText = 'Hospital operations had 0 checkouts yesterday. Availability stands at 39 items out of 61 in use.';
    expect(validateBriefSummary(wrongText, structuredFacts)).toBe(false);
  });

  it('accepts correct statement with grounded numbers', () => {
    const validText = '39 of 61 items are available and 22 are in use. 5 items have been checked out overnight.';
    expect(validateBriefSummary(validText, structuredFacts)).toBe(true);
  });

  it('rejects invented numbers', () => {
    const inventedText = 'There are 12 items pending repair across departments.';
    expect(validateBriefSummary(inventedText, structuredFacts)).toBe(false);
  });

  it('rejects unknown equipment in forgotten items', () => {
    const catalog = [{ name: 'Infusion Pump A' }, { name: 'Ventilator A' }];
    const depts = [{ name: 'ICU' }, { name: 'Emergency' }];

    const invalidItems = [{ name: 'Ventilator Z', department: 'ICU' }];
    expect(validateForgottenItems(invalidItems, catalog, depts)).toBe(false);

    const validItems = [{ name: 'Infusion Pump A', department: 'ICU' }];
    expect(validateForgottenItems(validItems, catalog, depts)).toBe(true);
  });

  it('uses fallback template after 2 failed validation attempts', () => {
    const badAttempts = [
      '39 items out of 61 in use across the entire ward.',
      'Invented 99 items held overnight.',
    ];
    const res = processBriefSummaryWithFallback(badAttempts, structuredFacts);
    expect(res.usedFallback).toBe(true);
    expect(res.summary).toBe('39 of 61 items are available and 22 are in use. 5 items have been checked out overnight.');
  });
});

describe('T-15: Audit Log sorting and filtering', () => {
  const auditItems = [
    { name: 'Ventilator A', department: 'ICU', uses: 5, last_activity: '2026-10-04T12:00:00Z' },
    { name: 'Wheelchair B', department: 'General Ward', uses: 0, last_activity: null },
    { name: 'Infusion Pump A', department: 'Emergency', uses: 12, last_activity: '2026-10-05T08:00:00Z' },
  ];

  it('puts never-used items LAST by default', () => {
    const sorted = sortAuditLogEntries(auditItems, 'last_activity', 'desc');
    expect(sorted[0].name).toBe('Infusion Pump A'); // 05 Oct (newest)
    expect(sorted[1].name).toBe('Ventilator A');    // 04 Oct
    expect(sorted[2].name).toBe('Wheelchair B');    // never used (last)
  });
});

describe('T-16: Product type tile grouping and counts', () => {
  it('groups equipment by type with exact matching counts', () => {
    const equipment = [
      { id: 1, name: 'Ventilator A', status: 'Available', condition: 'Usable' },
      { id: 2, name: 'Ventilator B', status: 'In Use', condition: 'Usable' },
      { id: 3, name: 'Ventilator C', status: 'Available', condition: 'Usable' },
      { id: 4, name: 'Ventilator D', status: 'Available', condition: 'Needs Maintenance' },
      { id: 5, name: 'Wheelchair A', status: 'Available', condition: 'Usable' },
    ];

    const tiles = groupEquipmentByProductType(equipment);
    expect(tiles.length).toBe(2);

    const ventTile = tiles.find(t => t.name === 'Ventilator');
    expect(ventTile).toBeDefined();
    expect(ventTile.totalCount).toBe(4);
    expect(ventTile.availCount).toBe(2); // A and C are Available and Usable; B is In Use; D is Needs Maintenance

    const wcTile = tiles.find(t => t.name === 'Wheelchair');
    expect(wcTile).toBeDefined();
    expect(wcTile.totalCount).toBe(1);
    expect(wcTile.availCount).toBe(1);
  });
});
