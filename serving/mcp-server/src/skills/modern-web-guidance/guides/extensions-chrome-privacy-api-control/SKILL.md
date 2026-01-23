---
description: Control Chrome settings related to user privacy using the chrome.privacy API, ensuring user consent and understanding.
filename: chrome-privacy-api-control
category: extensions
---

# Chrome Privacy API

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/privacy
- https://developer.chrome.com/docs/extensions/mv3/manifest

## Best Practices

When controlling Chrome settings with the `chrome.privacy` API, it's crucial to ensure your extension has the necessary permissions and to handle the `levelOfControl` to avoid unexpected behavior for the user.

### Permissions

You must declare the "privacy" permission in your extension's `manifest.json` to use the API.

```json
{
  "name": "My privacy-controlling extension",
  ...
  "permissions": [
    "privacy"
  ],
  ...
}
```

### Checking and Setting Values

Before changing a setting, always check its `levelOfControl` using the `get()` method. Only attempt to `set()` a value if your extension has control (`'controllable_by_this_extension'`). If the setting is not controllable by your extension (e.g., controlled by enterprise policies or another extension), warn the user.

```js
// Get current value and level of control
chrome.privacy.services.autofillCreditCardEnabled.get({}, function(details) {
  if (details.value) {
    console.log('Autofill is on!');
  } else {
    console.log('Autofill is off!');
  }

  // Attempt to set value only if controllable
  if (details.levelOfControl === 'controllable_by_this_extension') {
    chrome.privacy.services.autofillCreditCardEnabled.set({ value: true }, function() {
      if (chrome.runtime.lastError === undefined) {
        console.log("Autofill enabled successfully!");
      } else {
        console.error("Failed to enable autofill:", chrome.runtime.lastError);
      }
    });
  } else {
    console.warn('Autofill cannot be controlled by this extension.');
    // Consider visually disabling the feature or informing the user
  }
});
```

Refer to `chrome.types.ChromeSetting` for detailed information on `levelOfControl` values.

### Listening for Changes

Use the `onChange` event to be notified of changes to a setting's value or control level. This is useful for informing the user if a setting they expected to be controlled by your extension is changed by another source.

```js
chrome.privacy.services.autofillCreditCardEnabled.onChange.addListener(
  function (details) {
    // details.value: the new value of the setting
    // details.levelOfControl: the new level of control
    // details.incognitoSpecific: boolean, true if the value is specific to Incognito mode
    console.log('Autofill setting changed:', details);
    // You might want to update your UI or inform the user here
  }
);
```

## Concepts

The `chrome.privacy` API allows extensions to read and modify Chrome settings that affect user privacy. This includes features like autofill, site data, and network behavior.

### Reading Settings

To read a setting, call the `get()` method on the specific `ChromeSetting` object you are interested in. This returns the current `value` and `levelOfControl`.

### Changing Settings

To change a setting, call the `set()` method with the desired `value`. However, it is essential to first verify `levelOfControl` to ensure your extension can actually modify the setting. If the setting is not controllable by your extension, the `set()` call will succeed but the change will be immediately overridden.

## Examples

For a practical demonstration, explore the [privacy API example](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/privacy) available in the [chrome-extension-samples](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples) repository.