import { test, expect } from '@playwright/test';
import path from 'path';

const TARGET_FILE = process.env.TARGET_FILE || path.resolve(process.cwd(), 'demo.html');

test.describe('WebCodecs Local Transcoding Grader', () => {
  test.slow(); // Increase timeout for media processing tests

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Setup tracking variables on window
      const tw = window as any;

      tw._webCodecsUsed = false;
      tw._videoFramesCreated = 0;
      tw._videoFramesClosed = 0;
      tw._audioDataCreated = 0;
      tw._audioDataClosed = 0;
      tw._outputCallbackCalled = false;
      tw._mediaRecorderUsed = false;
      tw._serverTranscodingDetected = false;

      // Mock getUserMedia to provide a dummy stream for tests
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'blue';
            ctx.fillRect(0, 0, 640, 360);
          }
          return canvas.captureStream(30);
        };
      }

      // Intercept VideoEncoder to verify WebCodecs usage
      if (window.VideoEncoder) {
        const RealVideoEncoder = window.VideoEncoder;
        const NewVideoEncoder = class extends RealVideoEncoder {
          constructor(init: VideoEncoderInit) {
            tw._webCodecsUsed = true;
            const originalOutput = init.output;
            init.output = (chunk, metadata) => {
              tw._outputCallbackCalled = true;
              return originalOutput(chunk, metadata);
            };
            super(init);
          }
        };
        // Mock isConfigSupported to always return true for the grader
        (NewVideoEncoder as any).isConfigSupported = async (config: any) => {
          return { supported: true, config };
        };
        window.VideoEncoder = NewVideoEncoder as any;
      }

      // Intercept AudioEncoder
      if (window.AudioEncoder) {
        const RealAudioEncoder = window.AudioEncoder;
        const NewAudioEncoder = class extends RealAudioEncoder {
          constructor(init: AudioEncoderInit) {
            tw._webCodecsUsed = true;
            const originalOutput = init.output;
            init.output = (chunk, metadata) => {
              tw._outputCallbackCalled = true;
              return originalOutput(chunk, metadata);
            };
            super(init);
          }
        };
        (NewAudioEncoder as any).isConfigSupported = async (config: any) => {
          return { supported: true, config };
        };
        window.AudioEncoder = NewAudioEncoder as any;
      }

      // Intercept VideoFrame and track lifecycle for memory leak checks
      if (window.VideoFrame) {
        const RealVideoFrame = window.VideoFrame;
        const originalClose = RealVideoFrame.prototype.close;
        RealVideoFrame.prototype.close = function() {
          if (!(this as any)._isClosed) {
            tw._videoFramesClosed++;
            (this as any)._isClosed = true;
          }
          return originalClose.apply(this, arguments as any);
        };
        window.VideoFrame = class extends RealVideoFrame {
          constructor(...args: any[]) {
            // VideoFrame constructor varies, but spreading args works
            super(args[0], args[1]);
            tw._videoFramesCreated++;
          }
        } as any;
      }

      // Intercept AudioData and track lifecycle
      if (window.AudioData) {
        const RealAudioData = window.AudioData;
        const originalClose = RealAudioData.prototype.close;
        RealAudioData.prototype.close = function() {
          if (!(this as any)._isClosed) {
            tw._audioDataClosed++;
            (this as any)._isClosed = true;
          }
          return originalClose.apply(this, arguments as any);
        };
        window.AudioData = class extends RealAudioData {
          constructor(...args: any[]) {
            super(args[0]);
            tw._audioDataCreated++;
          }
        } as any;
      }

      // Detect MediaRecorder usage (anti-pattern for these requirements)
      if (window.MediaRecorder) {
        const RealMediaRecorder = window.MediaRecorder;
        window.MediaRecorder = class extends RealMediaRecorder {
          constructor(...args: any[]) {
            tw._mediaRecorderUsed = true;
            super(args[0], args[1]);
          }
        } as any;
      }

      // Intercept network requests to detect non-local processing
      const realFetch = window.fetch;
      window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as any).url;
        if (url && (url.includes('transcode') || url.includes('upload') || url.includes('example.com'))) {
          tw._serverTranscodingDetected = true;
        }
        return realFetch(...args);
      };

      const realOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method: string, url: string | URL) {
        const urlStr = url.toString();
        if (urlStr.includes('transcode') || urlStr.includes('upload') || urlStr.includes('example.com')) {
          tw._serverTranscodingDetected = true;
        }
        return realOpen.apply(this, arguments as any);
      };
    });

    // Handle absolute/relative paths for Playwright
    const absolutePath = TARGET_FILE.startsWith('/') ? TARGET_FILE : path.resolve(process.cwd(), TARGET_FILE);
    await page.goto(`file://${absolutePath}`);
  });

  async function performActions(page: any) {
    // Attempt to find and click the primary action button (Start/Record)
    const startButton = page.locator('.test-start-btn, #record-btn, button:has-text("Start"), button:has-text("Record")').first();
    if (await startButton.isVisible()) {
      const isDisabled = await startButton.isDisabled();
      if (!isDisabled) {
        await startButton.click();
      }
      
      // Wait for process to run (capturing frames etc.)
      await page.waitForTimeout(4000);
      
      // Check if button indicates it needs a second click to stop/upload
      const btnText = await startButton.innerText();
      const needsManualStop = btnText.toLowerCase().includes('stop') || 
                              btnText.toLowerCase().includes('upload') || 
                              btnText.toLowerCase().includes('finish');
      
      const isStillDisabled = await startButton.isDisabled();
      if (needsManualStop && !isStillDisabled) {
        await startButton.click();
        await page.waitForTimeout(2000); 
      }
    }

    // Explicitly click FFmpeg button if it exists to detect heavy library usage
    const ffmpegButton = page.locator('#ffmpeg-btn, button:has-text("FFmpeg")');
    if (await ffmpegButton.isVisible()) {
      await ffmpegButton.click();
      await page.waitForTimeout(2000);
    }
  }

  test('The implementation must utilize the VideoEncoder or AudioEncoder interfaces from the WebCodecs API to process media bitstreams', async ({ page }) => {
    await performActions(page);
    const webCodecsUsed = await page.evaluate(() => (window as any)._webCodecsUsed);
    expect(webCodecsUsed).toBe(true);
  });

  test('Media encoding or transcoding must be performed locally on the client-side without transmitting raw media data to a server', async ({ page }) => {
    await performActions(page);
    const serverTranscoding = await page.evaluate(() => (window as any)._serverTranscodingDetected);
    expect(serverTranscoding).toBe(false);
  });

  test('The implementation must correctly handle VideoFrame or AudioData objects as inputs to the encoding process', async ({ page }) => {
    await performActions(page);
    const framesCreated = await page.evaluate(() => (window as any)._videoFramesCreated + (window as any)._audioDataCreated);
    expect(framesCreated).toBeGreaterThan(0);
  });

  test('The solution must demonstrate the use of an output callback to handle EncodedVideoChunk or EncodedAudioChunk objects', async ({ page }) => {
    await performActions(page);
    const outputCalled = await page.evaluate(() => (window as any)._outputCallbackCalled);
    expect(outputCalled).toBe(true);
  });

  test('The implementation must not rely on server-side APIs to perform the media transcoding or recording tasks', async ({ page }) => {
    await performActions(page);
    const serverTranscoding = await page.evaluate(() => (window as any)._serverTranscodingDetected);
    expect(serverTranscoding).toBe(false);
  });

  test('The solution must not use heavy, non-native client-side libraries (such as large Emscripten builds of FFmpeg)', async ({ page }) => {
    await performActions(page);
    const ffmpegDetected = await page.evaluate(() => {
      const scripts = Array.from(document.scripts);
      const hasFFmpegScript = scripts.some(s => s.src.toLowerCase().includes('ffmpeg'));
      const hasFFmpegGlobal = typeof (window as any).FFmpeg !== 'undefined' || typeof (window as any).createFFmpeg !== 'undefined';
      return hasFFmpegScript || hasFFmpegGlobal;
    });
    expect(ffmpegDetected).toBe(false);
  });

  test('The implementation must not use the MediaRecorder API as a substitute for WebCodecs', async ({ page }) => {
    await performActions(page);
    const mediaRecorderUsed = await page.evaluate(() => (window as any)._mediaRecorderUsed);
    expect(mediaRecorderUsed).toBe(false);
  });

  test('The implementation must close VideoFrame or AudioData objects to prevent memory leaks', async ({ page }) => {
    await performActions(page);
    const stats = await page.evaluate(() => ({
      videoCreated: (window as any)._videoFramesCreated,
      videoClosed: (window as any)._videoFramesClosed,
      audioCreated: (window as any)._audioDataCreated,
      audioClosed: (window as any)._audioDataClosed
    }));
    
    const totalCreated = stats.videoCreated + stats.audioCreated;
    const totalClosed = stats.videoClosed + stats.audioClosed;
    
    // Must have used frames and closed ALL of them
    expect(totalCreated).toBeGreaterThan(0);
    expect(totalClosed).toBe(totalCreated);
  });
});
