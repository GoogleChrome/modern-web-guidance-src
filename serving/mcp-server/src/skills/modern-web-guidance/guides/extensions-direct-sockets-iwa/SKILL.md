---
description: Enable Isolated Web Apps (IWAs) to establish direct TCP and UDP connections for communicating with legacy systems or hardware devices.
filename: direct-sockets-iwa
category: extensions
---

# Direct Sockets for Isolated Web Apps

Reference docs:
- [Direct Sockets Explainer](https://github.com/WICG/direct-sockets/blob/main/docs/explainer.md)
- [Spec](https://wicg.github.io/direct-sockets/)

## Best Practices

### Establish Direct TCP Connections with `TCPSocket`

To initiate a TCP connection, create a `TCPSocket` instance with the remote address and port. Use the `opened` promise to asynchronously get readable and writable streams for data transfer.

```javascript
const remoteAddress = 'example.com';
const remotePort = 7;
const options = { keepAlive: true, keepAliveDelay: 720000 };

let tcpSocket = new TCPSocket(remoteAddress, remotePort, options);
let { readable, writable } = await tcpSocket.opened;
```

**DO** configure options like `keepAlive`, `noDelay`, `sendBufferSize`, and `receiveBufferSize` for fine-grained network control.

**DO NOT** forget to `releaseLock()` on the reader and writer when done to free up resources.

### Handle TCP Data Streams

Interact with the `TCPSocket` using the standard Streams API. Write data using `writer.write()` with a `BufferSource` and read data using `reader.read()` which yields `Uint8Array`.

```javascript
// Writing data
const writer = writable.getWriter();
const encoder = new TextEncoder();
await writer.write(encoder.encode("Hello Server"));
writer.releaseLock();

// Reading data
const reader = readable.getReader();
const { value, done } = await reader.read();
if (!done) {
    const decoder = new TextDecoder();
    console.log("Received:", decoder.decode(value));
}
reader.releaseLock();
```

**DO** use "Bring Your Own Buffer" (BYOB) reading for performance-critical applications to reduce garbage collection overhead by providing a pre-allocated buffer.

```javascript
const reader = readable.getReader({ mode: 'byob' });
let buffer = new Uint8Array(4096);
const { value, done } = await reader.read(buffer);
if (!done) {
  console.log("Bytes received:", value.byteLength);
}
reader.releaseLock();
```

### Implement UDP Communication with `UDPSocket`

`UDPSocket` supports two modes:

*   **Connected Mode:** For communicating with a single specific destination.
    ```javascript
    let udpSocket = new UDPSocket({ remoteAddress: 'example.com', remotePort: 7 });
    let { readable, writable } = await udpSocket.opened;
    ```
*   **Bound Mode:** For receiving datagrams from arbitrary sources and sending to arbitrary destinations.
    ```javascript
    let udpSocket = new UDPSocket({ localAddress: '::' }); // OS picks port
    let { readable, writable, localPort } = await udpSocket.opened;
    ```

**DO** specify the `remoteAddress` and `remotePort` when writing in bound mode, as the socket can communicate with arbitrary destinations.

**DO NOT** specify `remoteAddress` and `remotePort` when writing in connected mode, as the destination is already fixed.

### Handle UDP Messages

UDP communication involves `UDPMessage` objects. When reading, the `value` object contains `data`, `remoteAddress`, and `remotePort`.

```javascript
// Writing (Bound Mode requires destination)
const writer = writable.getWriter();
await writer.write({
    data: new TextEncoder().encode("Ping"),
    remoteAddress: '192.168.1.50',
    remotePort: 8080
});

// Reading
const reader = readable.getReader();
const { value } = await reader.read();
console.log(`Received from ${value.remoteAddress}:`, value.data);
```

### Enable Multicast UDP Support

For scenarios like device discovery or synchronized media playback, add the `direct-sockets-multicast` and `direct-sockets-private` permissions to your IWA manifest.

```javascript
{
  "permissions_policy": {
    "direct-sockets": ["self"],
    "direct-sockets-multicast": ["self"],
    "direct-sockets-private": ["self"],
    "cross-origin-isolated": ["self"]
  }
}
```

**DO** use `multicastTimeToLive` and `multicastLoopback` options when sending multicast datagrams.

To receive multicast traffic, **DO** open a `UDPSocket` in bound mode and use the `MulticastController` to `joinGroup()`. Use `multicastAllowAddressSharing: true` if multiple applications need to listen on the same port.

```javascript
const socket = new UDPSocket({
  localAddress: '0.0.0.0',
  localPort: 12345,
  multicastAllowAddressSharing: true
});
const { readable, multicastController } = await socket.opened;
await multicastController.joinGroup('239.0.0.1');
// ... read stream ...
await multicastController.leaveGroup('239.0.0.1'); // Recommended
```

### Create a TCP Server with `TCPServerSocket`

Allow your IWA to act as a local server by using `TCPServerSocket`. Incoming connections are available via the readable stream as `TCPSocket` instances.

```javascript
let tcpServerSocket = new TCPServerSocket('::'); // Listen on all interfaces
let { readable } = await tcpServerSocket.opened;
let reader = readable.getReader();
let { value: clientSocket } = await reader.read(); // Accepts next connection
// clientSocket is a TCPSocket
```

## Fallback strategies

The Direct Sockets API is restricted to Isolated Web Apps (IWAs) due to security implications. Ensure your IWA has the necessary `permissions_policy` entries for `direct-sockets`, `direct-sockets-multicast` (if applicable), `direct-sockets-private` (if applicable), and `cross-origin-isolated`.

- **DO** check for the existence of `window.TCPSocket`, `window.UDPSocket`, and `window.TCPServerSocket` for feature detection.
- **DO** ensure your IWA is properly set up and has the required manifest permissions before attempting to use Direct Sockets.