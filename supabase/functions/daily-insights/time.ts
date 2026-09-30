// ============================================================
// time.ts — Timezone and day-boundary helpers
// ============================================================
import { DEFAULT_TIMEZONE } from './config.ts';

/**
 * Parse a timestamp string that may or may not include a timezone offset.
 * PostgREST returns TIMESTAMP WITHOUT TIME ZONE columns without a "Z",
 * so "2025-01-15T14:30:00" must be treated as UTC.
 * This helper appends "Z" when no offset is present.
 */
export function parseUtc(s: string | null | undefined): Date {
  if (!s) return new Date(NaN);
  // If there's already a timezone offset (+HH, -HH, Z), parse as-is
  if (/[Zz]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    return new Date(s);
  }
  // No offset → treat as UTC
  return new Date(s + 'Z');
}

/**
 * Get the start and end of a local calendar day as UTC Date objects.
 * @param localDate - ISO date string "YYYY-MM-DD" in the hospital's timezone, or
 *                    a Date representing any moment inside the desired day
 * @param tz - IANA timezone (default: Asia/Kolkata)
 */
export function localDayBounds(
  localDate: string | Date,
  tz: string = DEFAULT_TIMEZONE,
): { start: Date; end: Date } {
  // Determine the "YYYY-MM-DD" string in the target timezone
  let dateStr: string;
  if (typeof localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    dateStr = localDate;
  } else {
    const d = typeof localDate === 'string' ? new Date(localDate) : localDate;
    dateStr = toLocalDate(d, tz);
  }

  // Build start-of-day in local time by parsing as midnight in tz
  const start = localMidnight(dateStr, tz);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Convert a UTC Date to a "YYYY-MM-DD" local date string in the given timezone.
 */
export function toLocalDate(utcDate: Date, tz: string = DEFAULT_TIMEZONE): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(utcDate);
}

/**
 * Convert a UTC Date to local hour (0-23) in the given timezone.
 */
export function toLocalHour(utcDate: Date, tz: string = DEFAULT_TIMEZONE): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(utcDate);
  const h = parts.find(p => p.type === 'hour');
  const val = parseInt(h?.value ?? '0', 10);
  // Some locales return 24 for midnight
  return val === 24 ? 0 : val;
}

/**
 * Return local midnight (00:00:00) for a "YYYY-MM-DD" string in the given timezone,
 * as a UTC Date.
 */
function localMidnight(dateStr: string, tz: string): Date {
  // Use Intl to find the UTC offset at midnight of that local day.
  // We iterate: start with a naive guess and refine.
  // Approach: parse "YYYY-MM-DDTHH:mm:ss" in the tz using the offset lookup trick.
  const [year, month, day] = dateStr.split('-').map(Number);

  // Guess: try midnight UTC as a starting point
  let guess = Date.UTC(year, month - 1, day, 0, 0, 0);

  // Find the local date for that guess and adjust until it matches
  for (let i = 0; i < 3; i++) {
    const d = new Date(guess);
    const localStr = toLocalDate(d, tz);
    const [ly, lm, ld] = localStr.split('-').map(Number);
    if (ly === year && lm === month && ld === day) {
      // Refine by finding the earliest moment in this local day
      // Back off to the previous day's midnight UTC as a safe starting point
      const backoff = Date.UTC(year, month - 1, day - 1, 0, 0, 0);
      // Binary search is overkill; simple scan in 1h steps from -27 to +14 offset range
      break;
    }
    // Shift guess by the day difference
    const dayDiff = (year * 365 + month * 30 + day) - (ly * 365 + lm * 30 + ld);
    guess += dayDiff * 24 * 60 * 60 * 1000;
  }

  // Now find exact midnight: scan from guess-27h to guess+27h in 1-minute steps
  // Efficient approach: find offset using formatToParts on the guessed midnight
  const approxMidnight = new Date(guess);
  const gmtOffset = getOffsetMinutes(approxMidnight, tz);
  // UTC midnight for this day = local midnight - offset
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0) - gmtOffset * 60 * 1000;

  // Verify (handles DST transitions where midnight might be weird)
  const verifyDate = new Date(utcMidnight);
  const verifyStr = toLocalDate(verifyDate, tz);
  if (verifyStr !== dateStr) {
    // DST edge case: try +1 hour
    const adjusted = new Date(utcMidnight + 60 * 60 * 1000);
    const adjStr = toLocalDate(adjusted, tz);
    if (adjStr === dateStr) {
      return new Date(utcMidnight + 60 * 60 * 1000);
    }
  }
  return new Date(utcMidnight);
}

/**
 * Get the UTC offset in minutes for a given date in a timezone.
 * A positive value means "local time is ahead of UTC".
 */
function getOffsetMinutes(date: Date, tz: string): number {
  // Format the date in the timezone and compare with UTC
  const localParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => {
    const p = localParts.find(x => x.type === type);
    return parseInt(p?.value ?? '0', 10);
  };

  const year = get('year'), month = get('month') - 1, day = get('day');
  const hour = get('hour') === 24 ? 0 : get('hour');
  const minute = get('minute'), second = get('second');

  const localMs = Date.UTC(year, month, day, hour, minute, second);
  return Math.round((localMs - date.getTime()) / 60000);
}

/**
 * Format a duration in hours as "Xh Ym".
 */
export function fmtHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format a number to 1 decimal place.
 */
export function fmt1(n: number): number {
  return Math.round(n * 10) / 10;
}
