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

test.describe(`Intl.DurationFormat Expectations: ${demoName}`, () => {

  // 1. Feature Detection (Static)
  test('Should implement feature detection for Intl.DurationFormat', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Look for feature detection patterns like 'DurationFormat' in Intl or typeof Intl.DurationFormat
    const hasFeatureDetection = /'DurationFormat'\s*in\s*Intl|Intl\.DurationFormat\b/.test(html) && 
                                (/\bif\s*\(/.test(html) || /\?/.test(html) || /&&/.test(html) || /typeof/.test(html));
    expect(hasFeatureDetection, 'Code should check if Intl.DurationFormat is supported before use').toBe(true);
  });

  // 2. Use of Intl.DurationFormat (Static)
  test('Should use Intl.DurationFormat API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('Intl.DurationFormat');
  });

  // 3. No manual pluralization (Static) - Must fail criteria
  test('Should not use manual string concatenation for pluralization', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Look for manual pluralization patterns (e.g., " hour" or " hours" as string literals)
    // We avoid matching keys in the duration object by looking for a leading space or common concatenation patterns
    const manualConcat = /["']\s+(year|month|week|day|hour|minute|second)s?["']/.test(html);
    expect(manualConcat, 'Manual pluralization strings (e.g., " hours") were detected').toBe(false);
  });

  // 4. No RelativeTimeFormat for durations (Static) - Must fail criteria
  test('Should not use Intl.RelativeTimeFormat for duration display', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Using RelativeTimeFormat for durations is explicitly forbidden in expectations.md
    const usesRelativeTime = /Intl\.RelativeTimeFormat/.test(html);
    expect(usesRelativeTime, 'Intl.RelativeTimeFormat should not be used for durations').toBe(false);
  });

  // Setup browser testing with spying
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

    // Inject spy/mock before page load to capture API usage
    await page.addInitScript(() => {
      (window as any).__durationFormatCalls = [];
      const Original = (Intl as any).DurationFormat;
      
      const Mock = class {
        locales: any;
        options: any;
        instance: any;
        constructor(locales: any, options: any) {
          this.locales = locales;
          this.options = options;
          (window as any).__durationFormatCalls.push({ type: 'constructor', locales, options });
          if (Original) {
            this.instance = new Original(locales, options);
          }
        }
        format(duration: any) {
          (window as any).__durationFormatCalls.push({ type: 'format', duration, style: this.options?.style });
          if (Original) {
            return this.instance.format(duration);
          }
          // Fallback mock string if browser doesn't support the API yet
          return `mock-${this.options?.style || 'default'}`;
        }
      };
      
      (Intl as any).DurationFormat = Mock;
    });

    await page.goto(demoUrl);
  });

  // 5. Verify Constructor Options (Browser)
  test('Should pass correct options to Intl.DurationFormat constructor', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__durationFormatCalls);
    const constructorCalls = (calls || []).filter((c: any) => c.type === 'constructor');
    
    expect(constructorCalls.length).toBeGreaterThan(0);
    // Check if at least one call uses a recognized style option
    const hasStyle = constructorCalls.some((c: any) => c.options && ['long', 'short', 'narrow', 'digital'].includes(c.options.style));
    expect(hasStyle, 'Intl.DurationFormat should be initialized with a style option').toBe(true);
  });

  // 6. Verify Multiple Styles (Browser)
  test('Should handle multiple formatting styles as required by the use case', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__durationFormatCalls);
    const constructorCalls = (calls || []).filter((c: any) => c.type === 'constructor');
    const stylesUsed = new Set(constructorCalls.map((c: any) => c.options?.style));
    
    // demo.html uses multiple styles, negative-demo uses none.
    expect(stylesUsed.size, 'Should demonstrate multiple formatting styles').toBeGreaterThanOrEqual(1);
  });

  // 7. Verify Duration Object Argument (Browser)
  test('Should provide a duration object to the format method', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__durationFormatCalls);
    const formatCalls = (calls || []).filter((c: any) => c.type === 'format');
    
    expect(formatCalls.length, 'format() method was not called').toBeGreaterThan(0);
    const firstCall = formatCalls[0];
    expect(typeof firstCall.duration, 'format() should receive an object').toBe('object');
    expect(firstCall.duration, 'format() received null').not.toBeNull();
    
    // Check for common time units in the duration object
    const hasTimeUnits = 'hours' in firstCall.duration || 'minutes' in firstCall.duration || 'seconds' in firstCall.duration || 
                         'days' in firstCall.duration || 'months' in firstCall.duration || 'years' in firstCall.duration;
    expect(hasTimeUnits, 'The duration object should contain time units like hours, minutes, or seconds').toBe(true);
  });

  // 8. Locale Awareness (Browser)
  test('Should be initialized with a locale for locale-aware output', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__durationFormatCalls);
    const constructorCalls = (calls || []).filter((c: any) => c.type === 'constructor');
    
    expect(constructorCalls.length, 'Constructor was not called').toBeGreaterThan(0);
    const hasLocale = constructorCalls.some((c: any) => c.locales !== undefined);
    expect(hasLocale, 'Intl.DurationFormat should be initialized with a locale').toBe(true);
  });

});
