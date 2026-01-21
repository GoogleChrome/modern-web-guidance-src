---
description: Allow web applications to recognize text from handwritten input in real time using the Handwriting Recognition API, enabling features like note-taking and form input.
filename: handwriting-recognition
category: ui
---

# Handwriting Recognition

Reference docs:
- [Explainer][explainer]
- [Spec draft][spec]
- [GitHub repo][github]

## Best Practices

Leverage the Handwriting Recognition API to convert user's handwriting into text directly within the browser, supporting offline functionality and eliminating the need for third-party services.

### Recognizing Text

1.  **Feature Detection:** Check for `navigator.createHandwritingRecognizer()` to ensure browser support.
2.  **Recognizer Creation:** Use `navigator.createHandwritingRecognizer({ languages: ['en'] })` to obtain a recognizer instance. Consider `navigator.queryHandwritingRecognizerSupport()` to check for specific feature availability (e.g., `textAlternatives`, `textSegmentation`) beforehand.
3.  **Drawing Input:** Implement an input area, preferably using a `<canvas>` element for performance. Use `Pointer Events` to capture user input (mouse, touch, stylus).
4.  **Starting a Drawing:** Call `recognizer.startDrawing()` with optional hints like `recognitionType`, `inputType`, `textContext`, `alternatives`, and `graphemeSet`.
5.  **Adding Strokes and Points:** Create `HandwritingStroke` instances and add points with `x`, `y`, and optional `t` (time) coordinates. Ensure points are added during `pointermove` events while a stroke is active.
6.  **Getting Predictions:** On `pointerup`, add the completed stroke to the drawing using `drawing.addStroke()`. Then, call `drawing.getPrediction()` to receive an array of predicted text strings, ordered by likelihood.
7.  **Utilizing Segmentation Results:** If supported, `prediction.segmentationResult` provides detailed information about graphemes, their positions, and the corresponding strokes and points, useful for highlighting recognized characters on the canvas.
8.  **Resource Cleanup:** After recognition, call `drawing.clear()` and `recognizer.finish()` to free up resources.

```javascript
// Example of basic recognition flow
async function setupHandwritingRecognition() {
  if (!('createHandwritingRecognizer' in navigator)) {
    console.log('Handwriting Recognition API not supported.');
    return;
  }

  const recognizer = await navigator.createHandwritingRecognizer({
    languages: ['en'],
  });

  let drawing;
  let activeStroke;

  canvas.addEventListener('pointerdown', (event) => {
    if (!drawing) {
      drawing = recognizer.startDrawing({
        recognitionType: 'text',
        inputType: ['mouse', 'touch', 'stylus'].find((type) => type === event.pointerType),
      });
    }
    startStroke(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (activeStroke) {
      addPoint(event);
    }
  });

  canvas.addEventListener('pointerup', async (event) => {
    drawing.addStroke(activeStroke.stroke);
    activeStroke = null;

    const [mostLikelyPrediction] = await drawing.getPrediction();
    if (mostLikelyPrediction) {
      console.log('Recognized text:', mostLikelyPrediction.text);
      // Optionally display text or use segmentationResult
      if (mostLikelyPrediction.segmentationResult) {
        mostLikelyPrediction.segmentationResult.forEach(
          ({ grapheme, beginIndex, endIndex }) => {
            console.log(`Grapheme: ${grapheme}, Index: ${beginIndex}-${endIndex}`);
          }
        );
      }
    }
    // Optionally clear drawing and finish recognizer after a delay or specific action
    // drawing.clear();
    // recognizer.finish();
  });

  function startStroke(event) {
    activeStroke = {
      stroke: new HandwritingStroke(),
      startTime: Date.now(),
    };
    addPoint(event);
  }

  function addPoint(event) {
    const timeElapsed = Date.now() - activeStroke.startTime;
    activeStroke.stroke.addPoint({
      x: event.offsetX,
      y: event.offsetY,
      t: timeElapsed,
    });
  }
}

setupHandwritingRecognition();
```

### Progressive Enhancement

Consider using custom web components like `<handwriting-textarea>` that progressively enhance standard form controls. This ensures basic functionality (like a `<textarea>`) is available even if the Handwriting Recognition API is not supported, while offering advanced features when available.

## Fallback Strategies

Since the Handwriting Recognition API is designed to be available in modern browsers, explicit polyfills are generally not required for the core API itself. However, if you are building custom components or need to ensure a consistent user experience across all environments:

-   **Feature Detection:** Always rely on feature detection (`'createHandwritingRecognizer' in navigator`) to conditionally enable or disable handwriting recognition features.
-   **Graceful Degradation:** If the API is not available, ensure the UI elements related to handwriting input are hidden or transformed into standard input fields (e.g., a `<textarea>`).

## Security and Permissions

-   **HTTPS Required:** The API is only available for websites delivered via HTTPS.
-   **Top-Level Context:** Calls must originate from the top-level browsing context.
-   **User Control & Transparency:** While the API itself cannot be turned off by the user, the browser may implement countermeasures (like permission prompts for potential abuse) to prevent fingerprinting and ensure transparency. Be mindful of the number of queries made to `navigator.queryHandwritingRecognizerSupport()` to avoid triggering such prompts.

[explainer]: https://github.com/WICG/handwriting-recognition/blob/main/explainer.md
[spec]: https://wicg.github.io/handwriting-recognition/
[github]: https://github.com/WICG/handwriting-recognition