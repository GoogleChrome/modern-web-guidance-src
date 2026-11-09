import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, closestRule, CSSMediaRule } from 'cssomnom';
import type { Page, Locator } from '@playwright/test';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

// Every element is located through the ARIA contract the guide requires (carousel region,
// slide groups, named Previous/Next buttons), never through the guide snippet's class names,
// because the task establishes no classes or ids.
const SLIDE = '[role="group"][aria-roledescription="slide"]';
const carouselOf = (page: Page) => page.locator('[aria-roledescription="carousel"]').first();
const slidesOf = (page: Page) => page.locator(SLIDE);
const trackOf = (page: Page) => slidesOf(page).first().locator('xpath=..');
const prevOf = (page: Page) => carouselOf(page).getByRole('button', { name: /prev/i }).first();
const nextOf = (page: Page) => carouselOf(page).getByRole('button', { name: /next/i }).first();
const statusOf = (page: Page) => page.locator('[role="status"], [aria-live="polite"]');

/** Marker buttons: the sibling group of buttons in the carousel, outside the track and other than Previous/Next, with one button per slide. */
async function markersOf(page: Page): Promise<Locator[]> {
  const carousel = carouselOf(page);
  const indexes = await carousel.evaluate((root, slideSel) => {
    const slides = root.querySelectorAll(slideSel);
    const track = slides[0]?.parentElement;
    const buttons = Array.from(root.querySelectorAll('button'));
    const groups = new Map<Element, number[]>();
    buttons.forEach((b, i) => {
      const name = `${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`;
      if (!b.parentElement || track?.contains(b) || /\b(prev|next)/i.test(name)) return;
      groups.set(b.parentElement, [...(groups.get(b.parentElement) ?? []), i]);
    });
    return [...groups.values()].find((g) => g.length === slides.length) ?? [];
  }, SLIDE);
  return indexes.map((i) => carousel.locator('button').nth(i));
}

/** True when the slide's center is within a third of the track's center on either axis. */
const isCentered = (slide: Locator) =>
  slide.evaluate((el) => {
    const tr = (el.parentElement as Element).getBoundingClientRect();
    const sr = el.getBoundingClientRect();
    return (
      Math.abs((tr.left + tr.right) / 2 - (sr.left + sr.right) / 2) < tr.width / 3 &&
      Math.abs((tr.top + tr.bottom) / 2 - (sr.top + sr.bottom) / 2) < tr.height / 3
    );
  });

const computed = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test.describe('Daily Grind Carousel Grader', () => {

  // =========================================================================
  // STATIC ASSERTIONS
  // =========================================================================

  test('The carousel container is exposed as a labeled region with aria-roledescription="carousel" and an accessible name', () => {
    const docs = getHtmlDocuments(targetFiles);
    const container = docs
      .map((d) => d.document.querySelector('[aria-roledescription="carousel"]'))
      .find(Boolean);
    expect(container).toBeTruthy();
    if (!container) return;

    const labelledBy = container.getAttribute('aria-labelledby') ?? '';
    const label =
      container.getAttribute('aria-label')?.trim() ||
      labelledBy.split(/\s+/).map((id: string) => container.ownerDocument.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
    expect(label).toBeTruthy();
    expect(container.tagName === 'SECTION' || container.getAttribute('role') === 'region').toBe(true);
  });

  test('Each slide is exposed as a group with role="group", aria-roledescription="slide", and a position in its accessible name', () => {
    const docs = getHtmlDocuments(targetFiles);
    const slides = docs.flatMap((d) => Array.from(d.document.querySelectorAll('[aria-roledescription="slide"]')));
    expect(slides).toHaveLength(3);
    slides.forEach((slideNode, i) => {
      const slide = slideNode as any;
      expect(slide.getAttribute('role')).toBe('group');
      const labelledBy = slide.getAttribute('aria-labelledby');
      const label = slide.getAttribute('aria-label') ||
        (labelledBy ? slide.ownerDocument.getElementById(labelledBy)?.textContent?.trim() : '') || '';
      expect(label).toMatch(new RegExp(`\\b${i + 1}\\s+of\\s+3\\b`, 'i'));
    });
  });

  test('The carousel uses HTML Previous and Next <button> elements, each with an accessible name, that precede the track in DOM order, and does not use native ::scroll-button() or ::scroll-marker', () => {
    const docs = getHtmlDocuments(targetFiles);
    const doc = docs.find((d) => d.document.querySelector('[aria-roledescription="carousel"]'))?.document;
    expect(doc).toBeTruthy();
    if (!doc) return;
    const carousel = doc.querySelector('[aria-roledescription="carousel"]') as Element;
    const nameOf = (b: Element) => (b.getAttribute('aria-label') || b.textContent || '').trim();
    const buttons = Array.from(carousel.querySelectorAll('button'));
    const prev = buttons.find((b) => /prev/i.test(nameOf(b)));
    const next = buttons.find((b) => /next/i.test(nameOf(b)));
    const track = doc.querySelector('[aria-roledescription="slide"]')?.parentElement;
    expect(prev).toBeTruthy();
    expect(next).toBeTruthy();
    expect(track).toBeTruthy();
    if (!prev || !next || !track) return;

    const all = Array.from(doc.querySelectorAll('*'));
    expect(all.indexOf(prev)).toBeLessThan(all.indexOf(track));
    expect(all.indexOf(next)).toBeLessThan(all.indexOf(track));

    const nativePseudo = getRules(targetFiles, CSSStyleRule).some((r) => /::scroll-(button|marker)/.test(r.selectorText));
    expect(nativePseudo).toBe(false);
  });

  // =========================================================================
  // BROWSER ASSERTIONS
  // =========================================================================

  test.describe('Browser tests', () => {

    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('The carousel track has overflow-x: auto or overflow-y: auto (or overflow: auto) and uses mandatory scroll snapping on its scrolling axis', async ({ page }) => {
      const track = trackOf(page);
      await expect(track).toBeVisible();
      const { overflowX, overflowY, snap } = await track.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { overflowX: cs.overflowX, overflowY: cs.overflowY, snap: cs.scrollSnapType };
      });
      const scrollsX = ['auto', 'scroll'].includes(overflowX);
      const scrollsY = ['auto', 'scroll'].includes(overflowY);
      expect(scrollsX || scrollsY).toBe(true);
      expect(snap).toMatch(/mandatory/);
      const axisOk = (scrollsX && /\b(x|inline|both)\b/.test(snap)) || (scrollsY && /\b(y|block|both)\b/.test(snap));
      expect(axisOk).toBe(true);
    });

    test('Every carousel slide has scroll-snap-align: center (or start) applied so it acts as a snap target', async ({ page }) => {
      const slides = slidesOf(page);
      await expect(slides).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        expect(await computed(slides.nth(i), 'scroll-snap-align')).toMatch(/\b(center|start)\b/);
      }
    });

    test('Interactive carousel controls and marker buttons have a visible :focus-visible indicator', async ({ page }) => {
      const authored = getRules(targetFiles, CSSStyleRule).some((r) => r.selectorText.includes(':focus-visible'));
      expect(authored).toBe(true);

      const markers = await markersOf(page);
      expect(markers).toHaveLength(3);
      for (const control of [prevOf(page), nextOf(page), markers[0]]) {
        await control.focus();
        const indicator = await control.evaluate((el) => {
          const cs = getComputedStyle(el);
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          return el.matches(':focus-visible') && (outline || cs.boxShadow !== 'none');
        });
        expect(indicator).toBe(true);
      }
    });

    test('Previous and next controls stay enabled at the first and last slides, because the carousel loops', async ({ page }) => {
      const prev = prevOf(page);
      const next = nextOf(page);
      await expect(prev).toBeEnabled();
      await expect(next).toBeEnabled();

      await prev.click();
      await expect.poll(() => isCentered(slidesOf(page).last())).toBe(true);
      await expect(statusOf(page)).toHaveText(/Slide\s+3\s+of\s+3/i);
      await expect(prev).toBeEnabled();
      await expect(next).toBeEnabled();
    });

    test('Activating Next while the last slide is current brings the first slide into view, and activating Previous while the first slide is current brings the last slide into view', async ({ page }) => {
      const slides = slidesOf(page);
      await expect(slides).toHaveCount(3);
      await prevOf(page).click();
      await expect.poll(() => isCentered(slides.last())).toBe(true);
      await expect(statusOf(page)).toHaveText(/Slide\s+3\s+of\s+3/i);
      await nextOf(page).click();
      await expect.poll(() => isCentered(slides.first())).toBe(true);
    });

    test('Looping does not duplicate slides: the track contains exactly one slide element per slide, with no cloned or aria-hidden copies', async ({ page }) => {
      const track = trackOf(page);
      await expect(track.locator('> *')).toHaveCount(3);
      await expect(track.locator('> [aria-hidden="true"]')).toHaveCount(0);
      // Still true after wrapping.
      await prevOf(page).click();
      await expect(statusOf(page)).toHaveText(/Slide\s+3\s+of\s+3/i);
      await expect(track.locator('> *')).toHaveCount(3);
    });

    test('While the first slide is current, the last slide has a computed order of -1', async ({ page }) => {
      await expect.poll(() => computed(slidesOf(page).last(), 'order')).toBe('-1');
    });

    test('While the last slide is current, the first slide has a computed order of 1', async ({ page }) => {
      await prevOf(page).click();
      await expect.poll(() => computed(slidesOf(page).first(), 'order')).toBe('1');
    });

    test('Slides other than a parked end slide have a computed order of 0', async ({ page }) => {
      const slides = slidesOf(page);
      await expect.poll(() => computed(slides.nth(1), 'order')).toBe('0');
      expect(await computed(slides.first(), 'order')).toBe('0');
    });

    test('A parked slide is inert while it is parked', async ({ page }) => {
      const slides = slidesOf(page);
      const inert = (l: Locator) => l.evaluate((el) => (el as HTMLElement).inert);
      await expect.poll(() => inert(slides.last())).toBe(true);
      expect(await inert(slides.first())).toBe(false);
      expect(await inert(slides.nth(1))).toBe(false);
    });

    test('Looping does not change the DOM order of the slides', async ({ page }) => {
      const track = trackOf(page);
      const labelsOf = () => slidesOf(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      const initial = await labelsOf();
      await track.evaluate((el) => {
        const w = window as unknown as { __childMutations: number };
        w.__childMutations = 0;
        new MutationObserver((records) => { w.__childMutations += records.length; }).observe(el, { childList: true });
      });

      await prevOf(page).click();
      await expect(statusOf(page)).toHaveText(/Slide\s+3\s+of\s+3/i);
      await nextOf(page).click();
      await expect(statusOf(page)).toHaveText(/Slide\s+1\s+of\s+3/i);

      expect(await page.evaluate(() => (window as unknown as { __childMutations: number }).__childMutations)).toBe(0);
      expect(await labelsOf()).toEqual(initial);
    });

    test('The polite live status reads "Slide N of M" with the correct slide after wrapping from the last slide to the first', async ({ page }) => {
      const status = statusOf(page);
      await expect(status).toHaveCount(1);
      await prevOf(page).click();
      await expect(status).toHaveText(/Slide\s+3\s+of\s+3/i);
      await nextOf(page).click();
      await expect(status).toHaveText(/Slide\s+1\s+of\s+3/i);
    });

    test('A polite live region (role="status" or aria-live="polite") starts empty on initial load and announces the current slide position after user-initiated scrolling settles', async ({ page }) => {
      const status = statusOf(page);
      await expect(status).toHaveCount(1);
      expect((await status.textContent())?.trim()).toBe('');

      // Direct scrolling (not a button) must also be announced once it settles.
      const track = trackOf(page);
      const box = await slidesOf(page).nth(1).boundingBox();
      await track.evaluate((el, dx) => el.scrollBy({ left: dx, top: 0 }), (box?.width ?? 0));
      await expect(status).toHaveText(/Slide\s+2\s+of\s+3/i);
    });

    test('Without JavaScript, the first slide is the one in view when the page loads', async ({ browser, TARGET_URL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        await page.goto(TARGET_URL);
        const slides = slidesOf(page);
        await expect(slides).toHaveCount(3);
        await expect.poll(() => isCentered(slides.first())).toBe(true);
        expect(await isCentered(slides.last())).toBe(false);
      } finally {
        await context.close();
      }
    });

    test('The track and the control buttons set touch-action: manipulation', async ({ page }) => {
      for (const el of [trackOf(page), prevOf(page), nextOf(page)]) {
        await expect(el).toBeVisible();
        const touch = await computed(el, 'touch-action');
        if (touch !== 'manipulation') {
          const stylesheet = getCssStyleSheet(targetFiles);
          const rules = getRules(stylesheet, CSSStyleRule);
          const hasManipulation = rules.some((r) =>
            (r.style.getPropertyValue('scroll-snap-type') || r.style.getPropertyValue('overflow-x') === 'auto' || /track|carousel|slider|slide/i.test(r.selectorText)) &&
            /manipulation/.test(r.style.getPropertyValue('touch-action') || '')
          );
          expect(hasManipulation).toBe(true);
        } else {
          expect(touch).toBe('manipulation');
        }
      }
    });

    test('The carousel track remains scrollable via touch, pointer, and native keyboard scrolling without requiring JavaScript', async ({ browser, TARGET_URL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        await page.goto(TARGET_URL);
        const track = trackOf(page);
        await expect(track).toBeVisible();
        const overflow = await track.evaluate((el) => [getComputedStyle(el).overflowX, getComputedStyle(el).overflowY]);
        expect(overflow.some((v) => ['auto', 'scroll'].includes(v))).toBe(true);

        // Native keyboard scrolling: focus the track and press the arrow key for its axis.
        await track.focus();
        expect(await track.evaluate((el) => document.activeElement === el)).toBe(true);
        const horizontal = overflow[0] === 'auto' || overflow[0] === 'scroll';
        await page.keyboard.press(horizontal ? 'ArrowRight' : 'ArrowDown');
        await expect.poll(() => track.evaluate((el) => el.scrollLeft + el.scrollTop)).toBeGreaterThan(0);
      } finally {
        await context.close();
      }
    });

    test('Custom key handling does not intercept keys from focused links, form fields, or buttons', async ({ page }) => {
      const link = slidesOf(page).first().locator('a').first();
      await expect(link).toBeVisible();
      const intercepted = await page.evaluate((slideSel) => {
        const root = document.querySelector('[aria-roledescription="carousel"]');
        const targets = [
          root?.querySelector(`${slideSel} a`),
          ...Array.from(root?.querySelectorAll('button') ?? []),
        ].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.closest('[inert]'));
        const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '];
        const hits: string[] = [];
        for (const el of targets) {
          for (const key of keys) {
            el.focus();
            // dispatchEvent returns false when any listener (at any phase) called preventDefault().
            const notCanceled = el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            if (!notCanceled) hits.push(`${el.tagName}:${key}`);
          }
        }
        return hits;
      }, SLIDE);
      expect(intercepted).toEqual([]);
    });

    test('Keyboard users can Tab sequentially through controls without encountering a keyboard trap', async ({ page }) => {
      await prevOf(page).focus();
      const visited = new Set<string>();
      let escaped = false;
      for (let i = 0; i < 20 && !escaped; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            id: el ? `${el.tagName}:${el.getAttribute('aria-label') || el.textContent?.trim() || ''}` : '',
            outside: Boolean(el && el !== document.body && !el.closest('[aria-roledescription="carousel"]')),
          };
        });
        visited.add(info.id);
        escaped = info.outside;
      }
      expect(visited.size).toBeGreaterThan(2);
      expect(escaped).toBe(true);
    });

    test('Activating the Previous or Next button moves the carousel to the adjacent slide in visual order', async ({ page }) => {
      const slides = slidesOf(page);
      await nextOf(page).click();
      await expect.poll(() => isCentered(slides.nth(1))).toBe(true);
      await expect(statusOf(page)).toHaveText(/Slide\s+2\s+of\s+3/i);
      // Previous targets the slide visually before slide 2, which can be a parked end slide.
      const visualPrev = await slides.evaluateAll((els) => {
        const horizontal = ['auto', 'scroll'].includes(getComputedStyle(els[0].parentElement as Element).overflowX);
        const start = (el: Element) => (horizontal ? el.getBoundingClientRect().left : el.getBoundingClientRect().top);
        const visual = [...els].sort((a, b) => start(a) - start(b));
        return els.indexOf(visual[visual.indexOf(els[1]) - 1]);
      });
      expect(visualPrev).toBeGreaterThanOrEqual(0);
      await prevOf(page).click();
      await expect.poll(() => isCentered(slides.nth(visualPrev))).toBe(true);
    });

    test('The carousel has one HTML marker <button> per slide, and activating a marker button navigates to its corresponding slide', async ({ page }) => {
      const markers = await markersOf(page);
      expect(markers).toHaveLength(3);
      await markers[2].click();
      await expect.poll(() => isCentered(slidesOf(page).nth(2))).toBe(true);
    });

    test('Every marker button has an accessible name identifying its destination slide', async ({ page }) => {
      const markers = await markersOf(page);
      expect(markers).toHaveLength(3);
      const headings = await slidesOf(page).evaluateAll((els) =>
        els.map((el) => el.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim().toLowerCase() ?? ''),
      );
      for (let i = 0; i < 3; i++) {
        const name = (await markers[i].evaluate((el) => el.getAttribute('aria-label') || el.textContent || '')).toLowerCase();
        const byNumber = new RegExp(`\\b${i + 1}\\b`).test(name);
        const byHeading = headings[i] !== '' && name.includes(headings[i]);
        expect(byNumber || byHeading).toBe(true);
      }
    });

    test('The active marker button has aria-current="true", updated to reflect the active slide as soon as a marker or previous/next button is clicked and while the track scrolls, without waiting for scrolling to settle', async ({ page }) => {
      const markers = await markersOf(page);
      expect(markers).toHaveLength(3);
      await expect(markers[0]).toHaveAttribute('aria-current', 'true');

      // Click Next and read the second marker two frames later, while the (smooth) scroll is still in flight.
      const next = await nextOf(page).elementHandle();
      const currentBeforeSettle = await markers[1].evaluate((marker, btn) => new Promise<boolean>((resolve) => {
        (btn as HTMLElement).click();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(marker.getAttribute('aria-current') === 'true')));
      }), next);
      expect(currentBeforeSettle).toBe(true);
      await expect(markers[1]).toHaveAttribute('aria-current', 'true');
      await expect(markers[0]).not.toHaveAttribute('aria-current', 'true');
    });

    test('Smooth scrolling (scroll-behavior: smooth) and any optional scroll-driven slide effects or transitions are wrapped in @media (prefers-reduced-motion: no-preference)', async ({ page, TARGET_URL }) => {
      // Smooth scrolling is optional; when present in CSS it must sit inside the no-preference query.
      const smoothOutside = getRules(getCssStyleSheet(targetFiles), CSSStyleRule).filter((r) => {
        if (r.style.getPropertyValue('scroll-behavior') !== 'smooth') return false;
        const media = closestRule(r, CSSMediaRule);
        return !media || !/prefers-reduced-motion\s*:\s*no-preference/.test(media.conditionText);
      });
      expect(smoothOutside).toHaveLength(0);

      // Behaviorally, with reduced motion requested, Next must jump instantly (covers JS smooth scrolling too).
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(TARGET_URL);
      const slides = slidesOf(page);
      await expect(slides).toHaveCount(3);
      const instant = await nextOf(page).evaluate((btn, slideSel) => new Promise<boolean>((resolve) => {
        const slide2 = document.querySelectorAll(slideSel)[1] as HTMLElement;
        const track = slide2.parentElement as HTMLElement;
        (btn as HTMLElement).click();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const tr = track.getBoundingClientRect();
          const sr = slide2.getBoundingClientRect();
          resolve(Math.abs((tr.left + tr.right) / 2 - (sr.left + sr.right) / 2) < 2 &&
            Math.abs((tr.top + tr.bottom) / 2 - (sr.top + sr.bottom) / 2) < 2);
        }));
      }), SLIDE);
      expect(instant).toBe(true);
    });

    test('The carousel does not autoplay slides or continuously poll scroll positions on every animation frame', async ({ page, browser, TARGET_URL }) => {
      test.setTimeout(20_000);
      // No per-frame polling: count requestAnimationFrame calls while the page sits idle.
      await page.addInitScript(() => {
        const w = window as unknown as { __raf: number };
        w.__raf = 0;
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => { w.__raf++; return raf(cb); };
      });
      await page.goto(TARGET_URL);
      await expect(slidesOf(page)).toHaveCount(3);
      await page.waitForTimeout(500); // let load-time frames finish
      const before = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
      await page.waitForTimeout(1000); // measurement window, not a settle wait
      const after = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
      expect(after - before).toBeLessThan(10);

      // No autoplay: fast-forward 30s of timers and confirm nothing moved.
      const context = await browser.newContext();
      const p2 = await context.newPage();
      try {
        await p2.clock.install();
        await p2.goto(TARGET_URL);
        const track = trackOf(p2);
        await expect(track).toBeVisible();
        const pos = () => track.evaluate((el) => el.scrollLeft + el.scrollTop);
        const start = await pos();
        await p2.clock.runFor(30_000);
        expect(await pos()).toBe(start);
        expect((await statusOf(p2).textContent())?.trim()).toBe('');
      } finally {
        await context.close();
      }
    });
  });
});
