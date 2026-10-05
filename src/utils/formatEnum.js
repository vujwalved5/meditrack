/**
 * formatEnum(value) helper
 * Converts a machine string to human text.
 * Rule: replace _ and - with a space, lowercase everything, then uppercase only the first character.
 * If empty/null/undefined -> '—'
 * If single word -> Capitalize first letter (e.g. 'available' -> 'Available')
 * If already Fine multi-word phrase -> keep as-is.
 */
export function formatEnum(value) {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value).trim();
  if (!s) return '—';

  if (s.includes('_') || s.includes('-')) {
    const replaced = s.replace(/[_-]+/g, ' ').toLowerCase();
    return replaced.charAt(0).toUpperCase() + replaced.slice(1);
  }

  // If single word, capitalize first letter
  if (!s.includes(' ')) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Already fine multi-word text
  return s;
}

if (typeof window !== 'undefined') {
  window.formatEnum = formatEnum;
}
