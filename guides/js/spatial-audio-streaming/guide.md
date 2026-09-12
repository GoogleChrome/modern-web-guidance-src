---
name: spatial-audio-streaming
description: Stream and decode immersive spatial audio using Media Source Extensions with fallback to standard audio.
web-feature-ids:
  - media-source
  - audio
  - tmp-iamf
---

# Streaming Spatial Audio with IAMF and Media Source Extensions

Delivering immersive 3D audio on the web historically required proprietary audio container formats, client-side Web Audio routing graphs, or heavy custom decoders. 

The **Immersive Audio Model and Formats (IAMF)** is an open, royalty-free spatial audio specification supporting channel-based, scene-based (Ambisonics), and object-based audio presentations. Combined with **Media Source Extensions (MSE)**, web applications can stream adaptive, segmented spatial audio directly into native `<audio>` or `<video>` elements with hardware-accelerated playback and standardized channel rendering.

## How to Implement

### 1. Detect Support for IAMF over MSE

Before initializing an IAMF stream, verify that the browser supports both `MediaSource` and the IAMF codec profile within an MP4 container:

```javascript
// Check whether MediaSource and the IAMF codec in MP4 container are supported
const IAMF_MIME_TYPE = 'audio/mp4; codecs="iamf"';

const isIAMFSupported = typeof window.MediaSource !== 'undefined' &&
  MediaSource.isTypeSupported(IAMF_MIME_TYPE);
```

### 2. Attach MediaSource to the Media Element

Create a new `MediaSource` instance and set its object URL as the `src` attribute of an `<audio>` element:

```javascript
const audioElement = document.querySelector('audio');
const mediaSource = new MediaSource();

// Attach MediaSource to the HTMLMediaElement
audioElement.src = URL.createObjectURL(mediaSource);
```

### 3. Initialize SourceBuffer on `sourceopen`

Wait for the `sourceopen` event on the `MediaSource` instance before creating the `SourceBuffer` and appending audio chunks:

```javascript
mediaSource.addEventListener('sourceopen', () => {
  // Create a SourceBuffer configured for IAMF streaming
  const sourceBuffer = mediaSource.addSourceBuffer(IAMF_MIME_TYPE);

  // Fetch initialization segment and audio media segments
  fetchAndAppendAudioSegments(sourceBuffer, mediaSource);
}, { once: true });
```

### 4. Append Audio Segments and Manage Stream Lifecycle

Queue and append audio chunks safely by listening to the `updateend` event to prevent overlapping append operations:

```javascript
async function fetchAndAppendAudioSegments(sourceBuffer, mediaSource) {
  const segmentUrls = [
    '/audio/iamf_init.mp4',
    '/audio/iamf_seg1.m4s',
    '/audio/iamf_seg2.m4s'
  ];

  for (const url of segmentUrls) {
    const response = await fetch(url);
    const chunk = await response.arrayBuffer();

    // Ensure the SourceBuffer is not currently updating before appending
    if (sourceBuffer.updating) {
      await new Promise(resolve => sourceBuffer.addEventListener('updateend', resolve, { once: true }));
    }

    sourceBuffer.appendBuffer(chunk);
  }

  // Signal completion once all segments have been appended
  sourceBuffer.addEventListener('updateend', () => {
    if (!sourceBuffer.updating && mediaSource.readyState === 'open') {
      mediaSource.endOfStream();
    }
  }, { once: true });
}
```

---

## Fallback Strategies

{{ FEATURE_FALLBACKS("media-source") }}

If the browser does not natively support IAMF over MSE, implement progressive enhancement by falling back to standard AAC or Opus stereo/surround streams:

```javascript
const IAMF_MIME = 'audio/mp4; codecs="iamf"';
const FALLBACK_AAC_MIME = 'audio/mp4; codecs="mp4a.40.2"';
const FALLBACK_OPUS_MIME = 'audio/webm; codecs="opus"';

function resolveAudioStreamConfig() {
  if (typeof window.MediaSource !== 'undefined') {
    if (MediaSource.isTypeSupported(IAMF_MIME)) {
      return { mimeType: IAMF_MIME, streamUrl: '/streams/spatial-iamf.mpd', format: 'iamf' };
    }
    if (MediaSource.isTypeSupported(FALLBACK_AAC_MIME)) {
      return { mimeType: FALLBACK_AAC_MIME, streamUrl: '/streams/stereo-aac.mpd', format: 'aac' };
    }
    if (MediaSource.isTypeSupported(FALLBACK_OPUS_MIME)) {
      return { mimeType: FALLBACK_OPUS_MIME, streamUrl: '/streams/stereo-opus.mpd', format: 'opus' };
    }
  }

  // Direct progressive download fallback for environments without MSE
  return { mimeType: 'audio/mp3', streamUrl: '/audio/fallback.mp3', format: 'direct-mp3' };
}
```
