import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const TARGET_FILE = process.env.TARGET_FILE;

function getScriptContent(): string {
  if (!TARGET_FILE || !fs.existsSync(TARGET_FILE)) return '';
  return fs.readFileSync(TARGET_FILE, 'utf8');
}

test.describe('Temporal Reactive State Grader', () => {

  test('should feature-detect the Temporal API before usage', async ({ page }) => {
    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl).catch(() => {});
    const code = getScriptContent();
    const hasFeatureCheck = (code.includes('typeof Temporal') || code.includes('in globalThis') || code.includes('in window') || code.includes("!('Temporal'")) && code.includes('Temporal');
    expect(hasFeatureCheck).toBe(true);
  });

  test('should conditionally load a Temporal polyfill only if native support is absent', async ({ page }) => {
    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl).catch(() => {});
    const code = getScriptContent();
    const hasConditionalLoad = (code.includes('typeof Temporal') || code.includes('!Temporal') || code.includes("!('Temporal'")) && (code.includes('import(') || code.includes('polyfill') || code.includes('require('));
    expect(hasConditionalLoad).toBe(true);
  });

  test('should use Temporal.PlainDateTime (or specific Temporal type) as the value in reactive state to ensure immutability', async ({ page }) => {
    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl).catch(() => {});
    const code = getScriptContent();
    const hasTemporalType = code.includes('PlainDateTime') || code.includes('PlainDate') || code.includes('Temporal.Now') || code.includes('plainDateISO') || code.includes('plainDateTimeISO');
    expect(hasTemporalType).toBe(true);
  });

  test('should update the reactive state by calling methods that return a new instance rather than mutating the existing object', async ({ page }) => {
    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl).catch(() => {});
    const code = getScriptContent();
    const hasMethodUpdate = code.includes('.add(') || code.includes('.subtract(') || code.includes('.with(');
    expect(hasMethodUpdate).toBe(true);
  });

  test('should assign the new Temporal instance reference to the state to trigger a UI update in reference-diffing systems', async ({ page }) => {
    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl).catch(() => {});
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
    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl).catch(() => {});
    const btn = page.locator('#extend-temporal-btn');
    await btn.click().catch(() => {});
    await page.waitForTimeout(300);

    const code = getScriptContent();
    expect(code.includes('render()') || code.includes('textContent') || code.includes('innerHTML') || code.includes('useState')).toBe(true);
  });

  test('should not attempt to modify properties of a Temporal instance directly', async ({ page }) => {
    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl).catch(() => {});
    const code = getScriptContent();
    const hasDirectPropertyMutation = /\.day\s*=\s*|\.month\s*=\s*|\.year\s*=\s*|\.hour\s*=\s*/.test(code);
    expect(hasDirectPropertyMutation).toBe(false);
  });

});
