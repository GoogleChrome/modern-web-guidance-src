import { stripVTControlCharacters } from 'node:util';

/**
 * Scrubs machine-specific paths and identity markers from strings before they
 * are published.
 *
 * Two phases:
 *  1. `scrubString` rewrites known-safe shapes (paths inside the repo checkout,
 *     home directories) so only repo-relative or home-relative paths remain.
 *  2. `findLeaks` / `assertClean` detect anything that still identifies a
 *     person or machine. The public builder fails closed on any hit.
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

/** A home directory root: `~`, `/usr/local/google/home/<x>`, `/home/<x>`, `/Users/<x>`. */
const HOME_ROOT = String.raw`(?:~|/(?:usr/local/google/home|home|Users)/${SEGMENT}+)`;

/**
 * Not preceded by a word character or `:`, so `http://host/home/settings` and
 * `/mnt/c/Users/x` are not mistaken for home directories.
 */
const NOT_INSIDE_URL = String.raw`(?<![\w:])`;

/**
 * A home root, any intermediate folders, then the repo checkout folder (which
 * may carry a suffix such as `modern-web-guidance-src-2`). Everything up to and
 * including the trailing slash is removed so only the repo-relative path remains.
 */
const REPO_PREFIX_RE = new RegExp(
  `${NOT_INSIDE_URL}${HOME_ROOT}(?:/${SEGMENT}+)*?/modern-web-guidance-src${SEGMENT}*/?`,
  'g',
);

/** A home directory outside the repo, e.g. `/usr/local/google/home/<ldap>/.npm`. Rewritten to `~`. */
const HOME_DIR_RE = new RegExp(`${NOT_INSIDE_URL}/(?:usr/local/google/home|home|Users)/${SEGMENT}+`, 'g');

/**
 * Strings that must never appear in published output. Checked after rewriting.
 *
 * `linux home path` excludes `/usr/local/google/home/...` so a Cloudtop path is
 * reported once, not twice. `home-relative non-dotfile` catches checkouts that
 * are not named `modern-web-guidance-src` (e.g. `~/mwg/src/x`): after
 * rewriting, the only legitimate home-relative paths are dot-directories such
 * as `~/.npm` or `~/.cache`.
 */
export const LEAK_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'cloudtop home path', re: new RegExp(String.raw`/usr/local/google/home/${SEGMENT}+`, 'g') },
  { name: 'linux home path', re: new RegExp(String.raw`(?<!\w)/home/${SEGMENT}+`, 'g') },
  { name: 'macos home path', re: new RegExp(String.raw`(?<![\w:])/Users/${SEGMENT}+`, 'g') },
  { name: 'windows home path', re: /[A-Za-z]:\\Users\\[^\\\s"']+/g },
  { name: 'escaped home path', re: /(?:\\\/|%2F)(?:home|Users)(?:\\\/|%2F)/gi },
  { name: 'home-relative non-dotfile', re: new RegExp(String.raw`(?<![\w:])~/(?!\.)${SEGMENT}+`, 'g') },
  { name: 'citc path', re: new RegExp(String.raw`/google/src/cloud/${SEGMENT}+`, 'g') },
  { name: 'googlers hostname', re: /[\w.-]*\bgooglers\.com\b/gi },
  { name: 'corp hostname', re: /[\w.-]*\bcorp\.google\.com\b/gi },
  { name: 'google email', re: /[\w.+-]+@google\.com\b/gi },
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
   * at build time (never checked in). Tokens shorter than 3 characters are
   * ignored to avoid matching everything.
   */
  forbiddenTokens?: readonly string[];
}

/** Thrown by `assertClean` when published output would still identify a person or machine. */
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
      leaks.push({ name, match: match[0], path });
    }
  }
  return leaks;
}

function forbiddenTokenPatterns(tokens: readonly string[]): { name: string; re: RegExp }[] {
  return tokens
    .filter(token => token.length >= 3)
    .map(token => ({
      name: 'forbidden token',
      re: new RegExp(String.raw`\b${escapeRegExp(token)}\b`, 'gi'),
    }));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
