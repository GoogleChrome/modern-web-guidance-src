---
description: Provides clear and concise descriptions for browser extensions, suitable for display in browser extension management pages and online stores.
filename: extension-description
category: extensions
---

# Manifest - Description

The `description` field in `manifest.json` is a plain text string that concisely describes your extension's functionality. This description is crucial for users to understand what your extension does, appearing in both the browser's `chrome://extensions` page and the Chrome Web Store.

## Best Practices

*   **Conciseness:** Keep the description brief and to the point. The recommended maximum length is 132 characters.
*   **Clarity:** Use simple, understandable language. Avoid jargon or overly technical terms unless they are essential to describing the extension.
*   **No Formatting:** Do not include HTML, Markdown, or any other formatting. The description should be plain text only.
*   **Suitability for Multiple Platforms:** Ensure the description works well for both the internal browser extensions page and the public Chrome Web Store.
*   **Locale-Specific Strings:** For extensions targeting multiple languages, you can specify locale-specific descriptions. Refer to the [Internationalization][api-i18n] documentation for details.

### Example

```json
"description": "A description of my extension"
```

## Example Usage

Consider an extension that simplifies note-taking. A good description would be:

```json
"description": "Quickly capture notes, ideas, and to-do lists directly from your browser."
```

This description is short, clear, and explains the core benefit of the extension.

[cws]: https://chrome.google.com/webstore
[api-i18n]: /docs/extensions/reference/api/i18n