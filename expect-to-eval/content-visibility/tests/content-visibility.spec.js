const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const demos = [
  {
    name: 'Negative Demo',
    path: path.join(__dirname, '../negative-demo.html'),
    expectSuccess: false
  },
  {
    name: 'Golden Demo',
    path: path.join(__dirname, '../golden-demo.html'),
    expectSuccess: true
  }
];

for (const demo of demos) {
  const demoUrl = `file://${demo.path}`;

  test.describe(`content-visibility Expectations: ${demo.name}`, () => {

    // --- Static Content Assertions ---
    test(`Static Check: Demo file should ${demo.expectSuccess ? '' : 'NOT '}contain content-visibility: auto`, async () => {
      const html = fs.readFileSync(demo.path, 'utf-8');
      if (demo.expectSuccess) {
        expect(html).toContain('content-visibility: auto');
      } else {
        expect(html).not.toContain('content-visibility: auto');
      }
    });

    test(`Static Check: Demo file should ${demo.expectSuccess ? '' : 'NOT '}contain contain-intrinsic-size`, async () => {
      const html = fs.readFileSync(demo.path, 'utf-8');
      if (demo.expectSuccess) {
        expect(html).toContain('contain-intrinsic-size:');
      } else {
        expect(html).not.toContain('contain-intrinsic-size:');
      }
    });

    // --- Functional Browser Assertions ---
    test.beforeEach(async ({ page }) => {
      await page.goto(demoUrl);
      // Wait for the cards to be rendered (the demo has a 500ms delay)
      await page.waitForSelector('.card');
    });

    test(`Functional: Cards below the fold should ${demo.expectSuccess ? '' : 'NOT '}have content-visibility: auto`, async ({ page }) => {
      const cards = page.locator('.card');
      
      // Check a card that is definitely off-screen (e.g., the 100th card)
      const offscreenCard = cards.nth(99);
      const cv = await offscreenCard.evaluate(el => getComputedStyle(el).contentVisibility);
      
      if (demo.expectSuccess) {
        expect(cv).toBe('auto');
      } else {
        expect(cv).toBe('visible');
      }
    });

    test(`Functional: Cards should ${demo.expectSuccess ? '' : 'NOT '}have contain-intrinsic-size set`, async ({ page }) => {
      const firstCard = page.locator('.card').first();
      const cis = await firstCard.evaluate(el => getComputedStyle(el).containIntrinsicSize);
      
      if (demo.expectSuccess) {
        expect(cis).not.toBe('none');
        expect(cis).not.toBe('0px');
      } else {
        expect(cis).toBe('none');
      }
    });

    test(`Functional: Performance - Initial render should be ${demo.expectSuccess ? 'FAST (<100ms)' : 'SLOW (>100ms)'}`, async ({ page }) => {
      const timerText = await page.innerText('#timer');
      const duration = parseInt(timerText.replace('ms', ''));
      
      console.log(`${demo.name} Initial Render: ${duration}ms`);
      
      if (demo.expectSuccess) {
        expect(duration).toBeLessThan(100);
      } else {
        expect(duration).toBeGreaterThan(100);
      }
    });

    test('Functional: Accessibility - Off-screen content remains in A11y tree (Universal)', async ({ page }) => {
      const lastCardBadge = page.locator('.card').last().locator('.badge');
      
      // Should be findable regardless of CV setting
      // Note: we use textContent because innerText can be empty for non-rendered content
      const text = await lastCardBadge.textContent();
      expect(text).toContain('Item #500');
    });

    if (demo.expectSuccess) {
        test('Functional: API Discipline - No console warnings for forced layout (Golden Only)', async ({ page }) => {
            const warnings = [];
            page.on('console', msg => {
                if (msg.type() === 'warning' || msg.type() === 'error') {
                    warnings.push(msg.text());
                }
            });

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(500);

            const forcedLayoutWarnings = warnings.filter(w => w.includes('forced reflow') || w.includes('content-visibility'));
            expect(forcedLayoutWarnings).toHaveLength(0);
        });
    }
  });
}