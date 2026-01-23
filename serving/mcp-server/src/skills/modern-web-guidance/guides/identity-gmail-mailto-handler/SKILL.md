---
description: Configure your browser to use Gmail as the default email client for all mailto links.
filename: gmail-mailto-handler
category: identity
---

# Using Gmail as your default mailto handler

Reference docs:
- https://web.dev/articles/registering-a-custom-protocol-handler

## Best Practices

You can configure Chrome and Firefox to use Gmail as your default email client for all `mailto:` links using the `navigator.registerProtocolHandler()` JavaScript API. This prevents desktop email clients from opening unexpectedly when you click a `mailto:` link.

### Steps to configure

1.  Open a Gmail tab in your browser. This step **must** be done from the Gmail tab.
2.  Open your browser's JavaScript console.
    *   On Mac: `cmd-opt-j`
    *   On Windows: `ctrl-shift-j`
3.  Enter the following JavaScript command:
    ```javascript
    navigator.registerProtocolHandler("mailto", "https://mail.google.com/mail/?extsrc=mailto&url=%s", "Gmail");
    ```
4.  Accept the confirmation prompt from your browser.
5.  Test the configuration by clicking a `mailto:` link, such as this one: [mailto:yourbestfriend@example.com?subject=registerProtocolHandler()%20FTW!&amp;body=Check%20out%20what%20I%20learned%20at%20http%3A%2F%2Fupdates.html5rocks.com%2F2012%2F02%2FGetting-Gmail-to-handle-all-mailto-links-with-registerProtocolHandler%0A%0APlus%2C%20flawless%20handling%20of%20the%20subject%20and%20body%20parameters.%20Bonus%20from%20RFC%202368!](mailto:yourbestfriend@example.com?subject=registerProtocolHandler()%20FTW!&amp;body=Check%20out%20what%20I%20learned%20at%20http%3A%2F%2Fupdates.html5rocks.com%2F2012%2F02%2FGetting-Gmail-to-handle-all-mailto-links-with-registerProtocolHandler%0A%0APlus%2C%20flawless%20handling%20of%20the%20subject%20and%20body%20parameters.%20Bonus%20from%20RFC%202368!)

## Removing the setting

If you need to disable this setting later:
*   **Chrome:** Navigate to `chrome://settings/handlers`.
*   **Firefox:** Navigate to `Preferences -> Applications -> mailto`.