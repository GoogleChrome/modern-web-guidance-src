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

function collectNodes(root: any): any[] {
  const nodes: any[] = [];
  const visit = (node: any) => {
    if (!node) return;
    nodes.push(node);
    const children = node.childNodes ? Array.from(node.childNodes) : [];
    for (const child of children) {
      visit(child);
    }
  };
  visit(root);
  return nodes;
}

function getMarkerInfo(node: any): { type: 'start' | 'end' | 'marker'; name?: string } | null {
  if (!node || (node.nodeType !== 7 && node.nodeType !== 8)) return null;
  const raw = String(node.nodeValue || node.data || node.textContent || '').trim();
  const normalized = raw.replace(/^\?/, '').replace(/\?$/, '').trim();
  const lower = normalized.toLowerCase();

  if (lower === 'end' || lower.startsWith('end ') || lower.startsWith('end\t')) {
    return { type: 'end' };
  }

  let type: 'start' | 'marker' | null = null;
  if (lower.startsWith('start')) {
    type = 'start';
  } else if (lower.startsWith('marker')) {
    type = 'marker';
  }
  if (!type) return null;

  const rest = normalized.slice(type.length).trim();
  let name: string | undefined;
  const eqIdx = rest.indexOf('=');
  if (eqIdx !== -1) {
    const afterEq = rest.slice(eqIdx + 1).trim();
    const quote = afterEq[0];
    if (quote === '"' || quote === "'") {
      const endQuoteIdx = afterEq.indexOf(quote, 1);
      if (endQuoteIdx !== -1) {
        name = afterEq.slice(1, endQuoteIdx).trim();
      }
    } else {
      name = afterEq.split(/\s+/)[0]?.trim();
    }
  }
  return { type, name };
}

test.describe('out-of-order-html-streaming Target Grader', () => {
  test('Renders initial fallback content within <?start> and <?end> processing instruction ranges', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasValidRange = docs.some(({ document }) => {
      const bodyNodes = collectNodes(document.body || document);
      const startNames = new Set<string>();
      let endCount = 0;

      for (const node of bodyNodes) {
        if (node.parentNode?.tagName?.toLowerCase() === 'template') continue;
        const info = getMarkerInfo(node);
        if (info?.type === 'start' && info.name) {
          startNames.add(info.name);
        } else if (info?.type === 'end') {
          endCount++;
        }
      }

      return startNames.size > 0 && endCount > 0;
    });

    expect(hasValidRange).toBe(true);
  });

  test('Provides <template for="..."> elements matching the declarative marker names', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasMatchingTemplate = docs.some(({ document }) => {
      const allNodes = collectNodes(document.body || document);
      const markerNames = new Set<string>();

      for (const node of allNodes) {
        const info = getMarkerInfo(node);
        if ((info?.type === 'start' || info?.type === 'marker') && info.name) {
          markerNames.add(info.name);
        }
      }

      const templates = Array.from(document.querySelectorAll('template[for]')) as any[];
      return templates.some((tpl) => {
        const targetName = tpl.getAttribute('for')?.trim();
        const hasChildren = (tpl.innerHTML || tpl.textContent || '').trim().length > 0;
        return Boolean(targetName && markerNames.has(targetName) && hasChildren);
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
