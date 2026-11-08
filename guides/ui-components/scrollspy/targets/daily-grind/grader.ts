import {
  test,
  expect,
  skipUnless,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import { CSSRule, CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectStyleRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

function getStringLiteralsText(project: Project): string[] {
  return project.getSourceFiles().flatMap((sf) => [
    ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map((lit) => lit.getLiteralValue()),
    ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((lit) => lit.getLiteralValue()),
  ]);
}

test.describe('scrollspy Target Grader', () => {
  test('Navigation links use fragment identifiers that match unique IDs of target content sections', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasValidFragmentNav = docs.some(({ document }) => {
      const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"]:not([href="#"])'));
      if (navLinks.length < 2) return false;

      const fragmentIds = navLinks
        .map((link) => (link.getAttribute('href') || '').slice(1).trim())
        .filter((id) => id.length > 0);

      if (fragmentIds.length !== navLinks.length) return false;

      const uniqueFragmentIds = new Set(fragmentIds);
      if (uniqueFragmentIds.size !== fragmentIds.length) return false;

      return fragmentIds.every((id) => {
        const matchingTargets = document.querySelectorAll(`[id="${id}"]`);
        return matchingTargets.length === 1;
      });
    });

    expect(hasValidFragmentNav).toBe(true);
  });

  test('Navigation container has scroll-target-group: auto applied to enable native browser tracking', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasScrollTargetGroup = styleRules.some((rule) => {
      const value = rule.style.getPropertyValue('scroll-target-group').trim();
      if (value !== 'auto') return false;

      if (/\b(nav|ul|menu)\b/i.test(rule.selectorText) || rule.selectorText === '[style]') {
        return true;
      }

      return docs.some(({ document }) => {
        const matched = Array.from(document.querySelectorAll(rule.selectorText));
        return matched.some((el) => Boolean(el.querySelector('a[href^="#"]')) || Boolean(el.closest('nav')));
      });
    });

    expect(hasScrollTargetGroup).toBe(true);
  });

  test('Navigation links use the :target-current pseudo-class for active state styling', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasTargetCurrentRule = styleRules.some(
      (rule) => /(?<!\\):target-current\b/.test(rule.selectorText) && rule.style.length > 0
    );

    expect(hasTargetCurrentRule).toBe(true);
  });

  test('Active navigation link is visually highlighted with a color change and a non-color indicator or sufficient contrast', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const activeSelectorRegex = /(?:target-current\b|\[aria-current|\.active\b|\.current\b)/i;
    const activeRules = styleRules.filter((rule) => activeSelectorRegex.test(rule.selectorText));

    const hasColorChange = activeRules.some((rule) => {
      const color = rule.style.getPropertyValue('color').trim().toLowerCase();
      const bgColor = rule.style.getPropertyValue('background-color').trim().toLowerCase();
      const bg = rule.style.getPropertyValue('background').trim().toLowerCase();
      const hasDistinctTextColor =
        color.length > 0 && !['white', '#fff', '#ffffff', 'rgb(255, 255, 255)', 'inherit', 'initial'].includes(color);
      const hasDistinctBg =
        (bgColor.length > 0 && !['transparent', 'none', 'initial', 'inherit'].includes(bgColor)) ||
        (bg.length > 0 && !['transparent', 'none', 'initial', 'inherit'].includes(bg));
      return hasDistinctTextColor || hasDistinctBg;
    });

    // Calculate actual WCAG contrast ratio if color values are provided
    function hexToRgb(hex: string): [number, number, number] | null {
      const clean = hex.replace('#', '').trim();
      if (clean.length === 3) {
        return [parseInt(clean[0] + clean[0], 16), parseInt(clean[1] + clean[1], 16), parseInt(clean[2] + clean[2], 16)];
      }
      if (clean.length === 6) {
        return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
      }
      return null;
    }

    function lum([r, g, b]: [number, number, number]): number {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function contrast(c1: [number, number, number], c2: [number, number, number]): number {
      const l1 = lum(c1);
      const l2 = lum(c2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    const hasSufficientContrast = activeRules.some((rule) => {
      const color = rule.style.getPropertyValue('color').trim().toLowerCase();
      const bgColor =
        rule.style.getPropertyValue('background-color').trim().toLowerCase() ||
        rule.style.getPropertyValue('background').trim().toLowerCase();
      const rgbText = hexToRgb(color);
      const rgbBg = hexToRgb(bgColor);
      if (rgbText && rgbBg) {
        return contrast(rgbText, rgbBg) >= 4.5;
      }
      return false;
    });

    const nonColorProps = [
      'font-weight',
      'text-decoration',
      'text-decoration-line',
      'border-bottom',
      'border-bottom-color',
      'border-bottom-width',
      'border',
      'border-color',
      'border-top',
      'border-left',
      'border-right',
      'outline',
      'box-shadow',
      'transform',
      'scale',
      'content',
    ];

    const hasNonColorIndicator = activeRules.some((rule) =>
      nonColorProps.some((prop) => {
        const val = rule.style.getPropertyValue(prop).trim().toLowerCase();
        return val.length > 0 && !['none', 'normal', 'transparent', '0', '0px', 'initial', 'inherit'].includes(val);
      })
    );

    expect(hasColorChange && (hasNonColorIndicator || hasSufficientContrast)).toBe(true);
  });

  test('The aria-current attribute is set to "true" on the active navigation link and "false" on all other links', async ({
    page,
    TARGET_URL,
  }) => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    // 1. Static check: Detect if JavaScript sets aria-current
    const hasSetAttributeAriaCurrent = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression();
        if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
        const methodName = expr.getName();
        if (methodName !== 'setAttribute' && methodName !== 'toggleAttribute') return false;
        const args = call.getArguments();
        if (args.length < 1) return false;
        const firstArg = args[0];
        return (
          (firstArg.isKind(SyntaxKind.StringLiteral) || firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) &&
          firstArg.getLiteralValue() === 'aria-current'
        );
      })
    );

    const hasAriaCurrentProp = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
        if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) return false;
        const left = bin.getLeft();
        if (left.isKind(SyntaxKind.PropertyAccessExpression)) {
          return left.getName() === 'ariaCurrent';
        }
        if (left.isKind(SyntaxKind.ElementAccessExpression)) {
          const arg = left.getArgumentExpression();
          if (arg && (arg.isKind(SyntaxKind.StringLiteral) || arg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral))) {
            return arg.getLiteralValue() === 'aria-current' || arg.getLiteralValue() === 'ariaCurrent';
          }
        }
        return false;
      })
    );

    // 2. Playwright runtime check: Load page, scroll between sections, and verify that the active nav link has a valid aria-current token ('true', 'location', 'page') and all other nav links have no aria-current or 'false'
    let runtimeAriaCurrentValid = false;
    try {
      await page.goto(TARGET_URL);
      runtimeAriaCurrentValid = await page.evaluate(async () => {
        const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('nav a[href^="#"]:not([href="#"])'));
        if (navLinks.length < 2) return false;

        const validActiveTokens = ['true', 'location', 'page', 'step', 'date', 'time'];

        const isValidState = () => {
          let activeCount = 0;
          let invalidInactive = 0;
          for (const link of navLinks) {
            const val = link.getAttribute('aria-current');
            if (val && validActiveTokens.includes(val.trim().toLowerCase())) {
              activeCount++;
            } else if (val && val.trim().toLowerCase() !== 'false') {
              invalidInactive++;
            }
          }
          return activeCount >= 1 && invalidInactive === 0;
        };

        if (isValidState()) return true;

        for (const link of navLinks.slice(1)) {
          const targetId = link.getAttribute('href');
          if (targetId) {
            const targetEl = document.querySelector(targetId);
            if (targetEl) {
              targetEl.scrollIntoView();
              await new Promise((resolve) => setTimeout(resolve, 150));
              if (isValidState()) return true;
            }
          }
        }

        return false;
      });
    } catch {}

    expect(runtimeAriaCurrentValid || hasSetAttributeAriaCurrent || hasAriaCurrentProp).toBe(true);
  });

  test('The aria-current state is synchronized with the visible section when scrolling stops', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const stringLiterals = getStringLiteralsText(project);

    const hasScrollStopListener = sourceFiles.some((sf) => {
      const hasScrollEndEvent = sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression();
        const isAddEventListener =
          (expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'addEventListener') ||
          (expr.isKind(SyntaxKind.Identifier) && expr.getText() === 'addEventListener');
        if (!isAddEventListener) return false;
        const firstArg = call.getArguments()[0];
        return (
          Boolean(firstArg) &&
          (firstArg.isKind(SyntaxKind.StringLiteral) ||
            firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) &&
          firstArg.getLiteralValue() === 'scrollend'
        );
      });

      const hasOnScrollEndProp = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((prop) => prop.getName() === 'onscrollend');

      return hasScrollEndEvent || hasOnScrollEndProp;
    });

    const queriesTargetCurrent = stringLiterals.some((str) => /(?<!\\):target-current\b/.test(str));

    expect(hasScrollStopListener && queriesTargetCurrent).toBe(true);
  });

  test('An IntersectionObserver fallback applies the target-current class in browsers without native CSS scrollspy support', () => {
    skipUnless({ unsupported: 'scroll-target-group' });

    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const stringLiterals = getStringLiteralsText(project);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasFeatureDetection = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression();
        return (
          expr.isKind(SyntaxKind.PropertyAccessExpression) &&
          expr.getName() === 'supports' &&
          call.getArguments().length > 0
        );
      })
    );

    const hasIntersectionObserver = sourceFiles.some((sf) => {
      const createsObserver = sf.getDescendantsOfKind(SyntaxKind.NewExpression).some((newExpr) =>
        /\bIntersectionObserver\b/.test(newExpr.getExpression().getText())
      );
      const callsObserve = sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression();
        return expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'observe';
      });
      return createsObserver && callsObserve;
    });

    const appliesTargetCurrentClass = stringLiterals.some(
      (str) => /^\\?:?target-current$/.test(str)
    );

    const hasFallbackSelectorInCss = styleRules.some((rule) =>
      /\.(?:\\:)?target-current\b/.test(rule.selectorText)
    );

    expect(
      hasFeatureDetection &&
        hasIntersectionObserver &&
        appliesTargetCurrentClass &&
        hasFallbackSelectorInCss
    ).toBe(true);
  });
});
