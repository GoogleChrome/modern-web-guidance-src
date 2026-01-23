---
description: Securely code in Chrome's browser process by understanding sandbox limitations and implementing best practices to mitigate risks.
filename: coding-outside-the-sandbox
category: security
---

# Coding Outside the Sandbox

When developing for Chrome, it's crucial to understand the implications of running code in different processes, especially the browser process, which lacks a sandbox. This means bugs in the browser process can grant malicious code full access to the user's device. This guide outlines the dos and don'ts for coding safely in this environment.

## Understanding the Browser Process

Chrome splits its operations into various processes. Some of these are *sandboxed*, meaning they have restricted access to the system and user data. This significantly limits the damage a bug in a sandboxed process can cause.

However, the **browser process is not sandboxed**. Consequently, vulnerabilities here are far more severe, potentially allowing malicious code to install programs, steal sensitive data, modify system settings, access all browser tabs, and compromise login credentials.

## Common Mistakes to Avoid

When coding in the browser process, be aware of and actively avoid these common pitfalls:

*   **DO NOT parse or interpret untrustworthy data using C++ in the browser process.**
*   **DO NOT trust the origin a renderer claims to represent.** Always use Chrome's `RenderFrameHost` to securely obtain the current origin.

## Best Practices for Browser Process Development

To mitigate risks associated with coding outside the sandbox, adopt the following best practices:

*   **Exercise extreme caution** if your code resides in the browser process.
*   **Validate all Inter-Process Communication (IPC)** rigorously. Assume that all other processes are potentially compromised and attempting to deceive your code.
*   **Perform processing in a sandboxed environment** whenever possible. This includes renderer processes, utility processes, or other sandboxed components.
*   **Prioritize memory-safe languages** such as JavaScript for processing. This can prevent over 50% of common security bugs.

Historically, network stacks (like HTTP, DNS, QUIC) were run in the browser process, leading to critical vulnerabilities. On some platforms, networking has been moved to its own process, with sandboxing planned.

## Additional Resources

*   **Chromium's Rule of Two:** Understand the principle of limiting the combination of unsafe data, unsafe code, and unsafe processes to no more than two.
    [https://chromium.googlesource.com/chromium/src/+/master/docs/security/rule-of-2.md](https://chromium.googlesource.com/chromium/src/+/master/docs/security/rule-of-2.md)
*   **Validating IPC Data:** Learn how to ensure that data received via IPC from renderer processes is trustworthy and not misleading.
    [https://chromium.googlesource.com/chromium/src/+/HEAD/docs/security/mojo.md#Validate-privilege_presuming-data-received-over-IPC](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/security/mojo.md#Validate-privilege_presuming-data-received-over-IPC)
*   **Chrome's Sandbox Implementation Guide:** For a deeper understanding of Chrome's sandboxing mechanisms.
    [https://chromium.googlesource.com/chromium/src/+/master/docs/design/sandbox.md](https://chromium.googlesource.com/chromium/src/+/master/docs/design/sandbox.md)