## Must pass
- The implementation must utilize the `VideoEncoder` or `AudioEncoder` interfaces from the WebCodecs API to process media bitstreams.
- Media encoding or transcoding must be performed locally on the client-side without transmitting raw media data to a server.
- The implementation must correctly handle `VideoFrame` or `AudioData` objects as inputs to the encoding process.
- The solution must demonstrate the use of an `output` callback to handle `EncodedVideoChunk` or `EncodedAudioChunk` objects.

## Must fail
- The implementation must not rely on server-side APIs to perform the media transcoding or recording tasks.
- The solution must not use heavy, non-native client-side libraries (such as large Emscripten builds of FFmpeg) for media processing if the same task can be accomplished using the native hardware-accelerated WebCodecs API.
- The implementation must not use the `MediaRecorder` API as a substitute for workflows requiring the granular control and frame-level access provided by WebCodecs.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.