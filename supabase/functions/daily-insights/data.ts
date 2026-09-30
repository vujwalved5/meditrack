// ============================================================
// data.ts — Paginated data loading and session building
// ============================================================
import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { parseUtc } from './time.ts';
import { AUDIT_HISTORY_DAYS, REQUEST_HISTORY_DAYS, MIN_SESSION_MINUTES } from './config.ts';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export interface Equipment {
  id: number;
  name: string;
  qr_code_id: string;
  department_id: number | null;
  department_name: string;
  status: string; // 'Available' | 'In Use'
  condition: string; // 'Usable' | 'Needs Maintenance' | 'Out of Order'
  held_by: string | null;
  in_use_since: string | null; // raw string from DB
  product_type_id: number | null;
  // Derived
  equip_type: string;       // lowercase, for grouping
  equip_type_display: string; // display casing
}

export interface AuditEntry {
  id: number;
  equipment_id: number;
  action: string;
  performed_by: string;
  timestamp: string; // raw string from DB
}

export interface Request {
  id: number;
  equipment_id: number;
  requested_by: string;
  priority: string;
  status: string;
  created_at: string; // raw string from DB
}

export interface User {
  username: string;
  department_id: number | null;
}

export interface Session {
  equipment_id: number;
  start: Date;
  end: Date | null;   // null = still open
  duration_hours: number | null; // null for open sessions
  held_by: string;
  inferred: boolean;  // true if closed by a subsequent checkout
  open: boolean;      // true if end is null
}

export interface AppData {
  equipment: Equipment[];
  audit: AuditEntry[];
  requests: Request[];
  users: User[];
  sessions: Map<number, Session[]>; // keyed by equipment_id
  historyDays: number; // actual days of audit data available
}

// Valid audit_log action strings (ignore legacy / other rows)
const VALID_ACTIONS = new Set([
  'Checked Out',
  'Released',
  'Request Submitted',
  'Request Approved',
  'Request Rejected',
  'Condition Changed',
]);

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Derive equipment type: strip a trailing single letter/number token */
function deriveType(name: string): { key: string; display: string } {
  const stripped = name.replace(/\s+[A-Za-z0-9]$/, '').trim();
  return {
    key: stripped.toLowerCase(),
    display: stripped,
  };
}

/**
 * Generic paginated fetch using PostgREST .range().
 * Returns all rows regardless of count.
 */
async function fetchAllRows<T>(
  builder: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  let from = 0;
  const result: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await builder(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    result.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return result;
}

// ──────────────────────────────────────────────────────────
// Session building
// ──────────────────────────────────────────────────────────

/**
 * Build usage sessions for a single piece of equipment from audit entries.
 * Entries must be sorted by timestamp ASC.
 */
function buildSessions(
  eq: Equipment,
  entries: AuditEntry[],
  now: Date,
): Session[] {
  const sessions: Session[] = [];
  let openStart: Date | null = null;
  let openBy = '';

  for (const entry of entries) {
    const ts = parseUtc(entry.timestamp);
    if (isNaN(ts.getTime())) continue;

    if (entry.action === 'Checked Out') {
      if (openStart !== null) {
        // Missed release: close the previous session at this checkout time, mark inferred
        const dur = (ts.getTime() - openStart.getTime()) / 3600000;
        if (dur >= MIN_SESSION_MINUTES / 60) {
          sessions.push({
            equipment_id: eq.id,
            start: openStart,
            end: ts,
            duration_hours: dur,
            held_by: openBy,
            inferred: true,
            open: false,
          });
        }
      }
      openStart = ts;
      openBy = entry.performed_by;
    } else if (entry.action === 'Released') {
      if (openStart !== null) {
        const dur = (ts.getTime() - openStart.getTime()) / 3600000;
        if (dur >= MIN_SESSION_MINUTES / 60) {
          sessions.push({
            equipment_id: eq.id,
            start: openStart,
            end: ts,
            duration_hours: dur,
            held_by: openBy,
            inferred: false,
            open: false,
          });
        }
        openStart = null;
        openBy = '';
      }
      // Released with no open session → ignore
    }
  }

  // After walking all events: handle open session
  if (openStart !== null) {
    if (eq.status === 'In Use') {
      // Use in_use_since if available (more accurate than audit start)
      const inUseSince = eq.in_use_since ? parseUtc(eq.in_use_since) : openStart;
      const start = !isNaN(inUseSince.getTime()) ? inUseSince : openStart;
      sessions.push({
        equipment_id: eq.id,
        start,
        end: null,
        duration_hours: null,
        held_by: eq.held_by ?? openBy,
        inferred: false,
        open: true,
      });
    }
    // If equipment is 'Available', this is a stale open → discard
  }

  return sessions;
}

// ──────────────────────────────────────────────────────────
// Main loader
// ──────────────────────────────────────────────────────────

export async function loadAppData(
  db: SupabaseClient,
  now: Date,
): Promise<AppData> {
  const auditCutoff = new Date(now.getTime() - AUDIT_HISTORY_DAYS * 24 * 3600 * 1000).toISOString();
  const requestCutoff = new Date(now.getTime() - REQUEST_HISTORY_DAYS * 24 * 3600 * 1000).toISOString();

  // ── Equipment (with department name) ──
  const rawEquipment = await fetchAllRows<{
    id: number; name: string; qr_code_id: string; department_id: number | null;
    status: string; condition: string; held_by: string | null; in_use_since: string | null;
    product_type_id: number | null; departments: { name: string } | null;
  }>((from, to) =>
    db.from('equipment')
      .select('id, name, qr_code_id, department_id, status, condition, held_by, in_use_since, product_type_id, departments(name)')
      .range(from, to) as any
  );

  const equipment: Equipment[] = rawEquipment.map(r => {
    const { key, display } = deriveType(r.name);
    return {
      id: r.id,
      name: r.name,
      qr_code_id: r.qr_code_id,
      department_id: r.department_id,
      department_name: r.departments?.name ?? 'Unknown',
      status: r.status,
      condition: r.condition,
      held_by: r.held_by,
      in_use_since: r.in_use_since,
      product_type_id: r.product_type_id,
      equip_type: key,
      equip_type_display: display,
    };
  });

  // ── Audit log (90 days, valid actions, ASC order for session building) ──
  const rawAudit = await fetchAllRows<AuditEntry>((from, to) =>
    db.from('audit_log')
      .select('id, equipment_id, action, performed_by, timestamp')
      .in('action', Array.from(VALID_ACTIONS))
      .gte('timestamp', auditCutoff)
      .order('timestamp', { ascending: true })
      .range(from, to) as any
  );

  // ── Requests (30 days) ──
  const requests = await fetchAllRows<Request>((from, to) =>
    db.from('requests')
      .select('id, equipment_id, requested_by, priority, status, created_at')
      .gte('created_at', requestCutoff)
      .range(from, to) as any
  );

  // ── Users (username + department_id only — NEVER select password_hash) ──
  const users = await fetchAllRows<User>((from, to) =>
    db.from('users')
      .select('username, department_id')
      .range(from, to) as any
  );

  // ── Build sessions per equipment ──
  // Group audit entries by equipment_id
  const auditByEq = new Map<number, AuditEntry[]>();
  for (const entry of rawAudit) {
    if (!auditByEq.has(entry.equipment_id)) auditByEq.set(entry.equipment_id, []);
    auditByEq.get(entry.equipment_id)!.push(entry);
  }

  const sessions = new Map<number, Session[]>();
  for (const eq of equipment) {
    const entries = auditByEq.get(eq.id) ?? [];
    sessions.set(eq.id, buildSessions(eq, entries, now));
  }

  // ── Calculate actual history range ──
  let historyDays = 0;
  if (rawAudit.length > 0) {
    const oldest = parseUtc(rawAudit[0].timestamp);
    historyDays = (now.getTime() - oldest.getTime()) / (24 * 3600 * 1000);
  }

  return { equipment, audit: rawAudit, requests, users, sessions, historyDays };
}

// ──────────────────────────────────────────────────────────
// busyHours helper
// ──────────────────────────────────────────────────────────

/**
 * Sum of session time overlapping [winStart, winEnd].
 * Open sessions end at `now`.
 */
export function busyHours(
  sessions: Session[],
  winStart: Date,
  winEnd: Date,
  now: Date,
): number {
  let total = 0;
  for (const s of sessions) {
    const start = s.start;
    const end = s.end ?? now;
    const clippedStart = start > winStart ? start : winStart;
    const clippedEnd = end < winEnd ? end : winEnd;
    if (clippedEnd > clippedStart) {
      total += (clippedEnd.getTime() - clippedStart.getTime()) / 3600000;
    }
  }
  return total;
}
