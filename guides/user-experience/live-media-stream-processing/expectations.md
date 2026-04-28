## Must pass
- The application utilizes the `VideoDecoder` or `AudioDecoder` APIs to access raw media frames for low-level processing.
- Every decoded `VideoFrame` or `AudioData` object is explicitly closed using the `.close()` method to prevent memory leaks.
- Real-time effects are applied directly to raw frame data (e.g., via CanvasRenderingContext2D, WebGL, or WebGPU) before display or re-encoding.
- The media processing pipeline maintains low latency by handling frames individually as they are decoded.

## Must fail
- The implementation relies solely on CSS filters or transformations applied to a `<video>` element to achieve visual effects.
- The application performs intensive frame-by-frame pixel manipulation synchronously on the main thread, causing measurable UI jank or dropped frames.
- Media processing is handled via `MediaRecorder` or `captureStream()` workarounds instead of utilizing the dedicated WebCodecs decoding and encoding interfaces.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.