import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSPropertyRule,
  CSSGroupingRule,
  CSSNestedDeclarations,
  type CSSRule,
  type CSSStyleDeclaration,
} from 'cssomnom';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule) {
      result.push(...getAllRules(rule.cssRules));
    }
  }
  return result;
}

function getAllStyleDeclarations(rules: Iterable<CSSRule>): CSSStyleDeclaration[] {
  const decls: CSSStyleDeclaration[] = [];
  for (const rule of getAllRules(rules)) {
    if (rule instanceof CSSStyleRule || rule instanceof CSSNestedDeclarations) {
      decls.push(rule.style);
    }
  }
  return decls;
}

function getBackgroundValues(style: CSSStyleDeclaration): string[] {
  const values: string[] = [];
  const bg = style.getPropertyValue('background');
  const bgImg = style.getPropertyValue('background-image');
  if (bg) values.push(bg);
  if (bgImg) values.push(bgImg);

  // Fallback to style.cssText if shorthand serialization fails (e.g. alongside background-clip: border-area)
  const cssText = style.cssText || '';
  if (cssText) {
    values.push(cssText);
  }
  return values;
}

function extractConicGradientInner(str: string): string[] {
  const results: string[] = [];
  const regex = /\bconic-gradient\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < str.length && depth > 0) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') depth--;
      i++;
    }
    if (depth === 0) {
      results.push(str.slice(start, i - 1));
    }
  }
  return results;
}

function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

test.describe('progress-ring Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The component contains a native HTML <progress> element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const progressElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('progress')),
    );
    expect(progressElements.length).toBeGreaterThan(0);
  });

  test('The visual progress ring is implemented using a CSS conic-gradient', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const declarations = getAllStyleDeclarations(stylesheet.cssRules);
    expect(declarations.length).toBeGreaterThan(0);

    const hasConicGradient = declarations.some((style) =>
      getBackgroundValues(style).some((val) => /\bconic-gradient\s*\(/i.test(val)),
    );
    expect(hasConicGradient).toBe(true);
  });

  test('The center of the progress ring is transparent or "hollowed out" using background-clip: border-area', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const declarations = getAllStyleDeclarations(stylesheet.cssRules);
    expect(declarations.length).toBeGreaterThan(0);

    const hasBorderAreaClip = declarations.some((style) => {
      const bgClip = style.getPropertyValue('background-clip') || '';
      const webkitBgClip = style.getPropertyValue('-webkit-background-clip') || '';
      const bg = style.getPropertyValue('background') || '';
      return (
        /\bborder-area\b/i.test(bgClip) ||
        /\bborder-area\b/i.test(webkitBgClip) ||
        /\bborder-area\b/i.test(bg)
      );
    });
    expect(hasBorderAreaClip).toBe(true);
  });

  test('When background-clip: border-area is not supported, the center of the ring is hollowed out with a radial gradient mask', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const supportsRules = allRules.filter(
      (r): r is CSSSupportsRule =>
        r instanceof CSSSupportsRule &&
        /\bnot\b/i.test(r.conditionText) &&
        /\bbackground-clip\b/i.test(r.conditionText) &&
        /\bborder-area\b/i.test(r.conditionText),
    );
    expect(supportsRules.length).toBeGreaterThan(0);

    const fallbackDecls = supportsRules.flatMap((sr) => [
      ...(sr instanceof CSSStyleRule ? [sr.style] : []),
      ...getAllStyleDeclarations(sr.cssRules),
    ]);
    const hasRadialGradientMask = fallbackDecls.some((style) => {
      const maskImage = style.getPropertyValue('mask-image') || '';
      const webkitMaskImage = style.getPropertyValue('-webkit-mask-image') || '';
      const mask = style.getPropertyValue('mask') || '';
      const webkitMask = style.getPropertyValue('-webkit-mask') || '';
      return [maskImage, webkitMaskImage, mask, webkitMask].some((val) =>
        /\bradial-gradient\s*\(/i.test(val),
      );
    });
    expect(hasRadialGradientMask).toBe(true);
  });

  test('The value attribute on <progress> is used to drive the visual progress of the ring using attr()', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const declarations = getAllStyleDeclarations(stylesheet.cssRules);
    expect(declarations.length).toBeGreaterThan(0);

    const hasAttrValue = declarations.some((style) => {
      for (let i = 0; i < style.length; i++) {
        const propName = style.item(i);
        if (!propName) continue;
        const propValue = style.getPropertyValue(propName) || '';
        if (/\battr\s*\(\s*value\b/i.test(propValue)) {
          return true;
        }
      }
      return false;
    });
    expect(hasAttrValue).toBe(true);
  });

  test('When using attr() on non-content properties is not supported, a MutationObserver monitors the value attribute and updates the --value custom property', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    const newExprs = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.NewExpression));
    const hasMutationObserver = newExprs.some(
      (ne) => ne.getExpression().getText() === 'MutationObserver',
    );
    expect(hasMutationObserver).toBe(true);

    const callExprs = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression),
    );
    const observesAttributes = callExprs.some((ce) => {
      const expr = ce.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      if (expr.getName() !== 'observe') return false;
      const args = ce.getArguments();
      if (args.length < 2) return false;
      const configText = args[1].getText();
      return /\battributes\s*:\s*true\b/.test(configText) || /\bvalue\b/.test(configText);
    });
    expect(observesAttributes).toBe(true);

    const updatesValueProperty = callExprs.some((ce) => {
      const expr = ce.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      if (expr.getName() !== 'setProperty') return false;
      const firstArg = ce.getArguments()[0];
      return Boolean(firstArg && /^['"`]--[a-zA-Z0-9_-]+['"`]$/.test(firstArg.getText().trim()));
    });
    expect(updatesValueProperty).toBe(true);
  });

  test('The ring smoothly transitions between values when the --value property is updated (requiring @property support in the browser)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    expect(allRules.length).toBeGreaterThan(0);

    const propertyRules = allRules.filter(
      (r): r is CSSPropertyRule =>
        r instanceof CSSPropertyRule &&
        r.name.startsWith('--') &&
        (/<number>/i.test(r.syntax) || /<percentage>/i.test(r.syntax)),
    );
    expect(propertyRules.length).toBeGreaterThan(0);
    const registeredNames = propertyRules.map((r) => r.name);

    const declarations = getAllStyleDeclarations(stylesheet.cssRules);
    const transitionsValue = declarations.some((style) => {
      const transition = style.getPropertyValue('transition') || '';
      const transitionProp = style.getPropertyValue('transition-property') || '';
      return registeredNames.some(
        (name) => transition.includes(name) || transitionProp.includes(name),
      );
    });
    expect(transitionsValue).toBe(true);
  });

  test('The <progress> element includes an aria-label for accessibility', () => {
    const docs = getHtmlDocuments(targetFiles);
    const candidates = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('progress, [role="progressbar"]')).map((el: any) => ({
        el,
        document: d.document,
      })),
    );
    expect(candidates.length).toBeGreaterThan(0);

    const hasAriaLabel = candidates.some(({ el, document }) => {
      const label = el.getAttribute('aria-label')?.trim() ?? '';
      const valueText = el.getAttribute('aria-valuetext')?.trim() ?? '';
      const labelledBy = el.getAttribute('aria-labelledby')?.trim() ?? '';
      const hasValidLabelledBy =
        labelledBy.length > 0 &&
        labelledBy
          .split(/\s+/)
          .some((id: string) => Boolean(document.getElementById(id)?.textContent?.trim()));
      const id = el.getAttribute('id')?.trim() ?? '';
      const explicitLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
      const wrappingLabel = el.closest?.('label');
      const hasAssociatedLabel = Boolean(
        explicitLabel?.textContent?.trim() || wrappingLabel?.textContent?.trim(),
      );
      return label.length > 0 || valueText.length > 0 || hasValidLabelledBy || hasAssociatedLabel;
    });
    expect(hasAriaLabel).toBe(true);
  });

  test('The component has a distinct visual "track" (background) behind the progress fill', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const declarations = getAllStyleDeclarations(stylesheet.cssRules);
    expect(declarations.length).toBeGreaterThan(0);

    const hasDistinctTrack = declarations.some((style) => {
      const candidates = getBackgroundValues(style);
      for (const candidate of candidates) {
        const inners = extractConicGradientInner(candidate);
        for (const inner of inners) {
          // Ensure the conic-gradient has at least two distinct color stops separated by a top-level comma
          const stops = splitTopLevelCommas(inner).filter(
            (part) => !/^(from\b|in\b|at\b)/i.test(part),
          );
          if (stops.length >= 2 && stops[0] !== stops[1]) {
            return true;
          }
        }
      }
      return false;
    });
    expect(hasDistinctTrack).toBe(true);
  });

  test('The progress ring respects prefers-reduced-motion by changing to a new value immediately, rather than having a smooth transition', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    expect(allRules.length).toBeGreaterThan(0);

    const docs = getHtmlDocuments(targetFiles);
    const hasProgressEl = docs.some((d) =>
      Boolean(d.document.querySelector('progress, [role="progressbar"]')),
    );
    expect(hasProgressEl).toBe(true);

    const allDeclarations = getAllStyleDeclarations(stylesheet.cssRules);
    const hasRingAnimation =
      allRules.some((r) => r.constructor.name === 'CSSKeyframesRule') ||
      allDeclarations.some((style) => {
        const trans = `${style.getPropertyValue('transition')} ${style.getPropertyValue('transition-property')}`;
        return /--[a-zA-Z0-9_-]+|stroke-dashoffset|stroke-dasharray/i.test(trans);
      });
    if (!hasRingAnimation) return;

    const mediaRules = allRules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule && /\bprefers-reduced-motion\b/i.test(r.conditionText),
    );
    expect(mediaRules.length).toBeGreaterThan(0);
    const transitionReferencedVars = new Set<string>();
    for (const style of allDeclarations) {
      for (const prop of ['transition', 'transition-duration']) {
        const val = style.getPropertyValue(prop) || '';
        for (const match of val.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
          transitionReferencedVars.add(match[1]);
        }
      }
    }

    const nonZeroTimeRegex = /(?:^|[\s,(])(?:0?\.\d*[1-9]\d*|[1-9]\d*(?:\.\d+)?)m?s\b/i;
    const zeroOrNoneRegex = /\b(?:0s|0ms|none)\b/i;

    const getTransitionCandidates = (style: CSSStyleDeclaration): string[] => {
      const vals = [
        style.getPropertyValue('transition-duration') || '',
        style.getPropertyValue('transition') || '',
      ];
      for (let i = 0; i < style.length; i++) {
        const propName = style.item(i);
        if (
          propName &&
          propName.startsWith('--') &&
          (transitionReferencedVars.has(propName) ||
            /duration|transition|motion|speed/i.test(propName))
        ) {
          vals.push(style.getPropertyValue(propName) || '');
        }
      }
      return vals;
    };

    const respectsReducedMotion = mediaRules.some((mr) => {
      const decls = getAllStyleDeclarations(mr.cssRules);
      if (/\bno-preference\b/i.test(mr.conditionText)) {
        // Default duration is 0s (or via CSS variable), and prefers-reduced-motion: no-preference enables positive duration
        return decls.some((style) =>
          getTransitionCandidates(style).some((val) => nonZeroTimeRegex.test(val)),
        );
      }
      if (/\breduce\b/i.test(mr.conditionText)) {
        // Default has transition, and prefers-reduced-motion: reduce disables it or sets 0s
        return decls.some((style) =>
          getTransitionCandidates(style).some((val) => zeroOrNoneRegex.test(val)),
        );
      }
      return false;
    });
    expect(respectsReducedMotion).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('The component is visible on the page', async ({ page }) => {
      const progress = page.locator('progress').first();
      await expect(progress).toBeVisible();
      const box = await progress.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    });

    test('The component supports displaying text content (e.g., the percentage) in the center of the ring', async ({
      page,
    }) => {
      const progress = page.locator('progress').first();
      await expect(progress).toBeVisible();

      const centerContentInfo = await progress.evaluate((progEl) => {
        const progRect = progEl.getBoundingClientRect();
        const progCenterX = progRect.left + progRect.width / 2;
        const progCenterY = progRect.top + progRect.height / 2;

        const parent = progEl.parentElement;
        if (!parent) return null;

        const candidates = Array.from(parent.querySelectorAll('*')).filter(
          (el) => el !== progEl && !progEl.contains(el),
        );
        for (const sib of candidates) {
          const text = (sib.textContent || '').trim();
          if (!text) continue;
          const sibRect = sib.getBoundingClientRect();
          if (sibRect.width === 0 || sibRect.height === 0) continue;
          const sibCenterX = sibRect.left + sibRect.width / 2;
          const sibCenterY = sibRect.top + sibRect.height / 2;
          const style = window.getComputedStyle(sib);
          const dx = Math.abs(progCenterX - sibCenterX);
          const dy = Math.abs(progCenterY - sibCenterY);
          const ringRadius = Math.min(progRect.width, progRect.height) / 2;
          if (dx < ringRadius && dy < ringRadius) {
            return {
              text,
              position: style.position,
              dx,
              dy,
              ringRadius,
            };
          }
        }
        return null;
      });

      expect(centerContentInfo).not.toBeNull();
      expect(centerContentInfo!.text.length).toBeGreaterThan(0);
      expect(centerContentInfo!.dx).toBeLessThan(centerContentInfo!.ringRadius);
      expect(centerContentInfo!.dy).toBeLessThan(centerContentInfo!.ringRadius);
    });
  });
});
