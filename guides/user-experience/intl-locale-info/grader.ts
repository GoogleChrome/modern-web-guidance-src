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

test.describe(`Intl.Locale info Expectations: ${demoName}`, () => {
  let html = '';

  test.beforeAll(() => {
    html = fs.readFileSync(filePath, 'utf-8');
  });

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const normalizedPath = requestPath === '/' ? demoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(targetDir, normalizedPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  });

  // Must pass
  test(`Must check for Intl.Locale.prototype getter methods before calling them`, async () => {
    const hasFeatureCheck = /['"`]get(Calendars|TextInfo|WeekInfo|Collations|HourCycles|NumberingSystems|TimeZones)['"`]\s*in\s*Intl\.Locale\.prototype/.test(html);
    expect(hasFeatureCheck).toBe(true);
  });

  test(`Must instantiate a new Intl.Locale object to access locale info`, async () => {
    const hasInstAndGetter = /new\s+Intl\.Locale[\s\S]*\.get(Calendars|TextInfo|WeekInfo|Collations|HourCycles|NumberingSystems|TimeZones)\s*\(/.test(html);
    expect(hasInstAndGetter).toBe(true);
  });

  test(`Must invoke at least one of the Intl.Locale info getter methods`, async () => {
    const invokesGetter = /(?<!Intl\.Locale)\.get(Calendars|TextInfo|WeekInfo|Collations|HourCycles|NumberingSystems|TimeZones)\s*\(/.test(html);
    expect(invokesGetter).toBe(true);
  });

  test(`Must handle the return types correctly`, async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));
    await page.goto(demoUrl);
    expect(errors).toHaveLength(0);
  });

  test(`Must provide a functional fallback or degradation path if the getters are unsupported`, async ({ page }) => {
    await page.addInitScript(() => {
      if (typeof Intl !== 'undefined' && Intl.Locale && Intl.Locale.prototype) {
        delete (Intl.Locale.prototype as any).getCalendars;
        delete (Intl.Locale.prototype as any).getTextInfo;
        delete (Intl.Locale.prototype as any).getWeekInfo;
        delete (Intl.Locale.prototype as any).getCollations;
        delete (Intl.Locale.prototype as any).getHourCycles;
        delete (Intl.Locale.prototype as any).getNumberingSystems;
        delete (Intl.Locale.prototype as any).getTimeZones;
      }
    });

    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));
    await page.goto(demoUrl);
    
    expect(errors).toHaveLength(0);
  });

  // Must fail
  test(`Must fail if locale data is queried via deprecated Intl.Locale accessor properties`, async () => {
    const usesDeprecated = /\.(calendars|textInfo|weekInfo|collations|hourCycles|numberingSystems|timeZones)\b(?!\()/i.test(html);
    expect(usesDeprecated).toBe(false);
  });

  test(`Must fail if it ships a large external timezone or locale data library`, async () => {
    const hasLargeLib = /moment(-timezone)?(\.min)?\.js|date-fns/i.test(html);
    expect(hasLargeLib).toBe(false);
  });

  test(`Must fail if it attempts to call the getters statically on the constructor`, async () => {
    const usesStatic = /Intl\.Locale\.get(Calendars|TextInfo|WeekInfo|Collations|HourCycles|NumberingSystems|TimeZones)\b/i.test(html);
    expect(usesStatic).toBe(false);
  });
});
