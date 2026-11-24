import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSGroupingRule,
  CSSMediaRule,
  CSSNestedDeclarations,
  CSSStyleRule,
  CSSSupportsRule,
  type CSSRule,
  type CSSStyleDeclaration,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document, Element } from 'linkedom';

// @ts-ignore - package.json omits "type": "module", but Playwright executes ESM
const targetFiles: string[] = getTargetFiles(import.meta.url);

interface StyledEntry {
  selector: string;
  rawSelector: string;
  style: CSSStyleDeclaration;
  mediaConditions: string[];
  supportsConditions: string[];
  rule: CSSRule;
}

function collectStyledEntries(
  rules: Iterable<CSSRule>,
  parentSelector = '',
  mediaConditions: string[] = [],
  supportsConditions: string[] = [],
): StyledEntry[] {
  const entries: StyledEntry[] = [];

  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      const rawSelector = rule.selectorText.trim();
      const resolvedSelector = parentSelector
        ? rawSelector.includes('&')
          ? rawSelector.replace(/&/g, parentSelector)
          : `${parentSelector} ${rawSelector}`
        : rawSelector;

      entries.push({
        selector: resolvedSelector,
        rawSelector,
        style: rule.style,
        mediaConditions,
        supportsConditions,
        rule,
      });

      if (rule.cssRules && rule.cssRules.length > 0) {
        entries.push(
          ...collectStyledEntries(
            rule.cssRules,
            resolvedSelector,
            mediaConditions,
            supportsConditions,
          ),
        );
      }
    } else if (rule instanceof CSSNestedDeclarations) {
      entries.push({
        selector: parentSelector,
        rawSelector: parentSelector,
        style: rule.style,
        mediaConditions,
        supportsConditions,
        rule,
      });
    } else if (rule instanceof CSSMediaRule) {
      entries.push(
        ...collectStyledEntries(
          rule.cssRules,
          parentSelector,
          [...mediaConditions, rule.conditionText],
          supportsConditions,
        ),
      );
    } else if (rule instanceof CSSSupportsRule) {
      entries.push(
        ...collectStyledEntries(
          rule.cssRules,
          parentSelector,
          mediaConditions,
          [...supportsConditions, rule.conditionText],
        ),
      );
    } else if (rule instanceof CSSGroupingRule) {
      entries.push(
        ...collectStyledEntries(
          rule.cssRules,
          parentSelector,
          mediaConditions,
          supportsConditions,
        ),
      );
    }
  }

  return entries;
}

function getAllStyledEntries(stylesheet: CSSStyleSheet): StyledEntry[] {
  return collectStyledEntries(stylesheet.cssRules);
}

function getProp(style: CSSStyleDeclaration, ...names: string[]): string {
  for (const name of names) {
    const val = style.getPropertyValue(name)?.trim();
    if (val) return val;
  }
  return '';
}

test.describe('checkbox Target Grader', () => {
  test('Checkboxes are implemented using native semantic <input type="checkbox"> elements', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const checkboxes: Element[] = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('input[type="checkbox"]')),
    );
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  test('Every checkbox is associated with a <label> element via nesting or matching for/id attributes', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const checkboxEntries = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('input[type="checkbox"]')).map((input) => ({
        input,
        document: d.document,
      })),
    );

    const allAssociated =
      checkboxEntries.length > 0 &&
      checkboxEntries.every(({ input, document }) => {
        if (input.closest('label')) return true;
        const id = input.getAttribute('id')?.trim();
        if (!id) return false;
        return Boolean(document.querySelector(`label[for="${id}"]`));
      });

    expect(allAssociated).toBe(true);
  });

  test('Custom-styled checkboxes apply appearance: none on the checkbox input with explicit relative dimensions', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyledEntries(stylesheet);

    const nonPseudoEntries = entries.filter(
      (e) => !/::?(before|after)\b/i.test(e.selector),
    );

    const hasAppearanceNone = nonPseudoEntries.some((e) => {
      const appearance = getProp(e.style, 'appearance', '-webkit-appearance');
      return appearance === 'none';
    });

    const hasInlineDimension = nonPseudoEntries.some((e) => {
      const inlineVal = getProp(e.style, 'inline-size', 'width');
      return Boolean(inlineVal);
    });

    const hasBlockOrAspectDimension = nonPseudoEntries.some((e) => {
      const aspectVal = getProp(e.style, 'aspect-ratio');
      const blockVal = getProp(e.style, 'block-size', 'height');
      return /^1(\s*\/\s*1)?$/.test(aspectVal) || Boolean(blockVal);
    });

    const hasRelativeUnitSize = entries.some((e) => {
      const customSize = getProp(e.style, '--checkbox-size', '--size');
      const inlineVal = getProp(e.style, 'inline-size', 'width');
      return (
        /\d+(\.\d+)?(em|rem|ch|ex)\b/i.test(customSize) ||
        /\d+(\.\d+)?(em|rem|ch|ex)\b/i.test(inlineVal)
      );
    });

    expect(
      hasAppearanceNone &&
        hasInlineDimension &&
        hasBlockOrAspectDimension &&
        hasRelativeUnitSize,
    ).toBe(true);
  });

  test('Custom-styled checkboxes render their indicator via a ::before or ::after pseudo-element using CSS mask', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyledEntries(stylesheet);

    const pseudoEntries = entries.filter((e) =>
      /::?(before|after)\b/i.test(e.selector),
    );

    const hasMaskedPseudoElement = pseudoEntries.some((e) => {
      const content = getProp(e.style, 'content');
      const mask = getProp(
        e.style,
        'mask',
        'mask-image',
        '-webkit-mask',
        '-webkit-mask-image',
      );
      const bg = getProp(e.style, 'background-color', 'background');
      return content !== '' && content !== 'none' && mask !== '' && bg !== '';
    });

    const hasCheckIconDefinition = entries.some((e) => {
      const checkVar = getProp(
        e.style,
        '--checkbox-icon',
        '--icon-check',
        '--icon-bean',
      );
      const mask = getProp(
        e.style,
        'mask',
        'mask-image',
        '-webkit-mask',
        '-webkit-mask-image',
      );
      return (
        checkVar !== '' ||
        (e.selector.includes(':checked') && mask !== '')
      );
    });

    expect(hasMaskedPseudoElement && hasCheckIconDefinition).toBe(true);
  });

  test('Custom-styled checkboxes style the :indeterminate state with a distinct dash icon', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyledEntries(stylesheet);

    const indeterminateOnlyEntries = entries.filter(
      (e) =>
        e.selector.includes(':indeterminate') &&
        !e.selector.includes(':checked'),
    );

    const checkedOrBaseIconValues = new Set(
      entries
        .filter((e) => !e.selector.includes(':indeterminate'))
        .map((e) =>
          getProp(
            e.style,
            '--checkbox-icon',
            'mask',
            'mask-image',
            '-webkit-mask',
            '-webkit-mask-image',
          ),
        )
        .filter(Boolean),
    );

    const hasDistinctIndeterminateIcon = indeterminateOnlyEntries.some((e) => {
      const indetVal = getProp(
        e.style,
        '--checkbox-icon',
        'mask',
        'mask-image',
        '-webkit-mask',
        '-webkit-mask-image',
      );
      return indetVal !== '' && !checkedOrBaseIconValues.has(indetVal);
    });

    const hasDashAsset = entries.some((e) => {
      const dashVar = getProp(e.style, '--icon-dash', '--checkbox-icon');
      const mask = getProp(e.style, 'mask', 'mask-image');
      return (
        dashVar.includes('dash') ||
        dashVar.includes('<line') ||
        dashVar.includes('M5 12') ||
        mask.includes('dash')
      );
    });

    expect(hasDistinctIndeterminateIcon && hasDashAsset).toBe(true);
  });

  test('Custom-styled checkboxes provide a visible focus indicator using :focus-visible without removing outlines', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyledEntries(stylesheet);

    const focusVisibleEntries = entries.filter((e) =>
      e.selector.includes(':focus-visible'),
    );

    const hasFocusVisibleIndicator = focusVisibleEntries.some((e) => {
      const outline = getProp(e.style, 'outline');
      const outlineStyle = getProp(e.style, 'outline-style');
      const outlineWidth = getProp(e.style, 'outline-width');
      const outlineColor = getProp(e.style, 'outline-color');
      const boxShadow = getProp(e.style, 'box-shadow');

      if (outline && outline !== 'none' && outline !== '0') return true;
      if (outlineStyle && outlineStyle !== 'none') return true;
      if (outlineWidth && outlineWidth !== '0' && outlineWidth !== '0px') return true;
      if (outlineColor) return true;
      if (boxShadow && boxShadow !== 'none') return true;
      return false;
    });

    const removesFocusOutline = entries
      .filter((e) => /:focus(-visible)?\b/.test(e.selector))
      .some((e) => {
        const outline = getProp(e.style, 'outline');
        const outlineStyle = getProp(e.style, 'outline-style');
        return outline === 'none' || outline === '0' || outlineStyle === 'none';
      });

    expect(hasFocusVisibleIndicator && !removesFocusOutline).toBe(true);
  });

  test('Custom-styled checkboxes animate indicator transitions using scale when prefers-reduced-motion: no-preference is active', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyledEntries(stylesheet);

    const pseudoEntries = entries.filter((e) =>
      /::?(before|after)\b/i.test(e.selector),
    );

    const hasScaleZeroBase = pseudoEntries.some(
      (e) =>
        !e.selector.includes(':checked') &&
        !e.selector.includes(':indeterminate') &&
        getProp(e.style, 'scale') === '0',
    );

    const hasScaleOneActive = pseudoEntries.some(
      (e) =>
        (e.selector.includes(':checked') || e.selector.includes(':indeterminate')) &&
        getProp(e.style, 'scale') === '1',
    );

    const hasReducedMotionScaleTransition = entries.some((e) => {
      const inNoPreferenceMedia = e.mediaConditions.some(
        (cond) =>
          cond.includes('prefers-reduced-motion') &&
          cond.includes('no-preference'),
      );
      if (!inNoPreferenceMedia) return false;
      const transition = getProp(e.style, 'transition', 'transition-property');
      return /\b(scale|all)\b/.test(transition);
    });

    expect(
      hasScaleZeroBase && hasScaleOneActive && hasReducedMotionScaleTransition,
    ).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Checked and indeterminate state colors have a contrast ratio of at least 3:1 with the background color', async ({
      page,
      TARGET_URL,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(TARGET_URL);
      const results = await page.evaluate(async () => {
        const parseRgba = (str: string): [number, number, number, number] | null => {
          const m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/i);
          if (!m) return null;
          return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
        };

        const composite = (
          fg: [number, number, number, number],
          bg: [number, number, number, number],
        ): [number, number, number, number] => {
          const a = fg[3] + bg[3] * (1 - fg[3]);
          if (a === 0) return [255, 255, 255, 1];
          return [
            (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / a,
            (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / a,
            (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / a,
            a,
          ];
        };

        const getEffectiveBg = (el: Element | null, stopAt?: Element | null): [number, number, number, number] => {
          const layers: Array<[number, number, number, number]> = [];
          let curr: Element | null = el;
          while (curr && curr !== stopAt) {
            const bg = parseRgba(window.getComputedStyle(curr).backgroundColor);
            if (bg && bg[3] > 0) layers.push(bg);
            curr = curr.parentElement;
          }
          let acc: [number, number, number, number] = [255, 255, 255, 1];
          for (let i = layers.length - 1; i >= 0; i--) {
            acc = composite(layers[i]!, acc);
          }
          return acc;
        };

        const luminance = ([r, g, b]: [number, number, number, number]): number => {
          const chan = [r, g, b].map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * chan[0]! + 0.7152 * chan[1]! + 0.0722 * chan[2]!;
        };

        const contrast = (c1: [number, number, number, number], c2: [number, number, number, number]): number => {
          const l1 = luminance(c1);
          const l2 = luminance(c2);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };

        const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter(
          (el) => {
            const cs = window.getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.disabled;
          },
        );

        const checks: Array<{ state: string; ratio: number }> = [];

        for (const cb of checkboxes) {
          const origChecked = cb.checked;
          const origIndet = cb.indeterminate;

          for (const state of ['checked', 'indeterminate'] as const) {
            cb.checked = state === 'checked';
            cb.indeterminate = state === 'indeterminate';
            await Promise.allSettled(
              cb.getAnimations({ subtree: true }).map((a) => a.finished),
            );

            const cs = window.getComputedStyle(cb);
            const surroundingBg = getEffectiveBg(cb.parentElement);
            const boxBg = getEffectiveBg(cb);

            let fgColor: [number, number, number, number] | null = null;
            let bgColor: [number, number, number, number] = boxBg;

            if (cs.appearance === 'none') {
              for (const pseudo of ['::before', '::after'] as const) {
                const ps = window.getComputedStyle(cb, pseudo);
                if (ps.content && ps.content !== 'none') {
                  const pBg = parseRgba(ps.backgroundColor);
                  if (pBg && pBg[3] > 0) {
                    fgColor = composite(pBg, boxBg);
                    bgColor = boxBg;
                    break;
                  }
                }
              }
              if (!fgColor) {
                const borderColor = parseRgba(cs.borderTopColor);
                if (borderColor && borderColor[3] > 0) {
                  fgColor = composite(borderColor, surroundingBg);
                  bgColor = surroundingBg;
                }
              }
            } else {
              const accent = parseRgba(cs.accentColor);
              if (accent && accent[3] > 0) {
                fgColor = composite(accent, surroundingBg);
                bgColor = surroundingBg;
              }
            }

            if (fgColor) {
              checks.push({ state, ratio: contrast(fgColor, bgColor) });
            }
          }

          cb.checked = origChecked;
          cb.indeterminate = origIndet;
        }

        return { checkboxCount: checkboxes.length, checks };
      });

      expect(results.checkboxCount).toBeGreaterThan(0);
      expect(results.checks.length).toBeGreaterThan(0);
      for (const item of results.checks) {
        expect(item.ratio, `${item.state} state contrast ratio ${item.ratio.toFixed(2)} must be >= 3`).toBeGreaterThanOrEqual(3);
      }
    });

    test('Focus indicators have a contrast ratio of at least 3:1 with the background color', async ({
      page,
    }) => {
      const checkboxes = page.locator('input[type="checkbox"]:not(:disabled)');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThan(0);

      const firstCb = checkboxes.first();
      // Tab to a checkbox so :focus-visible is active
      let focused = false;
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const isCb = await page.evaluate(
          () =>
            document.activeElement instanceof HTMLInputElement &&
            document.activeElement.type === 'checkbox' &&
            document.activeElement.matches(':focus-visible'),
        );
        if (isCb) {
          focused = true;
          break;
        }
      }
      if (!focused) {
        await firstCb.focus();
      }

      const ratio = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) return 0;

        const parseRgba = (str: string): [number, number, number, number] | null => {
          const m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/i);
          if (!m) return null;
          return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
        };
        const composite = (
          fg: [number, number, number, number],
          bg: [number, number, number, number],
        ): [number, number, number, number] => {
          const a = fg[3] + bg[3] * (1 - fg[3]);
          if (a === 0) return [255, 255, 255, 1];
          return [
            (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / a,
            (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / a,
            (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / a,
            a,
          ];
        };
        const luminance = ([r, g, b]: [number, number, number, number]): number => {
          const chan = [r, g, b].map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * chan[0]! + 0.7152 * chan[1]! + 0.0722 * chan[2]!;
        };
        const contrast = (c1: [number, number, number, number], c2: [number, number, number, number]): number => {
          const l1 = luminance(c1);
          const l2 = luminance(c2);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };

        const cs = window.getComputedStyle(active);
        const outlineWidth = parseFloat(cs.outlineWidth) || 0;
        if (cs.outlineStyle === 'none' || outlineWidth <= 0) return 0;

        const outlineColor = parseRgba(cs.outlineColor);
        if (!outlineColor || outlineColor[3] <= 0) return 0;

        const layers: Array<[number, number, number, number]> = [];
        let curr: Element | null = active.parentElement;
        while (curr) {
          const bg = parseRgba(window.getComputedStyle(curr).backgroundColor);
          if (bg && bg[3] > 0) layers.push(bg);
          curr = curr.parentElement;
        }
        let bg: [number, number, number, number] = [255, 255, 255, 1];
        for (let i = layers.length - 1; i >= 0; i--) {
          bg = composite(layers[i]!, bg);
        }

        return contrast(composite(outlineColor, bg), bg);
      });

      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  });
});
