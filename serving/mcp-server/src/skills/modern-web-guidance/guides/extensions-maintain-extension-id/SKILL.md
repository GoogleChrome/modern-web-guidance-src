---
description: Ensure your Chrome extension consistently uses the same unique ID during development by uploading it to the developer dashboard and retrieving its public key.
filename: maintain-extension-id
category: extensions
---

# Maintain a consistent extension ID

Maintaining a consistent extension ID is crucial during development. This allows you to configure server-side settings, enable other extensions or websites to communicate with yours, and grant access to your extension's web-accessible resources.

## Best Practices

To ensure your extension always has the same ID, follow these steps:

1.  **Upload your extension to the developer dashboard:**
    *   Package your extension directory into a `.zip` file.
    *   Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard) and click **Add new item**.
    *   Upload your `.zip` file. **Do not publish it.**
    *   Navigate to the **Package** tab and click **View public key**.

    <figure>
      <img src="/images/docs/extensions/reusing-prod-extension-id/developer-dashboard.png" alt="View public key button in Package tab" class="screenshot" width=500>
      <figcaption>View public key button in Package tab</figcaption>
    </figure>

2.  **Copy the public key:**
    *   In the dialog window that appears, copy the text between `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----`.
    *   Remove all newlines from the copied text to create a single line.

    <figure>
      <img src="/images/docs/extensions/reusing-prod-extension-id/public-key-popup.png" alt="Public key dialog window" class="screenshot" width=500>
      <figcaption>Public key dialog window</figcaption>
    </figure>

3.  **Add the key to your `manifest.json`:**
    *   Paste the single-line public key into the `"key"` field of your `manifest.json` file.

    ```json
    { // manifest.json
      "manifest_version": 3,
      // ... other manifest properties
      "key": "PASTE_YOUR_PUBLIC_KEY_HERE"
    }
    ```

4.  **Verify the extension ID:**
    *   Open the Extensions Management page (`chrome://extensions`).
    *   Ensure **Developer mode** is enabled.
    *   Load your unpackaged extension directory.
    *   Compare the extension ID displayed on the Extensions Management page with the Item ID shown in the Developer Dashboard. They should match.

    <img src="/images/docs/extensions/reusing-prod-extension-id/the-id-the-extension-mat.png" alt="The ID of the extension match" width="356" height="352">

By following these steps, you ensure that your extension will always be assigned the same unique ID, simplifying development workflows and enabling robust integration with other services and extensions.