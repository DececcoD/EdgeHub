/**
 * Display-only rounding/formatting. Never feed these outputs back into a
 * calculation - always chain from the unrounded values in odds.ts/ev.ts/etc.
 */

export function formatAmerican(american: number): string {
  const rounded = Math.round(american);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function formatDecimalOdds(decimal: number): string {
  return decimal.toFixed(2);
}

export function formatProbability(p: number, decimals = 2): string {
  return `${(p * 100).toFixed(decimals)}%`;
}

export function formatPercentagePoints(pp: number, decimals = 2): string {
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toFixed(decimals)} pp`;
}

export function formatSignedPercent(pct: number, decimals = 2): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatSignedCurrency(amount: number, currency = "USD"): string {
  const formatted = formatCurrency(Math.abs(amount), currency);
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}
