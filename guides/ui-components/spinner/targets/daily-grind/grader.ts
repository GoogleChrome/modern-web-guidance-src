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
  CSSPropertyRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSSupportsRule,
  CSSMediaRule,
  CSSNestedDeclarations,
  type CSSRule,
  type CSSStyleDeclaration,
} from 'cssomnom';
import { SyntaxKind } from 'ts-morph';
import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(
  // @ts-ignore
  import.meta.url
);

function getAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...getAllRules(rule.cssRules as Iterable<CSSRule>));
    }
    if ('childRules' in rule && Array.isArray(rule.childRules)) {
      result.push(...getAllRules(rule.childRules as Iterable<CSSRule>));
    }
  }
  return result;
}

function getAllStyleDeclarations(rules: Iterable<CSSRule>): CSSStyleDeclaration[] {
  const allRules = getAllRules(rules);
  const styles: CSSStyleDeclaration[] = [];
  for (const rule of allRules) {
    if (rule instanceof CSSStyleRule || rule instanceof CSSNestedDeclarations || rule instanceof CSSKeyframeRule) {
      styles.push(rule.style);
    }
  }
  return styles;
}

test.describe('spinner Target Grader', () => {
  test('contains a native HTML <progress> element in HTML or created via JS', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasProgressInHtml = docs.some((d) => Boolean(d.document.querySelector('progress')));

    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasProgressInJs = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      const firstArg = call.getArguments()[0]?.getText().replace(/^['"`]|['"`]$/g, '');
      return exprText.endsWith('createElement') && firstArg?.toLowerCase() === 'progress';
    });

    expect(hasProgressInHtml || hasProgressInJs).toBe(true);
  });

  test('<progress> element omits the value attribute for indeterminate state and styles :indeterminate', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const progressEls = docs.flatMap((d) => Array.from(d.document.querySelectorAll('progress')));
    const noValueInHtml = progressEls.every((el) => !el.hasAttribute('value'));

    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const hasIndeterminateSelector = allRules.some(
      (r) => r instanceof CSSStyleRule && r.selectorText.includes(':indeterminate')
    );

    expect(noValueInHtml && hasIndeterminateSelector).toBe(true);
  });

  test('<progress> element includes an aria-label attribute for accessibility', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const progressEls = docs.flatMap((d) => Array.from(d.document.querySelectorAll('progress')));
    const hasAriaLabelInHtml = progressEls.some((el) =>
      Boolean(el.getAttribute('aria-label')?.trim())
    );

    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasAriaLabelInJs = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      const firstArg = call.getArguments()[0]?.getText().replace(/^['"`]|['"`]$/g, '');
      return exprText.endsWith('setAttribute') && firstArg === 'aria-label';
    });

    expect(hasAriaLabelInHtml || hasAriaLabelInJs).toBe(true);
  });

  test('visual spinner uses a conic-gradient with dynamic angles driven by CSS custom properties', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styles = getAllStyleDeclarations(stylesheet.cssRules);
    const hasDynamicConicGradient = styles.some((style) => {
      const bg = style.getPropertyValue('background') || style.getPropertyValue('background-image');
      return bg.includes('conic-gradient') && bg.includes('var(--');
    });

    expect(hasDynamicConicGradient).toBe(true);
  });

  test('spinner uses dual-animation approach with progress-spin and progress-dash keyframes', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const keyframeRules = allRules.filter((r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule);
    const hasSpinKeyframes = keyframeRules.some((k) => k.name === 'progress-spin');
    const hasDashKeyframes = keyframeRules.some((k) => k.name === 'progress-dash');

    expect(hasSpinKeyframes && hasDashKeyframes).toBe(true);
  });

  test('registers --arc-start and --arc-end using @property with <angle> syntax and animates them in progress-dash', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const propertyRules = allRules.filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule);

    const hasArcStart = propertyRules.some(
      (p) => p.name === '--arc-start' && p.syntax.includes('<angle>')
    );
    const hasArcEnd = propertyRules.some(
      (p) => p.name === '--arc-end' && p.syntax.includes('<angle>')
    );

    const dashKeyframes = allRules.find(
      (r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule && r.name === 'progress-dash'
    );
    const keyframeStyles = dashKeyframes
      ? Array.from(dashKeyframes.cssRules)
          .filter((r): r is CSSKeyframeRule => r instanceof CSSKeyframeRule)
          .map((r) => r.style)
      : [];
    const animatesArcProps = keyframeStyles.some(
      (s) => Boolean(s.getPropertyValue('--arc-start')) && Boolean(s.getPropertyValue('--arc-end'))
    );

    expect(hasArcStart && hasArcEnd && animatesArcProps).toBe(true);
  });

  test('registers --progress-dash-animation using @property with syntax "*" and initial-value referencing progress-dash', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const propertyRules = allRules.filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule);

    const hasDashAnimProperty = propertyRules.some(
      (p) =>
        p.name === '--progress-dash-animation' &&
        p.syntax.replace(/['"]/g, '').trim() === '*' &&
        Boolean(p.initialValue?.includes('progress-dash'))
    );

    expect(hasDashAnimProperty).toBe(true);
  });

  test('dash animation fails gracefully in CSS via var(--progress-dash-animation, ) fallback on animation property', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styles = getAllStyleDeclarations(stylesheet.cssRules);

    const hasGracefulAnimationFallback = styles.some((style) => {
      const anim = style.getPropertyValue('animation') || style.getPropertyValue('animation-name');
      return (
        anim.includes('progress-spin') &&
        anim.includes('var(--progress-dash-animation')
      );
    });

    expect(hasGracefulAnimationFallback).toBe(true);
  });

  test('hollows out the center of the ring using @supports (background-clip: border-area)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);

    const hasBorderAreaSupport = supportsRules.some((s) => {
      const cond = s.conditionText.toLowerCase();
      if (!cond.includes('background-clip') || !cond.includes('border-area') || cond.includes('not')) {
        return false;
      }
      const nestedStyles = getAllStyleDeclarations(s.cssRules);
      return nestedStyles.some(
        (st) => st.getPropertyValue('background-clip').trim() === 'border-area'
      );
    });

    expect(hasBorderAreaSupport).toBe(true);
  });

  test('falls back to a radial-gradient mask when background-clip: border-area is not supported', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);

    const hasMaskFallback = supportsRules.some((s) => {
      const cond = s.conditionText.toLowerCase();
      if (!cond.includes('not') || !cond.includes('background-clip') || !cond.includes('border-area')) {
        return false;
      }
      const nestedStyles = getAllStyleDeclarations(s.cssRules);
      return nestedStyles.some((st) => {
        const mask =
          st.getPropertyValue('mask-image') ||
          st.getPropertyValue('mask') ||
          st.getPropertyValue('-webkit-mask-image') ||
          st.getPropertyValue('-webkit-mask');
        return mask.includes('radial-gradient');
      });
    });

    expect(hasMaskFallback).toBe(true);
  });

  test('respects prefers-reduced-motion by significantly slowing down the animation duration', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const mediaRules = allRules.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule);

    const hasReducedMotionSlowdown = mediaRules.some((m) => {
      if (!m.conditionText.toLowerCase().includes('prefers-reduced-motion')) {
        return false;
      }
      const nestedStyles = getAllStyleDeclarations(m.cssRules);
      return nestedStyles.some((st) => {
        const usedDuration = st.getPropertyValue('--_used-spinner-duration').trim();
        const spinnerDuration = st.getPropertyValue('--spinner-duration').trim();
        const animDuration = st.getPropertyValue('animation-duration').trim();
        const anim = st.getPropertyValue('animation').trim();
        return Boolean(usedDuration || spinnerDuration || animDuration || anim);
      });
    });

    expect(hasReducedMotionSlowdown).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('spinner component is visible on the page when triggered', async ({ page }) => {
      const progressCountBefore = await page.locator('progress:visible').count();
      if (progressCountBefore === 0) {
        await page.evaluate(() => {
          document.addEventListener('click', (e) => e.preventDefault(), { capture: false });
        });
        await page.locator('a.btn').first().click();
      }

      await expect(page.locator('progress').first()).toBeVisible();
    });
  });
});
