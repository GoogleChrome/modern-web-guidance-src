---
description: Test Chrome's bounce tracking mitigations to protect user privacy by enabling developers to identify and fix potential issues in their redirection flows before the feature is widely rolled out.
filename: testing-bounce-tracking-mitigations
category: testing
---

# Testing Bounce Tracking Mitigations

Reference docs:
- [Bounce Tracking Mitigations on web.dev](https://web.dev/articles/bounce-tracking-mitigations)
- [Chrome Flags documentation](https://developer.chrome.com/docs/web-platform/chrome-flags)

## Best Practices

To effectively test Chrome's bounce tracking mitigations and provide feedback, follow these best practices:

1.  **Use a Clean Chrome Profile:** Always start with a fresh Chrome profile for testing. Existing profiles may have user interactions logged that don't reflect typical user behavior, potentially leading to inaccurate test results. You can create a new profile via [Chrome support](https://support.google.com/chrome/answer/2364824).

2.  **Enable the Bounce Tracking Mitigations Flag:** Navigate to `chrome://flags` and set the `#bounce-tracking-mitigations` flag to "Enabled With Deletion". This flag is essential for activating the testing environment.

3.  **Block Third-Party Cookies:** In Chrome settings (`chrome://settings/cookies`), select "Block third-party cookies." This ensures that the mitigations are active for the scenarios they are designed to protect.

4.  **Simulate User Workflows:** Execute the redirection workflows within your site or application that you suspect might be affected by bounce tracking. This includes any process involving redirects, such as SSO, federated authentication, or payment flows.

5.  **Utilize Chrome DevTools:**
    *   **Check the Issues Tab:** After performing your workflow, open Chrome DevTools and examine the "Issues" tab. Look for a message titled "Chrome may soon delete state for intermediate websites in a recent navigation chain." This indicates that Chrome has flagged a site in your navigation chain as a potential bounce tracker.
    *   **Force Deletion Check:** For immediate testing, go to the DevTools Application Panel. Under "Background Services," select "Bounce Tracking Mitigations" and click "Force Run." This will trigger the deletion check without waiting for the default two-hour window.

6.  **Verify State Persistence:** After forcing the deletion check (or waiting for it to occur naturally), re-run your workflow. If the state on the bounced-through site has been correctly cleared, you should observe the expected behavior (e.g., a new identifier being produced, as in the demo page example).

7.  **Test Edge Cases:** Pay special attention to enterprise use cases where managed devices might automatically sign users into SSO sites. Ensure that the use of enterprise cookie policies correctly exempts these sites from bounce tracking mitigations.

## Fallback Strategies

While this document focuses on testing the mitigations, it's important to be aware that the mitigations themselves are a fallback for user privacy when third-party cookies are blocked. The primary strategy for developers is to ensure their redirection flows are robust and do not inadvertently rely on state that could be cleared.

## Providing Feedback

Your feedback is crucial for refining these privacy-preserving features. Report issues and suggestions through the following channels:

*   **Chromium Bug Tracker:** Use the "Privacy>NavTracking" component at [crbug.com/new](http://crbug.com/new).
*   **W3C PrivacyCG:** File an issue in the [PrivacyCG Navigation-based Tracking Mitigations repository](https://github.com/privacycg/nav-tracking-mitigations/issues).