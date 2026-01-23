---
description: |
  This document explains how to use the `chrome.dns` API to resolve DNS
  records for a given hostname, enabling developers to programmatically
  obtain IP addresses within their Chrome extensions.
filename: chrome-dns-api-usage
category: extensions
---

# Using the `chrome.dns` API

This document details the usage of the `chrome.dns` API, which allows Chrome extensions to perform DNS lookups programmatically.

## Resolving Hostnames

The primary function of the `chrome.dns` API is to resolve hostnames to IP addresses. This is achieved using the `resolve()` method.

### Best Practices for `resolve()`

*   **DO** ensure that the hostname provided to `chrome.dns.resolve()` does not include a scheme (like `http://` or `https://`) or a trailing slash. For example, `example.com` is valid, but `https://example.com/` is not.
*   **DO** handle the asynchronous nature of the `resolve()` method using `async/await` or Promises.
*   **DO** check the `record.address` property of the returned object to get the IP address.

```javascript
const resolveDNS = async () => {
    try {
        let record = await chrome.dns.resolve('example.com');
        console.log(`The IP address for example.com is: ${record.address}`);
    } catch (error) {
        console.error(`DNS resolution failed: ${error}`);
    }
};

resolveDNS();
```

## Permissions and Availability

### Permissions

To use the `chrome.dns` API, you must declare the `"dns"` permission in your extension's manifest file:

```json
{
  "name": "My DNS Extension",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": [
    "dns"
  ],
  "background": {
    "service_worker": "service-worker.js"
  }
}
```

### Availability

The `chrome.dns` API is currently only available in **Chrome Dev channel** builds. There are no immediate plans to move this API to the stable Chrome channel.

<aside class="note"><b>Note:</b> This API is experimental and may be subject to change. It is recommended for development and testing purposes on the Chrome Dev channel.</aside>

## Example Usage

The following code snippet demonstrates how to call `chrome.dns.resolve()` to retrieve the IP address of `example.com` and log it to the console.

```javascript
// In your service-worker.js or other extension script
const resolveExampleCom = async () => {
    try {
        const dnsRecord = await chrome.dns.resolve('example.com');
        console.log(`Resolved IP address: ${dnsRecord.address}`);
        // Expected output might be something like: Resolved IP address: 192.0.2.172
    } catch (e) {
        console.error('DNS resolution failed:', e);
    }
};

resolveExampleCom();
```

<aside class="key-point"><b>Key point:</b> Always validate the hostname format before passing it to `chrome.dns.resolve()` to prevent unexpected errors.</aside>

For more information on Chrome extension development, refer to the [official Chrome Extensions documentation][manifest].

[manifest]: /docs/extensions/mv3/manifest/