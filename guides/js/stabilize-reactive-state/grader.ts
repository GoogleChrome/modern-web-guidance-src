import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const TARGET_FILE = process.env.TARGET_FILE ? path.resolve(process.env.TARGET_FILE) : '';
const targetDir = TARGET_FILE ? path.dirname(TARGET_FILE) : '';
const targetFileName = TARGET_FILE ? path.basename(TARGET_FILE) : 'demo.html';
const targetUrl = `http://localhost/${targetFileName}`;

function getScriptContent(): string {
  if (!TARGET_FILE || !fs.existsSync(TARGET_FILE)) return '';
  const html = fs.readFileSync(TARGET_FILE, 'utf8');
  const parts = [html];
  if (targetFileName === 'demo.html' || targetFileName === 'negative-demo.html') {
    for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      const src = m[1];
      if (/^https?:\/\//i.test(src)) continue;
      const localPath = path.resolve(targetDir, src.replace(/^\/+/, ''));
      if (localPath.startsWith(targetDir + path.sep) && fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        parts.push(fs.readFileSync(localPath, 'utf8'));
      }
    }
    return parts.join('\n');
  }
  const excludedDirs = new Set(['node_modules', 'vendor', 'test', 'tests', 'grade-report', 'test-results', 'dist', '.git']);
  const walk = (dir: string) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!excludedDirs.has(entry.name)) walk(path.join(dir, entry.name));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
          entry.name !== 'grade.mjs' &&
          entry.name !== 'run.mjs' &&
          !entry.name.includes('.config.') &&
          !entry.name.includes('.test.') &&
          !entry.name.includes('.spec.') &&
          !entry.name.includes('.min.') &&
          !entry.name.includes('.umd.') &&
          !entry.name.includes('polyfill') &&
          fs.statSync(path.join(dir, entry.name)).size < 100_000
        ) {
          parts.push(fs.readFileSync(path.join(dir, entry.name), 'utf8'));
        }
      }
    } catch {
      // ignore read errors
    }
  };
  walk(targetDir);
  return parts.join('\n');
}

test.describe('Temporal Reactive State Grader', () => {
  test.beforeEach(async ({ page }) => {
    if (!targetDir) return;
    await page.route('http://localhost/**', async (route) => {
      const reqPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const resolved = path.join(targetDir, reqPath === '/' ? targetFileName : reqPath.replace(/^\//, ''));
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        await route.fulfill({ path: resolved });
      } else {
        await route.continue();
      }
    });
  });

  test('should feature-detect the Temporal API before usage', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const code = getScriptContent();
    const hasFeatureCheck =
      (code.includes('typeof Temporal') ||
        /typeof\s+(?:globalThis|window)\.Temporal\b/.test(code) ||
        code.includes('in globalThis') ||
        code.includes('in window') ||
        code.includes("!('Temporal'") ||
        /!\s*(?:globalThis|window)\.Temporal\b/.test(code) ||
        /(?:globalThis|window)\.Temporal\s*(?:\?\?|\|\||\?|!==|===|!=|==)/.test(code)) &&
      code.includes('Temporal');
    expect(hasFeatureCheck).toBe(true);
  });

  test('should conditionally load a Temporal polyfill only if native support is absent', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const code = getScriptContent();
    const hasConditionalLoad =
      (code.includes('typeof Temporal') ||
        /typeof\s+(?:globalThis|window)\.Temporal\b/.test(code) ||
        code.includes('!Temporal') ||
        code.includes("!('Temporal'") ||
        /(?:globalThis|window)\.Temporal\s*(?:\?\?|\|\||\?)/.test(code) ||
        /!\s*(?:globalThis|window)\.Temporal\b/.test(code)) &&
      (code.includes('import(') || code.includes('polyfill') || code.includes('require('));
    expect(hasConditionalLoad).toBe(true);
  });

  test('should use Temporal.PlainDateTime (or specific Temporal type) as the value in reactive state to ensure immutability', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const code = getScriptContent();
    const hasTemporalType = code.includes('PlainDateTime') || code.includes('PlainDate') || code.includes('Temporal.Now') || code.includes('plainDateISO') || code.includes('plainDateTimeISO');
    expect(hasTemporalType).toBe(true);
  });

  test('should update the reactive state by calling methods that return a new instance rather than mutating the existing object', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const code = getScriptContent();
    const hasMethodUpdate = code.includes('.add(') || code.includes('.subtract(') || code.includes('.with(');
    expect(hasMethodUpdate).toBe(true);
  });

  test('should assign the new Temporal instance reference to the state to trigger a UI update in reference-diffing systems', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const btn = page.locator('#extend-temporal-btn');
    await btn.click().catch(() => {});
    await page.waitForTimeout(300);

    const refText = await page.locator('#temporal-ref-changed').textContent().catch(() => '');
    if (refText && refText.trim() === 'Yes') {
      expect(refText.trim()).toBe('Yes');
      return;
    }
    const code = getScriptContent();
    expect(code.includes('prevDate !==') || code.includes('prevRef') || code.includes('ref-changed') || code.includes('setState')).toBe(true);
  });

  test('should trigger a UI re-render when the state is updated', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const btn = page.locator('#extend-temporal-btn');
    await btn.click().catch(() => {});
    await page.waitForTimeout(300);

    const code = getScriptContent();
    expect(code.includes('render()') || code.includes('textContent') || code.includes('innerHTML') || code.includes('useState')).toBe(true);
  });

  test('should not attempt to modify properties of a Temporal instance directly', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const code = getScriptContent();
    const hasDirectPropertyMutation = /\.day\s*=\s*|\.month\s*=\s*|\.year\s*=\s*|\.hour\s*=\s*/.test(code);
    expect(hasDirectPropertyMutation).toBe(false);
  });

});

