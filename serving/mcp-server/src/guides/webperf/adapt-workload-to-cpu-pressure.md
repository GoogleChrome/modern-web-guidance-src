---
description: Adapt web application workloads based on system CPU pressure to maintain optimal performance without causing unmanageable system stress.
filename: adapt-workload-to-cpu-pressure
category: webperf
---

# Adapt Workload to CPU Pressure

The Compute Pressure API provides high-level states representing system pressure, allowing applications to adjust their resource utilization accordingly. This is particularly beneficial for real-time applications like video conferencing and gaming, which can degrade gracefully rather than failing catastrophically.

## Best Practices

### Monitoring System Pressure

*   **DO** use the `PressureObserver` to monitor `"cpu"` pressure states.
*   **DO** configure the `sampleInterval` to balance responsiveness with resource overhead. A `sampleInterval` of 1000-2000ms is often a good starting point.
*   **DO** implement a callback function to process `PressureRecord` objects when pressure changes are detected.

```js
const observer = new PressureObserver((records) => {
  const lastRecord = records[records.length - 1];
  console.log(`Current CPU pressure: ${lastRecord.state}`);
  // Adapt workload based on lastRecord.state
  if (lastRecord.state === 'critical') {
    // Reduce workload significantly
  } else if (lastRecord.state === 'serious') {
    // Reduce workload moderately
  } else {
    // Resume normal workload
  }
});

// Observe CPU pressure with a 1-second interval
observer.observe('cpu', { sampleInterval: 1_000 });
```

### Adapting Workloads

*   **DO** define distinct workload levels (e.g., high, medium, low) corresponding to different pressure states ('nominal', 'serious', 'critical').
*   **DO** scale down non-essential features, reduce media quality (video resolution, frame rate), or simplify rendering complexity when the system is under serious or critical pressure.
*   **DO** consider scaling up or re-enabling features when the pressure returns to nominal.

```js
function adaptWorkload(state) {
  switch (state) {
    case 'critical':
      console.log('System critical: Reducing all non-essential tasks.');
      // Example: Reduce video encoding quality, disable complex animations
      break;
    case 'serious':
      console.log('System serious: Reducing some non-essential tasks.');
      // Example: Lower video frame rate, simplify 3D models
      break;
    case 'nominal':
      console.log('System nominal: All systems go!');
      // Example: Enable all features, use highest quality settings
      break;
    default:
      console.log(`Unknown pressure state: ${state}`);
  }
}

const observer = new PressureObserver((records) => {
  const lastRecord = records[records.length - 1];
  adaptWorkload(lastRecord.state);
});

observer.observe('cpu', { sampleInterval: 1_000 });
```

### Handling Unobserve and Disconnect

*   **DO** use `observer.unobserve(source)` to stop observing a specific source when it's no longer needed.
*   **DO** use `observer.disconnect()` to stop observing all sources and clean up resources when the component or application is being shut down.
*   **DO** consider calling `takeRecords()` before `disconnect()` if you need to process any pending records immediately before the observer is no longer active.

```js
// When shutting down:
observer.disconnect();
```

## Fallback Strategies

The Compute Pressure API is a relatively new feature.

*   **DO** check for the existence of `PressureObserver` in the global scope (`'PressureObserver' in globalThis`) before attempting to use it.
*   **DO** provide alternative, degraded experiences for users on browsers that do not support the API. This might involve a fixed quality setting or a simpler feature set.

```js
if ('PressureObserver' in globalThis) {
  // Initialize and use the API
  const observer = new PressureObserver(callback);
  observer.observe('cpu', { sampleInterval: 1_000 });
} else {
  console.warn('Compute Pressure API not supported. Falling back to default behavior.');
  // Provide a degraded experience or fixed settings
}
```