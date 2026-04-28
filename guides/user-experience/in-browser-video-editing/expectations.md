## Must pass
- The implementation instantiates `VideoEncoder` and `VideoDecoder` to handle video data processing.
- The `VideoEncoder` is configured with a high-resolution specification (e.g., 1280x720 or higher).
- The application processes `VideoFrame` objects for frame-accurate editing.
- The implementation handles `EncodedVideoChunk` outputs to assemble the final exported video.
- Hardware acceleration is utilized via the `hardwareAcceleration: "prefer-hardware"` configuration option where available.

## Must fail
- The implementation relies on `MediaRecorder` for the export process, which lacks the fine-grained bitrate and keyframe control required for high-resolution mastering.
- The application uses `canvas.captureStream()` as the primary mechanism for video generation instead of direct WebCodecs encoding.
- The implementation performs frame extraction using synchronous methods like `canvas.toDataURL()`, which blocks the main thread and degrades performance.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.