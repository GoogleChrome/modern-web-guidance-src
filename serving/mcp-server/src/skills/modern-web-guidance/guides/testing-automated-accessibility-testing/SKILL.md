---
description: Learn how to perform automated accessibility testing using Lighthouse to identify and fix accessibility issues in web pages.
filename: automated-accessibility-testing
category: testing
---

# Automated Accessibility Testing

## Overview

Automated accessibility testing uses software to scan digital products for accessibility issues against predefined conformance standards. This approach offers quick, repeatable tests with minimal required accessibility knowledge, making it a valuable first step in the testing process.

## Best Practices

### Selecting a Tool

Choosing the right automated testing tool depends on various factors:
- **Conformance Standards:** WCAG 2.2, WCAG 2.1, U.S. Section 508, or custom rule sets.
- **Product Type:** Websites, web apps, native mobile apps, PDFs, kiosks, etc.
- **Development Lifecycle Stage:** When during development testing will occur.
- **Resource Availability:** Time for setup and use, individual vs. team vs. company needs.
- **Tester Role:** Designers, developers, QA, or other roles.
- **Reporting Needs:** Frequency of checks, detail level, integration with ticketing systems.
- **Environment Compatibility:** Tools that work best within your existing setup and team workflow.

Refer to WAI's article on "[Selecting Web Accessibility Evaluation Tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/)" for comprehensive guidance.

### Using Lighthouse for Demo

This guide uses Chrome's Lighthouse for its automated accessibility testing demo. Lighthouse is an open-source tool that audits web pages for quality, including accessibility.

**Steps:**

1.  **Install Lighthouse Extension:** Add the [Lighthouse Chrome extension](https://chrome.google.com/webstore/detail/lighthouse/blipmdconlkpinefehnmjammfjpmpbjk).
2.  **Prepare Demo Page:** Use a demo page (like the provided CodePen link) in debug mode to ensure it's not enclosed in an `<iframe>`.
3.  **Open DevTools and Lighthouse Tab:** Open Chrome DevTools, navigate to the Lighthouse tab, and select "Accessibility" as the category. Choose the device type.
4.  **Analyze Page Load:** Click "Analyze page load" and wait for the tests to complete.
5.  **Interpret Results:** Lighthouse provides a score and detailed information on detected issues, including links to resources for remediation. It also lists passed tests and items requiring manual checks.
6.  **Fix Issues:** Address each reported automated accessibility issue by correcting markup and styles. Common issues include:
    *   **ARIA Roles:** Ensure ARIA parent roles have required children.
    *   **ARIA Hidden:** Avoid hiding focusable descendants within `aria-hidden="true"` elements.
    *   **Button Name:** Ensure buttons have accessible names.
    *   **Image Alt Attributes:** Provide descriptive `alt` text for informative images and empty `alt=""` for decorative ones.
    *   **Link Text:** Ensure links have discernible and unique names.
    *   **Color Contrast:** Meet WCAG contrast ratio requirements (4.5:1 for normal text, 3:1 for large text and essential graphics).
    *   **List Structure:** Enclose list items (`<li>`) within `<ul>` or `<ol>` tags.
    *   **Tabindex:** Avoid positive `tabindex` values unless absolutely necessary to maintain natural tab order.
7.  **Re-run Audit:** After fixing issues, run the Lighthouse audit again. The goal is to achieve a score of 100, indicating all automated issues have been addressed.

## Limitations of Automated Testing

While essential, automated tests do not catch all accessibility errors. False positives can occur, and multiple tools may be needed for different product types. Manual and assistive technology testing are crucial for a comprehensive accessibility evaluation.