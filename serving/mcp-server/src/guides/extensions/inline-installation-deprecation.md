---
description: Provide users with clear and concise information about deprecated inline installation for Chrome extensions and guide them to relevant resources for migration.
filename: inline-installation-deprecation
category: extensions
---

# Inline Installation Deprecation

As of 06/12/2018, inline installation for Chrome extensions has been deprecated. This change aims to improve extension transparency for users and provides a more secure installation experience.

## Guidance and Resources

Developers who were previously using inline installation should migrate to alternative methods for distributing their extensions. The following resources provide detailed information and guidance:

*   **Chromium Blog Post:** Read the official announcement and the reasoning behind this deprecation.
    [https://blog.chromium.org/2018/06/improving-extension-transparency-for.html][1]

*   **Migration FAQ:** This document addresses common questions and provides step-by-step instructions for migrating from inline installations.
    [https://developer.chrome.com/docs/extensions/mv2/inline_faq][2]

## Best Practices for Extension Distribution

*   **DO** leverage the Chrome Web Store for distributing your extensions. It offers a secure and user-friendly platform for users to discover and install extensions.
*   **DO** ensure your extension's listing page in the Chrome Web Store provides clear and comprehensive information about its functionality and permissions.
*   **DO** consider alternative methods for driving users to your extension's Chrome Web Store page, such as direct links from your website or marketing materials.
*   **DO NOT** attempt to implement custom inline installation flows, as they are no longer supported and may lead to a poor user experience or security vulnerabilities.
*   **DO** stay updated with Chrome Platform status and announcements to ensure compatibility and adherence to best practices.

[1]: https://blog.chromium.org/2018/06/improving-extension-transparency-for.html
[2]: https://developer.chrome.com/docs/extensions/mv2/inline_faq