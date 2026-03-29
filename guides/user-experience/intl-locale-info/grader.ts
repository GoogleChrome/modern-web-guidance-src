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

// Tests
test.describe(`intl-locale-info Expectations: ${demoName}`, () => {
  let html = '';
  
  test.beforeAll(() => {
    html = fs.readFileSync(filePath, 'utf-8');
  });

  test(`Code checks for feature support by checking if a method like getCalendars exists on Intl.Locale.prototype before executing`, async () => {
    expect(html).toMatch(/['"]getCalendars['"]\s+in\s+Intl\.Locale\.prototype|typeof\s+Intl\.Locale\.prototype\.getCalendars\s*===?\s*['"]function['"]/);
  });

  test(`Application successfully instantiates an Intl.Locale object`, async () => {
    expect(html).toMatch(/const\s+[\w]+\s*=\s*new\s+Intl\.Locale[\s\S]*?[\w]+\.get(?:Calendars|TextInfo|WeekInfo|Collations|HourCycles|NumberingSystems|TimeZones)/);
  });

  test(`Application invokes one or more Intl.Locale getter methods to retrieve metadata`, async () => {
    expect(html).toMatch(/\.(?:getCalendars|getTextInfo|getWeekInfo|getCollations|getHourCycles|getNumberingSystems|getTimeZones)\s*\(/);
  });

  test(`Must fail: Maintaining large, hardcoded lookup maps of specific language tags to weekend days, calendar systems, or text layout directions in modern environments.`, async () => {
    expect(html).not.toMatch(/(?:['"]?[a-z]{2}-[a-z]{2}['"]?\s*:\s*\{[\s\S]*?){2,}/i);
  });

  test(`Must fail: Polling for the presence of the API continuously.`, async () => {
    expect(html).not.toMatch(/setInterval\s*\([\s\S]*?(?:Intl|getCalendars)/);
  });

  test(`Must fail: Accessing older properties (like locale.calendar or locale.hourCycle) to fetch supported collections, instead of calling the new info getter methods.`, async () => {
    expect(html).not.toMatch(/\.(?:calendar|hourCycle|collation|numberingSystem)\b/);
  });
});

test.describe(`intl-locale-info browser expectations: ${demoName}`, () => {
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

    await page.addInitScript(() => {
      (window as any).__localeGetterCalled = false;
      if (typeof Intl !== 'undefined' && Intl.Locale && Intl.Locale.prototype) {
        const getters = ['getCalendars', 'getTextInfo', 'getWeekInfo', 'getCollations', 'getHourCycles', 'getNumberingSystems', 'getTimeZones'];
        getters.forEach(getter => {
          const original = (Intl.Locale.prototype as any)[getter];
          if (original) {
            (Intl.Locale.prototype as any)[getter] = function(...args: any[]) {
              (window as any).__localeGetterCalled = true;
              return original.apply(this, args);
            };
          } else {
            (Intl.Locale.prototype as any)[getter] = function() {
              (window as any).__localeGetterCalled = true;
              return {}; 
            };
          }
        });
      }
    });

    await page.goto(demoUrl);
  });

  test(`Application utilizes the returned metadata to dynamically control rendering logic or data formatting`, async ({ page }) => {
    const gettersInvoked = await page.evaluate(() => (window as any).__localeGetterCalled);
    expect(gettersInvoked).toBe(true);
  });
});
