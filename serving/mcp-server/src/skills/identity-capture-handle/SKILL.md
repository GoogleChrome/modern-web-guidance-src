---
description: Use Capture Handle to allow web apps to securely identify each other when one is capturing the other, improving collaboration and preventing issues like the "hall of mirrors" effect.
filename: capture-handle
category: identity
---

# Capture Handle

Reference docs:
- https://developer.chrome.com/blog/capture-handle/
- https://wicg.github.io/mediacapture-handle/identity/

## Best Practices

Capture Handle enables more robust and secure collaboration between capturing and captured web applications.

### Captured Side

*   **DO** expose information to potential capturing web apps using `navigator.mediaDevices.setCaptureHandleConfig()`.
*   **DO** set the `handle` property to a unique identifier for your web app (e.g., a UUID).
*   **DO** set `exposeOrigin` to `true` if the capturing app needs to know the origin of the captured app.
*   **DO** configure `permittedOrigins` to control which origins can access the capture handle information. Use `['*']` to allow all origins, or an array of specific origins for more restricted access.
*   **DO NOT** assume the captured app knows it's being captured; rely on communication from the capturing app if needed.

**Example:**

```js
const config = {
  handle: crypto.randomUUID(),
  exposeOrigin: true,
  permittedOrigins: ['*'],
};
navigator.mediaDevices.setCaptureHandleConfig(config);
```

### Capturing Side

*   **DO** obtain a display media stream using `navigator.mediaDevices.getDisplayMedia()`.
*   **DO** access the `MediaStreamTrack` from the obtained stream.
*   **DO** call `getCaptureHandle()` on the `videoTrack` to retrieve capture handle information. This returns `null` if no handle is available or if the capturing app is not permitted to read it.
*   **DO** check the `captureHandle.handle` and `captureHandle.origin` (if available) for identifying the captured app.
*   **DO** monitor `capturehandlechange` events on the `MediaStreamTrack` to react to changes in the capture handle.

**Example:**

```js
// Prompt the user to capture their display (screen, window, tab).
const stream = await navigator.mediaDevices.getDisplayMedia();

// Check if the video track is exposing information.
const [videoTrack] = stream.getVideoTracks();
const captureHandle = videoTrack.getCaptureHandle();
if (captureHandle) {
  console.log('Captured app handle:', captureHandle.handle);
  console.log('Captured app origin:', captureHandle.origin);
}

videoTrack.addEventListener('capturehandlechange', event => {
  const updatedCaptureHandle = event.target.getCaptureHandle();
  // Consume new capture handle...
});
```

## Feature detection

*   **DO** check for `getCaptureHandle()` support using `'getCaptureHandle' in MediaStreamTrack.prototype`.
*   **DO** check for `navigator.mediaDevices.setCaptureHandleConfig()` support using `'setCaptureHandleConfig' in navigator.mediaDevices`.

## Security and Privacy

*   **DO** be aware that `navigator.mediaDevices.setCaptureHandleConfig()` is only available in top-level main frames and secure contexts (HTTPS).
*   **DO** understand that Capture Handle provides a more secure and reliable alternative to methods like "magic pixels" or QR codes for inter-app communication during screen capture.

## Sample

Explore practical implementations with the provided [sample] and demos like [Remote Control] and [Self-Capture Detection].

## Helpful Links

*   [Specification][spec]
*   [Explainer]
*   [TAG review][tag]
*   [Chromium bug][cr-bug]
*   [ChromeStatus.com entry][cr-status]

[spec]: https://w3c.github.io/mediacapture-handle/identity/
[explainer]: https://github.com/w3c/mediacapture-handle/blob/main/identity/explainer.md
[tag]: https://github.com/w3ctag/design-reviews/issues/645
[cr-bug]: https://bugs.chromium.org/p/chromium/issues/detail?id=1200907
[cr-status]: https://www.chromestatus.com/feature/4854125411958784
[sample]: https://chrome.dev/capture-handle/
[remote control]: https://w3c.github.io/mediacapture-handle/identity/demos/remote_control/capturer.html
[self-capture detection]: https://w3c.github.io/mediacapture-handle/identity/demos/self_capture_detection/index.html