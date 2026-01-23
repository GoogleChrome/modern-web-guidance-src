---
description: Quantify and improve website performance by leveraging new metrics like LCP, TBT, and CLS, and by analyzing field data from CrUX.
filename: improve-website-performance-with-new-metrics
category: webperf
---

# Improve Website Performance with New Metrics

This guide covers how to leverage new performance metrics and field data to enhance website speed and user experience.

## New Performance Metrics

New metrics have evolved to better capture the nuances of user experience, directly impacting your bottom line. These include:

### Largest Contentful Paint (LCP)

LCP reports the time when the largest content element becomes visible in the viewport. It's a better indicator of when the main page content has loaded compared to older metrics like First Meaningful Paint (FMP) and Speed Index (SI).

- **DO** use LCP to understand when users perceive the primary content of your page has loaded.
- **DO** monitor LCP in Lighthouse reports and measure it in JavaScript for real-time insights.

### Total Blocking Time (TBT)

TBT measures the total time between First Contentful Paint (FCP) and Time to Interactive (TTI) where the main thread was blocked, impacting responsiveness. A task is considered "long" if it runs on the main thread for more than 50 milliseconds.

- **DO** use TBT to quantify how strained the main thread is during the page load.
- **DO** understand that TBT complements Time to Interactive (TTI) for a more balanced performance picture.

### Cumulative Layout Shift (CLS)

CLS measures the visual stability of a page, quantifying unexpected layout shifts that can frustrate users.

- **DO** use CLS to identify and address issues causing unexpected content movement.
- **DO** refer to the detailed guide on Cumulative Layout Shift for calculation and measurement.

The new Lighthouse performance score formula will incorporate LCP, TBT, and CLS, de-emphasizing older metrics like FMP and FCI, as they more accurately reflect perceived usability.

## Field Data (CrUX) Thresholds Adjusted in PageSpeed Insights

Analysis of Chrome User Experience (CrUX) data has led to reassessments of thresholds for labeling websites as "slow," "moderate," or "fast" in field performance.

- **DO** note that the term "average" has been updated to "moderate" for clarity.
- **DO** understand that PageSpeed Insights (PSI) uses specific percentiles of CrUX data to assess site performance.

The previous thresholds were the 90th percentile for First Contentful Paint (FCP) and the 95th percentile for First Input Delay (FID). These have been adjusted for better distribution:

| Metric | Overall Percentile | Fast (ms) | Moderate (ms) | Slow (ms) |
|---|---|---|---|---|
| FCP | 75th percentile | <1000 | 1000-3000 | 3000+ |
| FID | 95th percentile | <100 | 100-300 | 300+ |

This adjustment means that a site's overall field score is now determined by a more representative percentile, leading to a more accurate assessment.

## Canonical URL Redirects in PageSpeed Insights

PageSpeed Insights now prompts users to reanalyze a landing URL for redirected sites to provide a more accurate performance picture.

- **DO** use the "Reanalyze" prompt in PSI when dealing with redirected URLs to get a complete performance assessment.

## CrUX in the New Search Console Speed Report

The new Search Console Speed report utilizes CrUX data to help site owners identify potential user experience problems, grouping URLs into "Fast," "Moderate," and "Slow" buckets to prioritize improvements.

- **DO** utilize the Search Console Speed report to discover and prioritize performance improvements based on real-user data.

## Web Almanac

The Web Almanac is an annual project analyzing the state of the web, covering aspects like how sites are built, delivered, and experienced.

- **DO** explore the Web Almanac, particularly the sections on performance, JavaScript, and third-party code, for deeper insights into web trends.

## Learn More

For more in-depth information on performance tooling updates from Chrome Developer Summit, watch the related talk.