---
name: run-on-device-ai
description: Run AI text inference locally using Chrome's built-in Gemini Nano model without requiring an API key or network connection.
---

# Run On-Device AI

Chrome 138+ exposes the Prompt API to extensions, providing access to Gemini Nano — a small language model that runs entirely on the user's device. No API key, no server, offline-capable. Available on Windows 10+, macOS 13+, Linux, and ChromeOS (Chromebook Plus). Not available on mobile.

## API entry point

Use the global `LanguageModel` object directly. The old `self.ai.languageModel` and `chrome.aiOriginTrial.languageModel` namespaces are deprecated. Also remove any `"aiLanguageModelOriginTrial"` permission from your manifest:

```js
// ✅ Current API (Chrome 138+)
const session = await LanguageModel.create();
const availability = await LanguageModel.availability();

// ❌ Deprecated — do not use
const session = await self.ai.languageModel.create();
```

## MANDATORY: Check availability before creating a session

The model may not be downloaded yet, or may not be supported on this device:

```js
// Step 1: Check if the API exists
if (!globalThis.LanguageModel) {
  showMessage('On-device AI is not supported in this browser version.');
  return;
}

// Step 2: Check model status — ALWAYS specify language parameters
const availability = await LanguageModel.availability({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
});
// Returns: "available" | "downloadable" | "downloading" | "unavailable"

if (availability === 'unavailable') {
  showMessage('AI model is not available on this device.');
  return;
}
if (availability === 'downloadable' || availability === 'downloading') {
  showMessage('AI model is downloading — please wait...');
}
```

Supported language codes: `"en"`, `"es"`, `"ja"` (from Chrome 140+). Always pass language params to avoid console warnings and ensure best output quality.

## Create a session

```js
const session = await LanguageModel.create({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],

  // Optional: system prompt and few-shot examples
  initialPrompts: [
    { role: 'system', content: 'You summarize text in 3 bullet points.' },
    { role: 'user', content: 'The sky is blue because...' },
    { role: 'assistant', content: '• Rayleigh scattering\n• Short wavelengths\n• Sun angle' }
  ],

  // Optional: monitor model download progress
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      const pct = e.total ? Math.floor((e.loaded / e.total) * 100) : 0;
      updateProgress(pct); // e.g., show a progress bar
    });
  }
});
```

## Prompt the model

For short outputs, use `prompt()`. For long outputs, use `promptStreaming()` to show content as it arrives:

```js
// Simple prompt
const result = await session.prompt(`Summarize: ${text}`);

// Streaming — MANDATORY: append chunks with +=, do NOT replace with =
const outputEl = document.getElementById('output');
outputEl.textContent = ''; // clear before streaming starts
const stream = session.promptStreaming(`Summarize: ${text}`);
for await (const chunk of stream) {
  outputEl.textContent += chunk; // each chunk is a delta, not the full text
}

// Abort a long-running prompt
const controller = new AbortController();
const result = await session.prompt('...', { signal: controller.signal });
controller.abort(); // cancel
```

## Session management

Sessions accumulate conversation context. Monitor token usage to avoid hitting limits:

```js
// Check remaining context window
console.log(`Tokens used: ${session.tokensSoFar} / ${session.maxTokens}`);

// Count tokens before sending a large input
const tokenCount = await session.countPromptTokens(largeText);
if (tokenCount > session.tokensLeft) {
  // Truncate largeText or start a new session
}

// Clone session to branch a conversation (shares initial prompts, independent context)
const clone = await session.clone();

// MANDATORY: Destroy sessions when done to free GPU memory
session.destroy();
```

## Manifest and permissions

No special permissions are needed for the Prompt API in extensions. A minimal manifest:

```json
{
  "manifest_version": 3,
  "name": "AI Summarizer",
  "version": "1.0",
  "permissions": ["sidePanel", "tabs", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "service-worker.js" },
  "side_panel": { "default_path": "sidepanel/sidepanel.html" },
  "action": { "default_title": "Summarize Page" }
}
```

Note: Use `"tabs"` + `"host_permissions"` to access page content from a side panel — `"activeTab"` does not work from side panel button clicks.

## Common pitfalls

- **Overwriting streamed content**: `promptStreaming()` yields deltas — use `+=`, not `=`
- **Skipping language params**: Always pass `expectedInputs`/`expectedOutputs` or you'll get console warnings
- **Not destroying sessions**: Each session holds GPU memory — call `session.destroy()` when done
- **Expecting mobile support**: The Prompt API is desktop-only
- **Ignoring context limits**: Use `countPromptTokens()` before sending large text
