/// <reference types="node" />
import { test, expect } from '@playwright/test';
import * as path from 'path';
import process from 'process';

const targetUrl = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');

test.describe('Position-Aware Tooltips Grader', () => {

  test('uses Popover API with popovertarget and the popover attribute', async ({ page }) => {
    await page.goto(targetUrl);
    const hasPopoverAttrs = await page.evaluate(() => {
      const trigger = document.querySelector('[popovertarget]');
      if (!trigger) return false;
      const targetId = trigger.getAttribute('popovertarget');
      if (!targetId) return false;
      const popover = document.getElementById(targetId);
      if (!popover) return false;
      return popover.hasAttribute('popover');
    });
    expect(hasPopoverAttrs).toBe(true);
  });

  test('sets role="tooltip" on popover and aria-describedby on trigger pointing to popover ID', async ({ page }) => {
    await page.goto(targetUrl);
    const isValid = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('[aria-describedby]'));
      return triggers.some((trigger) => {
        const ids = (trigger.getAttribute('aria-describedby') || '').trim().split(/\s+/).filter(Boolean);
        return ids.some((id) => document.getElementById(id)?.getAttribute('role') === 'tooltip');
      });
    });
    expect(isValid).toBe(true);
  });

  test('conditionally polyfills the Popover API', async ({ page }) => {
    await page.addInitScript(() => {
      // Delete popover from HTMLElement prototype to trigger polyfill branch
      delete (HTMLElement.prototype as any).popover;
      delete (HTMLElement.prototype as any).showPopover;
      delete (HTMLElement.prototype as any).hidePopover;
      delete (HTMLElement.prototype as any).togglePopover;
    });
    await page.goto(targetUrl);
    // Wait for potential dynamic import and execution of polyfill
    await page.waitForFunction(() => {
      return HTMLElement.prototype.hasOwnProperty('popover') || 'showPopover' in HTMLElement.prototype;
    });
    const isPolyfilled = await page.evaluate(() => {
      return HTMLElement.prototype.hasOwnProperty('popover') || 'showPopover' in HTMLElement.prototype;
    });
    expect(isPolyfilled).toBe(true);
  });

  test('uses position-area to define default placement', async ({ page }) => {
    await page.goto(targetUrl);
    const positionArea = await page.evaluate(() => {
      const popover = document.querySelector('[popover]');
      if (!popover) return '';
      const style = window.getComputedStyle(popover) as any;
      return style.positionArea || style.getPropertyValue('position-area') || '';
    });
    expect(positionArea).toMatch(/^(block-start|block-end|inline-start|inline-end|top|bottom|left|right|center)/);
  });

  test('defines fallback positions using position-try-fallbacks', async ({ page }) => {
    await page.goto(targetUrl);
    const fallbacks = await page.evaluate(() => {
      const popover = document.querySelector('[popover]');
      if (!popover) return '';
      const style = window.getComputedStyle(popover) as any;
      return style.positionTryFallbacks || style.getPropertyValue('position-try-fallbacks') || style.positionTry || style.getPropertyValue('position-try') || '';
    });
    expect(fallbacks).not.toBe('');
  });

  test('sets container-type: anchored on the tooltip element', async ({ page }) => {
    await page.goto(targetUrl);
    const containerType = await page.evaluate(() => {
      const popover = document.querySelector('[popover]');
      if (!popover) return '';
      const style = window.getComputedStyle(popover);
      return style.containerType || style.getPropertyValue('container-type') || '';
    });
    expect(containerType).toBe('anchored');
  });

  test('uses @container anchored with fallback to update styles', async ({ page }) => {
    await page.goto(targetUrl);
    const hasContainerRule = await page.evaluate(() => {
      let found = false;
      function processRules(rules: CSSRuleList) {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          // Check for container rule or custom CSS rule type 17
          if (rule instanceof CSSContainerRule || rule.type === 17) {
            const containerRule = rule as any;
            if (containerRule.conditionText.includes('anchored') && containerRule.conditionText.includes('fallback')) {
              found = true;
            }
          } else if ((rule as any).cssRules) {
            processRules((rule as any).cssRules);
          }
        }
      }
      for (let j = 0; j < document.styleSheets.length; j++) {
        try {
          const sheet = document.styleSheets[j];
          if (sheet.cssRules) processRules(sheet.cssRules);
        } catch (e) {}
      }
      return found;
    });
    expect(hasContainerRule).toBe(true);
  });

  test('does not style the container element itself directly inside the @container block', async ({ page }) => {
    await page.goto(targetUrl);
    const stylesContainerItself = await page.evaluate(() => {
      const popover = document.querySelector('[popover]');
      if (!popover) return true; // Fail if no popover
      
      let hasContainerRule = false;
      let stylesContainer = false;
      
      function processRules(rules: CSSRuleList) {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          if (rule instanceof CSSContainerRule || rule.type === 17) {
            const containerRule = rule as any;
            if (containerRule.conditionText.includes('anchored')) {
              hasContainerRule = true;
              for (let j = 0; j < containerRule.cssRules.length; j++) {
                const subRule = containerRule.cssRules[j];
                if (subRule instanceof CSSStyleRule) {
                  const selector = subRule.selectorText.trim();
                  try {
                    const elements = document.querySelectorAll(selector);
                    for (let k = 0; k < elements.length; k++) {
                      if (elements[k] === popover) {
                        stylesContainer = true;
                      }
                    }
                  } catch (e) {}
                }
              }
            }
          } else if ((rule as any).cssRules) {
            processRules((rule as any).cssRules);
          }
        }
      }
      
      for (let j = 0; j < document.styleSheets.length; j++) {
        try {
          const sheet = document.styleSheets[j];
          if (sheet.cssRules) processRules(sheet.cssRules);
        } catch (e) {}
      }
      
      // If there is no container rule, we return true (fails) because the feature is missing.
      // If there is container rule and it styles the container, return true (fails).
      // Otherwise, return false (passes).
      return !hasContainerRule || stylesContainer;
    });
    expect(stylesContainerItself).toBe(false);
  });

  test('uses pseudo-elements for decorative arrows', async ({ page }) => {
    await page.goto(targetUrl);
    const hasPseudoArrow = await page.evaluate(() => {
      const popover = document.querySelector('[popover]');
      if (!popover) return false;
      
      const elements = [popover, ...Array.from(popover.querySelectorAll('*'))];
      for (const el of elements) {
        const beforeContent = window.getComputedStyle(el, '::before').getPropertyValue('content');
        const afterContent = window.getComputedStyle(el, '::after').getPropertyValue('content');
        
        if ((beforeContent && beforeContent !== 'none' && beforeContent !== 'normal') ||
            (afterContent && afterContent !== 'none' && afterContent !== 'normal')) {
          return true;
        }
      }

      // Check stylesheets as well because headless Chromium may not evaluate CSS anchor-position pseudo-elements dynamically
      for (let j = 0; j < document.styleSheets.length; j++) {
        try {
          const sheet = document.styleSheets[j];
          const checkRules = (rules: CSSRuleList): boolean => {
            for (let i = 0; i < rules.length; i++) {
              const rule = rules[i];
              if (rule instanceof CSSStyleRule && /::(before|after)/.test(rule.selectorText)) {
                const baseSel = rule.selectorText.replace(/::?(before|after).*$/, '').trim();
                if (rule.selectorText.includes('popover') || rule.selectorText.includes('tooltip') || rule.selectorText.includes('arrow') || (popover && baseSel && (() => { try { return popover.matches(baseSel) || !!popover.querySelector(baseSel); } catch { return false; } })())) {
                  return true;
                }
              }
              if ((rule as any).cssRules && checkRules((rule as any).cssRules)) {
                return true;
              }
            }
            return false;
          };
          if (sheet.cssRules && checkRules(sheet.cssRules)) return true;
        } catch {}
      }

      return false;
    });
    expect(hasPseudoArrow).toBe(true);
  });

  test('updates the visual styling and layout when the tooltip flips to a fallback position purely via CSS without JS', async ({ page }) => {
    // Intercept scroll/resize event listeners to verify no JS-based positioning updates are used
    await page.addInitScript(() => {
      (window as any).__jsFlipListenerRegistered = false;
      const originalAddEventListener = window.addEventListener;
      window.addEventListener = function(type: string, _listener: any, _options?: any) {
        if (type === 'scroll' || type === 'resize') {
          (window as any).__jsFlipListenerRegistered = true;
        }
        return originalAddEventListener.apply(this, arguments as any);
      };
    });

    await page.goto(targetUrl);

    const read = () =>
      page.evaluate(() => {
        const c = document.querySelector('[popover] *') || document.querySelector('[popover]');
        if (!c) return '';
        const b = getComputedStyle(c, '::before');
        const s = getComputedStyle(c);
        return [b.content, s.borderRadius, s.marginBlockStart, s.marginBlockEnd].join('|');
      });

    const isOpen = await page
      .locator('[popover]')
      .first()
      .evaluate((el) => el.matches(':popover-open'))
      .catch(() => false);
    if (!isOpen) {
      await page.locator('[popovertarget]').first().click();
    }

    await page
      .locator('#anchor, [popovertarget]')
      .first()
      .evaluate((el) => el.scrollIntoView({ block: 'end' }));
    const before = await read();
    expect(before).not.toBe('');

    await page
      .locator('#anchor, [popovertarget]')
      .first()
      .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect.poll(read).not.toBe(before);

    const jsListenerRegistered = await page.evaluate(() =>
      Boolean((window as any).__jsFlipListenerRegistered),
    );
    expect(jsListenerRegistered).toBe(false);
  });

});
