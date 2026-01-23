---
description: Optimize web performance by reducing the time it takes for the first byte of a web page's response to arrive.
filename: improve-ttfb
category: webperf
---

# Improve Time to First Byte (TTFB)

## Best Practices

TTFB is a critical metric that measures the time from when a user initiates a request to when the first byte of the response is received. A low TTFB is essential for a fast user experience as it precedes many other user-centric performance metrics like First Contentful Paint (FCP) and Largest Contentful Paint (LCP).

To achieve a good TTFB, aim for the following:

*   **Server Response Time:** Ensure your server responds quickly to navigation requests. A general guideline is to strive for a TTFB of **0.8 seconds or less** for the 75th percentile of users.
*   **Connection and Network Latency:** Minimize DNS lookup times, TCP connection establishment, and TLS negotiation.
*   **Efficient Backend Processing:** Optimize server-side code, database queries, and caching mechanisms to reduce processing time.
*   **Content Delivery Network (CDN):** Utilize a CDN to serve content from servers geographically closer to your users, reducing network latency.

### TTFB Measurement

TTFB can be measured in both the lab and the field using various tools:

*   **Field Tools:**
    *   Chrome User Experience Report (CrUX)
    *   `web-vitals` JavaScript library
*   **Lab Tools:**
    *   Chrome DevTools Network Panel
    *   WebPageTest

#### Measuring TTFB in JavaScript

You can measure TTFB for navigation requests using the Navigation Timing API:

```javascript
new PerformanceObserver((entryList) => {
  const [pageNav] = entryList.getEntriesByType('navigation');
  console.log(`TTFB: ${pageNav.responseStart}`);
}).observe({
  type: 'navigation',
  buffered: true
});
```

The `web-vitals` library provides a more concise way to measure TTFB:

```javascript
import {onTTFB} from 'web-vitals';
onTTFB(console.log);
```

#### Measuring TTFB for Resource Requests

For all resource requests, including those from cross-origin servers, you can use the Resource Timing API:

```javascript
new PerformanceObserver((entryList) => {
  const entries = entryList.getEntries();
  for (const entry of entries) {
    if (entry.responseStart > 0) {
      console.log(`TTFB: ${entry.responseStart}`, entry.name);
    }
  }
}).observe({
  type: 'resource',
  buffered: true
});
```

**Note:** For accurate measurement of cross-origin resource TTFB in the field, ensure that cross-origin servers set a `Timing-Allow-Origin` header.

## Fallback Strategies

While TTFB itself is not a Core Web Vitals metric, it directly impacts the ability to achieve good scores on those metrics. Sites with Single Page Applications (SPAs) or those heavily reliant on client-side rendering benefit significantly from a low TTFB to enable faster client-side processing. For server-rendered sites, a slightly higher TTFB might be acceptable if it leads to better FCP and LCP scores. Always consider how your site delivers content when evaluating your TTFB goals.

If specific technologies or server configurations contribute to higher TTFB, explore alternative solutions or optimizations. For instance, if backend processing is slow, investigate database indexing, query optimization, or server-side caching. If network latency is an issue, consider geographic distribution of your servers or a robust CDN.

The ultimate goal is to ensure that your TTFB does not impede your site's overall performance and user experience.