---
name: summarizer
description: Summarize text content using the on-device Summarizer API.
web-feature-ids:
  - summarizer
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Summarizer
---

The **Summarizer API** allows web developers to offer local, AI-powered text
distillation directly within the browser using **Gemini Nano**. This API
supports various formats, including key points, headlines, and TL;DRs, while
operating entirely on-device to ensure user privacy.

---

## Getting Started

The Summarizer API is available starting in **Chrome 138**. It requires a
one-time model download of Gemini Nano.

### Feature Detection

Check if the browser supports the API before initializing:

```javascript
if ('Summarizer' in self) {
  // The Summarizer API is supported.
}
```

### Hardware & Software Requirements

- **OS**: Windows 10/11, macOS 13+, Linux, or ChromeOS (Chromebook Plus).
- **Storage**: 22GB free space for the profile volume.
- **RAM/CPU**: 16GB+ RAM and 4+ CPU cores.
- **VRAM**: 4GB+ (if using GPU).

### Model Download and Availability

Check if the model is ready, needs downloading, or is unavailable.

```javascript
const availability = await Summarizer.availability();

if (availability === 'downloadable') {
  const summarizer = await Summarizer.create({
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        console.log(`Downloaded ${Math.round((e.loaded / e.total) * 100)}%`);
      });
    },
  });
}
```

## API Functions & Configuration

When creating a summarizer via `Summarizer.create(options)`, you can customize
the output:

| Parameter    | Options                                    | Description                             |
| :----------- | :----------------------------------------- | :-------------------------------------- |
| `type`       | `key-points`, `tldr`, `teaser`, `headline` | Defines the summary strategy.           |
| `format`     | `markdown`, `plain-text`                   | Output syntax style.                    |
| `length`     | `short`, `medium`, `long`                  | Target length (e.g., 1 vs 5 sentences). |
| `preference` | `auto`, `speed`, `capability`              | Balances latency vs. quality.           |

### Example Configuration

```javascript
const options = {
  sharedContext: 'This is a scientific article',
  type: 'key-points',
  format: 'markdown',
  length: 'medium',
};

if (navigator.userActivation.isActive) {
  const summarizer = await Summarizer.create(options);
}
```

### Language Support

You can specify expected languages to ensure the browser can handle the specific
summary request.

```javascript
const summarizer = await Summarizer.create({
  type: 'key-points',
  expectedInputLanguages: ['en', 'ja'],
  outputLanguage: 'es',
});
```

## Summarization Methods

### 1. Batch Summarization

Processes the entire text at once and returns the result.

```javascript
const longText = document.querySelector('article').innerText;
const summary = await summarizer.summarize(longText, {
  context: 'This article is intended for a tech-savvy audience.',
});
console.log(summary);
```

### 2. Stream Summarization

Returns results in real-time as the model generates them, providing a more
responsive UI.

```javascript
const stream = summarizer.summarizeStreaming(longText);
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Security and Permissions

- **Data Privacy**: No data is sent to Google; processing happens on the local
  device.
- **Cross-Origin**: Access can be granted to iframes using the Permission
  Policy.
  ```html
  <iframe src="https://example.com/" allow="summarizer"></iframe>
  ```
- **Web Workers**: Currently not supported.
