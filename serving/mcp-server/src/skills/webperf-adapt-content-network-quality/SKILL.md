---
description: Adapt web content, like videos, to serve appropriately based on the user's network quality using the Network Information API.
filename: adapt-content-network-quality
category: webperf
---

# Adapt Video to Image Serving Based on Network Quality

Reference docs:
- https://developer.mozilla.org/docs/Web/API/NetworkInformation
- https://developer.mozilla.org/docs/Learn/HTML/Howto/Use_data_attributes

## Best Practices

Serve a background video only when users are on a fast network (`'4g'`). On slower networks, serve an image instead. The Network Information API's `effectiveType` property helps determine the connection speed.

```js
if (navigator.connection && !!navigator.connection.effectiveType) {
  if (navigator.connection.effectiveType === '4g') {
    // Load video
    const video = document.getElementById('coverVideo');
    const videoSource = video.getAttribute('data-src');
    video.setAttribute('src', videoSource);
    video.setAttribute('style', 'height: 100%; width: 100%; display:inline');
  } else {
    // Load image
    const image = document.getElementById('coverImage');
    const imageSource = image.getAttribute('data-src');
    image.setAttribute('src', imageSource);
    image.setAttribute('style', 'height: 100%; width: 100%; display:inline');
  }
} else {
  // Fallback for browsers that don't support the Network Information API
  const video = document.getElementById('coverVideo');
  const videoSource = video.getAttribute('data-src');
  video.setAttribute('src', videoSource);
  video.setAttribute('style', 'height: 100%; width: 100%; display:inline');
}
```

Use `data-src` attributes to store the source URLs for both video and image assets. This allows you to conditionally set the `src` attribute only when the network conditions are met.

```html
<video id="coverVideo" playsinline autoplay loop muted data-src="https://cdn.glitch.com/b6491350-b058-4eb6-aa6c-55c93122073e%2FMatrix%2C%20Console%2C%20Hacking%2C%20Code.mp4?1551464245607"></video>

<img id="coverImage" data-src="https://cdn.glitch.com/36529535-5976-40f8-979b-40c898b86bd0%2F36529535-5976-40f8-979b-40c898b86bd0_1_Sn80dgiwpMjBVrqjfiDbnA.jpg?1553003835358" />
```

## Respond to Network Changes

The Network Information API provides an `onchange` event listener that can be used to dynamically adapt content when the network quality changes. This is useful for updating media quality, restarting data transfers, or notifying users about network fluctuations.

```js
navigator.connection.addEventListener('change', displayNetworkInfo);

function displayNetworkInfo() {
  document.getElementById('connection').innerHTML = navigator.connection.effectiveType;
}

displayNetworkInfo(); // Initial call to display current network info
```

In your `index.html`, include an element to display the network information:

```html
<h2 id="connection"></h2>
```

## Fallback Strategies

For browsers that do not support the Network Information API (`navigator.connection`), provide a fallback mechanism. In this case, the example falls back to loading the video by default.

- **DO** check for the existence of `navigator.connection` and its `effectiveType` property before attempting to use them.
- **DO** implement a default behavior that serves content even if the Network Information API is not available.