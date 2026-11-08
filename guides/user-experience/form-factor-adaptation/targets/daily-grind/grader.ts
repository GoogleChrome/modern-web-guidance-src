// Expectation Coverage:
// 1. TESTED: Verifies that on coarse pointers (pointer: coarse / any-pointer: coarse), visible controls and nav links have at least a 44x44px hit area.
// 2. TESTED: Verifies that on fine pointers (pointer: fine), visible controls and nav links have at least a 24x24px hit area.
// 3. SKIPPED: The base application does not contain any checkbox or radio inputs.
// 4. TESTED: Verifies that resizing a container-query container (container-type !== 'normal') across its query threshold with the viewport unchanged changes a descendant's non-size computed style.
// 5. TESTED: Verifies that all visible h1, h2, and h3 headings compute text-wrap-style: balance.
// 6. TESTED: Verifies that all visible p elements compute text-wrap-style: pretty.
// 7. SKIPPED: The base application does not contain any buttons or links without visible text.
// 8. SKIPPED: The base application does not contain any fixed bottom bars.
// 9. TESTED: Verifies that at a viewport width of 320 CSS pixels, the document does not scroll horizontally.
// 10. SKIPPED: The base application already satisfies this expectation (no heading, paragraph, button, or link overflows its own box at 320px).
// 11. SKIPPED: The base application already satisfies this expectation (no element has overflow: hidden or clip).

import {
  test,
  expect,
} from '../../../../../src/grading/test-fixture.ts';

test.describe('form-factor-adaptation Target Grader', () => {
  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Expectation 1: On viewports matching pointer: coarse, visible controls and nav links have at least a 44x44px hit area', async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      });

      const results = await page.evaluate(() => {
        const selector =
          'button, select, textarea, input:not([type="checkbox"]):not([type="radio"]), [role="button"], nav a';
        const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));

        const visible = elements.filter((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        return visible.map((el) => {
          const rect = el.getBoundingClientRect();
          let left = rect.left;
          let top = rect.top;
          let right = rect.right;
          let bottom = rect.bottom;

          for (const pseudo of ['::before', '::after'] as const) {
            const ps = window.getComputedStyle(el, pseudo);
            if (
              ps.content &&
              ps.content !== 'none' &&
              ps.content !== 'normal' &&
              ps.position === 'absolute' &&
              ps.display !== 'none' &&
              ps.visibility !== 'hidden'
            ) {
              const pTop = parseFloat(ps.top);
              const pRight = parseFloat(ps.right);
              const pBottom = parseFloat(ps.bottom);
              const pLeft = parseFloat(ps.left);
              const pWidth = parseFloat(ps.width);
              const pHeight = parseFloat(ps.height);

              let boxLeft = left;
              let boxRight = right;
              if (Number.isFinite(pLeft) && Number.isFinite(pRight)) {
                boxLeft = rect.left + pLeft;
                boxRight = rect.right - pRight;
              } else if (Number.isFinite(pLeft) && Number.isFinite(pWidth)) {
                boxLeft = rect.left + pLeft;
                boxRight = boxLeft + pWidth;
              } else if (Number.isFinite(pRight) && Number.isFinite(pWidth)) {
                boxRight = rect.right - pRight;
                boxLeft = boxRight - pWidth;
              }

              let boxTop = top;
              let boxBottom = bottom;
              if (Number.isFinite(pTop) && Number.isFinite(pBottom)) {
                boxTop = rect.top + pTop;
                boxBottom = rect.bottom - pBottom;
              } else if (Number.isFinite(pTop) && Number.isFinite(pHeight)) {
                boxTop = rect.top + pTop;
                boxBottom = boxTop + pHeight;
              } else if (Number.isFinite(pBottom) && Number.isFinite(pHeight)) {
                boxBottom = rect.bottom - pBottom;
                boxTop = boxBottom - pHeight;
              }

              left = Math.min(left, boxLeft);
              right = Math.max(right, boxRight);
              top = Math.min(top, boxTop);
              bottom = Math.max(bottom, boxBottom);
            }
          }

          return {
            text: el.textContent?.trim() || el.tagName,
            width: right - left,
            height: bottom - top,
          };
        });
      });

      expect(results.length).toBeGreaterThan(0);
      for (const item of results) {
        expect(item.width, `Control "${item.text}" width should be >= 44px on coarse pointer`).toBeGreaterThanOrEqual(43.5);
        expect(item.height, `Control "${item.text}" height should be >= 44px on coarse pointer`).toBeGreaterThanOrEqual(43.5);
      }
    });

    test('Expectation 2: On viewports matching pointer: fine, visible controls and nav links have at least a 24x24px hit area', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });

      const results = await page.evaluate(() => {
        const selector =
          'button, select, textarea, input:not([type="checkbox"]):not([type="radio"]), [role="button"], nav a';
        const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));

        const visible = elements.filter((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        return visible.map((el) => {
          const rect = el.getBoundingClientRect();
          let left = rect.left;
          let top = rect.top;
          let right = rect.right;
          let bottom = rect.bottom;

          for (const pseudo of ['::before', '::after'] as const) {
            const ps = window.getComputedStyle(el, pseudo);
            if (
              ps.content &&
              ps.content !== 'none' &&
              ps.content !== 'normal' &&
              ps.position === 'absolute' &&
              ps.display !== 'none' &&
              ps.visibility !== 'hidden'
            ) {
              const pTop = parseFloat(ps.top);
              const pRight = parseFloat(ps.right);
              const pBottom = parseFloat(ps.bottom);
              const pLeft = parseFloat(ps.left);
              const pWidth = parseFloat(ps.width);
              const pHeight = parseFloat(ps.height);

              let boxLeft = left;
              let boxRight = right;
              if (Number.isFinite(pLeft) && Number.isFinite(pRight)) {
                boxLeft = rect.left + pLeft;
                boxRight = rect.right - pRight;
              } else if (Number.isFinite(pLeft) && Number.isFinite(pWidth)) {
                boxLeft = rect.left + pLeft;
                boxRight = boxLeft + pWidth;
              } else if (Number.isFinite(pRight) && Number.isFinite(pWidth)) {
                boxRight = rect.right - pRight;
                boxLeft = boxRight - pWidth;
              }

              let boxTop = top;
              let boxBottom = bottom;
              if (Number.isFinite(pTop) && Number.isFinite(pBottom)) {
                boxTop = rect.top + pTop;
                boxBottom = rect.bottom - pBottom;
              } else if (Number.isFinite(pTop) && Number.isFinite(pHeight)) {
                boxTop = rect.top + pTop;
                boxBottom = boxTop + pHeight;
              } else if (Number.isFinite(pBottom) && Number.isFinite(pHeight)) {
                boxBottom = rect.bottom - pBottom;
                boxTop = boxBottom - pHeight;
              }

              left = Math.min(left, boxLeft);
              right = Math.max(right, boxRight);
              top = Math.min(top, boxTop);
              bottom = Math.max(bottom, boxBottom);
            }
          }

          return {
            text: el.textContent?.trim() || el.tagName,
            width: right - left,
            height: bottom - top,
          };
        });
      });

      expect(results.length).toBeGreaterThan(0);
      for (const item of results) {
        expect(item.width, `Control "${item.text}" width should be >= 24px on fine pointer`).toBeGreaterThanOrEqual(23.5);
        expect(item.height, `Control "${item.text}" height should be >= 24px on fine pointer`).toBeGreaterThanOrEqual(23.5);
      }
    });

    test('Expectation 4: Resizing a container-query container with the viewport unchanged changes a descendant computed style beyond size', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });

      const result = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll<HTMLElement>('*'));
        const containers = allElements.filter((el) => {
          const cs = window.getComputedStyle(el);
          return cs.containerType && cs.containerType !== 'normal';
        });

        const getDescendantSignatures = (root: HTMLElement): string[] => {
          const descendants = Array.from(root.querySelectorAll<HTMLElement>('*'));
          return descendants.map((desc) => {
            const cs = window.getComputedStyle(desc);
            const gridColsCount =
              cs.gridTemplateColumns && cs.gridTemplateColumns !== 'none'
                ? cs.gridTemplateColumns.trim().split(/\s+/).length
                : 0;
            return JSON.stringify({
              display: cs.display,
              flexDirection: cs.flexDirection,
              flexWrap: cs.flexWrap,
              justifyContent: cs.justifyContent,
              alignItems: cs.alignItems,
              gridColsCount,
              paddingTop: cs.paddingTop,
              paddingRight: cs.paddingRight,
              paddingBottom: cs.paddingBottom,
              paddingLeft: cs.paddingLeft,
              fontSize: cs.fontSize,
              textAlign: cs.textAlign,
            });
          });
        };

        let anyContainerChangedDescendant = false;

        for (const container of containers) {
          const prevStyle = container.getAttribute('style');

          container.style.setProperty('width', '240px', 'important');
          container.style.setProperty('inline-size', '240px', 'important');
          container.style.setProperty('min-width', '0px', 'important');
          container.style.setProperty('max-width', '240px', 'important');
          const narrowSigs = getDescendantSignatures(container);

          container.style.setProperty('width', '1000px', 'important');
          container.style.setProperty('inline-size', '1000px', 'important');
          container.style.setProperty('min-width', '1000px', 'important');
          container.style.setProperty('max-width', '1000px', 'important');
          const wideSigs = getDescendantSignatures(container);

          if (prevStyle === null) {
            container.removeAttribute('style');
          } else {
            container.setAttribute('style', prevStyle);
          }

          if (narrowSigs.some((sig, idx) => sig !== wideSigs[idx])) {
            anyContainerChangedDescendant = true;
            break;
          }
        }

        return {
          containerCount: containers.length,
          anyContainerChangedDescendant,
        };
      });

      expect(result.containerCount).toBeGreaterThan(0);
      expect(result.anyContainerChangedDescendant).toBe(true);
    });

    test('Expectation 5: Visible h1, h2, and h3 headings compute a text-wrap-style of balance', async ({ page }) => {
      const headings = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3'));
        const visible = els.filter((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        return visible.map((el) => {
          const style = window.getComputedStyle(el) as CSSStyleDeclaration & { textWrapStyle?: string; textWrap?: string };
          return {
            tag: el.tagName,
            text: el.textContent?.trim() || '',
            textWrapStyle: style.textWrapStyle || style.getPropertyValue('text-wrap-style') || style.textWrap || '',
          };
        });
      });

      expect(headings.length).toBeGreaterThan(0);
      for (const h of headings) {
        expect(h.textWrapStyle, `Heading <${h.tag}> "${h.text}" should have text-wrap-style: balance`).toBe('balance');
      }
    });

    test('Expectation 6: Visible paragraphs (p) compute a text-wrap-style of pretty', async ({ page }) => {
      const paragraphs = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>('p'));
        const visible = els.filter((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        return visible.map((el) => {
          const style = window.getComputedStyle(el) as CSSStyleDeclaration & { textWrapStyle?: string; textWrap?: string };
          return {
            text: el.textContent?.trim() || '',
            textWrapStyle: style.textWrapStyle || style.getPropertyValue('text-wrap-style') || style.textWrap || '',
          };
        });
      });

      expect(paragraphs.length).toBeGreaterThan(0);
      for (const p of paragraphs) {
        expect(p.textWrapStyle, `Paragraph "${p.text}" should have text-wrap-style: pretty`).toBe('pretty');
      }
    });

    test('Expectation 9: At a viewport width of 320 CSS pixels, the document does not scroll horizontally', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });

      const dimensions = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
        };
      });

      expect(dimensions.clientWidth).toBeGreaterThan(0);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    });
  });
});
