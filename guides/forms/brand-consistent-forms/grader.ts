import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html');
const fileUrl = `file://${targetFile}`;

test.describe('Brand-Consistent Forms Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(fileUrl);
  });

  test('The implementation uses the `accent-color` CSS property to apply a custom color to form controls.', async ({ page }) => {
    const accentColor = await page.evaluate(() => {
      // Find any input, progress, or the body/root and see if accent-color is customized (not auto)
      const elTypes = ['body', 'input[type="checkbox"]', 'input[type="radio"]', 'input[type="range"]', 'progress'];
      for (const selector of elTypes) {
        const el = document.querySelector(selector);
        if (el) {
          const comp = window.getComputedStyle(el).accentColor;
          if (comp && comp !== 'auto' && comp !== 'normal') {
            return comp;
          }
        }
      }
      return 'auto';
    });
    expect(accentColor).not.toEqual('auto');
    expect(accentColor).not.toEqual('normal');
  });

  test('The value for `accent-color` has a contrast of at least `3:1` with the background color.', async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
    });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const results = await page.evaluate(() => {
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

        const resolveEffectiveBg = (el: Element): [number, number, number] => {
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

          const chain: Element[] = [];
          for (let cur: Element | null = el; cur; cur = cur.parentElement) {
            chain.unshift(cur);
          }
          for (const node of chain) {
            ctx.fillStyle = getComputedStyle(node).backgroundColor;
            ctx.fillRect(0, 0, 1, 1);
          }
          const data = ctx.getImageData(0, 0, 1, 1).data;
          return [data[0], data[1], data[2]];
        };

        const controls = Array.from(
          document.querySelectorAll('input[type="checkbox"], input[type="radio"], input[type="range"], progress'),
        );
        const measured: Array<{ tag: string; accentColor: string; ratio: number }> = [];
        for (const el of controls) {
          const accent = getComputedStyle(el).accentColor;
          if (!accent || accent === 'auto' || accent === 'normal') continue;
          const bg = resolveEffectiveBg(el);
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
          ctx.fillRect(0, 0, 1, 1);
          ctx.fillStyle = accent;
          ctx.fillRect(0, 0, 1, 1);
          const fgData = ctx.getImageData(0, 0, 1, 1).data;
          const ratio = contrastRatio([fgData[0], fgData[1], fgData[2]], bg);
          measured.push({ tag: el.tagName.toLowerCase(), accentColor: accent, ratio });
        }
        return measured;
      });

      expect(results.length, `No controls with explicit accent-color found in ${colorScheme} mode`).toBeGreaterThan(0);
      for (const item of results) {
        expect(
          item.ratio,
          `${colorScheme} mode ${item.tag} accent-color (${item.accentColor}) contrast ${item.ratio.toFixed(2)}:1 < 3:1`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('The implementation targets at least one of the following elements with `accent-color`: checkbox, radio, range, or progress.', async ({ page }) => {
    const targeted = await page.evaluate(() => {
      const elTypes = ['input[type="checkbox"]', 'input[type="radio"]', 'input[type="range"]', 'progress'];
      for (const selector of elTypes) {
        const el = document.querySelector(selector);
        if (el) {
          const comp = window.getComputedStyle(el).accentColor;
          if (comp && comp !== 'auto' && comp !== 'normal') {
            return true;
          }
        }
      }
      return false;
    });
    expect(targeted).toBe(true);
  });

  test('The implementation uses `color-scheme: light dark` (in CSS or meta tag) to enable appropriate default styling for forms in dark mode.', async ({ page }) => {
    const colorSchemeValid = await page.evaluate(() => {
      const htmlCS = window.getComputedStyle(document.documentElement).colorScheme;
      const bodyCS = window.getComputedStyle(document.body).colorScheme;
      if (htmlCS.includes('light') && htmlCS.includes('dark')) return true;
      if (bodyCS.includes('light') && bodyCS.includes('dark')) return true;

      // Grader resilience: also check if a form or any parent element of the form has color-scheme light dark defined
      const form = document.querySelector('form');
      if (form) {
        const formCS = window.getComputedStyle(form).colorScheme;
        if (formCS.includes('light') && formCS.includes('dark')) return true;
        
        let parent = form.parentElement;
        while (parent) {
          const parentCS = window.getComputedStyle(parent).colorScheme;
          if (parentCS.includes('light') && parentCS.includes('dark')) return true;
          parent = parent.parentElement;
        }
      }

      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        const content = meta.getAttribute('content') || '';
        if (content.includes('light') && content.includes('dark')) {
          return true;
        }
      }
      return false;
    });
    expect(colorSchemeValid).toBe(true);
  });

  test('The implementation updates the `accent-color` value for dark mode using a `prefers-color-scheme` media query.', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const lightColor = await page.evaluate(() => {
      const el = document.querySelector('input[type="checkbox"]') || document.body;
      return window.getComputedStyle(el).accentColor;
    });

    await page.emulateMedia({ colorScheme: 'dark' });
    const darkColor = await page.evaluate(() => {
      const el = document.querySelector('input[type="checkbox"]') || document.body;
      return window.getComputedStyle(el).accentColor;
    });

    expect(lightColor).not.toEqual('auto');
    expect(darkColor).not.toEqual('auto');
    expect(lightColor).not.toEqual(darkColor);
  });

  test('The implementation provides a fallback for browsers that do not support `accent-color` using the `@supports not` rule.', async ({ page }) => {
    const hasSupportsNot = await page.evaluate(async () => {
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule instanceof CSSSupportsRule) {
              const cond = rule.conditionText.toLowerCase();
              if (cond.includes('not') && cond.includes('accent-color')) {
                return true;
              }
            }
          }
        } catch (e) {}
      }
      const linkedTexts = await Promise.all(
        Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => {
          const href = (link as HTMLLinkElement).href;
          return href ? fetch(href).then((r) => (r.ok ? r.text() : '')).catch(() => '') : '';
        })
      );
      const styles = [...Array.from(document.querySelectorAll('style')).map((s) => s.innerHTML), ...linkedTexts];
      for (const raw of styles) {
        const text = raw.toLowerCase();
        if (text.includes('@supports') && text.includes('not') && text.includes('accent-color')) {
          return true;
        }
      }
      return false;
    });
    expect(hasSupportsNot).toBe(true);
  });

  test('The fallback implementation styles checkboxes and radio buttons to match the brand color.', async ({ page }) => {
    const stylesMatchBrandColor = await page.evaluate(async () => {
      const extractSupportsNotBlocks = (css: string): string => {
        const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
        const lower = clean.toLowerCase();
        const chunks: string[] = [];
        let idx = 0;
        while ((idx = lower.indexOf('@supports', idx)) !== -1) {
          const brace = clean.indexOf('{', idx);
          if (brace === -1) break;
          const cond = lower.slice(idx, brace);
          let depth = 1;
          let pos = brace + 1;
          while (pos < clean.length && depth > 0) {
            if (clean[pos] === '{') depth++;
            else if (clean[pos] === '}') depth--;
            pos++;
          }
          if (cond.includes('not') && cond.includes('accent-color')) {
            chunks.push(clean.slice(brace + 1, pos - 1));
          }
          idx = pos;
        }
        return chunks.join('\n');
      };

      let hasCheckboxCheckedStyle = false;
      let hasRadioCheckedStyle = false;

      const checkRule = (selectorRaw: string, bodyRaw: string) => {
        const sel = selectorRaw.toLowerCase();
        const body = bodyRaw.toLowerCase();
        if (!sel.includes(':checked')) return;
        const hasColorStyling = /(background|background-color|border|border-color|color|fill)\s*:\s*[^;]*(var\(|#[0-9a-f]{3,8}|rgb|hsl|oklch|oklab|light-dark|[a-z]+)/i.test(body);
        if (!hasColorStyling) return;

        const targetsCheckbox = sel.includes('checkbox');
        const targetsRadio = sel.includes('radio');
        const targetsGenericInput = /\binput\b[^{,]*:checked/.test(sel) && !sel.includes('type=');
        if (targetsCheckbox || targetsGenericInput) hasCheckboxCheckedStyle = true;
        if (targetsRadio || targetsGenericInput) hasRadioCheckedStyle = true;
      };

      const walkRules = (rules: CSSRuleList) => {
        for (let k = 0; k < rules.length; k++) {
          const innerRule = rules[k];
          if (innerRule instanceof CSSStyleRule) {
            for (const part of innerRule.selectorText.split(',')) {
              checkRule(part, innerRule.style.cssText);
            }
          } else if ('cssRules' in innerRule && (innerRule as CSSGroupingRule).cssRules) {
            walkRules((innerRule as CSSGroupingRule).cssRules);
          }
        }
      };

      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule instanceof CSSSupportsRule) {
              const cond = rule.conditionText.toLowerCase();
              if (cond.includes('not') && cond.includes('accent-color')) {
                walkRules(rule.cssRules);
              }
            }
          }
        } catch (e) {}
      }

      if (hasCheckboxCheckedStyle && hasRadioCheckedStyle) return true;

      const linkedTexts = await Promise.all(
        Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => {
          const href = (link as HTMLLinkElement).href;
          return href ? fetch(href).then((r) => (r.ok ? r.text() : '')).catch(() => '') : '';
        })
      );
      const styleTexts = [...Array.from(document.querySelectorAll('style')).map((s) => s.innerHTML), ...linkedTexts];
      for (const raw of styleTexts) {
        const block = extractSupportsNotBlocks(raw);
        if (!block) continue;
        const ruleMatches = block.matchAll(/([^{}]+)\{([^{}]+)\}/g);
        for (const match of ruleMatches) {
          for (const part of match[1].split(',')) {
            checkRule(part, match[2]);
          }
        }
      }
      return hasCheckboxCheckedStyle && hasRadioCheckedStyle;
    });
    expect(stylesMatchBrandColor).toBe(true);
  });

  test('Visually hidden inputs in the fallback use the canonical accessible utility pattern (`clip-path: inset(50%)`, `width: 1px`, `height: 1px`).', async ({ page }) => {
    const hasAccessibleFallbackInputs = await page.evaluate(async () => {
      let hasSupportsNot = false;
      let hasVisuallyHiddenPattern = false;
      let hidesInputInaccessibly = false;

      const walkRules = (rules: CSSRuleList) => {
        for (let k = 0; k < rules.length; k++) {
          const innerRule = rules[k];
          if (innerRule instanceof CSSStyleRule) {
            const sel = innerRule.selectorText.toLowerCase();
            const cssText = innerRule.cssText.replace(/\s+/g, '').toLowerCase();
            if (
              cssText.includes('clip-path:inset(50%)') &&
              cssText.includes('width:1px') &&
              cssText.includes('height:1px')
            ) {
              hasVisuallyHiddenPattern = true;
            }
            const targetsInputItself = sel.split(',').some((s) => /input[^\s>+~]*$/.test(s.trim()) && !s.includes('::'));
            if (targetsInputItself && /display:none|visibility:hidden|opacity:0(\.0*)?(;|!|$)/.test(cssText)) {
              hidesInputInaccessibly = true;
            }
          } else if ('cssRules' in innerRule && (innerRule as CSSGroupingRule).cssRules) {
            walkRules((innerRule as CSSGroupingRule).cssRules);
          }
        }
      };

      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule instanceof CSSSupportsRule) {
              const cond = rule.conditionText.toLowerCase();
              if (cond.includes('not') && cond.includes('accent-color')) {
                hasSupportsNot = true;
                walkRules(rule.cssRules);
              }
            }
          }
        } catch (e) {}
      }

      const linkedTexts = await Promise.all(
        Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => {
          const href = (link as HTMLLinkElement).href;
          return href ? fetch(href).then((r) => (r.ok ? r.text() : '')).catch(() => '') : '';
        })
      );
      const styleTexts = [...Array.from(document.querySelectorAll('style')).map((s) => s.innerHTML), ...linkedTexts];
      for (const raw of styleTexts) {
        const compact = raw.replace(/\s+/g, '').toLowerCase();
        if (compact.includes('@supports') && compact.includes('not') && compact.includes('accent-color')) {
          hasSupportsNot = true;
          if (
            compact.includes('clip-path:inset(50%)') &&
            compact.includes('width:1px') &&
            compact.includes('height:1px')
          ) {
            hasVisuallyHiddenPattern = true;
          }
        }
      }
      if (!hasSupportsNot || hidesInputInaccessibly) return false;
      return hasVisuallyHiddenPattern;
    });
    expect(hasAccessibleFallbackInputs).toBe(true);
  });

  test('Custom fallback controls explicitly style the `:focus-visible` state to preserve focus indication for keyboard users.', async ({ page }) => {
    const hasFocusVisibleFallback = await page.evaluate(async () => {
      let hasSupportsNot = false;
      let hasFocusVisible = false;

      const walkRules = (rules: CSSRuleList) => {
        for (let k = 0; k < rules.length; k++) {
          const innerRule = rules[k];
          if (innerRule instanceof CSSStyleRule && innerRule.selectorText.includes(':focus-visible')) {
            hasFocusVisible = true;
          } else if ('cssRules' in innerRule && (innerRule as CSSGroupingRule).cssRules) {
            walkRules((innerRule as CSSGroupingRule).cssRules);
          }
        }
      };

      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule instanceof CSSSupportsRule) {
              const cond = rule.conditionText.toLowerCase();
              if (cond.includes('not') && cond.includes('accent-color')) {
                hasSupportsNot = true;
                walkRules(rule.cssRules);
              }
            } else if (rule instanceof CSSStyleRule) {
              if (rule.selectorText.includes(':focus-visible') && rule.selectorText.toLowerCase().includes('input')) {
                hasFocusVisible = true;
              }
            }
          }
        } catch (e) {}
      }

      const linkedTexts = await Promise.all(
        Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => {
          const href = (link as HTMLLinkElement).href;
          return href ? fetch(href).then((r) => (r.ok ? r.text() : '')).catch(() => '') : '';
        })
      );
      const styleTexts = [...Array.from(document.querySelectorAll('style')).map((s) => s.innerHTML), ...linkedTexts];
      for (const raw of styleTexts) {
        const text = raw.toLowerCase();
        if (text.includes('@supports') && text.includes('not') && text.includes('accent-color')) {
          hasSupportsNot = true;
        }
        if (text.includes(':focus-visible') && text.includes('input')) {
          hasFocusVisible = true;
        }
      }
      return hasSupportsNot && hasFocusVisible;
    });
    expect(hasFocusVisibleFallback).toBe(true);
  });

  test('The fallback implementation for range sliders uses vendor prefixes to style the thumb and track, and simulates progress.', async ({ page }) => {
    const hasRangeSliderFallback = await page.evaluate(async () => {
      const linkedTexts = await Promise.all(
        Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => {
          const href = (link as HTMLLinkElement).href;
          return href ? fetch(href).then((r) => (r.ok ? r.text() : '')).catch(() => '') : '';
        })
      );
      const styleTexts = [...Array.from(document.querySelectorAll('style')).map((s) => s.innerHTML), ...linkedTexts];
      let hasSupportsNot = false;
      let hasWebkitTrack = false;
      let hasWebkitThumb = false;
      let hasMozTrack = false;
      let hasMozThumb = false;
      let hasProgressSimulation = false;

      for (const raw of styleTexts) {
        const text = raw.toLowerCase();
        if (text.includes('@supports') && text.includes('not') && text.includes('accent-color')) {
          hasSupportsNot = true;
        }
        if (text.includes('webkit-slider-runnable-track')) {
          hasWebkitTrack = true;
          if (/::-webkit-slider-runnable-track\s*\{[^}]*linear-gradient/i.test(raw)) {
            hasProgressSimulation = true;
          }
        }
        if (text.includes('webkit-slider-thumb')) hasWebkitThumb = true;
        if (text.includes('moz-range-track')) hasMozTrack = true;
        if (text.includes('moz-range-thumb')) hasMozThumb = true;
        if (text.includes('moz-range-progress')) hasProgressSimulation = true;
      }

      return hasSupportsNot && hasWebkitTrack && hasWebkitThumb && hasMozTrack && hasMozThumb && hasProgressSimulation;
    });
    expect(hasRangeSliderFallback).toBe(true);
  });

  test('The fallback implementation for progress bars uses vendor prefixes to style the progress value.', async ({ page }) => {
    const hasProgressBarFallback = await page.evaluate(async () => {
      const linkedTexts = await Promise.all(
        Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => {
          const href = (link as HTMLLinkElement).href;
          return href ? fetch(href).then((r) => (r.ok ? r.text() : '')).catch(() => '') : '';
        })
      );
      const styleTexts = [...Array.from(document.querySelectorAll('style')).map((s) => s.innerHTML), ...linkedTexts];
      let hasSupportsNot = false;
      let hasWebkitBar = false;
      let hasWebkitValue = false;
      let hasMozBar = false;

      for (const raw of styleTexts) {
        const text = raw.toLowerCase();
        if (text.includes('@supports') && text.includes('not') && text.includes('accent-color')) {
          hasSupportsNot = true;
        }
        if (text.includes('webkit-progress-bar')) hasWebkitBar = true;
        if (text.includes('webkit-progress-value')) hasWebkitValue = true;
        if (text.includes('moz-progress-bar')) hasMozBar = true;
      }

      return hasSupportsNot && hasWebkitBar && hasWebkitValue && hasMozBar;
    });
    expect(hasProgressBarFallback).toBe(true);
  });

  test('Every `<input>` control has an explicit `id` attribute, and its associated `<label>` explicitly sets the `for` attribute matching the input id.', async ({ page }) => {
    const inputsValid = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;

      for (const input of inputs) {
        const id = input.getAttribute('id');
        if (!id) return false;

        const label = document.querySelector(`label[for="${id}"]`);
        if (!label) return false;
      }
      return true;
    });
    expect(inputsValid).toBe(true);
  });
});
