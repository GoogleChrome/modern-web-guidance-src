import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

const currentFileUrl = pathToFileURL(path.resolve(process.cwd(), '..', 'daily-grind', 'grader.ts')).href;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

interface WasmBinaryInspection {
  isValidWasm: boolean;
  hasCodeSection: boolean;
  hasExportSection: boolean;
  hasDebugSections: boolean;
  hasUnstrippedNameSection: boolean;
}

function readUnsignedLeb128(buffer: Buffer, offset: number): { value: number; nextOffset: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buffer.length) {
    const byte = buffer[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }
  return { value: result >>> 0, nextOffset: pos };
}

function inspectWasmBinary(filePath: string): WasmBinaryInspection {
  const buf = fs.readFileSync(filePath);
  if (
    buf.length < 8 ||
    buf[0] !== 0x00 ||
    buf[1] !== 0x61 ||
    buf[2] !== 0x73 ||
    buf[3] !== 0x6d ||
    buf[4] !== 0x01 ||
    buf[5] !== 0x00 ||
    buf[6] !== 0x00 ||
    buf[7] !== 0x00
  ) {
    return {
      isValidWasm: false,
      hasCodeSection: false,
      hasExportSection: false,
      hasDebugSections: false,
      hasUnstrippedNameSection: false,
    };
  }

  let offset = 8;
  let hasCodeSection = false;
  let hasExportSection = false;
  let hasDebugSections = false;
  let hasUnstrippedNameSection = false;

  while (offset < buf.length) {
    const sectionId = buf[offset++];
    const { value: payloadLen, nextOffset } = readUnsignedLeb128(buf, offset);
    const sectionEnd = nextOffset + payloadLen;
    if (sectionEnd > buf.length) {
      break;
    }

    if (sectionId === 7) {
      hasExportSection = true;
    } else if (sectionId === 10) {
      hasCodeSection = true;
    } else if (sectionId === 0) {
      const nameLenInfo = readUnsignedLeb128(buf, nextOffset);
      const nameEnd = nameLenInfo.nextOffset + nameLenInfo.value;
      if (nameEnd <= sectionEnd) {
        const customSectionName = buf.subarray(nameLenInfo.nextOffset, nameEnd).toString('utf8');
        if (
          customSectionName.startsWith('.debug_') ||
          customSectionName === 'sourceMappingURL' ||
          customSectionName === 'external_debug_info'
        ) {
          hasDebugSections = true;
        }
        if (customSectionName === 'name') {
          hasUnstrippedNameSection = true;
        }
      }
    }

    offset = sectionEnd;
  }

  return {
    isValidWasm: true,
    hasCodeSection,
    hasExportSection,
    hasDebugSections,
    hasUnstrippedNameSection,
  };
}

function findWasmFiles(files: string[]): string[] {
  const wasmSet = new Set<string>();
  for (const file of files) {
    if (file.toLowerCase().endsWith('.wasm') && fs.existsSync(file)) {
      wasmSet.add(file);
    }
  }
  const cwd = process.cwd();
  if (fs.existsSync(cwd)) {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.wasm')) {
        wasmSet.add(path.resolve(cwd, entry.name));
      }
    }
  }
  return Array.from(wasmSet);
}

function hasOptimizationFlagsInCommand(cmd: string): boolean {
  const normalized = cmd.replaceAll('\n', ' ').replaceAll('\r', ' ').replaceAll('\t', ' ');
  const tokens = normalized
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
  const hasOptLevel = tokens.some(
    (t) =>
      t === '-O2' ||
      t === '-O3' ||
      t === '-Os' ||
      t === '-Oz' ||
      t === '-flto' ||
      t.includes('CMAKE_BUILD_TYPE=Release') ||
      t.includes('CMAKE_BUILD_TYPE=MinSizeRel')
  );
  const hasUnstrippedDebug = tokens.some(
    (t) => t === '-g' || t === '-g3' || t === '-g4' || t === '-gsource-map' || t === '-gseparate-dwarf'
  );
  const hasExplicitStrip = tokens.some(
    (t) => t === '-g0' || t === '--strip-debug' || t === '--strip-all' || t === '-s'
  );
  return hasOptLevel && (!hasUnstrippedDebug || hasExplicitStrip);
}

test.describe('cpp-on-the-web Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('The application loads a WebAssembly module', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasWasmAstUsage = sourceFiles.some((sf) => {
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      const usesWebAssemblyGlobal = identifiers.some((id) => id.getText() === 'WebAssembly');

      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const referencesWasmFile = stringLiterals.some((lit) =>
        lit.getLiteralValue().toLowerCase().endsWith('.wasm')
      );

      const imports = sf.getDescendantsOfKind(SyntaxKind.ImportDeclaration);
      const importsWasmOrEmscriptenModule = imports.some((imp) => {
        const spec = imp.getModuleSpecifierValue().toLowerCase();
        return (
          spec.includes('fractal') ||
          spec.includes('wasm') ||
          spec.includes('flame') ||
          spec.includes('module')
        );
      });

      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const callsWasmFactory = callExpressions.some((call) => {
        const exprText = call.getExpression().getText();
        return (
          exprText.includes('WebAssembly.instantiate') ||
          exprText.includes('WebAssembly.compile') ||
          exprText.includes('createFractalModule') ||
          exprText.includes('createModule') ||
          exprText.includes('Module')
        );
      });

      return (
        usesWebAssemblyGlobal ||
        referencesWasmFile ||
        (importsWasmOrEmscriptenModule && callsWasmFactory)
      );
    });

    expect(hasWasmAstUsage).toBe(true);
  });

  test('The WebAssembly module is built with optimizations enabled and debug info stripped', () => {
    const wasmFiles = findWasmFiles(targetFiles);
    const hasOptimizedStrippedWasmBinary = wasmFiles.some((wasmFile) => {
      const info = inspectWasmBinary(wasmFile);
      return (
        info.isValidWasm &&
        info.hasCodeSection &&
        info.hasExportSection &&
        !info.hasDebugSections &&
        !info.hasUnstrippedNameSection
      );
    });

    const hasOptimizedBuildScript = targetFiles.some((file) => {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
      const base = path.basename(file);
      if (base === 'package.json') {
        const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as {
          scripts?: Record<string, string>;
        };
        const scripts = Object.values(pkg.scripts ?? {});
        return scripts.some((s) => hasOptimizationFlagsInCommand(s));
      }
      if (
        base === 'Makefile' ||
        base === 'CMakeLists.txt' ||
        base === 'build.mjs' ||
        base.endsWith('.sh')
      ) {
        const content = fs.readFileSync(file, 'utf8');
        return hasOptimizationFlagsInCommand(content);
      }
      return false;
    });

    expect(hasOptimizedStrippedWasmBinary || hasOptimizedBuildScript).toBe(true);
  });

  test('A fractal flame image or canvas surface is defined in HTML or JavaScript', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasFractalElementInDom = docs.some((d) => {
      const canvas = d.document.querySelector('canvas');
      if (canvas) return true;
      const imgs = Array.from(d.document.querySelectorAll('img'));
      return imgs.some((img) => {
        const id = (img.getAttribute('id') ?? '').toLowerCase();
        const alt = (img.getAttribute('alt') ?? '').toLowerCase();
        const cls = (img.getAttribute('class') ?? '').toLowerCase();
        return (
          id.includes('fractal') ||
          id.includes('flame') ||
          alt.includes('fractal') ||
          alt.includes('flame') ||
          cls.includes('fractal') ||
          cls.includes('flame')
        );
      });
    });

    const project: Project = getJsProject(targetFiles);
    const hasFractalCanvasInJs = project.getSourceFiles().some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const exprText = call.getExpression().getText();
        const args = call.getArguments().map((a) => a.getText().toLowerCase());
        return (
          (exprText.endsWith('createElement') &&
            args.some((a) => a.includes('canvas') || a.includes('img'))) ||
          (exprText.endsWith('getContext') &&
            args.some((a) => a.includes('2d') || a.includes('webgl') || a.includes('bitmaprenderer'))) ||
          exprText.endsWith('putImageData')
        );
      });
    });

    expect(hasFractalElementInDom || hasFractalCanvasInJs).toBe(true);
  });

  test('A button exists on the page to generate a new image', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);
    const hasCssRules = stylesheet.cssRules.length > 0;

    const hasButtonInDom = docs.some((d) => {
      const buttons = Array.from(
        d.document.querySelectorAll('button, input[type="button"], [role="button"]')
      );
      return buttons.some((btn) => {
        const text = (btn.textContent ?? '').toLowerCase();
        const id = (btn.getAttribute('id') ?? '').toLowerCase();
        const cls = (btn.getAttribute('class') ?? '').toLowerCase();
        const val = (btn.getAttribute('value') ?? '').toLowerCase();
        const label = (btn.getAttribute('aria-label') ?? '').toLowerCase();
        const combined = `${text} ${id} ${cls} ${val} ${label}`;
        return (
          combined.includes('generate') ||
          combined.includes('new') ||
          combined.includes('fractal') ||
          combined.includes('flame') ||
          combined.includes('render') ||
          combined.includes('roast')
        );
      });
    });

    const project: Project = getJsProject(targetFiles);
    const hasClickHandlerInJs = project.getSourceFiles().some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const exprText = call.getExpression().getText();
        const firstArg = call.getArguments()[0]?.getText().toLowerCase() ?? '';
        return (
          (exprText.endsWith('addEventListener') && firstArg.includes('click')) ||
          (exprText.endsWith('createElement') && firstArg.includes('button'))
        );
      });
    });

    expect(hasCssRules && (hasButtonInDom || hasClickHandlerInJs)).toBe(true);
  });

  test('JavaScript AST offloads fractal generation to a Web Worker or non-blocking schedule', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasNonBlockingAst = sourceFiles.some((sf) => {
      const newExpressions = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
      const createsWorker = newExpressions.some((ne) => {
        const expr = ne.getExpression().getText();
        return expr === 'Worker' || expr.endsWith('.Worker');
      });

      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const usesWorkerMessagingOrAsyncSlice = callExpressions.some((call) => {
        const expr = call.getExpression().getText();
        return (
          expr.endsWith('postMessage') ||
          expr.includes('requestIdleCallback') ||
          expr.includes('requestAnimationFrame') ||
          expr.includes('setTimeout')
        );
      });

      return createsWorker || usesWorkerMessagingOrAsyncSlice;
    });

    expect(hasNonBlockingAst).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    const consoleErrors: string[] = [];
    const pageExceptions: string[] = [];
    const wasmNetworkUrls: string[] = [];

    test.beforeEach(async ({ page, TARGET_URL }) => {
      consoleErrors.length = 0;
      pageExceptions.length = 0;
      wasmNetworkUrls.length = 0;

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon.ico')) {
            consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', (err) => {
        pageExceptions.push(err.message);
      });

      page.on('response', (res) => {
        const url = res.url().toLowerCase();
        const contentType = (res.headers()['content-type'] ?? '').toLowerCase();
        if (url.endsWith('.wasm') || contentType.includes('application/wasm')) {
          wasmNetworkUrls.push(res.url());
        }
      });

      await page.addInitScript(() => {
        const win = window as unknown as Record<string, unknown>;
        win.__wasmInstantiated = false;
        win.__workerSpawned = false;

        const wasmObj = WebAssembly as unknown as Record<string, unknown>;
        const origInstantiate = wasmObj.instantiate as (...a: unknown[]) => Promise<unknown>;
        wasmObj.instantiate = function (...args: unknown[]) {
          win.__wasmInstantiated = true;
          return origInstantiate.apply(WebAssembly, args);
        };

        if (typeof wasmObj.instantiateStreaming === 'function') {
          const origStreaming = wasmObj.instantiateStreaming as (
            ...a: unknown[]
          ) => Promise<unknown>;
          wasmObj.instantiateStreaming = function (...args: unknown[]) {
            win.__wasmInstantiated = true;
            return origStreaming.apply(WebAssembly, args);
          };
        }

        const OrigWorker = window.Worker;
        const WrappedWorker = function (
          this: Worker,
          scriptURL: string | URL,
          options?: WorkerOptions
        ) {
          win.__workerSpawned = true;
          return new OrigWorker(scriptURL, options);
        } as unknown as typeof Worker;
        WrappedWorker.prototype = OrigWorker.prototype;
        window.Worker = WrappedWorker;
      });

      await page.goto(TARGET_URL);
    });

    test('The browser console contains no unhandled errors or exceptions during module initialization and execution', async ({
      page,
    }) => {
      const runtimeErrors = [...consoleErrors, ...pageExceptions];
      const wasmAndExecutionCheck = await page.evaluate(async () => {
        const keywords = ['generate', 'new', 'fractal', 'flame', 'render', 'roast'];
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>('button, input[type="button"], [role="button"]')
        );
        const btn =
          buttons.find((b) => {
            const label =
              `${b.textContent ?? ''} ${b.id} ${b.className} ${b.getAttribute('aria-label') ?? ''}`.toLowerCase();
            return keywords.some((kw) => label.includes(kw));
          }) ??
          buttons[0] ??
          null;

        if (!btn) return { executed: false };
        btn.click();
        await new Promise((r) => setTimeout(r, 350));

        const win = window as unknown as Record<string, unknown>;
        const hasSurface = Boolean(
          document.querySelector('canvas, img[id*="fractal"], img[alt*="Fractal"], img[alt*="flame"]')
        );
        const hasWasmOrWorker = Boolean(
          win.__wasmInstantiated || win.__workerSpawned || win.fractalWasmModule || win.Module
        );
        return { executed: hasSurface && hasWasmOrWorker };
      });

      const issues =
        wasmAndExecutionCheck.executed || wasmNetworkUrls.length > 0
          ? runtimeErrors
          : ['WebAssembly module was not initialized or executed'];

      expect(issues).toEqual([]);
    });

    test('A fractal flame image is present on the page', async ({ page }) => {
      await expect
        .poll(
          async () => {
            return page.evaluate(() => {
              const inspectPixels = (data: Uint8ClampedArray): boolean => {
                if (data.length < 16) return false;
                const uniqueColors = new Set<number>();
                let nonZeroPixels = 0;
                const step = Math.max(4, Math.floor(data.length / 4000) * 4);
                for (let i = 0; i < data.length - 3; i += step) {
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];
                  const a = data[i + 3];
                  if (a > 0 && (r > 0 || g > 0 || b > 0)) {
                    nonZeroPixels++;
                    uniqueColors.add(((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2));
                  }
                }
                return nonZeroPixels > 20 && uniqueColors.size >= 4;
              };

              const canvases = Array.from(document.querySelectorAll('canvas'));
              for (const canvas of canvases) {
                const rect = canvas.getBoundingClientRect();
                if (
                  rect.width <= 0 ||
                  rect.height <= 0 ||
                  canvas.width <= 0 ||
                  canvas.height <= 0
                ) {
                  continue;
                }
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const imgData = ctx.getImageData(
                    0,
                    0,
                    Math.min(canvas.width, 256),
                    Math.min(canvas.height, 256)
                  );
                  if (inspectPixels(imgData.data)) {
                    return true;
                  }
                }
              }

              const imgs = Array.from(document.querySelectorAll('img'));
              for (const img of imgs) {
                const rect = img.getBoundingClientRect();
                if (
                  rect.width <= 0 ||
                  rect.height <= 0 ||
                  !img.complete ||
                  img.naturalWidth <= 0
                ) {
                  continue;
                }
                const offscreen = document.createElement('canvas');
                offscreen.width = Math.min(img.naturalWidth, 128);
                offscreen.height = Math.min(img.naturalHeight, 128);
                const offCtx = offscreen.getContext('2d');
                if (offCtx) {
                  offCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
                  const imgData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
                  if (inspectPixels(imgData.data)) {
                    return true;
                  }
                }
              }

              return false;
            });
          },
          { timeout: 10000 }
        )
        .toBe(true);
    });

    test('Clicking the button on the page generates a new fractal flame image', async ({
      page,
    }) => {
      const getFractalSignature = async (): Promise<string | null> => {
        return page.evaluate(() => {
          const canvas = document.querySelector('canvas');
          if (canvas && canvas.width > 0 && canvas.height > 0) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let hash1 = 2166136261;
              let hash2 = 0;
              let nonBlack = 0;
              const step = Math.max(4, Math.floor(data.length / 8000) * 4);
              for (let i = 0; i < data.length - 3; i += step) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                if (r + g + b > 30) nonBlack++;
                hash1 = Math.imul(hash1 ^ r, 16777619);
                hash1 = Math.imul(hash1 ^ g, 16777619);
                hash1 = Math.imul(hash1 ^ b, 16777619);
                hash2 = (hash2 + r * 3 + g * 5 + b * 7) | 0;
              }
              if (nonBlack > 10) {
                return `canvas:${hash1 >>> 0}:${hash2}:${canvas.dataset.seed ?? ''}`;
              }
            }
          }

          const img = document.querySelector<HTMLImageElement>(
            'img[id*="fractal"], img[alt*="Fractal"], img[alt*="flame"], main img'
          );
          if (img && img.complete && img.naturalWidth > 0) {
            return `img:${img.src}`;
          }
          return null;
        });
      };

      let initialSig: string | null = null;
      for (let i = 0; i < 30; i++) {
        initialSig = await getFractalSignature();
        if (initialSig) break;
        await page.waitForTimeout(200);
      }

      const clicked = await page.evaluate(() => {
        const keywords = ['generate', 'new', 'fractal', 'flame', 'render', 'roast'];
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>('button, input[type="button"], [role="button"]')
        );
        const targetBtn =
          buttons.find((b) => {
            const label =
              `${b.textContent ?? ''} ${b.id} ${b.className} ${b.getAttribute('aria-label') ?? ''}`.toLowerCase();
            return keywords.some((kw) => label.includes(kw));
          }) ?? buttons[0];
        if (!targetBtn) return false;
        targetBtn.click();
        return true;
      });

      await expect
        .poll(
          async () => {
            if (!initialSig || !clicked) return false;
            const nextSig = await getFractalSignature();
            return Boolean(nextSig && nextSig !== initialSig);
          },
          { timeout: 10000 }
        )
        .toBe(true);
    });

    test('The application remains responsive to user interaction while the image is being generated', async ({
      page,
    }) => {
      const responsivenessResult = await page.evaluate(async () => {
        const keywords = ['generate', 'new', 'fractal', 'flame', 'render', 'roast'];
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>('button, input[type="button"], [role="button"]')
        );
        const generateBtn =
          buttons.find((b) => {
            const label =
              `${b.textContent ?? ''} ${b.id} ${b.className} ${b.getAttribute('aria-label') ?? ''}`.toLowerCase();
            return keywords.some((kw) => label.includes(kw));
          }) ?? buttons[0];

        if (!generateBtn) {
          return { responsive: false };
        }

        let interactionHandled = false;
        const probeHandler = () => {
          interactionHandled = true;
        };
        generateBtn.addEventListener('pointerenter', probeHandler, { once: true });
        generateBtn.addEventListener('mouseenter', probeHandler, { once: true });

        const clickStart = performance.now();
        generateBtn.click();
        const synchronousClickDurationMs = performance.now() - clickStart;

        generateBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        generateBtn.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));

        const timerStart = performance.now();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const eventLoopTurnLatencyMs = performance.now() - timerStart;

        return {
          responsive:
            interactionHandled &&
            synchronousClickDurationMs < 250 &&
            eventLoopTurnLatencyMs < 250,
        };
      });

      expect(responsivenessResult.responsive).toBe(true);
    });
  });
});
