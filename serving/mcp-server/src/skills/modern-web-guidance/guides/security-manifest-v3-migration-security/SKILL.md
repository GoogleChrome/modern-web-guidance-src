---
description: "Improve Chrome extension security by migrating from Manifest V2 to Manifest V3, addressing known issues and adopting new security enhancements."
filename: manifest-v3-migration-security
category: security
---

# Migrating to Manifest V3 for Enhanced Security

This guide outlines best practices for migrating Chrome extensions from Manifest V2 to Manifest V3, focusing on security improvements and addressing potential challenges.

## Key Security Enhancements in Manifest V3

Manifest V3 introduces several security-focused changes designed to make extensions more robust and trustworthy.

### Resolved Known Issues and Closing the Gap

The Chrome extension team has been actively resolving Manifest V3 stability issues. Significant progress has been made in Chrome 116, and by Chrome 120, all prioritized platform gaps between Manifest V2 and V3 are expected to be closed. Critical bugs documented on the [known issues page](/docs/extensions/migrating/known-issues) will also be addressed.

### Increased Security Measures

Manifest V3 enhances security through several mechanisms:

*   **Restricted `chrome://` URL Navigation**: In Chrome 117, the ability to navigate to certain `chrome://` URLs using `tabs.update()`, `tabs.create()`, and `windows.create()` has been expanded, while Javascript URL blocking now applies more broadly.
*   **Proactive User Notifications**: Starting in Chrome 117, users will be notified on the Chrome Extensions page if an installed extension is no longer available on the Chrome Web Store (e.g., unpublished, removed for policy violations, or identified as malware). Refer to [Bringing Safety Check to the chrome://extensions page](/en/blog/extension-safety-hub) for more details.
*   **Restricted `file://` URL Access**: In Chrome 118, extensions will be prevented from navigating to `file://` URLs via `chrome.tabs` and `chrome.windows` APIs unless the "Allow access to file URLs" option is enabled on the extension's details page. This aligns with WECG discussions on this topic.

## API Updates and Best Practices for Security

Several API changes in Manifest V3 have security implications.

### Runtime API

*   The `runtime.getContexts()` method (available since Chrome 116) can be used to retrieve information about active contexts, aiding in understanding extension behavior and potential security footprints.

### DeclarativeNetRequest API

*   The `isUrlFilterCaseSensitive` property's default value was changed to `false` in Chrome 118. Understanding and correctly configuring these rules is crucial for network request modification security.

## Upcoming Security-Related Features

The following features, planned for future releases, will further enhance security:

*   **UserScripts API**: This API will allow better coordination of user script injections, potentially mitigating risks associated with unmanaged script execution.
*   **Increased Static Rule Limits**: The `DeclarativeNetRequest API` is increasing the limits on enabled static rulesets (from 10 to 50) and the total number of allowed static rulesets (from 50 to 100). This allows for more comprehensive and secure network filtering.
*   **File Handling API**: For ChromeOS extensions, this API will allow extensions to open files with specified MIME types and file extensions, improving secure file interaction.
*   **Web Push API without User Notification**: Allowing the web Push API to be used with `userVisibleOnly` set to `false` can enhance asynchronous client-server communication security, potentially offering a more secure alternative to WebSockets in certain scenarios.

## Documentation and Resources for Migration

*   **Known Issues Page**: Regularly check the [known issues page](/docs/extensions/migrating/known-issues) for the latest updates on Manifest V3 stability and migration challenges.
*   **Migrating Remotely Hosted Code**: The guidance on [migrating remotely hosted code to Manifest V3](/docs/extensions/migrating/improve-security) is essential for securing your extension's dependencies.
*   **Publishing Manifest V3 Extensions**: Strategies for [publishing your Manifest V3 extension](/docs/extensions/migrating/publish-mv3) in stages can help minimize risks during the rollout.
*   **Service Worker Guidance**: Updated [Service Worker guidance](/docs/extensions/mv3/service_workers/service-worker-lifecycle/#timeouts) is crucial as service workers play a key role in Manifest V3 architecture.

## Reaching Out for Support

*   **Chromium-extensions Google Group**: For questions and community support, engage on the [chromium-extensions Google group](https://groups.google.com/a/chromium.org/g/chromium-extensions).
*   **WECG Discussions**: Follow browser partner discussions on the [WECG GitHub repository](https://github.com/w3c/webextensions) for insights into API standardization and security practices.
*   **File a Bug**: Report any documentation or platform issues via the [support feedback channel](/docs/extensions/support-feedback/file-a-bug).

By understanding and implementing these changes, developers can ensure their Chrome extensions are more secure and compliant with the latest standards.