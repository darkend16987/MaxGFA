// ============================================================
// FORMATTING UTILITIES
// Vietnamese locale number formatting
// ============================================================

/**
 * Format a number with Vietnamese locale (dot as thousands separator)
 */
export function fmtNum(n, decimals = 2) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format as percentage
 */
export function fmtPct(n, decimals = 2) {
  if (n == null || isNaN(n)) return "—";
  return (n * 100).toFixed(decimals) + "%";
}

/**
 * Format area in m²
 */
export function fmtArea(n, decimals = 0) {
  if (n == null || isNaN(n)) return "—";
  return fmtNum(n, decimals) + " m²";
}

/**
 * Format a K ratio
 */
export function fmtK(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(2);
}
