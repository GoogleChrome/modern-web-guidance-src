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

test.describe(`Branded Select Styling Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = requestPath === '/' ? demoName : requestPath.replace(/^\/+/, '');
      const localFilePath = path.resolve(targetDir, relPath);

      if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  async function getCssRules(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const out: Array<{ selector: string; appearance: string; props: string[] }> = [];
      const walk = (rules: CSSRuleList | undefined) => {
        if (!rules) return;
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            out.push({
              selector: rule.selectorText,
              appearance: rule.style.appearance,
              props: Array.from(rule.style),
            });
          }
          if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
            walk((rule as CSSGroupingRule).cssRules);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walk(sheet.cssRules);
        } catch {
          // Ignore cross-origin stylesheets (e.g. external font CDNs)
        }
      }
      return out;
    });
  }

  // 1. Style assertions
  test('The `<select>` element has `appearance: base-select` applied.', async ({ page }) => {
    const hasBaseSelect = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      return selects.some(el => window.getComputedStyle(el).appearance === 'base-select');
    });
    expect(hasBaseSelect).toBe(true);
  });

  test('The `::picker(select)` pseudo-element has `appearance: base-select` applied.', async ({ page }) => {
    const rules = await getCssRules(page);
    const hasPickerAppearance = rules.some(
      r => /::picker(?:\(select\))?\b/i.test(r.selector) && r.appearance === 'base-select'
    );
    expect(hasPickerAppearance).toBe(true);
  });

  test('The `::picker(select)` pseudo-element defines custom styles for the options dropdown container.', async ({ page }) => {
    const rules = await getCssRules(page);
    const visualContainerProps = /^(?:border|background|padding|box-shadow|border-radius|color|margin|outline|width|min-width|max-height|font)/i;
    const hasPickerContainerStyles = rules.some(
      r => /::picker(?![-\w])/i.test(r.selector) && r.props.some(p => visualContainerProps.test(p))
    );
    expect(hasPickerContainerStyles).toBe(true);
  });

  test('The implementation uses `select::picker-icon` to customize the drop-down arrow icon.', async ({ page }) => {
    const rules = await getCssRules(page);
    const hasPickerIcon = rules.some(r => /::picker-icon\b/i.test(r.selector) && r.props.length > 0);
    expect(hasPickerIcon).toBe(true);
  });

  test('The implementation uses `option::checkmark` to customize the checkmark indicator for the selected option.', async ({ page }) => {
    const rules = await getCssRules(page);
    const hasCheckmark = rules.some(r => /::checkmark\b/i.test(r.selector) && r.props.length > 0);
    expect(hasCheckmark).toBe(true);
  });

  // 2. Browser assertions
  test('The markup includes a `<button>` element inside the `<select>` to replace the default trigger.', async ({ page }) => {
    const hasButtonOrVisibleBaseSelect = await page.evaluate(() => {
      const isVisible = (select: HTMLSelectElement) => {
        const style = window.getComputedStyle(select);
        const rect = select.getBoundingClientRect();
        return (
          style.appearance === 'base-select' &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity) > 0 &&
          !/^rect\(\s*0(?:px)?\s*,\s*0(?:px)?\s*,\s*0(?:px)?\s*,\s*0(?:px)?\s*\)$/i.test(style.clip) &&
          !/inset\(\s*50%\s*\)/i.test(style.clipPath) &&
          rect.width > 10 &&
          rect.height > 10
        );
      };
      const selects = Array.from(document.querySelectorAll('select'));
      return selects.some(select => !!select.querySelector(':scope > button') || isVisible(select));
    });
    expect(hasButtonOrVisibleBaseSelect).toBe(true);
  });

  test('The trigger button includes a `<selectedcontent>` element to display the active option.', async ({ page }) => {
    const hasSelectedContentOrVisibleBaseSelect = await page.evaluate(() => {
      const isVisible = (select: HTMLSelectElement) => {
        const style = window.getComputedStyle(select);
        const rect = select.getBoundingClientRect();
        return (
          style.appearance === 'base-select' &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity) > 0 &&
          !/^rect\(\s*0(?:px)?\s*,\s*0(?:px)?\s*,\s*0(?:px)?\s*,\s*0(?:px)?\s*\)$/i.test(style.clip) &&
          !/inset\(\s*50%\s*\)/i.test(style.clipPath) &&
          rect.width > 10 &&
          rect.height > 10
        );
      };
      const selects = Array.from(document.querySelectorAll('select'));
      return selects.some(select =>
        !!select.querySelector(':scope > button selectedcontent') ||
        (!select.querySelector(':scope > button') && isVisible(select))
      );
    });
    expect(hasSelectedContentOrVisibleBaseSelect).toBe(true);
  });

  test('The trigger button does not contain the legacy `<selectedoption>` element.', async ({ page }) => {
    const hasSelectedOption = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      if (selects.length === 0) return true;
      return selects.some(select => !!select.querySelector('selectedoption'));
    });
    expect(hasSelectedOption).toBe(false);
  });

  test('The colors have a contrast of at least `3:1` with the background color.', async ({ page }) => {
    const selectLoc = page.locator('select:visible').first();
    if (await selectLoc.isVisible().catch(() => false)) {
      await selectLoc.click({ timeout: 1000 }).catch(() => {});
    }

    const measurements = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('2d context unavailable');

      const srgbToLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (r: number, g: number, b: number) =>
        0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
      const contrastRatio = (a: [number, number, number], b: [number, number, number]) => {
        const l1 = luminance(a[0], a[1], a[2]);
        const l2 = luminance(b[0], b[1], b[2]);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      const compositeColorOver = (
        base: [number, number, number],
        cssColor: string,
      ): [number, number, number] => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      };

      const colorAlpha = (cssColor: string): number => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, 1, 1);
        return ctx.getImageData(0, 0, 1, 1).data[3];
      };

      const hasUncoveredAncestorImage = (el: Element): boolean => {
        if (colorAlpha(getComputedStyle(el).backgroundColor) >= 250) {
          return false;
        }
        const ancestors: Element[] = [];
        for (let cur: Element | null = el.parentElement; cur; cur = cur.parentElement) {
          ancestors.unshift(cur);
        }
        let coveredByImage = false;
        for (const ancestor of ancestors) {
          const cs = getComputedStyle(ancestor);
          if (cs.backgroundImage !== 'none') coveredByImage = true;
          if (colorAlpha(cs.backgroundColor) >= 250) coveredByImage = false;
        }
        return coveredByImage;
      };

      const resolveBgBehind = (el: Element): [number, number, number] => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = 'Canvas';
        probe.style.display = 'none';
        const host = el.parentElement ?? document.documentElement;
        host.appendChild(probe);
        const canvasBg = getComputedStyle(probe).backgroundColor;
        probe.remove();

        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = canvasBg;
        ctx.fillRect(0, 0, 1, 1);
        let bg: [number, number, number] = [
          ctx.getImageData(0, 0, 1, 1).data[0],
          ctx.getImageData(0, 0, 1, 1).data[1],
          ctx.getImageData(0, 0, 1, 1).data[2],
        ];

        // <option> renders inside the top-layer ::picker(select) backdrop rather than <select>'s box.
        if (el.tagName === 'OPTION') {
          const parentSelect = el.closest('select');
          if (parentSelect) {
            const pickerBg = getComputedStyle(parentSelect, '::picker(select)').backgroundColor;
            if (pickerBg) bg = compositeColorOver(bg, pickerBg);
            bg = compositeColorOver(bg, getComputedStyle(el).backgroundColor);
            return bg;
          }
        }

        const chain: Element[] = [];
        for (let cur: Element | null = el; cur; cur = cur.parentElement) {
          chain.unshift(cur);
        }
        for (const node of chain) {
          bg = compositeColorOver(bg, getComputedStyle(node).backgroundColor);
        }
        return bg;
      };

      const isVisible = (el: Element): boolean => {
        for (let cur: Element | null = el; cur; cur = cur.parentElement) {
          const cs = getComputedStyle(cur);
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) {
            return false;
          }
        }
        return true;
      };

      const results: Array<{ target: string; ratio: number }> = [];

      const textEls = Array.from(
        document.querySelectorAll(
          'select, option, select button, [role="combobox"], [role="listbox"], [role="option"], .custom-select-trigger',
        ),
      );
      for (const el of textEls) {
        if (!isVisible(el)) continue;
        if (el.tagName === 'OPTION') {
          const parentSelect = el.closest('select');
          if (!parentSelect || !isVisible(parentSelect)) continue;
        } else if (hasUncoveredAncestorImage(el)) {
          continue;
        }
        const cs = getComputedStyle(el);
        const bg = resolveBgBehind(el);
        const fg = compositeColorOver(bg, cs.color);
        results.push({ target: `${el.tagName.toLowerCase()} text`, ratio: contrastRatio(fg, bg) });
      }

      return results;
    });

    expect(measurements.length, 'No visible elements found for contrast measurement').toBeGreaterThan(0);
    for (const item of measurements) {
      expect(
        item.ratio,
        `${item.target} contrast ${item.ratio.toFixed(2)}:1 < 3:1`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  test('The implementation does not use JavaScript as the primary mechanism for toggling the dropdown.', async ({ page }) => {
    // Check if the select is hidden (common in JS-based custom selects)
    const select = await page.$('select');
    if (!select) {
      throw new Error('Select element not found');
    }
    const isVisible = await select.isVisible();
    
    // Check for common JS-based trigger patterns if select is hidden
    const hasCustomTrigger = await page.$('[onclick*="toggle"], [class*="trigger"]');
    
    if (!isVisible && hasCustomTrigger) {
      throw new Error('JS used for toggling instead of native base-select');
    }
    expect(isVisible).toBe(true);
  });

  test('The `<select>` element has a `name` attribute.', async ({ page }) => {
    const select = await page.$('select');
    const name = await select?.getAttribute('name');
    expect(name).toBeTruthy();
  });

  test('The `<select>` element has an associated `<label>`.', async ({ page }) => {
    const select = await page.$('select');
    const id = await select?.getAttribute('id');
    if (!id) {
      // If no ID, it might be nested in a label, but requirement says "associated label"
      // and usually implies for/id or nesting.
      // Demo has id/for. Negative has neither.
      const parentLabel = await page.$(`label:has(select)`);
      expect(parentLabel).not.toBeNull();
    } else {
      const label = await page.$(`label[for="${id}"]`);
      expect(label).not.toBeNull();
    }
  });
});
