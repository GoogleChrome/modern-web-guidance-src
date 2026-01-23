---
description: Resolve hostnames and IP address literals to their corresponding IP addresses using the Chrome DNS API.
filename: chrome-dns-resolution
category: extensions
---

# Chrome DNS Resolution

The `chrome.dns` API provides a way for Chrome extensions to perform DNS lookups directly within the browser. This can be useful for a variety of purposes, such as validating domain names, retrieving IP addresses for network-related tasks, or integrating with external services that require DNS information.

## Primary Use Case: Resolving Hostnames to IP Addresses

The most common use case for the `chrome.dns` API is to resolve a given hostname (like `www.example.com`) or an IP address literal (like `192.168.1.1`) to its corresponding IP address. This is achieved using the `chrome.dns.resolve()` method.

### How to Resolve a Hostname

The `chrome.dns.resolve()` method takes a single argument: the hostname or IP address literal to resolve. It returns a Promise that resolves with a `ResolveCallbackResolveInfo` object.

The `ResolveCallbackResolveInfo` object has the following properties:

*   `address`: A string representing the IP address literal. This is supplied only if `resultCode` indicates success.
*   `resultCode`: A number representing the result code. Zero indicates success.

```javascript
chrome.dns.resolve('www.google.com').then((resolveInfo) => {
  if (resolveInfo.resultCode === 0) {
    console.log(`The IP address for www.google.com is: ${resolveInfo.address}`);
  } else {
    console.error(`DNS resolution failed with code: ${resolveInfo.resultCode}`);
  }
});
```

## Permissions

To use the `chrome.dns` API, your extension must declare the `dns` permission in its `manifest.json` file:

```json
{
  "manifest_version": 3,
  "name": "My DNS Extension",
  "version": "1.0",
  "permissions": ["dns"],
  "background": {
    "service_worker": "background.js"
  }
}
```

## Availability

The `chrome.dns` API is currently available only on the **Dev channel** of Chrome. This means it might not be available in stable releases of Chrome and could be subject to change.

## Best Practices

*   **Always check `resultCode`**: Ensure that the DNS resolution was successful by checking if `resultCode` is equal to `0` before attempting to use the `address`.
*   **Handle errors gracefully**: If `resultCode` is not `0`, log the error code or provide user feedback indicating that the resolution failed.
*   **Consider fallback mechanisms**: Since the API is only available on the Dev channel, consider alternative methods for DNS resolution if your extension needs to work on stable Chrome versions. This might involve using a remote server or a different browser API if available.
*   **Inform users about channel requirements**: If your extension relies on `chrome.dns`, clearly communicate to users that it requires the Dev channel of Chrome.
*   **Use Promises effectively**: The `resolve()` method returns a Promise, so leverage `async/await` or `.then()` for cleaner asynchronous code.