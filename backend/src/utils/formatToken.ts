/**
 * Formats a token number into a display string.
 *
 * Examples:
 *   formatToken("A", 1)  → "A-01"
 *   formatToken("A", 42) → "A-42"
 *   formatToken("B", 7)  → "B-07"
 *
 * The token display is NEVER stored in the database.
 * It is always derived from the service prefix + token number.
 * This prevents inconsistency between tokenNumber and display.
 */
export function formatToken(prefix: string, tokenNumber: number): string {
  return `${prefix}-${String(tokenNumber).padStart(2, '0')}`;
}
