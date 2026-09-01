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

/**
 * Format raw string prices or price ranges safely for cards and detail views
 */
export function formatPriceString(raw: string | null | undefined): string {
  if (!raw) return 'Contact for Quote';
  const clean = String(raw).trim();
  if (
    !clean ||
    clean.toLowerCase().includes('quote') ||
    clean.toLowerCase().includes('n/a') ||
    clean.toLowerCase() === 'na' ||
    clean === '$0' ||
    clean === '$0.00' ||
    clean === '0' ||
    clean === '$$' ||
    clean === '$$$'
  ) {
    return 'Contact for Quote';
  }

  const numbers = clean.match(/\d[\d,.]*/g);
  if (numbers && numbers.length >= 2) {
    const n1 = Number(numbers[0].replace(/,/g, ''));
    const n2 = Number(numbers[1].replace(/,/g, ''));
    if (!isNaN(n1) && !isNaN(n2) && n1 > 0 && n2 > 0) {
      const low = Math.min(n1, n2);
      const high = Math.max(n1, n2);
      if (low === high) return `$${low.toLocaleString()}`;
      return `$${low.toLocaleString()} – $${high.toLocaleString()}`;
    }
  } else if (numbers && numbers.length === 1) {
    const n = Number(numbers[0].replace(/,/g, ''));
    if (!isNaN(n) && n > 0) {
      if (clean.toLowerCase().includes('/hr') || clean.toLowerCase().includes('hr') || clean.toLowerCase().includes('hour')) {
        return `$${n.toLocaleString()} / hr`;
      }
      return `$${n.toLocaleString()}`;
    }
  }

  return 'Contact for Quote';
}

/**
 * Calculate Stripe Processing Fee (2.9% + $0.30) in exact integer cents
 * Uses the authoritative Stripe gross-up formula:
 * Gross = Math.round((baseInCents + 30) / (1 - 0.029))
 */
export function calculateStripeProcessingFeeCents(baseInCents: number | null | undefined): number {
  if (baseInCents == null || isNaN(Number(baseInCents)) || Number(baseInCents) <= 0) return 0;
  const base = Math.round(Number(baseInCents));
  const grossInCents = Math.round((base + 30) / (1 - 0.029));
  return grossInCents - base;
}

/**
 * Calculate Gross Amount to Charge in exact integer cents
 */
export function calculateGrossChargeAmountCents(baseInCents: number | null | undefined): number {
  if (baseInCents == null || isNaN(Number(baseInCents)) || Number(baseInCents) <= 0) return 0;
  const base = Math.round(Number(baseInCents));
  return Math.round((base + 30) / (1 - 0.029));
}
