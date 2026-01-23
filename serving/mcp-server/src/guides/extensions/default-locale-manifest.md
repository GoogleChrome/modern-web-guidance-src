---
description: Manages default language strings for Chrome extensions by specifying the locale subdirectory.
filename: default-locale-manifest
category: extensions
---

# Default Locale Manifest

This section of the `manifest.json` file specifies the subdirectory within `_locales` that contains the default language strings for your Chrome extension.

<aside class="caution"><b>Important:</b> Chrome is removing support for Chrome Apps on all platforms. Chrome browser and the Chrome Web Store will continue to support extensions. <a href="https://blog.chromium.org/2020/08/changes-to-chrome-app-support-timeline.html"><strong>Read the announcement</strong></a> and learn more about <a href="/apps/migration"><strong>migrating your app</strong></a>.</aside>

## Manifest - Default Locale

The `default_locale` field is **required** for extensions that include a `_locales` directory. If your extension does not have a `_locales` directory, this field **must be absent**.

For detailed information on internationalization, refer to [Internationalization][3].

## Best Practices

*   **Include `default_locale` if you have a `_locales` directory:** This setting is crucial for defining the primary language of your extension when no other locale is matched.
*   **Ensure `default_locale` points to an existing subdirectory:** The value should be the name of a valid subdirectory within your `_locales` folder (e.g., "en" for English).
*   **Omit `default_locale` if no `_locales` directory exists:** Including this field without a corresponding `_locales` directory can lead to errors.

## Example

Consider an extension with the following directory structure:

```
myextension/
├── manifest.json
└── _locales/
    ├── en/
    │   └── messages.json
    └── fr/
        └── messages.json
```

Your `manifest.json` file would include the `default_locale` field like this:

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0",
  "default_locale": "en",
  // ... other manifest properties
}
```

In this example, "en" is specified as the default locale. If the user's browser language is set to French, the strings from `_locales/fr/messages.json` will be used. For any other language, or if the browser language isn't specifically supported, the strings from `_locales/en/messages.json` will be used.

## Further Reading

*   [Internationalization][3]

[1]: https://blog.chromium.org/2020/08/changes-to-chrome-app-support-timeline.html
[2]: /apps/migration
[3]: /extensions/i18n