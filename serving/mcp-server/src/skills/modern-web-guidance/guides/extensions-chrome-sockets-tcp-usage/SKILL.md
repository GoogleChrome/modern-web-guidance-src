---
description: Learn how to use the chrome.sockets.tcp API to establish and manage TCP connections for network applications within Chrome extensions.
filename: chrome-sockets-tcp-usage
category: extensions
---

# Using chrome.sockets.tcp

This document outlines the best practices and common use cases for the `chrome.sockets.tcp` API, which allows Chrome extensions to create and manage low-level TCP network sockets.

## Core Concepts

The `chrome.sockets.tcp` API provides a way for extensions to interact directly with TCP/IP networking. This is particularly useful for applications that need to communicate with servers using custom protocols or implement network-aware features not covered by higher-level APIs like HTTP.

### Establishing a Connection

The primary function is `chrome.sockets.tcp.create()`, followed by `chrome.sockets.tcp.connect()`.

```javascript
chrome.sockets.tcp.create({}, function(createInfo) {
  const socketId = createInfo.socketId;
  chrome.sockets.tcp.connect(socketId, 'example.com', 80, function(result) {
    if (result === 0) {
      console.log('Connected successfully!');
      // Proceed with sending/receiving data
    } else {
      console.error('Connection failed:', chrome.runtime.lastError);
    }
  });
});
```

### Sending and Receiving Data

After a successful connection, you can use `chrome.sockets.tcp.send()` and `chrome.sockets.tcp.onReceive.addListener()` to exchange data.

```javascript
const message = new ArrayBuffer(10); // Your data
chrome.sockets.tcp.send(socketId, message, function(sendInfo) {
  if (sendInfo.resultCode < 0) {
    console.error('Send failed:', chrome.runtime.lastError);
  }
});

chrome.sockets.tcp.onReceive.addListener(function(receiveInfo) {
  if (receiveInfo.socketId === socketId) {
    const data = receiveInfo.data;
    console.log('Received data:', data);
    // Process received data
  }
});
```

### Closing the Connection

Always remember to close the socket when it's no longer needed using `chrome.sockets.tcp.close()`.

```javascript
chrome.sockets.tcp.close(socketId, function() {
  console.log('Socket closed.');
});
```

## Best Practices

*   **Error Handling**: Always check for `chrome.runtime.lastError` after calling any `chrome.sockets.tcp` method. Network operations are prone to failure.
*   **Resource Management**: Ensure sockets are properly closed using `chrome.sockets.tcp.close()` to free up system resources. Listen for extension shutdown events (`chrome.runtime.onSuspend`) to close any open sockets.
*   **Data Conversion**: The API often deals with `ArrayBuffer` or `string` types for data. Be mindful of encoding and decoding when converting between them.
*   **Permissions**: The `sockets.tcp` permission is required in the extension's manifest.
*   **Security**: Be cautious when connecting to untrusted servers. Validate any data received and avoid exposing sensitive information.
*   **Asynchronous Operations**: All `chrome.sockets.tcp` methods are asynchronous. Use callbacks or Promises (with `chrome.runtime.lastError` handling) to manage the flow.
*   **Keepalive**: For persistent connections, implement keepalive mechanisms to detect and handle disconnections gracefully.

## Use Cases

*   **Custom Protocols**: Implementing clients for non-HTTP protocols (e.g., IRC, custom game servers).
*   **Network Diagnostics**: Tools to probe network services or test connectivity.
*   **Real-time Communication**: Enabling chat applications or live data feeds within an extension.
*   **IoT Integration**: Communicating with devices on a local network.

## Manifest Permissions

```json
{
  "manifest_version": 3,
  "permissions": [
    "sockets.tcp"
  ]
}
```