---
description: Use the Long Animation Frames API to diagnose and improve web page responsiveness and smoothness by measuring frame update delays.
filename: long-animation-frames-api-use-cases
category: webperf
---

# Use the Long Animation Frames API in the field

The Long Animation Frames API (LoAF) is designed for real-world measurement to capture crucial data about user interactions that the Long Tasks API couldn't. This allows for the identification and reproduction of interactivity issues that might otherwise go unnoticed.

## Feature Detecting Long Animation Frames API Support

To check if the API is supported in the current browser environment, use the following JavaScript:

```js
if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
  // The LoAF API is supported, proceed with monitoring.
}
```

## Linking to the Longest INP Interaction

A primary application of the Long Animation Frames API is to diagnose and resolve Interaction to Next Paint (INP) issues. INP aims for interactions to be responded to within 200 milliseconds. Since LoAF measures frames exceeding 50ms, most problematic INPs will have associated LoAF data available for diagnosis.

The "INP LoAF" refers to the Long Animation Frame that directly corresponds to the INP interaction. A single INP event might span one or more LoAFs, especially if the interaction occurs late in a rendering cycle.

Recording LoAF data associated with the INP interaction provides significantly more insight into the cause of the slowness. It helps in understanding:

*   **Input Delay:** By examining other scripts running concurrently during the affected frame.
*   **Processing Duration:** If event handlers are not exhibiting the expected performance, other scripts running in the background might be contributing.
*   **Presentation Delay:** Similar to processing duration, other scripts could be delaying frame presentation.

While there isn't a direct API to link INP and LoAF entries, correlation can be achieved by comparing their start and end times. Libraries like `web-vitals` (from v4 onwards) include intersecting LoAFs in the `longAnimationFramesEntries` property of the INP attribution interface.

By analyzing the `scripts` object within the LoAF entry, developers can identify what else was executing during slow interactions. Beacons of this data to analytics services can reveal the underlying causes of sluggish interactions. Aggregating this data across many users can highlight scripts that frequently correlate with slow INP, allowing for prioritization of optimization efforts.

## Reporting More Long Animation Data to an Analytics Endpoint

Focusing solely on INP-related LoAFs might miss other opportunities for improvement that could lead to future INP issues. A more comprehensive approach involves analyzing all LoAFs throughout the page's lifecycle.

However, given the volume of data in each LoAF entry, it's often practical to send only a subset to analytics. Suggested patterns for reducing data volume include:

### Observe Long Animation Frames with Interactions

Monitor all LoAFs that include user interactions (detected via `firstUIEventTimestamp`) and have a significant `blockingDuration`. This often captures the INP LoAF and identifies other important slow interactions.

```js
const REPORTING_THRESHOLD_MS = 100; // Example threshold, adjust as needed

const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (entry.blockingDuration > REPORTING_THRESHOLD_MS &&
        entry.firstUIEventTimestamp > 0
    ) {
      // Log to console for testing, or send to analytics.
      console.log(entry);
    }
  }
});
observer.observe({ type: 'long-animation-frame', buffered: true });
```

### Observe Long Animation Frames with High Blocking Durations

This strategy focuses on LoAFs with high `blockingDuration`, which indicate potential INP problems if a user interacts during these periods.

```js
const REPORTING_THRESHOLD_MS = 100; // Example threshold, adjust as needed

const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (entry.blockingDuration > REPORTING_THRESHOLD_MS) {
      // Log to console for testing, or send to analytics.
      console.log(entry);
    }
  }
});
observer.observe({ type: 'long-animation-frame', buffered: true });
```

### Observe Long Animation Frames During Critical UI Updates for Smoothness

To address smoothness issues, focus on LoAFs with long `duration`, even if their `blockingDuration` is low. This can be noisy, so consider measuring only during critical UI updates.

```js
let measureImportantUIupdate = false; // Flag to control measurement
const REPORTING_THRESHOLD_MS = 100; // Example threshold, adjust as needed

const observer = new PerformanceObserver(list => {
  if (measureImportantUIupdate) {
    for (const entry of list.getEntries()) {
      if (entry.duration > REPORTING_THRESHOLD_MS) {
        // Log to console for testing, or send to analytics.
        console.log(entry);
      }
    }
  }
});
observer.observe({ type: 'long-animation-frame', buffered: true });

async function doUIUpdatesWithMeasurements() {
  measureImportantUIupdate = true;
  await performCriticalUIUpdates(); // Replace with your UI update logic
  measureImportantUIupdate = false;
}
```

### Observe the Worst Long Animation Frames

Instead of using a fixed threshold, collect data on a limited number of the longest LoAFs (e.g., the worst 10) to reduce the volume of data sent to analytics.

```js
const MAX_LOAFS_TO_CONSIDER = 10;
let longestBlockingLoAFs = [];

const observer = new PerformanceObserver(list => {
  longestBlockingLoAFs = longestBlockingLoAFs.concat(list.getEntries())
    .sort((a, b) => b.blockingDuration - a.blockingDuration)
    .slice(0, MAX_LOAFS_TO_CONSIDER);
});
observer.observe({ type: 'long-animation-frame', buffered: true });

// At an appropriate time (e.g., on 'visibilitychange'), beacon longestBlockingLoAFs.
// For local testing:
console.table(longestBlockingLoAFs);
```

These strategies can be combined. For instance, observe the 10 worst LoAFs with interactions exceeding 100ms.

### Identify Common Patterns in Long Animation Frames

Another approach is to identify scripts that frequently appear in LoAF entries. Reporting script execution times and source locations can pinpoint "repeat offenders," especially useful for identifying problematic themes or plugins.

```js
const observer = new PerformanceObserver(list => {
  const allScripts = list.getEntries().flatMap(entry => entry.scripts);
  const scriptSources = [...new Set(allScripts.map(script => script.sourceURL))];
  const scriptsBySource = scriptSources.map(sourceURL => ([
    sourceURL,
    allScripts.filter(script => script.sourceURL === sourceURL)
  ]));

  const processedScripts = scriptsBySource.map(([sourceURL, scripts]) => ({
    sourceURL,
    count: scripts.length,
    totalDuration: scripts.reduce((subtotal, script) => subtotal + script.duration, 0)
  }));

  processedScripts.sort((a, b) => b.totalDuration - a.totalDuration);
  // Log to console for testing, or send to analytics.
  console.table(processedScripts);
});

observer.observe({ type: 'long-animation-frame', buffered: true });
```

## Use the Long Animation Frames API in Tooling

The LoAF API facilitates local debugging and can be integrated into developer tooling.

### Surface Long Animation Frames Data in DevTools

The `performance.measure()` API can be used to surface LoAF data in the DevTools Performance panel's user timings track.

```js
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    performance.measure('LoAF', {
      start: entry.startTime,
      end: entry.startTime + entry.duration,
      detail: {
        devtools: {
          dataType: "track-entry",
          track: "Long animation frames",
          trackGroup: "Performance Timeline",
          color: "tertiary-dark",
          tooltipText: 'LoAF'
        }
      }
    });
  }
});

observer.observe({ type: 'long-animation-frame', buffered: true });
```

Longer term, DevTools integration is expected. This snippet enables surfacing LoAF data in custom tracks.

### Use Long Animation Frames Data in Automated Testing Tools

Automated testing tools can leverage LoAF data in CI/CD pipelines to detect potential performance regressions during test suite execution.

## FAQ

### Why not just extend the Long Tasks API?

The Long Animation Frames API offers a different perspective, focusing on frames rather than individual tasks, providing a more comprehensive view for responsiveness issues. This allows the Long Tasks API to remain available for existing use cases while offering a distinct measurement approach.

### Why might I not have script entries?

This can occur if the long animation frame was caused by rendering work rather than JavaScript execution, or if script attribution is unavailable due to privacy constraints (e.g., cross-origin iframes, web workers).

### Why might I have limited or no source information for script entries?

Source information may be limited if there isn't a clear source to attribute the script execution to. For `no-cors cross-origin` scripts, source details will be restricted to the `sourceURL`. Enabling CORS by adding `crossOrigin = "anonymous"` to script tags can provide fuller attribution details.

### Will this replace the Long Tasks API?

While the Long Animation Frames API is considered a more advanced tool for measuring long tasks, there are currently no plans to deprecate the Long Tasks API.

## Feedback

Feedback can be provided via the [GitHub Issues list](https://github.com/w3c/long-animation-frames/issues/). Bugs in Chrome's implementation can be reported in [Chrome's issue tracker](https://issues.chromium.org/issues/new?component=1456231&template=0).