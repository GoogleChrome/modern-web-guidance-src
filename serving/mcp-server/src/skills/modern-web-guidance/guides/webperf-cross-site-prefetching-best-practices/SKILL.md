---
description: Accelerate page load times for users by prefetching resources from other websites, enhancing user experience and conversion rates.
filename: cross-site-prefetching-best-practices
category: webperf
---

# Cross-site Prefetching Best Practices

This document outlines best practices for implementing cross-site prefetching to improve page load performance.

## Primary Use Case: Speeding up LCP with Cross-Site Prefetching

Cross-site prefetching allows a website to prefetch resources from another domain before the user navigates to it. This significantly reduces the Largest Contentful Paint (LCP) for the target page, leading to a better user experience and potentially higher conversion rates.

## Key Considerations and Solutions

### 1. Privacy-Safe Prefetching

When prefetching across different sites, user privacy must be protected. Without proper safeguards, prefetching requests could inadvertently share user data like IP addresses and cookies with the target site, even if the user never clicks the link.

**Solutions:**

*   **Private Prefetch Proxy:** A solution designed to enable privacy-safe cross-site prefetching.
*   **Signed Exchanges (SXG):** Another technology that facilitates privacy-safe cross-site prefetching.

### 2. Repeat Visitors vs. First-Time Visitors

A critical aspect of cross-site prefetching is handling repeat visitors, as prefetch requests cannot include cookies for privacy reasons.

*   **First-Time Visitors:** Cross-site prefetching can be enabled without modification, as these users have no existing cookies.
*   **Repeat Visitors (Personalized Sites):** If your site relies on cookies for personalization, you need to implement lazy loading for personalized elements. This ensures that personalized content is only fetched and displayed after the user explicitly navigates to the page, at which point cookies become available.
    *   **Fallback Strategy:** If personalization is encoded directly in HTML, continue doing so when cookies are present and use lazy loading as a fallback for prefetched pages.
    *   **Non-Personalized Sites:** If your site is not personalized by cookies, or if personalization is not critical, you can serve the same content to repeat visitors as first-time visitors.

**Technology Support:**

*   **Private Prefetch Proxy:** Currently supports first-time visitors. Ongoing work aims to expand support to repeat visitors.
*   **Signed Exchange (SXG):** Supports cross-site prefetching for both first-time and repeat visitors using the strategies mentioned above.

### 3. Managing Extra Data Serving

Prefetching can lead to increased data serving if users do not click on the prefetched links.

**Mitigation Strategies:**

*   **Aggressive Prefetching Control:** Referrers can be encouraged to be less aggressive with prefetch requests. Both referrers and browsers can focus on prefetching lightweight, critical resources (e.g., main HTML, critical CSS/JS). This is a trade-off between speed benefits and extra traffic.
*   **Offsetting Traffic with Caching:** Opting into additional caching can offset the extra data traffic.
    *   **Signed Exchange:** SXGs can be cached for a period (up to 7 days).
    *   **Trade-off:** Extended caching periods may result in users seeing older content, balancing extra data serving against content freshness.

**Decision Factor:** Evaluate your site's needs on a scale between maximum content freshness and minimal additional requests.

## Getting Started

These technologies are already integrated into platforms like Google Search, enabling immediate LCP improvements. By adopting cross-site prefetching, you can contribute to a faster web for everyone.

Consider these deep dives to choose the best technology for your specific needs:

*   [Deep dive on Private Prefetch Proxy](/blog/private-prefetch-proxy)
*   [Deep dive on Signed Exchange](http://goo.gle/sxg-info)
---