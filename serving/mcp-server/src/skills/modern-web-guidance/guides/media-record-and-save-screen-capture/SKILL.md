---
description: Record and save the user's screen using the Screen Capture API and MediaRecorder API, with local preview and file saving capabilities.
filename: record-and-save-screen-capture
category: media
---

# Record and Save Screen Capture

This guide explains how to record and save the user's screen using web APIs, allowing for local preview and saving to the user's file system.

## Best Practices

To record the user's screen, you can leverage the `getDisplayMedia()` method from the Screen Capture API, which allows the user to select a screen to capture as a media stream. This stream can then be recorded using the `MediaRecorder API`. For saving the recording, the `showSaveFilePicker()` method from the File System Access API is recommended.

### Screen Sharing with `getDisplayMedia()`

- **DO** use `navigator.mediaDevices.getDisplayMedia()` to prompt the user to share their screen or a specific window.
- **DO** handle the returned `MediaStream` object for further processing.

### Recording with `MediaRecorder`

- **DO** instantiate `MediaRecorder` with the `MediaStream` obtained from `getDisplayMedia()`.
- **DO** listen for the `dataavailable` event on the `MediaRecorder` instance to receive recording chunks.
- **DO** consider the `MediaRecorder` states (`recording`, `inactive`) for proper control flow.
- **DO** ensure to stop the stream tracks (`stream.getTracks().forEach(track => track.stop())`) when screen sharing is no longer needed to release resources and stop the capture.

### Saving to File with File System Access API

- **DO** use `window.showSaveFilePicker()` to allow the user to choose a location and filename for the recording. This method returns a `FileSystemFileHandle`.
- **DO** create a `FileSystemWritableFileStream` from the `FileSystemFileHandle` using `handle.createWritable()`.
- **DO** write the `Blob` data received from the `MediaRecorder`'s `dataavailable` event to the writable stream using `writable.write()`.
- **DO** close the writable stream (`writable.close()`) when the recording is finished to ensure all data is flushed and the file is finalized.

```js
let stream;
let recorder;
let writableStream; // Declare writableStream here

async function startScreenCapture() {
  try {
    stream = await navigator.mediaDevices.getDisplayMedia();
    recorder = new MediaRecorder(stream);

    // Preview the screen locally
    const videoElement = document.getElementById('video'); // Assuming you have a <video id="video"></video> element
    if (videoElement) {
      videoElement.srcObject = stream;
    }

    recorder.addEventListener("dataavailable", async (event) => {
      if (event.data && event.data.size > 0) {
        if (!writableStream) {
           // Prompt user for save location only when data is available and stream is active
           const suggestedName = "screen-recording.webm";
           const handle = await window.showSaveFilePicker({ suggestedName });
           writableStream = await handle.createWritable();
        }
        await writableStream.write(event.data);
      }
    });

    recorder.addEventListener("stop", async () => {
      if (writableStream) {
        await writableStream.close();
        writableStream = null; // Reset for next recording
      }
      if (videoElement) {
        videoElement.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      stream = null;
      recorder = null;
    });

    recorder.start();
  } catch (error) {
    console.error("Error starting screen capture:", error);
  }
}

function stopScreenCapture() {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  } else {
    // If recorder is not active, ensure cleanup happens
    if (writableStream) {
        writableStream.abort(); // Abort if not closed and recording is already stopped/errored
        writableStream = null;
    }
    if (document.getElementById('video').srcObject) {
        document.getElementById('video').srcObject = null;
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    recorder = null;
  }
}

// Example usage with buttons:
// const shareScreenButton = document.getElementById('shareScreenButton');
// const stopShareScreenButton = document.getElementById('stopShareScreenButton');
//
// shareScreenButton.addEventListener('click', startScreenCapture);
// stopShareScreenButton.addEventListener('click', stopScreenCapture);

```

### Fallback Strategies

It's crucial to consider browsers that might not fully support all features.

#### `getDisplayMedia()`

- **DO** use `if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)` for JavaScript feature detection.

#### `MediaRecorder` API

- **DO** use `if (window.MediaRecorder)` for JavaScript feature detection.

#### File System Access API (`showSaveFilePicker`)

- **DO** use `if (window.showSaveFilePicker)` for JavaScript feature detection.
- **IMPORTANT**: The `showSaveFilePicker()` method is part of the File System Access API, which is a powerful but potentially sensitive API. Ensure you follow security best practices and user privacy guidelines. For browsers that do not support `showSaveFilePicker()`, you will need to implement alternative download mechanisms (e.g., creating an `<a>` tag with the `download` attribute and a Blob URL). Refer to [https://web.dev/patterns/files/save-a-file/](https://web.dev/patterns/files/save-a-file/) for guidance.

## Further Reading

- [W3C Screen Capture Specification](https://w3c.github.io/mediacapture-screen-share/)
- [MDN Web Docs: MediaDevices.getDisplayMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [MDN Web Docs: MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [web.dev: Saving files locally with the File System Access API](https://web.dev/patterns/files/save-a-file/)