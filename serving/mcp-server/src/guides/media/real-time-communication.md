---
description: Enable real-time audio and video communication directly within web browsers without plugins, facilitating seamless peer-to-peer interaction.
filename: real-time-communication
category: media
---

# Real-time Communication

Reference docs:
- https://webrtc.github.io/webrtc-pc/
- https://www.w3.org/TR/mediacapture-streams/
- https://webrtc.org/
- https://github.com/webrtc/samples

## Best Practices

WebRTC enables rich, real-time communication capabilities directly in the browser. To implement this effectively, focus on the core APIs: `MediaStream` (or `getUserMedia`) for capturing audio and video, `RTCPeerConnection` for establishing and managing peer-to-peer connections, and `RTCDataChannel` for arbitrary data transfer.

### Getting Started with `getUserMedia`

- **DO** use `navigator.mediaDevices.getUserMedia()` to request access to the user's camera and microphone.
- **DO** handle the returned `Promise` to obtain a `MediaStream` object.
- **DO** attach the `MediaStream` to a `<video>` element using the `srcObject` attribute for displaying local or remote video.
- **DO** ensure that `track.stop()` is called on `MediaStreamTrack` objects when they are no longer needed to release camera and microphone resources.
- **DO** be aware that `getUserMedia()` requires a secure origin (HTTPS) and permissions are granted by the user.

```javascript
navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  .then(stream => {
    const videoElement = document.querySelector('video');
    videoElement.srcObject = stream;
  })
  .catch(err => {
    console.error('Error accessing media devices.', err);
  });
```

### Establishing Peer Connections with `RTCPeerConnection`

- **DO** use `RTCPeerConnection` to manage the connection between peers.
- **DO** configure `RTCPeerConnection` with STUN and TURN server information for NAT traversal.
- **DO** implement a signaling mechanism (e.g., WebSockets, Socket.IO) to exchange session control messages, network configuration, and media capabilities between peers.
- **DO** handle `onicecandidate` events to send ICE candidates to the other peer.
- **DO** use `createOffer()` and `createAnswer()` with `setLocalDescription()` and `setRemoteDescription()` to negotiate the session.
- **DO** attach incoming media streams using the `ontrack` event.
- **DO** remember to call `pc.close()` on `RTCPeerConnection` objects when they are no longer needed to prevent resource leaks.

```javascript
const pc = new RTCPeerConnection(configuration); // configuration includes STUN/TURN servers

pc.onicecandidate = (event) => {
  if (event.candidate) {
    signalingChannel.send({ candidate: event.candidate });
  }
};

pc.ontrack = (event) => {
  const remoteVideo = document.getElementById('remoteVideo');
  remoteVideo.srcObject = event.streams[0];
};

async function createOfferAndSetLocal() {
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signalingChannel.send({ description: pc.localDescription });
  } catch (e) {
    console.error('Error creating or setting local description:', e);
  }
}
```

### Transferring Data with `RTCDataChannel`

- **DO** use `RTCDataChannel` for low-latency, high-throughput peer-to-peer transfer of arbitrary data.
- **DO** leverage `RTCPeerConnection` for session setup and security.
- **DO** implement reliable or unreliable delivery semantics as needed for your application (e.g., gaming vs. text chat).
- **DO** be aware of the WebSocket-like API (`send()`, `onmessage`).

```javascript
const sendChannel = pc.createDataChannel("chat");

sendChannel.onopen = () => {
  console.log('Data channel opened');
};

sendChannel.onmessage = (event) => {
  console.log('Message received:', event.data);
};

function sendMessage(message) {
  if (sendChannel.readyState === 'open') {
    sendChannel.send(message);
  }
}
```

## Fallback strategies

While WebRTC is widely supported, consider graceful degradation for older browsers or environments where it might not be fully available.

### Feature Detection

- **DO** use browser compatibility resources like caniuse.com and Chrome Platform Status to understand API availability.
- **DO** implement checks for the existence of `navigator.mediaDevices`, `RTCPeerConnection`, and `RTCDataChannel` before attempting to use them.
- **DO** provide alternative user experiences or informative messages when WebRTC features are not supported.

```javascript
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  alert('getUserMedia is not supported in this browser.');
} else if (!window.RTCPeerConnection || !window.RTCDataChannel) {
  alert('RTCPeerConnection or RTCDataChannel is not supported in this browser.');
} else {
  // Proceed with WebRTC implementation
}
```

### Signaling Server Considerations

- **DO** choose a signaling protocol and transport (e.g., WebSockets) that is robust and widely supported.
- **DO** ensure your signaling server can handle the initial negotiation phase, including ICE candidate exchange and offer/answer SDP exchange.
- **DO** consider using libraries like Socket.IO for easier WebSocket implementation.

### Network Traversal (STUN/TURN)

- **DO** configure STUN servers to help peers discover their public IP addresses and ports.
- **DO** implement TURN servers as a fallback for cases where direct peer-to-peer connections fail due to strict NATs or firewalls.
- **DO** utilize publicly available STUN servers (e.g., `stun:stun.l.google.com:19302`) for development, but consider hosting your own for production.