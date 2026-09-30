// ============================================================
// metrics.ts — Deterministic fact computation for all 3 features
// ============================================================
import { AppData, Equipment, Session, busyHours } from './data.ts';
import { parseUtc, toLocalDate, toLocalHour, localDayBounds, fmt1, fmtHours } from './time.ts';
import {
  MIN_SESSIONS_FOR_TYPE_MEDIAN,
  MIN_SESSIONS_FOR_GLOBAL_MEDIAN,
  DEFAULT_THRESHOLD_HOURS,
  THRESHOLD_MEDIAN_MULTIPLIER,
  THRESHOLD_MIN_HOURS,
  CRITICAL_MEDIAN_MULTIPLIER,
  CRITICAL_HOURS_NO_MEDIAN,
  PRESSURE_MIN_DEMAND_REQUESTS,
  PRESSURE_UTILIZATION_GATE,
  PRESSURE_COMBINED_MIN_DEMAND,
  SURPLUS_MAX_UTILIZATION,
  SURPLUS_MAX_DEMAND_REQUESTS,
  SURPLUS_MIN_AVAILABLE_UNITS,
  SURPLUS_MIN_TOTAL_UNITS,
  SURPLUS_VERY_LOW_UTILIZATION,
  REBALANCING_WINDOW_HOURS,
  MAX_REBALANCING_CANDIDATES,
  MIN_HISTORY_DAYS,
  BASELINE_DAYS,
  DEFAULT_TIMEZONE,
} from './config.ts';

// ──────────────────────────────────────────────────────────
// HELPER: median of a sorted numeric array
// ──────────────────────────────────────────────────────────
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ──────────────────────────────────────────────────────────
// FEATURE 1: MORNING BRIEF
// ──────────────────────────────────────────────────────────

export interface BriefMetrics {
  date_label: string;
  snapshot: {
    total: number;
    available: number;
    in_use: number;
    non_out_of_order: number;
  };
  yesterday: {
    checkouts: number;
    distinct_items_used: number;
    total_in_use_hours: number;
    utilization_pct: number;
    by_department: Array<{ department: string; checkouts: number; utilization_pct: number }>;
    busiest_department: string | null;
    peak_checkout_hour: number | null; // local hour 0-23, null if <3 checkouts
    top_items: Array<{ name: string; department: string; checkouts: number }>;
  };
  baseline: {
    avg_checkouts_per_day: number;
    days_with_data: number;
  };
  overnight: Array<{
    name: string;
    department: string;
    held_by: string;
    held_hours: number;
  }>;
  requests: {
    pending_count: number;
    urgent_pending_count: number;
    oldest_pending_age_hours: number | null;
    submitted_yesterday: number;
    approved_yesterday: number;
    rejected_yesterday: number;
  };
  condition: {
    non_usable: Array<{ name: string; department: string; condition: string }>;
    condition_changes_yesterday: number;
  };
  data_quality: {
    history_days: number;
    is_thin: boolean;
  };
}

export function computeBriefMetrics(
  data: AppData,
  now: Date,
  tz: string = DEFAULT_TIMEZONE,
): BriefMetrics {
  const { equipment, audit, requests, sessions } = data;

  // Day boundaries
  const todayStr = toLocalDate(now, tz);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = toLocalDate(yesterdayDate, tz);
  const { start: ydStart, end: ydEnd } = localDayBounds(yesterdayStr, tz);
  const { start: todayStart } = localDayBounds(todayStr, tz);

  // ── Snapshot ──
  const nonOutOfOrder = equipment.filter(e => e.condition !== 'Out of Order');
  const snapshot = {
    total: equipment.length,
    available: equipment.filter(e => e.status === 'Available').length,
    in_use: equipment.filter(e => e.status === 'In Use').length,
    non_out_of_order: nonOutOfOrder.length,
  };

  // ── Yesterday audit entries ──
  const ydAudit = audit.filter(e => {
    const ts = parseUtc(e.timestamp);
    return ts >= ydStart && ts < ydEnd;
  });

  const ydCheckouts = ydAudit.filter(e => e.action === 'Checked Out');

  // Distinct items used yesterday
  const distinctItemsYd = new Set(ydCheckouts.map(e => e.equipment_id)).size;

  // Total in-use hours yesterday
  let totalInUseHours = 0;
  for (const [eqId, sess] of sessions.entries()) {
    totalInUseHours += busyHours(sess, ydStart, ydEnd, now);
  }

  // Hospital utilization %
  const utilizationPct = nonOutOfOrder.length > 0
    ? fmt1((totalInUseHours / (nonOutOfOrder.length * 24)) * 100)
    : 0;

  // Per-department
  const deptMap = new Map<string, { checkouts: number; deptId: number | null }>();
  for (const eq of equipment) {
    if (!deptMap.has(eq.department_name)) {
      deptMap.set(eq.department_name, { checkouts: 0, deptId: eq.department_id });
    }
  }
  for (const e of ydCheckouts) {
    const eq = equipment.find(x => x.id === e.equipment_id);
    if (eq) {
      const d = deptMap.get(eq.department_name);
      if (d) d.checkouts++;
    }
  }

  const byDepartment: BriefMetrics['yesterday']['by_department'] = [];
  for (const [deptName, { checkouts, deptId }] of deptMap.entries()) {
    // Utilization for this dept
    const deptEquip = equipment.filter(e => e.department_name === deptName && e.condition !== 'Out of Order');
    let deptBusyHours = 0;
    for (const eq of deptEquip) {
      deptBusyHours += busyHours(sessions.get(eq.id) ?? [], ydStart, ydEnd, now);
    }
    const deptUtil = deptEquip.length > 0
      ? fmt1((deptBusyHours / (deptEquip.length * 24)) * 100)
      : 0;
    byDepartment.push({ department: deptName, checkouts, utilization_pct: deptUtil });
  }

  const busiestDept = byDepartment.length > 0
    ? byDepartment.reduce((a, b) => a.checkouts >= b.checkouts ? a : b).department
    : null;

  // Peak checkout hour (local time, only if >= 3 checkouts)
  let peakHour: number | null = null;
  if (ydCheckouts.length >= 3) {
    const hourCounts = new Map<number, number>();
    for (const e of ydCheckouts) {
      const h = toLocalHour(parseUtc(e.timestamp), tz);
      hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    }
    let maxCount = 0;
    for (const [h, count] of hourCounts.entries()) {
      if (count > maxCount) { maxCount = count; peakHour = h; }
    }
  }

  // Top 3 most used items
  const itemCheckouts = new Map<number, { name: string; department: string; count: number }>();
  for (const e of ydCheckouts) {
    const eq = equipment.find(x => x.id === e.equipment_id);
    if (!eq) continue;
    const existing = itemCheckouts.get(eq.id);
    if (existing) existing.count++;
    else itemCheckouts.set(eq.id, { name: eq.name, department: eq.department_name, count: 1 });
  }
  const topItems = Array.from(itemCheckouts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(i => ({ name: i.name, department: i.department, checkouts: i.count }));

  // ── Baseline: avg checkouts/day for the 7 days before yesterday ──
  const baselineEnd = ydStart;
  const baselineStart = new Date(baselineEnd.getTime() - BASELINE_DAYS * 24 * 3600 * 1000);
  const baselineEntries = audit.filter(e => {
    const ts = parseUtc(e.timestamp);
    return e.action === 'Checked Out' && ts >= baselineStart && ts < baselineEnd;
  });
  // Count by local day
  const dayCountMap = new Map<string, number>();
  for (const e of baselineEntries) {
    const dayStr = toLocalDate(parseUtc(e.timestamp), tz);
    dayCountMap.set(dayStr, (dayCountMap.get(dayStr) ?? 0) + 1);
  }
  const daysWithData = dayCountMap.size;
  const avgCheckoutsPerDay = daysWithData > 0
    ? fmt1(baselineEntries.length / daysWithData)
    : 0;

  // ── Overnight: items In Use whose in_use_since is before today's local 00:00 ──
  const overnight: BriefMetrics['overnight'] = [];
  for (const eq of equipment) {
    if (eq.status !== 'In Use') continue;
    const sinceTs = eq.in_use_since ? parseUtc(eq.in_use_since) : null;
    if (sinceTs && !isNaN(sinceTs.getTime()) && sinceTs < todayStart) {
      overnight.push({
        name: eq.name,
        department: eq.department_name,
        held_by: eq.held_by ?? 'Unknown',
        held_hours: fmt1((now.getTime() - sinceTs.getTime()) / 3600000),
      });
    }
  }

  // ── Requests ──
  const pendingReqs = requests.filter(r => r.status === 'Pending');
  const urgentPending = pendingReqs.filter(r => r.priority === 'Urgent');
  let oldestPendingAge: number | null = null;
  if (pendingReqs.length > 0) {
    const oldest = pendingReqs.reduce((a, b) =>
      parseUtc(a.created_at) < parseUtc(b.created_at) ? a : b
    );
    oldestPendingAge = fmt1((now.getTime() - parseUtc(oldest.created_at).getTime()) / 3600000);
  }

  const ydRequestActions = ydAudit.filter(e =>
    e.action === 'Request Submitted' || e.action === 'Request Approved' || e.action === 'Request Rejected'
  );

  // ── Condition ──
  const nonUsable = equipment
    .filter(e => e.condition !== 'Usable')
    .map(e => ({ name: e.name, department: e.department_name, condition: e.condition }));
  const conditionChangesYd = ydAudit.filter(e => e.action === 'Condition Changed').length;

  const historyDays = data.historyDays;
  const isThin = historyDays < MIN_HISTORY_DAYS;

  return {
    date_label: yesterdayStr,
    snapshot,
    yesterday: {
      checkouts: ydCheckouts.length,
      distinct_items_used: distinctItemsYd,
      total_in_use_hours: fmt1(totalInUseHours),
      utilization_pct: utilizationPct,
      by_department: byDepartment,
      busiest_department: busiestDept,
      peak_checkout_hour: peakHour,
      top_items: topItems,
    },
    baseline: {
      avg_checkouts_per_day: avgCheckoutsPerDay,
      days_with_data: daysWithData,
    },
    overnight,
    requests: {
      pending_count: pendingReqs.length,
      urgent_pending_count: urgentPending.length,
      oldest_pending_age_hours: oldestPendingAge,
      submitted_yesterday: ydRequestActions.filter(e => e.action === 'Request Submitted').length,
      approved_yesterday: ydRequestActions.filter(e => e.action === 'Request Approved').length,
      rejected_yesterday: ydRequestActions.filter(e => e.action === 'Request Rejected').length,
    },
    condition: {
      non_usable: nonUsable,
      condition_changes_yesterday: conditionChangesYd,
    },
    data_quality: {
      history_days: fmt1(historyDays),
      is_thin: isThin,
    },
  };
}

// ──────────────────────────────────────────────────────────
// FEATURE 2: FORGOTTEN EQUIPMENT DETECTOR
// ──────────────────────────────────────────────────────────

export type ForgottenBasis = 'type' | 'global' | 'default';
export type ForgottenSeverity = 'warning' | 'critical';

export interface ForgottenItem {
  equipment_id: number;
  name: string;
  department: string;
  held_by: string;
  held_hours: number;
  since: string; // ISO UTC
  typical_hours: number | null;
  ratio: number | null;
  basis: ForgottenBasis;
  severity: ForgottenSeverity;
}

export function computeForgottenItems(
  data: AppData,
  now: Date,
): ForgottenItem[] {
  const { equipment, sessions } = data;

  // Compute global median from all completed, non-inferred sessions ≥ MIN_SESSION_MINUTES
  const allCompletedDurations: number[] = [];
  for (const [, sess] of sessions.entries()) {
    for (const s of sess) {
      if (!s.open && !s.inferred && s.duration_hours !== null && s.duration_hours >= 1 / 60) {
        allCompletedDurations.push(s.duration_hours);
      }
    }
  }

  const globalMedian = allCompletedDurations.length >= MIN_SESSIONS_FOR_GLOBAL_MEDIAN
    ? median(allCompletedDurations)
    : null;

  // Compute per-type medians
  const typeMedians = new Map<string, number>(); // equip_type_key -> median hours
  const typeGroups = new Map<string, number[]>();
  for (const eq of equipment) {
    if (!typeGroups.has(eq.equip_type)) typeGroups.set(eq.equip_type, []);
    const sess = sessions.get(eq.id) ?? [];
    for (const s of sess) {
      if (!s.open && !s.inferred && s.duration_hours !== null && s.duration_hours >= 1 / 60) {
        typeGroups.get(eq.equip_type)!.push(s.duration_hours);
      }
    }
  }
  for (const [type, durations] of typeGroups.entries()) {
    if (durations.length >= MIN_SESSIONS_FOR_TYPE_MEDIAN) {
      typeMedians.set(type, median(durations));
    }
  }

  const flagged: ForgottenItem[] = [];

  for (const eq of equipment) {
    if (eq.status !== 'In Use') continue;
    const openSess = (sessions.get(eq.id) ?? []).find(s => s.open);
    if (!openSess) continue;

    const heldHours = (now.getTime() - openSess.start.getTime()) / 3600000;

    // Determine median and basis
    let typMed: number | null = null;
    let basis: ForgottenBasis = 'default';

    if (typeMedians.has(eq.equip_type)) {
      typMed = typeMedians.get(eq.equip_type)!;
      basis = 'type';
    } else if (globalMedian !== null) {
      typMed = globalMedian;
      basis = 'global';
    }

    // Compute threshold
    let threshold: number;
    if (typMed !== null) {
      threshold = Math.max(THRESHOLD_MEDIAN_MULTIPLIER * typMed, THRESHOLD_MIN_HOURS);
    } else {
      threshold = DEFAULT_THRESHOLD_HOURS;
    }

    if (heldHours <= threshold) continue;

    // Severity (determined by CODE)
    let severity: ForgottenSeverity;
    if (typMed !== null) {
      severity = heldHours >= CRITICAL_MEDIAN_MULTIPLIER * typMed ? 'critical' : 'warning';
    } else {
      severity = heldHours >= CRITICAL_HOURS_NO_MEDIAN ? 'critical' : 'warning';
    }

    const ratio = typMed !== null ? fmt1(heldHours / typMed) : null;

    flagged.push({
      equipment_id: eq.id,
      name: eq.name,
      department: eq.department_name,
      held_by: openSess.held_by || eq.held_by || 'Unknown',
      held_hours: fmt1(heldHours),
      since: openSess.start.toISOString(),
      typical_hours: typMed !== null ? fmt1(typMed) : null,
      ratio,
      basis,
      severity,
    });
  }

  return flagged;
}

// ──────────────────────────────────────────────────────────
// FEATURE 3: DEPARTMENT REBALANCING
// ──────────────────────────────────────────────────────────

export interface RebalancingCandidate {
  candidate_id: string;
  type: string;
  type_display: string;
  from_department: string;
  from_department_id: number | null;
  to_department: string;
  to_department_id: number | null;
  equipment_id: number;
  equipment_name: string;
  evidence: {
    from_utilization: number;
    from_demand_requests: number;
    from_units: number;
    to_utilization: number;
    to_demand_requests: number;
    to_available_units: number;
  };
  score: number;
}

export function computeRebalancingCandidates(
  data: AppData,
  now: Date,
): { candidates: RebalancingCandidate[]; skip_reason: string | null } {
  const { equipment, sessions, requests, users } = data;

  if (data.historyDays < MIN_HISTORY_DAYS) {
    return { candidates: [], skip_reason: 'Not enough history yet to make rebalancing recommendations.' };
  }

  const winStart = new Date(now.getTime() - REBALANCING_WINDOW_HOURS * 3600 * 1000);

  // ── Build user → department_id map ──
  const userDeptMap = new Map<string, number | null>();
  for (const u of users) {
    userDeptMap.set(u.username, u.department_id);
  }

  // ── Find equipment types present in >= 2 departments ──
  const typeDeptsMap = new Map<string, Set<string>>(); // type_key -> Set<dept_name>
  for (const eq of equipment) {
    if (!typeDeptsMap.has(eq.equip_type)) typeDeptsMap.set(eq.equip_type, new Set());
    typeDeptsMap.get(eq.equip_type)!.add(eq.department_name);
  }
  const multiDeptTypes = new Set(
    Array.from(typeDeptsMap.entries())
      .filter(([, depts]) => depts.size >= 2)
      .map(([type]) => type)
  );

  if (multiDeptTypes.size === 0) {
    return { candidates: [], skip_reason: null };
  }

  // ── Requests in window, attributed to requester's department ──
  const windowRequests = requests.filter(r => parseUtc(r.created_at) >= winStart);

  // ── Compute (type, department) stats ──
  interface TypeDeptStats {
    type: string;
    type_display: string;
    dept_name: string;
    dept_id: number | null;
    units: number;          // excluding Out of Order
    busy_hours: number;
    utilization: number;    // busy_hours / (units * 168)
    checkouts: number;
    demand_requests: number;
    available_usable_units_now: number;
  }

  const statsKey = (type: string, dept: string) => `${type}|${dept}`;
  const statsMap = new Map<string, TypeDeptStats>();

  for (const eq of equipment) {
    if (!multiDeptTypes.has(eq.equip_type)) continue;
    const key = statsKey(eq.equip_type, eq.department_name);
    if (!statsMap.has(key)) {
      statsMap.set(key, {
        type: eq.equip_type,
        type_display: eq.equip_type_display,
        dept_name: eq.department_name,
        dept_id: eq.department_id,
        units: 0,
        busy_hours: 0,
        utilization: 0,
        checkouts: 0,
        demand_requests: 0,
        available_usable_units_now: 0,
      });
    }
    const stats = statsMap.get(key)!;
    if (eq.condition !== 'Out of Order') {
      stats.units++;
      stats.busy_hours += busyHours(sessions.get(eq.id) ?? [], winStart, now, now);
      if (eq.status === 'Available' && eq.condition === 'Usable') {
        stats.available_usable_units_now++;
      }
    }
  }

  // Checkouts in window
  const winAudit = data.audit.filter(e =>
    e.action === 'Checked Out' && parseUtc(e.timestamp) >= winStart
  );
  for (const e of winAudit) {
    const eq = equipment.find(x => x.id === e.equipment_id);
    if (!eq || !multiDeptTypes.has(eq.equip_type)) continue;
    const key = statsKey(eq.equip_type, eq.department_name);
    const stats = statsMap.get(key);
    if (stats) stats.checkouts++;
  }

  // Demand requests in window — attributed to requester's dept
  for (const req of windowRequests) {
    const eq = equipment.find(x => x.id === req.equipment_id);
    if (!eq || !multiDeptTypes.has(eq.equip_type)) continue;
    // Find requester's department
    const requesterDeptId = userDeptMap.get(req.requested_by) ?? null;
    let deptName = eq.department_name; // fallback to item's dept
    if (requesterDeptId !== null) {
      const deptEq = equipment.find(x => x.department_id === requesterDeptId);
      if (deptEq) deptName = deptEq.department_name;
    }
    const key = statsKey(eq.equip_type, deptName);
    const stats = statsMap.get(key);
    if (stats) stats.demand_requests++;
  }

  // Compute utilization
  for (const stats of statsMap.values()) {
    stats.utilization = stats.units > 0
      ? fmt1(stats.busy_hours / (stats.units * 168))
      : 0;
  }

  // ── Identify pressure and surplus departments per type ──
  const candidates: RebalancingCandidate[] = [];
  const usedEquipmentIds = new Set<number>();

  const groupByType = new Map<string, TypeDeptStats[]>();
  for (const stats of statsMap.values()) {
    if (!groupByType.has(stats.type)) groupByType.set(stats.type, []);
    groupByType.get(stats.type)!.push(stats);
  }

  for (const [type, deptStatsList] of groupByType.entries()) {
    const pressureDepts = deptStatsList.filter(s =>
      s.demand_requests >= PRESSURE_MIN_DEMAND_REQUESTS ||
      (s.utilization >= PRESSURE_UTILIZATION_GATE && s.demand_requests >= PRESSURE_COMBINED_MIN_DEMAND)
    );

    const surplusDepts = deptStatsList.filter(s =>
      s.utilization <= SURPLUS_MAX_UTILIZATION &&
      s.demand_requests <= SURPLUS_MAX_DEMAND_REQUESTS &&
      s.available_usable_units_now >= SURPLUS_MIN_AVAILABLE_UNITS &&
      (s.units >= SURPLUS_MIN_TOTAL_UNITS || s.utilization <= SURPLUS_VERY_LOW_UTILIZATION)
    );

    for (const pressure of pressureDepts) {
      // Find the surplus dept with the lowest utilization (different dept)
      const eligibleSurplus = surplusDepts.filter(s => s.dept_name !== pressure.dept_name);
      if (eligibleSurplus.length === 0) continue;

      const bestSurplus = eligibleSurplus.reduce((a, b) => a.utilization <= b.utilization ? a : b);

      // Find the least recently used Available+Usable unit from surplus dept
      const surplusEquip = equipment.filter(eq =>
        eq.equip_type === type &&
        eq.department_name === bestSurplus.dept_name &&
        eq.status === 'Available' &&
        eq.condition === 'Usable' &&
        !usedEquipmentIds.has(eq.id)
      );

      if (surplusEquip.length === 0) continue;

      // Least recently used = unit with the oldest/null last session end
      const lruUnit = surplusEquip.reduce((a, b) => {
        const getLastUse = (eq: Equipment): number => {
          const sess = sessions.get(eq.id) ?? [];
          const completed = sess.filter(s => !s.open && s.end !== null);
          if (completed.length === 0) return 0;
          return Math.max(...completed.map(s => s.end!.getTime()));
        };
        return getLastUse(a) <= getLastUse(b) ? a : b;
      });

      usedEquipmentIds.add(lruUnit.id);

      const score = pressure.demand_requests +
        (pressure.utilization - bestSurplus.utilization) * 5;

      candidates.push({
        candidate_id: '', // assigned after sorting
        type,
        type_display: pressure.type_display,
        from_department: bestSurplus.dept_name,
        from_department_id: bestSurplus.dept_id,
        to_department: pressure.dept_name,
        to_department_id: pressure.dept_id,
        equipment_id: lruUnit.id,
        equipment_name: lruUnit.name,
        evidence: {
          from_utilization: fmt1(bestSurplus.utilization * 100),
          from_demand_requests: bestSurplus.demand_requests,
          from_units: bestSurplus.units,
          to_utilization: fmt1(pressure.utilization * 100),
          to_demand_requests: pressure.demand_requests,
          to_available_units: bestSurplus.available_usable_units_now,
        },
        score: fmt1(score),
      });
    }
  }

  // Sort by score descending, keep top N, assign ids
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, MAX_REBALANCING_CANDIDATES);
  topCandidates.forEach((c, i) => { c.candidate_id = `c${i + 1}`; });

  if (topCandidates.length === 0) {
    return { candidates: [], skip_reason: 'No rebalancing needed this week.' };
  }

  return { candidates: topCandidates, skip_reason: null };
}
