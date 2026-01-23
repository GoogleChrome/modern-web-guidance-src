---
description: Log Encrypted Media Extensions (EME) events and calls to the DevTools console for debugging.
filename: eme-logger
category: media
---

# EME Logger

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Encrypted_Media_Extensions_API
- https://developers.google.com/web/fundamentals/media/eme

## Best Practices

The EME Logger Chrome extension provides valuable debugging information for developers working with Encrypted Media Extensions (EME). It logs EME events and API calls directly to the Chrome DevTools console, making it easier to understand and troubleshoot DRM implementations.

### Installation

Install the EME Logger extension from the Chrome Web Store: [EME Call and Event Logger](https://chrome.google.com/webstore/detail/eme-call-and-event-logger/cniohcjecdcdhgmlofniddfoeokbpbpb)

### Usage

Once installed, simply navigate to a web page that utilizes EME. Open the Chrome DevTools (usually by pressing F12), and the EME Logger will automatically start recording events and API calls in the console.

**Key information logged includes:**
- EME events (e.g., `encrypted`, `needkey`)
- EME API calls (e.g., `requestMediaKeySystemAccess`, `createSession`, `generateRequest`, `loadSession`, `update`, `close`)
- Associated data and parameters for each event and call.

### Code Availability

The source code for EME Logger is available on GitHub: [google/eme_logger](https://github.com/google/eme_logger). Contributions, bug reports, and feature requests are welcome.

## Alternatives and Related Technologies

### Shaka Player

For implementing EME without building everything from scratch, Google recommends **Shaka Player**. It's a JavaScript library that simplifies adaptive delivery of protected media using DASH and MSE.

- **Website:** [g.co/shakainfo](http://g.co/shakainfo)
- **Adaptive Streaming:** Dynamic Adaptive Streaming over HTTP (DASH)
- **Media Extensions:** Media Source Extensions (MSE)

### EME Basics

For a deeper understanding of Encrypted Media Extensions, refer to the HTML5 Rocks article:
- **EME WTF:** http://www.html5rocks.com/tutorials/eme/basics/