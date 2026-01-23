---
description: Capture full-resolution photos directly within web applications using the Image Capture API, simplifying the user experience by eliminating the need to switch between apps.
filename: image-capture-api
category: media
---

# Image Capture API

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture
- https://developers.google.com/web/updates/2016/12/imagecapture

## Best Practices

The Image Capture API allows web applications to access the full resolution capabilities of a device's camera and control various settings like zoom, brightness, contrast, ISO, and white balance.

### Capturing Full Resolution Photos

To capture a full-resolution photo, you'll typically need to:

1.  **Get User Media:** Request access to the user's camera using `navigator.mediaDevices.getUserMedia()`.
2.  **Create an `ImageCapture` Instance:** Instantiate `ImageCapture` with a `MediaStreamTrack` obtained from the user media stream.
3.  **Take a Photo:** Use the `takePhoto()` method of the `ImageCapture` instance.

```javascript
async function capturePhoto() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);
    const blob = await imageCapture.takePhoto();
    // Process the blob (e.g., display it, upload it)
    const imageUrl = URL.createObjectURL(blob);
    console.log('Photo captured:', imageUrl);
  } catch (error) {
    console.error('Error capturing photo:', error);
  }
}

capturePhoto();
```

### Controlling Camera Settings

You can access and modify camera settings through the `ImageCapture` instance's `getPhotoSettings()` and `setPhotoSettings()` methods.

```javascript
async function adjustCameraSettings() {
  // ... (assume imageCapture is already initialized)

  const settings = await imageCapture.getPhotoSettings();
  console.log('Current settings:', settings);

  // Example: Adjust brightness
  await imageCapture.setPhotoSettings({
    brightness: 0.8 // Value typically between 0 and 1
  });
  console.log('Brightness adjusted.');
}
```

### Feature Detection

Before using the Image Capture API, it's good practice to check for browser support.

```javascript
if ('ImageCapture' in window) {
  console.log('Image Capture API is supported!');
} else {
  console.log('Image Capture API is not supported.');
}
```

## Fallback Strategies

If the Image Capture API is not supported, consider the following fallbacks:

*   **Allow File Upload:** Provide a standard file input element (`<input type="file" accept="image/*">`) for users to select photos they have already taken.
*   **Use the `capture` attribute:** For `<input type="file">`, the `capture` attribute can hint to the browser to open the camera directly.
    *   `capture="user"`: Hints to open the front-facing camera.
    *   `capture="environment"`: Hints to open the rear-facing camera.

```html
<input type="file" accept="image/*" capture="environment">
```

**NOTE:** The `capture` attribute is a hint and its behavior can vary across browsers and devices. The Image Capture API provides more direct and robust control.