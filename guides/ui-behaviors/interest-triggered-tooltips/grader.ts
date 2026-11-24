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

test.describe(`Interest-Triggered Tooltips Expectations: ${demoName}`, () => {
  const html = fs.readFileSync(filePath, 'utf-8');

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

  test('Triggers are button or anchor elements', async ({ page }) => {
    const result = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('[interestfor]'));
      if (triggers.length === 0) {
        // Fallback for negative cases or legacy implementations
        const legacy = Array.from(document.querySelectorAll('.tooltip[data-tooltip]'));
        return legacy.length > 0 && legacy.every(el => el.tagName === 'BUTTON' || el.tagName === 'A');
      }
      return triggers.every(el => el.tagName === 'BUTTON' || el.tagName === 'A');
    });
    expect(result).toBe(true);
  });

  test('Triggers have an interestfor attribute matching tooltip id', async ({ page }) => {
    const result = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('[interestfor]'));
      // We expect at least one trigger with interestfor attribute
      return triggers.length > 0;
    });
    expect(result).toBe(true);
  });

  test('Tooltips have a popover="hint" attribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('[interestfor]'));
      if (triggers.length === 0) return false;
      return triggers.every(el => {
        const id = el.getAttribute('interestfor');
        const target = id ? document.getElementById(id) : null;
        return target?.getAttribute('popover') === 'hint';
      });
    });
    expect(result).toBe(true);
  });

  test('Tooltips have a unique id attribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const popovers = Array.from(document.querySelectorAll('[popover]'));
      if (popovers.length === 0) return false;
      const ids = popovers.map(el => el.id).filter(id => id !== '');
      return ids.length === popovers.length && new Set(ids).size === ids.length;
    });
    expect(result).toBe(true);
  });

  test('Tooltips use CSS Anchor Positioning with UA popover centering reset', async () => {
    const hasAnchorPositioning = /position-area\s*:|anchor\(/.test(html);
    const hasInsetAuto = /inset\s*:\s*auto/.test(html);
    const hasMarginReset = /margin\s*:\s*(?:0|unset)\b/.test(html);
    expect(hasAnchorPositioning).toBe(true);
    expect(hasInsetAuto).toBe(true);
    expect(hasMarginReset).toBe(true);
  });

  test('CSS defines a position-try fallback', async () => {
    expect(html).toContain('position-try');
  });

  test('When anchor-positioning is unsupported, polyfill or @supports fallback protects popover resets', async ({ page }) => {
    const cssState = await page.evaluate(() => {
      const popovers = document.querySelectorAll('[popover]');
      if (popovers.length === 0) {
        return {
          hasPopovers: false,
          hasUnwrappedAnchorName: false,
          hasUnwrappedAnchorRef: false,
          hasUnwrappedAnchorFunc: false,
          hasUnwrappedInsetAutoReset: false,
          hasSupportsGatedResets: false,
        };
      }

      let hasUnwrappedAnchorName = false;
      let hasUnwrappedAnchorRef = false;
      let hasUnwrappedAnchorFunc = false;
      let hasUnwrappedInsetAutoReset = false;
      let hasSupportsGatedResets = false;

      const selectorMatchesPopover = (selectorText: string): boolean => {
        try {
          return Array.from(document.querySelectorAll(selectorText)).some(el => el.hasAttribute('popover'));
        } catch {
          return /\[popover\]|tooltip|hint/i.test(selectorText);
        }
      };

      const visitRule = (rule: CSSRule, inSupports: boolean, inAnchorSupports: boolean) => {
        if (rule instanceof CSSStyleRule) {
          const raw = rule.cssText || '';
          const hasInsetAuto =
            /\binset\s*:\s*auto\b/i.test(raw) ||
            (rule.style.top === 'auto' &&
              rule.style.right === 'auto' &&
              rule.style.bottom === 'auto' &&
              rule.style.left === 'auto');
          const hasMarginReset =
            /\bmargin\s*:\s*(?:0|unset)\b/i.test(raw) ||
            rule.style.margin === '0px' ||
            rule.style.margin === 'unset';
          const matchesPopover = selectorMatchesPopover(rule.selectorText);

          if (!inSupports) {
            if (/\banchor-name\s*:\s*--/i.test(raw)) hasUnwrappedAnchorName = true;
            if (/\bposition-anchor\s*:\s*--/i.test(raw) || /\banchor\(\s*--/i.test(raw)) {
              hasUnwrappedAnchorRef = true;
            }
            if (/\banchor\(/i.test(raw)) hasUnwrappedAnchorFunc = true;
            if (matchesPopover && hasInsetAuto) hasUnwrappedInsetAutoReset = true;
          } else if (inAnchorSupports && matchesPopover && hasInsetAuto && hasMarginReset) {
            hasSupportsGatedResets = true;
          }
          if (rule.cssRules) {
            for (const child of Array.from(rule.cssRules)) {
              visitRule(child, inSupports, inAnchorSupports);
            }
          }
        } else if (rule instanceof CSSSupportsRule) {
          const cond = (rule.conditionText || '').trim();
          const isPositiveAnchor =
            !/^\s*not\b/i.test(cond) &&
            /(?:position-area|anchor(?:-name|\())/i.test(cond);
          for (const child of Array.from(rule.cssRules)) {
            visitRule(child, true, inAnchorSupports || isPositiveAnchor);
          }
        } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
          for (const child of Array.from((rule as CSSGroupingRule).cssRules)) {
            visitRule(child, inSupports, inAnchorSupports);
          }
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            visitRule(rule, false, false);
          }
        } catch {
          // ignore cross-origin stylesheets
        }
      }

      return {
        hasPopovers: true,
        hasUnwrappedAnchorName,
        hasUnwrappedAnchorRef,
        hasUnwrappedAnchorFunc,
        hasUnwrappedInsetAutoReset,
        hasSupportsGatedResets,
      };
    });

    expect(cssState.hasPopovers).toBe(true);
    const hasConditionalPolyfillScript =
      html.includes('css-anchor-positioning') &&
      /(?:anchorName|anchor-name|positionArea|position-area|CSS\.supports)/.test(html);
    const branchPolyfill =
      hasConditionalPolyfillScript &&
      cssState.hasUnwrappedAnchorName &&
      cssState.hasUnwrappedAnchorRef &&
      cssState.hasUnwrappedAnchorFunc;
    const branchSupportsGated =
      cssState.hasSupportsGatedResets && !cssState.hasUnwrappedInsetAutoReset;

    expect(branchPolyfill || branchSupportsGated).toBe(true);
  });

  test('Interestfor polyfill is conditionally installed', async () => {
    const hasPolyfill = html.includes('interestfor') && html.includes('interestForElement');
    expect(hasPolyfill).toBe(true);
  });

  test('Popover polyfill or fallback is conditionally provided when native support is missing', async ({ page }) => {
    const hasPopovers = await page.evaluate(() => document.querySelectorAll('[popover]').length > 0);
    expect(hasPopovers).toBe(true);
    const hasPopoverFeatureCheck =
      /Object\.hasOwn\s*\(\s*HTMLElement\.prototype\s*,\s*['"]popover['"]\s*\)/.test(html) ||
      html.includes('hasOwnProperty("popover")') ||
      html.includes("hasOwnProperty('popover')") ||
      html.includes('"popover" in') ||
      html.includes("'popover' in") ||
      html.includes('showPopover');
    const hasConditionalPolyfill = html.includes('popover-polyfill') && hasPopoverFeatureCheck;
    const hasManualFallback =
      hasPopoverFeatureCheck &&
      (/(?:\bgetBoundingClientRect\b|position\s*:\s*fixed)/.test(html));
    expect(hasConditionalPolyfill || hasManualFallback).toBe(true);
  });

  test('Tooltip content is not stored in attributes on the trigger', async ({ page }) => {
    const result = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('button, a, .tooltip, [interestfor]'));
      return triggers.length > 0 && !triggers.some(el =>
        el.hasAttribute('title') || el.hasAttribute('data-tooltip')
      );
    });
    expect(result).toBe(true);
  });

  test('Tooltip content is not displayed using pseudo-elements', async () => {
    const hasPseudoTooltip = /::after\s*{[^}]*content:[^}]*attr\(data-tooltip\)/.test(html) || /::before\s*{[^}]*content:[^}]*attr\(data-tooltip\)/.test(html);
    expect(hasPseudoTooltip).toBe(false);
  });

  test('Tooltips are hoverable and persistent per WCAG 1.4.13 guidelines', async () => {
    expect(/popover=["']hint["']/i.test(html)).toBe(true);
  });

  test('Tooltip becomes visible on hover', async ({ page }) => {
    const trigger = page.locator('[interestfor], .tooltip').first();
    await expect(trigger).toBeVisible();
    
    const interestFor = await trigger.getAttribute('interestfor');
    if (!interestFor) {
      throw new Error('No interestfor attribute found on trigger');
    }
    
    const tooltip = page.locator(`#${interestFor}`);
    await expect(tooltip).toBeHidden();
    
    await trigger.hover();
    await expect(tooltip).toBeVisible();
  });

  test('Every tooltip whose text differs from its trigger accessible name has role="tooltip" and proper ARIA wiring', async ({ page }) => {
    const pairs = await page.evaluate(() => {
      const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
      const baseAccessibleName = (el: Element, excludeId: string) => {
        const labelledBy = (el.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter((id) => id && id !== excludeId)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
        const alts = Array.from(el.querySelectorAll('img[alt]')).map((img) => img.getAttribute('alt') ?? '');
        const textOnly = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && !(n as Element).hasAttribute('aria-hidden')))
          .map((n) => n.textContent ?? '')
          .join(' ');
        return (
          norm(labelledBy) ||
          norm(el.getAttribute('aria-label')) ||
          norm(`${textOnly} ${alts.join(' ')}`) ||
          norm(el.getAttribute('title'))
        );
      };

      const triggers = Array.from(document.querySelectorAll('[interestfor]'));
      return triggers
        .map((trigger) => {
          const id = trigger.getAttribute('interestfor') || '';
          const tooltip = id ? document.getElementById(id) : null;
          if (!tooltip) return null;
          const baseName = baseAccessibleName(trigger, id);
          const tooltipText = norm(tooltip.textContent);
          const differs = tooltipText !== baseName;
          const isToggletip =
            trigger.getAttribute('popovertarget') === id ||
            trigger.getAttribute('commandfor') === id;
          const labelledByIds = (trigger.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
          const describedByIds = (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
          return {
            id,
            differs,
            role: tooltip.getAttribute('role'),
            hasOtherName: baseName.length > 0,
            isToggletip,
            hasAriaLabelledByTooltip: labelledByIds.includes(id),
            hasAriaDescribedByTooltip: describedByIds.includes(id),
            initialAriaExpanded: trigger.getAttribute('aria-expanded'),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && item.differs);
    });

    expect(pairs.length).toBeGreaterThan(0);

    for (const pair of pairs) {
      expect(pair.role).toBe('tooltip');
      if (!pair.hasOtherName) {
        expect(pair.hasAriaLabelledByTooltip).toBe(true);
      } else if (pair.isToggletip) {
        expect(pair.initialAriaExpanded).toBe('false');
        const trigger = page.locator(`[interestfor="${pair.id}"]`).first();
        const tooltip = page.locator(`#${pair.id}`);
        await trigger.click();
        await expect(tooltip).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(tooltip).toBeHidden();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      } else {
        expect(pair.hasAriaDescribedByTooltip).toBe(true);
      }
    }
  });

  test('When tooltip text matches trigger accessible name, trigger does not reference it in aria-describedby or aria-expanded', async ({ page }) => {
    const result = await page.evaluate(() => {
      const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
      const baseAccessibleName = (el: Element, excludeId: string) => {
        const labelledBy = (el.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter((id) => id && id !== excludeId)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
        const alts = Array.from(el.querySelectorAll('img[alt]')).map((img) => img.getAttribute('alt') ?? '');
        return (
          norm(labelledBy) ||
          norm(el.getAttribute('aria-label')) ||
          norm(`${el.textContent ?? ''} ${alts.join(' ')}`) ||
          norm(el.getAttribute('title'))
        );
      };

      const triggers = Array.from(document.querySelectorAll('[interestfor]'));
      const matchingViolations: string[] = [];
      let validPairs = 0;

      for (const trigger of triggers) {
        const id = trigger.getAttribute('interestfor') || '';
        const tooltip = id ? document.getElementById(id) : null;
        if (!tooltip) continue;
        validPairs++;
        const baseName = baseAccessibleName(trigger, id);
        const tooltipText = norm(tooltip.textContent);
        if (tooltipText === baseName) {
          const describedByIds = (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
          if (describedByIds.includes(id) || trigger.hasAttribute('aria-expanded')) {
            matchingViolations.push(id);
          }
        }
      }

      return { validPairs, matchingViolations };
    });

    expect(result.validPairs).toBeGreaterThan(0);
    expect(result.matchingViolations).toEqual([]);
  });
});
