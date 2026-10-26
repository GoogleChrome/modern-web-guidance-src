import os from 'node:os';

/**
 * Words that must not appear anywhere in published output, beyond the fixed
 * patterns in `scrub.ts`. Intended for LDAPs of people who run suites.
 *
 * Sources, merged: an explicit list (CLI flag), the
 * `PUBLIC_EVALS_FORBIDDEN_TOKENS` environment variable (comma-separated; how
 * the scheduled job supplies operator names without checking them in), and,
 * outside CI, the current OS user. Every path that builds public output must
 * call this so `gd promote --now` and the scheduled job scrub with the same
 * list.
 *
 * `requireList` (default: on in CI) refuses to proceed without the environment
 * list, so nothing that publishes can run with only the fixed patterns.
 */
export function forbiddenTokens(
  explicit: readonly string[] = [],
  env = process.env,
  { requireList = isCi(env) } = {},
): string[] {
  const fromEnv = (env['PUBLIC_EVALS_FORBIDDEN_TOKENS'] ?? '').split(',');
  if (requireList && fromEnv.every(token => token.trim() === '')) {
    throw new Error('PUBLIC_EVALS_FORBIDDEN_TOKENS must list the suite operators (comma-separated) before building for publication');
  }

  // On a CI runner the OS user is something like `runner`, which also appears in ordinary
  // harness text ("Playwright test runner failed"), so it is not a useful token there.
  const implicit = isCi(env) ? [] : [os.userInfo().username];
  const tokens = [...explicit, ...fromEnv, ...implicit].map(token => token.trim()).filter(token => token.length >= 3);
  return [...new Set(tokens)];
}

/**
 * An integer the operator bumps (`PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION`)
 * whenever the token list changes, so suites built under the old list are
 * rescanned. Recorded in the published build state instead of the tokens.
 */
export function forbiddenTokensVersion(env = process.env): number {
  const value = Number(env['PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION'] ?? 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function isCi(env: NodeJS.ProcessEnv): boolean {
  return env['CI'] !== undefined && env['CI'] !== '' && env['CI'] !== 'false';
}
