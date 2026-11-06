import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import type { CSSRule, CSSStyleSheet } from 'cssomnom';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSGroupingRule,
} from 'cssomnom';

// @ts-ignore - import.meta.url is supported by the Playwright ESM test runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule) {
      result.push(...getAllStyleRules(rule.cssRules));
    }
  }
  return result;
}

function getAllMediaRules(rules: Iterable<CSSRule>): CSSMediaRule[] {
  const result: CSSMediaRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule) {
      result.push(...getAllMediaRules(rule.cssRules));
    }
  }
  return result;
}

function getAllSupportsRules(rules: Iterable<CSSRule>): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSSupportsRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule) {
      result.push(...getAllSupportsRules(rule.cssRules));
    }
  }
  return result;
}

function getStylePropsText(rule: CSSStyleRule): string {
  const values: string[] = [];
  for (let i = 0; i < rule.style.length; i++) {
    const prop = rule.style.item(i);
    if (prop) {
      values.push(`${prop}: ${rule.style.getPropertyValue(prop)}`);
    }
  }
  return values.join('; ');
}

function hasTextDecorationLine(rule: CSSStyleRule): boolean {
  const td = rule.style.getPropertyValue('text-decoration');
  const tdl = rule.style.getPropertyValue('text-decoration-line');
  const combined = `${td} ${tdl}`;
  return (
    combined.includes('underline') ||
    combined.includes('overline') ||
    combined.includes('line-through')
  );
}

test.describe('custom-text-decorations Target Grader', () => {
  test('Underlines, overlines, and strikethroughs are drawn with native text-decoration properties, not border-bottom, background gradient, or pseudo-element', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const hasNativeTextDecoration = styleRules.some((r) => hasTextDecorationLine(r));
    const hasFakeBorderBottomOnText = styleRules.some(
      (r) =>
        !r.selectorText.includes('::before') &&
        !r.selectorText.includes('::after') &&
        Boolean(r.style.getPropertyValue('border-bottom'))
    );

    expect(hasNativeTextDecoration && !hasFakeBorderBottomOnText).toBe(true);
  });

  test('Decoration style, color, thickness, and text-underline-offset use CSS custom properties or inheritable values', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const decoratedRules = styleRules.filter(
      (r) =>
        hasTextDecorationLine(r) ||
        Boolean(r.style.getPropertyValue('text-decoration-color')) ||
        Boolean(r.style.getPropertyValue('text-decoration-thickness')) ||
        Boolean(r.style.getPropertyValue('text-underline-offset'))
    );

    const usesCustomPropOrCurrentColor = decoratedRules.some((r) => {
      const propsText = getStylePropsText(r);
      return propsText.includes('var(--') || propsText.includes('currentColor');
    });

    const hasUnderlineOffset = decoratedRules.some((r) =>
      Boolean(r.style.getPropertyValue('text-underline-offset'))
    );

    expect(usesCustomPropOrCurrentColor && hasUnderlineOffset).toBe(true);
  });

  test('Decoration thickness and underline offset use relative units such as em so they scale with font size', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const thicknessUsesEm = styleRules.some((r) => {
      const td = r.style.getPropertyValue('text-decoration');
      const tdt = r.style.getPropertyValue('text-decoration-thickness');
      return `${td} ${tdt}`.includes('em');
    });

    const offsetUsesEm = styleRules.some((r) =>
      r.style.getPropertyValue('text-underline-offset').includes('em')
    );

    expect(thicknessUsesEm && offsetUsesEm).toBe(true);
  });

  test('A decorated link is a real <a> with an href destination, not a javascript: URL with a script handler', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const links = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('a')) as Array<{
        getAttribute(name: string): string | null;
      }>
    );

    const allLinksValid =
      links.length > 0 &&
      links.every((a) => {
        const href = (a.getAttribute('href') || '').trim();
        const onclick = a.getAttribute('onclick');
        return (
          href.length > 0 &&
          !href.toLowerCase().startsWith('javascript:') &&
          !onclick
        );
      });

    const hasLinkDecoration = styleRules.some(
      (r) =>
        r.selectorText.includes('a') &&
        (hasTextDecorationLine(r) ||
          Boolean(r.style.getPropertyValue('text-decoration-inset')))
    );

    expect(allLinksValid && hasLinkDecoration).toBe(true);
  });

  test('A link with a hover reveal underline trims its line with text-decoration-inset at rest, and returns the inset to 0 or full width on both :hover and :focus-visible', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const hasTrimmedAtRest = styleRules.some((r) => {
      const inset = r.style.getPropertyValue('text-decoration-inset');
      return (
        !r.selectorText.includes(':hover') &&
        !r.selectorText.includes(':focus-visible') &&
        inset.includes('100%')
      );
    });

    const hasHoverReveal = styleRules.some((r) => {
      const inset = r.style.getPropertyValue('text-decoration-inset').trim();
      return (
        r.selectorText.includes(':hover') &&
        inset.length > 0 &&
        !inset.includes('100%')
      );
    });

    const hasFocusVisibleReveal = styleRules.some((r) => {
      const inset = r.style.getPropertyValue('text-decoration-inset').trim();
      return (
        r.selectorText.includes(':focus-visible') &&
        inset.length > 0 &&
        !inset.includes('100%')
      );
    });

    expect(hasTrimmedAtRest && hasHoverReveal && hasFocusVisibleReveal).toBe(true);
  });

  test('The hover reveal declares its underline separately from text-decoration-inset so the underline is visible where text-decoration-inset is unsupported', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );

    const hasTopLevelUnderlineWithout100Inset = topLevelStyleRules.some((r) => {
      const inset = r.style.getPropertyValue('text-decoration-inset');
      return hasTextDecorationLine(r) && !inset.includes('100%');
    });

    expect(hasTopLevelUnderlineWithout100Inset).toBe(true);
  });

  test('text-decoration-skip-ink: auto and text-decoration-skip-spaces are not declared when they would only restate the default or have no effect', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const hasDecorations = styleRules.some((r) => hasTextDecorationLine(r));
    const hasRedundantSkipInkAuto = styleRules.some(
      (r) => r.style.getPropertyValue('text-decoration-skip-ink').trim() === 'auto'
    );
    const hasRedundantSkipSpacesDefault = styleRules.some((r) => {
      const val = r.style.getPropertyValue('text-decoration-skip-spaces').trim();
      return val === 'start end' || val === 'auto';
    });

    expect(
      hasDecorations && !hasRedundantSkipInkAuto && !hasRedundantSkipSpacesDefault
    ).toBe(true);
  });

  test('text-decoration-skip-spaces is declared only on text that preserves its spaces', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const hasDecorations = styleRules.some((r) => hasTextDecorationLine(r));
    const skipSpacesRules = styleRules.filter((r) =>
      Boolean(r.style.getPropertyValue('text-decoration-skip-spaces').trim())
    );

    const allPreserveSpaces = skipSpacesRules.every((r) => {
      const ws = r.style.getPropertyValue('white-space').trim();
      return ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces';
    });

    expect(hasDecorations && allPreserveSpaces).toBe(true);
  });

  test('A draw-on custom line uses a pseudo-element with border-shape or border-block-end and transitions clip-path on both :hover and :focus-visible, not an inline SVG', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const hasInlineSvgInLinks = docs.some((d) =>
      Boolean(d.document.querySelector('a svg'))
    );

    const pseudoRules = styleRules.filter(
      (r) =>
        r.selectorText.includes('::after') || r.selectorText.includes('::before')
    );

    let customLineValid = true;
    if (pseudoRules.length > 0) {
      const hasBorderShapeOrBlockEnd = pseudoRules.some(
        (r) =>
          Boolean(r.style.getPropertyValue('border-shape')) ||
          Boolean(r.style.getPropertyValue('border-block-end'))
      );
      const hasClipPathTransition = pseudoRules.some((r) =>
        r.style.getPropertyValue('transition').includes('clip-path')
      );
      const hasHoverAndFocusClipPath =
        pseudoRules.some(
          (r) =>
            r.selectorText.includes(':hover') &&
            Boolean(r.style.getPropertyValue('clip-path'))
        ) &&
        pseudoRules.some(
          (r) =>
            r.selectorText.includes(':focus-visible') &&
            Boolean(r.style.getPropertyValue('clip-path'))
        );

      customLineValid =
        hasBorderShapeOrBlockEnd &&
        hasClipPathTransition &&
        hasHoverAndFocusClipPath;
    }

    const hasAnyRevealOrDrawOn =
      pseudoRules.length > 0 ||
      styleRules.some((r) =>
        r.style.getPropertyValue('transition').includes('text-decoration-inset')
      );

    expect(!hasInlineSvgInLinks && customLineValid && hasAnyRevealOrDrawOn).toBe(
      true
    );
  });

  test('The draw-on line border-shape is applied inside @supports (border-shape: circle(50%)), and a straight line that still draws on is used outside it', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = getAllStyleRules(stylesheet.cssRules);
    const supportsRules = getAllSupportsRules(stylesheet.cssRules);
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );

    const pseudoBorderShapeRules = allStyleRules.filter(
      (r) =>
        (r.selectorText.includes('::after') ||
          r.selectorText.includes('::before')) &&
        Boolean(r.style.getPropertyValue('border-shape'))
    );

    let borderShapeProperlyGuarded = true;
    if (pseudoBorderShapeRules.length > 0) {
      const borderShapeSupports = supportsRules.filter(
        (s) =>
          s.conditionText.includes('border-shape') &&
          !s.conditionText.includes('not')
      );
      const inSupports = borderShapeSupports.some((s) =>
        getAllStyleRules(s.cssRules).some(
          (r) =>
            (r.selectorText.includes('::after') ||
              r.selectorText.includes('::before')) &&
            Boolean(r.style.getPropertyValue('border-shape'))
        )
      );
      const hasStraightFallbackOutside = topLevelStyleRules.some(
        (r) =>
          (r.selectorText.includes('::after') ||
            r.selectorText.includes('::before')) &&
          (Boolean(r.style.getPropertyValue('border-block-end')) ||
            Boolean(r.style.getPropertyValue('border-bottom')))
      );
      borderShapeProperlyGuarded = inSupports && hasStraightFallbackOutside;
    }

    const hasDecorations = allStyleRules.some((r) => hasTextDecorationLine(r));
    expect(hasDecorations && borderShapeProperlyGuarded).toBe(true);
  });

  test('When the same polygon shape is used for border-shape and its clip-path fallback, the shape is stored in a CSS custom property rather than repeated', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const borderShapePolygons = styleRules
      .map((r) => r.style.getPropertyValue('border-shape').trim())
      .filter((val) => val.startsWith('polygon('));

    const clipPathPolygons = styleRules
      .map((r) => r.style.getPropertyValue('clip-path').trim())
      .filter((val) => val.includes('polygon('));

    const hasRepeatedLiteralPolygon = borderShapePolygons.some((poly) => {
      const innerPoints = poly.slice('polygon('.length, -1).trim();
      return (
        !innerPoints.includes('var(--') &&
        clipPathPolygons.some((cp) => cp.includes(innerPoints))
      );
    });

    const hasDecorations = styleRules.some((r) => hasTextDecorationLine(r));
    expect(hasDecorations && !hasRepeatedLiteralPolygon).toBe(true);
  });

  test('Hover reveal and draw-on animations are gated behind prefers-reduced-motion: no-preference so lines stay fully visible when reduced motion matches', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const mediaRules = getAllMediaRules(stylesheet.cssRules);
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );

    const noPrefMediaRules = mediaRules.filter(
      (m) =>
        m.conditionText.includes('prefers-reduced-motion') &&
        m.conditionText.includes('no-preference')
    );

    const hasGuardedAnimation = noPrefMediaRules.some((m) =>
      getAllStyleRules(m.cssRules).some((r) => {
        const trans = r.style.getPropertyValue('transition');
        return (
          trans.includes('text-decoration-inset') || trans.includes('clip-path')
        );
      })
    );

    const hasUnguardedHiddenLine = topLevelStyleRules.some((r) => {
      const inset = r.style.getPropertyValue('text-decoration-inset');
      const clip = r.style.getPropertyValue('clip-path');
      return inset.includes('100%') || clip.includes('100%');
    });

    expect(hasGuardedAnimation && !hasUnguardedHiddenLine).toBe(true);
  });

  test('A gradient outline around text uses background-clip: border-area inside @supports (background-clip: border-area) with a gradient fallback outside it', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = getAllStyleRules(stylesheet.cssRules);
    const supportsRules = getAllSupportsRules(stylesheet.cssRules);

    const borderAreaRules = allStyleRules.filter(
      (r) =>
        r.style.getPropertyValue('background-clip').trim() === 'border-area'
    );

    let borderAreaValid = true;
    if (borderAreaRules.length > 0) {
      const inSupports = supportsRules
        .filter(
          (s) =>
            s.conditionText.includes('background-clip') &&
            s.conditionText.includes('border-area') &&
            !s.conditionText.includes('not')
        )
        .some((s) =>
          getAllStyleRules(s.cssRules).some(
            (r) =>
              r.style.getPropertyValue('background-clip').trim() ===
              'border-area'
          )
        );
      borderAreaValid = inSupports;
    }

    const hasDecorations = allStyleRules.some((r) => hasTextDecorationLine(r));
    expect(hasDecorations && borderAreaValid).toBe(true);
  });

  test('A text outline shaped by border-shape applies border-shape inside @supports (border-shape: circle(50%))', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = getAllStyleRules(stylesheet.cssRules);
    const supportsRules = getAllSupportsRules(stylesheet.cssRules);

    const borderShapeRules = allStyleRules.filter((r) =>
      Boolean(r.style.getPropertyValue('border-shape'))
    );

    const topLevelBorderShape = Array.from(stylesheet.cssRules).some(
      (r) =>
        r instanceof CSSStyleRule &&
        Boolean(r.style.getPropertyValue('border-shape'))
    );

    let allBorderShapeInSupports = !topLevelBorderShape;
    if (borderShapeRules.length > 0) {
      const inSupports = supportsRules
        .filter(
          (s) =>
            s.conditionText.includes('border-shape') &&
            !s.conditionText.includes('not')
        )
        .some((s) =>
          getAllStyleRules(s.cssRules).some((r) =>
            Boolean(r.style.getPropertyValue('border-shape'))
          )
        );
      allBorderShapeInSupports = !topLevelBorderShape && inSupports;
    }

    const hasDecorations = allStyleRules.some((r) => hasTextDecorationLine(r));
    expect(hasDecorations && allBorderShapeInSupports).toBe(true);
  });
});
