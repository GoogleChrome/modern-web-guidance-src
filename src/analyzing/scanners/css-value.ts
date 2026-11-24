/**
 * Normalizes a CSS declaration value by stripping trailing `!important`,
 * trimming surrounding whitespace, and lowercasing.
 */
export function normalizeCssDeclValue(raw: string | null | undefined): string {
  return raw?.replace(/\s*!important\s*$/i, '').trim().toLowerCase() ?? '';
}
