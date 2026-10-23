import * as fs from 'fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getComprehensiveJsProject(files: string[]): Project {
  const project = getJsProject(files);
  for (const file of files) {
    if (file.endsWith('.mjs') && fs.existsSync(file) && !fs.statSync(file).isDirectory()) {
      const content = fs.readFileSync(file, 'utf8');
      project.createSourceFile(file, content, { overwrite: true });
    }
  }
  return project;
}

test.describe('devtools-times WebAssembly C++ Target Grader', () => {

  test('The application loads a WebAssembly module', () => {
    const project = getComprehensiveJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasWasmLoading = sourceFiles.some((sf) => {
      const hasWebAssemblyRef =
        sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === 'WebAssembly') ||
        sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((pa) => pa.getText().includes('WebAssembly'));

      const hasWasmString = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((str) => {
        const val = str.getLiteralValue();
        return val.includes('.wasm') || val.includes('/wasm/');
      });

      const hasModuleLoader = sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression().getText();
        return /create.*Module|load.*Module|loadRenderer|instantiateAsync/i.test(expr);
      });

      return hasWebAssemblyRef || hasWasmString || hasModuleLoader;
    });

    expect(hasWasmLoading).toBe(true);
  });

  test('The browser console contains no unhandled errors or exceptions during module initialization and execution', () => {
    const project = getComprehensiveJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasHandledErrors = sourceFiles.some((sf) => {
      const hasTryCatch = sf.getDescendantsOfKind(SyntaxKind.TryStatement).length > 0;
      const hasWorkerErrorHandler =
        sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((be) => {
          const left = be.getLeft().getText();
          return left.includes('onerror') || left.includes('onmessageerror');
        }) ||
        sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((pa) => {
          return pa.getName() === 'printErr' || pa.getName() === 'onerror';
        });

      const hasWasmOrWorkerContext = /worker|wasm|render|image/i.test(sf.getFilePath());
      return hasWasmOrWorkerContext && (hasTryCatch || hasWorkerErrorHandler);
    }) && sourceFiles.some((sf) => {
      return sf.getText().includes('onerror') || sf.getText().includes('catch');
    });

    expect(hasHandledErrors).toBe(true);
  });

  test('The WebAssembly module is built with optimizations enabled and debug info stripped', () => {
    const buildConfigOrScripts = targetFiles.filter((f) =>
      /package\.json$|build.*\.sh$|build.*\.mjs$|build.*\.js$|Makefile$|CMakeLists\.txt$/i.test(f)
    );

    let hasOptimizationFlags = false;
    for (const file of buildConfigOrScripts) {
      if (fs.existsSync(file) && !fs.statSync(file).isDirectory()) {
        const content = fs.readFileSync(file, 'utf8');
        if ((/-O3\b|-Oz\b|-O2\b/i.test(content)) && (/-flto\b/i.test(content) || /-sALLOW_MEMORY_GROWTH\b/i.test(content))) {
          hasOptimizationFlags = true;
          break;
        }
      }
    }

    expect(hasOptimizationFlags).toBe(true);
  });

  test('A rendered image is present on the page', () => {
    const project = getComprehensiveJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);

    const jsxElements = [
      ...project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)),
      ...project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)),
    ];

    const hasCanvasOrRenderedImg = jsxElements.some((el) => {
      const tag = el.getTagNameNode().getText();
      if (tag === 'canvas') return true;
      if (tag === 'img') {
        const attrs = el.getAttributes().map((a) => a.getText().toLowerCase());
        return attrs.some((a) => a.includes('rendered') || a.includes('generated') || a.includes('visual'));
      }
      return false;
    }) || docs.some((d) => Boolean(d.document.querySelector('canvas, img[id*="render"], img[data-testid*="render"]')));

    expect(hasCanvasOrRenderedImg).toBe(true);
  });

  test('A button exists on the page to render a new image', () => {
    const project = getComprehensiveJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);

    const jsxButtons = [
      ...project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)),
      ...project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)),
    ].filter((el) => el.getTagNameNode().getText() === 'button');

    const hasRenderButton = jsxButtons.some((button) => {
      const parent = button.getParent();
      const fullText = parent ? parent.getText() : button.getText();
      const hasClick = button.getAttributes().some((a) => a.getText().includes('onClick'));
      const hasRenderLabel = /render|generate/i.test(fullText);
      return hasClick && hasRenderLabel;
    }) || docs.some((d) => {
      const buttons = Array.from(d.document.querySelectorAll('button'));
      return buttons.some((b: any) => /render|generate/i.test(b.textContent || ''));
    });

    expect(hasRenderButton).toBe(true);
  });

  test('The application remains responsive to user interaction (e.g., hover states or clicks) while the image is being generated', () => {
    const project = getComprehensiveJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    // 1. Off-thread execution using a Web Worker so the main UI thread never blocks
    const hasWebWorker = project.getSourceFiles().some((sf) => {
      const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
      const hasWorkerInst = newExprs.some((ne) => ne.getExpression().getText() === 'Worker');
      const hasWorkerScope = sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) =>
        id.getText() === 'WorkerGlobalScope' || id.getText() === 'postMessage'
      );
      return hasWorkerInst || hasWorkerScope;
    });

    // 2. Responsive UI elements with interactive hover states or click feedback
    const rules = Array.from(stylesheet.cssRules);
    const hasHoverStyles =
      rules.some((r) => r instanceof CSSStyleRule && r.selectorText.includes(':hover')) ||
      docs.some((d) => Boolean(d.document.querySelector('[class*="hover:"]'))) ||
      project.getSourceFiles().some((sf) => {
        return (
          sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((str) => str.getLiteralValue().includes('hover:')) ||
          sf.getDescendantsOfKind(SyntaxKind.JsxAttribute).some((attr) => attr.getNameNode().getText() === 'onMouseEnter')
        );
      });

    expect(hasWebWorker && hasHoverStyles).toBe(true);
  });
});
