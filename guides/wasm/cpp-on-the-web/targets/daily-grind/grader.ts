import * as fs from 'node:fs';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Daily Grind WebAssembly Grader', () => {
  // --- STATIC ASSERTIONS ---

  test('The application loads the WebAssembly module as an ES6 module', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasEs6Import = sourceFiles.some(sf => {
      const importDecls = sf.getDescendantsOfKind(SyntaxKind.ImportDeclaration);
      const dynamicImports = sf.getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter(call => call.getExpression().getKind() === SyntaxKind.ImportKeyword);

      const hasStatic = importDecls.some(decl =>
        /(\.mjs\b|\bfilter\b|\bwasm\b)/i.test(decl.getModuleSpecifierValue())
      );
      const hasDynamic = dynamicImports.some(call =>
        /(\.mjs\b|\bfilter\b|\bwasm\b)/i.test(call.getArguments()[0]?.getText() || '')
      );
      return hasStatic || hasDynamic;
    });

    const hasExportDefaultInWasmModule = targetFiles.some(file => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      if (!/\.mjs$/i.test(file)) return false;
      const content = fs.readFileSync(file, 'utf8');
      return /export\s+default\b/.test(content);
    });

    expect(hasEs6Import || hasExportDefaultInWasmModule).toBe(true);
  });

  test('The WebAssembly module is built with optimizations enabled and debug info stripped', () => {
    const buildFiles = targetFiles.filter(f =>
      /(package\.json|makefile|build\.(sh|bash)|cmakelists\.txt)$/i.test(f)
    );
    const hasOptimizationFlags = buildFiles.some(file => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const content = fs.readFileSync(file, 'utf8');
      return /-O[23zs]|-flto|\bRelease\b/i.test(content);
    });

    expect(hasOptimizationFlags).toBe(true);
  });

  test('The C++ image filter function is exposed and callable via Embind', () => {
    const cppFiles = targetFiles.filter(f => /\.(cpp|cc|cxx|c|h|hpp)$/i.test(f));
    const hasEmbindBinding = cppFiles.some(file => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const content = fs.readFileSync(file, 'utf8');
      return (
        (/EMSCRIPTEN_BINDINGS\s*\(/.test(content) || /#include\s*<emscripten\/bind\.h>/.test(content)) &&
        /function\s*\(/.test(content)
      );
    });

    expect(hasEmbindBinding).toBe(true);
  });

  test('Applying the filter modifies the image or canvas pixels in the DOM', () => {
    const htmlDocs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasCanvas = htmlDocs.some(doc => doc.document.querySelector('canvas') !== null);
    const project: Project = getJsProject(targetFiles);
    const hasCanvasPixelUpdate = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      return /getImageData\s*\(/.test(text) && /putImageData\s*\(/.test(text);
    });

    expect(hasCanvas && hasCanvasPixelUpdate).toBe(true);
  });

  test('The WebAssembly memory buffer used for pixel data is freed after processing', () => {
    const project: Project = getJsProject(targetFiles);
    const hasMemoryManagement = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      return /_?malloc\s*\(/.test(text) && /_?free\s*\(/.test(text);
    });

    expect(hasMemoryManagement).toBe(true);
  });

  test('The browser console contains no unhandled errors or exceptions during module initialization and filter execution', () => {
    const project: Project = getJsProject(targetFiles);
    const hasErrorHandling = project.getSourceFiles().some(sf => {
      const tryStatements = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      const hasWasmTryCatch = tryStatements.some(ts =>
        /(createModule|wasm|filter|module)/i.test(ts.getTryBlock().getText())
      );
      const hasPromiseCatch = /\.catch\s*\(/.test(sf.getText());
      return hasWasmTryCatch || hasPromiseCatch;
    });

    expect(hasErrorHandling).toBe(true);
  });
});
