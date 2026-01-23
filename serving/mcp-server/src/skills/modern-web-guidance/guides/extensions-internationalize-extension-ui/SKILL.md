---
description: Internationalize your Chrome extension's interface using the chrome.i18n API for multi-language support.
filename: internationalize-extension-ui
category: extensions
---

# Internationalize Your Extension Interface

Use the [`chrome.i18n` API](/docs/extensions/reference/i18n) to make your extension accessible to users in multiple languages.

## Best Practices

To internationalize your extension, begin by creating language-specific message files within a `_locales/` directory. For example:

```none
_locales/en/messages.json
_locales/es/messages.json
```

Each `messages.json` file should contain localized strings, each identified by a unique key. For instance, to localize a tooltip in `_locales/en/messages.json`:

```json
{
  "__MSG_tooltip__": {
   "message": "Hello!",
   "description": "Tooltip"
  }
}
```

You will then reference this key within your `manifest.json` file, specifically in place of the `"default_title"` for the action:

```json
{
  "name": "Tab Flipper",
  ...
  "action": {
    "default_title": "__MSG_tooltip__"
  },
  "default_locale": "en"
  ...
}
```

## Fallback Strategies

For a seamless user experience, ensure you specify a `default_locale` in your `manifest.json`. This locale will be used if a user's browser language doesn't match any of the provided language directories.

## Localization Message Formats

For more detailed information on structuring your localization messages, refer to [Localization message formats](/docs/extensions/how-to/ui/localization-message-formats).