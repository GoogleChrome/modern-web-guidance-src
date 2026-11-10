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
    (window as any).callbackProvided = false;
    const original = document.startViewTransition;
    if (original) {
      document.startViewTransition = function(callback) {
        (window as any).transitionCalled = true;
        if (typeof callback === 'function') {
          (window as any).callbackProvided = true;
        }
        return original.call(document, callback);
      };
    }
  });

  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForFunction(() => (window as any).transitionCalled);

  const transitionCalled = await page.evaluate(() => (window as any).transitionCalled);
  const callbackProvided = await page.evaluate(() => (window as any).callbackProvided);

  expect(transitionCalled && callbackProvided).toBe(true);
});

// 2. When a thumbnail is clicked, the selected element is assigned a view-transition-name before or during the transition.
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
  await page.waitForFunction(() => (window as any).clickedThumbnailVTName !== null);

  const vtName = await page.evaluate(() => (window as any).clickedThumbnailVTName);
  expect(vtName).not.toBeNull();
  expect(vtName).not.toBe('none');
});

// 3. The corresponding hero element in the detail view has the same view-transition-name as the selected thumbnail.
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
  await page.waitForFunction(() => (window as any).clickedThumbnailVTName !== null);

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

// 5. After the transition back to the list view is complete, temporary view-transition-names are removed from thumbnails
test("After the transition back to the list view is complete, temporary view-transition-names are removed from thumbnails", async ({ page }) => {
  await page.goto(getTargetUrl());

  // Go to detail view
  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForFunction(() => {
    const detail = document.getElementById('detail-page') || document.querySelector('.detail');
    return detail && !detail.hidden && window.getComputedStyle(detail).display !== 'none';
  });

  // Navigate back to list view
  const backBtn = page.locator('button, a, [role="button"], .back-link').filter({ hasText: /back/i }).first();
  await backBtn.click();

  // Wait for the transition and cleanup to complete
  await page.waitForFunction(() => {
    const thumbs = Array.from(document.querySelectorAll('.thumbnail'));
    return thumbs.length > 0 && thumbs.every(t => window.getComputedStyle(t).viewTransitionName === 'none');
  });

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
  await page.waitForFunction(() => (window as any).titleVTName !== null);

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

// 8. The old and new view transition pseudo-elements are styled with height: 100% to prevent stretching across different aspect ratios.
test("The old and new view transition pseudo-elements are styled with height: 100% to prevent stretching across different aspect ratios", async ({ page }) => {
  await page.goto(getTargetUrl());

  const pseudoStylesCorrect = await page.evaluate(() => {
    let oldCorrect = false;
    let newCorrect = false;

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          const cssText = rule.cssText.toLowerCase();
          if ((cssText.includes('::view-transition-old(') || cssText.includes('::view-transition-old')) && /height\s*:\s*100%/.test(cssText)) {
            oldCorrect = true;
          }
          if ((cssText.includes('::view-transition-new(') || cssText.includes('::view-transition-new')) && /height\s*:\s*100%/.test(cssText)) {
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

// 10. Programmatic focus shifts to the newly revealed main heading or active view container after the view transition completes to prevent focus abandonment.
test("Programmatic focus shifts to the newly revealed main heading or active view container after the view transition completes to prevent focus abandonment", async ({ page }) => {
  await page.goto(getTargetUrl());

  await page.locator('.thumbnail').first().click({ force: true });
  await page.waitForFunction(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const tag = el.tagName.toLowerCase();
    return ['h1', 'h2', 'h3', 'div', 'section', 'main'].includes(tag);
  });

  const activeDetailTag = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'none';
    return el.tagName.toLowerCase();
  });

  const validTags = ['h1', 'h2', 'h3', 'div', 'section', 'main'];
  expect(validTags.includes(activeDetailTag)).toBe(true);
});
