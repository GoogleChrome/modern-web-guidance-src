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
// 10. TESTED: Verifies that at a viewport width of 320 CSS pixels, no visible heading, paragraph, button, or link overflows its own box horizontally or vertically (ignoring absolute hit-area pseudo-elements).
// 11. TESTED: Verifies that no visible button, link, or form control extends outside an ancestor with overflow hidden or clip.

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
        type SavedRule = {
          parent: CSSStyleSheet | CSSGroupingRule;
          index: number;
          cssText: string;
        };

        const collectContainerRules = (
          root: CSSStyleSheet | CSSGroupingRule,
          out: SavedRule[],
        ) => {
          let rules: CSSRuleList;
          try {
            rules = root.cssRules;
          } catch {
            return;
          }
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (typeof CSSContainerRule !== 'undefined' && rule instanceof CSSContainerRule) {
              out.push({ parent: root, index: i, cssText: rule.cssText });
            } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
              collectContainerRules(rule as CSSGroupingRule, out);
            }
          }
        };

        const savedRules: SavedRule[] = [];
        for (const sheet of [
          ...Array.from(document.styleSheets),
          ...Array.from(document.adoptedStyleSheets ?? []),
        ]) {
          collectContainerRules(sheet, savedRules);
        }

        const normalizeTracks = (val: string): string => {
          if (!val || val === 'none') return 'none';
          const nums = (val.match(/[\d.]+(?=px)/g) ?? []).map(Number);
          if (nums.length === 0) return val;
          const total = nums.reduce((acc, n) => acc + n, 0) || 1;
          return `${nums.length}:${nums.map((n) => Math.round((n / total) * 20)).join(',')}`;
        };

        const getDescendantStyles = (root: HTMLElement): Record<string, string>[] => {
          const descendants = Array.from(root.querySelectorAll<HTMLElement>('*'));
          return descendants.map((desc) => {
            const cs = window.getComputedStyle(desc);
            return {
              display: cs.display,
              position: cs.position,
              flexDirection: cs.flexDirection,
              flexWrap: cs.flexWrap,
              justifyContent: cs.justifyContent,
              alignItems: cs.alignItems,
              alignContent: cs.alignContent,
              alignSelf: cs.alignSelf,
              justifyItems: cs.justifyItems,
              justifySelf: cs.justifySelf,
              order: cs.order,
              flexGrow: cs.flexGrow,
              flexShrink: cs.flexShrink,
              gridAutoFlow: cs.gridAutoFlow,
              gridTemplateAreas: cs.gridTemplateAreas,
              gridColumnStart: cs.gridColumnStart,
              gridColumnEnd: cs.gridColumnEnd,
              gridRowStart: cs.gridRowStart,
              gridRowEnd: cs.gridRowEnd,
              gridCols: normalizeTracks(cs.gridTemplateColumns),
              rowGap: cs.rowGap,
              columnGap: cs.columnGap,
              columnCount: cs.columnCount,
              paddingTop: cs.paddingTop,
              paddingRight: cs.paddingRight,
              paddingBottom: cs.paddingBottom,
              paddingLeft: cs.paddingLeft,
              fontSize: cs.fontSize,
              fontWeight: cs.fontWeight,
              lineHeight: cs.lineHeight,
              textAlign: cs.textAlign,
              whiteSpace: cs.whiteSpace,
            };
          });
        };

        const measureContainerRuleEffects = (root: HTMLElement): string[] => {
          const active = getDescendantStyles(root);
          for (let i = savedRules.length - 1; i >= 0; i--) {
            savedRules[i].parent.deleteRule(savedRules[i].index);
          }
          let muted: Record<string, string>[] = [];
          try {
            muted = getDescendantStyles(root);
          } finally {
            for (let i = 0; i < savedRules.length; i++) {
              savedRules[i].parent.insertRule(savedRules[i].cssText, savedRules[i].index);
            }
          }
          return active.map((act, idx) => {
            const mut = muted[idx] ?? {};
            const diff: Record<string, string> = {};
            for (const key of Object.keys(act)) {
              if (act[key] !== mut[key]) {
                diff[key] = act[key];
              }
            }
            return JSON.stringify(diff);
          });
        };

        const containers = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
          const cs = window.getComputedStyle(el);
          return Boolean(cs.containerType && cs.containerType !== 'normal');
        });

        let anyContainerChangedDescendant = false;

        if (savedRules.length > 0) {
          const probeSizes = [
            { w: 160, h: 320 },
            { w: 360, h: 240 },
            { w: 720, h: 480 },
            { w: 1200, h: 720 },
          ];

          for (const container of containers) {
            const prevStyle = container.getAttribute('style');
            const isSizeContainer = window.getComputedStyle(container).containerType === 'size';
            const effectsBySize: string[][] = [];

            try {
              for (const { w, h } of probeSizes) {
                container.style.setProperty('box-sizing', 'content-box', 'important');
                container.style.setProperty('flex', '0 0 auto', 'important');
                container.style.setProperty('width', `${w}px`, 'important');
                container.style.setProperty('inline-size', `${w}px`, 'important');
                container.style.setProperty('min-width', `${w}px`, 'important');
                container.style.setProperty('max-width', `${w}px`, 'important');
                if (isSizeContainer) {
                  container.style.setProperty('height', `${h}px`, 'important');
                  container.style.setProperty('block-size', `${h}px`, 'important');
                  container.style.setProperty('min-height', `${h}px`, 'important');
                  container.style.setProperty('max-height', `${h}px`, 'important');
                }
                effectsBySize.push(measureContainerRuleEffects(container));
              }
            } finally {
              if (prevStyle === null) {
                container.removeAttribute('style');
              } else {
                container.setAttribute('style', prevStyle);
              }
            }

            const descendantCount = effectsBySize[0]?.length ?? 0;
            for (let d = 0; d < descendantCount; d++) {
              const first = effectsBySize[0][d];
              if (effectsBySize.some((eff) => eff[d] !== first)) {
                anyContainerChangedDescendant = true;
                break;
              }
            }
            if (anyContainerChangedDescendant) break;
          }
        }

        return {
          containerCount: containers.length,
          containerRuleCount: savedRules.length,
          anyContainerChangedDescendant,
        };
      });

      expect(result.containerCount).toBeGreaterThan(0);
      expect(result.containerRuleCount).toBeGreaterThan(0);
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

    test('Expectation 10: At a viewport width of 320 CSS pixels, no visible heading, paragraph, button, or link has content that overflows its own box horizontally or vertically', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });

      const report = await page.evaluate(() => {
        const docEl = document.documentElement;
        const styleEl = document.createElement('style');
        styleEl.textContent = `
          [data-mwg-no-before]::before { content: none !important; }
          [data-mwg-no-after]::after { content: none !important; }
        `;
        document.head.appendChild(styleEl);

        const selector = 'h1, h2, h3, h4, h5, h6, p, button, a, [role="button"]';
        const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));

        const visible = elements.filter((el) => {
          if (el.children.length === 0 && !(el.textContent ?? '').trim()) {
            return false;
          }
          const style = window.getComputedStyle(el);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            parseFloat(style.opacity) === 0 ||
            el.hasAttribute('hidden') ||
            el.getAttribute('aria-hidden') === 'true'
          ) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          if (
            style.position === 'absolute' &&
            rect.width <= 1 &&
            rect.height <= 1 &&
            (style.overflow === 'hidden' || style.clip !== 'auto' || style.clipPath !== 'none')
          ) {
            return false;
          }
          return el.getClientRects().length > 0;
        });

        for (const el of visible) {
          if (el.matches('button, a, [role="button"]')) {
            if (window.getComputedStyle(el, '::before').position === 'absolute') {
              el.setAttribute('data-mwg-no-before', '');
            }
            if (window.getComputedStyle(el, '::after').position === 'absolute') {
              el.setAttribute('data-mwg-no-after', '');
            }
          }
        }

        let overflowing: string[] = [];
        try {
          overflowing = visible.flatMap((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const label = `<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 30)}"`;
            if (rect.width <= 1 || rect.height <= 1) {
              return [`${label} collapsed to ${rect.width.toFixed(1)}x${rect.height.toFixed(1)}px`];
            }
            if (style.display === 'inline') {
              return [];
            }
            const horiz = el.scrollWidth > el.clientWidth + 1;
            const vert = el.scrollHeight > el.clientHeight + 1;
            if (horiz || vert) {
              return [
                `${label} (scroll ${el.scrollWidth}x${el.scrollHeight} > client ${el.clientWidth}x${el.clientHeight})`,
              ];
            }
            return [];
          });
        } finally {
          for (const el of visible) {
            el.removeAttribute('data-mwg-no-before');
            el.removeAttribute('data-mwg-no-after');
          }
          styleEl.remove();
        }

        return {
          docScrollWidth: docEl.scrollWidth,
          docClientWidth: docEl.clientWidth,
          checkedCount: visible.length,
          overflowing,
        };
      });

      expect(report.checkedCount).toBeGreaterThan(0);
      expect(report.docScrollWidth).toBeLessThanOrEqual(report.docClientWidth);
      expect(report.overflowing).toEqual([]);
    });

    test('Expectation 11: No visible button, link, or form control extends outside an ancestor whose computed overflow is hidden or clip', async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      const collectClippedControls = () =>
        page.evaluate(() => {
          const docEl = document.documentElement;
          const selector = 'button, a, input, select, textarea, [role="button"]';
          const controls = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => {
            const style = window.getComputedStyle(el);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              parseFloat(style.opacity) === 0 ||
              el.hasAttribute('hidden') ||
              el.getAttribute('aria-hidden') === 'true'
            ) {
              return false;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });

          const clipped: string[] = [];
          for (const el of controls) {
            const rect = el.getBoundingClientRect();
            let anc = el.parentElement;
            while (anc) {
              const cs = window.getComputedStyle(anc);
              const clipX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
              const clipY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
              if (clipX || clipY) {
                const ancRect = anc.getBoundingClientRect();
                const clipLeft = ancRect.left + (parseFloat(cs.borderLeftWidth) || 0);
                const clipRight = ancRect.right - (parseFloat(cs.borderRightWidth) || 0);
                const clipTop = ancRect.top + (parseFloat(cs.borderTopWidth) || 0);
                const clipBottom = ancRect.bottom - (parseFloat(cs.borderBottomWidth) || 0);
                const outX = clipX && (rect.left < clipLeft - 1 || rect.right > clipRight + 1);
                const outY = clipY && (rect.top < clipTop - 1 || rect.bottom > clipBottom + 1);
                if (outX || outY) {
                  const label = (el.textContent ?? '').trim().slice(0, 30) || el.tagName.toLowerCase();
                  clipped.push(`"${label}" clipped by <${anc.tagName.toLowerCase()}>`);
                  break;
                }
              }
              anc = anc.parentElement;
            }
          }

          return {
            docScrollWidth: docEl.scrollWidth,
            docClientWidth: docEl.clientWidth,
            controlCount: controls.length,
            clipped,
          };
        });

      await page.setViewportSize({ width: 1280, height: 800 });
      const wide = await collectClippedControls();

      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 320,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      });
      const narrowTouch = await collectClippedControls();
      await cdp.send('Emulation.clearDeviceMetricsOverride');

      expect(narrowTouch.controlCount).toBeGreaterThan(0);
      expect(narrowTouch.docScrollWidth).toBeLessThanOrEqual(narrowTouch.docClientWidth);
      expect(narrowTouch.clipped).toEqual([]);
      expect(wide.clipped).toEqual([]);
    });
  });
});
