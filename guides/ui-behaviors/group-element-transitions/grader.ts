import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || '';
const targetDir = path.dirname(targetFile);
const url = `http://localhost/${path.basename(targetFile)}`;

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost/**', async (route) => {
    const reqUrl = new URL(route.request().url());
    const relPath = decodeURIComponent(reqUrl.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(targetDir, relPath || path.basename(targetFile));

    if (!filePath.startsWith(targetDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      await route.abort();
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
    };

    await route.fulfill({
      status: 200,
      contentType: contentTypeMap[ext] || 'application/octet-stream',
      body: fs.readFileSync(filePath),
    });
  });
});

async function clickAddButton(page: Page) {
  const exactBtn = page.locator('button:has-text("Add Item")').first();
  if ((await exactBtn.count()) > 0 && (await exactBtn.isVisible())) {
    await exactBtn.click();
    return;
  }
  const semanticBtn = page
    .locator(
      'button:not(.nav-cta):not(.btn-primary):not(.btn-ghost):not(.card-btn):not(dialog button)',
    )
    .filter({ hasText: /\badd\b|\+/i })
    .first();
  if ((await semanticBtn.count()) > 0 && (await semanticBtn.isVisible())) {
    await semanticBtn.click();
    return;
  }
  await exactBtn.click();
}

async function ensureItemsPresent(page: Page) {
  const getCount = async () => {
    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => {
        const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
        return c && c !== 'none';
      }).length;
    });
  };
  let count = await getCount();
  if (count < 2) {
    try { await clickAddButton(page); } catch {}
    try { await clickAddButton(page); } catch {}
  }
}

test('1. Multiple elements on the page have a view-transition-class property set to the same value', async ({ page }) => {
  await page.goto(url);
  await ensureItemsPresent(page);
  const values = await page.evaluate(() => {
    const withClass = Array.from(document.querySelectorAll('*'))
      .map(el => window.getComputedStyle(el).getPropertyValue('view-transition-class').trim())
      .filter(v => v && v !== 'none');
    if (withClass.length > 0) return withClass;
    return Array.from(document.querySelectorAll('.item')).map(el =>
      window.getComputedStyle(el).getPropertyValue('view-transition-class').trim()
    );
  });
  expect(values.length > 1 && values.every(v => v && v !== 'none' && v === values[0])).toBe(true);
});

test('2. Every element with a view-transition-class also has a unique view-transition-name', async ({ page }) => {
  await page.goto(url);
  await ensureItemsPresent(page);
  const elementsInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .map(el => ({
        className: window.getComputedStyle(el).getPropertyValue('view-transition-class').trim(),
        name: window.getComputedStyle(el).getPropertyValue('view-transition-name').trim()
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
  await ensureItemsPresent(page);
  const names = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .map(el => window.getComputedStyle(el).getPropertyValue('view-transition-name').trim())
      .filter(name => name && name !== 'none');
  });
  const namesUnique = names.length > 0 && (new Set(names).size === names.length);
  expect(namesUnique).toBe(true);
});

test('4. The stylesheet contains a ::view-transition-group rule targeting that class name', async ({ page }) => {
  await page.goto(url);
  await ensureItemsPresent(page);
  const hasGroupRule = await page.evaluate(() => {
    const firstWithClass = Array.from(document.querySelectorAll('*')).find(el => {
      const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
      return c && c !== 'none';
    }) || document.querySelector('.item');
    const className = firstWithClass ? window.getComputedStyle(firstWithClass).getPropertyValue('view-transition-class').trim() : '';
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
  await ensureItemsPresent(page);
  const duration = await page.evaluate(() => {
    const firstWithClass = Array.from(document.querySelectorAll('*')).find(el => {
      const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
      return c && c !== 'none';
    }) || document.querySelector('.item');
    const className = firstWithClass ? window.getComputedStyle(firstWithClass).getPropertyValue('view-transition-class').trim() : '';
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
  expect(!!duration && (/[0-9.]+(m?s)/.test(duration) || /var\(--/.test(duration))).toBe(true);
});

test('6. The animation-timing-function for the ::view-transition-group targeting that class is non-linear (or default ease)', async ({ page }) => {
  await page.goto(url);
  await ensureItemsPresent(page);
  const timingResult = await page.evaluate(async () => {
    const firstWithClass = Array.from(document.querySelectorAll('*')).find(el => {
      const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
      return c && c !== 'none';
    }) || document.querySelector('.item');
    const className = firstWithClass ? window.getComputedStyle(firstWithClass).getPropertyValue('view-transition-class').trim() : '';
    if (!className || className === 'none') return { found: false, tf: null };

    // Try reading computed timing function on an active ::view-transition-group pseudo-element if possible,
    // and fall back to matching the stylesheet rule (defaulting omitted timing function to 'ease').
    let ruleFound = false;
    let ruleTf = '';
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule) {
            const text = rule.selectorText.toLowerCase();
            if (text.includes('::view-transition-group') && text.includes(className.toLowerCase())) {
              ruleFound = true;
              const explicitTf = (rule.style.animationTimingFunction || rule.style.getPropertyValue('animation-timing-function') || '').trim();
              if (explicitTf) ruleTf = explicitTf;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    if (!ruleFound) return { found: false, tf: null };

    let computedTf = '';
    const itemWithVtName = Array.from(document.querySelectorAll('*')).find(el => {
      const n = window.getComputedStyle(el).getPropertyValue('view-transition-name').trim();
      const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
      return n && n !== 'none' && c === className;
    });
    if (itemWithVtName && 'startViewTransition' in document) {
      const vtName = window.getComputedStyle(itemWithVtName).getPropertyValue('view-transition-name').trim();
      const transition = (document as any).startViewTransition(() => {});
      await transition.ready.catch(() => {});
      computedTf = window.getComputedStyle(document.documentElement, `::view-transition-group(${vtName})`).animationTimingFunction || '';
      transition.skipTransition?.();
    }

    const effectiveTf = (computedTf || ruleTf || 'ease').trim().toLowerCase();
    return { found: true, tf: effectiveTf };
  });
  expect(timingResult.found).toBe(true);
  expect(timingResult.tf).not.toBeNull();
  const tf = timingResult.tf!;
  // Reject keyword `linear` and `steps(...)` / step-start / step-end; allow `ease*`, `cubic-bezier(...)`, multi-stop `linear(...)`.
  const isRejected = tf === 'linear' || /^steps?\(/.test(tf) || tf === 'step-start' || tf === 'step-end';
  expect(isRejected).toBe(false);
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
  await ensureItemsPresent(page);
  const hasNewEnteringRule = await page.evaluate(() => {
    const firstWithClass = Array.from(document.querySelectorAll('*')).find(el => {
      const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
      return c && c !== 'none';
    }) || document.querySelector('.item');
    const className = firstWithClass ? window.getComputedStyle(firstWithClass).getPropertyValue('view-transition-class').trim() : '';
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
  await ensureItemsPresent(page);
  const hasOldExitingRule = await page.evaluate(() => {
    const firstWithClass = Array.from(document.querySelectorAll('*')).find(el => {
      const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
      return c && c !== 'none';
    }) || document.querySelector('.item');
    const className = firstWithClass ? window.getComputedStyle(firstWithClass).getPropertyValue('view-transition-class').trim() : '';
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
  await clickAddButton(page);
  const called = await page.evaluate(() => (window as any).__startViewTransitionCalled);
  expect(called).toBe(true);
});

test('11. If document.startViewTransition is not defined, the DOM updates are made immediately', async ({ page }) => {
  await page.addInitScript(() => {
    delete (Document.prototype as any).startViewTransition;
    delete (document as any).startViewTransition;
  });
  await page.goto(url);
  await ensureItemsPresent(page);

  const getDomSignature = async () => {
    return await page.evaluate(() => {
      const withClass = Array.from(document.querySelectorAll('*')).filter(el => {
        const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
        return c && c !== 'none';
      });
      return {
        hasTransitionClass: withClass.length > 0,
        html: document.body.innerHTML
      };
    });
  };

  const before = await getDomSignature();
  await clickAddButton(page);
  const after = await getDomSignature();

  expect(before.hasTransitionClass && after.html !== before.html).toBe(true);
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
            
            if (selector === '::view-transition' || /(?:^|,|\s)(?::root|html)?::view-transition(?:\s|,|$)/.test(selector)) {
              const pe = rule.style.pointerEvents || rule.style.getPropertyValue('pointer-events');
              if (pe === 'none') hasPointerEventsNone = true;
            }
            if (selector === ':root' || selector === 'html') {
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

  const getTransitionedCount = async () => {
    return await page.evaluate(() => {
      const withClass = Array.from(document.querySelectorAll('*')).filter(el => {
        const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
        return c && c !== 'none';
      });
      return withClass.length > 0 ? withClass.length : document.querySelectorAll('.item, .card').length;
    });
  };

  const initialCount = await getTransitionedCount();
  await clickAddButton(page);
  await clickAddButton(page);

  await page.waitForFunction((expectedMin: number) => {
    const withClass = Array.from(document.querySelectorAll('*')).filter(el => {
      const c = window.getComputedStyle(el).getPropertyValue('view-transition-class').trim();
      return c && c !== 'none';
    });
    const count = withClass.length > 0 ? withClass.length : document.querySelectorAll('.item, .card').length;
    return count >= expectedMin;
  }, initialCount + 2, { timeout: 3000 });
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
            if (selector === '::view-transition' || /(?:^|,|\s)(?::root|html)?::view-transition(?:\s|,|$)/.test(selector)) {
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
            if (selector === ':root' || selector === 'html') {
              const vtn = rule.style.viewTransitionName || rule.style.getPropertyValue('view-transition-name');
              if (vtn === 'none') return true;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
    if (document.documentElement.style.viewTransitionName === 'none' ||
        window.getComputedStyle(document.documentElement).getPropertyValue('view-transition-name') === 'none') {
      return true;
    }
    const scriptTexts = Array.from(document.scripts).map(s => s.textContent || '').join('\n');
    if (scriptTexts.includes("viewTransitionName = 'none'") ||
        scriptTexts.includes('viewTransitionName = "none"') ||
        scriptTexts.includes("view-transition-name', 'none'") ||
        scriptTexts.includes('view-transition-name: none')) {
      return true;
    }
    return false;
  });
  expect(hasRootNone).toBe(true);
});
