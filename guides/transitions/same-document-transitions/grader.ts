import { test, expect } from '@playwright/test';

// Target file helper
const getTargetUrl = () => {
  const target = process.env.TARGET_FILE || './demo.html';
  return `file://${target}`;
};

// 1. The transition from list view to detail view is wrapped in a document.startViewTransition call.
test("The transition from list view to detail view is wrapped in a document.startViewTransition call", async ({ page }) => {
  await page.goto(getTargetUrl());

  await page.evaluate(() => {
    (window as any).transitionCalled = false;
    (window as any).wrappedCorrectly = false;
    const original = document.startViewTransition;
    if (original) {
      document.startViewTransition = function(callback) {
        (window as any).transitionCalled = true;
        const beforeClass = document.body.classList.contains('detail');
        if (typeof callback === 'function') {
          const wrappedCallback = () => {
            const res = callback();
            const afterClass = document.body.classList.contains('detail');
            if (!beforeClass && afterClass) {
              (window as any).wrappedCorrectly = true;
            }
            return res;
          };
          return original.call(document, wrappedCallback);
        }
        return original.call(document, callback);
      };
    }
  });

  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForTimeout(500);

  const transitionCalled = await page.evaluate(() => (window as any).transitionCalled);
  const wrappedCorrectly = await page.evaluate(() => (window as any).wrappedCorrectly);

  expect(transitionCalled && wrappedCorrectly).toBe(true);
});

// 2. When a thumbnail is clicked, the selected element is assigned a view-transition-name (e.g., hero) before or during the transition.
test("When a thumbnail is clicked, the selected element is assigned a view-transition-name before or during the transition", async ({ page }) => {
  await page.goto(getTargetUrl());

  // Verify before clicking, the first thumbnail has 'none'
  const beforeVT = await page.evaluate(() => {
    const thumb = document.querySelector('.thumbnail');
    return thumb ? window.getComputedStyle(thumb).viewTransitionName : null;
  });
  expect(beforeVT).toBe('none');

  await page.evaluate(() => {
    (window as any).clickedThumbnailVTName = null;
    
    document.addEventListener('click', (e) => {
      const thumb = (e.target as HTMLElement).closest('.thumbnail');
      if (thumb) {
        (window as any).clickedThumb = thumb;
      }
    }, { capture: true });

    const original = document.startViewTransition;
    if (original) {
      document.startViewTransition = function(callback) {
        const clicked = (window as any).clickedThumb;
        if (clicked) {
          (window as any).clickedThumbnailVTName = window.getComputedStyle(clicked).viewTransitionName;
        }
        return original.call(document, callback);
      };
    }
  });

  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForTimeout(500);

  const vtName = await page.evaluate(() => (window as any).clickedThumbnailVTName);
  expect(vtName).not.toBeNull();
  expect(vtName).not.toBe('none');
});

// 3. The corresponding hero element in the detail view has the same view-transition-name (e.g., hero) as the selected thumbnail.
test("The corresponding hero element in the detail view has the same view-transition-name as the selected thumbnail", async ({ page }) => {
  await page.goto(getTargetUrl());

  // Verify before clicking, the first thumbnail has 'none'
  const beforeVT = await page.evaluate(() => {
    const thumb = document.querySelector('.thumbnail');
    return thumb ? window.getComputedStyle(thumb).viewTransitionName : null;
  });
  expect(beforeVT).toBe('none');

  await page.evaluate(() => {
    (window as any).clickedThumbnailVTName = null;
    
    document.addEventListener('click', (e) => {
      const thumb = (e.target as HTMLElement).closest('.thumbnail');
      if (thumb) {
        (window as any).clickedThumb = thumb;
      }
    }, { capture: true });

    const original = document.startViewTransition;
    if (original) {
      document.startViewTransition = function(callback) {
        const clicked = (window as any).clickedThumb;
        if (clicked) {
          (window as any).clickedThumbnailVTName = window.getComputedStyle(clicked).viewTransitionName;
        }
        return original.call(document, callback);
      };
    }
  });

  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForTimeout(500);

  const matchFound = await page.evaluate(() => {
    const thumbName = (window as any).clickedThumbnailVTName;
    if (!thumbName || thumbName === 'none') return false;

    const all = document.querySelectorAll('*');
    for (const el of Array.from(all)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      const style = window.getComputedStyle(el);
      if (style.viewTransitionName === thumbName) {
        return true;
      }
    }
    return false;
  });

  expect(matchFound).toBe(true);
});

// 4. Only one element in the DOM has a specific view-transition-name at any given time.
test("Only one element in the DOM has a specific view-transition-name at any given time", async ({ page }) => {
  await page.goto(getTargetUrl());

  const initialViolations = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const namesMap: Record<string, string[]> = {};
    for (const el of Array.from(all)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      const style = window.getComputedStyle(el);
      const name = style.viewTransitionName;
      if (name && name !== 'none') {
        if (!namesMap[name]) namesMap[name] = [];
        namesMap[name].push(el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : ''));
      }
    }
    const list: string[] = [];
    for (const [name, tags] of Object.entries(namesMap)) {
      if (tags.length > 1) {
        list.push(`${name} on elements: ${tags.join(', ')}`);
      }
    }
    return list;
  });

  expect(initialViolations).toEqual([]);
});

// 5. After the transition is complete, the temporary view-transition-name is removed from the list view's thumbnail
test("After the transition is complete, the temporary view-transition-name is removed from the list view's thumbnail", async ({ page }) => {
  await page.goto(getTargetUrl());

  // Go to detail view
  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForTimeout(500);

  // Navigate back to list view
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('back'));
    if (btn) {
      btn.click();
    } else {
      const hero = document.getElementById('hero');
      if (hero) hero.click();
    }
  });

  // Wait for the transition and cleanup to complete
  await page.waitForTimeout(1000);

  const thumbnailNames = await page.evaluate(() => {
    const thumbs = document.querySelectorAll('.thumbnail');
    return Array.from(thumbs).map(t => window.getComputedStyle(t).viewTransitionName);
  });

  for (const name of thumbnailNames) {
    expect(name).toBe('none');
  }
});

// 6. The title text in both views is assigned a matching view-transition-name (e.g., title).
test("The title text in both views is assigned a matching view-transition-name", async ({ page }) => {
  await page.goto(getTargetUrl());

  // Verify before clicking, the title inside first thumbnail has 'none'
  const beforeVT = await page.evaluate(() => {
    const title = document.querySelector('.thumbnail .title');
    return title ? window.getComputedStyle(title).viewTransitionName : null;
  });
  expect(beforeVT).toBe('none');

  await page.evaluate(() => {
    (window as any).titleVTName = null;
    
    document.addEventListener('click', (e) => {
      const thumb = (e.target as HTMLElement).closest('.thumbnail');
      if (thumb) {
        (window as any).clickedThumb = thumb;
      }
    }, { capture: true });

    const original = document.startViewTransition;
    if (original) {
      document.startViewTransition = function(callback) {
        const clicked = (window as any).clickedThumb;
        if (clicked) {
          const children = clicked.querySelectorAll('*');
          for (const child of Array.from(children)) {
            const style = window.getComputedStyle(child as Element);
            if (style.viewTransitionName && style.viewTransitionName !== 'none') {
              (window as any).titleVTName = style.viewTransitionName;
              break;
            }
          }
        }
        return original.call(document, callback);
      };
    }
  });

  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForTimeout(500);

  const matched = await page.evaluate(() => {
    const titleName = (window as any).titleVTName;
    if (!titleName || titleName === 'none') return false;

    const all = document.querySelectorAll('*');
    for (const el of Array.from(all)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      const style = window.getComputedStyle(el);
      if (style.viewTransitionName === titleName) {
        return true;
      }
    }
    return false;
  });

  expect(matched).toBe(true);
});

// 7. Elements with view-transition-name that contain text have width: fit-content applied to maintain a stable aspect ratio during transition.
test("Elements with view-transition-name that contain text have width: fit-content applied to maintain a stable aspect ratio during transition", async ({ page }) => {
  await page.goto(getTargetUrl());

  const isListTitleFitContent = await page.evaluate(() => {
    const titleEl = document.querySelector('.title');
    if (!titleEl) return false;
    
    const originalText = titleEl.textContent || '';
    const rectOriginal = titleEl.getBoundingClientRect();
    
    titleEl.textContent = '.';
    const rectShort = titleEl.getBoundingClientRect();
    
    titleEl.textContent = originalText;
    return rectShort.width < rectOriginal.width;
  });

  expect(isListTitleFitContent).toBe(true);
});

// 8. The ::view-transition-old(hero) and ::view-transition-new(hero) pseudo-elements are styled with height: 100% to prevent stretching across different aspect ratios.
test("The ::view-transition-old(hero) and ::view-transition-new(hero) pseudo-elements are styled with height: 100% to prevent stretching across different aspect ratios", async ({ page }) => {
  await page.goto(getTargetUrl());

  const pseudoStylesCorrect = await page.evaluate(() => {
    let oldCorrect = false;
    let newCorrect = false;

    const checkRule = (selector: string, cssText: string) => {
      if (cssText.includes(selector)) {
        const heightMatch = cssText.match(/height\s*:\s*([^;}\s]+)/);
        if (heightMatch && (heightMatch[1] === '100%' || heightMatch[1] === '100%!important')) {
          return true;
        }
      }
      return false;
    };

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          const cssText = rule.cssText.toLowerCase();
          if (checkRule('::view-transition-old(hero)', cssText)) {
            oldCorrect = true;
          }
          if (checkRule('::view-transition-new(hero)', cssText)) {
            newCorrect = true;
          }
        }
      } catch (e) {
        // Safe catch for cross-origin stylesheet exceptions
      }
    }
    return oldCorrect && newCorrect;
  });

  expect(pseudoStylesCorrect).toBe(true);
});

// 9. All view transition animations are disabled when prefers-reduced-motion: reduce is active.
test("All view transition animations are disabled when prefers-reduced-motion: reduce is active", async ({ page }) => {
  await page.goto(getTargetUrl());

  const hasReducedMotionRule = await page.evaluate(() => {
    let found = false;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSMediaRule) {
            const mediaText = rule.media.mediaText.toLowerCase();
            if (mediaText.includes('prefers-reduced-motion') && mediaText.includes('reduce')) {
              for (const subRule of Array.from(rule.cssRules)) {
                const subText = subRule.cssText.toLowerCase();
                if (subText.includes('::view-transition') && subText.includes('animation') && subText.includes('none')) {
                  found = true;
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        // Safe catch for cross-origin stylesheet exceptions
      }
    }
    return found;
  });

  expect(hasReducedMotionRule).toBe(true);
});

// 10. Programmatic focus MUST be shifted to the newly revealed main heading or active view container after the view transition completes to prevent focus abandonment.
test("Programmatic focus MUST be shifted to the newly revealed main heading or active view container after the view transition completes to prevent focus abandonment", async ({ page }) => {
  await page.goto(getTargetUrl());

  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForTimeout(1000);

  const activeDetailTag = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'none';
    return el.tagName.toLowerCase();
  });

  const validTags = ['h1', 'h2', 'h3', 'div', 'section', 'main'];
  expect(validTags.includes(activeDetailTag)).toBe(true);
});
