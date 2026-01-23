---
description: Debugging third-party cookie issues and preparing for their deprecation with Chrome DevTools.
filename: debugging-third-party-cookie-phaseout
category: testing
---

# Debugging Third-Party Cookie Phaseout

As third-party cookies approach deprecation, Chrome DevTools offers features to help you identify and address affected cookies.

## Issues Panel Enhancements

The **Issues** tab in Chrome DevTools now defaults to enabling the "**Include third-party cookie issues**" checkbox. This proactively warns you about cookies that will be impacted by the upcoming deprecation and phaseout. You can disable this warning at any time by unchecking the box.

## Privacy Sandbox Analysis Tool

The [Privacy Sandbox Analysis Tool (PSAT)](https://github.com/GoogleChromeLabs/ps-analysis-tool) is an extension for DevTools that helps you understand how your website uses cookies and provides guidance on new privacy-preserving Chrome APIs.

### How to Use PSAT:

1.  **Install the extension:** Follow the instructions at [Installing and Running PSAT](https://github.com/GoogleChromeLabs/ps-analysis-tool#installing-and-running-psat).
2.  **Open your website:** Ensure your website is open in a single tab for the most accurate analysis.
3.  **Open DevTools:** Navigate to the **Privacy Sandbox** panel. This panel might be located under the more tabs dropdown (<img src="image/more-tabs-87c295343210d.svg" alt="More tabs." width="20" height="20">).
4.  **Analyze cookies:** Open the **Cookies** section and click **Analyze this tab**. Reload the page if no cookies are found initially.

### Further PSAT Resources:

*   [PSAT's How To](https://github.com/GoogleChromeLabs/ps-analysis-tool/wiki/A.-PSAT's-How-To)
*   [Evaluation Environment](https://github.com/GoogleChromeLabs/ps-analysis-tool/wiki/B.-Evaluation-Environment) for predicting deprecation impact.
*   [General Analysis Actions](https://github.com/GoogleChromeLabs/ps-analysis-tool/wiki/C.-General-Analysis-Actions) to identify affected aspects.
*   [Analysis Scenarios](https://github.com/GoogleChromeLabs/ps-analysis-tool/wiki/D.-Analysis-Scenarios) for common use cases like analytics, e-commerce, SSO, and embedded content.
*   [Reporting issues and Learning More](https://github.com/GoogleChromeLabs/ps-analysis-tool/wiki/E.-Reporting-Issues-and-Learning-More).

## Preparing for Deprecation

To understand the broader implications and required actions for the end of third-party cookies, refer to [Preparing for the end of third-party cookies](/blog/cookie-countdown-2023oct).