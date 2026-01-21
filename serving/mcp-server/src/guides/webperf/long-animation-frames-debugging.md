---
description: Use the Long Animation Frame API to identify and debug performance bottlenecks caused by long-running JavaScript tasks that impact user interactions.
filename: long-animation-frames-debugging
category: webperf
---

# Debugging Long Animation Frames (LoAF)

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing
- https://web.dev/articles/find-slow-interactions-in-the-field#the_long_animation_frame_api_loaf
- https://github.com/GoogleChrome/web-vitals

## Best Practices

The Long Animation Frame API (LoAF) is crucial for understanding and improving your site's responsiveness, especially concerning the Interaction to Next Paint (INP) metric. By identifying long-running tasks that block the main thread, you can pinpoint the root causes of slow user interactions.

### Utilizing the `web-vitals` JavaScript Library

Version 4 and later of the `web-vitals` library directly incorporates LoAF data. This allows Real User Monitoring (RUM) partners and developers to easily capture and report on long animation frames associated with INP.

- **DO** integrate the latest version of the `web-vitals` JavaScript library to leverage built-in LoAF reporting.
- **DO** consult the `web-vitals` documentation for specific implementation details on accessing LoAF data.
- **DO** use LoAF data from the `web-vitals` library to identify other scripts that are slowing down your INP interactions.

### Using DevTools and Browser Extensions

While the Web Vitals Extension was deprecated, its functionality for surfacing LoAF data has been integrated into Chrome DevTools.

- **DO** inspect the "Performance" tab in Chrome DevTools to analyze long animation frames and their associated tasks.
- **DO** look for long tasks that overlap with user interactions to identify potential INP culprits.
- **DO** examine the call stack of long tasks to pinpoint the specific scripts or functions causing the delay.

### Updating Guidance and Documentation

The official documentation for the Long Animation Frames API has been updated to reflect real-world usage and best practices.

- **DO** refer to the updated [Long Animation Frames API documentation on web.dev](/docs/web-platform/long-animation-frames#use-loaf) for comprehensive guidance.
- **DO** review case studies, such as the one from Taboola, to understand practical applications of LoAF in improving INP.
- **DO** familiarize yourself with the API documentation on MDN ([developer.mozilla.org/docs/Web/API/Performance_API/Long_animation_frame_timing](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing)) for detailed technical information.

## Fallback Strategies

The Long Animation Frame API is a relatively new addition to the web platform. While it is now shipped in Chrome 123+, consider the following for broader compatibility or if you need to support older browsers or specific RUM implementations.

- **DO NOT** rely solely on LoAF for performance analysis in environments where it might not be fully supported.
- **DO** complement LoAF analysis with other performance profiling techniques and tools for a comprehensive view.
- **DO** monitor the adoption and support of LoAF across different browsers and RUM providers to inform your strategy.