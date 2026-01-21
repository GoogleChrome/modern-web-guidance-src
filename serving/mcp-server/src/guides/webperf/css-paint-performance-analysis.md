---
description: Analyze and optimize CSS paint times and page render weight for improved web performance.
filename: css-paint-performance-analysis
category: webperf
---

# Analyzing and Optimizing CSS Paint Times

This article explores how different CSS properties and their combinations impact page render weight and provides strategies for developers to identify and mitigate performance bottlenecks.

## Understanding Render Weight

The process of rendering a web page involves several steps, including painting elements and compositing them onto the screen. Hardware-accelerated paths in browsers like Chrome rasterize page visuals into tiles, which are then handled by the GPU for final drawing. This process, known as compositing, can be influenced by the complexity of CSS properties applied to DOM elements.

The author's experiment involved generating individual HTML pages with varying CSS properties, capturing Skia Pictures, and benchmarking them to obtain paint timings. This revealed that:

*   **Some CSS properties are inherently more expensive to render than others.** For example, `box-shadow` involves complex multi-pass operations, while `opacity` is generally less computationally intensive.
*   **Combinations of CSS properties can lead to synergistic performance impacts**, meaning the combined paint time can be greater than the sum of their individual parts. This is particularly true for specific value permutations of properties like `box-shadow` and `border-radius`.

## Identifying Performance Bottlenecks

To help developers understand and improve their page render weight, the following best practices are recommended:

1.  **Utilize Browser Developer Tools:** Leverage features like Chrome DevTools' Continuous Paint mode to visualize and pinpoint which CSS properties are contributing most significantly to long paint times.
2.  **Integrate CSS Performance Reviews:** Incorporate CSS property evaluations into your existing code review process. Actively look for and question the use of computationally expensive properties such as gradients and complex shadows, especially if they aren't essential for the design.
3.  **Prioritize Performance:** When making design decisions, always err on the side of better performance. While users might not notice subtle styling details, they will certainly feel the impact of a slow-loading or unresponsive website.

## Key Takeaways

*   **CSS properties directly affect page paint times.** Understanding these impacts is crucial for optimizing web performance.
*   **Combinatorial effects** between CSS properties can lead to unexpected performance regressions.
*   Browser software is constantly evolving, and paint timings can change with updates. Therefore, **continuous testing and profiling** are essential.

While automating the precise measurement of page render-weight for every element can be challenging without custom setups, being aware of expensive CSS properties and actively reviewing CSS for performance implications can lead to significant improvements in user experience.

## References

*   [How browsers work](http://www.html5rocks.com/en/tutorials/internals/howbrowserswork/)
*   [Accelerated Rendering in Chrome: The Layer Model](http://www.html5rocks.com/en/tutorials/speed/layers/)
*   [GPU Accelerated Compositing in Chrome](http://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome)
*   [Chrome DevTools : Continuous Paint mode](http://updates.html5rocks.com/2013/02/Profiling-Long-Paint-Times-with-DevTools-Continuous-Painting-Mode)