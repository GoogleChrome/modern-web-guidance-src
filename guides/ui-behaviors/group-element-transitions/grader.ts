import { test, expect } from '@playwright/test';

const url = `file://${process.env.TARGET_FILE}`;

test('1. Multiple elements on the page have a view-transition-class property set to the same value', async ({ page }) => {
  await page.goto(url);
  const values = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.item')).map(el => 
      window.getComputedStyle(el).getPropertyValue('view-transition-class')
    );
  });
  expect(values.length > 1 && values.every(v => v && v !== 'none' && v === values[0])).toBe(true);
});

test('2. Every element with a view-transition-class also has a unique view-transition-name', async ({ page }) => {
  await page.goto(url);
  const elementsInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .map(el => ({
        className: window.getComputedStyle(el).getPropertyValue('view-transition-class'),
        name: window.getComputedStyle(el).getPropertyValue('view-transition-name')
      }))
      .filter(info => info.className && info.className !== 'none');
  });
  const isUniqueAndValid = elementsInfo.length > 0 && 
    elementsInfo.every(info => info.name && info.name !== 'none') && 
    (new Set(elementsInfo.map(info => info.name)).size === elementsInfo.length);
  expect(isUniqueAndValid).toBe(true);
});

test('3. There are no repeated view-transition-name values', async ({ page }) => {
  await page.goto(url);
  const names = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .map(el => window.getComputedStyle(el).getPropertyValue('view-transition-name'))
      .filter(name => name && name !== 'none');
  });
  const namesUnique = names.length > 0 && (new Set(names).size === names.length);
  expect(namesUnique).toBe(true);
});

test('4. The stylesheet contains a ::view-transition-group rule targeting that class name', async ({ page }) => {
  await page.goto(url);
  const hasGroupRule = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.item'));
    const className = items.length > 0 ? window.getComputedStyle(items[0]).getPropertyValue('view-transition-class') : '';
    if (!className || className === 'none') return false;

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          const text = rule.cssText.toLowerCase();
          if (text.includes('::view-transition-group') && text.includes(className.toLowerCase())) {
            return true;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  });
  expect(hasGroupRule).toBe(true);
});

test('5. The animation-duration for the ::view-transition-group targeting that class is a time', async ({ page }) => {
  await page.goto(url);
  const duration = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.item'));
    const className = items.length > 0 ? window.getComputedStyle(items[0]).getPropertyValue('view-transition-class') : '';
    if (!className || className === 'none') return null;

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          const text = rule.cssText.toLowerCase();
          if (text.includes('::view-transition-group') && text.includes(className.toLowerCase())) {
            const styleRule = rule as CSSStyleRule;
            return styleRule.style.animationDuration || styleRule.style.getPropertyValue('animation-duration');
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  });
  expect(!!duration && /[0-9.]+(m?s)/.test(duration)).toBe(true);
});

test('6. The animation-timing-function for the ::view-transition-group targeting that class is ease-in-out', async ({ page }) => {
  await page.goto(url);
  const tf = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.item'));
    const className = items.length > 0 ? window.getComputedStyle(items[0]).getPropertyValue('view-transition-class') : '';
    if (!className || className === 'none') return null;

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          const text = rule.cssText.toLowerCase();
          if (text.includes('::view-transition-group') && text.includes(className.toLowerCase())) {
            const styleRule = rule as CSSStyleRule;
            return styleRule.style.animationTimingFunction || styleRule.style.getPropertyValue('animation-timing-function');
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  });
  expect(!!tf && tf.replace(/\s+/g, '') === 'ease-in-out').toBe(true);
});

test('7. A prefers-reduced-motion rule sets the animation to none', async ({ page }) => {
  await page.goto(url);
  const hasReducedMotionRule = await page.evaluate(() => {
    function checkRule(rule: CSSRule): boolean {
      if (rule instanceof CSSMediaRule) {
        const mediaText = rule.media.mediaText.toLowerCase();
        if (mediaText.includes('prefers-reduced-motion') && mediaText.includes('reduce')) {
          let targetsGroup = false;
          let targetsOld = false;
          let targetsNew = false;
          let setsNone = false;

          for (const subRule of Array.from(rule.cssRules)) {
            if (subRule instanceof CSSStyleRule) {
              const selector = subRule.selectorText.toLowerCase();
              const animationValue = subRule.style.animation || subRule.style.getPropertyValue('animation');
              
              if (selector.includes('::view-transition-group(*)')) targetsGroup = true;
              if (selector.includes('::view-transition-old(*)')) targetsOld = true;
              if (selector.includes('::view-transition-new(*)')) targetsNew = true;
              if (animationValue && animationValue.includes('none')) setsNone = true;
              
              if (selector.includes('*') && animationValue && animationValue.includes('none')) {
                if (selector.includes('group') && selector.includes('old') && selector.includes('new')) {
                  targetsGroup = true;
                  targetsOld = true;
                  targetsNew = true;
                  setsNone = true;
                }
              }
            }
          }
          if (targetsGroup && targetsOld && targetsNew && setsNone) {
            return true;
          }
        }
      }
      return false;
    }

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (checkRule(rule)) return true;
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  });
  expect(hasReducedMotionRule).toBe(true);
});

test('8. New elements (entering) are transitioned using ::view-transition-new:only-child', async ({ page }) => {
  await page.goto(url);
  const hasNewEnteringRule = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.item'));
    const className = items.length > 0 ? window.getComputedStyle(items[0]).getPropertyValue('view-transition-class') : '';
    if (!className || className === 'none') return false;

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          const text = rule.cssText.toLowerCase();
          if (text.includes('::view-transition-new') && text.includes(className.toLowerCase()) && text.includes(':only-child')) {
            return true;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  });
  expect(hasNewEnteringRule).toBe(true);
});

test('9. Removed elements (exiting) are transitioned using ::view-transition-old:only-child', async ({ page }) => {
  await page.goto(url);
  const hasOldExitingRule = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.item'));
    const className = items.length > 0 ? window.getComputedStyle(items[0]).getPropertyValue('view-transition-class') : '';
    if (!className || className === 'none') return false;

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          const text = rule.cssText.toLowerCase();
          if (text.includes('::view-transition-old') && text.includes(className.toLowerCase()) && text.includes(':only-child')) {
            return true;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  });
  expect(hasOldExitingRule).toBe(true);
});

test('10. DOM updates that change the list are wrapped in a document.startViewTransition call', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__startViewTransitionCalled = false;
    const original = Document.prototype.startViewTransition;
    if (original) {
      Document.prototype.startViewTransition = function(callback: any) {
        (window as any).__startViewTransitionCalled = true;
        return original.call(this, callback);
      };
    }
  });
  await page.goto(url);
  await page.click('button:has-text("Add Item")');
  const called = await page.evaluate(() => (window as any).__startViewTransitionCalled);
  expect(called).toBe(true);
});

test('11. If document.startViewTransition is not defined, the DOM updates are made immediately', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'startViewTransition', {
      get() { return undefined; },
      configurable: true
    });
    Object.defineProperty(document, 'startViewTransition', {
      get() { return undefined; },
      configurable: true
    });
  });
  await page.goto(url);
  
  const hasTransitionClass = await page.evaluate(() => {
    const first = document.querySelector('.item');
    if (!first) return false;
    const vtClass = window.getComputedStyle(first).getPropertyValue('view-transition-class');
    return vtClass && vtClass !== 'none';
  });

  const initialCount = await page.locator('.item').count();
  await page.click('button:has-text("Add Item")');
  const finalCount = await page.locator('.item').count();
  
  expect(hasTransitionClass && finalCount === initialCount + 1).toBe(true);
});

test('12. The Add button is interactive during the transition', async ({ page }) => {
  await page.goto(url);
  
  const hasTransitionStyles = await page.evaluate(() => {
    let hasPointerEventsNone = false;
    let hasRootNone = false;

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule) {
            const selector = rule.selectorText.toLowerCase();
            
            if (selector === '::view-transition') {
              const pe = rule.style.pointerEvents || rule.style.getPropertyValue('pointer-events');
              if (pe === 'none') hasPointerEventsNone = true;
            }
            if (selector === ':root') {
              const vtn = rule.style.viewTransitionName || rule.style.getPropertyValue('view-transition-name');
              if (vtn === 'none') hasRootNone = true;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return hasPointerEventsNone && hasRootNone;
  });

  await page.click('button:has-text("Add Item")');
  await page.waitForTimeout(200);
  await page.click('button:has-text("Add Item")');
  
  await page.waitForFunction(() => document.querySelectorAll('.item').length === 5);
  expect(hasTransitionStyles).toBe(true);
});

test('13. The ::view-transition pseudo-element has pointer-events none', async ({ page }) => {
  await page.goto(url);
  const hasPointerEventsNone = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule) {
            const selector = rule.selectorText.toLowerCase();
            if (selector === '::view-transition') {
              const pe = rule.style.pointerEvents || rule.style.getPropertyValue('pointer-events');
              if (pe === 'none') return true;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  });
  expect(hasPointerEventsNone).toBe(true);
});

test('14. The view-transition-name on :root is set to none', async ({ page }) => {
  await page.goto(url);
  const hasRootNone = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule) {
            const selector = rule.selectorText.toLowerCase();
            if (selector === ':root') {
              const vtn = rule.style.viewTransitionName || rule.style.getPropertyValue('view-transition-name');
              if (vtn === 'none') return true;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  });
  expect(hasRootNone).toBe(true);
});
