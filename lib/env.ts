/**
 * Parses a boolean value from an environment variable string with support for common
 * shell conventions (1/0, true/false, yes/no, on/off).
 *
 * If the value is undefined or not recognized as a boolean representation, returns `defaultValue`.
 */
export function parseBooleanEnv(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
  return defaultValue;
}
