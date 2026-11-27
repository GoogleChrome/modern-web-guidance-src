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

    test('In fully styled sliders, the track color has a contrast ratio of at least 3:1 with the background color', async ({
      page,
    }) => {
      const slider = page.getByRole('slider').first();
      await expect(slider).toBeVisible();

      const contrastCheck = await slider.evaluate((el) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        type RGBA = [number, number, number, number];
        const toRgba = (color: string): RGBA => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = 'rgba(0, 0, 0, 0)';
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2], d[3] / 255];
        };
        const over = (top: RGBA, bottom: RGBA): RGBA => [
          top[0] * top[3] + bottom[0] * (1 - top[3]),
          top[1] * top[3] + bottom[1] * (1 - top[3]),
          top[2] * top[3] + bottom[2] * (1 - top[3]),
          1,
        ];
        const luminance = (c: RGBA): number => {
          const lin = (v: number) => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
        };
        const ratio = (a: RGBA, b: RGBA): number => {
          const la = luminance(a);
          const lb = luminance(b);
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };

        // Effective background behind slider
        const layers: RGBA[] = [];
        for (let node: Element | null = el; node; node = node.parentElement) {
          const bg = toRgba(getComputedStyle(node).backgroundColor);
          if (bg[3] > 0) layers.push(bg);
          if (bg[3] >= 1) break;
        }
        let bg: RGBA = layers.length && layers[layers.length - 1][3] >= 1 ? layers.pop()! : [255, 255, 255, 1];
        while (layers.length) bg = over(layers.pop()!, bg);

        const trackStyle = getComputedStyle(el, '::-webkit-slider-runnable-track');
        const trackVar = getComputedStyle(el).getPropertyValue('--slider-track-color').trim();
        const bgImg = trackStyle.backgroundImage;
        const colors: string[] = [];
        if (trackVar) colors.push(trackVar);
        if (bgImg && bgImg !== 'none') {
          const matches = bgImg.match(/(?:rgba?|hsla?|oklch|oklab|color)\([^)]+\)|#[0-9a-f]{3,8}/gi) || [];
          colors.push(...matches);
        }
        if (trackStyle.backgroundColor && toRgba(trackStyle.backgroundColor)[3] > 0) {
          colors.push(trackStyle.backgroundColor);
        }

        const ratios = colors
          .map((c) => toRgba(c))
          .filter((c) => c[3] > 0)
          .map((c) => ratio(over(c, bg), bg));

        return {
          appearance: getComputedStyle(el).appearance,
          ratios,
          minRatio: ratios.length > 0 ? Math.min(...ratios) : 0,
        };
      });

      expect(contrastCheck.appearance).toBe('none');
      expect(contrastCheck.ratios.length).toBeGreaterThan(0);
      expect(contrastCheck.minRatio).toBeGreaterThanOrEqual(2.98);
    });

    test('Preserves a usable interaction area with a touch target size of at least 24 CSS pixels', async ({
      page,
    }) => {
      const slider = page.getByRole('slider').first();
      await expect(slider).toBeVisible();

      const box = await slider.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    });

    test('Provides a visible :focus-visible indicator with at least 3:1 contrast after changing native appearance', async ({
      page,
    }) => {
      const slider = page.getByRole('slider').first();
      await expect(slider).toBeVisible();

      await slider.focus();
      const focusStyles = await slider.evaluate((el) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        type RGBA = [number, number, number, number];
        const toRgba = (color: string): RGBA => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = 'rgba(0, 0, 0, 0)';
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2], d[3] / 255];
        };
        const over = (top: RGBA, bottom: RGBA): RGBA => [
          top[0] * top[3] + bottom[0] * (1 - top[3]),
          top[1] * top[3] + bottom[1] * (1 - top[3]),
          top[2] * top[3] + bottom[2] * (1 - top[3]),
          1,
        ];
        const luminance = (c: RGBA): number => {
          const lin = (v: number) => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
        };
        const ratio = (a: RGBA, b: RGBA): number => {
          const la = luminance(a);
          const lb = luminance(b);
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };

        const layers: RGBA[] = [];
        for (let node: Element | null = el.parentElement; node; node = node.parentElement) {
          const bg = toRgba(getComputedStyle(node).backgroundColor);
          if (bg[3] > 0) layers.push(bg);
          if (bg[3] >= 1) break;
        }
        let bg: RGBA = layers.length && layers[layers.length - 1][3] >= 1 ? layers.pop()! : [255, 255, 255, 1];
        while (layers.length) bg = over(layers.pop()!, bg);

        const s = window.getComputedStyle(el);
        const hasVisibleOutline =
          s.outlineStyle !== 'none' &&
          s.outlineStyle !== 'auto' &&
          (parseFloat(s.outlineWidth) || 0) > 0 &&
          toRgba(s.outlineColor)[3] > 0;
        const hasVisibleBoxShadow = s.boxShadow !== 'none' && s.boxShadow !== '';
        let focusContrast = 0;
        if (hasVisibleOutline) {
          focusContrast = Math.max(focusContrast, ratio(over(toRgba(s.outlineColor), bg), bg));
        }
        if (hasVisibleBoxShadow) {
          const shadowColors = s.boxShadow.match(/(?:rgba?|hsla?|oklch|oklab|color)\([^)]+\)|#[0-9a-f]{3,8}/gi) ?? [];
          for (const color of shadowColors) {
            focusContrast = Math.max(focusContrast, ratio(over(toRgba(color), bg), bg));
          }
        }

        return {
          appearance: s.appearance,
          hasIndicator: hasVisibleOutline || hasVisibleBoxShadow,
          focusContrast,
        };
      });

      expect(focusStyles.appearance).toBe('none');
      expect(focusStyles.hasIndicator).toBe(true);
      expect(focusStyles.focusContrast).toBeGreaterThanOrEqual(2.98);
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
