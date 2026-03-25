---
name: identify-inp-causes
description: Identify slow running JavaScript that is impacting INP metric
web-feature-ids:
  - long-animation-frames
sources:
  - https://web.dev/articles/inp
  - https://web.dev/articles/find-slow-interactions-in-the-field
  - https://developer.chrome.com/docs/web-platform/long-animation-frames
  - https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing
  - https://www.speedcurve.com/blog/guide-long-animation-frames-loaf/
  - https://www.debugbear.com/blog/long-animation-frames
  - https://requestmetrics.com/web-performance/long-animation-frame-loaf/
---

# Identify causes of poor INP

Poor responsiveness to interactions leads to a poor impression of a page being slow or even completely broken. Interaction to Next Paint (INP) is a metric based on the Event Timing API. It measures the worst interaction (minus some outliers) as a measure of the page's responsiveness.

Identifying root causes of an unresponsive web page can be tricky especially as it depends on user interactions and environmental conditions such as device capabilities and network conditions. This makes it even more difficult to diagnose compared to a more repeatable and predictable scenario like page load. Lab data only replicates a small subset of real user scenarios so measuring the causes of slow INP in the field is essential.

A full performance trace using the JS Self-Profiling API is a heavyweight solution that is liable to cause performance problems. The Long Animation Frames API is a lightweight API that can be used to identify slow running JavaScript in the field for INP interactions.

## How to implement

Calculating INP from the raw Event Timing API is complicated and has several nuances. You are advised to use a RUM tool or library to gather this data.

`web-vitals` is an open-source library from Google that calculates the Core Web Vitals including INP, and also includes long animation frame data for the INP interaction.

### Get Long Animation Frame data for INP interactions using web-vitals library

The [`web-vitals` library](https://github.com/GoogleChrome/web-vitals) is a tiny library used to measure Core Web Vitals and other performance metrics. The `onINP()` function can be used to identify the slowest interaction and includes information about the scripts that were executed during the interaction using the Long Animation Frames API.

```javascript
// Use the attribution build to get Long Animation Frame data
// alongside the INP metric value.
import { onINP } from 'web-vitals/attribution';

onINP((metric) => {
  // Beacon script attribution for the longest script during the INP
  // interaction, so you can identify the root cause in production.
  navigator.sendBeacon(
    '/analytics',
    JSON.stringify({
      name: 'INP',
      value: metric.value,
      // These fields identify which script function was responsible
      // for the longest processing during the INP interaction.
      invokerType: metric.attribution.longestScript.entry?.invokerType,
      sourceURL: metric.attribution.longestScript.entry?.sourceURL,
      sourceFunctionName: metric.attribution.longestScript.entry?.sourceFunctionName,
      sourceCharPosition: metric.attribution.longestScript.entry?.sourceCharPosition,
      // subpart indicates which phase (input delay, processing, or
      // presentation delay) the longest script overlapped with most.
      subpart: metric.attribution.longestScript.subpart,
      intersectingDuration: metric.attribution.longestScript.intersectingDuration
    })
  );
});
```

## Best Practices

- **DO** prefer the Long Animation Frames API over alternatives like the JS Self-Profiling API, which carries higher runtime overhead.
- **DO** use the `web-vitals` library if no other RUM solution is in place. It can identify the INP interaction and includes information about the scripts that were executed during the interaction (using the Long Animation Frames API).
- **DO** beacon back the required information to an analytics service rather than just log it locally.

## Browser support and fallback strategies

{{ BASELINE_STATUS("long-animation-frames") }}.

The Long Animation Frames API is not supported in all browsers, but other browsers do not have alternative APIs with similar functionality. Therefore, it should be used in supporting browsers without a fallback strategy. In most cases the performance opportunities it identifies will apply to other browsers as well.
