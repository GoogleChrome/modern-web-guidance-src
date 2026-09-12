import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import * as fs from 'fs';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('devtools-times Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  // Requirement 1: The application loads the WebAssembly module as an ES6 module.
  test('WebAssembly module wrapper is structured and exported as an ES6 module', () => {
    const isWasmEs6Module = targetFiles.some(file => {
      if (!/\.(js|mjs|ts)$/i.test(file)) return false;
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const content = fs.readFileSync(file, 'utf8');
      const hasEs6Export = /\bexport\s+(default\s+|const\s+|function\s+|\{)/.test(content);
      const hasWasm = /\b(WebAssembly|wasmExports|wasmBinary|createWasm|_malloc|Module)\b/.test(content);
      return hasEs6Export && hasWasm;
    });
    expect(isWasmEs6Module).toBe(true);
  });

  test('Application scripts import and initialize the WebAssembly module via ES6 import', () => {
    const project = getJsProject(targetFiles);
    const hasWasmImport = project.getSourceFiles().some(sf => {
      const importDecls = sf.getImportDeclarations();
      const hasStaticWasmImport = importDecls.some(imp => {
        const spec = imp.getModuleSpecifierValue().toLowerCase();
        return spec.includes('wasm') || spec.includes('filter') || spec.includes('.mjs');
      });
      if (hasStaticWasmImport) return true;

      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExpressions.some(call => {
        const expr = call.getExpression();
        if (expr.getKind() === SyntaxKind.ImportKeyword) {
          const args = call.getArguments();
          if (args.length > 0) {
            const text = args[0].getText().toLowerCase();
            return text.includes('wasm') || text.includes('filter') || text.includes('module') || text.includes('.js') || text.includes('.mjs') || text.includes('path');
          }
          return true;
        }
        return false;
      });
    });
    expect(hasWasmImport).toBe(true);
  });

  // Requirement 2: The WebAssembly module is built with optimizations enabled and debug info stripped.
  test('WebAssembly binary file is present with valid Wasm header', () => {
    const wasmFiles = targetFiles.filter(f => f.endsWith('.wasm'));
    const hasValidWasm = wasmFiles.some(file => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const buf = fs.readFileSync(file);
      return buf.length >= 8 && buf[0] === 0x00 && buf[1] === 0x61 && buf[2] === 0x73 && buf[3] === 0x6d;
    });
    expect(hasValidWasm).toBe(true);
  });

  test('WebAssembly binary has optimizations enabled with debug info stripped', () => {
    const wasmFiles = targetFiles.filter(f => f.endsWith('.wasm'));
    const isOptimizedAndStripped = wasmFiles.length > 0 && wasmFiles.every(file => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const buf = fs.readFileSync(file);
      if (buf.length < 8) return false;
      if (buf[0] !== 0x00 || buf[1] !== 0x61 || buf[2] !== 0x73 || buf[3] !== 0x6d) return false;
      const content = buf.toString('latin1');
      const hasDebugSections = content.includes('.debug_info') || content.includes('.debug_line') || content.includes('.debug_str') || content.includes('.debug_abbrev');
      return !hasDebugSections;
    });
    expect(isOptimizedAndStripped).toBe(true);
  });

  // Requirement 3: The C++ image filter function is exposed and callable via Embind.
  test('C++ source code exposes the image filter function via Embind', () => {
    const cppFiles = targetFiles.filter(f => /\.(cpp|cc|cxx|c|h|hpp)$/i.test(f));
    const hasEmbindInCpp = cppFiles.some(file => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const content = fs.readFileSync(file, 'utf8');
      const hasEmbind = /#include\s*<emscripten\/bind\.h>/.test(content) || /\bEMSCRIPTEN_BINDINGS\b/.test(content);
      const hasFunctionBinding = /emscripten::function\s*\(/.test(content);
      return hasEmbind && hasFunctionBinding;
    });
    expect(hasEmbindInCpp).toBe(true);
  });

  test('Client JavaScript code invokes the Embind-exposed image filter function', () => {
    const project = getJsProject(targetFiles);
    const hasFilterCall = project.getSourceFiles().some(sf => {
      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExpressions.some(call => {
        const exprText = call.getExpression().getText();
        return /\b(applyImageFilter|filterImage|processImage|applyFilter|filterCanvas)\b/i.test(exprText);
      });
    });
    expect(hasFilterCall).toBe(true);
  });

  // Requirement 4: Applying the filter modifies the image or canvas pixels in the DOM.
  test('Article template includes an image element and a filter trigger control', () => {
    const htmlDocs = getHtmlDocuments(targetFiles);
    const hasFilterUi = htmlDocs.some(({ document }) => {
      const hasImage = !!document.querySelector('img, Image, figure, #article-main-image');
      const buttons = Array.from(document.querySelectorAll('button'));
      const hasFilterBtn = buttons.some((btn: any) => {
        const id = btn.getAttribute('id') || '';
        const text = btn.textContent || '';
        const className = btn.getAttribute('class') || '';
        return /\b(apply-filter|filter|sepia|wasm)\b/i.test(id) ||
               /filter|sepia|wasm/i.test(text) ||
               /filter|sepia/i.test(className);
      });
      return hasImage && hasFilterBtn;
    });
    expect(hasFilterUi).toBe(true);
  });

  test('Client script processes and updates image pixel data using Canvas 2D APIs', () => {
    const project = getJsProject(targetFiles);
    const hasPixelPipeline = project.getSourceFiles().some(sf => {
      const text = sf.getFullText();
      const hasGetImageData = /\bgetImageData\b/.test(text);
      const hasPutOrSetData = /\b(putImageData|replaceChild|drawImage)\b/.test(text);
      return hasGetImageData && hasPutOrSetData;
    });
    expect(hasPixelPipeline).toBe(true);
  });

  // Requirement 5: The WebAssembly memory buffer used for pixel data is freed after processing.
  test('Client script allocates WebAssembly linear memory buffer for pixel data', () => {
    const project = getJsProject(targetFiles);
    const hasMallocCall = project.getSourceFiles().some(sf => {
      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExpressions.some(call => {
        const text = call.getExpression().getText();
        return /\b_malloc\b/.test(text) || /\bmalloc\b/.test(text);
      });
    });
    expect(hasMallocCall).toBe(true);
  });

  test('Client script frees the WebAssembly linear memory buffer after processing', () => {
    const project = getJsProject(targetFiles);
    const hasFreeCall = project.getSourceFiles().some(sf => {
      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExpressions.some(call => {
        const text = call.getExpression().getText();
        return /\b_free\b/.test(text) || /\bfree\b/.test(text);
      });
    });
    expect(hasFreeCall).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {

    test('Applying the filter modifies the image or canvas in the DOM', async ({ page, TARGET_URL }) => {
      await page.goto(`${TARGET_URL}articles/breakthrough-research`);
      const filterBtn = page.locator('#apply-filter-btn, button:has-text("Filter"), button:has-text("Sepia"), button:has-text("Wasm")').first();
      await filterBtn.click({ timeout: 5000 });

      const modifiedElement = page.locator('article figure canvas, article canvas, #article-main-image-canvas, article figure img[src^="data:"], p:has-text("Sepia filter applied"), p:has-text("Filter Applied"), button:has-text("Filter Applied")').first();
      await expect(modifiedElement).toBeVisible({ timeout: 10000 });
    });

    // Requirement 6: The browser console contains no unhandled errors or exceptions during module initialization and filter execution.
    test('Browser console contains no unhandled errors during module initialization and filter execution', async ({ page, TARGET_URL }) => {
      const errors: string[] = [];
      page.on('pageerror', error => {
        errors.push(error.message);
      });
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(`${TARGET_URL}articles/breakthrough-research`);
      const filterBtn = page.locator('#apply-filter-btn, button:has-text("Filter"), button:has-text("Sepia"), button:has-text("Wasm")').first();
      await filterBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1000);

      expect(errors).toEqual([]);
    });
  });
});
