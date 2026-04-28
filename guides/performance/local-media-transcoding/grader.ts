import { test, expect } from '@playwright/test';

/**
 * Grader for WebCodecs Local Transcoding.
 * 
 * This test suite verifies that the implementation uses the WebCodecs API (VideoEncoder/AudioEncoder)
 * to process media locally, avoids server-side transcoding, avoids heavy WASM libraries like FFmpeg 
 * when WebCodecs is available, and does not use MediaRecorder as a substitute for WebCodecs.
 */

const targetUrl = process.env.TARGET_FILE ? `file://${process.env.TARGET_FILE}` : `file://${process.cwd()}/demo.html`;

test.describe('WebCodecs Local Transcoding Grader', () => {
  let serverCalledOutside = false;

  test.beforeEach(async ({ page }) => {
    serverCalledOutside = false;
    // Use Playwright's network interception to detect server-side transcode calls
    page.on('request', request => {
      const url = request.url();
      if (url.includes('transcode') || url.includes('process')) {
        serverCalledOutside = true;
      }
    });

    // Inject spies and mocks before the page loads
    await page.addInitScript(() => {
      window['__webcodecs_log'] = {
        encoderInitialized: false,
        encoderConfigured: false,
        framesCreated: 0,
        chunksEncoded: 0,
        mediaRecorderUsed: false,
        ffmpegUsed: false,
      };

      // Mock getUserMedia to ensure it works in headless environments and for consistent testing
      if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = async () => {
              const canvas = document.createElement('canvas');
              canvas.width = 640;
              canvas.height = 360;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.fillStyle = 'red';
                  ctx.fillRect(0, 0, 640, 360);
              }
              return (canvas as any).captureStream();
          };
      }

      // Spy on VideoEncoder constructor and output callback
      const OriginalVideoEncoder = window.VideoEncoder;
      if (OriginalVideoEncoder) {
        window.VideoEncoder = class extends OriginalVideoEncoder {
          constructor(init) {
            window['__webcodecs_log'].encoderInitialized = true;
            const originalOutput = init.output;
            init.output = (chunk, metadata) => {
              window['__webcodecs_log'].chunksEncoded++;
              if (originalOutput) {
                 try {
                    originalOutput(chunk, metadata);
                 } catch (e) {
                    // Prevent user script errors from breaking the grader
                 }
              }
            };
            super(init);
          }
          configure(config) {
            window['__webcodecs_log'].encoderConfigured = true;
            return super.configure(config);
          }
        } as any;
      }

      // Spy on AudioEncoder constructor and output callback
      const OriginalAudioEncoder = window.AudioEncoder;
      if (OriginalAudioEncoder) {
        window.AudioEncoder = class extends OriginalAudioEncoder {
          constructor(init) {
            window['__webcodecs_log'].encoderInitialized = true;
            const originalOutput = init.output;
            init.output = (chunk, metadata) => {
              window['__webcodecs_log'].chunksEncoded++;
              if (originalOutput) {
                try {
                    originalOutput(chunk, metadata);
                } catch (e) {}
              }
            };
            super(init);
          }
          configure(config) {
            window['__webcodecs_log'].encoderConfigured = true;
            return super.configure(config);
          }
        } as any;
      }

      // Spy on VideoFrame creation to verify frame-level processing
      const OriginalVideoFrame = window.VideoFrame;
      if (OriginalVideoFrame) {
        window.VideoFrame = class extends OriginalVideoFrame {
          constructor(source, init) {
            window['__webcodecs_log'].framesCreated++;
            super(source, init);
          }
        } as any;
      }

      // Spy on AudioData creation
      const OriginalAudioData = window.AudioData;
      if (OriginalAudioData) {
        window.AudioData = class extends OriginalAudioData {
          constructor(init) {
            window['__webcodecs_log'].framesCreated++;
            super(init);
          }
        } as any;
      }

      // Spy on MediaRecorder to detect use of prohibited substitutes
      const OriginalMediaRecorder = window.MediaRecorder;
      if (OriginalMediaRecorder) {
        window.MediaRecorder = class extends OriginalMediaRecorder {
          constructor(stream, options) {
            window['__webcodecs_log'].mediaRecorderUsed = true;
            super(stream, options);
          }
        } as any;
      }

      // Detect FFmpeg usage via global property setter
      Object.defineProperty(window, 'FFmpeg', {
        set(val) {
          window['__webcodecs_log'].ffmpegUsed = true;
          this._FFmpeg = val;
        },
        get() {
          return this._FFmpeg;
        },
        configurable: true
      });
    });

    await page.goto(targetUrl);
  });

  // --- Must Pass Assertions ---

  test('The implementation must utilize VideoEncoder or AudioEncoder', async ({ page }) => {
    const startBtn = page.locator('button, [role="button"]').first();
    if (await startBtn.isVisible()) {
        await startBtn.click();
    }
    await page.waitForTimeout(1000);
    const encoderUsed = await page.evaluate(() => window['__webcodecs_log'].encoderInitialized);
    expect(encoderUsed).toBe(true);
  });

  test('Media encoding must be performed locally using WebCodecs configuration', async ({ page }) => {
    const startBtn = page.locator('button, [role="button"]').first();
    if (await startBtn.isVisible()) {
        await startBtn.click();
    }
    await page.waitForTimeout(1000);
    const configured = await page.evaluate(() => window['__webcodecs_log'].encoderConfigured);
    expect(configured).toBe(true);
  });

  test('The implementation must correctly handle VideoFrame or AudioData objects', async ({ page }) => {
    const startBtn = page.locator('button, [role="button"]').first();
    if (await startBtn.isVisible()) {
        await startBtn.click();
    }
    await page.waitForTimeout(1000);
    const framesCreated = await page.evaluate(() => window['__webcodecs_log'].framesCreated);
    expect(framesCreated).toBeGreaterThan(0);
  });

  test('The solution must demonstrate the use of an output callback for encoded chunks', async ({ page }) => {
    const startBtn = page.locator('button, [role="button"]').first();
    if (await startBtn.isVisible()) {
        await startBtn.click();
    }
    // Wait slightly longer to ensure chunks are processed
    await page.waitForTimeout(2000);
    const chunksEncoded = await page.evaluate(() => window['__webcodecs_log'].chunksEncoded);
    expect(chunksEncoded).toBeGreaterThan(0);
  });

  // --- Must Fail Assertions (Negative Constraints) ---

  test('The implementation must not rely on server-side APIs for transcoding', async ({ page }) => {
    const startBtn = page.locator('button, [role="button"]').first();
    if (await startBtn.isVisible()) {
        await startBtn.click();
        await page.waitForTimeout(1000);
        // Stop recording/encoding to trigger any deferred server uploads
        await startBtn.click();
    }
    await page.waitForTimeout(1000);
    expect(serverCalledOutside).toBe(false);
  });

  test('The solution must not use heavy client-side libraries like FFmpeg if WebCodecs is supported', async ({ page }) => {
    // Attempt to click an FFmpeg specific button if it exists (for negative-demo)
    const ffmpegBtn = page.locator('button:has-text("FFmpeg")');
    if (await ffmpegBtn.isVisible()) {
        await ffmpegBtn.click();
    }
    await page.waitForTimeout(1000);
    const ffmpegUsed = await page.evaluate(() => window['__webcodecs_log'].ffmpegUsed || !!window['FFmpeg']);
    expect(ffmpegUsed).toBe(false);
  });

  test('The implementation must not use MediaRecorder as a substitute for WebCodecs', async ({ page }) => {
    const startBtn = page.locator('button, [role="button"]').first();
    if (await startBtn.isVisible()) {
        await startBtn.click();
    }
    await page.waitForTimeout(1000);
    const mediaRecorderUsed = await page.evaluate(() => window['__webcodecs_log'].mediaRecorderUsed);
    expect(mediaRecorderUsed).toBe(false);
  });
});
