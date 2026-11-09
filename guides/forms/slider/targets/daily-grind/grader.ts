import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getPrimaryHtmlDocuments(files: string[]): Array<{ file: string; document: Document }> {
  const allDocs = getHtmlDocuments(files);
  const nonDistDocs = allDocs.filter((d) => !/[/\\]dist[/\\]/i.test(d.file));
  return nonDistDocs.length > 0 ? nonDistDocs : allDocs;
}

function getPrimaryTargetFiles(files: string[]): string[] {
  const nonDist = files.filter((f) => !/[/\\]dist[/\\]/i.test(f));
  return nonDist.length > 0 ? nonDist : files;
}

function collectAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const collected: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      collected.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      collected.push(...collectAllStyleRules(Array.from(rule.cssRules)));
    }
  }
  return collected;
}

function getAllPropertyValues(rule: CSSStyleRule, propName: string): string[] {
  const values: string[] = [];
  const val = rule.style.getPropertyValue(propName);
  if (val) values.push(val);
  for (let i = 0; i < rule.style.length; i++) {
    const key = rule.style[i];
    if (key === propName) {
      const v = rule.style.getPropertyValue(key);
      if (v && !values.includes(v)) values.push(v);
    }
  }
  return values;
}

function collectCustomProperties(rules: CSSStyleRule[]): Array<{ selector: string; name: string; value: string }> {
  const props: Array<{ selector: string; name: string; value: string }> = [];
  for (const rule of rules) {
    for (let i = 0; i < rule.style.length; i++) {
      const propName = rule.style[i];
      if (propName && propName.startsWith('--')) {
        props.push({
          selector: rule.selectorText,
          name: propName,
          value: rule.style.getPropertyValue(propName),
        });
      }
    }
  }
  return props;
}

test.describe('slider Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('Uses a native <input type="range"> element without custom pointer handlers or duplicate controls', () => {
    const docs = getPrimaryHtmlDocuments(targetFiles);
    const rangeInputs = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('input[type="range"]')),
    );
    expect(rangeInputs.length).toBeGreaterThan(0);

    const ariaSliders = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('[role="slider"]:not(input[type="range"])')),
    );
    expect(ariaSliders.length).toBe(0);

    const project: Project = getJsProject(getPrimaryTargetFiles(targetFiles));
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasCustomDragListeners = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      if (!exprText.endsWith('.addEventListener')) return false;
      const firstArg = call.getArguments()[0]?.getText().replace(/^['"`]|['"`]$/g, '');
      return Boolean(
        firstArg && /^(pointerdown|pointermove|mousedown|mousemove|touchstart|touchmove)$/.test(firstArg),
      );
    });
    expect(hasCustomDragListeners).toBe(false);
  });

  test('Provides an accessible name for the range input via <label> or aria-labelledby', () => {
    const docs = getPrimaryHtmlDocuments(targetFiles);
    const rangeEntries = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('input[type="range"]')).map((input: any) => ({
        document: d.document,
        input,
      })),
    );
    expect(rangeEntries.length).toBeGreaterThan(0);

    const hasAccessibleName = rangeEntries.some(({ document, input }) => {
      const id = input.getAttribute('id');
      if (id) {
        const matchingLabel = document.querySelector(`label[for="${id}"]`);
        if (matchingLabel && matchingLabel.textContent?.trim()) {
          return true;
        }
      }
      const parentLabel = input.closest('label');
      if (parentLabel && parentLabel.textContent?.trim()) {
        return true;
      }
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      if (ariaLabelledBy) {
        const ids = ariaLabelledBy.trim().split(/\s+/);
        if (
          ids.some((refId: string) => {
            const el = document.getElementById(refId);
            return Boolean(el && el.textContent?.trim());
          })
        ) {
          return true;
        }
      }
      const ariaLabel = input.getAttribute('aria-label');
      return Boolean(ariaLabel && ariaLabel.trim());
    });
    expect(hasAccessibleName).toBe(true);
  });

  test('Configures initial value, min, max, and step attributes on the range input', () => {
    const docs = getPrimaryHtmlDocuments(targetFiles);
    const rangeInputs = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('input[type="range"]')),
    );
    expect(rangeInputs.length).toBeGreaterThan(0);

    const configuredProperly = rangeInputs.some((input: any) => {
      const valAttr = input.getAttribute('value');
      const minAttr = input.getAttribute('min');
      const maxAttr = input.getAttribute('max');
      const stepAttr = input.getAttribute('step');

      if (valAttr === null || valAttr.trim() === '' || Number.isNaN(Number(valAttr))) {
        return false;
      }
      const val = Number(valAttr);
      const min = minAttr !== null && minAttr.trim() !== '' ? Number(minAttr) : 0;
      const max = maxAttr !== null && maxAttr.trim() !== '' ? Number(maxAttr) : 100;
      const step = stepAttr !== null && stepAttr.trim() !== '' ? Number(stepAttr) : 1;

      if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(step)) {
        return false;
      }
      return min < max && step > 0 && val >= min && val <= max;
    });
    expect(configuredProperly).toBe(true);
  });

  test('Uses appearance: none and browser-specific slider track, thumb, and progress pseudo-elements', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(getPrimaryTargetFiles(targetFiles));
    const styleRules = collectAllStyleRules(Array.from(stylesheet.cssRules));
    expect(styleRules.length).toBeGreaterThan(0);

    const hasAppearanceNone = styleRules.some((r) => {
      const appearance = r.style.getPropertyValue('appearance') || r.style.getPropertyValue('-webkit-appearance');
      return appearance.trim() === 'none';
    });
    expect(hasAppearanceNone).toBe(true);

    const selectors = styleRules.map((r) => r.selectorText);
    const hasWebkitTrack = selectors.some((s) => s.includes('::-webkit-slider-runnable-track'));
    const hasWebkitThumb = selectors.some((s) => s.includes('::-webkit-slider-thumb'));
    const hasMozTrack = selectors.some((s) => s.includes('::-moz-range-track'));
    const hasMozThumb = selectors.some((s) => s.includes('::-moz-range-thumb'));
    const hasMozProgress = selectors.some((s) => s.includes('::-moz-range-progress'));

    expect(hasWebkitTrack).toBe(true);
    expect(hasWebkitThumb).toBe(true);
    expect(hasMozTrack).toBe(true);
    expect(hasMozThumb).toBe(true);
    expect(hasMozProgress).toBe(true);
  });

  test('Uses each ::-webkit- or ::-moz- slider pseudo-element only once with custom properties for styling', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(getPrimaryTargetFiles(targetFiles));
    const styleRules = collectAllStyleRules(Array.from(stylesheet.cssRules));
    expect(styleRules.length).toBeGreaterThan(0);

    const pseudoNames = [
      '::-webkit-slider-runnable-track',
      '::-webkit-slider-thumb',
      '::-moz-range-track',
      '::-moz-range-thumb',
      '::-moz-range-progress',
    ];

    for (const pseudo of pseudoNames) {
      const matchingRules = styleRules.filter((r) => r.selectorText.includes(pseudo));
      expect(matchingRules.length).toBe(1);
      // Verify vendor pseudo-elements are not combined into comma-separated cross-vendor rules
      const ruleSelector = matchingRules[0].selectorText;
      const combinesVendors =
        ruleSelector.includes('::-webkit-') && ruleSelector.includes('::-moz-');
      expect(combinesVendors).toBe(false);
      // Verify custom properties (var(--...)) are used inside the pseudo-element rule
      expect(matchingRules[0].style.cssText).toContain('var(--');
    }
  });

  test('Derives custom track-fill progress from actual min, max, and value rather than assuming 0-100', () => {
    const primaryFiles = getPrimaryTargetFiles(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(primaryFiles);
    const styleRules = collectAllStyleRules(Array.from(stylesheet.cssRules));
    const customProps = collectCustomProperties(styleRules);
    expect(customProps.length).toBeGreaterThan(0);

    // Check CSS custom property calculation uses progress(...) or (value - min) / (max - min) formula
    const hasDynamicCssProgress = customProps.some((p) => {
      const v = p.value;
      const usesProgressFn = /progress\s*\([^)]*var\(--/i.test(v);
      const usesCalcRatio =
        /calc\s*\(/i.test(v) &&
        v.includes('-') &&
        v.includes('/') &&
        (v.match(/var\(--/g) || []).length >= 3;
      return usesProgressFn || usesCalcRatio;
    });

    // Also check JS AST for dynamic calculation or syncing of min/max/value custom properties
    const project: Project = getJsProject(primaryFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const setsCustomProperty = callExpressions.some((call) => {
      const text = call.getExpression().getText();
      return text.endsWith('.setProperty') && call.getArguments()[0]?.getText().includes('--');
    });

    expect(hasDynamicCssProgress && setsCustomProperty).toBe(true);
  });

  test('Does not use generated content on slider pseudo-elements', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(getPrimaryTargetFiles(targetFiles));
    const styleRules = collectAllStyleRules(Array.from(stylesheet.cssRules));
    expect(styleRules.length).toBeGreaterThan(0);

    const sliderRules = styleRules.filter((r) =>
      /::-(webkit-slider|moz-range)|input\[type=["']?range["']?\]/i.test(r.selectorText),
    );
    expect(sliderRules.length).toBeGreaterThan(0);

    const hasGeneratedContent = styleRules.some((r) => {
      const sel = r.selectorText;
      const targetsSliderWithBeforeAfter =
        (/::-(webkit-slider|moz-range)/i.test(sel) || /input\[type=["']?range["']?\]/i.test(sel)) &&
        /::?(before|after)\b/i.test(sel);
      const setsContentOnSliderPseudo =
        /::-(webkit-slider|moz-range)/i.test(sel) &&
        getAllPropertyValues(r, 'content').some((v) => v.trim() !== '' && v.trim() !== 'none' && v.trim() !== 'normal');
      return targetsSliderWithBeforeAfter || setsContentOnSliderPseudo;
    });
    expect(hasGeneratedContent).toBe(false);
  });

  test('Accounts for right-to-left layouts with an explicit RTL strategy for track direction', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(getPrimaryTargetFiles(targetFiles));
    const styleRules = collectAllStyleRules(Array.from(stylesheet.cssRules));
    expect(styleRules.length).toBeGreaterThan(0);

    const hasRtlRule = styleRules.some((r) => {
      const sel = r.selectorText;
      const isRtlSelector = /:dir\(\s*rtl\s*\)|\[dir=["']?rtl["']?\]/i.test(sel);
      if (!isRtlSelector) return false;
      const cssText = r.style.cssText.toLowerCase();
      return cssText.includes('to left') || cssText.includes('--');
    });

    const usesLogicalGradient = styleRules.some((r) => {
      const bg =
        r.style.getPropertyValue('background') || r.style.getPropertyValue('background-image');
      return /to\s+inline-end/i.test(bg);
    });

    expect(hasRtlRule || usesLogicalGradient).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Preserves a usable interaction area and provides a visible :focus-visible indicator', async ({
      page,
    }) => {
      const slider = page.getByRole('slider').first();
      await expect(slider).toBeVisible();

      const box = await slider.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(120);
      expect(box!.height).toBeGreaterThanOrEqual(24);

      await slider.focus();
      const focusStyles = await slider.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          appearance: s.appearance,
          outlineStyle: s.outlineStyle,
          outlineWidth: parseFloat(s.outlineWidth) || 0,
          outlineColor: s.outlineColor,
          boxShadow: s.boxShadow,
        };
      });

      expect(focusStyles.appearance).toBe('none');
      // The built-in focus ring (`outline-style: auto`) survives `appearance: none`; require an author-defined indicator.
      const hasVisibleOutline =
        focusStyles.outlineStyle !== 'none' &&
        focusStyles.outlineStyle !== 'auto' &&
        focusStyles.outlineWidth > 0 &&
        focusStyles.outlineColor !== 'rgba(0, 0, 0, 0)' &&
        focusStyles.outlineColor !== 'transparent';
      const hasVisibleBoxShadow =
        focusStyles.boxShadow !== 'none' && focusStyles.boxShadow !== '';
      expect(hasVisibleOutline || hasVisibleBoxShadow).toBe(true);
    });

    test('Exposes a descriptive aria-valuetext that differs from the plain numeric value and updates on input', async ({
      page,
    }) => {
      const slider = page.getByRole('slider').first();
      await expect(slider).toBeVisible();

      const initialState = await slider.evaluate((el: HTMLInputElement) => ({
        value: el.value,
        min: el.min || '0',
        max: el.max || '100',
        valueText: el.getAttribute('aria-valuetext') || '',
      }));

      expect(initialState.valueText.trim().length).toBeGreaterThan(0);
      expect(initialState.valueText.trim()).not.toBe(initialState.value.trim());
      expect(/[a-zA-Z]/.test(initialState.valueText)).toBe(true);

      // Change slider value and verify aria-valuetext and custom properties update dynamically
      const nextValue =
        initialState.value === initialState.max ? initialState.min : initialState.max;
      await slider.fill(nextValue);

      const updatedState = await slider.evaluate((el: HTMLInputElement) => ({
        value: el.value,
        valueText: el.getAttribute('aria-valuetext') || '',
      }));

      expect(updatedState.value).toBe(nextValue);
      expect(updatedState.valueText.trim().length).toBeGreaterThan(0);
      expect(updatedState.valueText.trim()).not.toBe(updatedState.value.trim());
      expect(updatedState.valueText).not.toBe(initialState.valueText);
    });
  });
});
