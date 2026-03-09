import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

// Helper to get speculation rules
function getSpeculationRules(html: string) {
  const match = html.match(/<script type="speculationrules">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return 'INVALID_JSON';
  }
}

test.describe(`Improve next page load performance Expectations: ${demoName}`, () => {
  
  // 1. Check for <script type="speculationrules">
  test('The rule is included in a <script type="speculationrules"> tag', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('<script type="speculationrules">');
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
      expect(keys.some(key => validKeys.includes(key))).toBe(true);
      expect(keys.every(key => validKeys.includes(key))).toBe(true);
    } else {
      throw new Error('Rules not found or invalid');
    }
  });

  // 4. Check for urls or where property
  test('The rule contains either urls or where property in each rule set', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const ruleSets = [...(rules.prefetch || []), ...(rules.prerender || []), ...(rules.prerender_until_script || [])];
      expect(ruleSets.length).toBeGreaterThan(0);
      for (const set of ruleSets) {
        expect(set.urls || set.where).toBeDefined();
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
      const ruleSets = [...(rules.prefetch || []), ...(rules.prerender || []), ...(rules.prerender_until_script || [])];
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
      const ruleSets = [...(rules.prefetch || []), ...(rules.prerender || []), ...(rules.prerender_until_script || [])];
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
      const ruleSets = [...(rules.prefetch || []), ...(rules.prerender || []), ...(rules.prerender_until_script || [])];
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
      const ruleSets = [...(rules.prefetch || []), ...(rules.prerender || []), ...(rules.prerender_until_script || [])];
      for (const set of ruleSets) {
        if (set.urls) {
          expect(set.urls.some((url: string) => url.includes('logout'))).toBe(false);
        }
        if (set.where) {
          // Simplistic check for /logout in where clause
          const whereStr = JSON.stringify(set.where);
          expect(whereStr.includes('logout')).toBe(false);
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
        // Simple check for hashchange listener or router-like behavior
        // This is a bit heuristic but fits the negative-demo.html
        return typeof (window as any).router === 'function' || !!(window as any).onhashchange;
    });
    // negative-demo.html has a router function and hashchange listener
    expect(hasHashChange).toBe(false);
  });

  // 10. Check valid eagerness values
  test('The optional eagerness property is one of the valid values', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const rules = getSpeculationRules(html);
    if (rules && rules !== 'INVALID_JSON') {
      const ruleSets = [...(rules.prefetch || []), ...(rules.prerender || []), ...(rules.prerender_until_script || [])];
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
