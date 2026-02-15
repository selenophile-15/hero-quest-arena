/**
 * Format a number with comma separators (e.g. 123456 → "123,456")
 * Returns '-' for null/undefined values.
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('en-US');
}
