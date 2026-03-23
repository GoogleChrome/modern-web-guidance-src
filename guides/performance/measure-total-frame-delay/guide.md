---
name: measure-total-frame-delay
description: Measure the total time spent executing a series of small tasks that collectively delay a frame.
web-feature-ids:
  - long-animation-frames
sources:
  - https://developer.chrome.com/docs/web-platform/long-animation-frames
  - https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing
  - https://www.speedcurve.com/blog/guide-long-animation-frames-loaf/
  - https://www.debugbear.com/blog/long-animation-frames
  - https://requestmetrics.com/web-performance/long-animation-frame-loaf/
---

# Measure total frame delay

Slow-running JavaScript can have a detrimental effect on both page load performance, and also on interactivity. Modern web applications are more heavily reliant on JavaScript than ever before from multiple sources, including the application code itself (and the framework code it relies on), to third-party scripts that add functionality like chat widgets, video players as well as behind-the-scenes analytics and marketing scripts that are all too easy to forget.

Modern web applications can suffer from "death by a thousand cuts", where no single piece of JavaScript is slow running by itself, but when added together it can cause the application to feel sluggish. This can make it difficult to identify the root causes of poor performance, especially for real users where different device capabilities and conditions can result in these many scripts having a larger or smaller effect.

The Long Animation Frames API is a lightweight API that can be used to identify slow running JavaScript in the field in long running applications.

## How to implement

Long animation frames are monitored using the `PerformanceObserver` interface. It emits a `long-animation-frame` entry when an animation frame takes longer than 50ms to render. The entry contains information about the long animation frame, including the duration of the frame and the scripts that were executed during the frame.

Unlike the Long Tasks API, the Long Animation Frames API measures the total duration of the frame and so can be used to identify frames that are long-running, even when the cause is a number of small running tasks rather than any inidvidual long running tasks.

The `long-animation-frame` entry contains a `scripts` property which is an array of `PerformanceScript` objects. Each `PerformanceScript` object contains information about the script that was executed during the long animation frame, including the `sourceURL` and `duration` of the script.

### Example of identifying the longest running scripts that contribute to long animation frames

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`Long frame duration: ${entry.duration}ms`);
    // Note entry.script object will be empty when loading this demo from local
    // file, instead of from a server.
    console.log(`Total scripts executed: ${entry.scripts.length}`);
    
    // Even if no single script was >50ms, the combined frame might be long.
    // The Long Tasks API would not catch this, but LoAF does.
    const totalScriptTime = entry.scripts.reduce((total, script) => total + script.duration, 0);
    console.log(`Combined script time: ${totalScriptTime}ms`);
  }
});

observer.observe({type: 'long-animation-frame', buffered: true});
```

## Best Practices

- **DO** prefer the Long Animation Frames API over the JS Self-Profiling API as it is lighter and less likely to cause performance issues.
- **DO** summarise the key information as the Long Animation Frames API contains a lot of detail.
- **DO** beacon back the required information to an analytics service.

## Browser support and fallback strategies

{{ BASELINE_STATUS("long-animation-frames") }}.

The Long Animation Frames API is not supported in all browsers, but other browsers do not have alternative APIs with simialr functionality. Therefore, it should be used in supporting browsers without a fallback strategy. In most cases the performance opportunities it identifies will apply to other browsers as well.

