---
description: Automate cross-browser testing with Puppeteer and WebDriver BiDi for stable and unified browser control.
filename: cross-browser-testing-automation
category: testing
---

# Cross-Browser Testing Automation with Puppeteer and WebDriver BiDi

This document outlines best practices for automating cross-browser testing using Puppeteer, leveraging the stable support for WebDriver BiDi in recent versions of Firefox and Chrome.

## Unified Browser Automation API

Puppeteer 23 and later, combined with WebDriver BiDi, offers a unified API for automating both Chrome and Firefox. This simplifies testing by allowing you to write tests once and run them across different browsers without significant modifications.

### Key Principles

*   **Leverage WebDriver BiDi:** For new automations, or when updating existing ones, prioritize using WebDriver BiDi for browser control. This protocol is designed for modern cross-browser automation.
*   **Specify Browser Target:** When launching Puppeteer, explicitly specify the `browser` type (e.g., `'firefox'`, `'chrome'`).
*   **Unified API:** With WebDriver BiDi, the Puppeteer API for interacting with browser features remains consistent across supported browsers.

### Example: Launching Browsers

```js
import puppeteer from 'puppeteer';

// Automate Firefox using WebDriver BiDi (default for Firefox)
const firefoxBrowser = await puppeteer.launch({
  browser: 'firefox',
});
const firefoxPage = await firefoxBrowser.newPage();
// ... perform actions and assertions on firefoxPage ...
await firefoxBrowser.close();

// Automate Chrome using WebDriver BiDi
const chromeBrowser = await puppeteer.launch({
  browser: 'chrome',
  protocol: 'webDriverBiDi', // Explicitly set for Chrome to use WebDriver BiDi
});
const chromePage = await chromeBrowser.newPage();
// ... perform actions and assertions on chromePage ...
await chromeBrowser.close();
```

## Migrating from CDP to WebDriver BiDi

If you have existing automations that rely on Chrome DevTools Protocol (CDP) for Firefox, it is **strongly recommended** to migrate to WebDriver BiDi. CDP support in Firefox is deprecated and scheduled for removal.

### Migration Steps

1.  **Identify CDP Dependencies:** Review your test suite to pinpoint areas that specifically rely on CDP features in Firefox.
2.  **Update Puppeteer Launch Configuration:** Modify your `puppeteer.launch()` calls to ensure WebDriver BiDi is used for Firefox. For Chrome, if you intend to use WebDriver BiDi, you must explicitly set `protocol: 'webDriverBiDi'`.
3.  **Test Thoroughly:** Run your test suite against both Firefox and Chrome after the migration to ensure all functionalities work as expected.
4.  **Address Deprecation Warnings:** If you encounter any deprecation warnings related to CDP in Firefox, this indicates a need for immediate migration.

### CDP Deprecation in Firefox

CDP support in Firefox is deprecated from Firefox 129 and will be removed by the end of 2024. Proactive migration to WebDriver BiDi is essential to maintain compatibility.

## Further Resources

*   **Puppeteer Documentation on WebDriver BiDi:** [https://pptr.dev/webdriver-bidi](https://pptr.dev/webdriver-bidi)
*   **Mozilla Hacks Blog on Puppeteer Support for Firefox:** [https://hacks.mozilla.org/2024/08/puppeteer-support-for-firefox/](https://hacks.mozilla.org/2024/08/puppeteer-support-for-firefox/)
*   **Deprecation of CDP Support in Firefox:** [https://fxdx.dev/deprecating-cdp-support-in-firefox-embracing-the-future-with-webdriver-bidi/](https://fxdx.dev/deprecating-cdp-support-in-firefox-embracing-the-future-with-webdriver-bidi/)