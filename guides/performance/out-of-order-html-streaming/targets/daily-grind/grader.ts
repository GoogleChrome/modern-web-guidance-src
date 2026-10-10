import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import {
  SyntaxKind,
  type PropertyAccessExpression,
  type ObjectLiteralExpression,
  type PropertyAssignment,
} from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';

// @ts-ignore TS1470 - import.meta is provided natively in ESM runtime (Playwright)
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('out-of-order-html-streaming Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('page renders fallback content within <?start> and <?end> processing instructions', () => {
    const hasProcessingInstructionFallback = targetFiles.some(file => {
      if (!fs.existsSync(file) || !/\.(html|htm)$/i.test(file)) return false;
      const content = fs.readFileSync(file, 'utf8');
      const startIdx = content.indexOf('<?start');
      const endIdx = content.indexOf('<?end');
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return false;
      const fallbackSlice = content.slice(startIdx, endIdx);
      return fallbackSlice.length > '<?start'.length && /[\w\d<]/.test(fallbackSlice);
    });

    expect(hasProcessingInstructionFallback).toBe(true);
  });

  test('fallback content is replaced by final content delivered in a <template for="..."> element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasTemplateFor = docs.some(d => {
      const templates = d.document.querySelectorAll('template');
      return Array.from(templates).some((t: any) => {
        const forAttr = t.getAttribute('for');
        return typeof forAttr === 'string' && forAttr.trim().length > 0;
      });
    });

    expect(hasTemplateFor).toBe(true);
  });

  test('placeholder containers define stable dimensions to prevent layout shifts', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const docs = getHtmlDocuments(targetFiles);

    const hasStableDimensionRule = rules.some(r => {
      const minHeight = r.style.getPropertyValue('min-height');
      const aspectRatio = r.style.getPropertyValue('aspect-ratio');
      if (!minHeight && (!aspectRatio || aspectRatio === 'auto')) return false;
      return docs.some(d => {
        try {
          return Boolean(d.document.querySelector(r.selectorText));
        } catch {
          return true;
        }
      });
    });

    const hasStableDimensionUtility = docs.some(d =>
      Boolean(d.document.querySelector('[class*="min-h-"], [class*="aspect-"], [style*="min-height"], [style*="aspect-ratio"]'))
    );

    expect(hasStableDimensionRule || hasStableDimensionUtility).toBe(true);
  });

  test('Response.textStream() is used to obtain an HTML stream for imperative updates', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const usesTextStream = callExpressions.some(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        return (expr as PropertyAccessExpression).getName() === 'textStream';
      }
      return false;
    });

    expect(usesTextStream).toBe(true);
  });

  test('unsafe methods are only used with trusted content containing items removed by safe methods', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const unsafeMethodNames = new Set([
      'setHTMLUnsafe', 'streamHTMLUnsafe', 'replaceWithHTMLUnsafe', 'streamReplaceWithHTMLUnsafe',
      'beforeHTMLUnsafe', 'streamBeforeHTMLUnsafe', 'prependHTMLUnsafe', 'streamPrependHTMLUnsafe',
      'appendHTMLUnsafe', 'streamAppendHTMLUnsafe', 'afterHTMLUnsafe', 'streamAfterHTMLUnsafe',
    ]);
    const safeMethodNames = new Set([
      'setHTML', 'streamHTML', 'replaceWithHTML', 'streamReplaceWithHTML',
      'beforeHTML', 'streamBeforeHTML', 'prependHTML', 'streamPrependHTML',
      'appendHTML', 'streamAppendHTML', 'afterHTML', 'streamAfterHTML',
    ]);

    const usedUnsafeMethods = callExpressions.filter(call => {
      const expr = call.getExpression();
      return expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        unsafeMethodNames.has((expr as PropertyAccessExpression).getName());
    });

    const usedSafeMethods = callExpressions.filter(call => {
      const expr = call.getExpression();
      return expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        safeMethodNames.has((expr as PropertyAccessExpression).getName());
    });

    const implementsHtmlSetters = usedUnsafeMethods.length > 0 || usedSafeMethods.length > 0;

    const rootDir = process.cwd();
    const hasScriptInFragments = targetFiles.some(file => {
      if (!fs.existsSync(file)) return false;
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      const parts = rel.split('/');
      if (parts.some(p => p === 'tests' || p === 'test' || p.endsWith('.spec.ts') || p.endsWith('.test.ts') || p === 'index.html')) {
        return false;
      }
      if (rel.endsWith('.ts') || rel.endsWith('.js') || rel.endsWith('.mjs') || rel.endsWith('.json')) {
        return false;
      }
      try {
        const content = fs.readFileSync(file, 'utf8');
        return /<script[\s>]/i.test(content);
      } catch {
        return false;
      }
    });

    const validUnsafeUsage = usedUnsafeMethods.length === 0 || hasScriptInFragments;

    expect(implementsHtmlSetters && validUnsafeUsage).toBe(true);
  });

  test('runScripts: true is only passed to unsafe methods when writing content that contains trusted scripts', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const callsWithRunScripts = callExpressions.filter(call => {
      return call.getArguments().some(arg => {
        if (arg.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const prop = (arg as ObjectLiteralExpression).getProperty('runScripts');
          if (prop && prop.getKind() === SyntaxKind.PropertyAssignment) {
            return (prop as PropertyAssignment).getInitializer()?.getKind() === SyntaxKind.TrueKeyword;
          }
        }
        return false;
      });
    });

    const unsafeMethodNames = new Set([
      'setHTMLUnsafe', 'streamHTMLUnsafe', 'replaceWithHTMLUnsafe', 'streamReplaceWithHTMLUnsafe',
      'beforeHTMLUnsafe', 'streamBeforeHTMLUnsafe', 'prependHTMLUnsafe', 'streamPrependHTMLUnsafe',
      'appendHTMLUnsafe', 'streamAppendHTMLUnsafe', 'afterHTMLUnsafe', 'streamAfterHTMLUnsafe',
    ]);

    const allRunScriptsTargetUnsafe = callsWithRunScripts.every(call => {
      const expr = call.getExpression();
      return expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        unsafeMethodNames.has((expr as PropertyAccessExpression).getName());
    });

    const rootDir = process.cwd();
    const hasScriptInFragments = targetFiles.some(file => {
      if (!fs.existsSync(file)) return false;
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      const parts = rel.split('/');
      if (parts.some(p => p === 'tests' || p === 'test' || p.endsWith('.spec.ts') || p.endsWith('.test.ts') || p === 'index.html')) {
        return false;
      }
      if (rel.endsWith('.ts') || rel.endsWith('.js') || rel.endsWith('.mjs') || rel.endsWith('.json')) {
        return false;
      }
      try {
        const content = fs.readFileSync(file, 'utf8');
        return /<script[\s>]/i.test(content);
      } catch {
        return false;
      }
    });

    const hasImperativeStreaming = callExpressions.some(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const name = (expr as PropertyAccessExpression).getName();
        return name === 'textStream' || name === 'streamHTML' || name === 'streamHTMLUnsafe';
      }
      return false;
    });

    const scriptMatch = hasScriptInFragments ? callsWithRunScripts.length > 0 : callsWithRunScripts.length === 0;

    expect(hasImperativeStreaming && allRunScriptsTargetUnsafe && scriptMatch).toBe(true);
  });

  test('containers receiving out-of-order updates define appropriate aria-live attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const ariaLiveElements = docs.flatMap(d => Array.from(d.document.querySelectorAll('[aria-live]')));
    const hasAriaLiveContainer = ariaLiveElements.some((el: any) => {
      const val = el.getAttribute('aria-live');
      return val === 'polite' || val === 'assertive';
    });

    expect(hasAriaLiveContainer).toBe(true);
  });

});
