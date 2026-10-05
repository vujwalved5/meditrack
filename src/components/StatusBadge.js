/**
 * StatusBadge component / generator
 * Generates an accessible, pill-shaped status badge with a 6px dot.
 */
export function normalizeStatusKey(raw) {
  if (!raw) return 'neutral';
  const s = String(raw).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (s === 'available' || s === 'active' || s === 'usable' || s === 'good') return s === 'active' ? 'active' : 'available';
  if (s === 'in_use' || s === 'busy') return 'in_use';
  if (s === 'maintenance' || s === 'needs_maintenance' || s === 'needs_attention' || s === 'warning' || s === 'mixed') return 'maintenance';
  if (s === 'out_of_service' || s === 'out_of_order' || s === 'critical') return 'out_of_service';
  if (s === 'overdue') return 'overdue';
  if (s === 'inactive') return 'inactive';
  return 'neutral';
}

export function getStatusConfig(statusKey) {
  const norm = normalizeStatusKey(statusKey);
  switch (norm) {
    case 'available':
      return {
        key: 'available',
        label: 'Available',
        dotVar: 'var(--st-available-dot)',
        bgVar: 'var(--st-available-bg)',
        fgVar: 'var(--st-available-fg)',
        className: 'badge-status-available',
      };
    case 'active':
      return {
        key: 'active',
        label: 'Active',
        dotVar: 'var(--st-available-dot)',
        bgVar: 'var(--st-available-bg)',
        fgVar: 'var(--st-available-fg)',
        className: 'badge-status-active',
      };
    case 'in_use':
      return {
        key: 'in_use',
        label: 'In use',
        dotVar: 'var(--st-inuse-dot)',
        bgVar: 'var(--st-inuse-bg)',
        fgVar: 'var(--st-inuse-fg)',
        className: 'badge-status-inuse',
      };
    case 'maintenance':
      return {
        key: 'maintenance',
        label: 'Maintenance',
        dotVar: 'var(--st-attention-dot)',
        bgVar: 'var(--st-attention-bg)',
        fgVar: 'var(--st-attention-fg)',
        className: 'badge-status-attention',
      };
    case 'out_of_service':
      return {
        key: 'out_of_service',
        label: 'Out of service',
        dotVar: 'var(--st-critical-dot)',
        bgVar: 'var(--st-critical-bg)',
        fgVar: 'var(--st-critical-fg)',
        className: 'badge-status-critical',
      };
    case 'overdue':
      return {
        key: 'overdue',
        label: 'Overdue',
        dotVar: 'var(--st-critical-dot)',
        bgVar: 'var(--st-critical-bg)',
        fgVar: 'var(--st-critical-fg)',
        className: 'badge-status-critical',
      };
    case 'inactive':
      return {
        key: 'inactive',
        label: 'Inactive',
        dotVar: 'var(--st-neutral-dot)',
        bgVar: 'var(--st-neutral-bg)',
        fgVar: 'var(--st-neutral-fg)',
        className: 'badge-status-neutral',
      };
    default:
      return {
        key: 'neutral',
        label: 'Neutral',
        dotVar: 'var(--st-neutral-dot)',
        bgVar: 'var(--st-neutral-bg)',
        fgVar: 'var(--st-neutral-fg)',
        className: 'badge-status-neutral',
      };
  }
}

export function renderStatusBadge(status, labelOverride = null) {
  const cfg = getStatusConfig(status);
  const text = labelOverride || cfg.label;
  return `<span class="status-badge ${cfg.className}" data-status="${cfg.key}"><span class="status-badge-dot" aria-hidden="true" style="background:${cfg.dotVar}"></span><span class="status-badge-text">${text}</span></span>`;
}

if (typeof window !== 'undefined') {
  window.normalizeStatusKey = normalizeStatusKey;
  window.getStatusConfig = getStatusConfig;
  window.renderStatusBadge = renderStatusBadge;
}
