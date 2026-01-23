---
description: Enable cross-platform passkey synchronization in Chrome for enhanced security and user experience.
filename: cross-platform-passkey-sync
category: identity
---

# Cross-Platform Passkey Synchronization in Chrome

## Overview

This document outlines how to enable and manage passkeys across different platforms using Google Password Manager (GPM) within Chrome. Passkeys offer a more secure and user-friendly alternative to traditional passwords, allowing users to authenticate with biometric sensors, PINs, or patterns.

## Key Features and Benefits

*   **Enhanced Security:** Passkeys are resistant to phishing and credential stuffing attacks.
*   **Improved User Experience:** Eliminates the need to remember or manage complex passwords.
*   **Cross-Platform Sync:** Passkeys created in GPM can sync across Android, iOS, Windows, macOS, Linux, and ChromeOS when using Chrome with the same Google Account.
*   **Availability on iOS 17+:** Chrome on iOS 17 and later fully supports creating and syncing passkeys with GPM.

## Implementation Details

### Setting up Chrome as an Autofill Provider on iOS

To utilize passkeys saved in Google Password Manager on iOS 17 or later, users need to configure Chrome as their autofill provider:

1.  Open **System Settings** on a device running iOS 17 or later.
2.  Navigate to **General** > **AutoFill & Passwords**.
3.  Under **AUTOFILL FROM**, toggle Chrome to enable autofill.

### Google Password Manager PIN (GPM PIN)

*   **Purpose:** The GPM PIN is used to secure and restore access to passkeys on new devices. It is end-to-end encrypted and not accessible by Google.
*   **Creation:** Users will be prompted to create a GPM PIN when saving their first passkey to GPM on iOS or when setting up passkeys on a new device.
*   **Usage:** The GPM PIN or the device's unlock method is required to access saved passkeys on a new device or during the creation process on iOS.

### Platform Compatibility Table

| Platform     | Google Password Manager | Apple Passwords |
| :----------- | :---------------------- | :-------------- |
| **Windows**  | ✅<sup>1</sup>         | -               |
| **macOS**    | ✅                      | ✅              |
| **iOS/iPadOS** | ✅<sup>2</sup>         | ✅              |
| **Android**  | ✅                      | -               |
| **Linux**    | ✅                      | -               |
| **ChromeOS** | ✅                      | -               |

*   ✅ Can create and synchronize passkeys
*   <sup>1</sup> Requires TPM
*   <sup>2</sup> Requires iOS/iPadOS 17 or later

**Note:** Chrome on iOS 16 will continue to store passkeys in iCloud Keychain.

## Best Practices

*   **Educate Users:** Clearly communicate the benefits of passkeys and guide users through the setup process, especially on iOS where setting Chrome as an autofill provider is crucial.
*   **GPM PIN Management:** Emphasize the importance of remembering the GPM PIN, as it's essential for restoring access to passkeys on new devices.
*   **Cross-Platform Testing:** Ensure that passkey creation and synchronization function as expected across all supported platforms and devices.
*   **Leverage Existing Infrastructure:** For users already invested in the Google ecosystem, integrating with Google Password Manager provides a seamless transition to passkeys.
*   **Feature Detection:** Implement robust feature detection for passkey support when building cross-platform applications to ensure graceful degradation or polyfill usage where necessary.

## Learn More

*   **Understand Passkeys in 4 minutes:** [https://www.youtube.com/watch?v=2xdV-xut7EQ](https://www.youtube.com/watch?v=2xdV-xut7EQ)
*   **Passwordless login with passkeys:** [https://developers.google.com/identity/passkeys/](https://developers.google.com/identity/passkeys/)
*   **Passkeys on the Web:** [https://goo.gle/passkeys-web](https://goo.gle/passkeys-web)
*   **Supported Environments:** [https://developers.google.com/identity/passkeys/supported-environments](https://developers.google.com/identity/passkeys/supported-environments)