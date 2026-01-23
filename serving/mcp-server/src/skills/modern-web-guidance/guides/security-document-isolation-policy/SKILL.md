---
description: Securely enable advanced web features like SharedArrayBuffers and WebAssembly threads using Document Isolation Policy for enhanced application capabilities.
filename: document-isolation-policy
category: security
---

# Document Isolation Policy

Reference docs:
- https://developer.mozilla.org/docs/Web/API/Window/crossOriginIsolated
- https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy
- https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy

## Best Practices

Document Isolation Policy offers a more streamlined approach to achieving `crossOriginIsolation` compared to COOP and COEP. It allows for per-frame isolation without imposing requirements on subframes.

### Enabling Document Isolation Policy

To enable Document Isolation Policy for a specific frame, you need to send the `Document-Isolation-Policy` header with your document. This header can take two primary modes:

*   **`isolate-and-require-corp`**: In this mode, cross-origin subresources must explicitly declare their cross-origin resource policy using the `Cross-Origin-Resource-Policy` header. Resources without this header will be blocked, ensuring intentional sharing.
*   **`isolate-and-credentialless`**: This mode allows cross-origin resources to be loaded without CORS headers but strips any credentials (like cookies or HTTP authentication) from the request. This provides a less restrictive but still secure way to handle non-CORS resources.

### Using Document Isolation Policy with SharedArrayBuffers and WebAssembly Threads

By enabling `crossOriginIsolation` via Document Isolation Policy, you unlock access to powerful web functionalities such as `SharedArrayBuffers` and WebAssembly threads, which are otherwise restricted due to security concerns.

### Frame Communication and Storage Access

*   Iframes isolated with Document Isolation Policy do not have synchronous DOM access to same-origin iframes that are not isolated.
*   However, these isolated iframes can still communicate with non-isolated frames using cross-origin `Window` methods like `postMessage`.
*   Isolated iframes retain full access to storage APIs, allowing for data persistence and sharing within the same origin, even with isolation enabled.

## Fallback Strategies

While Document Isolation Policy is a newer feature, it's important to consider scenarios where it might not be available or supported. However, the nature of this policy being a server-sent header means that robust browser-level fallbacks are less common than for client-side APIs. The primary fallback is to *not* enable the policy if the server is not configured to send the header, or if the browser does not support it (though support is becoming widespread).

If your application *relies* on features unlocked by `crossOriginIsolation` (like `SharedArrayBuffer`) and you need to support older browsers that might not fully implement Document Isolation Policy or `crossOriginIsolation` itself, consider these general strategies:

### Feature Detection for `crossOriginIsolated`

*   **DO** use `if (window.crossOriginIsolated)` to check if the current context is isolated.
*   **DO** provide alternative user experiences or gracefully degrade functionality if `crossOriginIsolated` is `false`. This might involve disabling certain advanced features or informing the user about browser requirements.

### Alternative Approaches for Shared Memory (if `crossOriginIsolated` is not available)

For scenarios where `SharedArrayBuffer` is critical and `crossOriginIsolated` is not an option (e.g., older browser versions or environments where the policy cannot be enforced), consider:

*   **Message Passing**: Utilize `postMessage` for inter-frame or inter-worker communication, although this does not provide the shared memory benefits of `SharedArrayBuffer`.
*   **Server-Side Processing**: Offload computationally intensive tasks to the server if client-side parallel processing is not feasible due to security or browser limitations.
*   **Web Workers**: Use Web Workers for background processing, but note that `SharedArrayBuffer` is often a prerequisite for efficient data sharing between workers.

Remember that Document Isolation Policy is primarily about enabling features *securely*. If you cannot enable the policy, the secure default is to *not* enable the features it unlocks.