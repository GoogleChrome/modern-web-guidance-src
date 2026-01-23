---
description: Inform users about Chrome extensions that are no longer available in the Chrome Web Store.
filename: extension-availability-warnings
category: extensions
---

# Extension Availability Warnings

Chrome 117 introduces proactive warnings for users when an installed extension is no longer available in the Chrome Web Store. This feature aims to enhance user safety by alerting them to extensions that have been unpublished, removed for policy violations, or flagged as malware.

## Use Cases

This feature is triggered in three specific scenarios:

-   **Developer Unpublishing:** The extension developer has chosen to unpublish the extension from the store.
-   **Policy Violation Takedown:** The extension has been removed by Chrome for violating Chrome Web Store policies.
-   **Malware Identification:** The extension has been identified as malware.

## User Experience

Users will most commonly encounter these warnings in the "Privacy and security" section of their Chrome settings. A notification will appear, and when a user clicks "Review," they will be directed to their extensions page.

From there, users have the option to:

-   **Remove the extension:** Uninstall the extension entirely.
-   **Hide the warning:** If the user wishes to keep the extension installed despite the warning, they can dismiss the notification.

It's important to note that extensions flagged as malware are automatically disabled by Chrome, regardless of user action.

## Design Considerations

This change is designed to balance ecosystem safety with minimal disruption to legitimate extensions. Notifications are automatically cleared if an issue is resolved. Furthermore, extensions undergoing the review process, where developers have been notified of potential violations and given time to address them, will not display these warnings.

## Feedback

Feedback on this feature is encouraged. Developers can share their thoughts on the [chromium-extensions][mailing-list] mailing list.

---

_Photo by [Nicolás Flor][unsplash-credit] on [Unsplash][unsplash]_

[mailing-list]: https://groups.google.com/a/chromium.org/g/chromium-extensions
[unsplash-credit]: https://unsplash.com/@nicolassflorr?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText
[unsplash]: https://unsplash.com/photos/hOWxbQAuC00?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText