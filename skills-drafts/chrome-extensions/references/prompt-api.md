# Chrome Prompt API (Built-in AI) for Extensions

## Overview

The Prompt API gives Chrome extensions access to Gemini Nano, a language model that runs
locally on the user's device. Available from Chrome 138+ for extensions.

**Key facts:**
- Runs on-device (offline-capable, no API key needed)
- Uses Gemini Nano (small but capable model)
- Available on: Windows 10+, macOS 13+, Linux, ChromeOS (Chromebook Plus)
- NOT available on mobile
- Supports English, Spanish, and Japanese (from Chrome 140+)

## API Access in Extensions

The Prompt API is accessed via the global `LanguageModel` object. In extensions, this is
available in the service worker, popup, side panel, and other extension pages.

**IMPORTANT:** The old `self.ai.languageModel` / `chrome.aiOriginTrial.languageModel` namespaces
are deprecated. Use the global `LanguageModel` directly:

```js
// ❌ OLD (deprecated)
const session = await self.ai.languageModel.create();
const capabilities = await self.ai.languageModel.capabilities();

// ✅ CURRENT (Chrome 138+)
const session = await LanguageModel.create();
const availability = await LanguageModel.availability();
```

Also remove expired origin trial permissions:
```json
// ❌ Remove this from manifest.json
"permissions": ["aiLanguageModelOriginTrial"]
```

## Availability Check (Required)

Always check if the API is available before use. The model may not be downloaded yet.
**Always pass language parameters** to both `availability()` and `create()`.

```js
// Step 1: Check if the API exists
if (!globalThis.LanguageModel) {
  console.log('Prompt API not supported in this browser');
  return;
}

// Step 2: Check model availability — ALWAYS specify languages
const availability = await LanguageModel.availability({
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }]
});
// Returns: "available" | "downloadable" | "downloading" | "unavailable"

if (availability === 'unavailable') {
  showMessage('AI features are not available on this device');
  return;
}

if (availability === 'downloadable' || availability === 'downloading') {
  showMessage('Downloading AI model, please wait...');
}
```

## Creating a Session

**Always specify `expectedInputs` and `expectedOutputs` with language codes** to avoid console
warnings and ensure optimal output quality. Supported languages: `en`, `es`, `ja`.

```js
const session = await LanguageModel.create({
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
  // Optional: monitor download progress
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      const percent = e.total ? Math.floor((e.loaded / e.total) * 100) : 0;
      updateProgress(percent);
    });
  }
});
```

**With system prompt:**
```js
const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are a helpful assistant that summarizes text concisely.' }
  ]
});
```

**With n-shot examples:**
```js
const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'Classify reviews as positive or negative.' },
    { role: 'user', content: 'Great product, love it!' },
    { role: 'assistant', content: 'positive' },
    { role: 'user', content: 'Terrible quality, broke in a day.' },
    { role: 'assistant', content: 'negative' }
  ]
});
```

## Prompting

**Simple prompt (wait for full response):**
```js
const result = await session.prompt('Summarize this text: ' + pageText);
console.log(result);
```

**Streaming (recommended for long outputs):**

**Append each chunk to the output — do NOT replace.** Clear the output element before starting,
then concatenate each chunk.

```js
const stream = session.promptStreaming('Summarize this text: ' + pageText);
outputEl.textContent = ''; // clear before streaming
for await (const chunk of stream) {
  outputEl.textContent += chunk;  // ✅ APPEND each chunk
}

// ❌ WRONG — replaces already-streamed content, causing visible loss:
// outputEl.textContent = chunk;
```

**With abort support:**
```js
const controller = new AbortController();
const result = await session.prompt('...', { signal: controller.signal });

// To cancel:
controller.abort();
```

## Extension-Specific Features

In Chrome Extensions, you also have access to:

```js
// Get model parameters (extension-only)
const params = await LanguageModel.params();
// { defaultTopK: 3, maxTopK: 128, defaultTemperature: 1, maxTemperature: 2 }

// Create session with custom parameters
const session = await LanguageModel.create({
  temperature: 0.7,
  topK: 5
});
```

## Session Management

Sessions track conversation context. Each prompt adds to the context window.

```js
// Check remaining context
console.log(`Used: ${session.tokensSoFar} / ${session.maxTokens}`);
console.log(`Remaining: ${session.tokensLeft}`);

// Count tokens before sending (useful for large inputs)
const tokenCount = await session.countPromptTokens('Your text here...');

// Clone session (shares initial prompts, independent context)
const clone = await session.clone();

// Destroy session when done (frees memory)
session.destroy();
```

## Complete Extension Example: Page Summarizer

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "AI Page Summarizer",
  "version": "1.0",
  "permissions": ["sidePanel", "tabs", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "service-worker.js"
  },
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  "action": {
    "default_title": "Summarize Page"
  }
}
```

Note: Uses `tabs` + `host_permissions` instead of `activeTab` because the side panel's
summarize button is NOT a qualifying user gesture for `activeTab`.

### service-worker.js
```js
// Open side panel on icon click
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});
```

### sidepanel/sidepanel.js
```js
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const summarizeBtn = document.getElementById('summarize');

summarizeBtn.addEventListener('click', async () => {
  // Step 1: Check API availability
  if (!globalThis.LanguageModel) {
    statusEl.textContent = 'Prompt API not available in this browser.';
    return;
  }

  const availability = await LanguageModel.availability({
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }]
  });
  if (availability === 'unavailable') {
    statusEl.textContent = 'AI model not available on this device.';
    return;
  }

  // Step 2: Get page text via scripting API
  // NOTE: This requires "tabs" + "host_permissions", NOT "activeTab"
  // (button clicks in a side panel do not activate activeTab)
  statusEl.textContent = 'Extracting page content...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result: pageText }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const body = document.body.cloneNode(true);
      body.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
      return body.innerText.substring(0, 4000);
    }
  });

  if (!pageText || pageText.trim().length < 50) {
    statusEl.textContent = 'Not enough text on this page to summarize.';
    return;
  }

  // Step 3: Create session with language params and summarize
  statusEl.textContent = 'Loading AI model...';
  try {
    const session = await LanguageModel.create({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [{
        role: 'system',
        content: 'You summarize web page content in 3-5 clear bullet points.'
      }],
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          const pct = e.total ? Math.floor((e.loaded / e.total) * 100) : 0;
          statusEl.textContent = `Downloading model: ${pct}%`;
        });
      }
    });

    statusEl.textContent = 'Generating summary...';
    const stream = session.promptStreaming(
      `Summarize the following web page content:\n\n${pageText}`
    );

    summaryEl.textContent = '';
    for await (const chunk of stream) {
      summaryEl.textContent += chunk; // APPEND — each chunk is a delta
    }

    statusEl.textContent = 'Done!';
    session.destroy();
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    console.error('Prompt API error:', err);
  }
});
```

## Common Pitfalls

1. **Using deprecated API paths** — Use `LanguageModel` directly, not `self.ai.languageModel`
2. **Not checking availability** — Always check before creating a session
3. **Overwriting streamed content** — `promptStreaming()` yields delta chunks. APPEND with `+=`, don't replace with `=`
4. **Missing language parameters** — Always pass `expectedInputs`/`expectedOutputs` with language codes to avoid warnings
5. **Broken download progress** — Use `e.loaded / e.total * 100` not `e.loaded * 100`. Guard with `e.total ? ... : 0`
6. **Using `activeTab` from side panel** — Side panel button clicks don't activate `activeTab`. Use `tabs` + `host_permissions`
6. **Ignoring context limits** — Use `countPromptTokens()` to check before sending large texts
7. **Not destroying sessions** — Call `session.destroy()` when done to free memory
8. **Missing user activation** — For web pages (not extensions), `create()` requires user activation
9. **Expecting mobile support** — The API is desktop-only
