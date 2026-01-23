---
description: Improve Chromium accessibility performance by optimizing scrolling and cache mechanisms.
filename: chromium-accessibility-performance
category: webperf
---

# Improving Chromium Accessibility Performance

This post details how to optimize the performance of Chromium's accessibility features, focusing on improving scrolling responsiveness and cache efficiency.

## Best Practices

### Cache Improvement

To enhance performance, switch from using closures for scheduling tasks to a system using enums. Assign each task a specific enum value, ensuring the correct method is called once the accessibility tree is ready. This change can lead to significant performance improvements, exceeding 20%.

### Scrolling Performance Optimization

When dealing with accessibility serialization, focus on optimizing scroll performance. If bounding box calculations are identified as a bottleneck, consider alternative approaches.

- **Investigate Slow Tests:** If tests involving focus actions are slow, isolate the issue by disabling scrolling (`{preventScroll: true}` in `focus()` calls). This helps determine if scrolling or bounding box calculations are the primary cause of performance degradation.
- **Replicate Scroll Behavior:** Create dedicated tests (e.g., `scroll-in-page.html`) to accurately measure the performance impact of scrolling with and without bounding box calculations, testing both instant and smooth scrolling.
- **Analyze Performance Bottlenecks:** Utilize profiling tools like `perf` and `pprof` to identify the root cause of slowness in scroll-related accessibility updates. Pay close attention to functions like `Unserialize` and `IsChildOfLeaf`.
- **Optimize Serialization:** If excessive calls to deserialization functions are identified due to frequent "mark as dirty" events during scrolling, implement a faster serialization path. This can involve including current scroll offsets with bounding box serialization to efficiently handle scroll updates without processing unchanged properties. This optimization can yield improvements of up to 825% in scrolling tests.

### Code Simplification

Streamline the accessibility data serialization process from the renderer to the browser by removing unnecessary intermediate layers. Remove outdated events that cause redundant work and replace them with more efficient solutions. While specific performance metrics might not always be recorded for these changes, a clearer and more self-documenting codebase paves the way for future performance enhancements.

## Fallback Strategies

While the input primarily focuses on direct implementation and optimization within Chromium, general principles of fallbacks would apply in a web context:

- **Feature Detection:** Implement robust feature detection for any accessibility-related APIs or features being utilized.
- **Conditional Loading:** Conditionally load polyfills or alternative implementations only when the necessary browser features are not supported.
- **Progressive Enhancement:** Design accessibility features with progressive enhancement in mind, ensuring core functionality is available even in older or less capable environments.