import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSGroupingRule,
  CSSMediaRule,
  CSSViewTransitionRule,
  getCascadedStyle,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import { SyntaxKind, type Project } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectViewTransitionRules(
  rules: Iterable<CSSRule>,
  parentMediaConditions: string[] = [],
): Array<{ rule: CSSViewTransitionRule; mediaConditions: string[] }> {
  const result: Array<{ rule: CSSViewTransitionRule; mediaConditions: string[] }> = [];
  for (const rule of rules) {
    if (rule instanceof CSSViewTransitionRule) {
      result.push({ rule, mediaConditions: parentMediaConditions });
    } else if (rule instanceof CSSMediaRule) {
      const cond = (rule.conditionText || rule.media?.mediaText || '').toLowerCase();
      result.push(
        ...collectViewTransitionRules(rule.cssRules, [...parentMediaConditions, cond]),
      );
    } else if (rule instanceof CSSGroupingRule) {
      result.push(
        ...collectViewTransitionRules(rule.cssRules, parentMediaConditions),
      );
    }
  }
  return result;
}

function hasViewTransitionAuto(sheet: CSSStyleSheet): boolean {
  const vtRules = collectViewTransitionRules(sheet.cssRules);
  return vtRules.some(
    ({ rule, mediaConditions }) =>
      rule.navigation.trim() === 'auto' &&
      !mediaConditions.some(
        (cond) =>
          cond.includes('prefers-reduced-motion') &&
          /\breduce\b/.test(cond) &&
          !/\bnot\b/.test(cond),
      ),
  );
}

function hasReducedMotionDisabling(sheet: CSSStyleSheet): boolean {
  const vtRules = collectViewTransitionRules(sheet.cssRules);
  const autoRules = vtRules.filter(({ rule }) => rule.navigation.trim() === 'auto');
  if (autoRules.length === 0) return false;

  const hasExplicitReduceNone = vtRules.some(
    ({ rule, mediaConditions }) =>
      rule.navigation.trim() === 'none' &&
      mediaConditions.some(
        (cond) =>
          cond.includes('prefers-reduced-motion') &&
          /\breduce\b/.test(cond) &&
          !/\bnot\b/.test(cond),
      ),
  );

  const allAutoGatedByNoPreference = autoRules.every(({ mediaConditions }) =>
    mediaConditions.some(
      (cond) =>
        cond.includes('prefers-reduced-motion') &&
        (/\bno-preference\b/.test(cond) || (/\bnot\b/.test(cond) && /\breduce\b/.test(cond))),
    ),
  );

  return hasExplicitReduceNone || allAutoGatedByNoPreference;
}

test.describe('consistent-cross-document-transitions Target Grader', () => {
  test('Both the source and destination pages include the @view-transition { navigation: auto; } CSS at-rule', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThanOrEqual(2);

    const globalSheet = getCssStyleSheet(targetFiles);
    expect(hasViewTransitionAuto(globalSheet)).toBe(true);

    const cssFiles = targetFiles.filter((f) => /\.css$/i.test(f));
    const sharedCssHasAuto =
      cssFiles.length > 0 && hasViewTransitionAuto(getCssStyleSheet(cssFiles));

    for (const { file, document } of docs) {
      const pageInlineHasAuto = hasViewTransitionAuto(getCssStyleSheet([file]));
      const linksSharedStylesheet =
        Boolean(document.querySelector('head link[rel="stylesheet"][href]')) &&
        sharedCssHasAuto;
      expect(pageInlineHasAuto || linksSharedStylesheet).toBe(true);
    }
  });

  test('<link rel="expect" href="#element-id" blocking="render"> is used in the <head> to block rendering until above-the-fold DOM elements have been parsed', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThanOrEqual(2);

    for (const { document } of docs) {
      const expectLinks = Array.from(
        document.querySelectorAll('head link[rel="expect"]'),
      ) as any[];
      expect(expectLinks.length).toBeGreaterThan(0);

      for (const link of expectLinks) {
        const blocking = link.getAttribute('blocking') ?? '';
        expect(/\brender\b/.test(blocking)).toBe(true);

        const href = (link.getAttribute('href') ?? '').trim();
        expect(/^#[A-Za-z0-9_-]+$/.test(href)).toBe(true);

        const targetId = href.slice(1);
        const targetEl = document.getElementById(targetId);
        expect(targetEl).not.toBeNull();
        expect(document.body?.contains(targetEl)).toBe(true);
      }
    }
  });

  test('Critical stylesheets are placed in the <head>, and any pre-transition scripts or expect links in the <head> are marked with blocking="render" while third-party scripts are not render-blocked', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThanOrEqual(2);

    const scriptCheckProject: Project = getJsProject([]);

    for (const { document } of docs) {
      const hasHeadStylesheet = Boolean(
        document.querySelector('head style, head link[rel="stylesheet"]'),
      );
      expect(hasHeadStylesheet).toBe(true);

      const renderBlockingElements = Array.from(
        document.querySelectorAll('head [blocking="render"]'),
      ) as any[];
      expect(renderBlockingElements.length).toBeGreaterThan(0);

      const headScripts = Array.from(
        document.querySelectorAll('head script'),
      ) as any[];
      for (const script of headScripts) {
        const src = script.getAttribute('src') ?? '';
        const isThirdParty = /analytics|gtag|googletagmanager|ads|ad-client/i.test(src);
        const blocking = script.getAttribute('blocking') ?? '';
        if (isThirdParty) {
          expect(/\brender\b/.test(blocking)).toBe(false);
        }
      }

      const allScripts = Array.from(document.querySelectorAll('script')) as any[];
      allScripts.forEach((script: any, index: number) => {
        const src = script.getAttribute('src') ?? '';
        const isThirdParty = /analytics|gtag|googletagmanager|ads|ad-client/i.test(src);
        const blocking = script.getAttribute('blocking') ?? '';
        if (isThirdParty) {
          expect(/\brender\b/.test(blocking)).toBe(false);
          return;
        }

        const code = script.textContent?.trim() ?? '';
        let isPreTransitionScript = /transition|theme|layout/i.test(src);
        if (code) {
          const sf = scriptCheckProject.createSourceFile(`inline_${index}.ts`, code, {
            overwrite: true,
          });
          const identifiers = sf
            .getDescendantsOfKind(SyntaxKind.Identifier)
            .map((id) => id.getText());
          const stringLiterals = sf
            .getDescendantsOfKind(SyntaxKind.StringLiteral)
            .map((lit) => lit.getLiteralValue());
          if (
            identifiers.includes('viewTransition') ||
            identifiers.includes('viewTransitionName') ||
            identifiers.includes('theme') ||
            identifiers.includes('layout') ||
            stringLiterals.includes('pagereveal') ||
            stringLiterals.includes('theme') ||
            stringLiterals.includes('layout')
          ) {
            isPreTransitionScript = true;
          }
        }

        if (isPreTransitionScript) {
          expect(script.closest('head')).not.toBeNull();
          expect(/\brender\b/.test(blocking)).toBe(true);
        }
      });
    }
  });

  test('Render blocking is limited to resources and elements visible in the initial viewport and Non-critical or below-the-fold content is NOT render-blocked', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThanOrEqual(2);

    for (const { document } of docs) {
      const expectLinks = Array.from(
        document.querySelectorAll('head link[rel="expect"]'),
      ) as any[];
      expect(expectLinks.length).toBeGreaterThan(0);

      const footer = document.querySelector('footer');
      expect(footer).not.toBeNull();
      expect(footer.hasAttribute('blocking')).toBe(false);

      const blockedElements: any[] = [];
      for (const link of expectLinks) {
        const href = (link.getAttribute('href') ?? '').trim();
        const targetId = href.startsWith('#') ? href.slice(1) : '';
        const targetEl = targetId ? document.getElementById(targetId) : null;
        expect(targetEl).not.toBeNull();

        // Target element must not be the footer, inside the footer, or an ancestor wrapping the footer
        expect(footer.contains(targetEl)).toBe(false);
        expect(targetEl.contains(footer)).toBe(false);
        expect(
          targetEl.matches('header, main, section, .hero, header *, main *'),
        ).toBe(true);
        blockedElements.push(targetEl);
      }

      // Above-the-fold initial content (and therefore any preceding header) is covered by render blocking
      const headerEl = document.querySelector('header');
      const mainEl = document.querySelector('main');
      const mainSectionEl = document.querySelector('main section') ?? mainEl;
      expect(headerEl).not.toBeNull();
      expect(mainEl).not.toBeNull();

      const mainContentBlocked = blockedElements.some(
        (el) =>
          el === mainEl ||
          el === mainSectionEl ||
          el.contains(mainSectionEl) ||
          mainEl.contains(el),
      );
      expect(mainContentBlocked).toBe(true);

      // All blocking="render" attributes must only appear in <head> and not on third-party analytics/ad scripts
      const allBlocking = Array.from(
        document.querySelectorAll('[blocking]'),
      ) as any[];
      expect(allBlocking.length).toBeGreaterThan(0);
      for (const el of allBlocking) {
        expect(el.closest('head')).not.toBeNull();
        const src = el.getAttribute('src') ?? '';
        expect(/analytics|gtag|googletagmanager|ads/i.test(src)).toBe(false);
      }
    }
  });

  test('No two elements on the same page share the same view-transition-name value', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThanOrEqual(2);

    const globalSheet = getCssStyleSheet(targetFiles);
    expect(hasViewTransitionAuto(globalSheet)).toBe(true);

    const cssFiles = targetFiles.filter((f) => /\.css$/i.test(f));

    for (const { file, document } of docs) {
      const pageSheet = getCssStyleSheet([...cssFiles, file]);
      const pageRules = Array.from(pageSheet.cssRules);
      const allElements = Array.from(document.querySelectorAll('*')) as any[];
      expect(allElements.length).toBeGreaterThan(0);

      const assignedNames: string[] = [];
      for (const el of allElements) {
        const cascaded = getCascadedStyle(el, pageRules);
        const vtName = cascaded.getPropertyValue('view-transition-name').trim();
        if (
          vtName &&
          vtName !== 'none' &&
          vtName !== 'initial' &&
          vtName !== 'inherit' &&
          vtName !== 'unset'
        ) {
          assignedNames.push(vtName);
        }
      }

      expect(new Set(assignedNames).size).toBe(assignedNames.length);
    }
  });

  test('Cross-document view transitions are disabled when prefers-reduced-motion: reduce is active', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThanOrEqual(2);

    const globalSheet = getCssStyleSheet(targetFiles);
    expect(hasReducedMotionDisabling(globalSheet)).toBe(true);

    const cssFiles = targetFiles.filter((f) => /\.css$/i.test(f));
    const sharedCssDisablesReducedMotion =
      cssFiles.length > 0 &&
      hasReducedMotionDisabling(getCssStyleSheet(cssFiles));

    for (const { file, document } of docs) {
      const pageInlineDisables = hasReducedMotionDisabling(
        getCssStyleSheet([file]),
      );
      const linksSharedStylesheet =
        Boolean(document.querySelector('head link[rel="stylesheet"][href]')) &&
        sharedCssDisablesReducedMotion;
      expect(pageInlineDisables || linksSharedStylesheet).toBe(true);
    }
  });
});
