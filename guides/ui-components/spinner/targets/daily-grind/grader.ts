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
    const spinnerEls = docs.flatMap((d) =>
      Array.from(
        d.document.querySelectorAll(
          'progress, [role="status"], [role="progressbar"], svg[aria-label], .spinner, .loading'
        )
      )
    );
    const hasAccessibleNameInHtml = spinnerEls.some((el) => {
      const ariaLabel = el.getAttribute('aria-label')?.trim();
      if (ariaLabel) return true;
      const ariaLabelledby = el.getAttribute('aria-labelledby')?.trim();
      if (ariaLabelledby) return true;
      const title = el.getAttribute('title')?.trim();
      if (title) return true;
      const visuallyHidden = el.querySelector(
        '.sr-only, .visually-hidden, [class*="hidden" i]'
      );
      if (visuallyHidden && (visuallyHidden.textContent?.trim().length ?? 0) > 0)
        return true;
      const id = el.getAttribute('id');
      if (
        id &&
        docs.some((d) =>
          Boolean(d.document.querySelector(`label[for="${id}"]`))
        )
      )
        return true;
      return false;
    });

    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasAriaLabelInJs = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      const firstArg = call
        .getArguments()[0]
        ?.getText()
        .replace(/^['"`]|['"`]$/g, '');
      return (
        exprText.endsWith('setAttribute') &&
        (firstArg === 'aria-label' || firstArg === 'aria-labelledby')
      );
    });

    expect(hasAccessibleNameInHtml || hasAriaLabelInJs).toBe(true);
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

    test('With prefers-reduced-motion: reduce, the spinner shows an arc in the spinner color, not only the track', async ({
      page,
      TARGET_URL,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(TARGET_URL);

      const progressCountBefore = await page.locator('progress:visible').count();
      if (progressCountBefore === 0) {
        await page.evaluate(() => {
          document.addEventListener('click', (e) => e.preventDefault(), { capture: false });
        });
        await page.locator('a.btn').first().click();
      }

      const progress = page.locator('progress').first();
      await expect(progress).toBeVisible();

      const arcState = await progress.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        const bgImage = cs.backgroundImage;
        const bgColor = cs.backgroundColor;

        const evalDeg = (expr: string): number | null => {
          const cleaned = expr.trim();
          const simple = cleaned.match(/^(-?\d+(?:\.\d+)?)deg$/);
          if (simple) return parseFloat(simple[1]!);
          const calcSub = cleaned.match(/^calc\(\s*(-?\d+(?:\.\d+)?)deg\s*-\s*(-?\d+(?:\.\d+)?)deg\s*\)$/);
          if (calcSub) return parseFloat(calcSub[1]!) - parseFloat(calcSub[2]!);
          const calcAdd = cleaned.match(/^calc\(\s*(-?\d+(?:\.\d+)?)deg\s*\+\s*(-?\d+(?:\.\d+)?)deg\s*\)$/);
          if (calcAdd) return parseFloat(calcAdd[1]!) + parseFloat(calcAdd[2]!);
          // Handle nested calc like calc((90deg + 158deg) - (90deg + 0deg))
          const nums = cleaned.replace(/deg/g, '').replace(/^calc/, '');
          if (/^[\s0-9.+\-*/()]+$/.test(nums)) {
            try {
              const val = Function(`"use strict"; return (${nums});`)();
              if (typeof val === 'number' && Number.isFinite(val)) return val;
            } catch {}
          }
          return null;
        };

        // Parse conic-gradient(from ..., <color> <stop>, ...)
        let arcSweepDeg: number | null = null;
        let arcColor: string | null = null;
        const cgMatch = bgImage.match(/conic-gradient\((.*)\)/);
        if (cgMatch) {
          const inner = cgMatch[1]!;
          const parts: string[] = [];
          let depth = 0;
          let cur = '';
          for (const ch of inner) {
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            if (ch === ',' && depth === 0) {
              parts.push(cur.trim());
              cur = '';
            } else {
              cur += ch;
            }
          }
          if (cur.trim()) parts.push(cur.trim());

          const firstColorStop = parts[0]?.startsWith('from ') ? parts[1] : parts[0];
          if (firstColorStop) {
            const colorMatch = firstColorStop.match(/^(rgba?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|#[0-9a-f]+|[a-z]+)\s+(.+)$/i);
            if (colorMatch) {
              arcColor = colorMatch[1]!.trim();
              arcSweepDeg = evalDeg(colorMatch[2]!);
            }
          }
        }

        // Fallback check on --_from / --_to if backgroundImage didn't resolve calc
        const fromVal = evalDeg(cs.getPropertyValue('--_from'));
        const toVal = evalDeg(cs.getPropertyValue('--_to'));
        const varSweep = fromVal !== null && toVal !== null ? toVal - fromVal : null;

        return {
          bgImage,
          bgColor,
          arcColor,
          arcSweepDeg,
          varSweep,
        };
      });

      expect(arcState.bgImage).toContain('conic-gradient');
      const sweep = arcState.arcSweepDeg ?? arcState.varSweep ?? 0;
      expect(sweep).toBeGreaterThan(0);
      expect(arcState.arcColor).toBeTruthy();
      expect(arcState.arcColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(arcState.arcColor).not.toBe('transparent');
      expect(arcState.arcColor).not.toBe(arcState.bgColor);
    });
  });
});
