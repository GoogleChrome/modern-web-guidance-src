import * as fs from 'fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { CSSStyleRule } from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Out-of-Order HTML Streaming Target Grader', () => {

  test('Renders initial fallback content within <?start> and <?end> processing instructions', () => {
    const hasFallbackInProcessingInstructions = targetFiles.some(file => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const content = fs.readFileSync(file, 'utf8');
      const startIndex = content.indexOf('<?start');
      if (startIndex === -1) return false;
      const endIndex = content.indexOf('<?end', startIndex);
      if (endIndex <= startIndex) return false;
      const innerContent = content.slice(startIndex, endIndex);
      return innerContent.length > '<?start'.length;
    });

    expect(hasFallbackInProcessingInstructions).toBe(true);
  });

  test('Delivers replacement content in a <template for="..."> element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasTemplateFor = docs.some(d => {
      const templates = d.document.querySelectorAll('template[for]');
      return templates.length > 0;
    });

    expect(hasTemplateFor).toBe(true);
  });

  test('Ensures placeholder containers have stable dimensions to prevent layout shifts', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasCssStableDimensions = rules.some(r => {
      if (r instanceof CSSStyleRule) {
        const minH = r.style.getPropertyValue('min-height');
        const aspect = r.style.getPropertyValue('aspect-ratio');
        if (minH || aspect) {
          return !minH.includes('100vh') && minH !== 'screen';
        }
      }
      return false;
    });

    const hasDomStableDimensions = docs.some(d => {
      const candidateContainers = d.document.querySelectorAll(
        '[aria-live], [data-trending-widget], #trending-now-content, .latest-stories-content, #comments, [data-latest-stories], #live-updates'
      );
      return Array.from(candidateContainers).some(el => {
        const style = (el as any).getAttribute('style') || '';
        const cls = (el as any).className || '';
        if (style.includes('min-height') || style.includes('aspect-ratio') || cls.includes('min-h-') || cls.includes('aspect-')) {
          return true;
        }
        const child = (el as any).querySelector('[style*="min-height"], [style*="aspect-ratio"], [class*="min-h-"], [class*="aspect-"]');
        return Boolean(child);
      });
    });

    expect(hasCssStableDimensions || hasDomStableDimensions).toBe(true);
  });

  test('Uses Response.textStream() to obtain a stream of HTML for imperative updates', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasTextStreamCall = callExpressions.some(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        return (expr as any).getName() === 'textStream';
      }
      return false;
    });

    expect(hasTextStreamCall).toBe(true);
  });

  test('Restricts unsafe methods to trusted content requiring features removed by safe methods', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const setterCalls = callExpressions.filter(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const name = (expr as any).getName();
        return /^(streamHTML|setHTML|streamReplaceWithHTML|replaceWithHTML|streamAppendHTML|appendHTML|streamPrependHTML|prependHTML)(Unsafe)?$/.test(name);
      }
      return false;
    });

    const hasImperativeSetter = setterCalls.length > 0;
    const adheresToSafeUnsafeUsage = hasImperativeSetter && (
      setterCalls.some(call => !(call.getExpression() as any).getName().includes('Unsafe')) ||
      setterCalls.some(call => (call.getExpression() as any).getName().includes('Unsafe') && call.getArguments().some(arg => arg.getText().includes('runScripts')))
    );

    expect(adheresToSafeUnsafeUsage).toBe(true);
  });

  test('Passes runScripts: true only to unsafe methods when handling trusted scripts', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const setterCalls = callExpressions.filter(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const name = (expr as any).getName();
        return /^(streamHTML|setHTML|streamReplaceWithHTML|replaceWithHTML)(Unsafe)?$/.test(name);
      }
      return false;
    });

    const hasStreamingSetters = setterCalls.length > 0;
    const passesRunScriptsToSafeMethod = setterCalls.some(call => {
      const methodName = (call.getExpression() as any).getName();
      return !methodName.includes('Unsafe') && call.getArguments().some(arg => arg.getText().includes('runScripts'));
    });

    const validRunScriptsUsage = hasStreamingSetters && !passesRunScriptsToSafeMethod && (
      setterCalls.some(call => {
        const methodName = (call.getExpression() as any).getName();
        return methodName.includes('Unsafe') && call.getArguments().some(arg => arg.getText().includes('runScripts: true') || arg.getText().includes('runScripts'));
      }) ||
      setterCalls.every(call => !call.getArguments().some(arg => arg.getText().includes('runScripts')))
    );

    expect(validRunScriptsUsage).toBe(true);
  });

  test('Equips containers receiving out-of-order updates with aria-live attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasAriaLiveOnStreamingContainers = docs.some(d => {
      const liveElements = d.document.querySelectorAll('[aria-live]');
      return Array.from(liveElements).some(el => {
        const ariaLiveValue = (el as any).getAttribute('aria-live');
        return ariaLiveValue === 'polite' || ariaLiveValue === 'assertive';
      });
    });

    expect(hasAriaLiveOnStreamingContainers).toBe(true);
  });

});
