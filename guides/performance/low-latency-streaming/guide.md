---
name: low-latency-streaming
description: Deliver ultra-low latency live media streams for highly interactive applications.
web-feature-ids:
  - webcodecs
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioData
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioData/AudioData
---

# Deliver ultra-low latency live media streams with WebCodecs

WebCodecs provides low-level access to media decoders and encoders, allowing for the direct manipulation of individual video frames and audio chunks. For ultra-low latency applications like cloud gaming or remote desktop, traditional high-level APIs like `<video>` with HLS or DASH introduce unacceptable buffering delays. WebCodecs allows you to bypass these buffers, processing raw encoded chunks as they arrive over the network and rendering them immediately to a canvas.

## How to implement

### Initializing the VideoDecoder
The `VideoDecoder` requires two callbacks: `output` to handle decoded frames and `error` to handle failures.

```javascript
// Define the output handler first
const handleFrame = (frame) => {
  // Process the VideoFrame (e.g., draw to canvas)
  renderFrame(frame);
  
  // MANDATORY: Always close the frame as soon as you are done with it.
  // VideoFrames are backed by GPU resources; failing to close them 
  // will lead to memory leaks and eventually stall the decoder.
  frame.close();
};

const handleError = (e) => {
  console.error("Decoder error:", e);
};

// Initialize the decoder
const decoder = new VideoDecoder({
  output: handleFrame,
  error: handleError
});
```

### Configuring the decoder
You must configure the decoder with the correct codec string and hardware acceleration preferences before sending chunks.

```javascript
const config = {
  // Example: H.264 Baseline profile (avc1.42E01E)
  // Use 'baseline' for lowest latency as it avoids B-frames that require reordering.
  codec: 'avc1.42E01E', 
  hardwareAcceleration: 'prefer-hardware', // Optimal for performance on mobile/low-power devices.
  optimizeForLatency: true // Explicitly hints to the browser to minimize internal buffering.
};

// Verify if the configuration is supported before applying it
const support = await VideoDecoder.isConfigSupported(config);
if (support.supported) {
  decoder.configure(config);
}
```

### Feeding encoded chunks to the decoder
As encoded data arrives (e.g., via WebSockets), wrap it in an `EncodedVideoChunk` and pass it to the decoder.

```javascript
const processEncodedChunk = (data, isKeyFrame, timestamp) => {
  const chunk = new EncodedVideoChunk({
    type: isKeyFrame ? 'key' : 'delta',
    timestamp: timestamp, // Microseconds. Required for synchronization.
    data: data // ArrayBuffer, TypedArray, or DataView
  });

  // OPTIONAL: Monitor decodeQueueSize to handle backpressure.
  // If the queue grows too large, the network is delivering faster than the hardware can decode.
  if (decoder.decodeQueueSize > 5) {
    console.warn("Decoding lag detected");
  }

  decoder.decode(chunk);
};
```

### Rendering to Canvas
For the lowest possible latency, render `VideoFrame` objects directly to a `CanvasRenderingContext2D` or via WebGL.

```javascript
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const renderFrame = (frame) => {
  // Match canvas size to frame dimensions if they change
  if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
    canvas.width = frame.displayWidth;
    canvas.height = frame.displayHeight;
  }

  // Draw the frame directly. This is significantly faster than 
  // updating the 'src' of a video element.
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
};
```

### Threading with Web Workers
MANDATORY: For production live-streaming, move the `VideoDecoder` and rendering logic into a `Web Worker`. This prevents the main thread's UI tasks from interrupting the decoding pipeline, which is the most common cause of "stutter" in low-latency streams. You can use `OffscreenCanvas` to handle rendering entirely within the worker.

## Fallback strategies

{{ BASELINE_STATUS("webcodecs") }}

### Feature Detection
Check for the existence of `VideoDecoder` in the global scope.

```javascript
if (!('VideoDecoder' in window)) {
  // Fallback to Media Source Extensions (MSE) or a WASM-based decoder
  setupMseFallback();
}
```

### Graceful Degradation
If WebCodecs is unavailable:
1. **Media Source Extensions (MSE)**: This is the standard fallback. It supports a wide range of browsers but introduces higher latency (typically 1-3 seconds) due to required buffer levels.
2. **WASM-based Decoders**: Libraries like FFmpeg compiled to WebAssembly can decode video in software. This works in almost all browsers but has high CPU usage and may struggle with high-resolution/high-frame-rate content.
3. **Standard HTML5 Video**: Falling back to HLS or DASH is the most compatible but least interactive option, with latencies often exceeding 5 seconds.