---
description: Prevent security vulnerabilities by migrating away from the deprecated document.domain setter.
filename: deprecate-document-domain
category: security
---

# Deprecate `document.domain`

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Document/domain#setter
- https://chromiumdash.appspot.com/schedule
- https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API

## Best Practices

Starting in Chrome 115, the `document.domain` setter is being deprecated. If your website relies on this feature to relax the same-origin policy, you must take action to ensure continued functionality and security. The primary recommendation is to migrate to alternative communication methods like `postMessage()` or the Channel Messaging API.

### Migrate to `postMessage()` or Channel Messaging API

These APIs provide secure and standard ways for cross-origin communication without compromising security.

Here's a typical pattern:

On the parent page (`https://parent.example.com`):

```js
// Send a message to the iframe (https://video.example.com)
iframe.postMessage('Request DOM manipulation', 'https://video.example.com');

// Listen for messages from the iframe
iframe.addEventListener('message', (event) => {
  // Ensure the message is from the expected origin
  if (event.origin !== 'https://video.example.com') return;

  // Process the received data
  if (event.data === 'succeeded') {
    // DOM manipulation was successful
  }
});
```

On the iframe page (`https://video.example.com`):

```js
// Listen for messages from the parent
window.addEventListener('message', (event) => {
  // Ensure the message is from the expected origin
  if (event.origin !== 'https://parent.example.com') return;

  // Perform DOM manipulation on the video page.

  // Send a success message back to the parent
  event.source.postMessage('succeeded', event.origin);
});
```

### As a last resort, use `Origin-Agent-Cluster: ?0`

If migrating to `postMessage()` or Channel Messaging API is not feasible due to significant re-work, you can maintain `document.domain` functionality by sending the `Origin-Agent-Cluster: ?0` response header.

```http
Origin-Agent-Cluster: ?0
```

This header instructs the browser to handle the document outside of the origin-keyed agent cluster, allowing `document.domain` to remain settable. All documents that need this behavior must send this header.

### Configure enterprise policy

For organizations, administrators can disable this behavior by default across their Chrome instances by configuring the `OriginAgentClusterDefaultEnabled` policy to `false`.

## Fallback strategies

The change to `document.domain` will be rolled out progressively, starting with Chrome 115. It's crucial to test your site's behavior and implement necessary changes.

### Detecting the change

Chrome warns about `document.domain` deprecation in the DevTools Issues panel starting in 2022. You can also use the Lighthouse deprecated API audit to identify affected APIs. If you have the Reporting API set up, Chrome has sent deprecation reports.

### Enabling the change for testing

To observe the change before it's rolled out to your browser:

1. Navigate to `chrome://flags/#origin-agent-cluster-default`.
2. Select **Enable.**
3. Restart Chrome.

## Resources

- [Document.domain - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/domain)
- [Origin Isolation and Deprecating `document.domain`](https://github.com/mikewest/deprecating-document-domain/)
- [Deprecating `document.domain`. · Issue #564 · w3ctag/design-reviews](https://github.com/w3ctag/design-reviews/issues/564)