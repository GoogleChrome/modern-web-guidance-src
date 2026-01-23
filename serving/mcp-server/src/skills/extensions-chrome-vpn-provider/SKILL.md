---
description: Implement VPN functionality in Chrome extensions to create secure, persistent network connections for users.
filename: chrome-vpn-provider
category: extensions
---

# Chrome VPN Provider API

## Best Practices

The `chrome.vpnProvider` API allows Chrome extensions to create and manage VPN configurations. This is typically used to build custom VPN clients that integrate with the ChromeOS network UI, providing users with a seamless way to connect to secure networks.

When implementing a VPN provider, consider the following:

*   **Configuration Management:** Use `createConfig` to define VPN configurations that users can select and manage within ChromeOS settings. Ensure `destroyConfig` is called when a configuration is no longer needed.
*   **Connection Lifecycle:** Handle connection and disconnection events (`onPlatformMessage`) to manage the VPN session. This involves initiating the connection, setting parameters, and notifying the connection state.
*   **Packet Handling:** Implement logic to send IP packets through the VPN tunnel using `sendPacket` and to receive incoming packets via the `onPacketReceived` event.
*   **User Experience:** Provide clear feedback to the user about the connection status. The `notifyConnectionStateChanged` method is crucial for this.
*   **Security:** Ensure all sensitive data is handled securely and that the VPN implementation adheres to best practices for network security.

## Usage Flow

A typical VPN provider implementation follows these steps:

1.  **Create Configuration:** Call `chrome.vpnProvider.createConfig` to register a new VPN configuration.
2.  **Listen for Events:** Add listeners for `chrome.vpnProvider.onPlatformMessage`, `chrome.vpnProvider.onPacketReceived`, and `chrome.vpnProvider.onConfigRemoved`.
3.  **Handle Connection Request:** When the user attempts to connect, `onPlatformMessage` will receive `"connected"`.
4.  **Establish VPN Connection:** Initiate the actual VPN connection to your server and start your VPN client.
5.  **Set Parameters:** Use `chrome.vpnProvider.setParameters` to configure the connection details.
6.  **Notify Connection State:** Call `chrome.vpnProvider.notifyConnectionStateChanged` with `"connected"` once the tunnel is established.
7.  **Manage Traffic:** Use `chrome.vpnProvider.sendPacket` to send outgoing IP packets and process incoming packets received via `onPacketReceived`.
8.  **Handle Disconnection:** When the user disconnects, `onPlatformMessage` will receive `"disconnected"`.
9.  **Clean Up:** If the configuration is no longer required, use `chrome.vpnProvider.destroyConfig`.

```javascript
// Example of creating a VPN configuration and setting up event listeners
chrome.vpnProvider.createConfig({
  name: "My Awesome VPN",
  // other configuration options
});

chrome.vpnProvider.onPlatformMessage.addListener((message, configId) => {
  if (message === "connected") {
    console.log(`VPN session connected for config: ${configId}`);
    // Initiate VPN client connection and tunnel setup
  } else if (message === "disconnected") {
    console.log(`VPN session disconnected for config: ${configId}`);
    // Clean up VPN client and resources
  }
});

chrome.vpnProvider.onPacketReceived.addListener((packet, configId) => {
  console.log(`Received packet for config: ${configId}`);
  // Process incoming IP packet
});

chrome.vpnProvider.onConfigRemoved.addListener((configId) => {
  console.log(`Configuration removed: ${configId}`);
  // Clean up any associated resources
});

// Example of sending a packet
const packetData = new ArrayBuffer(1500); // Example packet data
chrome.vpnProvider.sendPacket(packetData, "my-config-id");

// Example of notifying connection state
chrome.vpnProvider.notifyConnectionStateChanged("connected", "my-config-id");

// Example of destroying a configuration
chrome.vpnProvider.destroyConfig("my-config-id");