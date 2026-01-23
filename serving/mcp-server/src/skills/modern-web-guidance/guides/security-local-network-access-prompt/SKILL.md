---
description: Protect users from local network-based attacks by implementing Chrome's new permission prompt for sites connecting to local networks.
filename: local-network-access-prompt
category: security
---

# Local Network Access Permission Prompt

This document outlines best practices for implementing Chrome's new Local Network Access permission prompt, designed to protect users from cross-site request forgery (CSRF) attacks targeting routers and other devices on private networks.

## Primary Use Case: Protecting Local Network Resources

Websites that need to connect to a user's local network (including servers running locally on the user's machine) must now request explicit permission through a new prompt in Chrome. This is a critical security enhancement to prevent malicious sites from accessing or controlling local devices without user consent.

## Best Practices

### Opt-in for Testing

To prepare for the upcoming release and test your applications, enable the new restrictions by navigating to `chrome://flags/#local-network-access-check` and setting the flag to "Enabled (Blocking)".

### Implementing Local Network Access in Your Application

Chrome will automatically gate local network requests behind a permission prompt. However, to ensure a smooth transition and avoid mixed content issues, you should annotate your requests:

*   **Private IP Literals:** Requests to IP addresses reserved for local use (e.g., `192.168.0.1`) are automatically recognized.
*   **`.local` Domains:** Hostnames ending in `.local` are also recognized as local network destinations.
*   **`targetAddressSpace` Option:** For requests where the destination might not be immediately obvious or to explicitly flag a local network request, use the `targetAddressSpace: "local"` option in your `fetch()` calls.

**Example `fetch` calls:**

```js
// Example 1: Private IP literal is exempt from mixed content.
fetch("http://192.168.0.1/ping");

// Example 2: `.local` domain is exempt from mixed content.
fetch("http://router.local/ping");

// Example 3: Public domain is not exempt from mixed content,
// even if it resolves to a local network address.
fetch("http://example.com/ping");

// Example 4: Adding the `targetAddressSpace` option flags that
// the request will go to the local network, and is thus exempt
// from mixed content.
fetch("http://example.com/ping", {
  targetAddressSpace: "local",
});
```

### Handling Mixed Content

Because the Local Network Access permission is restricted to secure contexts, and migrating local network devices to HTTPS can be challenging, Chrome exempts certain permission-gated local network requests from mixed content checks. This exemption applies if Chrome can determine the request is local *before* resolving the destination. The conditions for exemption are listed in the "What kinds of requests are affected?" section of the original documentation.

### Known Issues and Limitations (Chrome 138)

*   WebSockets, WebTransport, and WebRTC connections to the local network are not yet gated by the LNA permission.
*   Local network requests from Service Workers and Shared Workers require the worker's origin to have been previously granted permission. You may need to trigger a request from the main application to prompt the user.

### Migration Path and Future Considerations

*   **Origin Trials:** For sites needing more time, especially those relying on HTTP for local resources, an Origin Trial will be available to temporarily opt-out of the secure contexts requirement.
*   **Enterprise Policies:** Chrome will introduce enterprise policies to manage which sites can make local network requests, allowing pre-granting or pre-denying permissions in managed environments.
*   **Expanding Protections:** Future updates will integrate the LNA permission with WebSockets, WebTransport, and WebRTC. Protections will also extend to cover all cross-origin requests to local network destinations.

## Feedback and Reporting Issues

Your feedback is crucial for the successful implementation of Local Network Access.

*   **Test your website:** Enable the flag at `chrome://flags#local-network-access-check` and verify that your website correctly triggers the permission prompt and functions as expected after granting permission.
*   **Report issues:** If you encounter any problems or have feedback, please file an issue at the [Chromium Issue Tracker](https://issues.chromium.org/u/1/issues/new?component=1456234&template=0) or on the [LNA specification GitHub repository](https://github.com/WICG/local-network-access/issues/new).