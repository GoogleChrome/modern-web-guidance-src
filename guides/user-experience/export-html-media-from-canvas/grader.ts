import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    __featureDetectionChecked: boolean;
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
      options: any;
    }>;
  }
  interface HTMLCanvasElement {
    onpaint?: any;
    requestPaint?: any;
  }
}

test.beforeEach(async ({ page }) => {
  // Add the HTML-in-Canvas API polyfills and spy hooks before loading the page
  await page.addInitScript(() => {
    // Spies & trackers
    window.__featureDetectionChecked = false;
    window.__renderCalls = [];
    window.__onpaintCalled = false;
    window.__onpaintActive = false;
    window.__resizeObserverObserved = [];

    // Polyfill/Spy for HTMLCanvasElement.prototype.requestPaint
    // Keep track of any onpaint callback assigned to canvas elements
    const onpaintMap = new WeakMap<HTMLCanvasElement, any>();
    
    Object.defineProperty(HTMLCanvasElement.prototype, 'onpaint', {
      get() {
        return onpaintMap.get(this);
      },
      set(fn) {
        if (typeof fn === 'function') {
          const wrappedFn = function(this: HTMLCanvasElement, ...args: any[]) {
            window.__onpaintCalled = true;
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

    // Mock HTMLCanvasElement.prototype.requestPaint
    Object.defineProperty(HTMLCanvasElement.prototype, 'requestPaint', {
      get() {
        window.__featureDetectionChecked = true;
        return function(this: HTMLCanvasElement) {
          const onpaintFn = onpaintMap.get(this);
          if (typeof onpaintFn === 'function') {
            const mockEvent = {
              changedElements: [document.getElementById('export_element') || document.body]
            };
            onpaintFn.call(this, mockEvent);
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
        // Return a mock DOMMatrix
        return new DOMMatrix();
      },
      writable: true,
      configurable: true
    });

    // Mock WebGL/WebGPU render calls if needed
    const spyWebGL = (proto: any) => {
      if (!proto) return;
      const originalTex = proto.texElementImage2D;
      proto.texElementImage2D = function(this: any, ...args: any[]) {
        window.__renderCalls.push({
          method: 'texElementImage2D',
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
      const originalCopy = queueProto.copyElementImageToTexture;
      queueProto.copyElementImageToTexture = function(this: any, ...args: any[]) {
        window.__renderCalls.push({
          method: 'copyElementImageToTexture',
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
  await page.goto(`file://${process.env.TARGET_FILE || ''}`);
  // Give time for initial load and observation to register
  await page.waitForTimeout(500);
});

// Test 1: Feature detection is conducted
test('Feature detection for HTML-in-Canvas MUST be conducted', async ({ page }) => {
  const isFeatureDetected = await page.evaluate(() => {
    const scriptText = Array.from(document.querySelectorAll('script'))
      .map(s => s.textContent || '')
      .join(String.fromCharCode(10));
    return window.__featureDetectionChecked || 
           scriptText.includes('requestPaint') || 
           scriptText.includes('devicePixelContentBoxSize');
  });
  expect(isFeatureDetected).toBe(true);
});

// Test 2: Canvas element includes layoutsubtree attribute
test('The canvas element MUST include the layoutsubtree attribute', async ({ page }) => {
  const hasLayoutSubtree = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? canvas.hasAttribute('layoutsubtree') : false;
  });
  expect(hasLayoutSubtree).toBe(true);
});

// Test 3: Canvas rendering executed inside onpaint event handler
test('Canvas rendering MUST be executed inside an onpaint event handler', async ({ page }) => {
  const hasOnpaintHandler = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? typeof canvas.onpaint === 'function' : false;
  });
  expect(hasOnpaintHandler).toBe(true);
});

// Test 4: Rendering logic uses the correct API methods
test('The rendering logic MUST use correct HTML-in-Canvas drawing methods', async ({ page }) => {
  const usedCorrectMethod = await page.evaluate(() => {
    const validMethods = ['drawElementImage', 'texElementImage2D', 'copyElementImageToTexture'];
    return window.__renderCalls.some(call => validMethods.includes(call.method));
  });
  expect(usedCorrectMethod).toBe(true);
});

// Test 5: CSS transform is updated based on transform matrix
test('The CSS transform property of the descendant element MUST be updated', async ({ page }) => {
  const isTransformUpdated = await page.evaluate(() => {
    const targetElement = document.getElementById('export_element') || 
                          document.querySelector('canvas *') ||
                          document.querySelector('.export-content');
    if (!targetElement) return false;
    const styleTransform = (targetElement as HTMLElement).style.transform;
    return styleTransform !== '' && (styleTransform.includes('matrix') || styleTransform.includes('matrix3d'));
  });
  expect(isTransformUpdated).toBe(true);
});

// Test 6: Screen size changes are observed to update canvas size
test('Screen size changes MUST be observed via ResizeObserver on the canvas', async ({ page }) => {
  const isCanvasObserved = await page.evaluate(() => {
    return window.__resizeObserverObserved.some(obs => obs.targetTagName === 'canvas');
  });
  expect(isCanvasObserved).toBe(true);
});
