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

// @ts-expect-error - package.json omits "type": "module", but Playwright executes ESM
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
});
