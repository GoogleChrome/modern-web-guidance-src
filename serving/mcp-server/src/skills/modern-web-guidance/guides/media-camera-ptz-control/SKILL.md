---
description: Enable web applications to control camera pan, tilt, and zoom features through browser APIs.
filename: camera-ptz-control
category: media
---

# Control Camera Pan, Tilt, and Zoom

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/applyConstraints
- https://developer.chrome.com/docs/web-platform/ptz-camera-control

## Best Practices

### Feature Detection

Before attempting to control camera PTZ, detect if the browser supports the necessary constraints. Note that `navigator.mediaDevices.getSupportedConstraints()` indicates browser support, not necessarily camera hardware support.

```js
const supports = navigator.mediaDevices.getSupportedConstraints();
if (supports.pan && supports.tilt && supports.zoom) {
  // Browser supports camera PTZ capabilities.
}
```

### Requesting Camera PTZ Access

User permission is required to control camera PTZ. Request access by calling `navigator.mediaDevices.getUserMedia()` with PTZ constraints. This will prompt the user for both regular camera and PTZ permissions.

```js
try {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { pan: true, tilt: true, zoom: true }
  });
  document.querySelector("video").srcObject = stream;
} catch (error) {
  console.log(error); // User denies prompt or media is unavailable.
}
```

A previously granted camera permission without PTZ access does not automatically include PTZ capabilities if they become available. The permission must be re-requested. Use the [Permissions API] to query and monitor PTZ permission status.

```js
try {
  const panTiltZoomPermissionStatus = await navigator.permissions.query({
    name: "camera",
    panTiltZoom: true
  });

  if (panTiltZoomPermissionStatus.state == "granted") {
    // User has granted PTZ control.
  }

  panTiltZoomPermissionStatus.addEventListener("change", () => {
    // PTZ permission status has changed.
  });
} catch (error) {
  console.log(error);
}
```

### Controlling PTZ Settings

Manipulate camera PTZ capabilities and settings using the `MediaStreamTrack` object obtained from `getUserMedia`. Use `getCapabilities()` to retrieve supported ranges and `getSettings()` for current values.

```js
const [videoTrack] = stream.getVideoTracks();
const capabilities = videoTrack.getCapabilities();
const settings = videoTrack.getSettings();

// Example for pan control
if ("pan" in settings) {
  const panSlider = document.querySelector("#pan-slider"); // Assuming an input range element
  panSlider.min = capabilities.pan.min;
  panSlider.max = capabilities.pan.max;
  panSlider.step = capabilities.pan.step;
  panSlider.value = settings.pan;

  panSlider.addEventListener("input", async () => {
    await videoTrack.applyConstraints({ advanced: [{ pan: panSlider.value }] });
  });
}
// Similar logic for tilt and zoom
```

Alternatively, you can configure PTZ settings when initially requesting media using `getUserMedia` with ideal constraint values. Mandatory constraints (min, max, exact) are not allowed in this scenario.

```js
const stream = await navigator.mediaDevices.getUserMedia({
  video: { pan: 0, deviceId: { exact: "myCameraDeviceId" } } // Example: Reset pan to 0
});
```

### Security Considerations

Access to camera PTZ is gated by the same permission model as the Media Capture and Streams API. The website can only control camera PTZ when the page is visible to the user.

## Fallback Strategies

If a browser does not support PTZ control:

- **DO NOT** attempt to use PTZ-specific APIs.
- **DO** gracefully degrade the user experience, perhaps by informing the user that PTZ controls are unavailable.
- **DO** consider providing alternative methods for the user to achieve their desired outcome if possible.

## Helpful Links

- [PTZ Explainer](https://github.com/w3c/mediacapture-image/blob/master/ptz-explainer.md)
- [Specification draft](https://w3c.github.io/mediacapture-image/)
- [ChromeStatus entry](https://www.chromestatus.com/feature/5570717087170560)