---
description: Enable speech recognition in web applications using the Web Speech API for interactive voice-driven experiences.
filename: web-speech-api
category: ui
---

# Voice Driven Web Apps with the Web Speech API

Reference docs:
- https://w3c.github.io/speech-api/
- https://developer.chrome.com/blog/webspeechapi/

## Best Practices

The Web Speech API provides a straightforward way to integrate speech recognition into web pages, allowing for more dynamic and accessible user interactions.

### Feature Detection

Always check for browser support of the `webkitSpeechRecognition` object before attempting to use the API.

```js
if (!('webkitSpeechRecognition' in window)) {
    // Provide a fallback or inform the user to upgrade their browser
    alert("Your browser does not support the Web Speech API. Please upgrade to a recent version of Chrome.");
} else {
    // Proceed with using the API
    var recognition = new webkitSpeechRecognition();
    // ... rest of your implementation
}
```

### Configuring Recognition

*   **`continuous`**: Set to `true` for continuous recognition (e.g., dictation), and `false` for simple command recognition.
*   **`interimResults`**: Set to `true` to receive intermediate results as the user speaks, providing a more responsive feel. Set to `false` to only receive final, confirmed results.
*   **`lang`**: Set the desired language for speech recognition using BCP-47 language tags (e.g., `"en-US"`).

```js
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';
```

### Handling Results

The `onresult` event handler is crucial for processing recognized speech. It provides an `event` object containing `results`. Iterate through these results, distinguishing between final and interim transcripts.

```js
recognition.onresult = function(event) {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    // Update your UI with finalTranscript and interimTranscript
    // Consider using a helper function like `linebreak` to convert \n to <br> or <p> tags.
    // For example:
    // final_span.innerHTML = linebreak(capitalize(finalTranscript));
    // interim_span.innerHTML = linebreak(interimTranscript);
};
```

### Starting and Stopping Recognition

Initiate speech recognition by calling `recognition.start()`. The API provides `onstart`, `onerror`, and `onend` event handlers for managing the recognition lifecycle.

```js
function startButton() {
    // Reset any previous transcripts
    final_transcript = '';
    // Set language if not already set
    // recognition.lang = select_dialect.value;
    recognition.start();
}

// ... other handlers like recognition.onstart, recognition.onerror, recognition.onend
```

### Microphone Permissions

*   **HTTPS is strongly recommended**: Pages hosted on HTTPS do not repeatedly ask for microphone permission. HTTP pages will require user consent on each session.
*   Manage the microphone icon state (e.g., static, recording, error) to provide visual feedback to the user.

### Fallback Strategies

If `webkitSpeechRecognition` is not available, inform the user and suggest upgrading their browser. Provide alternative input methods if possible.

## Further Considerations

*   **Privacy**: Be transparent with users about how their voice data is handled. Refer to the Chrome Privacy Whitepaper for details on Google's practices.
*   **Feedback**: For comments on the W3C Web Speech API specification, use the provided email lists and community groups. For Chrome's implementation, use the specific Chromium mailing archive.
*   **User experience**: Provide clear visual cues for when the API is listening, processing, and has encountered an error. Ensure interactive elements are clearly labeled.