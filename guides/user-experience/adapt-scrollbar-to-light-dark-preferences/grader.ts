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
test.describe(`Adapt Scrollbar Expectations: ${demoName}`, () => {
  const html = fs.readFileSync(filePath, 'utf-8');

  // 1. Root element defines color-scheme: light dark
  test('The :root element must define color-scheme: light dark', async () => {
    // MANDATORY: Define color-scheme on the :root pseudo-class.
    expect(html).toMatch(/:root\s*{[^}]*color-scheme:\s*light\s+dark/);
  });

  // 2. CSS variables are used for scrollbar colors
  test('CSS custom properties must be used for scrollbar colors', async () => {
    // MANDATORY: Use CSS custom properties (variables) to define your colors.
    expect(html).toMatch(/--[a-zA-Z0-9-]*scrollbar[a-zA-Z0-9-]*\s*:/);
  });

  // 3. prefers-color-scheme: dark updates variables
  test('A prefers-color-scheme: dark media query must update the scrollbar variables', async () => {
    // MANDATORY: ...and update them within a prefers-color-scheme media query.
    expect(html).toMatch(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*{[^}]*--/);
  });

  // 4. scrollbar-color property uses var()
  test('The scrollbar-color property must utilize the defined CSS variables', async () => {
    // The explicit scrollbar colors use the standard scrollbar-color: var(--thumb) var(--track) property.
    expect(html).toMatch(/scrollbar-color\s*:\s*var\(/);
  });

  // 5. scrollbar-width is explicitly applied
  test('The scrollbar-width property must be explicitly applied for macOS support', async () => {
    // MANDATORY: You MUST pair custom colors with scrollbar-width to force macOS to render them.
    expect(html).toMatch(/scrollbar-width\s*:/);
  });

  // 6. Legacy WebKit styling is isolated with @supports
  test('Legacy WebKit scrollbar styling must be isolated within an @supports block', async () => {
    // MANDATORY: You MUST wrap legacy WebKit fallbacks in an @supports not (scrollbar-color: auto) block.
    expect(html).toMatch(/@supports\s+not\s*\(\s*scrollbar-color\s*:\s*auto\s*\)\s*{[^}]*::-webkit-scrollbar/);
  });

  // 7. WebKit fallback includes dimension properties
  test('The legacy WebKit fallback must include basic scrollbar dimensions', async () => {
    // MANDATORY: The fallback includes basic ::-webkit-scrollbar dimensions (e.g., width or height).
    expect(html).toMatch(/@supports\s+not\s*\(\s*scrollbar-color\s*:\s*auto\s*\)\s*{[^}]*::-webkit-scrollbar[^}]*(width|height)\s*:/);
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

  // 8. scrollbar-gutter: stable
  test('At least one scrollable element must have scrollbar-gutter: stable applied', async ({ page }) => {
    // MANDATORY: You MUST apply scrollbar-gutter: stable; to the scrollable container.
    const hasGutter = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const scrollers = elements.filter(el => {
        const style = getComputedStyle(el);
        return style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
      });
      return scrollers.some(el => getComputedStyle(el).scrollbarGutter.includes('stable'));
    });
    expect(hasGutter).toBe(true);
  });

  // 9. Scrollable element exists and respects system preferences
  test('A scrollable element must exist and inherit the root light/dark color scheme', async ({ page }) => {
    // The agent has created a scrollable element... and utilizes the color-scheme property.
    const isAdaptive = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const scrollers = elements.filter(el => {
        const style = getComputedStyle(el);
        return style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
      });
      // Check if the first scroller found inherits the light dark color scheme
      return scrollers.length > 0 && getComputedStyle(scrollers[0]).colorScheme === 'light dark';
    });
    expect(isAdaptive).toBe(true);
  });
});
