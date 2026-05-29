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
      const trigger = document.querySelector('[popovertarget]');
      if (!trigger) return false;
      const targetId = trigger.getAttribute('popovertarget');
      if (!targetId) return false;
      const popover = document.getElementById(targetId);
      if (!popover) return false;
      const hasRoleTooltip = popover.getAttribute('role') === 'tooltip';
      const triggerAria = trigger.getAttribute('aria-describedby');
      return hasRoleTooltip && triggerAria === targetId;
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
    await page.waitForTimeout(1000);
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
      const style = window.getComputedStyle(popover);
      return style.positionArea || style.getPropertyValue('position-area') || '';
    });
    expect(positionArea).toMatch(/^(block-start|block-end|inline-start|inline-end|top|bottom|left|right|center)/);
  });

  test('defines fallback positions using position-try-fallbacks', async ({ page }) => {
    await page.goto(targetUrl);
    const fallbacks = await page.evaluate(() => {
      const popover = document.querySelector('[popover]');
      if (!popover) return '';
      const style = window.getComputedStyle(popover);
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
        
        if ((beforeContent && beforeContent !== 'none' && beforeContent !== '""') ||
            (afterContent && afterContent !== 'none' && afterContent !== '""')) {
          return true;
        }
      }
      return false;
    });
    expect(hasPseudoArrow).toBe(true);
  });

  test('updates the visual styling and layout when the tooltip flips to a fallback position purely via CSS without JS', async ({ page }) => {
    // Intercept scroll/resize event listeners to block JS-based positioning updates
    await page.addInitScript(() => {
      const originalAddEventListener = window.addEventListener;
      window.addEventListener = function(type: string, listener: any, options?: any) {
        if (type === 'scroll' || type === 'resize') {
          console.log(`Intercepted JS listener for: ${type}`);
          return; // Block scroll and resize event listeners!
        }
        return originalAddEventListener.apply(this, arguments as any);
      };
    });

    await page.goto(targetUrl);
    await page.waitForTimeout(500);

    // Trigger popover open (if not already opened)
    await page.evaluate(() => {
      const trigger = document.querySelector('[popovertarget]') as HTMLElement;
      const popover = document.querySelector('[popover]') as HTMLElement;
      if (trigger && popover && window.getComputedStyle(popover).display === 'none') {
        trigger.click();
      }
    });

    // State 1: Scroll anchor to the bottom of the viewport (default position)
    await page.evaluate(() => {
      const anchor = document.querySelector('[popovertarget]') || document.getElementById('anchor');
      if (anchor) {
        anchor.scrollIntoView({ block: 'end' });
      }
    });
    await page.waitForTimeout(500);

    // Read State 1 styles
    const state1 = await page.evaluate(() => {
      const popover = document.querySelector('[popover]') || document.getElementById('tooltip');
      if (!popover) return null;
      const content = popover.querySelector('*') || popover;
      const beforeStyle = window.getComputedStyle(content, '::before');
      const contentStyle = window.getComputedStyle(content);
      return {
        arrowContent: beforeStyle.getPropertyValue('content'),
        borderRadius: contentStyle.borderRadius,
        marginBlockStart: contentStyle.marginBlockStart,
        marginBlockEnd: contentStyle.marginBlockEnd,
      };
    });

    // State 2: Scroll anchor to the top of the viewport (fallback position)
    await page.evaluate(() => {
      const anchor = document.querySelector('[popovertarget]') || document.getElementById('anchor');
      if (anchor) {
        anchor.scrollIntoView({ block: 'start' });
      }
    });
    await page.waitForTimeout(500);

    // Read State 2 styles
    const state2 = await page.evaluate(() => {
      const popover = document.querySelector('[popover]') || document.getElementById('tooltip');
      if (!popover) return null;
      const content = popover.querySelector('*') || popover;
      const beforeStyle = window.getComputedStyle(content, '::before');
      const contentStyle = window.getComputedStyle(content);
      return {
        arrowContent: beforeStyle.getPropertyValue('content'),
        borderRadius: contentStyle.borderRadius,
        marginBlockStart: contentStyle.marginBlockStart,
        marginBlockEnd: contentStyle.marginBlockEnd,
      };
    });

    expect(state1).not.toBeNull();
    expect(state2).not.toBeNull();

    // Verify that at least one key presentation style (the arrow or container content style)
    // changed as a result of the CSS layout flip
    const arrowChanged = state1!.arrowContent !== state2!.arrowContent;
    const borderChanged = state1!.borderRadius !== state2!.borderRadius;
    const marginChanged = state1!.marginBlockStart !== state2!.marginBlockStart || state1!.marginBlockEnd !== state2!.marginBlockEnd;

    expect(arrowChanged || borderChanged || marginChanged).toBe(true);
  });

});
