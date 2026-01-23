---
description: Learn how to measure and optimize the deprecated Max Potential First Input Delay metric in Lighthouse to improve user interaction responsiveness.
filename: max-potential-first-input-delay
category: webperf
---

# Max Potential First Input Delay

Reference docs:
- [First Input Delay](https://web.dev/fid/)
- [Total Blocking Time](https://web.dev/articles/lcp)
- [Interaction to Next Paint](https://web.dev/articles/inp)

## Best Practices

Max Potential First Input Delay (FID) was a metric used in Lighthouse to assess the worst-case delay a user might experience when interacting with a page. It measured the time between a user's first interaction and the browser's ability to respond. Although deprecated, understanding its measurement and optimization strategies can still offer insights into improving perceived performance.

Lighthouse calculated Max Potential FID by identifying the longest task occurring after First Contentful Paint (FCP). Tasks before FCP were excluded as user interaction is unlikely before content is rendered.

### Understanding the Score

Lighthouse presented the Max Potential FID score by comparing your page's performance against real-world websites using data from the HTTP Archive. Scores were color-coded:

- **Green (fast):** 0–130 milliseconds
- **Orange (moderate):** 130–250 milliseconds
- **Red (slow):** Over 250 milliseconds

### Improving Performance

To improve metrics related to user interaction delays, focus on reducing the duration of long JavaScript tasks. Strategies that improve Time to Interactive (TTI) often positively impact FID as well. The "Idle Until Urgent" strategy is one effective method for reducing long tasks.

### Capturing Field Data

Lighthouse provided lab data for Max Potential FID. To capture actual user interaction data in the field, use libraries like Google's First Input Delay library. This allows you to report real-world FID metrics to your analytics tools. Due to the inherent variability of user interactions, careful analysis and reporting of field data are crucial.

**DO** consider using current metrics like Total Blocking Time (TBT) in the lab and First Input Delay (FID) and Interaction to Next Paint (INP) in the field for more up-to-date performance analysis.

## Resources

- [Source code for Max Potential First Input Delay audit](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/metrics/max-potential-fid.js)
- [First Input Delay (FID)](https://web.dev/fid/)
- [Interaction to Next Paint (INP)](https://web.dev/articles/inp)
- [Total Blocking Time (TBT)](https://web.dev/articles/tbt)
- [Long JavaScript Tasks](https://web.dev/long-tasks-devtools/)