// Expectation 1: TESTED - Buttons ("View Details") exist in the drink cards and require hover visual feedback.
// Expectation 2: TESTED - Buttons ("View Details") exist in the drink cards and require active/press visual feedback distinct from hover.
// Expectation 3: TESTED - Buttons and links exist and require a keyboard focus ring with >= 3:1 contrast against the background.
// Expectation 4: TESTED - Buttons exist and clicking them with a mouse must not trigger a keyboard focus outline.
// Expectation 5: TESTED - Popovers/dropdowns triggered by "View Details" buttons open with an animated transform or scale.
// Expectation 6: TESTED - Popovers/dropdowns triggered by "View Details" buttons compute a transform-origin on the edge nearest the trigger.
// Expectation 7: TESTED - The Seasonal Favorites horizontal row of drink cards requires scroll-snap-type on x/inline and scroll-snap-align on items.
// Expectation 8: SKIPPED - Base application has no in-place hover-revealed controls or content outside popovers/menus; all card actions are visible by default in the base app.
// Expectation 9: TESTED - Popovers/dropdowns triggered by "View Details" buttons must not animate transform/scale when prefers-reduced-motion: reduce is active.

import {
  test,
  expect,
} from '../../../../../src/grading/test-fixture.ts';

function getVisualState(el: Element) {
  const cs = window.getComputedStyle(el);
  return {
    backgroundColor: cs.backgroundColor,
    color: cs.color,
    borderColor: `${cs.borderTopColor} | ${cs.borderRightColor} | ${cs.borderBottomColor} | ${cs.borderLeftColor}`,
    boxShadow: cs.boxShadow,
    transform: cs.transform,
    scale: cs.scale,
    translate: cs.translate,
    rotate: cs.rotate,
  };
}

function hasVisualDifference(
  a: ReturnType<typeof getVisualState>,
  b: ReturnType<typeof getVisualState>,
): boolean {
  return (
    a.backgroundColor !== b.backgroundColor ||
    a.color !== b.color ||
    a.borderColor !== b.borderColor ||
    a.boxShadow !== b.boxShadow ||
    a.transform !== b.transform ||
    a.scale !== b.scale ||
    a.translate !== b.translate ||
    a.rotate !== b.rotate
  );
}

test.describe('natural-interactions Target Grader', () => {
  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Expectation 1: Hovering a button changes at least one of its computed background-color, color, border-color, box-shadow, transform, scale, or other individual transform property values', async ({ page }) => {
      const btn = page.locator('button').filter({ hasText: /view details/i }).first();
      await expect(btn).toHaveCount(1);

      const card = page.locator('.card').first();
      await card.hover();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);

      const initialState = await btn.evaluate(getVisualState);

      await btn.hover();
      await page.waitForTimeout(250);

      const hoverState = await btn.evaluate(getVisualState);
      expect(hasVisualDifference(initialState, hoverState)).toBe(true);
    });

    test('Expectation 2: Pressing the mouse button down on a button, before releasing it, changes at least one of its computed background-color, color, border-color, box-shadow, transform, scale, or other individual transform property values compared with its hover state', async ({ page }) => {
      const btn = page.locator('button').filter({ hasText: /view details/i }).first();
      await expect(btn).toHaveCount(1);

      await btn.hover();
      await btn.evaluate((el) => el.getAnimations().forEach((a) => a.finish()));
      const hoverState = await btn.evaluate(getVisualState);

      await page.mouse.down();
      await btn.evaluate((el) => el.getAnimations().forEach((a) => a.finish()));
      const activeState = await btn.evaluate(getVisualState);
      await page.mouse.up();

      expect(hasVisualDifference(hoverState, activeState)).toBe(true);
    });

    test('Expectation 3: Moving keyboard focus to a button or link with the Tab key gives it either the browser native focus ring or a custom outline or box-shadow with at least 3:1 contrast ratio against the page background', async ({ page }) => {
      const target = page.locator('button').filter({ hasText: /view details/i }).first();
      await expect(target).toHaveCount(1);

      const unfocused = await target.evaluate((el) => {
        el.getAnimations().forEach((a) => a.finish());
        const cs = window.getComputedStyle(el);
        return {
          outlineStyle: cs.outlineStyle,
          outlineWidth: parseFloat(cs.outlineWidth) || 0,
          outlineColor: cs.outlineColor,
          boxShadow: cs.boxShadow,
        };
      });

      await page.keyboard.press('Tab');
      await target.focus();

      const focusAnalysis = await target.evaluate((el, unfocusedState) => {
        el.getAnimations().forEach((a) => a.finish());
        const cs = window.getComputedStyle(el);

        function parseRgba(colorStr: string): [number, number, number, number] | null {
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = colorStr;
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          return [data[0], data[1], data[2], data[3] / 255];
        }

        function srgbChannelToLuminance(c: number): number {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        }

        function getLuminance(rgb: [number, number, number, number]): number {
          return (
            0.2126 * srgbChannelToLuminance(rgb[0]) +
            0.7152 * srgbChannelToLuminance(rgb[1]) +
            0.0722 * srgbChannelToLuminance(rgb[2])
          );
        }

        function contrastRatio(c1: [number, number, number, number], c2: [number, number, number, number]): number {
          const l1 = getLuminance(c1);
          const l2 = getLuminance(c2);
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        }

        const isNativeAuto = cs.outlineStyle === 'auto' && parseFloat(cs.outlineWidth) > 0;
        const hasCustomOutline =
          cs.outlineStyle !== 'none' &&
          cs.outlineStyle !== 'auto' &&
          parseFloat(cs.outlineWidth) > 0 &&
          (cs.outlineStyle !== unfocusedState.outlineStyle ||
            parseFloat(cs.outlineWidth) !== unfocusedState.outlineWidth ||
            cs.outlineColor !== unfocusedState.outlineColor);
        const hasCustomBoxShadow = cs.boxShadow !== 'none' && cs.boxShadow !== unfocusedState.boxShadow;

        const bodyBgStr = window.getComputedStyle(document.body).backgroundColor;
        const bodyBg = parseRgba(bodyBgStr) || [250, 250, 250, 1];
        const effectiveBg: [number, number, number, number] = bodyBg[3] === 0 ? [255, 255, 255, 1] : bodyBg;

        const candidateColors: string[] = [];
        if (hasCustomOutline) candidateColors.push(cs.outlineColor);
        if (hasCustomBoxShadow) {
          const matches = cs.boxShadow.match(/(?:rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/g);
          if (matches) candidateColors.push(...matches);
        }

        let ratio = 0;
        for (const colorStr of candidateColors) {
          const parsed = parseRgba(colorStr);
          if (!parsed || parsed[3] === 0) continue;
          const alpha = parsed[3];
          const composited: [number, number, number, number] = [
            Math.round(parsed[0] * alpha + effectiveBg[0] * (1 - alpha)),
            Math.round(parsed[1] * alpha + effectiveBg[1] * (1 - alpha)),
            Math.round(parsed[2] * alpha + effectiveBg[2] * (1 - alpha)),
            1,
          ];
          ratio = Math.max(ratio, contrastRatio(composited, effectiveBg));
        }

        return {
          isNativeAuto,
          hasCustomOutline,
          hasCustomBoxShadow,
          ratio,
        };
      }, unfocused);

      const hasValidFocusIndicator =
        focusAnalysis.isNativeAuto ||
        ((focusAnalysis.hasCustomOutline || focusAnalysis.hasCustomBoxShadow) && focusAnalysis.ratio >= 3);
      expect(hasValidFocusIndicator).toBe(true);
    });

    test('Expectation 4: Clicking a button with the mouse does not give it the keyboard focus outline', async ({ page }) => {
      const btn = page.locator('button').filter({ hasText: /view details/i }).first();
      await expect(btn).toHaveCount(1);

      await page.keyboard.press('Tab');
      const hasKeyboardFocusRing = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const cs = window.getComputedStyle(el);
        return (cs.outlineStyle !== 'none' && (parseFloat(cs.outlineWidth) || 0) > 0) || cs.boxShadow !== 'none';
      });
      expect(hasKeyboardFocusRing).toBe(true);

      await btn.click();

      const outlineAfterClick = await btn.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        const matchesFocusVisible = el.matches(':focus-visible');
        const hasVisibleOutline = cs.outlineStyle !== 'none' && (parseFloat(cs.outlineWidth) || 0) > 0;
        return { matchesFocusVisible, hasVisibleOutline };
      });

      expect(outlineAfterClick.matchesFocusVisible).toBe(false);
      expect(outlineAfterClick.hasVisibleOutline).toBe(false);
    });

    test('Expectation 5: Shortly after a popover or dropdown that opens next to its trigger starts opening, its computed transform, scale, or other individual transform property differs from its final settled value', async ({ page }) => {
      const btn = page.locator('button').filter({ hasText: /view details/i }).first();
      await expect(btn).toHaveCount(1);

      await btn.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));

      const snapshotResult = await page.evaluate(async () => {
        const trigger =
          Array.from(document.querySelectorAll('button')).find((b) =>
            /view details/i.test(b.textContent || ''),
          ) ||
          (document.querySelector('.card button[popovertarget], .card button[commandfor], .card button[aria-controls]') as HTMLElement | null);
        if (!trigger) return null;

        const hookedAnims: Animation[] = [];
        const origAnimate = Element.prototype.animate;
        Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
          const anim = origAnimate.apply(this, args);
          hookedAnims.push(anim);
          return anim;
        };

        try {
          trigger.click();

          const isOpenOrVisible = (el: Element | null): el is HTMLElement => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.matches(':popover-open, [open], .is-open, .\\:popover-open')) return true;
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };

          const findDisclosure = (): HTMLElement | null => {
            const targetId =
              trigger.getAttribute('popovertarget') ||
              trigger.getAttribute('commandfor') ||
              trigger.getAttribute('aria-controls');
            const byId = targetId ? document.getElementById(targetId) : null;
            if (isOpenOrVisible(byId)) return byId;
            return document.querySelector<HTMLElement>(
              'dialog[open], [popover]:popover-open, [popover].is-open, [popover].\\:popover-open, dialog.is-open',
            );
          };

          let disclosure = findDisclosure();
          for (let i = 0; i < 30 && !disclosure; i++) {
            await new Promise((r) => setTimeout(r, 20));
            disclosure = findDisclosure();
          }
          if (!disclosure) return null;

          void window.getComputedStyle(disclosure).transform;
          const collectAnims = () =>
            Array.from(
              new Set([
                ...disclosure!.getAnimations({ subtree: true }),
                ...hookedAnims.filter((a) => {
                  const t = (a.effect as KeyframeEffect | null)?.target;
                  return t instanceof Node && disclosure!.contains(t);
                }),
              ]),
            );
          let anims = collectAnims();
          if (anims.length === 0) {
            await new Promise((r) => requestAnimationFrame(r));
            anims = collectAnims();
          }

          const rawTargets = Array.from(
            new Set([
              disclosure,
              ...anims
                .map((a) => (a.effect as KeyframeEffect | null)?.target)
                .filter((t): t is Element => t instanceof Element && disclosure!.contains(t)),
            ]),
          );

          for (const anim of anims) {
            const timing = anim.effect?.getComputedTiming();
            const delay = Number(timing?.delay || 0);
            const dur = Number(timing?.duration || 100);
            anim.pause();
            anim.currentTime = delay + Math.min(20, dur * 0.15);
          }
          const rawEarlyList = rawTargets.map((el) => {
            const cs = window.getComputedStyle(el);
            return {
              transform: cs.transform,
              scale: cs.scale,
              translate: cs.translate,
              rotate: cs.rotate,
            };
          });

          for (const anim of anims) {
            anim.finish();
          }
          const dRect = disclosure.getBoundingClientRect();
          const isValidSurface = (el: Element) => {
            if (el === disclosure) return true;
            const r = el.getBoundingClientRect();
            return r.width >= dRect.width * 0.5 && r.height >= dRect.height * 0.5;
          };

          const validIndices = rawTargets
            .map((el, idx) => (isValidSurface(el) ? idx : -1))
            .filter((idx) => idx >= 0);
          const earlyList = validIndices.map((idx) => rawEarlyList[idx]);
          const settledList = validIndices.map((idx) => {
            const cs = window.getComputedStyle(rawTargets[idx]);
            return {
              transform: cs.transform,
              scale: cs.scale,
              translate: cs.translate,
              rotate: cs.rotate,
            };
          });

          const activeIdx = earlyList.findIndex(
            (e, idx) =>
              e.transform !== settledList[idx].transform ||
              e.scale !== settledList[idx].scale ||
              e.translate !== settledList[idx].translate ||
              e.rotate !== settledList[idx].rotate,
          );
          const chosenIdx = activeIdx >= 0 ? activeIdx : 0;
          return { early: earlyList[chosenIdx], settled: settledList[chosenIdx] };
        } finally {
          Element.prototype.animate = origAnimate;
        }
      });

      expect(snapshotResult).not.toBeNull();
      const { early, settled } = snapshotResult!;
      const differed =
        early.transform !== settled.transform ||
        early.scale !== settled.scale ||
        early.translate !== settled.translate ||
        early.rotate !== settled.rotate;
      expect(differed).toBe(true);
    });

    test('Expectation 6: A popover or dropdown that scales open computes a transform-origin on its edge nearest its trigger', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 2400 });

      const btn = page.locator('button').filter({ hasText: /view details/i }).first();
      await expect(btn).toHaveCount(1);

      const originAnalysis = await page.evaluate(async () => {
        const trigger =
          Array.from(document.querySelectorAll('button')).find((b) =>
            /view details/i.test(b.textContent || ''),
          ) ||
          (document.querySelector('.card button[popovertarget], .card button[commandfor], .card button[aria-controls]') as HTMLElement | null);
        if (!trigger) return null;

        const hookedAnims: Animation[] = [];
        const origAnimate = Element.prototype.animate;
        Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
          const anim = origAnimate.apply(this, args);
          hookedAnims.push(anim);
          return anim;
        };

        try {
          trigger.click();

          const isOpenOrVisible = (el: Element | null): el is HTMLElement => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.matches(':popover-open, [open], .is-open, .\\:popover-open')) return true;
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };

          const findDisclosure = (): HTMLElement | null => {
            const targetId =
              trigger.getAttribute('popovertarget') ||
              trigger.getAttribute('commandfor') ||
              trigger.getAttribute('aria-controls');
            const byId = targetId ? document.getElementById(targetId) : null;
            if (isOpenOrVisible(byId)) return byId;
            return document.querySelector<HTMLElement>(
              'dialog[open], [popover]:popover-open, [popover].is-open, [popover].\\:popover-open, dialog.is-open',
            );
          };

          let disclosure = findDisclosure();
          for (let i = 0; i < 30 && !disclosure; i++) {
            await new Promise((r) => setTimeout(r, 20));
            disclosure = findDisclosure();
          }
          if (!disclosure) return null;

          void window.getComputedStyle(disclosure).transform;
          const collectAnims = () =>
            Array.from(
              new Set([
                ...disclosure!.getAnimations({ subtree: true }),
                ...hookedAnims.filter((a) => {
                  const t = (a.effect as KeyframeEffect | null)?.target;
                  return t instanceof Node && disclosure!.contains(t);
                }),
              ]),
            );
          let anims = collectAnims();
          if (anims.length === 0) {
            await new Promise((r) => requestAnimationFrame(r));
            anims = collectAnims();
          }

          for (const anim of anims) {
            const delay = Number(anim.effect?.getComputedTiming().delay || 0);
            anim.pause();
            anim.currentTime = delay;
          }
          const earlyRect = disclosure.getBoundingClientRect();

          for (const anim of anims) {
            anim.finish();
          }

          const dRect = disclosure.getBoundingClientRect();
          const isValidSurface = (el: Element) => {
            if (el === disclosure) return true;
            const r = el.getBoundingClientRect();
            return r.width >= dRect.width * 0.5 && r.height >= dRect.height * 0.5;
          };

          const candidateSurfaces = Array.from(
            new Set([
              disclosure,
              ...anims
                .map((a) => (a.effect as KeyframeEffect | null)?.target)
                .filter((t): t is Element => t instanceof Element && disclosure!.contains(t) && isValidSurface(t)),
            ]),
          );

          const tRect = trigger.getBoundingClientRect();
          const checkSurface = (surface: Element) => {
            const cs = window.getComputedStyle(surface);
            const [oxStr, oyStr] = cs.transformOrigin.split(/\s+/);
            const ox = parseFloat(oxStr);
            const oy = parseFloat(oyStr);
            const pRect = surface.getBoundingClientRect();

            const explicitlyAbove = pRect.bottom <= tRect.top + 20 && pRect.top > 0;
            const explicitlyBelow = pRect.top >= tRect.bottom - 20;
            const explicitlyLeft = pRect.right <= tRect.left + 20 && pRect.left > 0;
            const explicitlyRight = pRect.left >= tRect.right - 20;
            const isNearestEdge =
              (explicitlyAbove && Math.abs(oy - pRect.height) <= 5) ||
              (explicitlyBelow && oy <= 5) ||
              (explicitlyLeft && Math.abs(ox - pRect.width) <= 5) ||
              (explicitlyRight && ox <= 5) ||
              (!explicitlyAbove && !explicitlyLeft && !explicitlyRight && oy <= 5);
            return { cs, ox, oy, pRect, isNearestEdge };
          };

          const surfaceResults = candidateSurfaces.map(checkSurface);
          const matchedSurface = surfaceResults.find((r) => r.isNearestEdge) || surfaceResults[0];
          const { cs, ox, oy, pRect, isNearestEdge } = matchedSurface;

          const earlyCx = earlyRect.left + earlyRect.width / 2;
          const earlyCy = earlyRect.top + earlyRect.height / 2;
          const settledCx = pRect.left + pRect.width / 2;
          const settledCy = pRect.top + pRect.height / 2;
          const tCx = tRect.left + tRect.width / 2;
          const tCy = tRect.top + tRect.height / 2;
          const earlyDist = Math.hypot(earlyCx - tCx, earlyCy - tCy);
          const settledDist = Math.hypot(settledCx - tCx, settledCy - tCy);
          const opensFromTriggerFlip =
            settledDist > 15 &&
            earlyDist < settledDist * 0.7 &&
            (earlyRect.width < pRect.width * 0.98 ||
              earlyRect.height < pRect.height * 0.98 ||
              earlyDist < settledDist - 20);

          return {
            transformOrigin: cs.transformOrigin,
            ox,
            oy,
            pHeight: pRect.height,
            isNearestEdge,
            opensFromTriggerFlip,
          };
        } finally {
          Element.prototype.animate = origAnimate;
        }
      });

      expect(originAnalysis).not.toBeNull();
      expect(originAnalysis!.isNearestEdge || originAnalysis!.opensFromTriggerFlip).toBe(true);
    });

    test('Expectation 7: Every horizontally scrollable row of repeated items computes a scroll-snap-type on the x or inline axis, and its items compute a scroll-snap-align other than none', async ({ page }) => {
      const snapCheck = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.card'));
        if (cards.length === 0) return null;

        let container: HTMLElement | null = cards[0].parentElement;
        for (let depth = 0; depth < 3 && container; depth++) {
          const cs = window.getComputedStyle(container);
          if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.scrollSnapType !== 'none') {
            break;
          }
          container = container.parentElement;
        }
        if (!container) container = cards[0].parentElement;
        if (!container) return null;

        const containerCs = window.getComputedStyle(container);
        const scrollSnapType = containerCs.scrollSnapType;
        const overflowX = containerCs.overflowX;

        const itemAligns = cards.map((c) => {
          const cardAlign = window.getComputedStyle(c).scrollSnapAlign;
          if (cardAlign !== 'none') return cardAlign;
          let item: HTMLElement | null = c as HTMLElement;
          while (item && item.parentElement && item.parentElement !== container) {
            item = item.parentElement;
          }
          return item ? window.getComputedStyle(item).scrollSnapAlign : cardAlign;
        });
        return {
          overflowX,
          scrollSnapType,
          itemAligns,
        };
      });

      expect(snapCheck).not.toBeNull();
      expect(['auto', 'scroll']).toContain(snapCheck!.overflowX);
      expect(snapCheck!.scrollSnapType).toMatch(/\b(x|inline|both)\b/);
      expect(snapCheck!.itemAligns.length).toBeGreaterThan(0);
      for (const align of snapCheck!.itemAligns) {
        expect(align).not.toBe('none');
      }
    });

    test('Expectation 9: With prefers-reduced-motion: reduce emulated, opening a popover, dropdown, menu, or hovercard does not animate its transform, scale, or other individual transform properties', async ({ page, TARGET_URL }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(TARGET_URL);

      const btn = page.locator('button').filter({ hasText: /view details/i }).first();
      await expect(btn).toHaveCount(1);

      await btn.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));

      const snapshotResult = await page.evaluate(async () => {
        const trigger =
          Array.from(document.querySelectorAll('button')).find((b) =>
            /view details/i.test(b.textContent || ''),
          ) ||
          (document.querySelector('.card button[popovertarget], .card button[commandfor], .card button[aria-controls]') as HTMLElement | null);
        if (!trigger) return null;

        const hookedAnims: Animation[] = [];
        const origAnimate = Element.prototype.animate;
        Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
          const anim = origAnimate.apply(this, args);
          hookedAnims.push(anim);
          return anim;
        };

        try {
          trigger.click();

          const isOpenOrVisible = (el: Element | null): el is HTMLElement => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.matches(':popover-open, [open], .is-open, .\\:popover-open')) return true;
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };

          const findDisclosure = (): HTMLElement | null => {
            const targetId =
              trigger.getAttribute('popovertarget') ||
              trigger.getAttribute('commandfor') ||
              trigger.getAttribute('aria-controls');
            const byId = targetId ? document.getElementById(targetId) : null;
            if (isOpenOrVisible(byId)) return byId;
            return document.querySelector<HTMLElement>(
              'dialog[open], [popover]:popover-open, [popover].is-open, [popover].\\:popover-open, dialog.is-open',
            );
          };

          let disclosure = findDisclosure();
          for (let i = 0; i < 30 && !disclosure; i++) {
            await new Promise((r) => setTimeout(r, 20));
            disclosure = findDisclosure();
          }
          if (!disclosure) return null;

          void window.getComputedStyle(disclosure).transform;
          const collectAnims = () =>
            Array.from(
              new Set([
                ...disclosure!.getAnimations({ subtree: true }),
                ...hookedAnims.filter((a) => {
                  const t = (a.effect as KeyframeEffect | null)?.target;
                  return t instanceof Node && disclosure!.contains(t);
                }),
              ]),
            );
          let anims = collectAnims();
          if (anims.length === 0) {
            await new Promise((r) => requestAnimationFrame(r));
            anims = collectAnims();
          }

          const rawTargets = Array.from(
            new Set([
              disclosure,
              ...anims
                .map((a) => (a.effect as KeyframeEffect | null)?.target)
                .filter((t): t is Element => t instanceof Element && disclosure!.contains(t)),
            ]),
          );

          for (const anim of anims) {
            const timing = anim.effect?.getComputedTiming();
            const delay = Number(timing?.delay || 0);
            const dur = Number(timing?.duration || 100);
            anim.pause();
            anim.currentTime = delay + Math.min(20, dur * 0.15);
          }
          const rawEarlyList = rawTargets.map((el) => {
            const cs = window.getComputedStyle(el);
            return {
              transform: cs.transform,
              scale: cs.scale,
              translate: cs.translate,
              rotate: cs.rotate,
            };
          });

          for (const anim of anims) {
            anim.finish();
          }
          const dRect = disclosure.getBoundingClientRect();
          const isValidSurface = (el: Element) => {
            if (el === disclosure) return true;
            const r = el.getBoundingClientRect();
            return r.width >= dRect.width * 0.5 && r.height >= dRect.height * 0.5;
          };

          const validIndices = rawTargets
            .map((el, idx) => (isValidSurface(el) ? idx : -1))
            .filter((idx) => idx >= 0);
          const earlyList = validIndices.map((idx) => rawEarlyList[idx]);
          const settledList = validIndices.map((idx) => {
            const cs = window.getComputedStyle(rawTargets[idx]);
            return {
              transform: cs.transform,
              scale: cs.scale,
              translate: cs.translate,
              rotate: cs.rotate,
            };
          });

          const activeIdx = earlyList.findIndex(
            (e, idx) =>
              e.transform !== settledList[idx].transform ||
              e.scale !== settledList[idx].scale ||
              e.translate !== settledList[idx].translate ||
              e.rotate !== settledList[idx].rotate,
          );
          const chosenIdx = activeIdx >= 0 ? activeIdx : 0;
          return { early: earlyList[chosenIdx], settled: settledList[chosenIdx] };
        } finally {
          Element.prototype.animate = origAnimate;
        }
      });

      expect(snapshotResult).not.toBeNull();
      const { early, settled } = snapshotResult!;
      expect(early.transform).toBe(settled.transform);
      expect(early.scale).toBe(settled.scale);
      expect(early.translate).toBe(settled.translate);
      expect(early.rotate).toBe(settled.rotate);
    });
  });
});
