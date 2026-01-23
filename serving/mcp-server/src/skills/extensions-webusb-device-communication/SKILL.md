---
description: Enable web applications to communicate directly with USB devices, allowing for richer hardware interactions without native applications.
filename: webusb-device-communication
category: extensions
---

# WebUSB Device Communication

This guide outlines best practices for enabling web applications to communicate directly with Universal Serial Bus (USB) devices. This allows for richer hardware interactions and the development of web-based control panels or tools for USB peripherals.

## Best Practices

### Device Descriptors

*   **DO** include standard USB descriptors that accurately describe your device's functionality, including interfaces, endpoints, and class information.
*   **DO** leverage the WebUSB Platform Capability Descriptor within the Binary Device Object Store (BOS) descriptor to signal WebUSB support to the browser. This descriptor includes a GUID, a version, a vendor-specific code, and an index for a landing page URL.
*   **DO** provide a URL descriptor if the `iLandingPage` field in the WebUSB Platform Capability Descriptor is non-zero. This URL can direct the user to a web page when the device is plugged in.
*   **DO** use `bVendorCode` from the WebUSB Platform Capability Descriptor to facilitate `GET_URL` requests from the browser, allowing it to retrieve the landing page URL.

### Platform-Specific Considerations

*   **macOS:** No special configuration is typically required. Ensure the interface is not claimed by a kernel driver or another application.
*   **Linux:** Configure `udev` rules to grant appropriate user/group permissions for accessing USB devices. A common practice is to add users to the `plugdev` group.
*   **Android:** Devices without built-in OS drivers are generally accessible. Users will encounter a prompt to grant permission for the browser to access the device.
*   **ChromeOS:** Access is typically allowed as long as at least one interface remains unclaimed.
*   **Windows:**
    *   **INF File:** For older Windows versions or specific configurations, create and install a Driver Information File (`.inf`) that associates your device's Vendor and Product IDs with the WinUSB driver. This file should specify the necessary `DeviceInterfaceGUIDs`.
    *   **Microsoft OS Compatibility Descriptors:** For Windows 8.1 and later, extend the BOS descriptor with the Microsoft OS 2.0 platform capability descriptor. This allows the device to provide information, including the `CompatibleID` (set to `WINUSB`) and registry properties (like `DeviceInterfaceGUIDs`), directly during enumeration, eliminating the need for manual INF installation.

### Device Firmware & Implementation

*   **DO NOT** rely solely on standard USB classes if you need custom device functionality. Use vendor-specific classes and interfaces for custom communication protocols.
*   **DO** ensure that interfaces intended for WebUSB are not claimed by default operating system drivers. A device can have multiple interfaces, some of which can be claimed by the OS while others are available to WebUSB.
*   **DO** consider the little-endian nature of the USB bus when encoding integer values in descriptors.
*   **DO** thoroughly test your device on all target platforms to ensure correct driver behavior and WebUSB accessibility.

## Feature Detection

When implementing WebUSB functionality in your web application, it's crucial to detect browser support and device availability:

*   **DO** use `navigator.usb` to check if the WebUSB API is available in the browser.
*   **DO** use `navigator.usb.requestDevice()` to prompt the user to select a USB device. This function takes `filters` objects that can specify `vendorId`, `productId`, `classCode`, etc., to narrow down the device selection.
*   **DO** handle the promise returned by `requestDevice()` to get a `USBDevice` object, which represents the selected device.

## Fallback Strategies

While WebUSB aims for broad compatibility, consider scenarios where direct device access might not be available or ideal:

*   **Alternative APIs:** For devices that implement standard USB classes with corresponding web APIs (e.g., HID, Audio, Video), prioritize using those specific APIs (e.g., WebHID, `getUserMedia()`).
*   **Progressive Enhancement:** Design your web application to function with core features even if WebUSB is unavailable, providing enhanced functionality when it is supported.
*   **User Education:** Clearly communicate to users the requirements for using WebUSB, especially regarding driver installation or permissions on specific operating systems.