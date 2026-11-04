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
      await page.waitForTimeout(250);
      const hoverState = await btn.evaluate(getVisualState);

      await page.mouse.down();
      await page.waitForTimeout(250);
      const activeState = await btn.evaluate(getVisualState);
      await page.mouse.up();

      expect(hasVisualDifference(hoverState, activeState)).toBe(true);
    });

    test('Expectation 3: Moving keyboard focus to a button or link with the Tab key gives it either the browser native focus ring or a custom outline or box-shadow with at least 3:1 contrast ratio against the page background', async ({ page }) => {
      const target = page.locator('main button').first();
      await expect(target).toHaveCount(1);

      const unfocused = await target.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          outlineStyle: cs.outlineStyle,
          outlineWidth: parseFloat(cs.outlineWidth) || 0,
          outlineColor: cs.outlineColor,
          boxShadow: cs.boxShadow,
        };
      });

      let focusedOnMainControl = false;
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const isInMain = await page.evaluate(() => {
          const active = document.activeElement;
          return Boolean(active && active.closest('main') && (active.tagName === 'BUTTON' || active.tagName === 'A'));
        });
        if (isInMain) {
          focusedOnMainControl = true;
          break;
        }
      }
      expect(focusedOnMainControl).toBe(true);

      const focusAnalysis = await page.evaluate((unfocusedState) => {
        const el = document.activeElement!;
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

        let ringColorStr = cs.outlineColor;
        if (!hasCustomOutline && hasCustomBoxShadow) {
          const match = cs.boxShadow.match(/(?:rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
          if (match) ringColorStr = match[0];
        }

        const ringColor = parseRgba(ringColorStr);
        const bodyBgStr = window.getComputedStyle(document.body).backgroundColor;
        const bodyBg = parseRgba(bodyBgStr) || [250, 250, 250, 1];
        const effectiveBg: [number, number, number, number] = bodyBg[3] === 0 ? [255, 255, 255, 1] : bodyBg;

        const ratio = ringColor ? contrastRatio(ringColor, effectiveBg) : 0;

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
      await page.waitForTimeout(100);
      await btn.click();

      const snapshotResult = await page.evaluate(() => {
        const trigger = Array.from(document.querySelectorAll('button')).find((b) =>
          /view details/i.test(b.textContent || ''),
        );
        const targetId = trigger?.getAttribute('popovertarget') || trigger?.getAttribute('aria-controls');
        const popover =
          (targetId && document.getElementById(targetId)) ||
          document.querySelector('[popover]:popover-open, [popover].is-open, [popover].\\:popover-open');
        if (!popover) return null;

        const anims = popover.getAnimations();
        for (const anim of anims) {
          anim.pause();
          anim.currentTime = 20;
        }
        const earlyCs = window.getComputedStyle(popover);
        const early = {
          transform: earlyCs.transform,
          scale: earlyCs.scale,
          translate: earlyCs.translate,
          rotate: earlyCs.rotate,
        };

        for (const anim of anims) {
          anim.finish();
        }
        const settledCs = window.getComputedStyle(popover);
        const settled = {
          transform: settledCs.transform,
          scale: settledCs.scale,
          translate: settledCs.translate,
          rotate: settledCs.rotate,
        };

        return { early, settled };
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

      await btn.click();

      const originAnalysis = await page.evaluate(() => {
        const trigger = Array.from(document.querySelectorAll('button')).find((b) =>
          /view details/i.test(b.textContent || ''),
        );
        if (!trigger) return null;
        const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
        const popover =
          (targetId && document.getElementById(targetId)) ||
          document.querySelector('[popover]:popover-open, [popover].is-open, [popover].\\:popover-open');
        if (!popover) return null;

        for (const anim of popover.getAnimations()) {
          anim.finish();
        }

        const cs = window.getComputedStyle(popover);
        const [oxStr, oyStr] = cs.transformOrigin.split(/\s+/);
        const ox = parseFloat(oxStr);
        const oy = parseFloat(oyStr);

        const pRect = popover.getBoundingClientRect();
        const tRect = trigger.getBoundingClientRect();

        // If the popover is positioned above the trigger, its nearest edge is bottom (oy ~ pRect.height);
        // if positioned below the trigger, its nearest edge is top (oy ~ 0).
        const explicitlyAbove = pRect.bottom <= tRect.top + 20 && pRect.top > 0;
        const isNearestYEdge = explicitlyAbove
          ? Math.abs(oy - pRect.height) <= 5
          : oy <= 5;

        return {
          transformOrigin: cs.transformOrigin,
          ox,
          oy,
          pHeight: pRect.height,
          explicitlyAbove,
          isNearestYEdge,
        };
      });

      expect(originAnalysis).not.toBeNull();
      expect(originAnalysis!.isNearestYEdge).toBe(true);
    });

    test('Expectation 7: Every horizontally scrollable row of repeated items computes a scroll-snap-type on the x or inline axis, and its items compute a scroll-snap-align other than none', async ({ page }) => {
      const snapCheck = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.card'));
        if (cards.length === 0) return null;
        const container = cards[0].parentElement;
        if (!container) return null;

        const containerCs = window.getComputedStyle(container);
        const scrollSnapType = containerCs.scrollSnapType;
        const overflowX = containerCs.overflowX;

        const itemAligns = cards.map((c) => window.getComputedStyle(c).scrollSnapAlign);
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
      await page.waitForTimeout(100);
      await btn.click();

      const snapshotResult = await page.evaluate(() => {
        const trigger = Array.from(document.querySelectorAll('button')).find((b) =>
          /view details/i.test(b.textContent || ''),
        );
        const targetId = trigger?.getAttribute('popovertarget') || trigger?.getAttribute('aria-controls');
        const popover =
          (targetId && document.getElementById(targetId)) ||
          document.querySelector('[popover]:popover-open, [popover].is-open, [popover].\\:popover-open');
        if (!popover) return null;

        const anims = popover.getAnimations();
        for (const anim of anims) {
          anim.pause();
          anim.currentTime = 20;
        }
        const earlyCs = window.getComputedStyle(popover);
        const early = {
          transform: earlyCs.transform,
          scale: earlyCs.scale,
          translate: earlyCs.translate,
          rotate: earlyCs.rotate,
        };

        for (const anim of anims) {
          anim.finish();
        }
        const settledCs = window.getComputedStyle(popover);
        const settled = {
          transform: settledCs.transform,
          scale: settledCs.scale,
          translate: settledCs.translate,
          rotate: settledCs.rotate,
        };

        return { early, settled };
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
