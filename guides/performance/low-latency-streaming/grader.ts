import { test, expect } from '@playwright/test';

// @ts-ignore
const TARGET_URL = process.env.TARGET_FILE ? `file://${process.env.TARGET_FILE}` : `file://${process.cwd()}/demo.html`;

test.describe('Low-Latency Streaming Requirements', () => {
  
  test.beforeEach(async ({ page }) => {
    // Inject instrumentation before the page loads
    await page.addInitScript(() => {
      // @ts-ignore
      window.__grader_vitals = {
        webCodecsUsed: false,
        lowLatencyConfigured: false,
        framesProcessed: false,
        renderedToCanvas: false,
        legacyUsed: false,
      };

      // @ts-ignore
      const trackUsage = (key) => { window.__grader_vitals[key] = true; };

      // Wrap WebCodecs
      ['VideoDecoder', 'VideoEncoder'].forEach(className => {
        // @ts-ignore
        const Original = window[className];
        if (Original) {
          // @ts-ignore
          window[className] = class extends Original {
            constructor(init: any) {
              // Intercept output for decoder
              if (className === 'VideoDecoder' && init && init.output) {
                const originalOutput = init.output;
                init.output = (frame: any) => {
                  if (frame && frame.constructor.name === 'VideoFrame') trackUsage('framesProcessed');
                  return originalOutput(frame);
                };
              }
              super(init);
              trackUsage('webCodecsUsed');
            }
            configure(config: any) {
              if (config && (config.latencyMode === 'realtime' || config.optimizeForLatency === true)) {
                trackUsage('lowLatencyConfigured');
              }
              return super.configure(config);
            }
            encode(frame: any) {
              if (frame && frame.constructor.name === 'VideoFrame') trackUsage('framesProcessed');
              return super.encode(frame);
            }
            decode(chunk: any) {
               // EncodedVideoChunk use can also be tracked here
               if (chunk && chunk.constructor.name === 'EncodedVideoChunk') {
                   // We consider either VideoFrame or EncodedVideoChunk as frame-level processing
                   trackUsage('framesProcessed');
               }
               return super.decode(chunk);
            }
          };
          // Maintain static methods (like isConfigSupported)
          // @ts-ignore
          Object.setPrototypeOf(window[className], Original);
        }
      });

      // Canvas rendering
      const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(image: any, ...args: any[]) {
        if (image && (image.constructor.name === 'VideoFrame' || image instanceof (window as any).VideoFrame)) {
          trackUsage('renderedToCanvas');
        }
        // @ts-ignore
        return originalDrawImage.apply(this, [image, ...args]);
      };

      // Legacy HLS/MSE detection
      if (window.MediaSource) {
        const OriginalMSE = window.MediaSource;
        // @ts-ignore
        window.MediaSource = class extends OriginalMSE {
          constructor() {
            super();
            trackUsage('legacyUsed');
          }
        };
        Object.setPrototypeOf(window.MediaSource, OriginalMSE);
      }

      // Handle Hls if it arrives later via script tag
      let _Hls: any;
      Object.defineProperty(window, 'Hls', {
        get() { return _Hls; },
        set(val) {
          _Hls = class extends val {
            constructor(config: any) {
              super(config);
              trackUsage('legacyUsed');
            }
          };
          Object.setPrototypeOf(_Hls, val);
        },
        configurable: true
      });
      
      // Mock getUserMedia for environments without camera
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1280; canvas.height = 720;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            setInterval(() => {
              ctx.fillStyle = `rgb(${Math.random()*255}, ${Math.random()*255}, ${Math.random()*255})`;
              ctx.fillRect(0, 0, 1280, 720);
            }, 30);
          }
          return (canvas as any).captureStream(30);
        };
      }
    });

    await page.goto(TARGET_URL);
    
    // Attempt to trigger the stream by clicking common button patterns
    const startBtn = page.locator('button:has-text("Start"), button:has-text("Load"), button:has-text("Play")');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    
    // Wait for async operations and processing loop
    // Increased timeout to allow for encoder/decoder initialization and first frames
    await page.waitForTimeout(3000);
  });

  test('The implementation must use VideoDecoder or VideoEncoder for media processing', async ({ page }) => {
    const vitals = await page.evaluate(() => (window as any).__grader_vitals);
    expect(vitals.webCodecsUsed).toBe(true);
  });

  test('The implementation must configure the codec for low-latency (realtime mode)', async ({ page }) => {
    const vitals = await page.evaluate(() => (window as any).__grader_vitals);
    expect(vitals.lowLatencyConfigured).toBe(true);
  });

  test('The implementation must process media at the frame level (VideoFrame/EncodedVideoChunk)', async ({ page }) => {
    const vitals = await page.evaluate(() => (window as any).__grader_vitals);
    expect(vitals.framesProcessed).toBe(true);
  });

  test('The implementation must render decoded frames to a Canvas element for minimal delay', async ({ page }) => {
    const vitals = await page.evaluate(() => (window as any).__grader_vitals);
    expect(vitals.renderedToCanvas).toBe(true);
  });

  test('The implementation must not rely on legacy buffering protocols like HLS or MSE', async ({ page }) => {
    const vitals = await page.evaluate(() => (window as any).__grader_vitals);
    expect(vitals.legacyUsed).toBe(false);
  });

});
