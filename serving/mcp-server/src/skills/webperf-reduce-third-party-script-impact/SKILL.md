---
description: Optimize web performance by identifying and reducing the impact of slow third-party scripts that block the main thread.
filename: reduce-third-party-script-impact
category: webperf
---

# Reduce the Impact of Third-Party Code

Reference docs:
- https://web.dev/articles/third-party-javascript
- https://web.dev/articles/identify-slow-third-party-javascript
- https://web.dev/articles/efficiently-load-third-party-javascript

## How the Lighthouse Audit for Third-Party Code Fails

Lighthouse flags pages with third-party code that blocks the main thread for 250ms or longer. A third-party script is defined as any script hosted on a domain different from the audited URL. Lighthouse calculates the total blocking time of these scripts during page load. If this time exceeds 250ms, the audit fails.

<figure>
  <img src="image/a-screenshot-the-lightho-61da3befa3627.png" alt="A screenshot of the Lighthouse Reduce the impact of third-party code audit" width="800" height="481">
</figure>

## How to Reduce the Impact of Third-Party Code

To identify problematic third-party code, use Chrome DevTools and other Lighthouse audits as described in [Identify slow third-party scripts](https://web.dev/articles/identify-slow-third-party-javascript).

For optimization strategies, refer to [Efficiently load third-party JavaScript](https://web.dev/articles/efficiently-load-third-party-javascript).

## Resources

- [Source code for **Reduce the impact of third-party code** audit](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/third-party-summary.js)
- [Loading Third-party JavaScript](https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript)

[main thread]: https://developer.mozilla.org/docs/Glossary/Main_thread