---
name: local-media-transcoding
description: Transcode or record media files locally to improve performance and user privacy.
web-feature-ids:
  - webcodecs
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioData
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioData/AudioData
---

# Local media transcoding and recording with WebCodecs

WebCodecs provides low-level access to the device's hardware-accelerated media encoders and decoders directly in the browser. Performing transcoding or recording locally is the recommended approach for modern web applications because it eliminates the latency and bandwidth costs associated with uploading large media files to a server. This strategy significantly improves user privacy by keeping sensitive media data on the client device and enables high-performance media workflows that were previously only possible in native applications.

## How to implement

### Detecting support and verifying codec compatibility
Before initializing an encoder or decoder, you must verify that the browser supports the API and the specific codec configuration you intend to use. Codec strings (like `avc1.42E01E` for H.264) are highly specific; hardware support varies significantly across devices.

```javascript
// Check for the existence of the API
if (!('VideoEncoder' in window)) {
  console.error('WebCodecs is not supported in this browser.');
}

const config = {
  codec: 'vp09.00.10.08', // VP9 Profile 0, Level 1.0, 8-bit
  width: 1920,
  height: 1080,
  bitrate: 5_000_000, // 5 Mbps target bitrate
  framerate: 30,
};

// DO check for configuration support before proceeding to initialization
const { supported, config: refinedConfig } = await VideoEncoder.isConfigSupported(config);

if (!supported) {
  // MANDATORY: Provide a fallback or error if the specific hardware cannot handle the config
  throw new Error('The requested codec configuration is not supported on this hardware.');
}
```

### Initializing the encoder and handling output
The `VideoEncoder` requires an output callback that receives `EncodedVideoChunk` objects. These chunks represent the compressed media data, which can then be muxed into a container format (like MP4 or WebM) or streamed.

```javascript
const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    // metadata.decoderConfig contains data needed to initialize a decoder for this stream
    // MANDATORY: Process or buffer the chunk.data (ArrayBuffer) immediately
    processEncodedChunk(chunk);
  },
  error: (e) => {
    console.error(`Encoder error: ${e.message}`);
  }
});

encoder.configure(refinedConfig);
```

### Encoding frames and managing memory
When recording from a source like a `<canvas>` or a camera, you must wrap the source in a `VideoFrame`. Managing the lifecycle of these frames is critical to performance and stability.

```javascript
async function captureAndEncode(canvas, encoder, frameCount) {
  for (let i = 0; i < frameCount; i++) {
    // Create a frame from the current state of the canvas
    // MANDATORY: Provide a timestamp in microseconds
    const timestamp = performance.now() * 1000;
    const frame = new VideoFrame(canvas, { timestamp });

    // Keyframes should be requested at regular intervals or on scene changes
    const insertKeyframe = i % 60 === 0;

    encoder.encode(frame, { keyFrame: insertKeyframe });

    // MANDATORY: You MUST close the frame object immediately after passing it to the encoder.
    // Failing to close frames will cause a memory leak and eventually stall the video pipeline.
    frame.close();
    
    // Optional: Wait for the next animation frame to capture smooth movement
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  
  // MANDATORY: flush() ensures all pending frames are processed before finishing
  await encoder.flush();
}
```

## Performance considerations

### Avoiding main thread jank
Encoding and decoding video are CPU-intensive operations. Performing these tasks on the main thread can lead to "jank" (dropped frames, unresponsive UI) because the browser's event loop is blocked by the heavy processing.

To maintain a smooth 60fps UI, always offload WebCodecs operations to a **Web Worker**. WebCodecs is specifically designed to be "Transferable," meaning you can send `VideoFrame` and `AudioData` objects between the main thread and workers with zero-copy overhead.

### Using Web Workers for encoding
Moving the encoder to a worker ensures that your application remains responsive even during high-bitrate transcoding.

```javascript
// main.js
const worker = new Worker('encoder-worker.js');
const canvas = document.querySelector('canvas');
const stream = canvas.captureStream();
const [track] = stream.getVideoTracks();
const processor = new MediaStreamTrackProcessor({ track });
const reader = processor.readable.getReader();

// Transfer a ReadableStream or individual frames to the worker
const readableStream = processor.readable;
worker.postMessage({ type: 'init', readableStream }, [readableStream]);

// encoder-worker.js
self.onmessage = async (e) => {
  if (e.data.type === 'init') {
    const reader = e.data.readableStream.getReader();
    const encoder = new VideoEncoder({
      output: (chunk) => self.postMessage({ type: 'chunk', chunk }),
      error: (err) => console.error(err)
    });
    
    encoder.configure({ /* ...config */ });

    while (true) {
      const { done, value: frame } = await reader.read();
      if (done) break;
      encoder.encode(frame);
      frame.close();
    }
  }
};
```

### Memory management and object lifecycle
The most common cause of performance degradation in WebCodecs applications is failing to call `.close()` on `VideoFrame` and `AudioData` objects. These objects are handles to large buffers of raw media data (often in GPU memory). If they are not explicitly closed, the browser will eventually run out of memory, causing the video pipeline to stall or the tab to crash.

## Fallback strategies

### Fallback strategies
{{ BASELINE_STATUS("webcodecs") }}

If WebCodecs is not supported, you must implement a fallback strategy based on the requirements of your application:

1.  **Feature Detection**: Check for `VideoEncoder` and `VideoDecoder` in the global scope. If missing, disable recording features or redirect the user to a server-side processing route.
2.  **WebAssembly Fallback (WASM)**: For critical transcoding needs where local processing is mandatory, use a WASM-compiled version of a library like FFmpeg. While significantly slower than WebCodecs because it lacks direct hardware access, it provides a consistent functional fallback.
3.  **Server-Side Processing**: If the client device lacks the necessary hardware or API support, fall back to uploading the raw or lightly compressed media to a server for transcoding.
4.  **MediaRecorder API**: For simple recording tasks (capture only), use the `MediaRecorder` API. It is more widely supported but offers far less control over encoding parameters, bitrate, and frame-level manipulation than WebCodecs.

```javascript
/**
 * Example of conditional loading for a WebAssembly fallback
 */
async function getTranscoder() {
  if ('VideoEncoder' in window) {
    // Use high-performance WebCodecs implementation
    return new WebCodecsTranscoder();
  } else {
    // OPTIONAL: Conditionally load heavy WASM assets only when necessary
    const { FfmpegTranscoder } = await import('./wasm-transcoder.js');
    return new FfmpegTranscoder();
  }
}