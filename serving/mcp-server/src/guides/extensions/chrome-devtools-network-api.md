---
description: Inspect and debug network requests in Chrome Developer Tools using the chrome.devtools.network API.
filename: chrome-devtools-network-api
category: extensions
---

# chrome.devtools.network

The `chrome.devtools.network` API allows you to inspect and debug network requests made by the inspected page within Chrome Developer Tools. This API provides access to the HTTP Archive (HAR) format, enabling you to retrieve details about each request and its response.

## Best Practices

When working with the `chrome.devtools.network` API, consider the following best practices to ensure efficient and effective debugging:

### Accessing HAR Data

The `chrome.devtools.network.getHAR()` method returns the entire HAR log, which can be useful for a comprehensive overview of network activity. For real-time event handling, subscribe to `chrome.devtools.network.onRequestFinished`. This event provides individual HAR entries as they complete, allowing you to process them as they occur.

### Handling Request Content

For efficiency, the `getContent()` method for request bodies is not directly provided within the HAR entry. If you need to retrieve the content of a request, you must explicitly call the `request.getContent()` method.

### Reloading for Complete Data

If the Developer Tools window is opened after a page has finished loading, some network requests might be missing from the HAR log. To ensure you have a complete list of requests, reload the inspected page. Generally, the list of requests returned by `getHAR()` should align with what is displayed in the Network panel.

### Understanding HAR Format

The `chrome.devtools.network` API represents network requests using the HTTP Archive (HAR) format. While a detailed explanation of HAR is beyond the scope of this document, you can refer to the [HAR v1.2 Specification][2] for comprehensive details.

## Permissions and Availability

Ensure that your extension has the necessary permissions to use the `chrome.devtools.network` API. This API is available in extensions that extend Chrome Developer Tools. Refer to the [DevTools APIs summary][1] for general guidance on using these APIs.

## Examples

The following code snippet demonstrates how to log the URLs of all images larger than 40KB as they are loaded:

```js
chrome.devtools.network.onRequestFinished.addListener(
  function(request) {
    if (request.response.bodySize > 40*1024) {
      chrome.devtools.inspectedWindow.eval(
          'console.log("Large image: " + unescape("' +
          escape(request.request.url) + '"))');
    }
  }
);
```

To experiment with this API, you can explore the [devtools API examples](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/devtools) available in the [chrome-extension-samples](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples) repository.

[1]: /docs/extensions/how-to/devtools/extend-devtools
[2]: http://www.softwareishard.com/blog/har-12-spec/