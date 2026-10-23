import * as fs from 'node:fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project, type CallExpression } from 'ts-morph';
import { CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

const HTML_SETTER_METHODS = new Set([
  'setHTML',
  'streamHTML',
  'setHTMLUnsafe',
  'streamHTMLUnsafe',
  'replaceWithHTML',
  'streamReplaceWithHTML',
  'replaceWithHTMLUnsafe',
  'streamReplaceWithHTMLUnsafe',
  'beforeHTML',
  'streamBeforeHTML',
  'beforeHTMLUnsafe',
  'streamBeforeHTMLUnsafe',
  'prependHTML',
  'streamPrependHTML',
  'prependHTMLUnsafe',
  'streamPrependHTMLUnsafe',
  'appendHTML',
  'streamAppendHTML',
  'appendHTMLUnsafe',
  'streamAppendHTMLUnsafe',
  'afterHTML',
  'streamAfterHTML',
  'afterHTMLUnsafe',
  'streamAfterHTMLUnsafe',
]);

test.describe('out-of-order-html-streaming Target Grader', () => {
  test('Renders initial fallback content within <?start> and <?end> processing instruction ranges', () => {
    const hasValidRange = targetFiles.some((file) => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const content = fs.readFileSync(file, 'utf8');
      const startIndex = content.indexOf('<?start');
      if (startIndex === -1) return false;
      const endIndex = content.indexOf('<?end', startIndex);
      if (endIndex <= startIndex) return false;
      const innerContent = content.slice(startIndex, endIndex);
      return innerContent.length > '<?start'.length;
    });

    expect(hasValidRange).toBe(true);
  });

  test('Provides <template for="..."> elements matching the declarative marker names', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasMatchingTemplate = docs.some(({ file, document }) => {
      const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      const templates = Array.from(document.querySelectorAll('template[for]')) as any[];
      return templates.some((tpl) => {
        const targetName = tpl.getAttribute('for')?.trim();
        const hasChildren = (tpl.innerHTML || tpl.textContent || '').trim().length > 0;
        return Boolean(
          targetName &&
            hasChildren &&
            (content.includes('<?start') || content.includes('<?marker')) &&
            content.includes(targetName)
        );
      });
    });

    expect(hasMatchingTemplate).toBe(true);
  });

  test('Reserves stable dimensions on placeholder containers or skeleton elements to prevent layout shifts', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasStableDimensionCss = rules.some((rule): rule is CSSStyleRule => {
      if (!(rule instanceof CSSStyleRule)) return false;
      const minHeight = rule.style.getPropertyValue('min-height')?.trim();
      const aspectRatio = rule.style.getPropertyValue('aspect-ratio')?.trim();
      const containIntrinsicSize = rule.style.getPropertyValue('contain-intrinsic-size')?.trim();
      return Boolean(minHeight || aspectRatio || containIntrinsicSize);
    });

    const docs = getHtmlDocuments(targetFiles);
    const hasUtilityDimensionClass = docs.some(({ document }) =>
      Boolean(document.querySelector('[class*="min-h-"], [class*="aspect-"]'))
    );

    expect(hasStableDimensionCss || hasUtilityDimensionClass).toBe(true);
  });

  test('Uses native imperative HTML setter and streaming APIs safely and appropriately', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions: CallExpression[] = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const propAccesses = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    );

    const hasHtmlSetterOrStreamApi =
      callExpressions.some((call) => {
        const expr = call.getExpression();
        if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
          return HTML_SETTER_METHODS.has(expr.getName());
        }
        return false;
      }) ||
      propAccesses.some((prop) => HTML_SETTER_METHODS.has(prop.getName()));

    // Verify no unconditional { runScripts: true } is passed to unsafe methods without checking or trusted script context
    const hasUnconditionalRunScriptsTrue = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      const name = expr.getName();
      if (!name.endsWith('Unsafe')) return false;
      const args = call.getArguments();
      return args.some((arg) => {
        if (!arg.isKind(SyntaxKind.ObjectLiteralExpression)) return false;
        const prop = arg.getProperty('runScripts');
        if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return false;
        return prop.getInitializer()?.getKind() === SyntaxKind.TrueKeyword;
      });
    });

    expect(hasHtmlSetterOrStreamApi && !hasUnconditionalRunScriptsTrue).toBe(true);
  });

  test('Includes aria-live attributes on containers receiving out-of-order updates', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasAriaLive = docs.some(({ document }) => {
      const liveElements = Array.from(document.querySelectorAll('[aria-live]')) as any[];
      return liveElements.some((el) => {
        const val = el.getAttribute('aria-live')?.trim().toLowerCase();
        return val === 'polite' || val === 'assertive';
      });
    });

    expect(hasAriaLive).toBe(true);
  });
});
