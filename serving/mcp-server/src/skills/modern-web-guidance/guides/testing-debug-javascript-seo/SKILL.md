---
description: Debug JavaScript SEO issues on individual pages or across an entire site using Google's developer tools.
filename: debug-javascript-seo
category: testing
---

# Debugging JavaScript SEO Issues

This guide provides an overview of the tools Google offers to help developers debug JavaScript SEO issues in Google Search, suggesting when to use each tool.

## Find basic SEO issues with Lighthouse

Use [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) for initial investigations. It includes various [SEO audits](/articles/pass-lighthouse-seo-audit) that perform basic checks on a single page.

<figure>
  <img src="image/a-screenshot-seo-audits-9bad50fa979ba.png" alt="A screenshot of SEO audits in Lighthouse." width="800" height="74">
</figure>

Lighthouse audits are fundamental for identifying common mistakes and getting a preliminary understanding of your website's search engine discoverability. However, remember that Lighthouse runs in your browser, which may not perfectly reflect how Googlebot views a page. For example, browsers don't respect `robots.txt` for resource fetching, unlike Googlebot. Therefore, while Lighthouse issues should be fixed, further debugging might require other tools.

## Validate pages with Google Search testing tools

Google Search offers a suite of tools for examining how Googlebot renders your web content, which are particularly useful during development:

*   **[Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)**: Verifies if a page is mobile-friendly, a crucial ranking signal since 2015.
*   **[Rich Results Test](https://search.google.com/test/rich-results)**: Validates eligibility for rich results based on structured data.
*   **[AMP Test](https://search.google.com/test/amp)**: Checks the validity of your AMP HTML.

In conjunction with tools like [local-tunnel or ngrok](https://developers.google.com/search/docs/guides/debug#testing-firewalled-pages), you can create temporary public URLs from your local environment for rapid iteration during testing with Google's tools.

These tools provide valuable insights, including:

*   Rendered HTML as seen by Googlebot.
*   Details on loaded resources and why some might fail to load.
*   Console log messages and JavaScript errors with stack traces.

<figure>
  <img src="image/a-screenshot-the-mobile-235921350cfae.png" alt="A screenshot of the Mobile-Friendly Test." width="800" height="492">
</figure>

The Google Search Console's [URL Inspection Tool](https://support.google.com/webmasters/answer/9012289) offers in-depth page status information:

<figure>
  <img src="image/a-screenshot-the-url-ins-ae89b53ef1261.png" alt="A screenshot of the URL Inspection Tool." width="800" height="590">
</figure>

This tool allows you to check:

*   Indexing status and future indexability.
*   Rendered HTML from the most recent and fresh crawls.
*   Page resource information.
*   JavaScript log messages and errors with stack traces.
*   Screenshots of the rendered page.
*   Mobile usability issues.
*   Detected and validated structured data.

These tools help identify and resolve most issues. For further guidance on fixing JavaScript SEO problems, refer to the official documentation on [fixing Google Search-related JavaScript problems](https://developers.google.com/search/docs/guides/fix-search-javascript).

## Investigate site health with Google Search Console

While the above tools are excellent for single-page issue resolution, [Google Search Console](https://search.google.com/search-console/about) provides a holistic view of your entire website's health and performance.

### Coverage report

The [Coverage report](https://support.google.com/webmasters/answer/7440203) highlights indexed pages and any errors encountered.

<figure>
  <img src="image/a-screenshot-the-coverag-c74e2d1f66896.png" alt="A screenshot of the Coverage report." width="754" height="567">
</figure>

### Core Web Vitals report

The [Core Web Vitals report](https://support.google.com/webmasters/answer/9205520) offers an overview of your pages' performance concerning [Core Web Vitals](/articles/vitals#core_web_vitals).

<figure>
  <img src="image/a-screenshot-the-core-we-fc4ad096e9be5.png" alt="A screenshot of the Core Web Vitals report." width="744" height="596">
</figure>

## Integrate these tools into your workflow

The tools discussed range from pre-publishing page testing to live website monitoring, providing crucial visibility into your site's discoverability by Google Search. Incorporate the most relevant tools into your development workflow for ongoing optimization and ad-hoc problem-solving. For more in-depth information on Google Search for developers and JavaScript SEO, consult the official [Search for developers](https://developers.google.com/search) documentation, especially the guide on [JavaScript SEO](https://developers.google.com/search/docs/guides/javascript-seo-basics).