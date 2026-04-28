## Must pass
- The implementation must use `VideoDecoder` or `VideoEncoder` to handle media processing.
- The implementation must process media at the frame level using `EncodedVideoChunk` or `VideoFrame` objects.
- The implementation must configure the codec with a `latencyMode` of `realtime` or equivalent low-latency settings.
- The implementation must render decoded frames with minimal delay, such as by drawing `VideoFrame` objects to a `Canvas`.

## Must fail
- The implementation relies on `MediaSource` (MSE) with large buffers or segment-based loading which introduces significant latency.
- The implementation uses legacy streaming protocols like standard HLS or DASH without low-latency extensions.
- Media decoding is handled by a CPU-intensive JavaScript-only library instead of the browser's native WebCodecs API.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.