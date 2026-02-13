---
description: Turn images into text, captions, or structured data using the built-in Prompt API
---

# Image to Text

Reference docs:
- https://developer.chrome.com/docs/ai/prompt-api

## Best Practices

- **DO** show model download progress as needed
- **DO** pass the same options to the `availability()` function as you do to `prompt()` or `promptStreaming()`
- **DO** use the `promptStreaming()` function if you expect longer responses, appending response fragments to the DOM as they arrive
- **DO** use an `AbortController` to give the user the ability to interrupt prompts
- **DO** specify one or more supported languages in the `expectedInputs` and `expectedOutputs` options: "en", "es", "ja"

This example demonstrates how to initialize the model with download progress, handle multimodal input (image + text), stream the response, and allow cancellation. This pattern works for generating alt text, image captions, extracting data from images, and more.

```js
const outputEl = document.querySelector("#output");
const fileInput = document.querySelector("#image-upload");
const stopBtn = document.querySelector("#stop-btn");

let session;
let abortController;

async function initModel() {
  if (!window.LanguageModel) return;

  const options = {
    expectedInputs: [
      { type: "image" }
    ],
    expectedOutputs: [
      { type: "text", languages: ["en"] }
    ]
  };

  const availability = await window.LanguageModel.availability(options);
  if (availability === "unavailable") {
    outputEl.textContent = "Model unavailable.";
    return;
  }

  // Initialize with download progress
  session = await window.LanguageModel.create({
    ...options,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        outputEl.textContent = `Downloading: ${Math.round(e.loaded * 100)}%`;
      });
    },
  });
}

// Handle generation
async function generateDescription(file) {
  if (!session) await initModel();
  
  // Abort previous request if running
  if (abortController) abortController.abort();
  abortController = new AbortController();

  stopBtn.onclick = () => abortController.abort();

  try {
    // Prompt with both text and image
    const stream = await session.promptStreaming([{
      role: "user",
      content: [
        { type: "text", value: "Describe this image in vivid detail." },
        { type: "image", value: file },
      ]
    }], {
      signal: abortController.signal
    });

    outputEl.textContent = "";
    for await (const chunk of stream) {
      // Important: Append chunks to the DOM as they arrive, don't overwrite previous content.
      outputEl.textContent += chunk;
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Generation aborted");
    } else {
      console.error(err);
      outputEl.textContent = "Error processing image.";
    }
  }
}

fileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) {
    generateDescription(e.target.files[0]);
  }
});
```

**DO NOT** use the `ai.languageModel` API, as it has been recently deprecated in favor of `window.LanguageModel`.

`availability()` returns a promise with one of the following values:

- "unavailable": The user's device or requested session options are not supported. The device may have insufficient power or disk space.
- "downloadable": Additional downloads are needed to create a session, which may include an expert model, a language model, or fine-tuning. User activation may be required to call create().
- "downloading": Downloads are ongoing and must complete before you can use a a session.
- "available": You can create a session immediately.

**IMPORTANT**: The "no" value is not a valid return value for `availability()`. You will only ever need to handle the four possible values listed above.

## Fallback strategies

Baseline status: Limited availability

**DO** use `window.LanguageModel` for feature detection, but if the browser fails the feature detection check, the feature will simply be unavailable to the user.