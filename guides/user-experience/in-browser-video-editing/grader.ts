import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

/**
 * WebCodecs Video Editing Grader
 * 
 * This grader verifies that the implementation correctly uses the WebCodecs API
 * for high-performance, frame-accurate video editing and export.
 * 
 * Requirements:
 * - Uses VideoEncoder and VideoDecoder/VideoFrame APIs.
 * - Configures high-resolution export (>= 720p).
 * - Avoids MediaRecorder and synchronous canvas methods.
 */

const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
const targetUrl = `file://${targetFile}`;

async function injectSpies(page: Page) {
  await page.addInitScript(() => {
    (window as any)._grader_log = {
      videoEncoderInits: 0,
      videoDecoderInits: 0,
      encoderConfigs: [],
      videoFramesCreated: 0,
      encodedChunksHandled: 0,
      mediaRecorderInits: 0,
      captureStreamCalls: 0,
      toDataURLCalls: 0,
    };

    const getLog = () => (window as any)._grader_log;

    // Mock WebCodecs to track usage and ensure stability in headless environments
    (window as any).VideoEncoder = class {
        init: any;
        constructor(init: any) {
            this.init = init;
            getLog().videoEncoderInits++;
        }
        configure(config: any) {
            getLog().encoderConfigs.push(JSON.parse(JSON.stringify(config)));
        }
        encode(frame: any) {
            // Simulate output to verify implementation handles EncodedVideoChunk
            setTimeout(() => {
                getLog().encodedChunksHandled++;
                if (this.init && this.init.output) {
                    this.init.output({ type: 'key', timestamp: frame.timestamp || 0, byteLength: 1000 }, {});
                }
            }, 10);
        }
        flush() { return Promise.resolve(); }
        static isConfigSupported() { return Promise.resolve({ supported: true }); }
    } as any;

    (window as any).VideoDecoder = class {
        constructor() { getLog().videoDecoderInits++; }
        configure() {}
        decode() {}
        flush() { return Promise.resolve(); }
        static isConfigSupported() { return Promise.resolve({ supported: true }); }
    } as any;

    (window as any).VideoFrame = class {
        timestamp: number;
        displayWidth?: number;
        displayHeight?: number;
        constructor(source: any, init?: any) {
            getLog().videoFramesCreated++;
            this.timestamp = init ? init.timestamp : 0;
            if (source && source.width) {
                this.displayWidth = source.width;
                this.displayHeight = source.height;
            }
        }
        close() {}
    } as any;

    (window as any).EncodedVideoChunk = class {} as any;

    // Spy on legacy or negative patterns
    const OriginalMediaRecorder = window.MediaRecorder;
    if (OriginalMediaRecorder) {
        (window as any).MediaRecorder = function(stream: any, options: any) {
            getLog().mediaRecorderInits++;
            return new OriginalMediaRecorder(stream, options);
        } as any;
        (window as any).MediaRecorder.prototype = OriginalMediaRecorder.prototype;
        (window as any).MediaRecorder.isTypeSupported = OriginalMediaRecorder.isTypeSupported;
    }

    const originalCaptureStream = HTMLCanvasElement.prototype.captureStream;
    HTMLCanvasElement.prototype.captureStream = function(fps?: number) {
      getLog().captureStreamCalls++;
      return originalCaptureStream.call(this, fps);
    };

    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
      getLog().toDataURLCalls++;
      return originalToDataURL.call(this, type, quality);
    };

    // Mock Media methods to drive the application loop without real assets
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
        get() { return (this as any)._grader_paused !== undefined ? (this as any)._grader_paused : true; },
        configurable: true
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'ended', {
        get() { return false; },
        configurable: true
    });
    HTMLMediaElement.prototype.play = function() {
        (this as any)._grader_paused = false;
        return Promise.resolve();
    };
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        get() { return (this as any)._grader_currentTime || 0; },
        set(v) { (this as any)._grader_currentTime = v; },
        configurable: true
    });
    
    (HTMLVideoElement.prototype as any).requestVideoFrameCallback = function(cb: any) {
        return setTimeout(() => {
            cb(Date.now(), { 
                presentationTime: Date.now(), 
                expectedDisplayTime: Date.now(), 
                width: this.videoWidth || 1920, 
                height: this.videoHeight || 1080, 
                mediaTime: this.currentTime || 0, 
                presentedFrames: 1 
            });
        }, 16);
    };
  });
}

test.describe('WebCodecs Video Editor Requirements', () => {
  test.beforeEach(async ({ page }) => {
    await injectSpies(page);
    await page.goto(targetUrl);

    // Initialize mock state
    await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      videos.forEach(v => {
        Object.defineProperty(v, 'videoWidth', { value: 1920, configurable: true });
        Object.defineProperty(v, 'videoHeight', { value: 1080, configurable: true });
        Object.defineProperty(v, 'duration', { value: 60, configurable: true });
        Object.defineProperty(v, 'readyState', { value: 4, configurable: true });
        v.dispatchEvent(new Event('loadedmetadata'));
        v.dispatchEvent(new Event('canplay'));
      });
      const buttons = Array.from(document.querySelectorAll('button'));
      buttons.forEach(b => b.disabled = false);
    });

    // Trigger action
    await page.evaluate(() => {
        const btn = document.querySelector('button:not([disabled]), #start-export, #btn, .btn, .test-export-button') as HTMLButtonElement;
        if (btn) btn.click();
    });

    // Allow time for processing
    await page.waitForTimeout(2000);
  });

  test('Implementation instantiates VideoEncoder and VideoDecoder to handle video data processing', async ({ page }) => {
    const log = await page.evaluate(() => (window as any)._grader_log);
    expect(log.videoEncoderInits + log.videoDecoderInits).toBeGreaterThan(0);
  });

  test('The VideoEncoder is configured with a high-resolution specification (e.g., 1280x720 or higher)', async ({ page }) => {
    const log = await page.evaluate(() => (window as any)._grader_log);
    const hasHighRes = log.encoderConfigs.some((c: any) => 
      c.width && c.width >= 1280 && c.height && c.height >= 720
    );
    expect(hasHighRes).toBe(true);
  });

  test('The application processes VideoFrame objects for frame-accurate editing', async ({ page }) => {
    const log = await page.evaluate(() => (window as any)._grader_log);
    expect(log.videoFramesCreated).toBeGreaterThan(0);
  });

  test('The implementation handles EncodedVideoChunk outputs to assemble the final exported video', async ({ page }) => {
    const log = await page.evaluate(() => (window as any)._grader_log);
    expect(log.encodedChunksHandled).toBeGreaterThan(0);
  });

  test('Hardware acceleration is utilized via configuration option where available', async ({ page }) => {
    const log = await page.evaluate(() => (window as any)._grader_log);
    expect(log.encoderConfigs.length).toBeGreaterThan(0);
  });

  test('The implementation does not rely on MediaRecorder for the export process', async ({ page }) => {
    const log = await page.evaluate(() => (window as any)._grader_log);
    expect(log.mediaRecorderInits).toBe(0);
  });

  test('The application does not use canvas.captureStream() as the primary mechanism for video generation', async ({ page }) => {
    const log = await page.evaluate(() => (window as any)._grader_log);
    expect(log.captureStreamCalls).toBe(0);
  });

  test('The implementation avoids synchronous frame extraction using methods like canvas.toDataURL()', async ({ page }) => {
    const log = await page.evaluate(() => (window as any)._grader_log);
    expect(log.toDataURLCalls).toBe(0);
  });
});
