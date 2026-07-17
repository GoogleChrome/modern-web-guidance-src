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

const html = fs.readFileSync(filePath, 'utf-8');
const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
const cssContent = styleMatches ? styleMatches.map((m: string) => m.replace(/<\/?style[^>]*>/gi, '')).join('\n') : '';

test.describe(`Animated Select Picker Expectations: ${demoName}`, () => {
  
  test('Applies appearance: base-select to opt into customizable select', async () => {
    expect(cssContent).toMatch(/appearance\s*:\s*base-select/);
  });

  test('Applies styles to ::picker(select) pseudo-element', async () => {
    expect(cssContent).toMatch(/::picker\(\s*select\s*\)/);
  });

  test('Uses allow-discrete transition behavior for visibility animations', async () => {
    expect(cssContent).toMatch(/allow-discrete/);
  });

  test('Uses @starting-style to declare initial visual state before opening', async () => {
    expect(cssContent).toMatch(/@starting-style/);
  });

  test('Animates dropdown icon using :open::picker-icon pseudo-element', async () => {
    expect(cssContent).toMatch(/:open::picker-icon/);
  });

  test('Does not use JavaScript as the primary mechanism for toggling top-layer visibility', async () => {
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    const scriptContent = scriptMatches ? scriptMatches.join('\n') : '';
    const hasManualToggle = /addEventListener\s*\(\s*['"`]click['"`]/i.test(scriptContent) && 
                            (/classList\.(toggle|add|remove)/i.test(scriptContent) || 
                             /style\.(display|opacity|visibility)/i.test(scriptContent));
    expect(hasManualToggle).toBe(false);
  });

  test('Progressive enhancement fallback checks CSS.supports if JS is used', async () => {
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    const scriptContent = scriptMatches ? scriptMatches.join('\n') : '';
    const needsFallbackCheck = scriptContent.length > 0 && /addEventListener|classList|style/i.test(scriptContent);
    const hasFallbackCheck = /CSS\.supports\s*\(\s*['"`]appearance['"`]\s*,\s*['"`]base-select['"`]\s*\)/.test(scriptContent);
    expect(needsFallbackCheck ? hasFallbackCheck : true).toBe(true);
  });

  test('Inline decorative SVG icons inside <option> elements must define aria-hidden="true"', async () => {
    const matches = [...html.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)];
    for (const match of matches) {
      const optInner = match[1];
      if (/<svg/i.test(optInner)) {
        expect(/aria-hidden=["']true["']/i.test(optInner)).toBe(true);
      }
    }
  });

  test('Options with complex inner markup must use aria-label', async () => {
    expect(/<option[^>]*aria-label/i.test(html)).toBe(true);
  });

  test('The checked state of an option must incorporate multiple visual indicators', async () => {
    expect(/font-weight:|border/i.test(cssContent)).toBe(true);
  });

  test('Continuous keyframe animations must be wrapped inside a reduced-motion media query', async () => {
    if (/@keyframes/i.test(cssContent)) {
      expect(/prefers-reduced-motion/i.test(cssContent)).toBe(true);
    }
  });

  test.describe('Browser DOM tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const filename = requestPath === '/' ? demoName : requestPath.slice(1);
        const localFilePath = path.join(targetDir, filename);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });

      await page.goto(demoUrl);
    });

    test('Contains a <selectedcontent> element to mirror selections', async ({ page }) => {
      const count = await page.locator('selectedcontent').count();
      expect(count).toBeGreaterThan(0);
    });

    test('Does NOT contain legacy <selectedoption> element', async ({ page }) => {
      const count = await page.locator('selectedoption').count();
      expect(count).toBe(0);
    });

    test('<select> element has a name attribute', async ({ page }) => {
      const select = page.locator('select').first();
      await expect(select).toHaveAttribute('name', /.+/);
    });

    test('<select> element has an associated <label>', async ({ page }) => {
      const select = page.locator('select').first();
      const hasLabel = await select.evaluate((el: HTMLElement) => {
        if (el.closest('label')) return true;
        const id = el.getAttribute('id');
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return true;
        }
        return false;
      });
      expect(hasLabel).toBe(true);
    });
  });
});
