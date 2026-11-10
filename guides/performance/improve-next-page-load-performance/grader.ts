import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

interface SpeculationRuleSet {
  urls?: unknown[];
  where?: Record<string, unknown>;
  eagerness?: string;
  source?: unknown;
  tag?: string;
}

interface SpeculationRulesDocument {
  prefetch?: SpeculationRuleSet[];
  prerender?: SpeculationRuleSet[];
  prerender_until_script?: SpeculationRuleSet[];
  tag?: string;
  [key: string]: unknown;
}

// Helper to get speculation rules from <script type="speculationrules">
function getSpeculationRules(html: string): SpeculationRulesDocument | 'INVALID_JSON' | null {
  const match = html.match(/<script\b[^>]*\btype\s*=\s*["']speculationrules["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as SpeculationRulesDocument;
  } catch {
    return 'INVALID_JSON';
  }
}

const STATE_CHANGING_TOKEN_REGEX = /\b(logout|signout|sign-out|add-to-cart|delete-confirm|wipe-data|drop-tables)\b/i;

/**
 * Checks whether a `where` predicate object positively targets a state-changing URL/selector
 * (i.e. at an even negation depth, outside `{ "not": ... }` and outside `:not(...)`).
 */
function hasPositiveStateChangingMatch(node: unknown, negated = false): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    return node.some((child) => hasPositiveStateChangingMatch(child, negated));
  }

  const record = node as Record<string, unknown>;

  if ('not' in record) {
    if (hasPositiveStateChangingMatch(record.not, !negated)) return true;
  }
  if ('and' in record && Array.isArray(record.and)) {
    if (record.and.some((child) => hasPositiveStateChangingMatch(child, negated))) return true;
  }
  if ('or' in record && Array.isArray(record.or)) {
    if (record.or.some((child) => hasPositiveStateChangingMatch(child, negated))) return true;
  }

  if (!negated) {
    const hrefMatches = record.href_matches;
    const hrefList = Array.isArray(hrefMatches) ? hrefMatches : hrefMatches !== undefined ? [hrefMatches] : [];
    for (const pattern of hrefList) {
      if (typeof pattern === 'string' && STATE_CHANGING_TOKEN_REGEX.test(pattern)) {
        return true;
      }
    }

    const selectorMatches = record.selector_matches;
    const selectorList = Array.isArray(selectorMatches)
      ? selectorMatches
      : selectorMatches !== undefined
        ? [selectorMatches]
        : [];
    for (const selector of selectorList) {
      if (typeof selector === 'string') {
        // Strip :not(...) clauses before checking if the selector positively targets a state-changing link
        const withoutNot = selector.replace(/:not\([^)]*\)/gi, '');
        if (STATE_CHANGING_TOKEN_REGEX.test(withoutNot)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Evaluates whether a `where` condition matches a given anchor element or URL pathname (e.g. "/logout").
 */
function whereMatchesLink(node: unknown, pathname: string, anchorEl?: Element | null, insideNot = false): boolean {
  if (!node || typeof node !== 'object') return false;
  const record = node as Record<string, unknown>;

  if ('and' in record && Array.isArray(record.and)) {
    return record.and.every((child) => whereMatchesLink(child, pathname, anchorEl, insideNot));
  }
  if ('or' in record && Array.isArray(record.or)) {
    return record.or.some((child) => whereMatchesLink(child, pathname, anchorEl, insideNot));
  }
  if ('not' in record) {
    return !whereMatchesLink(record.not, pathname, anchorEl, !insideNot);
  }
  if ('href_matches' in record) {
    const raw = record.href_matches;
    const patterns = Array.isArray(raw) ? raw : [raw];
    return patterns.some((p) => {
      if (typeof p !== 'string') return false;
      const regexSource =
        '^' +
        p
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*') +
        '$';
      return new RegExp(regexSource).test(pathname);
    });
  }
  if ('selector_matches' in record) {
    const raw = record.selector_matches;
    const selectors = Array.isArray(raw) ? raw : [raw];
    return selectors.some((s) => {
      if (typeof s !== 'string' || !s.trim()) return false;
      if (anchorEl && typeof anchorEl.matches === 'function') {
        try {
          return anchorEl.matches(s);
        } catch {
          // linkedom can't evaluate this selector; only then assume an exclusion covers the link
          return insideNot;
        }
      }
      return false;
    });
  }
  return false;
}

test.describe(`Improve next page load performance Expectations: ${demoName}`, () => {
  // 1. Check for <script type="speculationrules">
  test('The rule is included in a <script type="speculationrules"> tag', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(getSpeculationRules(html)).not.toBeNull();
  });

  // 2. Check if the rule is valid JSON
  test('The rule is valid JSON', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    expect(rules).not.toBeNull();
    expect(rules).not.toBe('INVALID_JSON');
  });

  // 3. Check for valid top-level keys
  test('The rule contains valid top-level keys (prefetch, prerender, prerender_until_script, tag)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const keys = Object.keys(rules);
      const validKeys = ['prefetch', 'prerender', 'prerender_until_script', 'tag'];
      expect(keys.some((key) => validKeys.includes(key))).toBe(true);
      expect(keys.every((key) => validKeys.includes(key))).toBe(true);
    } else {
      throw new Error('Rules not found or invalid');
    }
  });

  // 4. Check for urls or where property
  test('The rule contains either urls or where property in each rule set', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const ruleSets = [
        ...(rules.prefetch || []),
        ...(rules.prerender || []),
        ...(rules.prerender_until_script || []),
      ];
      expect(ruleSets.length).toBeGreaterThan(0);
      const validWhereKeys = ['href_matches', 'selector_matches', 'not', 'and', 'or'];
      for (const set of ruleSets) {
        expect(set.urls || set.where).toBeDefined();
        if (set.where) {
          expect(typeof set.where).toBe('object');
          const whereKeys = Object.keys(set.where);
          expect(whereKeys.length).toBeGreaterThan(0);
          expect(whereKeys.every((k) => validWhereKeys.includes(k))).toBe(true);
        }
      }
    } else {
      throw new Error('Rules not found or invalid');
    }
  });

  // 5. Check that source property is not present
  test('The source property should not be present in the rule', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const ruleSets = [
        ...(rules.prefetch || []),
        ...(rules.prerender || []),
        ...(rules.prerender_until_script || []),
      ];
      expect(ruleSets.length).toBeGreaterThan(0);
      for (const set of ruleSets) {
        expect(set.source).toBeUndefined();
      }
    } else {
      throw new Error('Rules not found or invalid');
    }
  });

  // 6. Check that urls is an array of strings
  test('The urls property is an array of URL strings', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const ruleSets = [
        ...(rules.prefetch || []),
        ...(rules.prerender || []),
        ...(rules.prerender_until_script || []),
      ];
      expect(ruleSets.length).toBeGreaterThan(0);
      for (const set of ruleSets) {
        if (set.urls) {
          expect(Array.isArray(set.urls)).toBe(true);
          expect(set.urls.every((u: unknown) => typeof u === 'string')).toBe(true);
        }
      }
    } else {
      throw new Error('Rules not found or invalid');
    }
  });

  // 7. Check immediate eagerness limit
  test('If using immediate eagerness, match a maximum of 10 urls', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const ruleSets = [
        ...(rules.prefetch || []),
        ...(rules.prerender || []),
        ...(rules.prerender_until_script || []),
      ];
      expect(ruleSets.length).toBeGreaterThan(0);
      for (const set of ruleSets) {
        if (set.eagerness === 'immediate' && set.urls) {
          expect(set.urls.length).toBeLessThanOrEqual(10);
        }
      }
    } else {
      throw new Error('Rules not found or invalid');
    }
  });

  // 8. Check for state-changing URLs
  test('Do not speculate URLs that likely trigger state changes (e.g., /logout)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const ruleSets = [
        ...(rules.prefetch || []),
        ...(rules.prerender || []),
        ...(rules.prerender_until_script || []),
      ];
      expect(ruleSets.length).toBeGreaterThan(0);
      const { document } = parseHTML(html);
      const logoutLinks = Array.from(document.querySelectorAll('a')).filter((a: any) =>
        /\/logout\b/i.test(a.getAttribute('href') || '')
      ) as unknown as Element[];

      for (const set of ruleSets) {
        if (Array.isArray(set.urls)) {
          expect(
            set.urls.some((url: unknown) => typeof url === 'string' && STATE_CHANGING_TOKEN_REGEX.test(url))
          ).toBe(false);
        }
        if (set.where) {
          // A `where` rule must not positively target state-changing URLs (exclusions inside `not` are valid)
          expect(hasPositiveStateChangingMatch(set.where)).toBe(false);
          // If the page contains a /logout link, a document `where` rule must exclude it
          for (const logoutEl of logoutLinks) {
            const href = logoutEl.getAttribute('href') || '/logout';
            expect(whereMatchesLink(set.where, href, logoutEl)).toBe(false);
          }
        }
      }
    } else {
      throw new Error('Rules not found or invalid');
    }
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  // 9. Check if it's an SPA
  test('The page should be a Multi-Page Application (MPA), not a Single Page Application (SPA)', async ({ page }) => {
    const hasHashChange = await page.evaluate(() => {
      return typeof (window as unknown as Record<string, unknown>).router === 'function' || Boolean(window.onhashchange);
    });
    expect(hasHashChange).toBe(false);
  });

  // 10. Check valid eagerness values
  test('The optional eagerness property is one of the valid values', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const ruleSets = [
        ...(rules.prefetch || []),
        ...(rules.prerender || []),
        ...(rules.prerender_until_script || []),
      ];
      expect(ruleSets.length).toBeGreaterThan(0);
      const validEagerness = ['immediate', 'eager', 'moderate', 'conservative'];
      for (const set of ruleSets) {
        if (set.eagerness) {
          expect(validEagerness).toContain(set.eagerness);
        }
      }
    } else {
      throw new Error('Rules not found or invalid');
    }
  });
});
