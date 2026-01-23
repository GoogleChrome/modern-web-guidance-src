---
description: Enable seamless video playback across different codecs and containers using Media Source Extensions' new `changeType()` method.
filename: mse-codec-switching
category: media
---

# Media Source Extensions: Codec and Container Switching

Reference docs:
- [Media Source Extensions]: https://developers.google.com/web/fundamentals/media/mse/basics
- [SourceBuffer.changeType() Explainer](https://github.com/wicg/media-source/blob/codec-switching/codec-switching-explainer.md)
- [Sample](https://googlechrome.github.io/samples/media/sourcebuffer-changetype.html)

## Best Practices

Chrome 70 introduces the `changeType()` method to `SourceBuffer` within Media Source Extensions (MSE), allowing for dynamic switching between different codecs and container formats without needing to create new media elements or `SourceBuffer` tracks. This significantly improves the smoothness of media playback during transitions.

### Implementing `changeType()`

When appending media data to a `SourceBuffer`, you can later change the `SourceBuffer`'s type to accommodate a different set of codecs or container formats. This is particularly useful for scenarios where you need to adapt to varying network conditions or client capabilities.

```js
const sourceBuffer = myMediaSource.addSourceBuffer('video/webm; codecs="opus, vp09.00.10.08"');
sourceBuffer.appendBuffer(someWebmOpusVP9Data);

// Later, when you need to switch to a different format:
if ('changeType' in sourceBuffer) {
  // Change the source buffer type.
  sourceBuffer.changeType('video/mp4; codecs="mp4a.40.5, avc1.4d001e"');
  // Append new data compatible with the new type.
  sourceBuffer.appendBuffer(someMp4AacAvcData);
}
```

### Error Handling

If the browser does not support the MIME type provided to `changeType()`, a `NotSupportedError` exception will be thrown. It's good practice to wrap `changeType()` calls in a `try...catch` block to handle such cases gracefully.

```js
if ('changeType' in sourceBuffer) {
  try {
    sourceBuffer.changeType('video/mp4; codecs="mp4a.40.5, avc1.4d001e"');
    sourceBuffer.appendBuffer(someMp4AacAvcData);
  } catch (e) {
    if (e.name === 'NotSupportedError') {
      console.warn('Codec switching to MP4 with AAC/AVC is not supported.');
      // Implement fallback logic here, e.g., use a different media element.
    } else {
      throw e; // Re-throw other errors
    }
  }
}
```

### Feature Detection

Before attempting to use `changeType()`, you can check for its existence on the `SourceBuffer` object.

```js
if ('changeType' in sourceBuffer) {
  // `changeType()` is supported, proceed with dynamic switching.
} else {
  // `changeType()` is not supported, use alternative methods (e.g., multiple SourceBuffers).
}
```

## Fallback Strategies

If `changeType()` is not supported, developers should resort to the traditional method of using multiple `SourceBuffer` instances or media elements and switching between them. This approach, while functional, increases application complexity and can introduce more noticeable latency during transitions compared to `changeType()`.

### Using Multiple SourceBuffers

To maintain playback continuity when `changeType()` is unavailable, you can prepare multiple `SourceBuffer` instances, each configured for a different codec or container. You would then manage the playback by switching the `MediaSource`'s active `SourceBuffer` or by controlling multiple video elements.

```js
// Example conceptual outline
const mediaSource = new MediaSource();
const video = document.createElement('video');
video.src = URL.createObjectURL(mediaSource);

let sourceBufferWebm;
let sourceBufferMp4;

mediaSource.addEventListener('sourceopen', () => {
  sourceBufferWebm = mediaSource.addSourceBuffer('video/webm; codecs="opus, vp09.00.10.08"');
  // Append initial WEBM data...

  // Later, if needing to switch to MP4:
  if (mediaSource.sourceBuffers.length > 1) { // Assuming a second sourceBuffer for MP4 is already added
     // Logic to switch to the MP4 sourceBuffer for appending new data
  }
});
```