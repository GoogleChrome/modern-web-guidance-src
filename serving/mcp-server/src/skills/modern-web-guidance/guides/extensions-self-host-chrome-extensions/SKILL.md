---
description: Self-host Chrome extensions from a personal server for Linux users, enabling custom packaging, hosting, and updating.
filename: self-host-chrome-extensions
category: extensions
---

# Self-host Chrome Extensions for Linux

This guide covers packaging, hosting, and updating Chrome extensions (`.crx` files) from a personal web server, specifically for Linux users who can install extensions outside the Chrome Web Store.

## Packaging Extensions

Extensions and themes are distributed as `.crx` files. You can either download an existing `.crx` file from the Chrome Web Store or create one locally.

### Download .crx from the Chrome Web Store

If your extension is already on the Chrome Web Store, you can download its `.crx` file from the Developer Dashboard. Navigate to "Your Listings," click "More info" for the desired extension, and then click the blue `main.crx` link in the popup. Hosting this downloaded file on your server is the most secure method, as it's signed by the Chrome Web Store, aiding in tamper detection.

### Create .crx Locally

1.  Navigate to `chrome://extensions/` in your browser's omnibox.
2.  Enable **Developer mode** using the toggle switch.
3.  Click the **PACK EXTENSION** button.
4.  In the "Extension root directory" field, specify the path to your extension's folder.
5.  For the initial package, you can ignore the **Private key** field.
6.  Click **PACK EXTENSION**.

This process generates two files: a `.crx` file and a `.pem` file containing your extension's private key. **Crucially, keep the `.pem` file secure and do not lose it, as it's essential for updating your extension.**

## Hosting .crx Files

To enable users to install extensions by clicking a link on your server, your web server must serve `.crx` files with specific HTTP headers. Chrome considers a file installable if:

*   The `Content-Type` is `application/x-chrome-extension`.

**OR**

*   The file suffix is `.crx` AND:
    *   The `X-Content-Type-Options` header is **NOT** `nosniff`.
    *   The `Content-Type` is one of the following: an empty string, `"text/plain"`, `"application/octet-stream"`, `"unknown/unknown"`, `"application/unknown"`, or `"\*/\*"`.

Common issues include the server sending `X-Content-Type-Options: nosniff` or an unrecognized `Content-Type`. Adjust your server configuration or try a different hosting environment to resolve these header problems.

## Updating Extensions

The browser periodically checks for extension updates by requesting an update manifest XML file from a specified URL.

### Update URL

Extensions hosted outside the Chrome Web Store must declare an `update_url` in their `manifest.json` file:

```json
{
  "name": "My extension",
  ...
  "update_url": "https://myhost.com/mytestextension/updates.xml",
  ...
}
```

### Update Manifest

The update manifest is an XML document that lists available updates.

```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'>
    <updatecheck codebase='https://myhost.com/mytestextension/mte_v2.crx' version='2.0' />
  </app>
</gupdate>
```

Key attributes in the manifest:

*   `appid`: Your extension's unique ID, found on the Extensions Management Page.
*   `codebase`: An HTTPS URL pointing to the `.crx` file.
*   `version`: The new version number. This must match the `"version"` in the extension's `manifest.json`.

### Testing Updates

You can force an update check by going to the Extensions Management Page (`chrome://extensions/`) and clicking **Update extensions now**. Ensure the new `.crx` file is signed with the same private key as the current version.

### Advanced Usage: Request Parameters

For dynamic updates, your server can interpret request parameters:

*   `?x=EXTENSION_DATA`, where `EXTENSION_DATA` is a URL-encoded string like `id=EXTENSION_ID&v=EXTENSION_VERSION`.

This allows a single update URL to serve multiple extensions or versions. If many extensions share an update URL, the browser may split requests to avoid exceeding URL length limits.

### Advanced Usage: Minimum Browser Version

To ensure compatibility with newer APIs, you can specify a minimum browser version:

```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'>
    <updatecheck codebase='http://myhost.com/mytestextension/mte_v2.crx' version='2.0' prodversionmin='3.0.193.0'/>
  </app>
</gupdate>
```

This ensures users only auto-update to version 2.0 if they are running Chrome 3.0.193.0 or later.