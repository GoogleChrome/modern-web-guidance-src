import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSMediaRule,
  closestRule,
} from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Daily Grind Carousel Grader', () => {

  // =========================================================================
  // STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE)
  // =========================================================================

  test('The carousel track has overflow-x: auto or overflow-y: auto (or overflow: auto) and uses mandatory scroll snapping on its scrolling axis', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);
    const snapRules = styleRules.filter((r) => {
      const snap = r.style.getPropertyValue('scroll-snap-type');
      return snap && snap.includes('mandatory');
    });
    expect(snapRules.length).toBeGreaterThan(0);

    const hasValidSnapAndOverflow = snapRules.some((r) => {
      const snap = r.style.getPropertyValue('scroll-snap-type');
      const validSnap = /\b(x|y|inline|block)\s+mandatory\b|\bmandatory\s+(x|y|inline|block)\b/.test(snap);
      const overflow = r.style.getPropertyValue('overflow');
      const overflowX = r.style.getPropertyValue('overflow-x');
      const overflowY = r.style.getPropertyValue('overflow-y');
      const hasScrollOverflow = ['auto', 'scroll'].some(
        (v) => overflow.includes(v) || overflowX.includes(v) || overflowY.includes(v),
      );
      return validSnap && hasScrollOverflow;
    });
    expect(hasValidSnapAndOverflow).toBe(true);
  });

  test('The carousel container is exposed as a labeled region with aria-roledescription="carousel" and an accessible name', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const container = docs
      .map((d) => d.document.querySelector('[aria-roledescription="carousel"]'))
      .find(Boolean);
    expect(container).toBeDefined();
    expect(container).not.toBeNull();

    const label =
      container!.getAttribute('aria-label') ||
      (container!.getAttribute('aria-labelledby')
        ? container!.ownerDocument.getElementById(container!.getAttribute('aria-labelledby')!)?.textContent?.trim()
        : null);
    expect(label).toBeTruthy();

    const isRegion = container!.tagName === 'SECTION' || container!.getAttribute('role') === 'region';
    expect(isRegion).toBe(true);
  });

  test('Each slide is exposed as a group with role="group", aria-roledescription="slide", and a position in its accessible name', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const slides = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('[aria-roledescription="slide"]')),
    );
    expect(slides.length).toBeGreaterThan(0);

    for (const slide of slides) {
      expect((slide as Element).getAttribute('role')).toBe('group');
      expect((slide as Element).getAttribute('aria-roledescription')).toBe('slide');
      const label =
        (slide as Element).getAttribute('aria-label') ||
        ((slide as Element).getAttribute('aria-labelledby')
          ? (slide as Element).ownerDocument.getElementById((slide as Element).getAttribute('aria-labelledby')!)?.textContent?.trim()
          : '') ||
        (slide as Element).textContent ||
        '';
      expect(label).toMatch(/\b\d+\s+of\s+\d+\b/i);
    }
  });

  test('Interactive carousel controls and marker buttons have a visible :focus-visible indicator', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);
    const focusVisibleRules = styleRules.filter((r) => r.selectorText.includes(':focus-visible'));
    expect(focusVisibleRules.length).toBeGreaterThan(0);

    const hasIndicator = focusVisibleRules.some((r) => {
      const outline =
        r.style.getPropertyValue('outline') ||
        r.style.getPropertyValue('outline-style') ||
        r.style.getPropertyValue('outline-color');
      const shadow = r.style.getPropertyValue('box-shadow');
      const border = r.style.getPropertyValue('border') || r.style.getPropertyValue('border-color');
      return Boolean(outline || shadow || border);
    });
    expect(hasIndicator).toBe(true);
  });

  test('The carousel uses HTML Previous and Next <button> elements, each with an accessible name, that precede the track in DOM order, and does not use native ::scroll-button() or ::scroll-marker', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const allButtons = docs.flatMap((d) => Array.from(d.document.querySelectorAll('button')));
    const prevBtn = allButtons.find((b: any) =>
      b.getAttribute('data-direction') === 'previous' ||
      /prev/i.test(b.getAttribute('aria-label') || '') ||
      /prev/i.test(b.textContent || ''),
    );
    const nextBtn = allButtons.find((b: any) =>
      b.getAttribute('data-direction') === 'next' ||
      /next/i.test(b.getAttribute('aria-label') || '') ||
      /next/i.test(b.textContent || ''),
    );
    const track = docs
      .map((d) =>
        d.document.querySelector('.carousel-track, [aria-roledescription="slide"]')?.parentElement ||
        d.document.querySelector('.carousel-track'),
      )
      .find(Boolean);

    expect(prevBtn).toBeDefined();
    expect(nextBtn).toBeDefined();
    expect(track).toBeDefined();

    const prevName = (prevBtn as any).getAttribute('aria-label') || (prevBtn as any).textContent?.trim();
    const nextName = (nextBtn as any).getAttribute('aria-label') || (nextBtn as any).textContent?.trim();
    expect(prevName).toBeTruthy();
    expect(nextName).toBeTruthy();

    // Node.DOCUMENT_POSITION_FOLLOWING is 4
    const prevFollowedByTrack = Boolean((prevBtn as any).compareDocumentPosition(track) & 4);
    const nextFollowedByTrack = Boolean((nextBtn as any).compareDocumentPosition(track) & 4);
    expect(prevFollowedByTrack).toBe(true);
    expect(nextFollowedByTrack).toBe(true);

    const styleRules = getRules(targetFiles, CSSStyleRule);
    const hasNativeScrollPseudo = styleRules.some(
      (r) => r.selectorText.includes('::scroll-button') || r.selectorText.includes('::scroll-marker'),
    );
    expect(hasNativeScrollPseudo).toBe(false);
  });

  test('Smooth scrolling (scroll-behavior: smooth) and any optional scroll-driven slide effects or transitions are wrapped in @media (prefers-reduced-motion: no-preference)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const mediaRules = getRules(stylesheet, CSSMediaRule);
    const motionMedia = mediaRules.find(
      (r) => r.conditionText.includes('prefers-reduced-motion') && r.conditionText.includes('no-preference'),
    );
    expect(motionMedia).toBeDefined();

    const smoothRules = getRules(motionMedia!, CSSStyleRule).filter(
      (r) => r.style.getPropertyValue('scroll-behavior') === 'smooth',
    );
    expect(smoothRules.length).toBeGreaterThan(0);

    const allStyleRules = getRules(stylesheet, CSSStyleRule);
    const smoothOutside = allStyleRules.filter((r) => {
      if (r.style.getPropertyValue('scroll-behavior') !== 'smooth') return false;
      const parentMedia = closestRule(r, CSSMediaRule);
      return !parentMedia || !parentMedia.conditionText.includes('no-preference');
    });
    expect(smoothOutside.length).toBe(0);
  });

  // =========================================================================
  // BROWSER ASSERTIONS (RUNTIME BEHAVIOR)
  // =========================================================================

  test.describe('Browser tests', () => {

    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Every carousel slide has scroll-snap-align: center (or start) applied so it acts as a snap target', async ({ page }) => {
      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);

      for (let i = 0; i < 3; i++) {
        const align = await slides.nth(i).evaluate((el) => window.getComputedStyle(el).scrollSnapAlign);
        expect(['center', 'start']).toContain(align);
      }
    });

    test('Previous and next controls stay enabled at the first and last slides, because the carousel loops', async ({ page }) => {
      const prevBtn = page.locator('[data-direction="previous"], button[aria-label*="previous" i]').first();
      const nextBtn = page.locator('[data-direction="next"], button[aria-label*="next" i]').first();
      await expect(prevBtn).toBeVisible();
      await expect(nextBtn).toBeVisible();

      // At first slide on load
      await expect(prevBtn).toBeEnabled();
      await expect(nextBtn).toBeEnabled();

      // Navigate to last slide
      await prevBtn.click();
      await page.waitForTimeout(300);

      // Controls must stay enabled at last slide
      await expect(prevBtn).toBeEnabled();
      await expect(nextBtn).toBeEnabled();
    });

    test('Activating Next while the last slide is current brings the first slide into view, and activating Previous while the first slide is current brings the last slide into view', async ({ page }) => {
      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);
      const prevBtn = page.locator('[data-direction="previous"], button[aria-label*="previous" i]').first();
      const nextBtn = page.locator('[data-direction="next"], button[aria-label*="next" i]').first();
      await expect(prevBtn).toBeVisible();
      await expect(nextBtn).toBeVisible();

      // 1. Activating Previous while first slide is current brings last slide into view
      await prevBtn.click();
      const lastSlide = slides.last();
      await expect.poll(async () => {
        return await lastSlide.evaluate((el) => {
          const track = el.closest('.carousel-track') || el.parentElement!;
          const tr = track.getBoundingClientRect();
          const sr = el.getBoundingClientRect();
          return (
            Math.abs((tr.left + tr.right) / 2 - (sr.left + sr.right) / 2) < tr.width / 3 ||
            Math.abs((tr.top + tr.bottom) / 2 - (sr.top + sr.bottom) / 2) < tr.height / 3
          );
        });
      }, { timeout: 5000 }).toBe(true);

      // 2. Activating Next while last slide is current brings first slide into view
      await nextBtn.click();
      const firstSlide = slides.first();
      await expect.poll(async () => {
        return await firstSlide.evaluate((el) => {
          const track = el.closest('.carousel-track') || el.parentElement!;
          const tr = track.getBoundingClientRect();
          const sr = el.getBoundingClientRect();
          return (
            Math.abs((tr.left + tr.right) / 2 - (sr.left + sr.right) / 2) < tr.width / 3 ||
            Math.abs((tr.top + tr.bottom) / 2 - (sr.top + sr.bottom) / 2) < tr.height / 3
          );
        });
      }, { timeout: 5000 }).toBe(true);
    });

    test('Looping does not duplicate slides: the track contains exactly one slide element per slide, with no cloned or aria-hidden copies', async ({ page }) => {
      const track = page.locator('.carousel-track, [aria-roledescription="carousel"] [role="group"]');
      await expect(track).toHaveCount(1);

      const children = track.locator('> *');
      await expect(children).toHaveCount(3);

      const ariaHiddenCount = await track.locator('> [aria-hidden="true"]').count();
      expect(ariaHiddenCount).toBe(0);
    });

    test('While the first slide is current, the last slide has a computed order of -1', async ({ page }) => {
      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);

      const lastSlide = slides.last();
      await expect.poll(async () => {
        return await lastSlide.evaluate((el) => window.getComputedStyle(el).order);
      }, { timeout: 5000 }).toBe('-1');
    });

    test('While the last slide is current, the first slide has a computed order of 1', async ({ page }) => {
      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);

      const prevBtn = page.locator('[data-direction="previous"], button[aria-label*="previous" i]').first();
      await expect(prevBtn).toBeVisible();
      await prevBtn.click();

      const firstSlide = slides.first();
      await expect.poll(async () => {
        return await firstSlide.evaluate((el) => window.getComputedStyle(el).order);
      }, { timeout: 5000 }).toBe('1');
    });

    test('Slides other than a parked end slide have a computed order of 0', async ({ page }) => {
      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);

      // On initial load, slide 0 is current, slide 2 is parked (-1).
      // Middle slide (index 1) is not parked.
      const middleSlide = slides.nth(1);
      await expect.poll(async () => {
        return await middleSlide.evaluate((el) => window.getComputedStyle(el).order);
      }, { timeout: 5000 }).toBe('0');

      // The first slide itself is current and not parked as an end neighbor, so it also computes to 0.
      const firstSlide = slides.first();
      const firstOrder = await firstSlide.evaluate((el) => window.getComputedStyle(el).order);
      expect(firstOrder).toBe('0');
    });

    test('A parked slide is inert while it is parked', async ({ page }) => {
      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);

      // While slide 0 is current, the last slide is parked and must be inert.
      const lastSlide = slides.last();
      await expect.poll(async () => {
        return await lastSlide.evaluate((el) => el.hasAttribute('inert') || (el as HTMLElement).inert === true);
      }, { timeout: 5000 }).toBe(true);

      // The active and unparked slides must not be inert.
      const firstSlide = slides.first();
      const middleSlide = slides.nth(1);
      const firstInert = await firstSlide.evaluate((el) => el.hasAttribute('inert') || (el as HTMLElement).inert === true);
      const middleInert = await middleSlide.evaluate((el) => el.hasAttribute('inert') || (el as HTMLElement).inert === true);
      expect(firstInert).toBe(false);
      expect(middleInert).toBe(false);
    });

    test('Looping does not change the DOM order of the slides', async ({ page }) => {
      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);

      const initialSlideMarkers = await slides.evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label') || el.querySelector('h3')?.textContent?.trim()),
      );
      expect(initialSlideMarkers.length).toBe(3);

      const prevBtn = page.locator('[data-direction="previous"], button[aria-label*="previous" i]').first();
      await expect(prevBtn).toBeVisible();
      await prevBtn.click();
      await page.waitForTimeout(300);

      const nextBtn = page.locator('[data-direction="next"], button[aria-label*="next" i]').first();
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();
      await page.waitForTimeout(300);

      const currentSlideMarkers = await slides.evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label') || el.querySelector('h3')?.textContent?.trim()),
      );
      expect(currentSlideMarkers).toEqual(initialSlideMarkers);
    });

    test('The polite live status reads "Slide N of M" with the correct slide after wrapping from the last slide to the first', async ({ page }) => {
      const status = page.locator('[role="status"], [aria-live="polite"]');
      await expect(status).toHaveCount(1);

      const prevBtn = page.locator('[data-direction="previous"], button[aria-label*="previous" i]').first();
      const nextBtn = page.locator('[data-direction="next"], button[aria-label*="next" i]').first();
      await expect(prevBtn).toBeVisible();
      await expect(nextBtn).toBeVisible();

      // Go to last slide
      await prevBtn.click();
      await expect(status).toHaveText(/Slide\s+3\s+of\s+3/i, { timeout: 5000 });

      // Wrap to first slide
      await nextBtn.click();
      await expect(status).toHaveText(/Slide\s+1\s+of\s+3/i, { timeout: 5000 });
    });

    test('A polite live region (role="status" or aria-live="polite") starts empty on initial load and announces the current slide position after user-initiated scrolling settles', async ({ page }) => {
      const status = page.locator('[role="status"], [aria-live="polite"]');
      await expect(status).toHaveCount(1);

      const initialText = (await status.textContent())?.trim();
      expect(initialText).toBe('');

      const nextBtn = page.locator('[data-direction="next"], button[aria-label*="next" i]').first();
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();

      await expect(status).toHaveText(/Slide\s+2\s+of\s+3/i, { timeout: 5000 });
    });

    test('Without JavaScript, the first slide is the one in view when the page loads', async ({ browser, TARGET_URL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        await page.goto(TARGET_URL);
        const slides = page.locator('[role="group"][aria-roledescription="slide"]');
        await expect(slides).toHaveCount(3);

        const firstSlide = slides.first();
        await expect(firstSlide).toBeVisible();
        const box = await firstSlide.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.x).toBeGreaterThanOrEqual(-10);
      } finally {
        await context.close();
      }
    });

    test('The track and the control buttons set touch-action: manipulation', async ({ page }) => {
      const track = page.locator('.carousel-track, [aria-roledescription="carousel"] [role="group"]');
      await expect(track).toHaveCount(1);
      const trackTouch = await track.evaluate((el) => window.getComputedStyle(el).touchAction);
      expect(trackTouch).toBe('manipulation');

      const prevBtn = page.locator('[data-direction="previous"], button[aria-label*="previous" i]').first();
      await expect(prevBtn).toBeVisible();
      const prevTouch = await prevBtn.evaluate((el) => window.getComputedStyle(el).touchAction);
      expect(prevTouch).toBe('manipulation');

      const nextBtn = page.locator('[data-direction="next"], button[aria-label*="next" i]').first();
      await expect(nextBtn).toBeVisible();
      const nextTouch = await nextBtn.evaluate((el) => window.getComputedStyle(el).touchAction);
      expect(nextTouch).toBe('manipulation');
    });

    test('The carousel track remains scrollable via touch, pointer, and native keyboard scrolling without requiring JavaScript', async ({ browser, TARGET_URL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        await page.goto(TARGET_URL);
        const track = page.locator('.carousel-track, [tabindex="0"][role="group"]');
        await expect(track).toHaveCount(1);

        const tabIndex = await track.getAttribute('tabindex');
        expect(tabIndex).toBe('0');

        const overflow = await track.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return [style.overflow, style.overflowX, style.overflowY];
        });
        expect(overflow.some((v) => ['auto', 'scroll'].includes(v))).toBe(true);

        const canScroll = await track.evaluate(
          (el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
        );
        expect(canScroll).toBe(true);
      } finally {
        await context.close();
      }
    });

    test('Custom key handling does not intercept keys from focused links, form fields, or buttons', async ({ page }) => {
      const link = page.locator('[role="group"][aria-roledescription="slide"] a, .carousel-slide a, .carousel-track a').first();
      await expect(link).toBeVisible();
      await link.focus();

      const notIntercepted = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const el = document.activeElement;
          if (!el) {
            resolve(false);
            return;
          }
          const handler = (e: KeyboardEvent) => {
            window.removeEventListener('keydown', handler, true);
            resolve(!e.defaultPrevented);
          };
          window.addEventListener('keydown', handler, true);
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        });
      });
      expect(notIntercepted).toBe(true);
    });

    test('Keyboard users can Tab sequentially through controls without encountering a keyboard trap', async ({ page }) => {
      const prevBtn = page.locator('[data-direction="previous"], button[aria-label*="previous" i]').first();
      await expect(prevBtn).toBeVisible();
      await prevBtn.focus();

      const visited = new Set<string>();
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const identifier = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? `${el.tagName}:${el.getAttribute('aria-label') || el.textContent?.trim() || ''}` : '';
        });
        if (identifier) visited.add(identifier);
      }

      // Focus must have advanced through multiple distinct elements (no single-element trap)
      expect(visited.size).toBeGreaterThan(2);

      // Focus must be able to reach outside the carousel controls/container (no container trap)
      const reachedOutside = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(active && (active.closest('footer') || !active.closest('.carousel, [aria-roledescription="carousel"]')));
      });
      expect(reachedOutside).toBe(true);
    });

    test('Activating the Previous or Next button moves the carousel to the adjacent slide in visual order', async ({ page }) => {
      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);

      const nextBtn = page.locator('[data-direction="next"], button[aria-label*="next" i]').first();
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();

      const slide2 = slides.nth(1);
      await expect.poll(async () => {
        return await slide2.evaluate((el) => {
          const track = el.closest('.carousel-track') || el.parentElement!;
          const tr = track.getBoundingClientRect();
          const sr = el.getBoundingClientRect();
          return (
            Math.abs((tr.left + tr.right) / 2 - (sr.left + sr.right) / 2) < tr.width / 3 ||
            Math.abs((tr.top + tr.bottom) / 2 - (sr.top + sr.bottom) / 2) < tr.height / 3
          );
        });
      }, { timeout: 5000 }).toBe(true);
    });

    test('The carousel has one HTML marker <button> per slide, and activating a marker button navigates to its corresponding slide', async ({ page }) => {
      const markerNav = page.locator('.carousel-markers, nav[aria-label*="slide" i]');
      const markers = markerNav.locator('button');
      await expect(markers).toHaveCount(3);

      // Click marker 3 (index 2)
      await markers.nth(2).click();

      const slides = page.locator('[role="group"][aria-roledescription="slide"]');
      await expect(slides).toHaveCount(3);
      const slide3 = slides.nth(2);
      await expect.poll(async () => {
        return await slide3.evaluate((el) => {
          const track = el.closest('.carousel-track') || el.parentElement!;
          const tr = track.getBoundingClientRect();
          const sr = el.getBoundingClientRect();
          return (
            Math.abs((tr.left + tr.right) / 2 - (sr.left + sr.right) / 2) < tr.width / 3 ||
            Math.abs((tr.top + tr.bottom) / 2 - (sr.top + sr.bottom) / 2) < tr.height / 3
          );
        });
      }, { timeout: 5000 }).toBe(true);
    });

    test('Every marker button has an accessible name identifying its destination slide', async ({ page }) => {
      const markerNav = page.locator('.carousel-markers, nav[aria-label*="slide" i]');
      const markers = markerNav.locator('button');
      await expect(markers).toHaveCount(3);

      for (let i = 0; i < 3; i++) {
        const name = await markers.nth(i).evaluate((el) => el.getAttribute('aria-label') || el.textContent || '');
        expect(name.toLowerCase()).toMatch(new RegExp(`slide\\s*${i + 1}|\\b${i + 1}\\b`));
      }
    });

    test('The active marker button has aria-current="true", updated to reflect the active slide as soon as a marker or previous/next button is clicked and while the track scrolls, without waiting for scrolling to settle', async ({ page }) => {
      const markerNav = page.locator('.carousel-markers, nav[aria-label*="slide" i]');
      const markers = markerNav.locator('button');
      await expect(markers).toHaveCount(3);

      // Initial active marker is slide 1
      expect(await markers.first().getAttribute('aria-current')).toBe('true');
      expect(await markers.nth(1).getAttribute('aria-current')).not.toBe('true');

      const nextBtn = page.locator('[data-direction="next"], button[aria-label*="next" i]').first();
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();

      // Check immediately without waiting for scroll to settle
      expect(await markers.nth(1).getAttribute('aria-current')).toBe('true');
      expect(await markers.first().getAttribute('aria-current')).not.toBe('true');
    });

    test('The carousel does not autoplay slides or continuously poll scroll positions on every animation frame', async ({ page }) => {
      const carousel = page.locator('[aria-roledescription="carousel"], .carousel');
      await expect(carousel).toBeVisible();

      const track = page.locator('.carousel-track, [aria-roledescription="carousel"] [role="group"]');
      await expect(track).toHaveCount(1);

      const initialScroll = await track.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
      await page.waitForTimeout(1000);
      const currentScroll = await track.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
      expect(currentScroll).toEqual(initialScroll);

      const markerNav = page.locator('.carousel-markers, nav[aria-label*="slide" i]');
      const markers = markerNav.locator('button');
      if ((await markers.count()) > 0) {
        expect(await markers.first().getAttribute('aria-current')).toBe('true');
      }
    });

  });
});
