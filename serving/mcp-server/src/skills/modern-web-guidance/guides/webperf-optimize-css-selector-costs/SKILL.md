---
description: Optimize CSS selector performance by reducing their complexity, count, and the DOM's size to improve the "Recalculate style" cost.
filename: optimize-css-selector-costs
category: webperf
---

# Optimize CSS selector costs

Reference docs:
- https://source.chromium.org/chromium/chromium/src/+/main:third_party/devtools-frontend/src/front_end/models/trace/insights/SlowCSSSelector.ts
- https://web.dev/articles/reduce-the-scope-and-complexity-of-style-calculations

## Best Practices

To reduce high **recalculate style** costs, optimize your CSS selectors. Focus on selectors that have both a high elapsed time and a high slow-path percentage.

The following strategies will help reduce matching costs:

-   **Simplify selectors:** Use the most direct selectors possible. Avoid overly complex or nested selectors.
-   **Reduce the number of selectors:** Unused or redundant selectors add unnecessary overhead.
-   **Optimize the DOM:**
    -   **Smaller DOM:** A smaller Document Object Model means less for the browser to traverse.
    -   **Shallower DOM:** A shallower DOM hierarchy reduces the depth of traversals.

By implementing these practices, you can significantly improve the performance of style recalculations.

## Important Notes

This insight is available in the DevTools **Performance** panel when the setting **Enable CSS selector stats (slow)** is turned on. Be aware that collecting CSS selector statistics incurs a performance overhead. CSS performance is generally better when this setting is disabled, but it can be a valuable tool for identifying the slowest-performing selectors.

This insight is not available in PageSpeed Insights.

## Additional References

-   [Analyze CSS selector performance during Recalculate Style events](/docs/devtools/performance/selector-stats)