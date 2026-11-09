import os from 'node:os';
import { isTokenShaped, MIN_TOKEN_LENGTH } from './scrub.ts';

/**
 * Words that must not appear anywhere in published output, beyond the fixed
 * patterns in `scrub.ts`. Intended for LDAPs of people who run suites.
 *
 * Sources, merged: an explicit list (CLI flag), the
 * `PUBLIC_EVALS_FORBIDDEN_TOKENS` environment variable (comma-separated, so
 * operator names are supplied at run time and never checked in), and, outside
 * CI, the current OS user. Every path that builds public output must call
 * this so each publisher scrubs with the same list. Kept as its own module
 * because both CLIs (`build.ts`, `publish-cli.ts`) import it and each runs its
 * `main()` on import, so neither can host it.
 *
 * `requireList` (default: on in CI) refuses to proceed without the environment
 * list, so nothing that publishes can run with only the fixed patterns.
 * Tokens shorter than 3 characters, or not made of word characters, `.` and
 * `-`, are refused rather than dropped: a short one would match everywhere,
 * and silently ignoring it would leave the operator believing they were covered.
 */
export interface ForbiddenTokenOptions {
  /** Refuse to proceed without `PUBLIC_EVALS_FORBIDDEN_TOKENS`. Defaults to whether `CI` is set. */
  requireList?: boolean;
  /** Stands in for the current OS user (tests). */
  osUser?: string;
}

export function forbiddenTokens(explicit: readonly string[] = [], env = process.env, options: ForbiddenTokenOptions = {}): string[] {
  const requireList = options.requireList ?? isCi(env);
  const fromEnv = (env['PUBLIC_EVALS_FORBIDDEN_TOKENS'] ?? '').split(',');
  if (requireList && fromEnv.every(token => token.trim() === '')) {
    throw new Error('PUBLIC_EVALS_FORBIDDEN_TOKENS must list the suite operators (comma-separated) before building for publication');
  }

  // On a CI runner the OS user is something like `runner`, which also appears in ordinary
  // harness text ("Playwright test runner failed"), so it is not a useful token there.
  const implicit = isCi(env) ? [] : [options.osUser ?? os.userInfo().username];
  const tokens = [...new Set([...explicit, ...fromEnv, ...implicit].map(token => token.trim()).filter(token => token !== ''))];
  const malformed = tokens.filter(token => !isTokenShaped(token));
  if (malformed.length > 0) {
    throw new Error(`Forbidden tokens must be at least ${MIN_TOKEN_LENGTH} characters of letters, digits, '.', '-' or '_': ${malformed.join(', ')}`);
  }
  return tokens;
}

/**
 * Version counter (`PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION`) stamped into build
 * state so bumping it forces already-built suites to be rescanned against an
 * updated token list without recording the tokens themselves. Unset or blank
 * means `0`; anything other than decimal digits is refused.
 */
export function forbiddenTokensVersion(env = process.env): number {
  const raw = (env['PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION'] ?? '').trim();
  if (raw === '') {
    return 0;
  }
  const parsed = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed)) {
    throw new Error(`PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION must be a non-negative integer, got ${JSON.stringify(raw)}`);
  }
  return parsed;
}

function isCi(env: NodeJS.ProcessEnv): boolean {
  return env['CI'] !== undefined && env['CI'] !== '' && env['CI'] !== 'false';
}
