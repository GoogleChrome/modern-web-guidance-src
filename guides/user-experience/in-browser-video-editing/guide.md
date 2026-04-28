---
name: in-browser-video-editing
description: Edit and export high-resolution video directly in the browser.
web-feature-ids:
  - webcodecs
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioData
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioData/AudioData
---

# Edit and export high-resolution video in the browser

WebCodecs provides low-level access to the browser's hardware-accelerated media encoders and decoders. By manipulating raw `VideoFrame` objects directly, you can perform frame-accurate editing, apply complex visual effects via the Canvas API, and export high-resolution video without the performance bottlenecks of software-based WebAssembly ports. This approach is recommended because it minimizes memory copies and leverages the device's GPU for both processing and compression.

## How to implement

### Initialize the VideoDecoder
To edit existing video, you must first decode the source stream into individual frames. The `VideoDecoder` requires a configuration object that matches the source's codec string.

```javascript
// MANDATORY: Check for hardware acceleration support to ensure high-performance editing
const { supported } = await VideoDecoder.isConfigSupported({
  codec: 'vp08', // VP8 is widely supported; use specific strings like 'avc1.42E01E' for H.264
});

if (!supported) {
  throw new Error('Codec not supported on this hardware');
}

const decoder = new VideoDecoder({
  output: (frame) => {
    // This callback receives a VideoFrame object for every decoded chunk
    processFrame(frame);
  },
  error: (e) => console.error('Decoder error:', e),
});

decoder.configure({
  codec: 'vp08',
  optimizeFor: 'quality', // Prioritizes visual fidelity over low latency for editing/export
});
```

### Process and edit frames using Canvas
Once you have a `VideoFrame`, you can draw it onto a `CanvasRenderingContext2D` or `WebGLRenderingContext`. This is where you apply filters, overlays, or crops.

```javascript
function processFrame(frame) {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  // Set canvas dimensions to match the frame's visible resolution
  canvas.width = frame.displayWidth;
  canvas.height = frame.displayHeight;

  // Draw the raw frame directly to the canvas
  ctx.drawImage(frame, 0, 0);

  // Example: Apply a simple watermark or filter
  ctx.fillStyle = 'white';
  ctx.font = '24px sans-serif';
  ctx.fillText('Draft Export', 20, 40);

  // MANDATORY: You MUST close the frame as soon as you are done with it
  // Failing to close frames will quickly exhaust GPU memory and crash the browser
  frame.close();

  // After processing, capture the canvas state as a new VideoFrame for the encoder
  const editedFrame = new VideoFrame(canvas, { timestamp: frame.timestamp });
  encodeFrame(editedFrame);
}
```

### Encode the edited video
The `VideoEncoder` converts your edited `VideoFrame` objects back into a compressed bitstream.

```javascript
const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    // EncodedVideoChunk contains the compressed data
    // metadata.decoderConfig will contain specific data (like description/extradata) 
    // required for muxing into a container like MP4 or WebM
    saveChunkToContainer(chunk, metadata);
  },
  error: (e) => console.error('Encoder error:', e),
});

encoder.configure({
  codec: 'vp08',
  width: 1920,
  height: 1080,
  bitrate: 5_000_000, // 5Mbps for 1080p; adjust based on resolution and quality needs
  framerate: 30,
});

function encodeFrame(frame) {
  // Keyframes should be inserted periodically (e.g., every 150 frames) 
  // to allow seeking in the resulting file
  const insertKeyframe = frameCount % 150 === 0;
  encoder.encode(frame, { keyFrame: insertKeyframe });
  
  // Close the edited frame immediately after passing it to the encoder
  frame.close();
  frameCount++;
}
```

## Fallback strategies

### Fallback strategies
{{ BASELINE_STATUS("webcodecs") }}

WebCodecs is a progressive enhancement for high-performance media tasks. If the browser does not support the API, you must fall back to less efficient or server-side methods.

1.  **Feature Detection**: Check for `VideoEncoder` and `VideoDecoder` on the global object. Use `VideoFrame` in the prototype check for reliability.
    ```javascript
    const isSupported = 'VideoEncoder' in window && 'VideoFrame' in window;
    ```
2.  **Graceful Degradation**: 
    *   **Client-side fallback**: For simple exports, use `HTMLCanvasElement.captureStream()` combined with the `MediaRecorder` API. Note that `MediaRecorder` offers significantly less control over bitrate, keyframes, and frame-accurate timing compared to WebCodecs.
    *   **Server-side fallback**: If high-resolution, high-bitrate export is required and WebCodecs is unavailable, upload the edit metadata (timestamps, crop coordinates, etc.) to a server to be processed via a tool like FFmpeg.
3.  **WASM Alternatives**: Libraries like FFmpeg.wasm can be used as a polyfill-like alternative, but they run in software and will be significantly slower for high-resolution (4K) content than the native WebCodecs API.