import fs from 'node:fs';
import path from 'node:path';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type SourceFile } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function isEmscriptenGlueText(text: string): boolean {
  return (
    text.includes('WebAssembly.instantiate') &&
    (text.includes('_emscripten_') || text.includes('updateMemoryViews') || text.includes('wasmExports'))
  );
}

function isEmscriptenGlueFile(sf: SourceFile): boolean {
  return isEmscriptenGlueText(sf.getFullText());
}

function getEmscriptenBuildContents(files: string[]): string[] {
  const candidates = new Set<string>(files);
  const rootPkg = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(rootPkg)) {
    candidates.add(rootPkg);
  }

  const results: string[] = [];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) continue;
    // Exclude C/C++ source/header files, docs, and markup/styles so comments in smallpt.cpp or README do not match.
    if (/\.(?:[ch]|cc|cpp|cxx|hpp|hxx|md|txt|html|astro|css|svg|png|wasm)$/i.test(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (isEmscriptenGlueText(content)) continue;
    if (/\bem(?:cc|\+\+|cmake|make)(?:[\s'"]|$)/m.test(content)) {
      results.push(content);
    }
  }
  return results;
}

function getUserSourceFiles(files: string[]): SourceFile[] {
  const project = getJsProject(files);
  for (const filePath of files) {
    if (filePath.endsWith('.mjs') && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      project.createSourceFile(filePath, fs.readFileSync(filePath, 'utf8'), { overwrite: true });
    }
  }
  return project.getSourceFiles().filter((sf) => !isEmscriptenGlueFile(sf));
}

test.describe('devtools-times cpp-on-the-web Target Grader', () => {
  test('The application loads an ES6 WebAssembly module built with -sEXPORT_ES6 and -sSTRICT', () => {
    const buildContents = getEmscriptenBuildContents(targetFiles);
    const hasEs6AndStrictFlags = buildContents.some(
      (content) => /-s\s*EXPORT_ES6\b/.test(content) && /-s\s*STRICT\b/.test(content),
    );

    const hasCppSource = targetFiles.some(
      (filePath) => /\.(?:c|cc|cpp|cxx)$/i.test(filePath) && fs.existsSync(filePath),
    );

    const userFiles = getUserSourceFiles(targetFiles);
    const importsOrLoadsModule = userFiles.some((sf) => {
      const hasImport = sf.getImportDeclarations().length > 0;
      const hasDynamicImport = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => call.getExpression().getKind() === SyntaxKind.ImportKeyword);
      return hasImport || hasDynamicImport;
    });

    const glueFiles = targetFiles.filter(
      (filePath) =>
        /\.(?:m?js)$/i.test(filePath) &&
        fs.existsSync(filePath) &&
        !fs.statSync(filePath).isDirectory() &&
        isEmscriptenGlueText(fs.readFileSync(filePath, 'utf8')),
    );
    const glueUsesEs6Export =
      glueFiles.length === 0 ||
      glueFiles.some((filePath) => /\bexport\s+default\b/.test(fs.readFileSync(filePath, 'utf8')));

    expect(hasEs6AndStrictFlags && hasCppSource && importsOrLoadsModule && glueUsesEs6Export).toBe(true);
  });

  test('The Emscripten build targets only browser or worker environments (-sENVIRONMENT=web or worker)', () => {
    const buildContents = getEmscriptenBuildContents(targetFiles);
    const validEnvironment = buildContents.some((content) => {
      const match = /-s\s*ENVIRONMENT=['"]?([a-z,]+)['"]?/i.exec(content);
      if (!match) return false;
      const envs = match[1]
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return envs.length > 0 && envs.every((env) => env === 'web' || env === 'worker');
    });

    expect(validEnvironment).toBe(true);
  });

  test('The Emscripten build uses release optimizations (-O2, -O3, -Os, or -Oz) with -flto and no -g debug flags', () => {
    const buildContents = getEmscriptenBuildContents(targetFiles);
    const hasReleaseOptWithLto = buildContents
      .flatMap((c) => [c, ...c.replace(/\\\r?\n/g, ' ').split(/\r?\n/)])
      .some((content) => {
        const hasOpt = /(?:^|[\s'"])-O(?:2|3|s|z)\b/.test(content);
        const hasLto = /(?:^|[\s'"])-flto\b/.test(content);
        const hasDebugFlag = /(?:^|[\s'"])-g(?:1|2|3|source-map|line-tables-only)?(?=[\s'"\\]|$)/.test(content);
        const hasAssertions = /-s\s*ASSERTIONS(?!=0)\b/.test(content);
        return hasOpt && hasLto && !hasDebugFlag && !hasAssertions;
      });

    expect(hasReleaseOptWithLto).toBe(true);
  });

  test('The Emscripten command line omits =1 on boolean -s flags, uses comma-separated lists instead of JSON arrays, and omits redundant defaults (-sWASM, -sMODULARIZE)', () => {
    const buildContents = getEmscriptenBuildContents(targetFiles);
    const followsCliStyle =
      buildContents.length > 0 &&
      buildContents.every((content) => {
        const hasBooleanEqualsOne =
          /-s\s*(?:STRICT|EXPORT_ES6|ALLOW_MEMORY_GROWTH|MODULARIZE|WASM|ASSERTIONS|ASYNCIFY|JSPI|SAFE_HEAP|EXIT_RUNTIME|SINGLE_FILE|MAIN_MODULE|SIDE_MODULE)=1\b/.test(
            content,
          );
        const hasJsonBracketList = /-s\s*[A-Z0-9_]+=\s*['"]?\s*\[/.test(content);
        const hasRedundantWasm = /-s\s*WASM\b/.test(content);
        const hasRedundantModularize =
          /-s\s*EXPORT_ES6\b/.test(content) && /-s\s*MODULARIZE\b/.test(content);
        return (
          !hasBooleanEqualsOne &&
          !hasJsonBracketList &&
          !hasRedundantWasm &&
          !hasRedundantModularize
        );
      });

    expect(followsCliStyle).toBe(true);
  });

  test('JavaScript exchanges pixel data with WebAssembly via linear memory buffers rather than per-pixel boundary calls', () => {
    const userFiles = getUserSourceFiles(targetFiles);

    const accessesLinearMemoryBuffer = userFiles.some((sf) => {
      const text = sf.getFullText();
      return (
        /\bHEAP(?:U8|U16|U32|8|16|32|F32|F64)\b/.test(text) ||
        /\bUint8ClampedArray\b/.test(text)
      );
    });

    const rendersFullImageBuffer = userFiles.some((sf) => {
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier).map((id) => id.getText());
      return identifiers.some((name) =>
        ['ImageData', 'putImageData', 'createImageData', 'createImageBitmap'].includes(name),
      );
    });

    expect(accessesLinearMemoryBuffer && rendersFullImageBuffer).toBe(true);
  });

  test('The WebAssembly rendering runs off the main thread in a Web Worker so the UI remains responsive', () => {
    const userFiles = getUserSourceFiles(targetFiles);

    const instantiatesWorker = userFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.NewExpression)
        .some((ne) => ['Worker', 'SharedWorker'].includes(ne.getExpression().getText())),
    );

    const usesWorkerMessaging = userFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => ['postMessage', 'onmessage'].includes(id.getText())),
    );

    expect(instantiatesWorker && usesWorkerMessaging).toBe(true);
  });

  test('The page displays the rendered output on a canvas with a button that triggers a new render', () => {
    const docs = getHtmlDocuments(targetFiles);
    const userFiles = getUserSourceFiles(targetFiles);

    const jsxElements = [
      ...userFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)),
      ...userFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)),
    ];

    const hasCanvas =
      docs.some((d) => Boolean(d.document.querySelector('canvas'))) ||
      jsxElements.some((el) => el.getTagNameNode().getText() === 'canvas');

    const hasHtmlRenderButton = docs.some((d) => {
      const buttons = Array.from(
        d.document.querySelectorAll('button, input[type="button"], [role="button"]'),
      );
      return buttons.some((el: any) => {
        const text = [
          el.textContent || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
        ].join(' ');
        return /render|generate|trace|random|color|scene|new|start/i.test(text);
      });
    });

    const hasJsxRenderButton = jsxElements
      .filter((el) => el.getTagNameNode().getText() === 'button')
      .some((el) => {
        const text = (el.getParent()?.getText() || el.getText());
        return /render|generate|trace|random|color|scene|new|start/i.test(text);
      });

    const hasClickHandler =
      userFiles.some((sf) =>
        sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
          const text = call.getText();
          return (
            (text.includes('addEventListener') && /['"]click['"]/.test(text)) ||
            text.includes('onclick')
          );
        }),
      ) ||
      userFiles.some((sf) =>
        sf
          .getDescendantsOfKind(SyntaxKind.JsxAttribute)
          .some((attr) => attr.getNameNode().getText() === 'onClick'),
      );

    expect(hasCanvas && (hasHtmlRenderButton || hasJsxRenderButton) && hasClickHandler).toBe(true);
  });

  test('The browser console contains no unhandled errors or exceptions during module initialization and execution', () => {
    const userFiles = getUserSourceFiles(targetFiles);

    const hasUserErrorHandling = userFiles.some((sf) => {
      const text = sf.getFullText();
      const isWasmOrWorkerRelated =
        /worker|wasm|smallpt|render|tracer/i.test(sf.getFilePath()) ||
        /\b(?:Worker|WebAssembly|HEAPU8|smallpt|postMessage|onmessage)\b/.test(text);
      if (!isWasmOrWorkerRelated) return false;

      const hasTryCatch = sf.getDescendantsOfKind(SyntaxKind.TryStatement).length > 0;
      const hasPromiseCatch = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => /\.catch\s*\(/.test(call.getText()));
      const hasErrorListener = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => ['onerror', 'onmessageerror'].includes(id.getText()));
      const hasAddErrorListener = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          const callText = call.getText();
          return callText.includes('addEventListener') && /['"]error['"]/.test(callText);
        });
      return hasTryCatch || hasPromiseCatch || hasErrorListener || hasAddErrorListener;
    });

    expect(hasUserErrorHandling).toBe(true);
  });
});
