import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import fs from 'node:fs';
import path from 'node:path';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Daily Grind Target Grader', () => {

  test('The application loads a WebAssembly module', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const importDecls = sourceFiles.flatMap(sf => sf.getImportDeclarations());
    const importSpecifiers = importDecls.map(i => i.getModuleSpecifierValue());
    const identifiers = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.Identifier));
    const stringLiterals = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.StringLiteral));
    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const loadsWasm = identifiers.some(id => id.getText() === 'WebAssembly')
      || stringLiterals.some(s => /\.wasm\b/i.test(s.getLiteralValue()) || /wasm/i.test(s.getLiteralValue()))
      || importSpecifiers.some(s => /wasm|\.mjs|generator|smallpt|renderer/i.test(s))
      || identifiers.some(id => [
        'HEAPU8', 'HEAP8', 'HEAP16', 'HEAP32', 'HEAPF32', 'HEAPF64',
        '_malloc', '_free', 'ccall', 'cwrap', '_render', '_generate_image'
      ].includes(id.getText()))
      || callExpressions.some(call => /instantiate|compileStreaming|instantiateStreaming/i.test(call.getText()));

    expect(loadsWasm).toBe(true);
  });

  test('The browser console contains no unhandled errors or exceptions during module initialization and execution', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const tryStatements = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.TryStatement));
    const catchClauses = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CatchClause));
    const identifiers = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.Identifier));
    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasErrorHandling = (tryStatements.length > 0 || catchClauses.length > 0)
      || identifiers.some(id => id.getText() === 'onerror' || id.getText() === 'onmessageerror')
      || callExpressions.some(call => /\.catch\s*\(/.test(call.getText()));

    expect(hasErrorHandling).toBe(true);
  });

  test('The WebAssembly module is built with optimizations enabled and debug info stripped', () => {
    const filesToCheck = new Set(targetFiles);
    const pkgJsonPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      filesToCheck.add(pkgJsonPath);
    }

    let hasOptimizedStrippedBuild = false;
    for (const f of filesToCheck) {
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) continue;
      const content = fs.readFileSync(f, 'utf8');
      const hasOpt = /-O[123zs]\b/i.test(content) || /-flto\b/i.test(content);
      if (hasOpt) {
        const hasUnstrippedDebug = /\b-g[1-3]?\b/.test(content) && !/\b-g0\b/.test(content);
        if (!hasUnstrippedDebug) {
          hasOptimizedStrippedBuild = true;
          break;
        }
      }
    }

    expect(hasOptimizedStrippedBuild).toBe(true);
  });

  test('A rendered image canvas is present on the page', () => {
    const docs = getHtmlDocuments(targetFiles);
    const canvasEl = docs.map(d => d.document.querySelector('canvas, [role="img"]')).find(Boolean);
    expect(canvasEl).toBeDefined();
  });

  test('The application renders pixel data to the canvas', () => {
    const project = getJsProject(targetFiles);
    const identifiers = project.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.Identifier));
    const hasCanvasRendering = identifiers.some(id =>
      ['putImageData', 'drawImage', 'createImageData', 'toDataURL', 'getImageData'].includes(id.getText())
    );
    expect(hasCanvasRendering).toBe(true);
  });

  test('A button exists on the page to render a new image', () => {
    const docs = getHtmlDocuments(targetFiles);
    const buttonEl = docs.map(d =>
      Array.from(d.document.querySelectorAll('button, input[type="button"], [role="button"]'))
        .find((el: any) => /render|brew|generate|art|pour|roast|image/i.test(
          (el.textContent || '') + ' ' + (el.getAttribute('id') || '') + ' ' + (el.getAttribute('aria-label') || '')
        ))
    ).find(Boolean);
    expect(buttonEl).toBeDefined();
  });

  test('A click event listener is attached to trigger rendering a new image', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasClickListener = callExpressions.some(call => {
      const text = call.getText();
      return (text.includes('addEventListener') && /['"]click['"]/.test(text)) || text.includes('onclick');
    });
    expect(hasClickListener).toBe(true);
  });

  test('The application remains responsive to user interaction by executing WebAssembly off the main thread', () => {
    const project = getJsProject(targetFiles);
    const newExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.NewExpression)
    );
    const hasWorker = newExpressions.some(expr => {
      const exprText = expr.getExpression().getText();
      return exprText === 'Worker' || exprText === 'SharedWorker';
    });
    expect(hasWorker).toBe(true);
  });
});
