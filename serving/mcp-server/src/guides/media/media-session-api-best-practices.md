---
description: Customize media playback notifications and controls using the Media Session API to enhance user experience across various devices.
filename: media-session-api-best-practices
category: media
---

# Media Session API: Best Practices

Reference docs:
- [Media Session Spec](https://wicg.github.io/mediasession)
- [Media Session Samples](https://googlechrome.github.io/samples/media-session/)

## Best Practices

The Media Session API allows web developers to provide rich metadata about media being played and to handle playback controls initiated by the user or the system. This ensures a consistent and controllable media experience for users across different platforms and devices.

### Setting Media Metadata

Provide comprehensive metadata to enrich media notifications and controls. This includes `title`, `artist`, `album`, and `artwork`. For richer experiences, leverage `chapterInfo` to allow users to navigate through media content.

```js
if ("mediaSession" in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Song Title',
    artist: 'Artist Name',
    album: 'Album Name',
    artwork: [
      { src: 'path/to/artwork-96x96.png',   sizes: '96x96',   type: 'image/png' },
      { src: 'path/to/artwork-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    chapterInfo: [{
      title: 'Chapter 1',
      startTime: 0,
      artwork: [
        { src: 'path/to/chapter-artwork-128.png', sizes: '128x128', type: 'image/png' },
      ]
    }]
  });
}
```

**DO** update `navigator.mediaSession.metadata` whenever the media source or its information changes to ensure accuracy in notifications.

### Handling Media Actions

Implement handlers for media session actions to respond to user interactions like play, pause, next track, seek, and more. This allows your web application to control media playback directly from system-level controls.

```js
navigator.mediaSession.setActionHandler('play', async () => {
  await video.play();
  navigator.mediaSession.playbackState = 'playing';
});

navigator.mediaSession.setActionHandler('pause', () => {
  video.pause();
  navigator.mediaSession.playbackState = 'paused';
});

navigator.mediaSession.setActionHandler('seekbackward', (details) => {
  const skipTime = details.seekOffset || 15; // Default to 15 seconds
  video.currentTime = Math.max(video.currentTime - skipTime, 0);
  updatePositionState();
});

navigator.mediaSession.setActionHandler('seekforward', (details) => {
  const skipTime = details.seekOffset || 15; // Default to 15 seconds
  video.currentTime = Math.min(video.currentTime + skipTime, video.duration);
  updatePositionState();
});

// Add handlers for other actions as needed (e.g., 'nexttrack', 'stop', 'seekto')
```

**DO** use `try...catch` blocks when setting action handlers, as not all actions are supported in all environments.

### Managing Playback State and Position

Keep the `navigator.mediaSession.playbackState` property synchronized with the actual media playback state (`'playing'` or `'paused'`). This ensures that the media controls in notifications accurately reflect the current status.

```js
function updatePositionState() {
  if ('setPositionState' in navigator.mediaSession) {
    navigator.mediaSession.setPositionState({
      duration: video.duration,
      playbackRate: video.playbackRate,
      position: video.currentTime,
    });
  }
}

video.addEventListener('play', () => {
  navigator.mediaSession.playbackState = 'playing';
  updatePositionState();
});

video.addEventListener('pause', () => {
  navigator.mediaSession.playbackState = 'paused';
  updatePositionState();
});

video.addEventListener('ratechange', updatePositionState);
```

**DO** set the playback position state using `setPositionState` to provide accurate progress information in media controls.

### Video Conferencing and Slideshow Controls

Leverage specific actions for video conferencing (`togglemicrophone`, `togglecamera`, `hangup`) and slideshows (`previousslide`, `nextslide`) to integrate seamlessly with Picture-in-Picture windows and other specialized interfaces.

```js
// Example for toggling microphone
let isMicrophoneActive = false;
navigator.mediaSession.setActionHandler('togglemicrophone', () => {
  isMicrophoneActive = !isMicrophoneActive;
  navigator.mediaSession.setMicrophoneActive(isMicrophoneActive);
  // ... application-specific logic to mute/unmute microphone
});
```

**DO** refer to the [Media Session Samples](https://googlechrome.github.io/samples/media-session/) for detailed implementation examples for these specialized actions.

## Fallback Strategies

While the Media Session API is widely supported, consider potential differences in implementation or availability across browsers and platforms.

- **DO** check for the existence of `navigator.mediaSession` before attempting to use its features.
- **DO** ensure that metadata and actions are updated dynamically as the media state changes to provide the most current information to the user.
- **DO** provide sensible defaults for seek offsets if the `details.seekOffset` is not provided in the action handler.

```js
if (!navigator.mediaSession) {
  console.warn('Media Session API is not supported in this browser.');
  // Optionally, provide alternative UI or disable related features.
}
```