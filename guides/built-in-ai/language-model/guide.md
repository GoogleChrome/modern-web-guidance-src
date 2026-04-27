---
name: language-model
web-feature-ids:
  - languagemodel
sources:
  - https://developer.chrome.com/docs/ai/prompt-api
  - https://developer.chrome.com/docs/ai/session-management
  - https://developer.chrome.com/docs/ai/structured-output-for-prompt-api
---

The Prompt API allows developers to run natural language processing tasks
directly in the browser using **Gemini Nano**. This built-in AI approach ensures
user privacy, reduces server costs, and enables offline functionality.

## 1. Getting Started and Hardware Requirements

The Prompt API is currently available in Chrome as of version 148 (Desktop) for
Windows, macOS, Linux, and Chromebook Plus.

### Hardware Prerequisites

- **Storage**: 22 GB free space (for the initial profile and model).
- **Memory/CPU**: 16 GB RAM and 4+ CPU cores.
- **GPU**: 4 GB VRAM or more (Required for audio input).
- **Network**: Required only for the initial model download.

### Initializing the API

Check model availability before triggering a download:

```javascript
const availability = await LanguageModel.availability();

if (availability !== 'unavailable') {
  const session = await LanguageModel.create({
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        console.log(`Downloaded ${e.loaded * 100}%`);
      });
    },
  });
}
```

## 2. Core Prompting Capabilities

### Basic and Streamed Output

For short responses, use `prompt()`. For longer content, use `promptStreaming()`
to provide a more responsive UI.

```javascript
const session = await LanguageModel.create();

// Request-based output
const result = await session.prompt('Write a haiku about coding.');
console.log(result);

// Streamed output
const stream = session.promptStreaming('Write a long story about a robot.');
for await (const chunk of stream) {
  console.log(chunk);
}
```

### Multimodal Input

The Prompt API supports text, audio, and visual inputs (images, canvas, video
frames).

```javascript
const session = await LanguageModel.create({
  expectedInputs: [{ type: 'text' }, { type: 'image' }],
  expectedOutputs: [{ type: 'text' }],
});

const response = await session.prompt([
  {
    role: 'user',
    content: [
      { type: 'text', value: 'What is in this image?' },
      { type: 'image', value: document.querySelector('canvas') },
    ],
  },
]);
```

## 3. Advanced Session Management

Sessions allow the model to maintain context across multiple interactions.

### Context and Quota

Each session has a maximum token limit. You can monitor usage via
`session.contextUsage` and `session.contextWindow`. If the window overflows, the
oldest messages (except the system prompt) are dropped.

### Cloning Sessions

Cloning is efficient for starting parallel conversations that share the same
initial context (like a "system" personality) without re-initializing.

```javascript
const mainSession = await LanguageModel.create({
  initialPrompts: [{ role: 'system', content: 'You speak like a pirate.' }],
});

const branchA = await mainSession.clone();
const branchB = await mainSession.clone();
```

### Restoring Past Sessions

While a native "restore" feature is in development, you can recreate a session
by feeding previous history into `initialPrompts`.

```javascript
const history = JSON.parse(localStorage.getItem('chat_history'));
const session = await LanguageModel.create({
  initialPrompts: history, // Array of {role, content} objects
});
```

## 4. Structured Output with JSON Schema

To prevent the model from adding "chatter" (e.g., "Sure, here is your JSON:"),
use a **JSON Schema** via the `responseConstraint` field. This ensures the
output is valid JSON that can be parsed immediately.

### Example: Sentiment Classification

```javascript
const schema = {
  type: 'object',
  properties: {
    rating: { type: 'number', minimum: 1, maximum: 5 },
    is_positive: { type: 'boolean' },
  },
  required: ['rating', 'is_positive'],
};

const result = await session.prompt(
  "Rate the following feedback: 'The food was great!'",
  { responseConstraint: schema },
);

const data = JSON.parse(result);
console.log(data.rating); // 5
```

### Constraints and Prefixes

You can guide the model further by prefilling the assistant's response using
`prefix: true`.

````javascript
const character = await session.prompt([
  { role: 'user', content: 'Create a character sheet' },
  { role: 'assistant', content: '```json\n', prefix: true },
]);
````

## 5. Best Practices and Safety

- **Resource Cleanup**: Always call `session.destroy()` when a conversation is
  finished to free up memory.
- **Aborting Tasks**: Use `AbortController` to allow users to stop long-running
  generations.
- **Security**: Use Permission Policies to control access in iframes:
  `<iframe src="..." allow="language-model"></iframe>`.
- **Design**: Review the
  [People + AI Guidebook](https://pair.withgoogle.com/guidebook/) to ensure
  responsible AI implementation.

By combining structured outputs with robust session management, developers can
build complex, stateful AI applications that run entirely on the user's device.
