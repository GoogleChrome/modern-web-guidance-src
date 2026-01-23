---
description: Access device sensors like accelerometers and gyroscopes to create interactive mobile experiences.
filename: device-motion-orientation
category: ui
---

# Device Motion and Orientation

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events_API
- https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/DeviceMotionEvent

## Best Practices

### Use Device Orientation Events

Device orientation events provide data about the device's rotation in relation to the Earth's coordinate frame, including alpha (z-axis rotation), beta (x-axis rotation), and gamma (y-axis rotation).

- **DO** use device orientation events for applications that require understanding the device's tilt and rotation, such as augmented reality experiences or games controlled by device orientation.
- **DO** check for browser support using `window.DeviceOrientationEvent` before attaching event listeners.
- **DO** listen for the `deviceorientation` event on the `window` object.
- **DO** consider using `requestAnimationFrame` to synchronize UI updates with device orientation changes, rather than updating on every event.
- **DO** be aware that different browsers may use different coordinate systems, and test thoroughly across devices and browsers.
- **DO** handle the optional `webkitCompassHeading` property for compass data on supported platforms.

```js
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', (event) => {
    // Handle alpha, beta, gamma, and potentially webkitCompassHeading
    console.log(`Alpha: ${event.alpha}, Beta: ${event.beta}, Gamma: ${event.gamma}`);
  });
} else {
  console.log("Device orientation events not supported.");
}
```

### Use Device Motion Events

Device motion events provide data about the device's acceleration (with and without gravity) and rotation rate.

- **DO** use device motion events when you need to detect physical movement or shake gestures, like for refresh mechanisms or in games.
- **DO** check for browser support using `window.DeviceMotionEvent`.
- **DO** listen for the `devicemotion` event on the `window` object.
- **DO** understand the units: `rotationRate` is in degrees per second, and `acceleration` and `accelerationWithGravity` are in meters per second squared.
- **DO** be mindful of variations in browser implementations and the availability of hardware features (like gravity exclusion).

```js
if (window.DeviceMotionEvent) {
  window.addEventListener('devicemotion', (event) => {
    // Handle acceleration, accelerationIncludingGravity, rotationRate, and interval
    console.log(`Acceleration: ${event.acceleration.x}, ${event.acceleration.y}, ${event.acceleration.z}`);
    console.log(`Rotation Rate: ${event.rotationRate.alpha}, ${event.rotationRate.beta}, ${event.rotationRate.gamma}`);
  });
} else {
  console.log("Device motion events not supported.");
}
```

## Fallback Strategies

While device motion and orientation are widely supported on modern mobile devices, consider the following for broader compatibility:

- **For Device Orientation:** If `DeviceOrientationEvent` is not supported, you may need to rely on alternative input methods or inform the user about the limitation. Some older desktop browsers might not support these events.
- **For Device Motion:** Similar to device orientation, if `DeviceMotionEvent` is not supported, fallback to alternative user input or provide graceful degradation.
- **Performance Considerations:** For performance-critical applications, throttle event listeners or use `requestAnimationFrame` to avoid excessive computations and ensure a smooth user experience.