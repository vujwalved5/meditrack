/**
 * briefValidator.js
 * Implements validation rules for LLM insight generation (P0-07, P2-07, T-11).
 */

/**
 * Extracts numbers (integers, floats, percentages) from a string.
 */
export function extractNumbers(text) {
  if (!text || typeof text !== 'string') return [];
  // Match integer or decimal followed optionally by %
  const matches = text.match(/\b\d+(\.\d+)?%?\b/g) || [];
  return matches.map(m => {
    const isPct = m.endsWith('%');
    const num = parseFloat(m);
    return { raw: m, num, isPct };
  });
}

/**
 * Validates a morning brief summary string against structured metrics.
 * 
 * Rules:
 * 1. Max 2 sentences, max 45 words.
 * 2. Every number mentioned must exist in the structured values.
 * 3. Cannot claim contradictory facts (e.g. "39 items out of 61 in use" when in_use is 22).
 */
export function validateBriefSummary(summary, structuredFacts) {
  if (!summary || typeof summary !== 'string') return false;

  // Word count check
  const words = summary.trim().split(/\s+/).filter(Boolean);
  if (words.length > 45) return false;

  // Sentence count check (max 2 sentences)
  const sentences = summary.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length > 2) return false;

  // Known / valid numbers list from structured facts
  const validNumbers = new Set();
  const addVal = (v) => {
    if (v !== null && v !== undefined && !isNaN(Number(v))) {
      validNumbers.add(Number(v));
      validNumbers.add(String(v));
      validNumbers.add(`${v}%`);
    }
  };

  addVal(structuredFacts.total);
  addVal(structuredFacts.available);
  addVal(structuredFacts.in_use);
  addVal(structuredFacts.maintenance ?? 0);
  addVal(structuredFacts.out_of_service ?? 0);
  addVal(structuredFacts.checkouts_yesterday);
  addVal(structuredFacts.utilization_yesterday_pct);
  addVal(structuredFacts.overnight_count);
  addVal(structuredFacts.overdue_count ?? 0);
  addVal(structuredFacts.pending_requests);

  // Extract all numbers from summary
  const extracted = extractNumbers(summary);

  // Specific semantic contradiction check: "X items out of Y in use"
  // If text says "39 ... in use" when available is 39 and in_use is 22
  const inUseRegex = /(\d+)\s*(items?)?\s*(out of \d+)?\s*in use/i;
  const inUseMatch = summary.match(inUseRegex);
  if (inUseMatch) {
    const claimedInUse = parseInt(inUseMatch[1], 10);
    if (claimedInUse !== structuredFacts.in_use) {
      return false;
    }
  }

  // Check every extracted number
  for (const item of extracted) {
    const isAllowed = Array.from(validNumbers).some(val => {
      if (typeof val === 'number') {
        return Math.abs(val - item.num) < 0.01;
      }
      return val === item.raw;
    });
    if (!isAllowed) {
      return false; // Invented number!
    }
  }

  return true;
}

/**
 * Validates Forgotten Equipment items against equipment and department catalogs.
 */
export function validateForgottenItems(items, equipmentCatalog, departmentCatalog) {
  if (!Array.isArray(items)) return false;
  const validNames = new Set(equipmentCatalog.map(e => e.name.toLowerCase()));
  const validDepts = new Set(departmentCatalog.map(d => d.name.toLowerCase()));

  for (const item of items) {
    if (!item.name || !validNames.has(item.name.toLowerCase())) {
      return false;
    }
    if (item.department && !validDepts.has(item.department.toLowerCase())) {
      return false;
    }
  }
  return true;
}

/**
 * Deterministic fallback generator for Morning Brief
 */
export function getFallbackBriefSummary(structuredFacts) {
  const avail = structuredFacts.available ?? 0;
  const total = structuredFacts.total ?? 0;
  const inUse = structuredFacts.in_use ?? 0;
  const overnight = structuredFacts.overnight_count ?? 0;
  return `${avail} of ${total} items are available and ${inUse} are in use. ${overnight} items have been checked out overnight.`;
}

/**
 * Brief validator runner with single retry then fallback (P0-07)
 */
export function processBriefSummaryWithFallback(llmOutputs, structuredFacts) {
  let attempts = 0;
  for (const text of llmOutputs) {
    attempts++;
    if (validateBriefSummary(text, structuredFacts)) {
      return { summary: text, usedFallback: false, attempts };
    }
    if (attempts >= 2) break;
  }
  return {
    summary: getFallbackBriefSummary(structuredFacts),
    usedFallback: true,
    attempts,
  };
}

if (typeof window !== 'undefined') {
  window.validateBriefSummary = validateBriefSummary;
  window.validateForgottenItems = validateForgottenItems;
  window.getFallbackBriefSummary = getFallbackBriefSummary;
  window.processBriefSummaryWithFallback = processBriefSummaryWithFallback;
}
