---
description: Customize font settings for specific language scripts and generic font families within a Chrome extension.
filename: chrome-fontsettings-api
category: extensions
---

# chrome.fontSettings API

This document outlines the usage and best practices for the `chrome.fontSettings` API, enabling Chrome extensions to programmatically control font preferences for web content.

## Permissions

To utilize the Font Settings API, you must declare the `"fontSettings"` permission in your extension's manifest file.

```js
{
  "name": "My Font Settings Extension",
  "description": "Customize your fonts",
  "version": "0.2",
  "permissions": [
    "fontSettings"
  ],
  ...
}
```

## Concepts and Usage

The `chrome.fontSettings` API allows for fine-grained control over fonts based on generic font families (like `serif`, `sansserif`, `monospace`) and language scripts.

*   **Generic Font Families**: These are based on CSS generic font families and are listed under `GenericReference`. Chrome uses these settings when a web page specifies a generic font family or defaults to the "standard" setting.
*   **Language Scripts**: Chrome selects fonts based on language scripts, identified by ISO 15924 script codes (e.g., `Arab`, `Jpan`, `Cyrl`). Settings can be script-specific but may also influence fonts for related languages (e.g., Cyrillic settings might affect Russian).

## Examples

### Getting a Font Setting

The following code retrieves the font setting for the standard generic family and the Arabic script.

```js
chrome.fontSettings.getFont(
  { genericFamily: 'standard', script: 'Arab' },
  function(details) { console.log(details.fontId); }
);
```

### Setting a Font

This snippet demonstrates how to set the sans-serif font for Japanese to "MS PGothic".

```js
chrome.fontSettings.setFont(
  { genericFamily: 'sansserif', script: 'Jpan', fontId: 'MS PGothic' }
);
```

## Best Practices

*   **Manifest Declaration**: Always declare the `"fontSettings"` permission in your `manifest.json`.
*   **Script and Family Specificity**: Use specific `script` codes and `genericFamily` values when setting or getting fonts to ensure the desired customization. Refer to the API documentation for a complete list of supported values.
*   **User Defaults**: Be mindful that the API modifies user-visible font settings. Ensure your extension provides a clear way for users to understand and potentially revert these changes.
*   **Error Handling**: Implement error handling for API calls, as font setting operations might fail under certain conditions (e.g., invalid font IDs).
*   **Testing**: Thoroughly test your font customizations across different languages, scripts, and websites to ensure compatibility and a good user experience.
*   **Refer to Samples**: Explore the [fontSettings API example](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/fontSettings) for practical implementation details.