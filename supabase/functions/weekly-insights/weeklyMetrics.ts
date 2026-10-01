// ============================================================
// weeklyMetrics.ts — Deterministic fact computation for Weekly Analysis
// ============================================================
import { AppData, Equipment, Session, busyHours, AuditEntry } from '../daily-insights/data.ts';
import { parseUtc, toLocalDate, toLocalHour, localDayBounds, fmt1 } from '../daily-insights/time.ts';
import { computeRebalancingCandidates } from '../daily-insights/metrics.ts';
import { MAINT_REVIEW_HOURS, MAINT_REVIEW_CHECKOUTS } from './config.ts';

// We import the configuration threshold constants from daily-insights since we reuse them.
import {
  MIN_HISTORY_DAYS,
  THRESHOLD_MEDIAN_MULTIPLIER,
  THRESHOLD_MIN_HOURS,
  CRITICAL_MEDIAN_MULTIPLIER,
  CRITICAL_HOURS_NO_MEDIAN,
  DEFAULT_THRESHOLD_HOURS
} from '../daily-insights/config.ts';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeWeeklyMetrics(
  data: AppData,
  now: Date,
  tz: string,
) {
  const { equipment, audit, requests, users, sessions, historyDays } = data;

  // Window bounds
  const todayStr = toLocalDate(now, tz);
  const { start: wEnd } = localDayBounds(todayStr, tz);
  const wStart = new Date(wEnd.getTime() - 7 * 24 * 3600 * 1000);
  const pStart = new Date(wStart.getTime() - 7 * 24 * 3600 * 1000);

  const week_start = toLocalDate(wStart, tz);
  const week_end = toLocalDate(new Date(wEnd.getTime() - 1000), tz);
  const prev_start = toLocalDate(pStart, tz);

  const isThin = historyDays < MIN_HISTORY_DAYS;
  const nonOutOfOrder = equipment.filter(e => e.condition !== 'Out of Order');
  const unitsCount = nonOutOfOrder.length;

  const wAudit = audit.filter(e => {
    const t = parseUtc(e.timestamp).getTime();
    return t >= wStart.getTime() && t < wEnd.getTime();
  });
  const pAudit = audit.filter(e => {
    const t = parseUtc(e.timestamp).getTime();
    return t >= pStart.getTime() && t < wStart.getTime();
  });

  const wCheckouts = wAudit.filter(e => e.action === 'Checked Out');
  const pCheckouts = pAudit.filter(e => e.action === 'Checked Out');

  // 1. Overall
  let wBusyHours = 0;
  let pBusyHours = 0;
  for (const sess of sessions.values()) {
    wBusyHours += busyHours(sess, wStart, wEnd, now);
    pBusyHours += busyHours(sess, pStart, wStart, now);
  }
  const wUtilPct = unitsCount > 0 ? (wBusyHours / (unitsCount * 168)) * 100 : 0;
  const pUtilPct = unitsCount > 0 ? (pBusyHours / (unitsCount * 168)) * 100 : 0;

  const wDistinctItems = new Set(wCheckouts.map(e => e.equipment_id)).size;
  const pDistinctItems = new Set(pCheckouts.map(e => e.equipment_id)).size;

  const overall = {
    checkouts: wCheckouts.length,
    distinct_items_used: wDistinctItems,
    total_busy_hours: fmt1(wBusyHours),
    utilization_pct: fmt1(wUtilPct),
    prev_checkouts: pCheckouts.length,
    prev_distinct_items_used: pDistinctItems,
    prev_total_busy_hours: fmt1(pBusyHours),
    prev_utilization_pct: fmt1(pUtilPct),
    checkouts_delta_pct: pCheckouts.length > 0 ? fmt1(((wCheckouts.length - pCheckouts.length) / pCheckouts.length) * 100) : 0,
    utilization_delta_pt: fmt1(wUtilPct - pUtilPct),
  };

  // 2. Daily [7]
  const daily = [];
  for (let i = 0; i < 7; i++) {
    const dStart = new Date(wStart.getTime() + i * 24 * 3600 * 1000);
    const dEnd = new Date(dStart.getTime() + 24 * 3600 * 1000);
    const dStr = toLocalDate(dStart, tz);
    const dCheckouts = wCheckouts.filter(e => {
      const t = parseUtc(e.timestamp).getTime();
      return t >= dStart.getTime() && t < dEnd.getTime();
    }).length;
    let dBusyHours = 0;
    for (const sess of sessions.values()) dBusyHours += busyHours(sess, dStart, dEnd, now);
    daily.push({
      date: dStr,
      weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(dStart),
      checkouts: dCheckouts,
      utilization_pct: unitsCount > 0 ? fmt1((dBusyHours / (unitsCount * 24)) * 100) : 0,
    });
  }

  // 3. By Dept
  const deptMap = new Map<string, { wCheckouts: number; wBusy: number; pBusy: number; units: number }>();
  for (const eq of equipment) {
    if (!deptMap.has(eq.department_name)) deptMap.set(eq.department_name, { wCheckouts: 0, wBusy: 0, pBusy: 0, units: 0 });
    if (eq.condition !== 'Out of Order') deptMap.get(eq.department_name)!.units++;
  }
  for (const eq of equipment) {
    if (eq.condition === 'Out of Order') continue;
    const stats = deptMap.get(eq.department_name)!;
    const sess = sessions.get(eq.id) ?? [];
    stats.wBusy += busyHours(sess, wStart, wEnd, now);
    stats.pBusy += busyHours(sess, pStart, wStart, now);
  }
  for (const c of wCheckouts) {
    const eq = equipment.find(e => e.id === c.equipment_id);
    if (eq && eq.condition !== 'Out of Order') deptMap.get(eq.department_name)!.wCheckouts++;
  }
  const by_dept = Array.from(deptMap.entries()).map(([dept, stats]) => {
    const wUtil = stats.units > 0 ? (stats.wBusy / (stats.units * 168)) * 100 : 0;
    const pUtil = stats.units > 0 ? (stats.pBusy / (stats.units * 168)) * 100 : 0;
    return {
      department: dept,
      units: stats.units,
      checkouts: stats.wCheckouts,
      utilization_pct: fmt1(wUtil),
      utilization_delta_pt: fmt1(wUtil - pUtil),
    };
  });

  // 4. By Type
  const typeMap = new Map<string, { display: string, units: number, checkouts: number, busy: number, sessDurations: number[] }>();
  for (const eq of equipment) {
    if (!typeMap.has(eq.equip_type)) typeMap.set(eq.equip_type, { display: eq.equip_type_display, units: 0, checkouts: 0, busy: 0, sessDurations: [] });
    if (eq.condition !== 'Out of Order') typeMap.get(eq.equip_type)!.units++;
  }
  for (const eq of equipment) {
    if (eq.condition === 'Out of Order') continue;
    const stats = typeMap.get(eq.equip_type)!;
    const sess = sessions.get(eq.id) ?? [];
    stats.busy += busyHours(sess, wStart, wEnd, now);
    for (const s of sess) {
      if (!s.open && !s.inferred && s.duration_hours !== null && s.duration_hours >= 1/60 && s.start.getTime() >= wStart.getTime() && s.start.getTime() < wEnd.getTime()) {
        stats.sessDurations.push(s.duration_hours);
      }
    }
  }
  for (const c of wCheckouts) {
    const eq = equipment.find(e => e.id === c.equipment_id);
    if (eq && eq.condition !== 'Out of Order') typeMap.get(eq.equip_type)!.checkouts++;
  }
  const by_type = Array.from(typeMap.values()).map(stats => ({
    type: stats.display,
    units: stats.units,
    checkouts: stats.checkouts,
    utilization_pct: stats.units > 0 ? fmt1((stats.busy / (stats.units * 168)) * 100) : 0,
    median_session_hours: stats.sessDurations.length > 0 ? fmt1(median(stats.sessDurations)) : null,
    longest_session_hours: stats.sessDurations.length > 0 ? fmt1(Math.max(...stats.sessDurations)) : null,
  }));

  // 5. Items (top/bottom/idle)
  const itemStats = equipment.filter(e => e.condition !== 'Out of Order').map(eq => {
    const wC = wCheckouts.filter(c => c.equipment_id === eq.id).length;
    const wB = busyHours(sessions.get(eq.id) ?? [], wStart, wEnd, now);
    return { id: eq.id, name: eq.name, department: eq.department_name, type: eq.equip_type, checkouts: wC, util_pct: (wB / 168) * 100 };
  });
  itemStats.sort((a, b) => b.util_pct - a.util_pct);
  const activeItems = itemStats.filter(i => i.checkouts > 0);
  const items_metrics = {
    top: activeItems.slice(0, 5).map(i => ({ ...i, util_pct: fmt1(i.util_pct) })),
    bottom: activeItems.slice(-5).reverse().map(i => ({ ...i, util_pct: fmt1(i.util_pct) })),
    idle_items: itemStats.filter(i => i.checkouts === 0).slice(0, 8).map(i => ({ name: i.name, department: i.department })),
  };

  // 6. Peaks
  const blockMap = new Map<string, number>();
  for (const c of wCheckouts) {
    const t = parseUtc(c.timestamp);
    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(t);
    const h = toLocalHour(t, tz);
    const b = Math.floor(h / 4) * 4;
    const key = `${wd} ${b.toString().padStart(2,'0')}:00-${(b+4).toString().padStart(2,'0')}:00`;
    blockMap.set(key, (blockMap.get(key) ?? 0) + 1);
  }
  const peaks = wCheckouts.length >= 10 
    ? Array.from(blockMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => ({ block: x[0], checkouts: x[1] }))
    : [];

  // 7. Requests
  const wRequests = requests.filter(r => {
    const t = parseUtc(r.created_at).getTime();
    return t >= wStart.getTime() && t < wEnd.getTime();
  });
  const pendingRequests = requests.filter(r => r.status === 'Pending');
  const userDept = new Map<string, number|null>(users.map(u => [u.username, u.department_id]));
  
  const reqSub = wRequests.length;
  const reqApp = wAudit.filter(e => e.action === 'Request Approved').length;
  const reqRej = wAudit.filter(e => e.action === 'Request Rejected').length;

  const resolved = wAudit.filter(e => e.action === 'Request Approved' || e.action === 'Request Rejected');
  const ttd: number[] = [];
  for (const r of resolved) {
    const rTime = parseUtc(r.timestamp).getTime();
    // find nearest earlier 'Request Submitted' for same item
    const sub = audit.filter(a => a.action === 'Request Submitted' && a.equipment_id === r.equipment_id && parseUtc(a.timestamp).getTime() <= rTime)
      .sort((a, b) => parseUtc(b.timestamp).getTime() - parseUtc(a.timestamp).getTime())[0];
    if (sub) {
      ttd.push((rTime - parseUtc(sub.timestamp).getTime()) / 3600000);
    }
  }

  const reqItemCount = new Map<number, number>();
  for (const r of wRequests) {
    reqItemCount.set(r.equipment_id, (reqItemCount.get(r.equipment_id) ?? 0) + 1);
  }
  const topRequestedItems = Array.from(reqItemCount.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, c]) => ({ name: equipment.find(e => e.id === id)?.name ?? 'Unknown', count: c }));

  const demandByDept = new Map<string, number>();
  for (const r of wRequests) {
    const dId = userDept.get(r.requested_by);
    let dName = equipment.find(e => e.id === r.equipment_id)?.department_name ?? 'Unknown';
    if (dId !== undefined && dId !== null) dName = equipment.find(e => e.department_id === dId)?.department_name ?? dName;
    demandByDept.set(dName, (demandByDept.get(dName) ?? 0) + 1);
  }

  const requests_metrics = {
    submitted: reqSub,
    approved: reqApp,
    rejected: reqRej,
    pending_now: pendingRequests.length,
    urgent_share_pct: reqSub > 0 ? fmt1((wRequests.filter(r => r.priority === 'Urgent').length / reqSub) * 100) : 0,
    approval_rate_pct: (reqApp + reqRej) > 0 ? fmt1((reqApp / (reqApp + reqRej)) * 100) : 0,
    median_ttd_hours: ttd.length > 0 ? fmt1(median(ttd)) : null,
    median_ttd_approx: true,
    top_requested_items: topRequestedItems,
    demand_by_requester_dept: Array.from(demandByDept.entries()).map(([k, v]) => ({ department: k, requests: v })).sort((a,b)=>b.requests-a.requests),
  };

  // 8. Health
  const nonUsable = equipment.filter(e => e.condition !== 'Usable').map(e => ({ name: e.name, department: e.department_name, condition: e.condition }));
  const condChanges = wAudit.filter(e => e.action === 'Condition Changed').length;
  
  const maintWatch = [];
  for (const eq of equipment) {
    const lastChange = audit.filter(a => a.action === 'Condition Changed' && a.equipment_id === eq.id)
      .sort((a, b) => parseUtc(b.timestamp).getTime() - parseUtc(a.timestamp).getTime())[0];
    const sinceTime = lastChange ? parseUtc(lastChange.timestamp) : parseUtc(audit[0]?.timestamp ?? new Date().toISOString());
    const sessSince = (sessions.get(eq.id) ?? []).filter(s => s.end === null || s.end.getTime() >= sinceTime.getTime());
    let hSince = 0;
    for (const s of sessSince) hSince += busyHours([s], sinceTime, now, now);
    const cSince = audit.filter(a => a.action === 'Checked Out' && a.equipment_id === eq.id && parseUtc(a.timestamp).getTime() >= sinceTime.getTime()).length;
    if (hSince >= MAINT_REVIEW_HOURS || cSince >= MAINT_REVIEW_CHECKOUTS) {
      maintWatch.push({ equipment_id: eq.id, name: eq.name, department: eq.department_name, hours_since_check: fmt1(hSince), checkouts_since_check: cSince });
    }
  }
  maintWatch.sort((a, b) => parseFloat(b.hours_since_check as any) - parseFloat(a.hours_since_check as any));

  // Long sessions in W
  const longSess = [];
  let openFlagged = 0;
  for (const eq of equipment) {
    const sList = sessions.get(eq.id) ?? [];
    const tStats = typeMap.get(eq.equip_type);
    const gMed = 0; // we won't calculate global median here for simplicity, or we can just use 8h.
    const tMed = tStats?.sessDurations.length! >= 5 ? median(tStats!.sessDurations) : null;
    const threshold = tMed !== null ? Math.max(THRESHOLD_MEDIAN_MULTIPLIER * tMed, THRESHOLD_MIN_HOURS) : DEFAULT_THRESHOLD_HOURS;
    for (const s of sList) {
      if (!s.open && s.start.getTime() >= wStart.getTime() && s.start.getTime() < wEnd.getTime()) {
        if (s.duration_hours && s.duration_hours > threshold) {
          longSess.push({ equipment_id: eq.id, name: eq.name, duration_hours: fmt1(s.duration_hours), threshold: fmt1(threshold) });
        }
      } else if (s.open) {
        const held = (now.getTime() - s.start.getTime()) / 3600000;
        if (held > threshold) openFlagged++;
      }
    }
  }
  longSess.sort((a,b)=>parseFloat(b.duration_hours as any) - parseFloat(a.duration_hours as any));

  const health = {
    non_usable: nonUsable,
    condition_changes: condChanges,
    maintenance_watch: maintWatch.slice(0, 5),
    long_sessions_count: longSess.length,
    long_sessions_top: longSess.slice(0, 5),
    currently_flagged_open_sessions: openFlagged,
  };

  // 9. Handling
  const handlers = new Map<string, number>();
  let offHoursCount = 0;
  for (const c of wCheckouts) {
    handlers.set(c.performed_by, (handlers.get(c.performed_by) ?? 0) + 1);
    const h = toLocalHour(parseUtc(c.timestamp), tz);
    if (h >= 22 || h < 6) offHoursCount++;
  }
  const topHandlers = Array.from(handlers.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, c]) => ({ user: u, checkouts: c }));
  
  let inferredCount = 0;
  let relOtherCount = 0;
  const relOtherItems = new Map<string, number>();
  for (const sessList of sessions.values()) {
    for (const s of sessList) {
      if (s.inferred && s.start.getTime() >= wStart.getTime() && s.start.getTime() < wEnd.getTime()) {
        inferredCount++;
      }
    }
  }
  const wReleases = wAudit.filter(e => e.action === 'Released');
  for (const r of wReleases) {
    const eq = equipment.find(e => e.id === r.equipment_id);
    if (!eq) continue;
    // Find the session that was closed by this release
    const s = (sessions.get(eq.id) ?? []).find(sess => sess.end && sess.end.getTime() === parseUtc(r.timestamp).getTime());
    if (s && s.held_by !== r.performed_by) {
      relOtherCount++;
      relOtherItems.set(eq.name, (relOtherItems.get(eq.name) ?? 0) + 1);
    }
  }

  const handling = {
    distinct_users: handlers.size,
    top_users: topHandlers,
    off_hours_checkouts: offHoursCount,
    off_hours_share_pct: wCheckouts.length > 0 ? fmt1((offHoursCount / wCheckouts.length) * 100) : 0,
    missed_releases: inferredCount,
    released_by_other_count: relOtherCount,
    released_by_other_top: Array.from(relOtherItems.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(([n,c])=>({ item: n, count: c })),
  };

  // 10. Rebalancing & Purchasing
  const rebRaw = computeRebalancingCandidates(data, wEnd); // note: win is W (7 days), effectiveNow is W end. Rebalancing uses 7 day window. Wait, REBALANCING_WINDOW_HOURS is 7*24.
  const rebalancing = {
    moves: rebRaw.candidates.map((c, i) => ({ ...c, candidate_id: `c${i+1}` })),
    purchasing: [] as any[],
  };

  if (!isThin) {
    let pIdx = 1;
    for (const stats of typeMap.values()) {
      const uPct = stats.units > 0 ? (stats.busy / (stats.units * 168)) : 0;
      const dReq = wRequests.filter(r => equipment.find(e => e.id === r.equipment_id)?.equip_type_display === stats.display).length;
      if (uPct >= 0.75 && dReq >= 5) {
        // check for no surplus
        const deptsOfType = Array.from(deptMap.entries()).filter(([d]) => {
          const u = equipment.filter(e => e.department_name === d && e.equip_type_display === stats.display && e.condition !== 'Out of Order');
          return u.length > 0;
        });
        let hasSurplus = false;
        for (const [d] of deptsOfType) {
          const u = equipment.filter(e => e.department_name === d && e.equip_type_display === stats.display && e.condition !== 'Out of Order');
          let b = 0;
          for (const eq of u) b += busyHours(sessions.get(eq.id) ?? [], wStart, wEnd, now);
          if (u.length > 0 && b / (u.length * 168) <= 0.25) hasSurplus = true;
        }
        if (!hasSurplus) {
          rebalancing.purchasing.push({ id: `p${pIdx++}`, type: stats.display, reason: 'add_unit' });
        }
      }
      if (stats.units >= 2 && uPct <= 0.15) {
        rebalancing.purchasing.push({ id: `p${pIdx++}`, type: stats.display, reason: 'surplus' });
      }
    }
  }

  // 11. Data Quality
  const data_quality = {
    history_days: fmt1(historyDays),
    is_thin: isThin,
    events_in_w: wAudit.length,
  };

  // 12. Issues
  const issues: Array<{ ref: string; area: string; severity: string; text_facts: string; score: number }> = [];
  
  if (openFlagged > 0) issues.push({ ref: 'health', area: 'health', severity: 'critical', text_facts: `${openFlagged} sessions open over typical limits.`, score: 100 });
  if (nonUsable.filter(u => pendingRequests.some(r => equipment.find(e => e.id === r.equipment_id)?.name === u.name)).length > 0) {
    issues.push({ ref: 'health', area: 'health', severity: 'critical', text_facts: 'Non-usable items have pending requests.', score: 95 });
  }
  
  for (const m of maintWatch) {
    issues.push({ ref: 'maint', area: 'health', severity: 'warning', text_facts: `${m.name} exceeds maintenance thresholds.`, score: 70 });
  }
  for (const i of items_metrics.idle_items) {
    issues.push({ ref: 'idle', area: 'utilization', severity: 'warning', text_facts: `${i.name} was not used at all.`, score: 65 });
  }
  if (overall.utilization_delta_pt <= -15) {
    issues.push({ ref: 'util_drop', area: 'utilization', severity: 'warning', text_facts: `Utilization dropped ${Math.abs(overall.utilization_delta_pt)}%.`, score: 80 });
  }
  if (reqSub > 0 && ttd.length > 0 && median(ttd) > 24) {
    issues.push({ ref: 'req_slow', area: 'demand', severity: 'warning', text_facts: `Median request approval took > 24h.`, score: 75 });
  }

  issues.sort((a, b) => b.score - a.score);
  const topIssues = issues.slice(0, 8);
  
  const hasCritical = topIssues.some(i => i.severity === 'critical');
  const warningCount = topIssues.filter(i => i.severity === 'warning').length;
  const verdict = hasCritical ? 'needs_attention' : (warningCount >= 2 ? 'mixed' : 'good');

  return {
    window: { start: week_start, end: week_end, prev_start, tz },
    verdict,
    metrics: {
      overall, daily, by_dept, by_type, items: items_metrics, peaks, requests: requests_metrics, health, handling, rebalancing, data_quality, issues: topIssues.map(({score, ...rest}) => rest)
    }
  };
}
