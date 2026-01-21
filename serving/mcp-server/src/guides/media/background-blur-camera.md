---
description: Control camera background blur using the Background Blur API to enhance video calls and recordings.
filename: background-blur-camera
category: media
---

# Background Blur API

Reference docs:
- [Explainer](https://github.com/riju/backgroundBlur/blob/main/explainer.md)
- [Specification](https://w3c.github.io/mediacapture-extensions/#exposing-mediastreamtrack-source-background-blur-support)
- [Chromium tracking bug](https://crbug.com/1338665)
- [ChromeStatus.com entry](https://chromestatus.com/feature/5077577782263808)
- [TAG Review](https://github.com/w3ctag/design-reviews/issues/826)
- [Intent to Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/Jr9vE8mSS-8/m/ycIHIDZnCgAJ)

## Best Practices

The Background Blur API allows web applications to leverage operating system-level background blur effects for camera feeds, reducing the need for complex client-side processing.

### Enabling the API

To experiment with the Background Blur API:
- **DO** enable the "Experimental Web Platform features" flag at `chrome://flags/#enable-experimental-web-platform-features` for local testing.
- **DO** participate in the ongoing [origin trial](https://developer.chrome.com/docs/web-platform/origin-trials) to enable the feature for your app's visitors. Sign up and include the origin trial token in your HTML or HTTP header. The trial currently ends on November 3, 2023.

### Observing Background Blur Changes

Monitor changes to the background blur setting on a `MediaStreamTrack`:
- **DO** use the `backgroundBlur` boolean setting on a `MediaStreamTrack` to check the current state of background blur.
- **DO** listen for the `"configurationchange"` event on a `MediaStreamTrack`. This event fires when the user changes the background blur setting through operating system affordances.

```javascript
// Prompt the user to grant access to a camera.
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
// Show camera video feed to the user (optional).
document.querySelector("video").srcObject = stream;

// Read current background blur value.
const [track] = stream.getVideoTracks();
let { backgroundBlur } = track.getSettings();
console.log(`Background blur is ${backgroundBlur ? "ON" : "OFF"}`);

// Listen to background blur changes.
track.addEventListener("configurationchange", () => {
  if (backgroundBlur !== track.getSettings().backgroundBlur) {
    backgroundBlur = track.getSettings().backgroundBlur;
    console.log(`Background blur is now ${backgroundBlur ? "ON" : "OFF"}`);
  }
});
```

### Toggling Background Blur

Control the background blur effect:
- **DO** check the `backgroundBlur` array capability on a `MediaStreamTrack` to determine if control is possible. If the array contains two values, you can toggle the effect.
- **DO** use the `applyConstraints()` method on a `MediaStreamTrack` to request the operating system to toggle background blur. The returned promise will resolve on success or reject on error.

```javascript
// Prompt the user to grant access to a camera.
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
// Show camera video feed to the user (optional).
document.querySelector("video").srcObject = stream;

// Check whether the user can toggle background blur in the web app.
const [track] = stream.getVideoTracks();
if (track.getCapabilities().backgroundBlur?.length === 2) {
  const button = document.querySelector("button");
  button.addEventListener("click", toggleBackgroundBlurButtonClick);
  button.disabled = false;
}

async function toggleBackgroundBlurButtonClick() {
  const constraints = {
    backgroundBlur: !track.getSettings().backgroundBlur,
  };
  // Request operating system to toggle background blur.
  await track.applyConstraints(constraints);
  const newSettings = track.getSettings();
  log(`Background blur is now ${newSettings.backgroundBlur ? "ON" : "OFF"}`);
}
```

## Platform Support

The Background Blur API is available in Chrome 114+ on ChromeOS, macOS, and Windows.
- ChromeOS and macOS currently only allow observation of user-initiated changes.
- Windows allows both observation and control of background blur.

## Demo

Explore the functionality with the [official sample](https://googlechrome.github.io/samples/image-capture/background-blur.html). Note that feature availability depends on platform support.

## Feedback

Developer feedback is crucial. [File issues on GitHub](https://github.com/w3c/mediacapture-extensions/issues/) with suggestions and questions. Consider if a boolean value for background blur is sufficient or if a more granular approach (e.g., "light," "strong," "off") would be beneficial, even if not universally supported across operating systems.