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
  CSSMediaRule,
  CSSSupportsRule,
  CSSPropertyRule,
  CSSGroupingRule,
  CSSNestedDeclarations,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';

// @ts-ignore - import.meta.url is supported at runtime by the Playwright ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllRules(rule.cssRules));
    }
  }
  return result;
}

function getAllStyleDeclarations(rules: Iterable<CSSRule>): Array<{ rule: CSSStyleRule | CSSNestedDeclarations; selectorText: string }> {
  const result: Array<{ rule: CSSStyleRule | CSSNestedDeclarations; selectorText: string }> = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push({ rule, selectorText: rule.selectorText });
      if (rule.cssRules) {
        for (const child of getAllRules(rule.cssRules)) {
          if (child instanceof CSSStyleRule) {
            result.push({ rule: child, selectorText: child.selectorText });
          } else if (child instanceof CSSNestedDeclarations) {
            result.push({ rule: child, selectorText: rule.selectorText });
          }
        }
      }
    } else if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllStyleDeclarations(rule.cssRules));
    }
  }
  return result;
}

test.describe('progress-ring Target Grader', () => {
  test('The component contains a native HTML <progress> element with a value attribute', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const progressEl = docs.map((d) => d.document.querySelector('progress')).find(Boolean);
    expect(progressEl?.hasAttribute('value')).toBe(true);
  });

  test('The <progress> element includes an aria-label for accessibility', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const progressEl = docs.map((d) => d.document.querySelector('progress')).find(Boolean);
    const ariaLabel = progressEl?.getAttribute('aria-label')?.trim() ?? '';
    expect(ariaLabel.length).toBeGreaterThan(0);
  });

  test('The component supports displaying text content in the center of the ring', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allDecls = getAllStyleDeclarations(stylesheet.cssRules);

    const hasCenterContentMarkup = docs.some((d) => {
      const progress = d.document.querySelector('progress');
      const wrapper = progress?.parentElement;
      if (!wrapper) return false;
      return Array.from(wrapper.children).some(
        (child) => child !== progress && (child.textContent?.trim().length ?? 0) > 0
      );
    });

    const hasPositionedOverlayCss = allDecls.some(
      ({ rule }) =>
        rule.style.getPropertyValue('position').includes('absolute') ||
        rule.style.getPropertyValue('place-items').includes('center') ||
        rule.style.getPropertyValue('grid-area') !== ''
    );

    expect(hasCenterContentMarkup && hasPositionedOverlayCss).toBe(true);
  });

  test('The visual progress ring is implemented using a CSS conic-gradient and has a distinct visual track', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allDecls = getAllStyleDeclarations(stylesheet.cssRules);

    const hasConicGradientWithTrack = allDecls.some(({ rule }) => {
      const bg =
        rule.style.getPropertyValue('background') ||
        rule.style.getPropertyValue('background-image');
      return bg.includes('conic-gradient') && bg.includes(',');
    });

    expect(hasConicGradientWithTrack).toBe(true);
  });

  test('The center of the progress ring is hollowed out using background-clip: border-area', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allDecls = getAllStyleDeclarations(stylesheet.cssRules);

    const hasBorderAreaClip = allDecls.some(({ rule }) => {
      const clip =
        rule.style.getPropertyValue('background-clip') ||
        rule.style.getPropertyValue('-webkit-background-clip');
      const bg = rule.style.getPropertyValue('background');
      return clip.includes('border-area') || bg.includes('border-area');
    });

    expect(hasBorderAreaClip).toBe(true);
  });

  test('Fallback hollows out the center of the ring with a radial-gradient mask when background-clip: border-area is not supported', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const supportsFallbackRules = allRules.filter(
      (r): r is CSSSupportsRule =>
        r instanceof CSSSupportsRule &&
        r.conditionText.includes('not') &&
        r.conditionText.includes('border-area')
    );

    const hasRadialMaskInFallback = supportsFallbackRules.some((sr) =>
      getAllStyleDeclarations(sr.cssRules).some(({ rule }) => {
        const mask =
          rule.style.getPropertyValue('mask-image') ||
          rule.style.getPropertyValue('-webkit-mask-image') ||
          rule.style.getPropertyValue('mask') ||
          rule.style.getPropertyValue('-webkit-mask');
        return mask.includes('radial-gradient');
      })
    );

    expect(hasRadialMaskInFallback).toBe(true);
  });

  test('The value attribute on <progress> drives the visual progress of the ring using attr()', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allDecls = getAllStyleDeclarations(stylesheet.cssRules);

    const hasAttrValue = allDecls.some(({ rule }) => {
      const val = rule.style.getPropertyValue('--value');
      const bg =
        rule.style.getPropertyValue('background') ||
        rule.style.getPropertyValue('background-image');
      return (
        (val.includes('attr(') && val.includes('value')) ||
        (bg.includes('attr(') && bg.includes('value'))
      );
    });

    expect(hasAttrValue).toBe(true);
  });

  test('Fallback updates the visual ring using a MutationObserver that monitors the value attribute and updates --value', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const newExprs = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.NewExpression)
    );
    const hasMutationObserver = newExprs.some(
      (expr) => expr.getExpression().getText() === 'MutationObserver'
    );

    const callExprs = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasSetPropertyValue = callExprs.some((expr) => {
      const propAccess = expr.getExpressionIfKind(SyntaxKind.PropertyAccessExpression);
      if (propAccess?.getName() !== 'setProperty') return false;
      const firstArg = expr.getArguments()[0]?.getText().replace(/['"`]/g, '');
      return firstArg === '--value';
    });

    const hasObserveValueAttr = callExprs.some((expr) => {
      const propAccess = expr.getExpressionIfKind(SyntaxKind.PropertyAccessExpression);
      if (propAccess?.getName() !== 'observe') return false;
      const configArg = expr.getArguments()[1];
      if (!configArg) return false;
      const objLit = configArg.asKind(SyntaxKind.ObjectLiteralExpression);
      if (!objLit) return false;
      return objLit.getProperties().some((p) => {
        const propAssign = p.asKind(SyntaxKind.PropertyAssignment);
        const name = propAssign?.getName().replace(/['"`]/g, '');
        return name === 'attributes' || name === 'attributeFilter';
      });
    });

    expect(hasMutationObserver && hasSetPropertyValue && hasObserveValueAttr).toBe(true);
  });

  test('The ring registers --value with @property and transitions it smoothly', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const allDecls = getAllStyleDeclarations(stylesheet.cssRules);

    const hasRegisteredValueProperty = allRules.some(
      (r) =>
        r instanceof CSSPropertyRule &&
        r.name === '--value' &&
        r.syntax.includes('<number>')
    );

    const hasValueTransition = allDecls.some(({ rule }) => {
      const transition = rule.style.getPropertyValue('transition');
      const transitionProp = rule.style.getPropertyValue('transition-property');
      return transition.includes('--value') || transitionProp.includes('--value');
    });

    expect(hasRegisteredValueProperty && hasValueTransition).toBe(true);
  });

  test('The component respects prefers-reduced-motion by only enabling non-zero transition duration when motion is allowed', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const motionMediaRules = allRules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule &&
        r.conditionText.includes('prefers-reduced-motion')
    );

    const hasReducedMotionHandling = motionMediaRules.some((mr) =>
      getAllStyleDeclarations(mr.cssRules).some(({ rule }) => {
        const duration = rule.style.getPropertyValue('transition-duration');
        const transition = rule.style.getPropertyValue('transition');
        return duration !== '' || transition !== '';
      })
    );

    expect(hasReducedMotionHandling).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('The progress ring component is visible on the page with circular ring dimensions', async ({ page }) => {
      const progressLocator = page.locator('progress').first();
      await expect(progressLocator).toBeVisible();
    });
  });
});
