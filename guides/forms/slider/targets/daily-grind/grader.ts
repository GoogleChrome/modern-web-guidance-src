import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, type CSSRule } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(
  // @ts-ignore
  import.meta.url
);

function getAllCssRules(ruleList: Iterable<CSSRule>): CSSRule[] {
  const all: CSSRule[] = [];
  for (const rule of ruleList) {
    all.push(rule);
    if ('cssRules' in rule && (rule as { cssRules?: Iterable<CSSRule> }).cssRules) {
      all.push(...getAllCssRules((rule as { cssRules: Iterable<CSSRule> }).cssRules!));
    }
  }
  return all;
}

function getRangeInputs(docs: Array<{ file: string; document: any }>): any[] {
  return docs.flatMap((d) => Array.from(d.document.querySelectorAll('input[type="range"]') as any[]));
}

test.describe('slider Target Grader (daily-grind)', () => {
  test('The implementation MUST use a native <input type="range"> element rather than recreating the slider with generic elements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const rangeInputs = getRangeInputs(docs);
    const customRoleSliders = docs.flatMap((d) => Array.from(d.document.querySelectorAll('[role="slider"]:not(input)') as any[]));

    const hasNativeSlider = rangeInputs.length > 0 && customRoleSliders.length === 0;
    expect(hasNativeSlider).toBe(true);
  });

  test('The range input MUST have an accessible name via a programmatically associated label or aria attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const rangeInputs = getRangeInputs(docs);

    const hasAccessibleName = rangeInputs.some((input: any) => {
      const doc = input.ownerDocument;
      const id = input.getAttribute('id');
      if (id) {
        const label = doc.querySelector(`label[for="${id}"]`);
        if (label && (label.textContent || '').trim().length > 0) return true;
      }
      const parentLabel = input.closest('label');
      if (parentLabel && (parentLabel.textContent || '').trim().length > 0) return true;

      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      if (ariaLabelledBy) {
        const ids = ariaLabelledBy.trim().split(/\s+/);
        const hasValidRef = ids.some((refId: string) => {
          const el = doc.getElementById(refId);
          return el && (el.textContent || '').trim().length > 0;
        });
        if (hasValidRef) return true;
      }

      const ariaLabel = input.getAttribute('aria-label');
      return Boolean(ariaLabel && ariaLabel.trim().length > 0);
    });

    expect(hasAccessibleName).toBe(true);
  });

  test('The implementation MUST configure an initial value and appropriate min, max, and step attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const rangeInputs = getRangeInputs(docs);

    const hasConfiguredAttributes = rangeInputs.some((input: any) => {
      const hasValue = input.hasAttribute('value') && input.getAttribute('value')!.trim() !== '';
      const hasMin = input.hasAttribute('min') && input.getAttribute('min')!.trim() !== '';
      const hasMax = input.hasAttribute('max') && input.getAttribute('max')!.trim() !== '';
      const hasStep = input.hasAttribute('step') && input.getAttribute('step')!.trim() !== '';
      return hasValue && hasMin && hasMax && hasStep;
    });

    expect(hasConfiguredAttributes).toBe(true);
  });

  test('The implementation MUST preserve a usable interaction area for the range slider', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasUsableArea =
      allRules.some((r) => {
        if (r instanceof CSSStyleRule) {
          const sel = r.selectorText.toLowerCase();
          if (
            sel.includes('input') ||
            sel.includes('range') ||
            sel.includes('slider') ||
            sel.includes('strength')
          ) {
            const blockSize =
              r.style.getPropertyValue('block-size') ||
              r.style.getPropertyValue('height') ||
              r.style.getPropertyValue('min-block-size') ||
              r.style.getPropertyValue('min-height');
            const padding =
              r.style.getPropertyValue('padding') ||
              r.style.getPropertyValue('padding-block');
            if (blockSize && !/^0(?:px|rem|em)?$/.test(blockSize.trim())) return true;
            if (padding && !/^0(?:px|rem|em)?$/.test(padding.trim())) return true;
          }
        }
        return false;
      }) ||
      docs.some((d) =>
        Boolean(
          d.document.querySelector(
            'input[type="range"][class*="h-"], input[type="range"][class*="py-"], input[type="range"][class*="p-"]'
          )
        )
      );

    expect(hasUsableArea).toBe(true);
  });

  test('The implementation MUST provide a visible :focus-visible indicator with sufficient contrast after changing native appearance', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasFocusVisibleStyle =
      allRules.some((r) => {
        if (r instanceof CSSStyleRule) {
          const sel = r.selectorText.toLowerCase();
          if (sel.includes(':focus-visible')) {
            const outline =
              r.style.getPropertyValue('outline') ||
              r.style.getPropertyValue('outline-color') ||
              r.style.getPropertyValue('outline-width');
            const boxShadow = r.style.getPropertyValue('box-shadow');
            const border = r.style.getPropertyValue('border');
            return Boolean(outline || boxShadow || border);
          }
        }
        return false;
      }) ||
      docs.some((d) =>
        Boolean(
          d.document.querySelector('input[type="range"][class*="focus-visible:"]')
        )
      );

    expect(hasFocusVisibleStyle).toBe(true);
  });

  test('For custom visual styling, the implementation MUST use appearance: none on the slider control', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasAppearanceNone =
      allRules.some((r) => {
        if (r instanceof CSSStyleRule) {
          const sel = r.selectorText.toLowerCase();
          if (
            sel.includes('input') ||
            sel.includes('range') ||
            sel.includes('slider') ||
            sel.includes('strength')
          ) {
            const app =
              r.style.getPropertyValue('appearance') ||
              r.style.getPropertyValue('-webkit-appearance');
            return app.toLowerCase().includes('none');
          }
        }
        return false;
      }) ||
      docs.some((d) =>
        Boolean(
          d.document.querySelector('input[type="range"][class*="appearance-none"]')
        )
      );

    expect(hasAppearanceNone).toBe(true);
  });

  test('The implementation MUST use established browser-specific slider pseudo-elements for track and thumb styling', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const selectors = allRules
      .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
      .map((r) => r.selectorText.toLowerCase());

    const hasWebkitTrack = selectors.some((s) => s.includes('::-webkit-slider-runnable-track'));
    const hasWebkitThumb = selectors.some((s) => s.includes('::-webkit-slider-thumb'));
    const hasMozTrack = selectors.some((s) => s.includes('::-moz-range-track'));
    const hasMozThumb = selectors.some((s) => s.includes('::-moz-range-thumb'));

    const hasSliderPseudoElements =
      hasWebkitTrack && hasWebkitThumb && hasMozTrack && hasMozThumb;
    expect(hasSliderPseudoElements).toBe(true);
  });

  test('Each of the ::-moz- or ::-webkit- prefixed pseudo-elements must only be used once, with variations going through custom properties', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const pseudos = [
      '::-webkit-slider-runnable-track',
      '::-webkit-slider-thumb',
      '::-moz-range-track',
      '::-moz-range-thumb',
    ];

    const counts = pseudos.map(
      (p) => styleRules.filter((r) => r.selectorText.toLowerCase().includes(p)).length
    );
    const eachUsedOnce = counts.every((c) => c === 1);

    const usesCustomProps = pseudos.every((p) => {
      const rule = styleRules.find((r) => r.selectorText.toLowerCase().includes(p));
      return Boolean(rule && rule.cssText.includes('var(--'));
    });

    expect(eachUsedOnce && usesCustomProps).toBe(true);
  });

  test('Custom track-fill progress calculation MUST derive from the actual min, max, and value rather than assuming 0-100', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const project = getJsProject(targetFiles);

    const hasCssProgressDerivation = allRules.some((r) => {
      const text = r.cssText.toLowerCase();
      const hasProgressProp = text.includes('--slider-progress') || text.includes('background');
      const hasMinMaxVars =
        (text.includes('--attr-min') || text.includes('attr(min')) &&
        (text.includes('--attr-max') || text.includes('attr(max'));
      return hasProgressProp && hasMinMaxVars;
    });

    const hasJsProgressDerivation = project.getSourceFiles().some((sf) => {
      const text = sf.getText();
      const referencesBounds =
        text.includes('min') && text.includes('max') && text.includes('value');
      const calculatesRange =
        text.includes('max - min') ||
        text.includes('max-min') ||
        text.includes('--attr-min') ||
        text.includes('--slider-progress');
      return referencesBounds && calculatesRange;
    });

    expect(hasCssProgressDerivation || hasJsProgressDerivation).toBe(true);
  });

  test('The implementation MUST NOT use generated content on slider pseudo-elements, exposing values in ordinary DOM elements instead', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const hasRangeInput = docs.some((d) =>
      Boolean(d.document.querySelector('input[type="range"]'))
    );
    const hasOutputOrValueEl = docs.some((d) =>
      Boolean(
        d.document.querySelector(
          'output, [for*="slider"], [for*="strength"], [id*="strength"], [id*="output"]'
        )
      )
    );

    const hasGeneratedContentOnPseudo = allRules.some((r) => {
      if (r instanceof CSSStyleRule) {
        const sel = r.selectorText.toLowerCase();
        const isSliderPseudo = sel.includes('-slider-') || sel.includes('-range-');
        const isGenerated = sel.includes('::before') || sel.includes('::after');
        const hasContent = r.style.getPropertyValue('content') !== '';
        return isSliderPseudo && (isGenerated || hasContent);
      }
      return false;
    });

    expect(hasRangeInput && hasOutputOrValueEl && !hasGeneratedContentOnPseudo).toBe(true);
  });

  test('The implementation MUST account for right-to-left layouts and MUST NOT hard-code a left-to-right active-track direction without an explicit RTL strategy', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hasRtlStrategy = styleRules.some((r) => {
      const sel = r.selectorText.toLowerCase();
      const isRtl =
        sel.includes(':dir(rtl)') ||
        sel.includes('[dir="rtl"]') ||
        sel.includes('[dir=\'rtl\']');
      const setsLeftDirection =
        r.style.getPropertyValue('--slider-direction').toLowerCase().includes('to left') ||
        r.style.getPropertyValue('background').toLowerCase().includes('to left') ||
        r.cssText.toLowerCase().includes('to left');
      return isRtl && setsLeftDirection;
    });

    expect(hasRtlStrategy).toBe(true);
  });

  test('When aria-valuetext is provided, it MUST differ from the slider plain numeric value', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const rangeInputs = getRangeInputs(docs);

    const hasFormattedValueText = rangeInputs.some((input: any) => {
      const ariaValueText = input.getAttribute('aria-valuetext')?.trim();
      const numericValue = input.getAttribute('value')?.trim();
      const htmlDiffers = Boolean(
        ariaValueText &&
          ariaValueText !== numericValue &&
          /[^\d\s.,]/.test(ariaValueText)
      );

      const jsUpdatesAriaValueText = project.getSourceFiles().some((sf) => {
        const text = sf.getText();
        return (
          text.includes('aria-valuetext') &&
          (text.includes('labels') || text.includes('strengths') || text.includes('of'))
        );
      });

      return htmlDiffers || jsUpdatesAriaValueText;
    });

    expect(hasFormattedValueText).toBe(true);
  });
});
