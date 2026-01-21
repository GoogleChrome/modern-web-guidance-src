---
description: "Match patterns define groups of URLs for Chrome extensions to interact with, enabling functionality like content script injection and host permission declarations."
filename: match-patterns-for-chrome-extensions
category: extensions
---

# Match Patterns for Chrome Extensions

Match patterns are a fundamental concept for Chrome extensions, dictating which URLs the extension can interact with. They are used in various scenarios, including injecting content scripts, declaring host permissions, granting access to web-accessible resources, and enabling cross-extension messaging.

The general structure of a match pattern is:

```text
<scheme>://<host>/<path>
```

Let's break down each component:

*   **scheme**: Specifies the protocol. Valid schemes include `http`, `https`, `file`, and a wildcard `*` (which matches `http` or `https`).

*   **host**: Defines the domain. This can be a specific hostname (e.g., `www.example.com`), a wildcard for subdomains (e.g., `*.example.com`), or a single wildcard `*`. When using a wildcard in the host, it must be the first or only character and followed by a period (`.`) or a forward slash (`/`).

*   **path**: Represents the URL path. For host permissions, the path is required but often ignored, with `/*` being a conventional placeholder.

## Key Use Cases for Match Patterns

Extensions leverage match patterns for several critical functions:

*   **Injecting Content Scripts**: Target specific web pages to inject custom JavaScript and CSS.
*   **Declaring Host Permissions**: Grant extensions access to specific websites beyond their default permissions.
*   **Web-Accessible Resources**: Allow extensions to expose certain files or resources to web pages.
*   **External Connectable Messages**: Define which origins can send and receive messages from your extension.

## Special Match Pattern Cases

Certain patterns have specific meanings or requirements:

*   `"<all_urls>"`: Matches any URL starting with a permitted scheme. Due to its broad scope, extensions using this pattern may face longer Chrome Web Store review times.

*   `"file:///"`: Grants your extension permission to run on local files. Note that this pattern requires three slashes. Users must manually grant this access.

*   **Localhost URLs and IP Addresses**:
    *   To target any localhost port during development, use `http://localhost/*`.
    *   For IP addresses, specify the address followed by a path wildcard, like `http://127.0.0.1/*`.
    *   `http://*:*/*` can be used to match localhost, IP addresses, and any port.

*   **Top-Level Domain (TLD) Limitations**: Chrome does not support match patterns for TLDs directly. Instead, specify patterns for individual TLDs (e.g., `http://google.es/*`, `http://google.fr/*`).

## Example Patterns

Here are some practical examples of match patterns:

*   `https://*/*` or `https://*/`: Matches any URL using the `https` scheme.
*   `https://*/foo*`: Matches any `https` URL on any host where the path begins with `foo`.
*   `https://*.google.com/foo*bar`: Matches `https` URLs on `google.com` subdomains, with paths starting with `foo` and ending with `bar`.
*   `file:///foo*`: Matches local files whose paths start with `foo`.
*   `http://127.0.0.1/*` or `http://127.0.0.1/`: Matches `http` URLs on the `127.0.0.1` host.
*   `http://localhost/*`: Matches any localhost port.
*   `*://mail.google.com/` or `*://mail.google.com/*`: Matches `http://mail.google.com` or `https://mail.google.com` URLs.

Understanding and correctly implementing match patterns is crucial for developing robust and functional Chrome extensions.