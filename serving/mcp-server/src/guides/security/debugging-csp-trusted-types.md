---
description: Debugging Content Security Policy and Trusted Types issues in Chrome DevTools for improved web security.
filename: debugging-csp-trusted-types
category: security
---

# Debugging CSP and Trusted Types Issues in Chrome DevTools

Reference docs:
- [Content Security Policy (CSP)](https://web.dev/articles/csp)
- [Trusted Types](https://web.dev/articles/trusted-types)
- [Chrome DevTools Protocol (CDP)](https://chromedevtools.github.io/devtools-protocol/)

## Implementing Content Security Policy Issues in the **Issues** tab

The process for improving DevTools debugging for CSP issues involves several key steps:

1.  **Defining user stories**: Understand how web developers investigate CSP problems.
2.  **Front-end implementation**: Determine the necessary information for debugging in the front-end (e.g., source code location, related requests).
3.  **Issue detection**: Instrument Chrome's back-end to detect and report CSP violations with relevant details.
4.  **Save and display the issues**: Store detected issues and make them accessible when DevTools is opened.
5.  **Designing the issues text**: Create clear, actionable explanations to help developers understand and fix CSP problems.

### Step 1: Defining User Stories for CSP Issues

Before implementation, create a design document outlining user stories. A sample user story:

*As a developer, who just realized that some part of my website are blocked, I want to:*
- *...find out if CSP is a reason for blocked iframes / images on my website*
- *...learn which CSP directive causes the blockage of a certain resource*
- *...know how to change the CSP of my website to allow display of currently blocked resources / execution of currently blocked js.*

To explore these stories, create example web pages demonstrating CSP violations and use the **Issues** tab in DevTools for analysis. Key information for debugging includes the source location, associated iframe and request, and a direct link to the relevant HTML element.

### Step 2: Front-end Implementation

Translate insights into the data structure for the Chrome DevTools Protocol (CDP). This involves defining interfaces in PDL and generating TypeScript definitions and C++ libraries for data exchange between the back-end and front-end.

### Step 3: Issue Detection

Identify where in Chrome's back-end CSP violations occur and hook into existing mechanisms, such as `ContentSecurityPolicy::ReportViolation`, to capture necessary information.

### Step 4: Save and Display Issues

Implement a storage mechanism to save issues detected before DevTools is opened. This allows previously recorded issues to be replayed when DevTools or any CDP client attaches.

### Step 5: Designing Issue Text

Collaborate with feature teams (e.g., CSP team) and DevRel to craft accurate and helpful issue descriptions. This iterative process refines the text to ensure clarity and precision for web developers.

## Debugging Trusted Types Problems

### Improved Console Printing

Enhance the console's display of Trusted Objects to show more informative details, similar to `.toString()` output rather than just `.valueOf()`. This may require modifications in V8 and Blink for custom handling of trusted type objects.

### Break-on-Violation (in Report-Only Mode)

Introduce a new CDP command (e.g., `setBreakOnTTViolation`) to allow developers to set breakpoints specifically for Trusted Type violations. This requires backend (Blink) and frontend changes to enable pausing execution upon TT violations, even in report-only mode.

## What’s Done and What’s Next?

The **Issues** tab has been significantly improved with:
- Enhanced interconnectedness with other DevTools panels.
- Reporting of additional problems like low-contrast, Trusted Web Activity, quirks mode, Attribution Reporting API, and CORS-related issues.
- An option to hide specific issues.

Future plans include using the **Issues** tab to surface more problems, aiming to reduce the console's error message clutter.