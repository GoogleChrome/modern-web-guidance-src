---
description: Enable extensions to react to Chrome DevTools Performance panel recording status changes for enhanced automation during profiling.
filename: devtools-performance-recording-status
category: extensions
---

# Reacting to Chrome DevTools Performance Recording Status

This document outlines how to use the `chrome.devtools.performance` API to receive notifications when the Performance panel in Chrome DevTools starts or stops recording performance data. This is useful for building extensions that can automate tasks or provide feedback based on the profiling status.

## Best Practices

Listen to the `onProfilingStarted` and `onProfilingStopped` events to implement custom logic when profiling begins or ends.

```js
// Listen for when profiling starts
chrome.devtools.performance.onProfilingStarted.addListener(() => {
  console.log('Performance profiling has started.');
  // Add your custom logic here, e.g., enabling specific logging or disabling other features.
});

// Listen for when profiling stops
chrome.devtools.performance.onProfilingStopped.addListener(() => {
  console.log('Performance profiling has stopped.');
  // Add your custom logic here, e.g., processing collected data or re-enabling features.
});
```

### Event Details

Both `onProfilingStarted` and `onProfilingStopped` events do not carry any associated parameters.

## Concepts and Usage

The `chrome.devtools.performance` API provides a way for extensions to integrate with the recording capabilities of the Chrome DevTools Performance panel. By subscribing to the provided events, developers can create extensions that offer additional functionality or automation during performance profiling sessions.

The primary events available are:

*   **`onProfilingStarted`**: Fired when the Performance panel begins recording performance data.
*   **`onProfilingStopped`**: Fired when the Performance panel stops recording performance data.

By leveraging these events, developers can build more sophisticated DevTools extensions that can dynamically adjust their behavior based on the user's profiling activity.

## Fallback Strategies

This API is generally available within the DevTools environment. Specific browser version support for advanced features related to performance profiling might vary. Always refer to the [Chrome DevTools API documentation](https://developer.chrome.com/docs/extensions/reference/api/devtools) for the most up-to-date information on feature availability and any potential polyfill requirements for older browser versions if building for a wide range of Chrome versions.

## Related Links

*   [DevTools APIs summary](/docs/extensions/how-to/devtools/extend-devtools)
*   [Performance panel in Chrome DevTools](/docs/devtools/performance)