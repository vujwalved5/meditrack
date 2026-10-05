/**
 * equipmentStats.js
 * Single source of truth for equipment counts, stale checkouts, forgotten logic, and product type grouping.
 * Covers P2-01, P2-02, P2-03, P2-04, T-09, T-10, T-16.
 */

export const STALE_CHECKOUT_HOURS = 24;

/**
 * Computes reconciled inventory counts for KPI cards and filter summaries.
 * 
 * Invariants:
 * Total = Available + In use + Maintenance + Out of service
 * Needs attention = Maintenance + Out of service (+ Overdue flag)
 */
export function computeEquipmentCounts(equipmentList = []) {
  let available = 0;
  let inUse = 0;
  let maintenance = 0;
  let outOfService = 0;
  let overdue = 0;

  for (const eq of equipmentList) {
    const cond = eq.condition || 'Usable';
    const isMaintenance = cond === 'Needs Maintenance';
    const isOutOfService = cond === 'Out of Order';

    if (isOutOfService) {
      outOfService++;
    } else if (isMaintenance) {
      maintenance++;
    } else {
      // Usable items bucket by status
      if (eq.status === 'In Use') {
        inUse++;
      } else {
        available++;
      }
    }

    if (eq.is_overdue || eq.overdue) {
      overdue++;
    }
  }

  const needsAttention = maintenance + outOfService;

  return {
    total: equipmentList.length,
    available,
    in_use: inUse,
    maintenance,
    out_of_service: outOfService,
    needs_attention: needsAttention,
    overdue,
  };
}

/**
 * Checks if a checkout is stale (> 24 hours).
 */
export function isStaleCheckout(heldHours) {
  if (typeof heldHours !== 'number' || isNaN(heldHours)) return false;
  return heldHours > STALE_CHECKOUT_HOURS;
}

/**
 * Determines if an item is forgotten based on single-sourced threshold.
 * isForgotten(item) = heldHours > max(24, 3 * typicalHours)
 */
export function isForgottenItem(heldHours, typicalHours = null) {
  if (typeof heldHours !== 'number' || isNaN(heldHours) || heldHours <= 0) return false;
  const typ = typeof typicalHours === 'number' && !isNaN(typicalHours) && typicalHours > 0
    ? typicalHours
    : 8; // fallback default typical hold time in hours
  const threshold = Math.max(24, typ * 3);
  return heldHours > threshold;
}

/**
 * Derives normalized base product type name from an equipment name.
 * e.g. "Ventilator A" -> "Ventilator", "Infusion Pump 2" -> "Infusion Pump", "wheel chair" -> "Wheelchair"
 */
export function getProductTypeName(eq) {
  if (!eq) return 'Equipment';
  if (eq.product_types && eq.product_types.name) {
    return eq.product_types.name;
  }
  const rawName = String(eq.name || '').trim();
  // Strip trailing letter suffix (e.g. " A", " B") or number suffix (e.g. " 1", " 2")
  let base = rawName.replace(/\s+([A-Za-z0-9])$/, '').trim();
  if (base.toLowerCase() === 'wheel chair' || base.toLowerCase() === 'wheelchair') {
    return 'Wheelchair';
  }
  return base || rawName;
}

/**
 * Groups equipment into product type tiles, matching list counts exactly.
 */
export function groupEquipmentByProductType(equipmentList = [], existingTypes = []) {
  const typeMap = new Map();

  // Populate known types first to preserve order and images
  for (const pt of existingTypes) {
    const key = pt.name.toLowerCase();
    typeMap.set(key, {
      id: pt.id,
      name: pt.name,
      image_url: pt.image_url || null,
      totalCount: 0,
      availCount: 0,
      items: [],
    });
  }

  // Group all equipment
  for (const eq of equipmentList) {
    const typeName = getProductTypeName(eq);
    const key = typeName.toLowerCase();

    if (!typeMap.has(key)) {
      typeMap.set(key, {
        id: eq.product_type_id || `_type_${key}`,
        name: typeName,
        image_url: null,
        totalCount: 0,
        availCount: 0,
        items: [],
      });
    }

    const group = typeMap.get(key);
    group.totalCount++;
    const isAvail = eq.status === 'Available' && (!eq.condition || eq.condition === 'Usable');
    if (isAvail) {
      group.availCount++;
    }
    group.items.push(eq);
  }

  return Array.from(typeMap.values());
}

if (typeof window !== 'undefined') {
  window.computeEquipmentCounts = computeEquipmentCounts;
  window.isStaleCheckout = isStaleCheckout;
  window.isForgottenItem = isForgottenItem;
  window.getProductTypeName = getProductTypeName;
  window.groupEquipmentByProductType = groupEquipmentByProductType;
  window.STALE_CHECKOUT_HOURS = STALE_CHECKOUT_HOURS;
}
