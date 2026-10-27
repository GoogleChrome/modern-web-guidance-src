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
    const hasFallbackInRange = docs.some(({ document }) => {
      const elements: any[] = Array.from(document.querySelectorAll('*'));
      return elements.some((el) => {
        const nodes: any[] = Array.from(el.childNodes || []);
        let inStartRange = false;
        let foundFallbackElement = false;
        for (const node of nodes) {
          if (node.nodeType === 8 || node.nodeType === 7) {
            const raw = (node.nodeValue || node.data || '').trim();
            if (/^\?start\b/i.test(raw) && /\bname\s*=/i.test(raw)) {
              inStartRange = true;
              foundFallbackElement = false;
            } else if (/^\?end\b/i.test(raw) && inStartRange && foundFallbackElement) {
              return true;
            }
          } else if (inStartRange && node.nodeType === 1) {
            foundFallbackElement = true;
          }
        }
        return false;
      });
    });
    expect(hasFallbackInRange).toBe(true);
  });

  test('The fallback content should be automatically replaced by the final content delivered in a <template for="..."> element once that part of the HTML stream is processed', () => {
    const docs = getHtmlDocuments(targetFiles);
    const startNames = new Set<string>();

    for (const { document } of docs) {
      const elements: any[] = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const nodes: any[] = Array.from(el.childNodes || []);
        for (const node of nodes) {
          if (node.nodeType === 8 || node.nodeType === 7) {
            const raw = (node.nodeValue || node.data || '').trim();
            const match = raw.match(/^\?start\s+name\s*=\s*["']?([^"'\s>?]+)["']?/i);
            if (match && match[1]) {
              startNames.add(match[1]);
            }
          }
        }
      }
    }

    const hasMatchingTemplateFor = docs.some(({ document }) => {
      const templates: any[] = Array.from(document.querySelectorAll('template[for]'));
      return templates.some((tpl) => {
        const targetName = tpl.getAttribute('for')?.trim();
        const hasContent = (tpl.innerHTML || tpl.textContent || '').trim().length > 0 || (tpl.childNodes && tpl.childNodes.length > 0);
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
