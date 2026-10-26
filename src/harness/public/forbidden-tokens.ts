import os from 'node:os';

/**
 * Words that must not appear anywhere in published output, beyond the fixed
 * patterns in `scrub.ts`. Intended for LDAPs of people who run suites.
 *
 * Sources, merged: an explicit list (CLI flag), the
 * `PUBLIC_EVALS_FORBIDDEN_TOKENS` environment variable (comma-separated; how
 * the scheduled job supplies operator names without checking them in), and
 * the current OS user, who is very likely a suite operator. Every path that
 * builds public output must call this so `gd promote --now` and the scheduled
 * job scrub with the same list.
 */
export function forbiddenTokens(explicit: readonly string[] = []): string[] {
  const fromEnv = (process.env['PUBLIC_EVALS_FORBIDDEN_TOKENS'] ?? '').split(',');
  const user = os.userInfo().username;
  const tokens = [...explicit, ...fromEnv, user].map(token => token.trim()).filter(token => token.length >= 3);
  return [...new Set(tokens)];
}
