---
name: ai-image-to-text
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

For a full working example, see `examples/image-describer.html`.

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
