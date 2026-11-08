import fs from 'fs';
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
  CSSStyleDeclaration,
  CSSStyleRule,
  CSSViewTransitionRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';
import { SyntaxKind, type Project } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectViewTransitionRules(
  rules: CSSRule[],
  parentMediaCondition: string | null = null,
): Array<{ rule: CSSViewTransitionRule; mediaCondition: string | null }> {
  const results: Array<{ rule: CSSViewTransitionRule; mediaCondition: string | null }> = [];
  for (const rule of rules) {
    if (rule instanceof CSSViewTransitionRule) {
      results.push({ rule, mediaCondition: parentMediaCondition });
    } else if (rule instanceof CSSMediaRule) {
      results.push(
        ...collectViewTransitionRules(Array.from(rule.cssRules), rule.conditionText),
      );
    } else if (rule instanceof CSSGroupingRule) {
      results.push(
        ...collectViewTransitionRules(Array.from(rule.cssRules), parentMediaCondition),
      );
    }
  }
  return results;
}

function hasRenderBlockingToken(el: any): boolean {
  const attr = el.getAttribute?.('blocking') || '';
  return attr
    .trim()
    .split(/\s+/)
    .includes('render');
}

function isThirdPartyOrAnalyticsScript(scriptEl: any): boolean {
  const src = (scriptEl.getAttribute?.('src') || '').toLowerCase();
  return (
    src.includes('analytics') ||
    src.includes('ad-client') ||
    src.includes('gtag') ||
    src.includes('googletagmanager')
  );
}

function resolveExpectTargetIds(
  link: any,
  docs: Array<{ file: string; document: Document }>,
): { targetIds: string[]; isUnboundOptionalTemplate: boolean } {
  const rawHref = (link.getAttribute?.('href') || '').trim();
  if (rawHref.startsWith('#') && rawHref.length > 1 && !rawHref.includes('{')) {
    return { targetIds: [rawHref.slice(1)], isUnboundOptionalTemplate: false };
  }

  const targetIds = new Set<string>();
  const propNames = new Set<string>(
    Array.from(rawHref.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g), (m: RegExpMatchArray) => m[0]),
  );

  for (const { file } of docs) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(
      /<link\b[^>]*\brel\s*=\s*["']expect["'][^>]*\bhref\s*=\s*\{([^}]+)\}/gi,
    )) {
      for (const idMatch of match[1].matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
        propNames.add(idMatch[0]);
      }
      for (const hashMatch of match[1].matchAll(/["'`]#([A-Za-z0-9_-]+)["'`]/g)) {
        targetIds.add(hashMatch[1]);
      }
    }
  }

  for (const prop of propNames) {
    if (prop === 'id' || prop === 'map') continue;
    const escapedProp = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const assignRegex = new RegExp(
      `\\b${escapedProp}\\s*=\\s*(?:\\{\\s*)?["'\`]#?([A-Za-z0-9_-]+)["'\`]`,
      'g',
    );
    for (const { file, document } of docs) {
      for (const el of Array.from(document.querySelectorAll('*')) as any[]) {
        const attrVal = (
          el.getAttribute?.(prop) ||
          el.getAttribute?.(prop.toLowerCase()) ||
          ''
        ).trim();
        const cleaned = attrVal.startsWith('#') ? attrVal.slice(1) : attrVal;
        if (/^[A-Za-z0-9_-]+$/.test(cleaned)) {
          targetIds.add(cleaned);
        }
      }
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(assignRegex)) {
        targetIds.add(match[1]);
      }
    }
  }

  const isUnboundOptionalTemplate =
    targetIds.size === 0 && /^\{[A-Za-z_$][A-Za-z0-9_$]*\}$/.test(rawHref);
  return { targetIds: Array.from(targetIds), isUnboundOptionalTemplate };
}

test.describe('consistent-cross-document-transitions Target Grader', () => {
  test('Both the source and destination pages include the @view-transition { navigation: auto; } CSS at-rule', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const vtRules = collectViewTransitionRules(Array.from(stylesheet.cssRules));
    expect(vtRules.length).toBeGreaterThan(0);

    const isEnabledAcrossPages =
      vtRules.some(
        ({ rule, mediaCondition }) =>
          rule.navigation.trim() === 'auto' &&
          (!mediaCondition || !/\breduce\b/i.test(mediaCondition)),
      ) &&
      docs.some((d) => d.document.querySelector('head') !== null) &&
      !docs.some((d) => d.document.querySelector('ClientRouter, clientrouter') !== null);

    expect(isEnabledAcrossPages).toBe(true);
  });

  test('<link rel="expect" href="#element-id" blocking="render"> is used in the <head> to block rendering until above-the-fold DOM elements have been parsed', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const expectLinks = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('head link[rel="expect"]')),
    );
    expect(expectLinks.length).toBeGreaterThan(0);

    const allResolvedTargetIds: string[] = [];
    const allExpectLinksValid = expectLinks.every((link: any) => {
      const { targetIds, isUnboundOptionalTemplate } = resolveExpectTargetIds(link, docs);
      allResolvedTargetIds.push(...targetIds);
      return (
        hasRenderBlockingToken(link) &&
        (isUnboundOptionalTemplate ||
          (targetIds.length > 0 &&
            targetIds.every((targetId) =>
              docs.some(
                (d) =>
                  d.document.getElementById(targetId) !== null ||
                  d.document.querySelector(`[id="${targetId}"]`) !== null,
              ),
            )))
      );
    });

    expect(allResolvedTargetIds.length).toBeGreaterThan(0);
    expect(allExpectLinksValid).toBe(true);
  });

  test('Critical stylesheets are placed in the <head>, and any pre-transition scripts or expect links in the <head> are marked with blocking="render" while third-party scripts are not render-blocked', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const headRenderBlocked = docs
      .flatMap((d) => Array.from(d.document.querySelectorAll('head [blocking]')))
      .filter((el) => hasRenderBlockingToken(el));
    expect(headRenderBlocked.length).toBeGreaterThan(0);

    const headScripts = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('head script')),
    );
    const noThirdPartyRenderBlocked = headScripts
      .filter((script) => isThirdPartyOrAnalyticsScript(script))
      .every((script) => !hasRenderBlockingToken(script));

    const allScripts = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('script')),
    );
    const scriptCheckProject: Project = getJsProject([]);
    const preTransitionScriptsValid = allScripts.every((script: any, index: number) => {
      if (isThirdPartyOrAnalyticsScript(script)) {
        return !hasRenderBlockingToken(script);
      }
      const code = script.textContent?.trim();
      if (!code) return true;
      const sf = scriptCheckProject.createSourceFile(`inline_${index}.ts`, code, {
        overwrite: true,
      });
      const identifiers = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .map((id) => id.getText());
      const stringLiterals = sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .map((lit) => lit.getLiteralValue());

      const isPreTransitionScript =
        identifiers.includes('viewTransition') ||
        identifiers.includes('viewTransitionName') ||
        identifiers.includes('theme') ||
        stringLiterals.includes('pagereveal') ||
        stringLiterals.includes('theme');

      return (
        !isPreTransitionScript ||
        (script.closest('head') !== null && hasRenderBlockingToken(script))
      );
    });

    expect(noThirdPartyRenderBlocked && preTransitionScriptsValid).toBe(true);
  });

  test('Render blocking is limited to resources and elements visible in the initial viewport and non-critical or below-the-fold content is NOT render-blocked', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const expectLinks = docs
      .flatMap((d) => Array.from(d.document.querySelectorAll('head link[rel="expect"]')))
      .filter((link) => hasRenderBlockingToken(link));
    expect(expectLinks.length).toBeGreaterThan(0);

    const noBodyRenderBlocking = docs
      .flatMap((d) => Array.from(d.document.querySelectorAll('body [blocking]')))
      .every((el) => !hasRenderBlockingToken(el));

    const noThirdPartyRenderBlocking = docs
      .flatMap((d) => Array.from(d.document.querySelectorAll('script')))
      .filter((script) => isThirdPartyOrAnalyticsScript(script))
      .every((script) => !hasRenderBlockingToken(script));

    const allResolvedAboveFoldIds: string[] = [];
    const onlyAboveTheFoldTargets = expectLinks.every((link: any) => {
      const { targetIds, isUnboundOptionalTemplate } = resolveExpectTargetIds(link, docs);
      if (isUnboundOptionalTemplate) return true;
      if (targetIds.length === 0) return false;
      allResolvedAboveFoldIds.push(...targetIds);
      return targetIds.every((targetId) => {
        const matchedElements = docs.flatMap((d) =>
          Array.from(d.document.querySelectorAll(`[id="${targetId}"]`)),
        );
        return (
          matchedElements.length > 0 &&
          matchedElements.every((el: any) => {
            const tag = el.tagName.toLowerCase();
            return tag !== 'footer' && el.closest('footer') === null;
          })
        );
      });
    });

    expect(allResolvedAboveFoldIds.length).toBeGreaterThan(0);
    expect(
      noBodyRenderBlocking && noThirdPartyRenderBlocking && onlyAboveTheFoldTargets,
    ).toBe(true);
  });

  test('No two elements on the same page share the same view-transition-name value', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const vtRules = collectViewTransitionRules(Array.from(stylesheet.cssRules));
    expect(vtRules.length).toBeGreaterThan(0);

    const styleRulesWithVtn = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        r.selectorText !== '[style]' &&
        !r.selectorText.includes('::') &&
        Boolean(r.style.getPropertyValue('view-transition-name').trim()) &&
        r.style.getPropertyValue('view-transition-name').trim() !== 'none',
    );

    const duplicates: string[] = [];

    for (const { file, document } of docs) {
      const nameToElements = new Map<string, any[]>();

      const recordElement = (name: string, el: any) => {
        const existing = nameToElements.get(name) || [];
        const isConditionalImagePair = existing.some(
          (prev) =>
            (prev.closest?.('figure') !== null &&
              prev.closest?.('figure') === el.closest?.('figure')) ||
            (prev.parentElement !== null &&
              prev.parentElement === el.parentElement &&
              prev.tagName?.toLowerCase() !== el.tagName?.toLowerCase()),
        );
        if (!isConditionalImagePair && !existing.includes(el)) {
          existing.push(el);
          nameToElements.set(name, existing);
        }
      };

      Array.from(document.querySelectorAll('[style]')).forEach((el: any) => {
        const decl = new CSSStyleDeclaration();
        decl.cssText = el.getAttribute('style') || '';
        const vtn = decl.getPropertyValue('view-transition-name').trim();
        if (vtn && vtn !== 'none') {
          recordElement(vtn, el);
        }
      });

      for (const rule of styleRulesWithVtn) {
        const vtn = rule.style.getPropertyValue('view-transition-name').trim();
        Array.from(document.querySelectorAll(rule.selectorText)).forEach((el: any) => {
          recordElement(vtn, el);
        });
      }

      for (const [name, elements] of nameToElements.entries()) {
        if (elements.length > 1) {
          duplicates.push(`${file}:${name}(${elements.length})`);
        }
      }
    }

    expect(duplicates).toEqual([]);
  });

  test('Cross-document view transitions are disabled when prefers-reduced-motion: reduce is active', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const vtRules = collectViewTransitionRules(Array.from(stylesheet.cssRules));
    expect(vtRules.length).toBeGreaterThan(0);

    const hasReducedMotionNone = vtRules.some(
      ({ rule, mediaCondition }) =>
        Boolean(mediaCondition) &&
        /\bprefers-reduced-motion\s*:\s*reduce\b/i.test(mediaCondition!) &&
        rule.navigation.trim() === 'none',
    );

    const hasOnlyNoPreferenceAuto =
      vtRules.some(
        ({ rule, mediaCondition }) =>
          Boolean(mediaCondition) &&
          /\bprefers-reduced-motion\s*:\s*no-preference\b/i.test(mediaCondition!) &&
          rule.navigation.trim() === 'auto',
      ) &&
      !vtRules.some(
        ({ rule, mediaCondition }) =>
          !mediaCondition && rule.navigation.trim() === 'auto',
      );

    expect(hasReducedMotionNone || hasOnlyNoPreferenceAuto).toBe(true);
  });
});
