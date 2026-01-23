---
description: Enable extensions to create custom input methods for users to type text and input characters.
filename: input-ime
category: extensions
---

# Input IME

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/input.ime

## Best Practices

The `chrome.input.ime` API allows extensions to create custom input method editors (IMEs), enabling users to input text and characters through alternative methods. This is particularly useful for languages not well-supported by default keyboards, or for specialized input needs.

To implement an IME, you will need to handle several key events:

- **`onFocus`**: This event fires when an input field gains focus. It provides context information about the focused element, including its `contextID`. You should store this `contextID` as it will be needed to commit text.
- **`onKeyEvent`**: This is the core event for your IME. It fires whenever a key event occurs in the focused input field. Your extension should process these events, determine the appropriate text to input, and then use `chrome.input.ime.commitText` to insert it. If your IME handles the key event, return `true`; otherwise, return `false` to allow default processing.

```js
var context_id = -1;

chrome.input.ime.onFocus.addListener(function(context) {
  context_id = context.contextID;
});

chrome.input.ime.onKeyEvent.addListener(
  function(engineID, keyData) {
    // Example: Convert typed letters to uppercase
    if (keyData.type == "keydown" && keyData.key.match(/^[a-z]$/)) {
      chrome.input.ime.commitText({"contextID": context_id,
                                    "text": keyData.key.toUpperCase()});
      return true; // Indicate that the event was handled
    } else {
      return false; // Allow default handling for other keys
    }
  }
);
```

## Permissions

To use the `input.ime` API, you must declare the `"input"` permission in your extension's manifest file.

```json
{
  "name": "My Custom IME",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": [
    "input"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "input_components": [
    {
      "name": "My IME",
      "type": "ime",
      "id": "my_ime"
    }
  ]
}
```

## Manifest Keys

When defining your IME within the `manifest.json` file, you will use the `input_components` key. This key is an array where each object defines an input component, typically an IME.

```json
"input_components": [
  {
    "name": "My IME",
    "type": "ime",
    "id": "my_ime"
  }
]
```

- **`name`**: The user-visible name of the input component.
- **`type`**: Must be `"ime"` for input method editors.
- **`id`**: A unique identifier for the IME.

## Availability

The `chrome.input.ime` API is available on ChromeOS. Ensure your extension targets this platform if you intend to use this API.

## Notes on Implementation

- **Context Management**: Always ensure you have a valid `contextID` before attempting to commit text. The `onFocus` event is the primary way to obtain this.
- **Error Handling**: Consider adding error handling for API calls, as they may fail under certain circumstances.
- **User Experience**: Design your IME with a clear and intuitive user interface and input logic to provide a good user experience.