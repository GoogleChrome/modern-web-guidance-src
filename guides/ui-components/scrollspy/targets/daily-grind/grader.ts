import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import {
  CSSStyleRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore - package.json omits "type": "module", causing tsc nodenext to infer CJS
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

test.describe('scrollspy Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('Navigation links use fragment identifiers that match the unique IDs of their target content sections', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    let hasMatchingNavLinks = false;
    for (const { document } of docs) {
      const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"]')).filter(
        (a: any) => (a.getAttribute('href') || '').length > 1
      );
      if (navLinks.length >= 4) {
        const ids = navLinks.map((a: any) => a.getAttribute('href')!.slice(1));
        const uniqueIds = new Set(ids);
        const allTargetSectionsExist =
          uniqueIds.size === ids.length &&
          ids.every((id) => Boolean(document.getElementById(id)));
        if (allTargetSectionsExist) {
          hasMatchingNavLinks = true;
          break;
        }
      }
    }

    expect(hasMatchingNavLinks).toBe(true);
  });

  test('The navigation container has scroll-target-group: auto applied to enable native browser tracking', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    expect(styleRules.length).toBeGreaterThan(0);

    const hasScrollTargetGroupRule = styleRules.some(
      (rule) => rule.style.getPropertyValue('scroll-target-group').trim() === 'auto'
    );
    const hasInlineScrollTargetGroup = docs.some(({ document }) =>
      Array.from(document.querySelectorAll('nav, nav *')).some((el: any) =>
        (el.getAttribute('style') || '').includes('scroll-target-group')
      )
    );

    expect(hasScrollTargetGroupRule || hasInlineScrollTargetGroup).toBe(true);
  });

  test('Navigation links use the :target-current pseudo-class combined with the fallback selector inside :is()', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    expect(styleRules.length).toBeGreaterThan(0);

    const hasCombinedIsRule = styleRules.some((rule) => {
      const sel = rule.selectorText;
      return (
        sel.includes(':is(') &&
        sel.includes(':target-current') &&
        /\.[a-zA-Z0-9_-]+/.test(sel)
      );
    });

    expect(hasCombinedIsRule).toBe(true);
  });

  test('The aria-current state is synchronized with the visible section when scrolling stops using a scrollend event listener', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasScrollSync =
      callExpressions.some((call) => {
        const expr = call.getExpression();
        if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
        if (expr.getName() !== 'addEventListener') return false;
        const firstArg = call.getArguments()[0];
        return Boolean(
          firstArg &&
            firstArg.isKind(SyntaxKind.StringLiteral) &&
            /^(?:scrollend|scroll)$/.test(firstArg.getLiteralValue())
        );
      }) ||
      sourceFiles.some(
        (sf) =>
          sf
            .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
            .some((p) => p.getName() === 'onscrollend') ||
          sf
            .getDescendantsOfKind(SyntaxKind.NewExpression)
            .some((n) => n.getExpression().getText() === 'IntersectionObserver')
      );

    const stringLiterals = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    );
    const hasAriaCurrent =
      stringLiterals.some((lit) => lit.getLiteralValue() === 'aria-current') ||
      sourceFiles.some((sf) =>
        sf
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((p) => p.getName() === 'ariaCurrent')
      );

    expect(hasScrollSync && hasAriaCurrent).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test('The link corresponding to the section currently in view is visually highlighted with a color change and contrast or a non-color indicator', async ({
      page,
      TARGET_URL,
    }) => {
      await page.goto(TARGET_URL);

      const navLinks = page.locator('nav a[href^="#"]');
      const count = await navLinks.count();
      expect(count).toBeGreaterThanOrEqual(4);

      const secondHref = await navLinks.nth(1).getAttribute('href');
      expect(secondHref).toBeTruthy();

      await page.evaluate(async (id) => {
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'instant' });
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        document.dispatchEvent(new Event('scrollend'));
        window.dispatchEvent(new Event('scrollend'));
      }, secondHref!.slice(1));

      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const links = Array.from(
              document.querySelectorAll<HTMLAnchorElement>('nav a[href^="#"]')
            );
            const active = links.find(
              (l) =>
                l.matches(':target-current') ||
                l.getAttribute('aria-current') === 'true' ||
                l.classList.contains('target-current')
            );
            const inactive = links.find((l) => l !== active) || links[0];
            if (!active || !inactive) return false;

            const activeStyle = window.getComputedStyle(active);
            const inactiveStyle = window.getComputedStyle(inactive);
            const activeBefore = window.getComputedStyle(active, '::before');
            const inactiveBefore = window.getComputedStyle(inactive, '::before');
            const activeAfter = window.getComputedStyle(active, '::after');
            const inactiveAfter = window.getComputedStyle(inactive, '::after');

            const parseRgb = (c: string) => {
              const m = c.match(/\d+(\.\d+)?/g);
              return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : null;
            };
            const relLuminance = ([r, g, b]: number[]) => {
              const chan = (v: number) => {
                const s = v / 255;
                return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
              };
              return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
            };
            const c1 = parseRgb(activeStyle.color);
            const c2 = parseRgb(inactiveStyle.color);
            let contrastRatio = 1;
            if (c1 && c2) {
              const l1 = relLuminance(c1);
              const l2 = relLuminance(c2);
              contrastRatio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            }

            const colorChanged = activeStyle.color !== inactiveStyle.color;
            const hasSufficientContrast = contrastRatio >= 3;
            const hasPseudoCue =
              activeBefore.content !== inactiveBefore.content ||
              activeAfter.content !== inactiveAfter.content ||
              (activeBefore.content !== 'none' &&
                (activeBefore.opacity !== inactiveBefore.opacity ||
                  activeBefore.transform !== inactiveBefore.transform ||
                  activeBefore.backgroundColor !== inactiveBefore.backgroundColor)) ||
              (activeAfter.content !== 'none' &&
                (activeAfter.opacity !== inactiveAfter.opacity ||
                  activeAfter.transform !== inactiveAfter.transform ||
                  activeAfter.backgroundColor !== inactiveAfter.backgroundColor));
            const hasNonColorCue =
              activeStyle.fontWeight !== inactiveStyle.fontWeight ||
              activeStyle.borderBottomColor !== inactiveStyle.borderBottomColor ||
              activeStyle.borderBottomWidth !== inactiveStyle.borderBottomWidth ||
              activeStyle.textDecorationLine !== inactiveStyle.textDecorationLine ||
              activeStyle.backgroundColor !== inactiveStyle.backgroundColor ||
              hasPseudoCue;

            return colorChanged && (hasSufficientContrast || hasNonColorCue);
          });
        })
        .toBe(true);
    });

    test('The aria-current attribute is set to "true" on the navigation link corresponding to the visible section and "false" on all other links', async ({
      page,
      TARGET_URL,
    }) => {
      await page.goto(TARGET_URL);

      const navLinks = page.locator('nav a[href^="#"]');
      const count = await navLinks.count();
      expect(count).toBeGreaterThanOrEqual(4);

      const targetIndex = 2;
      const targetHref = await navLinks.nth(targetIndex).getAttribute('href');
      expect(targetHref).toBeTruthy();

      await page.evaluate(async (id) => {
        const section = document.getElementById(id);
        if (section) {
          const rect = section.getBoundingClientRect();
          const targetTop = window.scrollY + rect.top + 10;
          window.scrollTo({ top: Math.max(0, targetTop), behavior: 'instant' });
        }
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        document.dispatchEvent(new Event('scrollend'));
        window.dispatchEvent(new Event('scrollend'));
      }, targetHref!.slice(1));

      await expect
        .poll(async () => {
          return await page.evaluate((expectedHref) => {
            const links = Array.from(
              document.querySelectorAll<HTMLAnchorElement>('nav a[href^="#"]')
            );
            if (links.length < 4) return false;
            const validActiveTokens = new Set(['true', 'location', 'page', 'step']);
            const activeLinks = links.filter((l) =>
              validActiveTokens.has((l.getAttribute('aria-current') || '').trim().toLowerCase())
            );
            const inactiveValid = links
              .filter((l) => !activeLinks.includes(l))
              .every((l) => {
                const val = l.getAttribute('aria-current');
                return val === null || val.trim().toLowerCase() === 'false';
              });
            return (
              activeLinks.length === 1 &&
              activeLinks[0].getAttribute('href') === expectedHref &&
              inactiveValid
            );
          }, targetHref);
        })
        .toBe(true);
    });

    test('When scroll-target-group: auto is not supported, an IntersectionObserver fallback toggles a fallback active class on the active navigation link', async ({
      page,
      TARGET_URL,
    }) => {
      await page.addInitScript(() => {
        const origSupports = CSS.supports.bind(CSS);
        CSS.supports = ((...args: any[]) => {
          const query = args.join(' ').toLowerCase();
          if (query.includes('scroll-target-group') || query.includes('target-current')) {
            return false;
          }
          return (origSupports as any)(...args);
        }) as typeof CSS.supports;
      });

      await page.goto(TARGET_URL);

      const navLinks = page.locator('nav a[href^="#"]');
      const count = await navLinks.count();
      expect(count).toBeGreaterThanOrEqual(4);

      const targetIndex = 1;
      const targetHref = await navLinks.nth(targetIndex).getAttribute('href');
      expect(targetHref).toBeTruthy();

      await page.evaluate((id) => {
        const section = document.getElementById(id);
        if (section) {
          const rect = section.getBoundingClientRect();
          const targetTop = window.scrollY + rect.top - 80;
          window.scrollTo({ top: Math.max(0, targetTop), behavior: 'instant' });
        }
        window.dispatchEvent(new Event('scroll'));
        document.dispatchEvent(new Event('scroll'));
        document.dispatchEvent(new Event('scrollend'));
      }, targetHref!.slice(1));

      await expect
        .poll(async () => {
          return await page.evaluate((expectedHref) => {
            const links = Array.from(
              document.querySelectorAll<HTMLAnchorElement>('nav a[href^="#"]')
            );
            if (links.length < 4) return false;
            const targetLink = links.find((l) => l.getAttribute('href') === expectedHref);
            if (!targetLink) return false;
            const otherLinks = links.filter((l) => l !== targetLink);
            const hasFallbackClass =
              targetLink.classList.contains('target-current') ||
              Array.from(targetLink.classList).some(
                (cls) => !otherLinks.some((other) => other.classList.contains(cls))
              );
            const hasAriaCurrent = targetLink.getAttribute('aria-current') === 'true';
            return hasFallbackClass && hasAriaCurrent;
          }, targetHref);
        })
        .toBe(true);
    });
  });
});
