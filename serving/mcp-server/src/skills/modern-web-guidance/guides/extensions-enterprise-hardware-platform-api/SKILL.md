---
description: Provides Chrome extensions with access to hardware and platform-specific information for enhanced device management and security.
filename: enterprise-hardware-platform-api
category: extensions
---

# chrome.enterprise.hardwarePlatform API

This API allows Chrome extensions, installed via policy, to access information about the hardware and platform of the managed device. This is crucial for enterprise environments where device management, security, and tailored user experiences are paramount.

## Primary Use Case: Device Information for Policy-Enforced Functionality

The `chrome.enterprise.hardwarePlatform` API is designed for extensions that need to understand the underlying hardware and operating system details of a Chrome device to enable or customize features that are managed and enforced by an organization's IT policies. This can include functionalities related to security posture, hardware-dependent features, or customized deployment scenarios.

## Best Practices

When utilizing the `chrome.enterprise.hardwarePlatform` API, adhere to the following best practices to ensure robust, secure, and efficient operation:

### Access Control and Permissions

*   **Explicitly Declare Permissions:** Always declare the necessary permissions in your extension's `manifest.json` file. For this API, you will likely need permissions related to accessing platform information.
*   **Request Permissions Judiciously:** Only request the permissions your extension absolutely requires. Over-requesting permissions can raise security concerns and reduce user trust.
*   **Policy Enforcement is Key:** Remember that this API is intended for extensions installed via policy. Ensure your extension's functionality aligns with the overarching enterprise management strategy. The `EnterpriseHardwarePlatformAPIEnabled` policy key must be enabled for the API to function.

### Data Handling and Privacy

*   **Minimize Data Collection:** Collect only the hardware and platform information that is strictly necessary for your extension's core functionality.
*   **Secure Data Transmission:** If any collected information needs to be transmitted externally (e.g., to a management server), ensure it is done over a secure, encrypted channel (HTTPS).
*   **Anonymize or Aggregate Data:** Whenever possible, anonymize or aggregate collected data before reporting to protect individual user privacy.

### Feature Detection and Fallbacks

*   **Check for API Availability:** Before attempting to use methods or properties of the `chrome.enterprise.hardwarePlatform` API, check if the API and its specific components are available in the current browser environment. While designed for enterprise, it's good practice to have a graceful degradation path if the API is not accessible.
*   **Handle Policy-Disabled Scenarios:** Be prepared for scenarios where the `EnterpriseHardwarePlatformAPIEnabled` policy might be disabled. Your extension should not break entirely if it cannot access this information. Consider providing a reduced functionality mode or informative messages to the user or administrator.

### Manifest Configuration

*   **Correct Manifest Keys:** Ensure that any relevant manifest keys associated with hardware platform access are correctly configured as per Chrome extension documentation. The `chrome.enterprise.hardwarePlatform` API itself doesn't directly map to manifest keys for *enabling* the API (that's policy-driven), but other related configurations might exist.

### Extension Lifecycle Management

*   **Update Safely:** When updating your extension, ensure backward compatibility for any features relying on `chrome.enterprise.hardwarePlatform`. If you introduce changes that alter how hardware information is used, provide clear documentation for administrators.

By following these best practices, you can effectively leverage the `chrome.enterprise.hardwarePlatform` API to build powerful and compliant enterprise Chrome extensions.