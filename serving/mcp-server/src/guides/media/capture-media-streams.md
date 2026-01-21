---
description: Capture real-time media streams from HTML elements like canvas, audio, and video for recording, live-streaming, or manipulation.
filename: capture-media-streams
category: media
---

# Capturing Media Streams from HTML Elements

This document outlines best practices for using the `captureStream()` method to capture `MediaStream` objects from `<canvas>`, `<audio>`, and `<video>` elements.

## Primary Use Case: Real-time Media Manipulation and Streaming

The `captureStream()` method allows developers to obtain a `MediaStream` from various HTML media elements. This stream can then be used for a variety of purposes, including:

*   **Recording:** Capturing audio or video content for later playback.
*   **Live-streaming:** Transmitting media in real-time using WebRTC.
*   **Effects and Compositing:** Manipulating video or audio, overlaying content on a `<canvas>`, or combining multiple media sources.
*   **Interoperability:** Passing media between different `MediaStream`-compatible APIs like `RTCPeerConnection` or `MediaRecorder`.

## Best Practices

### Capturing from Canvas

To capture a `MediaStream` from a `<canvas>` element, use the `canvas.captureStream(frameRate)` method. The optional `frameRate` argument controls the maximum frames per second of the captured stream.

```js
// Get references to the canvas and video elements
const canvas = document.querySelector('canvas');
const video = document.querySelector('video');

// Capture a stream from the canvas at a maximum of 25 frames per second
const stream = canvas.captureStream(25);

// Set the video element's source to the captured stream
video.srcObject = stream;
```

### Capturing from Video or Audio Elements

To capture a `MediaStream` from a `<video>` or `<audio>` element, use the `element.captureStream()` method. It's crucial to call this method only after the media element has started playing, typically within an `onplay` event handler.

```js
const leftVideo = document.getElementById('leftVideo');
const rightVideo = document.getElementById('rightVideo');

// Ensure captureStream() is called after the video starts playing
leftVideo.onplay = function() {
    // Capture the stream from the left video element
    const stream = leftVideo.captureStream();
    // Set the right video element's source to the captured stream
    rightVideo.srcObject = stream;
};
```

<aside class="note"><b>Note:</b> For video elements, `captureStream()` can only be invoked once the element is capable of playing video. Placing it within the <code>onplay</code> handler ensures this condition is met.</aside>

### Use Cases

*   **Game Streaming:** Capture gameplay rendered on a `<canvas>` and stream it live.
*   **Real-time Video Effects:** Capture video from a camera, apply visual effects on a `<canvas>`, and display the modified stream.
*   **Picture-in-Picture:** Composite multiple video streams onto a single `<canvas>` for picture-in-picture effects.
*   **Interactive Media:** Combine video, images, and dynamic content generated on a `<canvas>` into a single stream.
*   **Video Conferencing Enhancements:** Inject custom graphics or overlays into a video stream for enhanced communication.

## Considerations and Limitations

*   **Encrypted Media Extensions (EME):** `captureStream()` will throw an exception if called on a media element that utilizes content protection via EME.
*   **Canvas Frame Rate:** The frame rate specified in `canvas.captureStream(frameRate)` is an upper limit. If nothing is being painted to the canvas, no frames will be captured. The actual capture rate will not exceed the specified `frameRate`, even if the canvas is being rendered at a higher frequency.
*   **Stream Dimensions:** The video dimensions of a stream captured from a `<canvas>` will match the dimensions of that canvas element.

## Demos

### Canvas Capture Demos
*   [Stream from a canvas element to a video element](https://webrtc.github.io/samples/src/content/capture/canvas-video/)
*   [Stream from a canvas element to a peer connection](https://webrtc.github.io/samples/src/content/capture/canvas-pc/)

### Video/Audio Capture Demos
*   [Stream from a video element to a video element](https://webrtc.github.io/samples/src/content/capture/video-video/)
*   [Stream from a video element to a peer connection](https://webrtc.github.io/samples/src/content/capture/video-pc/)

## Browser Support

*   **Canvas `captureStream()`:**
    *   Firefox: 43+
    *   Chrome: 50+ (with `chrome://flags/#enable-experimental-web-platform-features` enabled), 52+ (by default).
*   **Video and Audio `captureStream()`:**
    *   Firefox: 47+
    *   Chrome: 52+ (with `chrome://flags/#enable-experimental-web-platform-features` enabled), 53+ (by default).

## Further Information

*   [Firefox implementation bug](https://bugzilla.mozilla.org/show_bug.cgi?id=664918)
*   [Chrome Platform Status](https://www.chromestatus.com/feature/5522768674160640)
*   [W3C Media Capture from DOM Elements Specification](https://w3c.github.io/mediacapture-fromelement/)