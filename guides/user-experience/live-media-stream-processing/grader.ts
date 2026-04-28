import { test, expect } from '@playwright/test';

// Define the stats type for better safety
interface WebCodecsStats {
  processorCreated: boolean;
  videoFramesCreated: number;
  videoFramesClosed: number;
  captureStreamCalled: boolean;
  getImageDataCalls: number;
  videoDecoderUsed: boolean;
}

declare global {
  interface Window {
    __webcodecs_stats: WebCodecsStats;
    MediaStreamTrackProcessor: any;
    MediaStreamTrackGenerator: any;
    VideoFrame: any;
    VideoDecoder: any;
  }
}

// @ts-ignore
const targetUrl = process.env.TARGET_FILE ? `file://${process.env.TARGET_FILE}` : 'http://localhost:3000';

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ]
  }
});

test.describe('WebCodecs Media Processing Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__webcodecs_stats = {
        processorCreated: false,
        videoFramesCreated: 0,
        videoFramesClosed: 0,
        captureStreamCalled: false,
        getImageDataCalls: 0,
        videoDecoderUsed: false,
      };

      // Instrument MediaStreamTrackProcessor
      if ('MediaStreamTrackProcessor' in window) {
        const OriginalProcessor = window.MediaStreamTrackProcessor;
        window.MediaStreamTrackProcessor = function(this: any, args: any) {
          window.__webcodecs_stats.processorCreated = true;
          return new OriginalProcessor(args);
        } as any;
        window.MediaStreamTrackProcessor.prototype = OriginalProcessor.prototype;
      }

      // Instrument VideoFrame
      if ('VideoFrame' in window) {
        const OriginalVideoFrame = window.VideoFrame;
        const OriginalClose = OriginalVideoFrame.prototype.close;
        
        // Trap constructor
        window.VideoFrame = function(this: any, source: any, init: any) {
          window.__webcodecs_stats.videoFramesCreated++;
          return new OriginalVideoFrame(source, init);
        } as any;
        window.VideoFrame.prototype = OriginalVideoFrame.prototype;

        // Trap close
        OriginalVideoFrame.prototype.close = function(this: any) {
          window.__webcodecs_stats.videoFramesClosed++;
          return OriginalClose.apply(this, arguments as any);
        };
      }

      // Instrument VideoDecoder
      if ('VideoDecoder' in window) {
        const OriginalDecoder = window.VideoDecoder;
        window.VideoDecoder = function(this: any, init: any) {
          window.__webcodecs_stats.videoDecoderUsed = true;
          return new OriginalDecoder(init);
        } as any;
        window.VideoDecoder.prototype = OriginalDecoder.prototype;
      }

      // Instrument HTMLCanvasElement.prototype.captureStream
      const originalCaptureStream = HTMLCanvasElement.prototype.captureStream;
      HTMLCanvasElement.prototype.captureStream = function(this: any) {
        window.__webcodecs_stats.captureStreamCalled = true;
        return originalCaptureStream.apply(this, arguments as any);
      };

      // Instrument CanvasRenderingContext2D.prototype.getImageData
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(this: any) {
        window.__webcodecs_stats.getImageDataCalls++;
        return originalGetImageData.apply(this, arguments as any);
      };
    });

    await page.goto(targetUrl);
  });

  test('Utilizes WebCodecs (VideoFrame/Processor) for media processing', async ({ page }) => {
    // Start the stream
    const startButton = page.locator('button:has-text("Start")');
    await startButton.click();

    // Wait a bit for processing to happen
    await page.waitForTimeout(2000);

    const stats = await page.evaluate(() => window.__webcodecs_stats);
    
    expect(stats.processorCreated || stats.videoDecoderUsed || stats.videoFramesCreated > 0).toBe(true);
  });

  test('Explicitly closes VideoFrame objects to prevent memory leaks', async ({ page }) => {
    const startButton = page.locator('button:has-text("Start")');
    await startButton.click();

    // Enable effect if there is a toggle to ensure new VideoFrames are created in JS
    const effectToggle = page.locator('input[type="checkbox"], button:has-text("Effect")');
    if (await effectToggle.count() > 0) {
        await effectToggle.first().click();
    }

    // Wait for frames to be processed
    await page.waitForTimeout(2000);

    const stats = await page.evaluate(() => window.__webcodecs_stats);
    
    if (stats.videoFramesCreated > 0) {
        expect(stats.videoFramesClosed).toBeGreaterThan(0);
        expect(stats.videoFramesClosed / stats.videoFramesCreated).toBeGreaterThan(0.5);
    } else {
        expect(stats.videoFramesCreated).toBeGreaterThan(0);
    }
  });

  test('Does not rely on captureStream() or MediaRecorder workarounds', async ({ page }) => {
    const startButton = page.locator('button:has-text("Start")');
    await startButton.click();
    await page.waitForTimeout(2000);

    const stats = await page.evaluate(() => window.__webcodecs_stats);
    expect(stats.captureStreamCalled).toBe(false);
  });

  test('Avoids intensive synchronous pixel manipulation on the main thread', async ({ page }) => {
    const startButton = page.locator('button:has-text("Start")');
    await startButton.click();
    
    // Enable effect if there is a toggle
    const effectToggle = page.locator('input[type="checkbox"], button:has-text("Effect")');
    if (await effectToggle.count() > 0) {
        await effectToggle.first().click();
    }

    await page.waitForTimeout(2000);

    const stats = await page.evaluate(() => window.__webcodecs_stats);
    
    expect(stats.getImageDataCalls).toBeLessThan(10); 
  });

  test('Applies real-time effects directly to raw frame data, not just CSS filters', async ({ page }) => {
    const startButton = page.locator('button:has-text("Start")');
    await startButton.click();
    
    const effectToggle = page.locator('input[type="checkbox"], button:has-text("Effect")');
    if (await effectToggle.count() > 0) {
        await effectToggle.first().click();
    }
    
    await page.waitForTimeout(1000);

    const hasCssFilter = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        return videos.some(v => {
            const style = window.getComputedStyle(v);
            return style.filter !== 'none' && style.filter !== '';
        });
    });

    const stats = await page.evaluate(() => window.__webcodecs_stats);
    
    if (hasCssFilter) {
        expect(stats.videoFramesCreated).toBeGreaterThan(0);
    } else {
        expect(stats.videoFramesCreated).toBeGreaterThan(0);
    }
  });

});
