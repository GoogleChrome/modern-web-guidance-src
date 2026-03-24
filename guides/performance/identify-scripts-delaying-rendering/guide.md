---
name: identify-scripts-delaying-rendering
description: Identify the specific JavaScript functions responsible for delaying a frame's rendering update to debug Interaction to Next Paint (INP).
web-feature-ids:
  - long-animation-frames
sources:
  - https://developer.chrome.com/docs/web-platform/long-animation-frames
  - https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing
  - https://www.speedcurve.com/blog/guide-long-animation-frames-loaf/
  - https://www.debugbear.com/blog/long-animation-frames
  - https://requestmetrics.com/web-performance/long-animation-frame-loaf/
---

# Identify slow-running JavaScript delaying rendering

Slow-running JavaScript can have a detrimental effect on both page load performance, and also on interactivity. Modern web applications are more heavily reliant on JavaScript than ever before from multiple sources, including the application code itself (and the framework code it relies on), to third-party scripts that add functionality like chat widgets, video players as well as behind-the-scenes analytics and marketing scripts that are all too easy to forget.

Identifying root causes of an unresponsive web page can be tricky with certain expertise required to run web performance tracing or profiling and how to interpret the results. Additionally field data is often very different to lab data, which only replicates a small subset of real user scenarios. This can make it difficult to identify the root causes of poor performance, especially for interactions.

The Long Animation Frames API is a lightweight API that can be used to identify slow running JavaScript in the field in long running applications.

## How to implement

Long animation frames are monitored using the `PerformanceObserver` interface. It emits a `long-animation-frame` entry when an animation frame takes longer than 50ms to render. The entry contains information about the long animation frame, including the duration of the frame and the scripts that were executed during the frame.

The `long-animation-frame` entry contains a `scripts` property which is an array of `PerformanceScript` objects. Each `PerformanceScript` object contains information about the script that was executed during the long animation frame, including the `sourceURL` and `duration` of the script.

### Example of identifying the longest running scripts that contribute to long animation frames

```javascript
const observer = new PerformanceObserver(list => {
  // Collect all script entries across frames to find the biggest offenders.
  const allScripts = list.getEntries().flatMap(entry => entry.scripts);

  // Group by sourceURL so you can identify which scripts contribute
  // the most total time, even if each individual invocation is short.
  const scriptSource = [...new Set(allScripts.map(script => script.sourceURL))];
  const scriptsBySource = scriptSource.map(sourceURL => ([sourceURL,
      allScripts.filter(script => script.sourceURL === sourceURL)
  ]));
  const processedScripts = scriptsBySource.map(([sourceURL, scripts]) => ({
    sourceURL,
    count: scripts.length,
    totalDuration: scripts.reduce((subtotal, script) => subtotal + script.duration, 0)
  }));

  // Sort by total duration so the worst offenders appear first,
  // making it easier to prioritize optimization efforts.
  processedScripts.sort((a, b) => b.totalDuration - a.totalDuration);

  // Beacon the summarized data to an analytics service so it can be
  // analyzed across real users rather than just logged locally.
  navigator.sendBeacon(
    '/analytics',
    JSON.stringify(processedScripts)
  );
});

observer.observe({type: 'long-animation-frame', buffered: true});
```

## Best Practices

- **DO** prefer the Long Animation Frames API over the JS Self-Profiling API as it is lighter and less likely to cause performance issues.
- **DO** summarize the key information as the Long Animation Frames API contains a lot of detail.
- **DO** beacon back the required information to an analytics service.

## Browser support and fallback strategies

{{ BASELINE_STATUS("long-animation-frames") }}.

The Long Animation Frames API is not supported in all browsers, but other browsers do not have alternative APIs with similar functionality. Therefore, it should be used in supporting browsers without a fallback strategy. In most cases the performance opportunities it identifies will apply to other browsers as well.
