---
description: Optimize image loading for improved Web Vitals by strategically lazy-loading images below the fold while eagerly loading those in the initial viewport.
filename: optimize-image-loading
category: webperf
---

# Optimize Image Loading

## Best Practices

When implementing image lazy loading, prioritize eagerly loading images that are within the initial viewport ("above the fold") to improve Core Web Vitals, such as Largest Contentful Paint (LCP). Liberal lazy loading of the remaining images conserves data and reduces network contention.

The default lazy loading implementation in WordPress core, which lazy-loads all images including those above the fold, can negatively impact LCP. A more effective approach involves using heuristics to identify and avoid lazy-loading images likely to be in the viewport.

### Heuristics for Above-the-Fold Images

*   **First Featured Image:** Assume the first featured image on a page is above the fold and should not be lazy-loaded.
*   **First Image in Main Content:** Similarly, the first image encountered in the main content area should generally be eagerly loaded.
*   **Page Structure:** Consider factors like the amount of text preceding an image (e.g., heading, paragraph text) to infer if it's likely to be in the initial viewport.

### Implementation Considerations

*   **WordPress Core:** Submit a patch to WordPress core to implement a more intelligent lazy-loading strategy that avoids above-the-fold images.
*   **CMS Guidance:** Update guidance for CMSs to clarify the performance implications of above-the-fold lazy loading and suggest heuristic-based approaches.
*   **Developer Tools:** Flag lazy-loading antipatterns in tools like Lighthouse to help developers identify and correct issues. A potential audit for LCP elements being lazy-loaded would be beneficial.
*   **Field Data Logging:** Developers can add custom logging to their field data to detect instances where the LCP element is lazy-loaded.

```javascript
new PerformanceObserver((list) => {
  const latestEntry = list.getEntries().at(-1);

  if (latestEntry?.element?.getAttribute('loading') == 'lazy') {
    console.warn('Warning: LCP element was lazy loaded', latestEntry);
  }
}).observe({type: 'largest-contentful-paint', buffered: true});
```

*   **Platform-Level Improvements:** Consider potential API improvements at the platform level, such as natively loading the first few images eagerly, even with the `loading` attribute present.

## Fallback Strategies

While the native `loading="lazy"` attribute is widely supported, always test the performance impact on your specific site and user base. If implementing custom lazy loading solutions or relying on CMS defaults, rigorously test their effectiveness and potential drawbacks.

### Browser Support

Ensure your chosen method of lazy loading (native `loading="lazy"` or JavaScript-based) is adequately supported by your target audience's browsers. For older browsers, consider a JavaScript polyfill or a server-side rendering approach for critical images.

### Performance Testing

*   **A/B Testing:** Conduct A/B tests to compare the performance of different lazy loading strategies, especially focusing on LCP and total image bytes loaded.
*   **Real-User Monitoring (RUM):** Utilize RUM data to understand the actual performance experienced by users across different devices and network conditions.
*   **Lab Testing:** Employ tools like WebPageTest for controlled testing of specific scenarios, such as comparing lazy loading enabled versus disabled for above-the-fold content.

By strategically implementing lazy loading and diligently testing its impact, developers can significantly improve website performance and user experience.