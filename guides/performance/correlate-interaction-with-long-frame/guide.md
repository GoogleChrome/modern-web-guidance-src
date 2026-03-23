---
name: correlate-interaction-with-long-frame
description: Correlate a specific user interaction with the long animation frame that delayed its visual feedback.
web-feature-ids:
  - long-animation-frames
sources:
  - https://developer.chrome.com/docs/web-platform/long-animation-frames
  - https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing
  - https://www.speedcurve.com/blog/guide-long-animation-frames-loaf/
  - https://www.debugbear.com/blog/long-animation-frames
  - https://requestmetrics.com/web-performance/long-animation-frame-loaf/
---

# Correlate interaction with long frame

Poor responsiveness to interactions leads to a poor impression of a page being slow or even completely broken.

Identifying root causes of an unresponsive web page can be tricky especially as it depends on user interactions and environmental conditions such as device capabilities, network. This makes it even more difficult to diagnose compared to a more repeatable and predictable scenario like page load. Lab data only replicates a small subset of real user scenarios so measuring the causes of slow INP in the field is essential.

A full performance trace using the JS Self-Profiling API is a heavyweight solution that is liable to cause peformance problems. The Long Animation Frames API is a lightweight API that can be used to identify slow running JavaScript in the field for INP interactions.

As an alternative to correlating any interaction with a long animation frame, you may wish to concentrate Interaction to Next Paint (INP) interactions. INP is a metric based on the Event Timing API. It measures the worst interaction (minus some outliers) as measure of the page's responsiveness. See the [Identify cuases of poor INP guide](../identify-causes-of-poor-inp/guide.md).

## How to implement

Long animation frames are monitored using the `PerformanceObserver` interface. It emits a `long-animation-frame` entry when an animation frame takes longer than 50ms to render. The entry contains information about the long animation frame, including the duration of the frame and the scripts that were executed during the frame.

The `long-animation-frame` entry contains a `firstUIEventTimestamp` entry which, when non-zero, indicates and interaction occured during this long animation frames.

The `long-animation-frame` entry contains a `scripts` property which is an array of `PerformanceScript` objects. Each `PerformanceScript` object contains information about the script that was executed during the long animation frame, including the `sourceURL` and `duration` of the script.

### Get data for all interactions that occured in a long animation frame

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // If a UI event happened during this frame
    if (entry.firstUIEventTimestamp) {
      // Console log for now, but in a real application would want to beacon 
      // back to an anlytics endpoint
      console.log(`Interaction delayed!`);
      console.log(`First UI event at: ${entry.firstUIEventTimestamp.toFixed(0)}ms`);
      console.log(`Frame duration: ${entry.duration.toFixed(0)}ms`);
      // Note script entries will be empty when loading this demo from a
      // local file, instead of from a server.
      console.log(`Scripts involved:`, entry.scripts);
      
      document.getElementById('output').innerText = 
        `Interaction was delayed by a frame lasting ${entry.duration.toFixed(0)}ms!`;
    }
  }
});
observer.observe({ type: 'long-animation-frame', buffered: true });
```

## Best Practices

- **DO** prefer the Long Animation Frames API over the JS Self-Profiling API as it is lighter and less likely to cause performance issues.
- **DO** suggest monitoring INP interactions initially to reduce the amount of data gathered to the worst interactions when first starting to diagnose responsiveness.
- **DO** beacon back the required information to an analytics service.

## Browser support and fallback strategies

{{ BASELINE_STATUS("long-animation-frames") }}.

The Long Animation Frames API is not supported in all browsers, but other browsers do not have alternative APIs with simialr functionality. Therefore, it should be used in supporting browsers without a fallback strategy. In most cases the performance opportunities it identifies will apply to other browsers as well.
