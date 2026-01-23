---
description: Ensure users can view at least some content on your web page when JavaScript is unavailable by implementing progressive enhancement.
filename: fallback-content-javascript-disabled
category: pwa
---

# Fallback content when JavaScript is unavailable

## Best Practices

To ensure a baseline user experience, pages should provide some visible content even when JavaScript is disabled. This aligns with the principles of progressive enhancement, where core functionality and content are delivered via HTML, with enhancements layered on top.

*   **DO** ensure that your HTML provides essential content that is visible when JavaScript is not executed.
*   **DO** consider using a `<noscript>` element to inform users that JavaScript is required for the full functionality of the page. This is preferable to a blank page, which can leave users uncertain about potential issues.
*   **DO NOT** rely solely on JavaScript to render critical content, as this will result in a blank page for users with JavaScript disabled or in environments where it cannot execute.

Lighthouse flags pages that are completely blank when JavaScript is disabled. The audit works by disabling JavaScript and then inspecting the page's HTML. If the HTML is empty, the audit fails.

## Progressive Enhancement Strategies

Progressive enhancement is a strategy that prioritizes basic content and functionality, ensuring accessibility for the widest possible audience. More advanced features like complex styling with CSS or interactivity with JavaScript are layered on top for browsers that support them.

While there are varying approaches to progressive enhancement, a common agreement is that all pages should display at least some information when JavaScript is disabled. This could be as simple as a message indicating that JavaScript is needed to use the page.

For pages that absolutely require JavaScript for their core functionality, using a `<noscript>` tag is a recommended fallback.

## Resources

*   [Source code for **Does not provide fallback content when JavaScript is not available** audit](https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/audits/without-javascript.js)
*   [Progressive Enhancement: What It Is, And How To Use It](https://www.smashingmagazine.com/2009/04/progressive-enhancement-what-it-is-and-how-to-use-it/)
*   [Disable JavaScript With Chrome DevTools](/docs/devtools/javascript/disable)