import { stripVTControlCharacters } from 'node:util';
import { PUBLIC_SECRET_PATTERNS } from '../lib/secret-guard.ts';

/**
 * Scrubs machine-specific paths and identity markers from strings before they
 * are published.
 *
 * Two phases:
 *  1. `scrubString` rewrites known-safe shapes (paths inside the repo checkout,
 *     home directories) so only repo-relative or home-relative paths remain.
 *  2. `findLeaks` / `assertClean` detect anything that still identifies a
 *     person or machine. Callers fail closed on any hit.
 *
 * Rewrites are deliberately narrow. Anything the rewrite phase cannot prove
 * safe is left alone so the detection phase reports it.
 */

/**
 * Characters that end a path segment. Includes `\` so an escaped quote after a
 * path (`"~/x\"`) is not swallowed into the segment. (`\x60` is a backtick,
 * which cannot be written literally inside a template string.)
 */
const SEGMENT = String.raw`[^/\s"'\x60\\]`;

/**
 * Rewrite guard: not preceded by a word character, `:` or `.`, so
 * `http://host/home/settings`, `/mnt/c/Users/x` and `./home/Home` are not
 * rewritten as home directories. Detection uses the narrower `NOT_IN_WORD`
 * below: a `:` before a path (`PATH=/opt/bin:/home/x/bin`, `scp host:/home/x`)
 * is no reason to trust it.
 */
const NOT_INSIDE_URL = String.raw`(?<![\w:.])`;
const NOT_IN_WORD = String.raw`(?<![\w.])`;

/**
 * What the rewrite treats as a home directory: `/usr/local/google/home/<x>/...`,
 * `/home/<x>/...`, `/Users/<x>/...` with something inside it. The user segment
 * is included in the match; the segment after it is only required (lookahead),
 * so a route such as `/home/about` is not rewritten.
 */
const HOME_DIR = String.raw`/(?:usr/local/google/home|home|Users)/${SEGMENT}+(?=/${SEGMENT})`;

/** A home directory root: `~` or a `HOME_DIR`. */
const HOME_ROOT = String.raw`(?:~|${HOME_DIR})`;

/**
 * Folder names operators clone this repository into. Add to this list rather
 * than renaming a checkout: a checkout named anything else is not stripped,
 * and its home-relative remainder then fails the leak check (fail closed).
 */
export const REPO_CHECKOUT_NAMES: readonly string[] = ['modern-web-guidance-src', 'guidance'];

/**
 * A home root, any intermediate folders, then one of the repo checkout folder
 * names (which may carry a worktree suffix such as `modern-web-guidance-src-2`,
 * without swallowing punctuation like a closing `)`). Everything up to and
 * including the trailing slash is removed so only the repo-relative path remains.
 */
const REPO_PREFIX_RE = new RegExp(
  `${NOT_INSIDE_URL}${HOME_ROOT}(?:/${SEGMENT}+)*?/(?:${REPO_CHECKOUT_NAMES.map(escapeRegExp).join('|')})(?:-[\\w.-]+)?/?`,
  'g',
);

/** A home directory outside the repo, e.g. `/usr/local/google/home/<ldap>/.npm`. Rewritten to `~`. */
const HOME_DIR_RE = new RegExp(`${NOT_INSIDE_URL}${HOME_DIR}`, 'g');

/**
 * Detection is wider than the rewrite: a bare home directory with nothing
 * after the user (`HOME=/home/<x>`, `"cwd":"/Users/<x>"`) is a leak even
 * though the rewrite, which only trusts shapes it can prove, leaves it alone.
 * Cloudtop homes are flagged wherever they appear; `/home` and `/Users` only
 * when they start a path (so `./home/Home` and `host/Users/profile` pass, but
 * an app route like `/home/about` fails closed). The user segment is captured
 * so `harvestUserSegments` can turn it into a forbidden token.
 */
const CLOUDTOP_HOME_RE = new RegExp(String.raw`/usr/local/google/home/(${SEGMENT}+)`, 'g');
const POSIX_HOME_RE = new RegExp(String.raw`${NOT_IN_WORD}/(?:home|Users)/(${SEGMENT}+)`, 'g');
/** Drive letter or WSL mount, then `\`, `/`, or JSON-escaped `\\`; also inside `file:///C:/Users/...`. */
const WINDOWS_HOME_RE = /(?:[A-Za-z]:|\/mnt\/[a-z])(?:\\+|\/)users(?:\\+|\/)([^\\/\s"']+)/gi;
/** `\\home\\<x>` and `\\Users\\<x>` without a drive, as UNC paths and escaped JSON write them. */
const BACKSLASH_HOME_RE = /(?<![\w.])\\+(?:home|users)\\+([^\\/\s"']+)/gi;
const CITC_PATH_RE = new RegExp(String.raw`/google/(?:src/cloud|cog/cloud)/(${SEGMENT}+)`, 'g');

/** Patterns whose first capture group is a username. */
const USER_SEGMENT_PATTERNS: readonly RegExp[] = [CLOUDTOP_HOME_RE, POSIX_HOME_RE, WINDOWS_HOME_RE, BACKSLASH_HOME_RE, CITC_PATH_RE];

/**
 * Container, CI, and system account names that also appear in ordinary harness
 * or web-app text (`node scripts/build.js`, `Playwright test runner`). Paths
 * under `/home/runner/...` or `/home/node/...` are still rewritten or flagged
 * as paths, but the account name itself is not a person's username.
 */
const GENERIC_USERS = new Set([
  'admin', 'agent', 'app', 'builder', 'chrome', 'chromium', 'codespace',
  'containeradministrator', 'debian', 'default', 'dev', 'devcontainer',
  'docker', 'guest', 'local', 'node', 'playwright', 'public', 'root',
  'runner', 'runneradmin', 'sandbox', 'shared', 'test', 'tester', 'ubuntu',
  'user', 'users', 'worker',
]);

/**
 * Strings that must never appear in published output. Checked after rewriting.
 *
 * `home-relative non-dotfile` catches checkouts whose folder is not in
 * `REPO_CHECKOUT_NAMES` (e.g. `~/mwg/src/x`) and rewrites of non-home paths
 * that happened to look like one (`/Users/42/profile` → `~/profile`): after
 * rewriting, the only legitimate home-relative paths are dot-directories such
 * as `~/.npm` or `~/.cache`.
 *
 * `private key` requires a base64 body line after the PEM header (raw,
 * JSON-escaped, or `+`-prefixed in a diff) so PEM export/import code that
 * mentions `'-----BEGIN PRIVATE KEY-----'` as a string or regex is not
 * mistaken for an actual key.
 *
 * Hostname and email patterns anchor on the literal domain and only then look
 * back for the local part. Scanning forward from every word character instead
 * (`[\w.-]*googlers\.com`) costs ~6x more on large page snapshots.
 */
export const LEAK_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'home path', re: CLOUDTOP_HOME_RE },
  { name: 'home path', re: POSIX_HOME_RE },
  { name: 'windows home path', re: WINDOWS_HOME_RE },
  { name: 'windows home path', re: BACKSLASH_HOME_RE },
  { name: 'escaped home path', re: /(?:\\\/|%2F)(?:home|Users)(?:\\\/|%2F)/gi },
  // `[^~/]` and `/~/g` are regex syntax (JSON Pointer escaping in agent code), not paths.
  { name: 'home-relative non-dotfile', re: new RegExp(String.raw`(?<![\w:^/])~/(?!\.)${SEGMENT}+`, 'g') },
  { name: 'citc path', re: CITC_PATH_RE },
  { name: 'googlers hostname', re: /\bgooglers\.com\b/gi },
  { name: 'corp hostname', re: /\bcorp\.google\.com\b/gi },
  { name: 'google email', re: /(?<=[\w.+-])@google\.com\b/gi },
  ...PUBLIC_SECRET_PATTERNS,
];

export interface Leak {
  /** Which pattern matched: an entry in `LEAK_PATTERNS`, or `forbidden token`. */
  name: string;
  /** The offending substring. */
  match: string;
  /** Where in the input it was found, e.g. `$.results[3].error`. */
  path: string;
}

export interface LeakOptions {
  /**
   * Exact words that must not appear anywhere, matched case-insensitively on
   * word boundaries. Intended for LDAPs of people who ran the suites, supplied
   * at build time (never checked in). Use `forbiddenTokens()` to assemble the
   * list; it rejects tokens too short to be meaningful.
   */
  forbiddenTokens?: readonly string[];
}

/**
 * Thrown by `assertClean` when output would still identify a person or machine.
 * `message` quotes the offending substring for local diagnostics, so callers
 * running in public logs or writing public state must record `leaks[].name` or
 * a skip code rather than `message`.
 */
export class LeakError extends Error {
  readonly leaks: Leak[];

  constructor(leaks: Leak[], context: string) {
    const shown = leaks
      .slice(0, 10)
      .map(leak => `  ${leak.path}: ${leak.name} "${leak.match}"`)
      .join('\n');
    const more = leaks.length > 10 ? `\n  ...and ${leaks.length - 10} more` : '';
    super(`${context}: ${leaks.length} leak(s) found\n${shown}${more}`);
    this.name = 'LeakError';
    this.leaks = leaks;
  }
}

/** Rewrites paths so nothing machine-specific remains, and strips ANSI escapes. Idempotent. */
export function scrubString(input: string): string {
  return stripVTControlCharacters(input)
    .replace(REPO_PREFIX_RE, '')
    .replace(HOME_DIR_RE, '~');
}

/**
 * The usernames named by home, CitC, and Windows profile paths in `text`, for
 * use as forbidden tokens: a path the rewrite turns into `~/...` still tells us
 * whose machine this was, and that name must not survive bare elsewhere in the
 * same input. Segments too short, oddly shaped, or naming a generic container
 * account (`runner`, `node`, `ubuntu`) are left out.
 */
export function harvestUserSegments(text: string): string[] {
  const users = new Set<string>();
  harvestInto(text, users);
  return [...users];
}

/** `harvestUserSegments` across every string and object key in a JSON-compatible value. */
export function harvestUserSegmentsIn(value: unknown): string[] {
  const users = new Set<string>();
  harvestValueInto(value, users);
  return [...users];
}

/** Whether `token` can serve as a forbidden token: at least three characters, word characters at both ends. */
export function isTokenShaped(token: string): boolean {
  return token.length >= MIN_TOKEN_LENGTH && TOKEN_SHAPE_RE.test(token);
}

export const MIN_TOKEN_LENGTH = 3;
const TOKEN_SHAPE_RE = /^\w[\w.-]*\w$/;

/** Applies `scrubString` to every string in a JSON-compatible value. Returns a new value. */
export function scrubValue<T>(value: T): T {
  return scrubUnknown(value) as T;
}

/** Returns every leak in a JSON-compatible value, including object keys. Empty when safe to publish. */
export function findLeaks(value: unknown, options: LeakOptions = {}): Leak[] {
  const patterns = [...LEAK_PATTERNS, ...forbiddenTokenPatterns(options.forbiddenTokens ?? [])];
  return findLeaksIn(value, '$', patterns);
}

/** Throws `LeakError` listing every hit if `value` still contains identifying strings. */
export function assertClean(value: unknown, context: string, options: LeakOptions = {}): void {
  const leaks = findLeaks(value, options);
  if (leaks.length > 0) {
    throw new LeakError(leaks, context);
  }
}

function harvestInto(text: string, users: Set<string>): void {
  for (const re of USER_SEGMENT_PATTERNS) {
    for (const match of text.matchAll(re)) {
      const candidate = match[1];
      if (isTokenShaped(candidate) && !GENERIC_USERS.has(candidate.toLowerCase())) {
        users.add(candidate);
      }
    }
  }
}

function harvestValueInto(value: unknown, users: Set<string>): void {
  if (typeof value === 'string') {
    harvestInto(value, users);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      harvestValueInto(child, users);
    }
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      harvestInto(key, users);
      harvestValueInto(child, users);
    }
  }
}

function scrubUnknown(value: unknown): unknown {
  if (typeof value === 'string') {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map(scrubUnknown);
  }
  if (value !== null && typeof value === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      scrubbed[scrubString(key)] = scrubUnknown(child);
    }
    return scrubbed;
  }
  return value;
}

function findLeaksIn(value: unknown, path: string, patterns: readonly { name: string; re: RegExp }[]): Leak[] {
  if (typeof value === 'string') {
    return findLeaksInString(value, path, patterns);
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, i) => findLeaksIn(child, `${path}[${i}]`, patterns));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [
      ...findLeaksInString(key, `${path}.${key}`, patterns),
      ...findLeaksIn(child, `${path}.${key}`, patterns),
    ]);
  }
  return [];
}

function findLeaksInString(text: string, path: string, patterns: readonly { name: string; re: RegExp }[]): Leak[] {
  const leaks: Leak[] = [];
  for (const { name, re } of patterns) {
    for (const match of text.matchAll(re)) {
      leaks.push({ name, match: widenToToken(text, match.index, match[0]), path });
    }
  }
  return leaks;
}

/** Extends a domain match backwards over the local part (`user@`, `host.`) so reports show the whole identifier. */
function widenToToken(text: string, start: number, matched: string): string {
  let from = start;
  while (from > 0 && /[\w.+-]/.test(text[from - 1])) {
    from--;
  }
  return text.slice(from, start) + matched;
}

function forbiddenTokenPatterns(tokens: readonly string[]): { name: string; re: RegExp }[] {
  return tokens.map(token => ({
    name: 'forbidden token',
    re: new RegExp(String.raw`\b${escapeRegExp(token)}\b`, 'gi'),
  }));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
