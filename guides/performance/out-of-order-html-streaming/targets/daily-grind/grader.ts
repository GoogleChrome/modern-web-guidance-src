import * as fs from 'node:fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import { CSSStyleRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore - import.meta.url is supported in Playwright ESM runtime
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

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...getAllStyleRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

const UNSAFE_HTML_METHODS = new Set([
  'setHTMLUnsafe',
  'streamHTMLUnsafe',
  'replaceWithHTMLUnsafe',
  'streamReplaceWithHTMLUnsafe',
  'beforeHTMLUnsafe',
  'streamBeforeHTMLUnsafe',
  'prependHTMLUnsafe',
  'streamPrependHTMLUnsafe',
  'appendHTMLUnsafe',
  'streamAppendHTMLUnsafe',
  'afterHTMLUnsafe',
  'streamAfterHTMLUnsafe',
]);

const SAFE_HTML_METHODS = new Set([
  'setHTML',
  'streamHTML',
  'replaceWithHTML',
  'streamReplaceWithHTML',
  'beforeHTML',
  'streamBeforeHTML',
  'prependHTML',
  'streamPrependHTML',
  'appendHTML',
  'streamAppendHTML',
  'afterHTML',
  'streamAfterHTML',
]);

test.describe('out-of-order-html-streaming Target Grader', () => {
  test('The page should initially render fallback content (such as a loading skeleton) within a range defined by <?start> and <?end> processing instructions', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasFallbackInRange = docs.some(({ file }) => {
      const htmlWithoutTemplates = getRawHtmlWithoutTemplates(file);
      return hasNonEmptyFallbackRangeInHtml(htmlWithoutTemplates);
    });
    expect(hasFallbackInRange).toBe(true);
  });

  test('The fallback content should be automatically replaced by the final content delivered in a <template for="..."> element once that part of the HTML stream is processed', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasMatchingTemplateFor = docs.some(({ file, document }) => {
      const templates: any[] = Array.from(document.querySelectorAll('template[for]'));
      if (templates.length === 0) return false;

      const htmlWithoutTemplates = getRawHtmlWithoutTemplates(file);
      const startNames = new Set(extractMarkerNames(htmlWithoutTemplates));

      return templates.some((tpl) => {
        const targetName = tpl.getAttribute('for')?.trim();
        const contentRoot = tpl.content || tpl;
        const hasContent =
          (contentRoot.children && contentRoot.children.length > 0) ||
          (contentRoot.childNodes && contentRoot.childNodes.length > 0) ||
          String(tpl.innerHTML || tpl.textContent || '').trim().length > 0;
        return Boolean(targetName && startNames.has(targetName) && hasContent);
      });
    });

    expect(hasMatchingTemplateFor).toBe(true);
  });

  test('Placeholder containers should have stable dimensions (e.g. min-height or aspect-ratio) to prevent layout shifts when the content is patched', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasStableCssDimension = styleRules.some((rule) => {
      const minHeight = rule.style.getPropertyValue('min-height').trim();
      const aspectRatio = rule.style.getPropertyValue('aspect-ratio').trim();
      const minBlockSize = rule.style.getPropertyValue('min-block-size').trim();
      const height = rule.style.getPropertyValue('height').trim();
      const isCardOrPlaceholderSelector = /(skeleton|card|promo|review|placeholder|\[style\])/i.test(rule.selectorText);
      return isCardOrPlaceholderSelector && Boolean(minHeight || aspectRatio || minBlockSize || height);
    });

    const hasUtilityDimension = docs.some(({ document }) =>
      Boolean(
        document.querySelector(
          '[class*="min-h-"], [class*="aspect-"], .skeleton[style*="min-height"], .card[style*="min-height"]',
        ),
      ),
    );

    expect(hasStableCssDimension || hasUtilityDimension).toBe(true);
  });

  test('For imperative updates, the Response.textStream() method should be used to get a stream of HTML from a fetch response', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasStreamingFetchPipe = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      const methodName = expr.getName();
      if (methodName !== 'pipeTo') return false;

      const receiverText = expr.getExpression().getText();
      const usesTextStreamOrDecoder =
        /\btextStream\s*\(/.test(receiverText) || /\bTextDecoderStream\b/.test(receiverText);

      const args = call.getArguments();
      const pipesToStreamSetter = args.length > 0 && (
        /\bstream[A-Za-z]*HTML(?:Unsafe)?\s*\(/.test(args[0].getText()) ||
        args[0].isKind(SyntaxKind.Identifier)
      );

      return usesTextStreamOrDecoder && pipesToStreamSetter;
    });

    expect(hasStreamingFetchPipe).toBe(true);
  });

  test('Unsafe methods should only be used with trusted content that contains items that would be removed by the safe methods', () => {
    const project: Project = getJsProject(targetFiles);
    const propAccesses = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression));

    const usesSafeHtmlMethod = propAccesses.some((pa) => SAFE_HTML_METHODS.has(pa.getName()));
    const usesUnsafeHtmlMethod = propAccesses.some((pa) => UNSAFE_HTML_METHODS.has(pa.getName()));

    // Check that customer review / untrusted updates are not passed directly to unsafe HTML methods
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const unsafeCalledOnReviews = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      if (!UNSAFE_HTML_METHODS.has(expr.getName())) return false;
      const receiverText = expr.getExpression().getText();
      return /review/i.test(receiverText);
    });

    expect(usesSafeHtmlMethod && usesUnsafeHtmlMethod && !unsafeCalledOnReviews).toBe(true);
  });

  test('The runScripts: true option must only be passed to an unsafe method when writing content that contains trusted <script> elements', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const unsafeCallsWithRunScripts = callExpressions.filter((call) => {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      if (!UNSAFE_HTML_METHODS.has(expr.getName())) return false;

      return call.getArguments().some((arg) => {
        if (!arg.isKind(SyntaxKind.ObjectLiteralExpression)) return false;
        return arg.getProperties().some((prop) => {
          if (!prop.isKind(SyntaxKind.PropertyAssignment)) return false;
          const propName = prop.getName().replace(/['"]/g, '');
          const initText = prop.getInitializer()?.getText().trim();
          return propName === 'runScripts' && initText === 'true';
        });
      });
    });

    const safeCallsWithRunScripts = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      if (!SAFE_HTML_METHODS.has(expr.getName())) return false;

      return call.getArguments().some((arg) => {
        if (!arg.isKind(SyntaxKind.ObjectLiteralExpression)) return false;
        return arg.getProperties().some((prop) => {
          if (!prop.isKind(SyntaxKind.PropertyAssignment)) return false;
          return prop.getName().replace(/['"]/g, '') === 'runScripts';
        });
      });
    });

    expect(unsafeCallsWithRunScripts.length > 0 && !safeCallsWithRunScripts).toBe(true);
  });

  test('Containers receiving out-of-order updates should have appropriate aria-live attributes, where needed, to notify screen reader users of the changes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasAriaLiveContainer = docs.some(({ document }) => {
      const liveRegions: any[] = Array.from(document.querySelectorAll('[aria-live]'));
      return liveRegions.some((el) => {
        const val = el.getAttribute('aria-live')?.trim().toLowerCase();
        return val === 'polite' || val === 'assertive';
      });
    });

    expect(hasAriaLiveContainer).toBe(true);
  });
});
