import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFileRaw = process.env.TARGET_FILE || 'demo.html';
const targetFile = path.isAbsolute(targetFileRaw) ? targetFileRaw : path.resolve(process.cwd(), targetFileRaw);
const targetDir = path.dirname(targetFile);
const targetFileName = path.basename(targetFile);
const targetUrl = `http://localhost/${targetFileName}`;

function getAllScriptContent(): string {
  const isDemoTarget = targetFileName === 'demo.html' || targetFileName === 'negative-demo.html';
  const html = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf-8') : '';
  const files: string[] = [targetFile];
  if (isDemoTarget) {
    const srcMatches = html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi);
    for (const match of srcMatches) {
      const src = match[1];
      if (!/^https?:\/\//i.test(src) && !src.startsWith('//')) {
        const resolved = path.resolve(targetDir, src.replace(/^\/+/, ''));
        if (resolved.startsWith(targetDir + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          files.push(resolved);
        }
      }
    }
  } else {
    const excludedDirs = new Set(['node_modules', 'vendor', 'test', 'tests', 'grade-report', 'test-results', 'dist', '.git']);
    const walk = (dir: string) => {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!excludedDirs.has(entry.name)) walk(fullPath);
          } else if (
            entry.isFile() &&
            (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
            !entry.name.includes('.test.') &&
            !entry.name.includes('.spec.') &&
            !entry.name.includes('.config.') &&
            entry.name !== 'grade.mjs' &&
            entry.name !== 'run.mjs'
          ) {
            files.push(fullPath);
          }
        }
      } catch {}
    };
    walk(targetDir);
  }
  return [...new Set(files)].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf-8')).join('\n');
}

declare global {
  interface Window {
    __renderCalls: Array<{
      method: string;
      arguments?: any[];
      insideOnpaint: boolean;
    }>;
    __onpaintCalled: boolean;
    __onpaintActive: boolean;
    __resizeObserverObserved: Array<{
      targetTagName: string | null;
      targetId: string | null;
      containsCanvas: boolean;
      options: any;
    }>;
    __drawnElements: HTMLElement[];
    __paintErrors: string[];
    __geometryCalls: Array<{
      hasCanvasTransform: boolean;
    }>;
  }
  interface HTMLCanvasElement {
    onpaint?: (event?: any) => void;
    requestPaint?: () => void;
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost/**', async (route) => {
    const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
    const relPath = requestPath === '/' ? targetFileName : requestPath.replace(/^\/+/, '');
    const localFilePath = path.resolve(targetDir, relPath);
    if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
      await route.fulfill({ path: localFilePath });
    } else {
      await route.continue();
    }
  });

  // Add the HTML-in-Canvas API polyfills and spy hooks before loading the page
  await page.addInitScript(() => {
    // Spies & trackers
    window.__renderCalls = [];
    window.__onpaintCalled = false;
    window.__onpaintActive = false;
    window.__resizeObserverObserved = [];
    window.__drawnElements = [];
    window.__paintErrors = [];
    window.__geometryCalls = [];

    const onpaintMap = new WeakMap<HTMLCanvasElement, any>();
    
    Object.defineProperty(HTMLCanvasElement.prototype, 'onpaint', {
      get() {
        return onpaintMap.get(this);
      },
      set(fn) {
        if (typeof fn === 'function') {
          window.__onpaintCalled = true;
          const wrappedFn = function(this: HTMLCanvasElement, ...args: any[]) {
            window.__onpaintActive = true;
            try {
              return fn.apply(this, args);
            } finally {
              window.__onpaintActive = false;
            }
          };
          onpaintMap.set(this, wrappedFn);
        } else {
          onpaintMap.set(this, fn);
        }
      },
      configurable: true,
    });

    const origAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
      if (this instanceof HTMLCanvasElement && (type === 'paint' || type === 'onpaint')) {
        window.__onpaintCalled = true;
        onpaintMap.set(this, listener);
      }
      return origAddEventListener.call(this, type, listener, options);
    };

    // Mock HTMLCanvasElement.prototype.content, which pages use to detect HTML-in-Canvas
    if (!('content' in HTMLCanvasElement.prototype)) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'content', {
        configurable: true,
        enumerable: true,
        get() {
          return this.getAttribute('content')?.toLowerCase() === 'drawable' ? 'drawable' : 'fallback';
        },
        set(value) {
          this.setAttribute('content', String(value));
        },
      });
    }

    // Mock HTMLCanvasElement.prototype.requestPaint
    Object.defineProperty(HTMLCanvasElement.prototype, 'requestPaint', {
      get() {
        return function(this: HTMLCanvasElement) {
          const onpaintFn = onpaintMap.get(this);
          if (typeof onpaintFn === 'function') {
            const mockEvent = {
              changedElements: [document.getElementById('export_element') || document.body]
            };
            try {
              onpaintFn.call(this, mockEvent);
            } catch (e) {
              // Record errors, for example from using the return value of drawElementImage()
              window.__paintErrors.push(String(e));
              throw e;
            }
          }
        };
      },
      configurable: true,
    });

    // Mock CanvasRenderingContext2D.prototype.drawElementImage
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'drawElementImage', {
      value: function(this: CanvasRenderingContext2D, element: HTMLElement, x: number, y: number) {
        window.__renderCalls.push({
          method: 'drawElementImage',
          arguments: [element ? element.id || element.className || element.tagName : null, x, y],
          insideOnpaint: window.__onpaintActive
        });
        window.__drawnElements.push(element);
        // Like the latest API, return undefined: the browser syncs the element's DOM position
        return undefined;
      },
      writable: true,
      configurable: true
    });

    // Mock HTMLCanvasElement.prototype.updateElementGeometry
    Object.defineProperty(HTMLCanvasElement.prototype, 'updateElementGeometry', {
      value: function(this: HTMLCanvasElement, element: HTMLElement, options?: { canvasTransform?: DOMMatrix }) {
        window.__geometryCalls.push({
          hasCanvasTransform: !!(options && options.canvasTransform)
        });
      },
      writable: true,
      configurable: true
    });

    // Mock WebGL/WebGPU render calls if needed
    const spyWebGL = (proto: any) => {
      if (!proto) return;
      const originalTex = proto.texElementSubImage2D;
      proto.texElementSubImage2D = function(this: any, ...args: any[]) {
        window.__renderCalls.push({
          method: 'texElementSubImage2D',
          insideOnpaint: window.__onpaintActive
        });
        if (originalTex) {
          return originalTex.apply(this, args);
        }
      };
    };

    if (typeof WebGLRenderingContext !== 'undefined') spyWebGL(WebGLRenderingContext.prototype);
    if (typeof WebGL2RenderingContext !== 'undefined') spyWebGL(WebGL2RenderingContext.prototype);

    if (typeof (window as any).GPUQueue !== 'undefined') {
      const queueProto = (window as any).GPUQueue.prototype;
      const originalCopy = queueProto.drawElementImageToTexture;
      queueProto.drawElementImageToTexture = function(this: any, ...args: any[]) {
        window.__renderCalls.push({
          method: 'drawElementImageToTexture',
          insideOnpaint: window.__onpaintActive
        });
        if (originalCopy) return originalCopy.apply(this, args);
      };
    }

    // Spy for ResizeObserver to detect canvas tracking
    const OriginalResizeObserver = window.ResizeObserver;
    if (OriginalResizeObserver) {
      class SpiedResizeObserver extends OriginalResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          super(callback);
        }
        observe(target: Element, options?: ResizeObserverOptions) {
          window.__resizeObserverObserved.push({
            targetTagName: target ? target.tagName.toLowerCase() : null,
            targetId: target ? target.id : null,
            containsCanvas: Boolean(target && (target.tagName.toLowerCase() === 'canvas' || target.querySelector('canvas'))),
            options: options || null
          });
          return super.observe(target, options);
        }
      }
      window.ResizeObserver = SpiedResizeObserver;
    }
  });

  // Navigate to target file
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  await page.goto(targetUrl);
  // Give time for initial load and observation to register
  await page.waitForTimeout(500);

  const exportBtn = page.locator('#download_card, #download-card, #download-btn, #export-card-btn, #export-btn, button:has-text("Download"), button:has-text("Export"), button:has-text("Save")').first();
  if (await exportBtn.isVisible()) {
    await exportBtn.click();
    await page.waitForTimeout(500);
  }
});

// Test 1: Feature detection is conducted
test('Feature detection for HTML-in-Canvas MUST be conducted', async ({ page }) => {
  // Pages detect the latest API surface with 'content' in HTMLCanvasElement.prototype.
  // Members such as requestPaint also exist in earlier builds that lack the content attribute.
  const allCode = getAllScriptContent();
  const isFeatureDetected = await page.evaluate(() => {
    const scriptText = Array.from(document.querySelectorAll('script'))
      .map(s => s.textContent || '')
      .join(String.fromCharCode(10));
    return /['"`]content['"`]\s+in\b/.test(scriptText);
  });
  const hasStaticFeatureDetection = /['"`]content['"`]\s+in\b/.test(allCode);
  expect(isFeatureDetected || hasStaticFeatureDetection).toBe(true);
});

// Test 2: Canvas element includes content="drawable" attribute
test('The canvas element MUST include the content="drawable" attribute', async ({ page }) => {
  const hasDrawableContent = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? canvas.getAttribute('content') === 'drawable' : false;
  });
  expect(hasDrawableContent).toBe(true);
});

// Test 3: Drawn elements and direct children of the canvas include the drawable attribute
test('Every drawn HTML element and every direct child of the canvas element MUST include the drawable attribute', async ({ page }) => {
  const hasDrawableElements = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas || canvas.children.length === 0) return false;
    const childrenAreDrawable = Array.from(canvas.children).every(child => child.hasAttribute('drawable'));
    const drawnElementsAreDrawable = window.__drawnElements.every(el => el instanceof Element && el.hasAttribute('drawable'));
    return childrenAreDrawable && drawnElementsAreDrawable;
  });
  expect(hasDrawableElements).toBe(true);
});

// Test 4: Canvas rendering executed inside onpaint event handler
test('Canvas rendering MUST be executed inside an onpaint event handler', async ({ page }) => {
  const hasOnpaintHandler = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return window.__onpaintCalled || (canvas ? typeof canvas.onpaint === 'function' : false);
  });
  expect(hasOnpaintHandler).toBe(true);
});

// Test 5: Rendering logic uses the correct API methods
test('The rendering logic MUST use drawElementImage, texElementSubImage2D, or drawElementImageToTexture', async ({ page }) => {
  const usedCorrectMethod = await page.evaluate(() => {
    const validMethods = ['drawElementImage', 'texElementSubImage2D', 'drawElementImageToTexture'];
    return window.__renderCalls.some(call => validMethods.includes(call.method));
  });
  expect(usedCorrectMethod).toBe(true);
});

// Test 6: DOM position of each drawn element matches where it is drawn
test('The DOM position of each drawn HTML element MUST match where it is drawn', async ({ page }) => {
  const isPositionSynced = await page.evaluate(() => {
    // In 2D, drawElementImage() syncs the DOM position, so its return value isn't applied to style.transform
    if (window.__drawnElements.length > 0) {
      return window.__paintErrors.length === 0 &&
             window.__drawnElements.every(el => !el?.style?.transform);
    }
    // In WebGL and WebGPU, updateElementGeometry() with a canvasTransform syncs it
    return window.__geometryCalls.some(call => call.hasCanvasTransform);
  });
  expect(isPositionSynced).toBe(true);
});

// Test 7: Screen size changes are observed to update canvas size
test('Screen size changes MUST be observed via ResizeObserver on the canvas', async ({ page }) => {
  const isCanvasObserved = await page.evaluate(() => {
    return window.__resizeObserverObserved.some(obs => obs.targetTagName === 'canvas' || obs.targetId === 'export_element' || obs.targetTagName === 'article' || obs.containsCanvas);
  });
  expect(isCanvasObserved).toBe(true);
});
