// ============================================================
// metrics.test.ts — Unit tests for core logic (Deno test runner)
// Run with: deno test supabase/functions/daily-insights/metrics.test.ts
// ============================================================

import { assertEquals, assertAlmostEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseUtc, toLocalDate, localDayBounds } from './time.ts';
import { AppData, Session, busyHours } from './data.ts';
import { computeForgottenItems, computeBriefMetrics, computeRebalancingCandidates } from './metrics.ts';

// ──────────────────────────────────────────────────────────
// parseUtc
// ──────────────────────────────────────────────────────────
Deno.test('parseUtc — naive string (no Z) is treated as UTC', () => {
  const d = parseUtc('2025-01-15T14:30:00');
  assertEquals(d.toISOString(), '2025-01-15T14:30:00.000Z');
});

Deno.test('parseUtc — string with Z is parsed as-is', () => {
  const d = parseUtc('2025-01-15T14:30:00Z');
  assertEquals(d.toISOString(), '2025-01-15T14:30:00.000Z');
});

Deno.test('parseUtc — string with offset is parsed as-is', () => {
  const d = parseUtc('2025-01-15T20:00:00+05:30');
  assertEquals(d.toISOString(), '2025-01-15T14:30:00.000Z');
});

Deno.test('parseUtc — null/undefined returns NaN date', () => {
  assert(isNaN(parseUtc(null as any).getTime()));
  assert(isNaN(parseUtc(undefined as any).getTime()));
});

// ──────────────────────────────────────────────────────────
// localDayBounds
// ──────────────────────────────────────────────────────────
Deno.test('localDayBounds — IST day start is UTC-5:30', () => {
  // 2025-01-15 00:00 IST = 2025-01-14 18:30:00 UTC
  const { start, end } = localDayBounds('2025-01-15', 'Asia/Kolkata');
  assertEquals(start.toISOString(), '2025-01-14T18:30:00.000Z');
  assertEquals(end.toISOString(), '2025-01-15T18:30:00.000Z');
});

// ──────────────────────────────────────────────────────────
// busyHours
// ──────────────────────────────────────────────────────────
Deno.test('busyHours — full overlap', () => {
  const now = new Date('2025-01-15T12:00:00Z');
  const winStart = new Date('2025-01-15T06:00:00Z');
  const winEnd = new Date('2025-01-15T12:00:00Z');
  const sessions: Session[] = [{
    equipment_id: 1,
    start: new Date('2025-01-15T07:00:00Z'),
    end: new Date('2025-01-15T11:00:00Z'),
    duration_hours: 4,
    held_by: 'test',
    inferred: false,
    open: false,
  }];
  assertAlmostEquals(busyHours(sessions, winStart, winEnd, now), 4, 0.001);
});

Deno.test('busyHours — partial overlap', () => {
  const now = new Date('2025-01-15T12:00:00Z');
  const winStart = new Date('2025-01-15T06:00:00Z');
  const winEnd = new Date('2025-01-15T10:00:00Z');
  const sessions: Session[] = [{
    equipment_id: 1,
    start: new Date('2025-01-15T08:00:00Z'),
    end: new Date('2025-01-15T14:00:00Z'), // extends past window
    duration_hours: 6,
    held_by: 'test',
    inferred: false,
    open: false,
  }];
  assertAlmostEquals(busyHours(sessions, winStart, winEnd, now), 2, 0.001);
});

Deno.test('busyHours — open session ends at now', () => {
  const now = new Date('2025-01-15T12:00:00Z');
  const winStart = new Date('2025-01-15T06:00:00Z');
  const winEnd = new Date('2025-01-15T18:00:00Z');
  const sessions: Session[] = [{
    equipment_id: 1,
    start: new Date('2025-01-15T08:00:00Z'),
    end: null,
    duration_hours: null,
    held_by: 'test',
    inferred: false,
    open: true,
  }];
  // 8:00 to 12:00 (now) = 4h, clipped to window
  assertAlmostEquals(busyHours(sessions, winStart, winEnd, now), 4, 0.001);
});

// ──────────────────────────────────────────────────────────
// Session pairing helper (testing via computeForgottenItems behavior)
// ──────────────────────────────────────────────────────────

function makeEquipment(id: number, status: string, inUseSince?: string) {
  return {
    id,
    name: `Equipment ${id}`,
    qr_code_id: `MT-00${id}`,
    department_id: 1,
    department_name: 'ICU',
    status,
    condition: 'Usable',
    held_by: status === 'In Use' ? 'user1' : null,
    in_use_since: inUseSince ?? null,
    product_type_id: null,
    equip_type: 'equipment',
    equip_type_display: 'Equipment',
  };
}

function makeAppDataWithSessions(sessionsMap: Map<number, Session[]>, equipment: any[] = []): AppData {
  return {
    equipment,
    audit: [],
    requests: [],
    users: [],
    sessions: sessionsMap,
    historyDays: 30,
  };
}

// ──────────────────────────────────────────────────────────
// Forgotten Equipment — median and threshold logic
// ──────────────────────────────────────────────────────────

Deno.test('computeForgottenItems — not flagged when below threshold', () => {
  const now = new Date('2025-01-15T12:00:00Z');
  // Typical is 2h → threshold = max(3*2, 2) = 6h. Held 5h → not flagged
  const eq = makeEquipment(1, 'In Use', '2025-01-15T07:00:00Z');
  const completedSessions: Session[] = Array.from({ length: 5 }, (_, i) => ({
    equipment_id: 1,
    start: new Date(`2025-01-10T0${i}:00:00Z`),
    end: new Date(`2025-01-10T0${i + 2}:00:00Z`),
    duration_hours: 2,
    held_by: 'u',
    inferred: false,
    open: false,
  }));
  const openSession: Session = {
    equipment_id: 1,
    start: new Date('2025-01-15T07:00:00Z'),
    end: null,
    duration_hours: null,
    held_by: 'user1',
    inferred: false,
    open: true,
  };
  const sessMap = new Map([[1, [...completedSessions, openSession]]]);
  const data = makeAppDataWithSessions(sessMap, [eq]);
  const items = computeForgottenItems(data, now);
  assertEquals(items.length, 0);
});

Deno.test('computeForgottenItems — flagged warning when above threshold, not critical', () => {
  const now = new Date('2025-01-15T12:00:00Z');
  // 5 completed sessions of 2h each → median=2h, threshold=max(6,2)=6h
  // Held 7h → flagged warning; critical would need 6*2=12h
  const eq = makeEquipment(1, 'In Use', '2025-01-15T05:00:00Z');
  const completedSessions: Session[] = Array.from({ length: 5 }, (_, i) => ({
    equipment_id: 1,
    start: new Date(`2025-01-10T0${i}:00:00Z`),
    end: new Date(`2025-01-10T0${i + 2}:00:00Z`),
    duration_hours: 2,
    held_by: 'u',
    inferred: false,
    open: false,
  }));
  const openSession: Session = {
    equipment_id: 1,
    start: new Date('2025-01-15T05:00:00Z'), // 7h ago
    end: null,
    duration_hours: null,
    held_by: 'user1',
    inferred: false,
    open: true,
  };
  const sessMap = new Map([[1, [...completedSessions, openSession]]]);
  const data = makeAppDataWithSessions(sessMap, [eq]);
  const items = computeForgottenItems(data, now);
  assertEquals(items.length, 1);
  assertEquals(items[0].severity, 'warning');
  assertEquals(items[0].basis, 'type');
});

Deno.test('computeForgottenItems — flagged critical when >= 6x median', () => {
  const now = new Date('2025-01-15T22:00:00Z');
  // 5 completed sessions of 2h each → median=2h, 6x=12h, held 13h → critical
  const eq = makeEquipment(1, 'In Use', '2025-01-15T09:00:00Z');
  const completedSessions: Session[] = Array.from({ length: 5 }, (_, i) => ({
    equipment_id: 1,
    start: new Date(`2025-01-10T0${i}:00:00Z`),
    end: new Date(`2025-01-10T0${i + 2}:00:00Z`),
    duration_hours: 2,
    held_by: 'u',
    inferred: false,
    open: false,
  }));
  const openSession: Session = {
    equipment_id: 1,
    start: new Date('2025-01-15T09:00:00Z'), // 13h ago
    end: null,
    duration_hours: null,
    held_by: 'user1',
    inferred: false,
    open: true,
  };
  const sessMap = new Map([[1, [...completedSessions, openSession]]]);
  const data = makeAppDataWithSessions(sessMap, [eq]);
  const items = computeForgottenItems(data, now);
  assertEquals(items.length, 1);
  assertEquals(items[0].severity, 'critical');
});

Deno.test('computeForgottenItems — basis=default when <5 type sessions and <5 global', () => {
  const now = new Date('2025-01-15T12:00:00Z');
  // Only 2 completed sessions → no median. Default threshold = 8h. Held 10h → flagged
  const eq = makeEquipment(1, 'In Use', '2025-01-15T02:00:00Z');
  const completedSessions: Session[] = Array.from({ length: 2 }, (_, i) => ({
    equipment_id: 1,
    start: new Date(`2025-01-10T0${i}:00:00Z`),
    end: new Date(`2025-01-10T0${i + 2}:00:00Z`),
    duration_hours: 2,
    held_by: 'u',
    inferred: false,
    open: false,
  }));
  const openSession: Session = {
    equipment_id: 1,
    start: new Date('2025-01-15T02:00:00Z'), // 10h ago
    end: null,
    duration_hours: null,
    held_by: 'user1',
    inferred: false,
    open: true,
  };
  const sessMap = new Map([[1, [...completedSessions, openSession]]]);
  const data = makeAppDataWithSessions(sessMap, [eq]);
  const items = computeForgottenItems(data, now);
  assertEquals(items.length, 1);
  assertEquals(items[0].basis, 'default');
  assertEquals(items[0].typical_hours, null);
});

// ──────────────────────────────────────────────────────────
// Rebalancing — candidate selection
// ──────────────────────────────────────────────────────────

Deno.test('computeRebalancingCandidates — skips when history is thin', () => {
  const data: AppData = {
    equipment: [],
    audit: [],
    requests: [],
    users: [],
    sessions: new Map(),
    historyDays: 1, // < MIN_HISTORY_DAYS
  };
  const { candidates, skip_reason } = computeRebalancingCandidates(data, new Date());
  assertEquals(candidates.length, 0);
  assert(skip_reason !== null && skip_reason.includes('history'));
});

Deno.test('computeRebalancingCandidates — produces candidate for pressure/surplus pair', () => {
  const now = new Date('2025-01-15T12:00:00Z');

  // Two departments with the same type: ICU (pressure) and General Ward (surplus)
  const icu: any = makeEquipment(1, 'Available');
  icu.department_id = 1; icu.department_name = 'ICU'; icu.equip_type = 'infusion pump'; icu.equip_type_display = 'Infusion Pump';

  const gw: any = makeEquipment(2, 'Available');
  gw.department_id = 2; gw.department_name = 'General Ward'; gw.equip_type = 'infusion pump'; gw.equip_type_display = 'Infusion Pump';

  const winStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  // ICU has 3 demand requests
  const requests: any[] = [
    { id: 1, equipment_id: 1, requested_by: 'nurse1', priority: 'Normal', status: 'Pending', created_at: '2025-01-14T10:00:00Z' },
    { id: 2, equipment_id: 1, requested_by: 'nurse1', priority: 'Urgent', status: 'Pending', created_at: '2025-01-14T11:00:00Z' },
    { id: 3, equipment_id: 1, requested_by: 'nurse1', priority: 'Normal', status: 'Pending', created_at: '2025-01-14T12:00:00Z' },
  ];

  const users: any[] = [
    { username: 'nurse1', department_id: 1 }, // ICU nurse
  ];

  const data: AppData = {
    equipment: [icu, gw],
    audit: [],
    requests,
    users,
    sessions: new Map([[1, []], [2, []]]),
    historyDays: 10,
  };

  const { candidates } = computeRebalancingCandidates(data, now);
  assert(candidates.length >= 1, 'Should produce at least one candidate');
  assertEquals(candidates[0].candidate_id, 'c1');
  assertEquals(candidates[0].type, 'infusion pump');
  assertEquals(candidates[0].to_department, 'ICU');
  assertEquals(candidates[0].from_department, 'General Ward');
});

// ──────────────────────────────────────────────────────────
// Morning Brief — basic sanity
// ──────────────────────────────────────────────────────────

Deno.test('computeBriefMetrics — returns correct snapshot counts', () => {
  const now = new Date('2025-01-15T12:00:00Z');
  const equipment: any[] = [
    { ...makeEquipment(1, 'Available'), condition: 'Usable' },
    { ...makeEquipment(2, 'In Use'), condition: 'Usable', in_use_since: '2025-01-15T06:00:00Z' },
    { ...makeEquipment(3, 'Available'), condition: 'Out of Order' },
  ];
  const data: AppData = {
    equipment,
    audit: [],
    requests: [],
    users: [],
    sessions: new Map([[1, []], [2, []], [3, []]]),
    historyDays: 10,
  };
  const metrics = computeBriefMetrics(data, now, 'Asia/Kolkata');
  assertEquals(metrics.snapshot.total, 3);
  assertEquals(metrics.snapshot.available, 2);
  assertEquals(metrics.snapshot.in_use, 1);
  assertEquals(metrics.snapshot.non_out_of_order, 2);
});

Deno.test('computeBriefMetrics — overnight items detected correctly', () => {
  const now = new Date('2025-01-15T12:00:00Z');
  // in_use_since before today IST midnight (2025-01-14T18:30:00Z) → overnight
  const equipment: any[] = [
    { ...makeEquipment(1, 'In Use'), in_use_since: '2025-01-14T15:00:00Z', held_by: 'user1' },
  ];
  const data: AppData = {
    equipment,
    audit: [],
    requests: [],
    users: [],
    sessions: new Map([[1, []]]),
    historyDays: 10,
  };
  const metrics = computeBriefMetrics(data, now, 'Asia/Kolkata');
  assertEquals(metrics.overnight.length, 1);
  assertEquals(metrics.overnight[0].name, 'Equipment 1');
  assertEquals(metrics.overnight[0].held_by, 'user1');
});
