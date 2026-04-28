---
name: live-media-stream-processing
description: Apply real-time visual or audio effects to live media streams.
web-feature-ids:
  - webcodecs
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioData
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioData/AudioData
---

# Applying real-time effects to live media streams

WebCodecs provides low-level access to individual media frames, enabling high-performance transformations of live media streams with minimal latency. By extracting `VideoFrame` or `AudioData` objects directly from a `MediaStreamTrack`, developers can apply complex visual filters, background removal, or audio spatialization before re-encoding or displaying the result.

## How to implement

### Setting up the media pipeline
To process a live stream, you must convert a `MediaStreamTrack` into a stream of frames using `MediaStreamTrackProcessor`. This creates a `ReadableStream` that yields `VideoFrame` objects for video or `AudioData` objects for audio.

```javascript
// MANDATORY: Check for support before initializing the processor
if ('MediaStreamTrackProcessor' in window) {
  const videoTrack = stream.getVideoTracks()[0];
  const processor = new MediaStreamTrackProcessor({ track: videoTrack });
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });

  // Pipe the processor (source) through a transform (effect) to the generator (sink)
  processor.readable
    .pipeThrough(new TransformStream({ transform: applyEffect }))
    .pipeTo(generator.writable);

  // Use the generator track as a source for a <video> element or WebRTC
  const processedStream = new MediaStream([generator]);
}
```

### Frame manipulation and filters
Individual `VideoFrame` objects can be manipulated using the Canvas API, WebGL, or WebGPU. For high-performance visual effects, drawing the frame to a `WebGLRenderingContext` is the recommended approach.

```javascript
async function applyEffect(frame, controller) {
  // MANDATORY: VideoFrame objects are backed by hardware memory; 
  // you must close them as soon as you are done with them.
  
  const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
  const ctx = canvas.getContext('2d');

  // Draw the original frame to the canvas
  ctx.drawImage(frame, 0, 0);
  
  // Apply a simple visual effect (e.g., grayscale)
  ctx.filter = 'grayscale(100%)';
  ctx.drawImage(canvas, 0, 0);

  // Create a new VideoFrame from the manipulated canvas
  const newFrame = new VideoFrame(canvas, { timestamp: frame.timestamp });
  
  // Close the original frame to free hardware resources immediately
  frame.close();
  
  // Send the new frame to the next stage in the pipeline
  controller.enqueue(newFrame);
}
```

### Managing hardware resources
WebCodecs interactions often involve hardware-accelerated resources. Stalling the pipeline or failing to release frames can lead to memory exhaustion or browser crashes.

*   **MANDATORY**: Always call `frame.close()` on every `VideoFrame` or `AudioData` object once it is no longer needed.
*   **MANDATORY**: When creating a new `VideoFrame` from a source, ensure the `timestamp` is preserved from the original frame to maintain media synchronization.
*   **OPTIONAL**: Perform heavy frame processing inside a `Web Worker` to prevent blocking the main UI thread, especially when using complex WebGL shaders or WebAssembly.

## Fallback strategies

### Fallback strategies
{{ BASELINE_STATUS("webcodecs") }}

If WebCodecs or Insertable Streams (Processor/Generator) are not supported, you must fall back to a legacy Canvas-based processing loop.

1.  **Feature Detection**: Check for `MediaStreamTrackProcessor` in the global scope.
2.  **Graceful Degradation**: 
    *   If unsupported, use `requestVideoFrameCallback()` on a hidden `<video>` element to capture frames.
    *   Draw each frame to a visible `<canvas>` and apply effects via the 2D context.
    *   Capture the result using `canvas.captureStream()`.
3.  **Performance Note**: Legacy fallbacks have significantly higher CPU/GPU overhead because they require copying data between the GPU and CPU memory spaces multiple times per frame.

```javascript
// Feature detection for WebCodecs-based stream processing
const isSupported = 'MediaStreamTrackProcessor' in window && 'VideoFrame' in window;

if (!isSupported) {
  // MANDATORY: Fallback to requestVideoFrameCallback for older browsers
  const video = document.createElement('video');
  video.srcObject = sourceStream;
  
  const processFallback = () => {
    // Apply effects via standard canvas drawing
    ctx.drawImage(video, 0, 0);
    applyLegacyFilters(ctx);
    video.requestVideoFrameCallback(processFallback);
  };
  
  video.requestVideoFrameCallback(processFallback);
}