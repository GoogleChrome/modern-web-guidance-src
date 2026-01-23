---
description: Respond to custom key combinations in an extension to trigger specific actions.
filename: command-key-combinations
category: extensions
---

# Responding to Commands

Commands are custom key combinations that developers can define to invoke specific extension features. These commands are registered in the extension's `manifest.json` file under the `"commands"` key.

## Registering Commands

To register a command, include a `"commands"` object in your `manifest.json`. Each command should have a unique name, a `suggested_key` object that specifies the default and platform-specific key combinations, and a `description`.

```json
{
  "name": "My Awesome Extension",
  "version": "0.1",
  "manifest_version": 3,
  "description": "Enables custom keyboard shortcuts for extension features.",
  "background": {
    "service_worker": "background.js"
  },
  "commands": {
   "save-data": {
     "suggested_key": {
       "default": "Ctrl+Shift+S",
       "mac": "Command+Shift+S"
     },
     "description": "Save current data"
   },
   "open-settings": {
     "suggested_key": {
       "default": "Ctrl+Shift+O",
       "mac": "Command+Shift+O"
     },
     "description": "Open extension settings"
   }
  }
}
```

## Handling Commands in the Service Worker

When a registered command key combination is pressed, the `commands.onCommand` event is fired in your extension's service worker. You can listen for this event and execute the corresponding action.

```javascript
chrome.commands.onCommand.addListener((command) => {
  if (command === "save-data") {
    // Logic to save data
    console.log("Data saved!");
  } else if (command === "open-settings") {
    // Logic to open settings
    console.log("Opening settings...");
    chrome.runtime.openOptionsPage();
  }
});
```

## Best Practices

*   **Choose intuitive key combinations:** Select shortcuts that are easy to remember and unlikely to conflict with common browser or operating system shortcuts.
*   **Provide clear descriptions:** Ensure the `description` for each command accurately reflects the action it performs.
*   **Handle command conflicts gracefully:** While `suggested_key` provides defaults, users can change these. Your extension should ideally still function if a user rebinds a command to a different shortcut.
*   **Test on multiple platforms:** Verify that your suggested key combinations work as expected on different operating systems (Windows, macOS, Linux).
*   **Consider accessibility:** For critical features, consider providing alternative ways to access them beyond just keyboard shortcuts.

For a practical example, you can explore the [Tab Flipper](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/default_command_override) sample extension and [load it unpacked](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).