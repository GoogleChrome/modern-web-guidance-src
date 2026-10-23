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

interface ProcessingMarker {
  type: 'start' | 'end' | 'marker';
  name: string | null;
  node: any;
}

function collectProcessingMarkers(root: any): ProcessingMarker[] {
  const markers: ProcessingMarker[] = [];

  function walk(node: any): void {
    if (!node) return;
    if (node.nodeType === 8 || node.nodeType === 7) {
      const raw =
        node.nodeType === 7
          ? `?${String(node.target || '').toLowerCase()} ${String(node.data || '')}`.trim()
          : String(node.data || '').trim();
      const normalized = raw.replace(/\?$/, '').trim();
      const lower = normalized.toLowerCase();

      let type: 'start' | 'end' | 'marker' | null = null;
      if (lower.startsWith('?start')) {
        type = 'start';
      } else if (lower.startsWith('?end')) {
        type = 'end';
      } else if (lower.startsWith('?marker')) {
        type = 'marker';
      }

      if (type) {
        let name: string | null = null;
        const nameIndex = lower.indexOf('name');
        if (nameIndex !== -1) {
          const eqIndex = normalized.indexOf('=', nameIndex);
          if (eqIndex !== -1) {
            const rest = normalized.slice(eqIndex + 1).trim();
            const firstChar = rest[0];
            if (firstChar === '"' || firstChar === "'") {
              const endQuote = rest.indexOf(firstChar, 1);
              if (endQuote !== -1) {
                name = rest.slice(1, endQuote);
              }
            } else {
              const spaceIdx = rest.search(/\s/);
              name = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
            }
          }
        }
        markers.push({ type, name, node });
      }
    }

    const children = node.childNodes ? Array.from(node.childNodes) : [];
    for (const child of children) {
      walk(child);
    }
  }

  walk(root);
  return markers;
}

function hasNonEmptyFallbackRange(root: any): boolean {
  const parents = new Set<any>();
  const markers = collectProcessingMarkers(root);
  for (const m of markers) {
    if (m.node?.parentNode) {
      parents.add(m.node.parentNode);
    }
  }

  for (const parent of parents) {
    const children = Array.from(parent.childNodes || []) as any[];
    let depth = 0;
    let hasContentInRange = false;

    for (const child of children) {
      const childMarkers = collectProcessingMarkers(child);
      const directMarker = childMarkers.find((m) => m.node === child);

      if (directMarker?.type === 'start') {
        if (depth === 0) {
          hasContentInRange = false;
        }
        depth++;
      } else if (directMarker?.type === 'end') {
        if (depth > 0) {
          depth--;
          if (depth === 0 && hasContentInRange) {
            return true;
          }
        }
      } else if (depth > 0) {
        if (child.nodeType === 1) {
          hasContentInRange = true;
        } else if (child.nodeType === 3 && String(child.textContent || '').trim().length > 0) {
          hasContentInRange = true;
        }
      }
    }
  }

  return false;
}

test.describe('out-of-order-html-streaming Target Grader', () => {
  test('Renders initial fallback content within a range defined by <?start> and <?end> processing instructions', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasValidRangeWithFallback = docs.some(({ document }) => {
      const bodyClone = document.body?.cloneNode(true) as any;
      if (!bodyClone) return false;
      bodyClone.querySelectorAll('template').forEach((tpl: any) => tpl.remove());
      const markers = collectProcessingMarkers(bodyClone);
      const hasNamedStart = markers.some((m) => m.type === 'start' && Boolean(m.name));
      const hasEnd = markers.some((m) => m.type === 'end');
      return hasNamedStart && hasEnd && hasNonEmptyFallbackRange(bodyClone);
    });
    expect(hasValidRangeWithFallback).toBe(true);
  });

  test('Delivers replacement content in a <template for="..."> element matching a declared processing instruction marker', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasMatchingTemplate = docs.some(({ document }) => {
      const templates = Array.from(document.querySelectorAll('template[for]')) as any[];
      if (templates.length === 0) return false;

      const bodyClone = document.body?.cloneNode(true) as any;
      if (!bodyClone) return false;
      bodyClone.querySelectorAll('template').forEach((tpl: any) => tpl.remove());
      const markerNames = new Set(
        collectProcessingMarkers(bodyClone)
          .filter((m) => (m.type === 'start' || m.type === 'marker') && Boolean(m.name))
          .map((m) => m.name as string),
      );

      return templates.some((tpl) => {
        const targetName = tpl.getAttribute('for')?.trim();
        const contentRoot = tpl.content || tpl;
        const hasChildren =
          (contentRoot.children && contentRoot.children.length > 0) ||
          String(tpl.innerHTML || '').trim().length > 0;
        return Boolean(targetName && markerNames.has(targetName) && hasChildren);
      });
    });
    expect(hasMatchingTemplate).toBe(true);
  });

  test('Configures out-of-order update containers with aria-live attributes to notify screen reader users', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasAriaLiveContainer = docs.some(({ document }) => {
      const liveElements = Array.from(document.querySelectorAll('[aria-live]')) as any[];
      return liveElements.some((el) => {
        const val = el.getAttribute('aria-live')?.trim().toLowerCase();
        const isValidLive = val === 'polite' || val === 'assertive';
        const markers = collectProcessingMarkers(el);
        return isValidLive && markers.length > 0;
      });
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
