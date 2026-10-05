/**
 * pagination.js
 * Helpers for pagination calculation and state management (P1-06, T-06).
 */

export function paginate({ totalItems, currentPage = 1, pageSize = 25 }) {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * safePageSize;
  const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + safePageSize, totalItems);
  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = endIndex;

  const hasPrevious = safeCurrentPage > 1;
  const hasNext = safeCurrentPage < totalPages;

  const displayText = totalItems === 0
    ? 'Showing 0 of 0'
    : `Showing ${displayStart}–${displayEnd} of ${totalItems}`;

  return {
    totalItems,
    pageSize: safePageSize,
    currentPage: safeCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    displayStart,
    displayEnd,
    hasPrevious,
    hasNext,
    displayText,
  };
}

export function getStoredPageSize(defaultSize = 25) {
  try {
    const val = localStorage.getItem('meditrack_pagesize');
    const parsed = parseInt(val, 10);
    if ([25, 50, 100].includes(parsed)) return parsed;
  } catch (e) {
    // ignore localStorage errors
  }
  return defaultSize;
}

export function setStoredPageSize(size) {
  try {
    localStorage.setItem('meditrack_pagesize', String(size));
  } catch (e) {
    // ignore localStorage errors
  }
}

if (typeof window !== 'undefined') {
  window.paginate = paginate;
  window.getStoredPageSize = getStoredPageSize;
  window.setStoredPageSize = setStoredPageSize;
}
