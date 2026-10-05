/**
 * sorting.js
 * Table sorting functions for Equipment Table (P1-04, T-07) and Audit Log (P1-12, T-15).
 */

/**
 * Sorts equipment rows by column.
 */
export function sortEquipmentRows(rows, sortCol, sortDir = 'asc') {
  if (!sortCol) return [...rows];
  const mult = sortDir === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    let valA = '';
    let valB = '';

    switch (sortCol) {
      case 'name':
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
        return valA.localeCompare(valB) * mult;

      case 'department':
        valA = ((a.departments && a.departments.name) || a.department_name || '').toLowerCase();
        valB = ((b.departments && b.departments.name) || b.department_name || '').toLowerCase();
        return valA.localeCompare(valB) * mult;

      case 'status':
        valA = (a.status || '').toLowerCase();
        valB = (b.status || '').toLowerCase();
        return valA.localeCompare(valB) * mult;

      case 'held_for': {
        const timeA = a.in_use_since ? new Date(a.in_use_since).getTime() : 0;
        const timeB = b.in_use_since ? new Date(b.in_use_since).getTime() : 0;
        // Longer held time means earlier in_use_since
        const durationA = timeA > 0 ? Date.now() - timeA : 0;
        const durationB = timeB > 0 ? Date.now() - timeB : 0;
        return (durationA - durationB) * mult;
      }

      default:
        return 0;
    }
  });
}

/**
 * Audit log sorting comparator:
 * Default sort: Last activity, newest first; never-used items LAST (P1-12, T-15).
 */
export function sortAuditLogEntries(entries, sortCol = 'last_activity', sortDir = 'desc') {
  return [...entries].sort((a, b) => {
    const usesA = a.uses || (a.entries ? a.entries.length : 0);
    const usesB = b.uses || (b.entries ? b.entries.length : 0);
    const hasActivityA = usesA > 0 && a.last_activity;
    const hasActivityB = usesB > 0 && b.last_activity;

    // Never-used items always sink to the bottom in default view
    if (sortCol === 'last_activity') {
      if (!hasActivityA && hasActivityB) return 1;
      if (hasActivityA && !hasActivityB) return -1;
      if (!hasActivityA && !hasActivityB) return (a.name || '').localeCompare(b.name || '');

      const timeA = new Date(a.last_activity).getTime();
      const timeB = new Date(b.last_activity).getTime();
      const mult = sortDir === 'asc' ? 1 : -1;
      return (timeA - timeB) * mult;
    }

    const mult = sortDir === 'asc' ? 1 : -1;
    switch (sortCol) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '') * mult;

      case 'department':
        return (a.department || '').localeCompare(b.department || '') * mult;

      case 'uses':
        return (usesA - usesB) * mult;

      default:
        return 0;
    }
  });
}

if (typeof window !== 'undefined') {
  window.sortEquipmentRows = sortEquipmentRows;
  window.sortAuditLogEntries = sortAuditLogEntries;
}
