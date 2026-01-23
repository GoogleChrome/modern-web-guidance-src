---
description: Use the Web Audio API to add dynamic audio effects like filters and distortion to web applications.
filename: web-audio-api-effects
category: media
---

# Adding Audio Effects with the Web Audio API

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- https://webaudio.github.io/web-audio-api/

## Best Practices

The Web Audio API provides a powerful way to manipulate audio directly in the browser. The core of the API is the `AudioContext`, which acts as a container for all audio nodes.

### Creating and Connecting Nodes

1.  **Initialize `AudioContext`**: Start by creating an `AudioContext` instance. Use `window.AudioContext || window.webkitAudioContext` for broader compatibility.
    ```js
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ```
2.  **Create Audio Source**: Instantiate an audio source node. Common examples include `OscillatorNode` for generating tones or `AudioBufferSourceNode` for playing back audio samples.
    ```js
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(420, audioCtx.currentTime); // Set frequency in hertz
    ```
3.  **Create Effect Nodes**: Use methods like `createBiquadFilter()`, `createWaveShaper()`, `createGain()`, etc., to create effect nodes.
    ```js
    const biquadFilter = audioCtx.createBiquadFilter();
    biquadFilter.type = 'lowpass'; // Example: low-pass filter
    biquadFilter.frequency.setValueAtTime(200, audioCtx.currentTime + 1); // Set filter frequency
    ```
4.  **Connect Nodes**: Chain the nodes together by connecting the output of one node to the input of the next. The final node should connect to `audioCtx.destination` (your speakers).
    ```js
    oscillator.connect(biquadFilter);
    biquadFilter.connect(audioCtx.destination);
    ```
5.  **Start and Stop Audio**: Call `start()` on the source node to begin playback and `stop()` to end it. You can schedule these actions at specific times using `setValueAtTime`.
    ```js
    oscillator.start();
    oscillator.stop(2); // Stop after 2 seconds
    ```

### Available Filter and Effect Nodes

The `AudioContext` interface provides methods to create various audio manipulation nodes:

*   **`createBiquadFilter()`**: Applies various filter types (low-pass, high-pass, band-pass, notch, all-pass, low-shelf, high-shelf, or peaking).
*   **`createWaveShaper()`**: Introduces distortion or other non-linear effects.
*   **`createGain()`**: Adjusts the overall volume of an audio signal.
*   **`createConvolver()`**: Adds reverberation or other impulse responses.
*   **`createDelay()`**: Creates an echo or delay effect.
*   **`createDynamicsCompressor()`**: Reduces the dynamic range of an audio signal.
*   **`createPanner()` / `createStereoPanner()`**: Controls the spatial position of the audio.

### Classic Way (Limited Control)

Before the Web Audio API, direct audio manipulation in the browser was limited to basic controls on the `<audio>` element, such as volume and playback rate.

```js
const audio = document.querySelector('audio');
audio.volume = 0.5; // Set volume to 50%
audio.playbackRate = 2; // Double playback speed
```

## Fallback Strategies

While the Web Audio API is widely supported, for very old browsers or specific environments, consider the limitations and potential fallbacks:

*   **Feature Detection**: Use checks like `'AudioContext' in window` or `'webkitAudioContext' in window` to determine if the Web Audio API is available.
*   **Graceful Degradation**: If the Web Audio API is not supported, provide a fallback experience, such as using the standard `<audio>` element with its limited controls, or informing the user about browser compatibility.
*   **Server-Side Processing**: For complex or critical audio manipulations, consider performing them on the server and streaming the processed audio to the client. This incurs network overhead but ensures consistent results.

```javascript
// Example of feature detection
if (window.AudioContext || window.webkitAudioContext) {
  // Web Audio API is supported, proceed with advanced effects
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // ... create and connect nodes ...
} else {
  // Web Audio API not supported, use fallback
  console.warn('Web Audio API is not supported in this browser. Using basic audio controls.');
  const audio = document.querySelector('audio');
  if (audio) {
    // Enable basic controls if an audio element exists
    audio.controls = true;
  }
}
```