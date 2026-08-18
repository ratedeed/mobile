/**
 * Universal Money Utilities for Ratedeed Mobile
 * Adheres to the Martin Fowler Money Pattern and Stripe currency standard.
 */

/**
 * Format a DOLLAR amount to standard USD string: e.g. 50 -> "$50.00", -25 -> "-$25.00"
 */
export function formatCurrency(
  dollars: number | null | undefined,
  options: { hideZeroCents?: boolean } = {}
): string {
  if (dollars == null || isNaN(Number(dollars))) return '$0.00';
  const val = Number(dollars);
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  
  let formatted = absVal.toLocaleString('en-US', {
    minimumFractionDigits: options.hideZeroCents && absVal % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format raw CENTS directly: e.g. 5000 -> "$50.00"
 */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null || isNaN(Number(cents))) return '$0.00';
  return formatCurrency(Number(cents) / 100);
}

/**
 * Convert cents to dollars safely
 */
export function centsToDollars(cents: number | null | undefined): number {
  if (cents == null || isNaN(Number(cents))) return 0;
  return Math.round(Number(cents)) / 100;
}

/**
 * Convert dollars to integer cents safely (for sending to backend / Stripe)
 */
export function dollarsToCents(dollars: number | null | undefined): number {
  if (dollars == null || isNaN(Number(dollars))) return 0;
  return Math.round(Number(dollars) * 100);
}
