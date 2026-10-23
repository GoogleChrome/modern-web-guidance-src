import * as fs from 'node:fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type CallExpression, type ObjectLiteralExpression } from 'ts-morph';
import type { Document } from 'linkedom';
import { CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getRawHtmlWithoutTemplates(file: string): string {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return '';
  const raw = fs.readFileSync(file, 'utf8');
  return raw.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
}

function extractMarkerNames(html: string): string[] {
  const names: string[] = [];
  const regex = /<\?(?:start|marker)\b[^>]*?\bname\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>?]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const name = (match[1] || match[2] || match[3] || '').trim();
    if (name) names.push(name);
  }
  return names;
}

function hasNonEmptyFallbackRangeInHtml(html: string): boolean {
  const startRegex = /<\?start\b[^>]*?\bname\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>?]+)[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = startRegex.exec(html)) !== null) {
    const afterStart = match.index + match[0].length;
    const endMatch = /<\?end\b[^>]*>/i.exec(html.slice(afterStart));
    if (endMatch) {
      const inner = html.slice(afterStart, afterStart + endMatch.index).trim();
      if (inner.length > 0) return true;
    }
  }
  return false;
}

test.describe('out-of-order-html-streaming Target Grader', () => {
  test('Renders initial fallback content within a range defined by <?start> and <?end> processing instructions', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasValidRangeWithFallback = docs.some(({ file }) => {
      const htmlWithoutTemplates = getRawHtmlWithoutTemplates(file);
      return hasNonEmptyFallbackRangeInHtml(htmlWithoutTemplates);
    });
    expect(hasValidRangeWithFallback).toBe(true);
  });

  test('Delivers replacement content in a <template for="..."> element matching a declared processing instruction marker', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasMatchingTemplate = docs.some(({ file, document }) => {
      const templates = Array.from(document.querySelectorAll('template[for]')) as any[];
      if (templates.length === 0) return false;

      const htmlWithoutTemplates = getRawHtmlWithoutTemplates(file);
      const markerNames = new Set(extractMarkerNames(htmlWithoutTemplates));

      return templates.some((tpl) => {
        const targetName = tpl.getAttribute('for')?.trim();
        const contentRoot = tpl.content || tpl;
        const hasChildren =
          (contentRoot.children && contentRoot.children.length > 0) ||
          (contentRoot.childNodes && contentRoot.childNodes.length > 0) ||
          String(tpl.innerHTML || tpl.textContent || '').trim().length > 0;
        return Boolean(targetName && markerNames.has(targetName) && hasChildren);
      });
    });
    expect(hasMatchingTemplate).toBe(true);
  });

  test('Configures out-of-order update containers with aria-live attributes to notify screen reader users', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasAriaLiveContainer = docs.some(({ file, document }) => {
      const htmlWithoutTemplates = getRawHtmlWithoutTemplates(file);
      const hasMarkers = extractMarkerNames(htmlWithoutTemplates).length > 0;
      const liveElements = Array.from(document.querySelectorAll('[aria-live]')) as any[];
      return (
        hasMarkers &&
        liveElements.some((el) => {
          const val = el.getAttribute('aria-live')?.trim().toLowerCase();
          return val === 'polite' || val === 'assertive';
        })
      );
    });
    expect(hasAriaLiveContainer).toBe(true);
  });

  test('Prevents layout shifts or misused unsafe script execution in out-of-order updates', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasStableDimensions =
      rules.some(
        (r): r is CSSStyleRule =>
          r instanceof CSSStyleRule &&
          (Boolean(r.style.getPropertyValue('min-height')) ||
            Boolean(r.style.getPropertyValue('aspect-ratio')) ||
            Boolean(r.style.getPropertyValue('contain-intrinsic-size'))),
      ) ||
      docs.some(({ document }) =>
        Boolean(document.querySelector('[class*="min-h-"], [class*="aspect-"]')),
      );

    const callExpressions = project
      .getSourceFiles()
      .filter((sf) => !sf.getFilePath().includes('polyfill'))
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const htmlSetterCalls = callExpressions.filter((call: CallExpression) => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const name = (expr as any).getName();
        return /^(set|replaceWith|before|prepend|append|after|stream|streamReplaceWith|streamBefore|streamPrepend|streamAppend|streamAfter)HTML(Unsafe)?$/.test(
          name,
        );
      }
      return false;
    });

    const hasInvalidRunScripts = htmlSetterCalls.some((call: CallExpression) => {
      const args = call.getArguments();
      return args.some((arg) => {
        if (arg.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const obj = arg as ObjectLiteralExpression;
          const prop = obj.getProperty('runScripts');
          if (prop && prop.getText().includes('true')) {
            const firstArgText = args[0]?.getText() || '';
            return !firstArgText.toLowerCase().includes('<script');
          }
        }
        return false;
      });
    });

    expect((hasStableDimensions || htmlSetterCalls.length > 0) && !hasInvalidRunScripts).toBe(true);
  });
});
