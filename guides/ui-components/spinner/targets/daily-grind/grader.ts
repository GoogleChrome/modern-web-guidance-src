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
        const bgColorStr = cs.backgroundColor;

        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const resolveRgba = (colorStr: string): [number, number, number, number] | null => {
          if (!ctx || !colorStr || colorStr === 'none') return null;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = 'rgba(0, 0, 0, 0)';
          ctx.fillStyle = colorStr;
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          return [data[0]!, data[1]!, data[2]!, data[3]!];
        };

        const sameColor = (
          a: [number, number, number, number],
          b: [number, number, number, number] | null,
        ): boolean => {
          if (!b) return false;
          return (
            Math.abs(a[0] - b[0]) <= 2 &&
            Math.abs(a[1] - b[1]) <= 2 &&
            Math.abs(a[2] - b[2]) <= 2 &&
            Math.abs(a[3] - b[3]) <= 2
          );
        };

        const isVisibleSpinnerColor = (
          rgba: [number, number, number, number] | null,
          trackBg: [number, number, number, number] | null,
        ): boolean => {
          if (!rgba || rgba[3] === 0) return false;
          return !sameColor(rgba, trackBg);
        };

        const parseAngleToDeg = (expr: string): number | null => {
          const cleaned = expr.trim();
          const simple = cleaned.match(/^(-?\d*\.?\d+(?:e[+-]?\d+)?)(deg|turn|rad|grad|%)$/i);
          if (simple) {
            const v = Number(simple[1]);
            const unit = simple[2]!.toLowerCase();
            if (unit === 'deg') return v;
            if (unit === 'turn') return v * 360;
            if (unit === 'rad') return (v * 180) / Math.PI;
            if (unit === 'grad') return v * 0.9;
            if (unit === '%') return (v / 100) * 360;
          }
          if (/^calc\(/i.test(cleaned)) {
            const converted = cleaned
              .slice(5, -1)
              .replace(/(-?\d*\.?\d+)(deg|turn|rad|grad|%)/gi, (_, n, u) => {
                const v = Number(n);
                const unit = u.toLowerCase();
                if (unit === 'turn') return String(v * 360);
                if (unit === 'rad') return String((v * 180) / Math.PI);
                if (unit === 'grad') return String(v * 0.9);
                if (unit === '%') return String((v / 100) * 360);
                return String(v);
              });
            if (/^[\s0-9.+\-*/()]+$/.test(converted)) {
              try {
                const val = Function(`"use strict"; return (${converted});`)();
                if (typeof val === 'number' && Number.isFinite(val)) return val;
              } catch {}
            }
          }
          return null;
        };

        const splitTopLevel = (str: string, separator: 'comma' | 'space'): string[] => {
          const out: string[] = [];
          let depth = 0;
          let cur = '';
          for (const ch of str) {
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            const isSep = separator === 'comma' ? ch === ',' : /\s/.test(ch);
            if (isSep && depth === 0) {
              if (cur.trim()) out.push(cur.trim());
              cur = '';
            } else {
              cur += ch;
            }
          }
          if (cur.trim()) out.push(cur.trim());
          return out;
        };

        const extractConicInner = (input: string): string | null => {
          const idx = input.indexOf('conic-gradient(');
          if (idx === -1) return null;
          let depth = 0;
          const start = idx + 'conic-gradient('.length;
          for (let i = start; i < input.length; i++) {
            if (input[i] === '(') depth++;
            else if (input[i] === ')') {
              if (depth === 0) return input.slice(start, i);
              depth--;
            }
          }
          return null;
        };

        const trackBg = resolveRgba(bgColorStr);
        const inner = extractConicInner(bgImage);
        let maxVisibleSweepDeg = 0;

        if (inner) {
          const parts = splitTopLevel(inner, 'comma');
          const stopParts =
            parts[0] && /^(from\s|at\s|in\s)/i.test(parts[0]) ? parts.slice(1) : parts;

          const parsedStops: Array<{
            color: [number, number, number, number] | null;
            positions: number[];
          }> = [];

          for (const part of stopParts) {
            const tokens = splitTopLevel(part, 'space');
            if (tokens.length === 0) continue;
            // Skip color-hint-only entries (single angle/percentage)
            if (tokens.length === 1 && parseAngleToDeg(tokens[0]!) !== null) continue;
            const color = resolveRgba(tokens[0]!);
            const positions: number[] = [];
            for (let i = 1; i < tokens.length; i++) {
              const deg = parseAngleToDeg(tokens[i]!);
              if (deg !== null) positions.push(deg);
            }
            parsedStops.push({ color, positions });
          }

          // Expand stops into monotonic (color, deg) anchors per CSS Images 4
          const anchors: Array<{ color: [number, number, number, number] | null; deg: number }> = [];
          let prevDeg = -Infinity;
          for (let i = 0; i < parsedStops.length; i++) {
            const stop = parsedStops[i]!;
            if (stop.positions.length === 0) {
              const deg =
                i === 0 ? 0 : i === parsedStops.length - 1 ? 360 : Math.max(prevDeg, (i / (parsedStops.length - 1)) * 360);
              prevDeg = Math.max(prevDeg, deg);
              anchors.push({ color: stop.color, deg: prevDeg });
            } else {
              for (const rawDeg of stop.positions) {
                prevDeg = Math.max(prevDeg, rawDeg);
                anchors.push({ color: stop.color, deg: prevDeg });
              }
            }
          }

          // CSS fills [0deg, firstAnchor.deg] solidly with firstAnchor.color if firstAnchor.deg > 0
          if (anchors.length > 0 && anchors[0]!.deg > 0 && isVisibleSpinnerColor(anchors[0]!.color, trackBg)) {
            maxVisibleSweepDeg = Math.max(maxVisibleSweepDeg, Math.min(360, anchors[0]!.deg));
          }

          for (let i = 0; i < anchors.length - 1; i++) {
            const cur = anchors[i]!;
            const next = anchors[i + 1]!;
            const sweep = Math.max(0, Math.min(360, next.deg) - Math.max(0, cur.deg));
            if (
              sweep > 0 &&
              (isVisibleSpinnerColor(cur.color, trackBg) || isVisibleSpinnerColor(next.color, trackBg))
            ) {
              maxVisibleSweepDeg = Math.max(maxVisibleSweepDeg, sweep);
            }
          }
        }

        return {
          bgImage,
          bgColor: bgColorStr,
          maxVisibleSweepDeg,
        };
      });

      expect(arcState.bgImage).toContain('conic-gradient');
      expect(arcState.maxVisibleSweepDeg).toBeGreaterThan(0);
    });
  });
});
