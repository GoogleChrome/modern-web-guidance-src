---
name: translator
description:
  Translate text between languages using the on-device Translator API.
web-feature-ids:
  - translator
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Translator
---

The **Translator API** allows developers to perform client-side text translation
using built-in AI models in Chrome. This approach eliminates the need for
cloud-based translation services for ephemeral content, reducing costs and
improving privacy by keeping data on the user's device.

## Prerequisites & Requirements

### Browser Support

- **Chrome:** Version 138+ (Desktop only).
- **Not Supported:** Mobile (Android/iOS), Edge, Firefox, Safari.

### Hardware Requirements

To run Gemini Nano and associated models, the system needs:

- **Operating System:** Windows 10/11, macOS 13+, Linux, or ChromeOS (Chromebook
  Plus).
- **Storage:** At least **22 GB** free on the Chrome profile volume.
- **Memory/CPU:** 16 GB+ RAM and 4+ CPU cores.
- **GPU:** 4 GB+ VRAM (Mandatory for Prompt API with audio).
- **Network:** Required only for the initial download of language packs/models.

## Implementation & Code Samples

### 1. Feature Detection

Before use, check if the `Translator` object is available in the global scope.

```javascript
if ('Translator' in self) {
  // The Translator API is supported.
}
```

### 2. Checking Availability & Downloading Models

Availability returns `'available'`, `'after-download'`, or `'no'`. Use the
`monitor` callback to track download progress.

```javascript
const translatorCapabilities = await Translator.availability({
  sourceLanguage: 'es',
  targetLanguage: 'fr',
});

if (
  translatorCapabilities === 'available' ||
  translatorCapabilities === 'after-download'
) {
  const translator = await Translator.create({
    sourceLanguage: 'es',
    targetLanguage: 'fr',
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        // e.loaded is a value between 0 and 1
        console.log(`Downloaded ${e.loaded * 100}%`);
      });
    },
  });
}
```

### 3. Executing Translations

The API supports both static and streaming responses.

**Standard Translation:**

```javascript
const translator = await Translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'fr',
});

const result = await translator.translate(
  'Where is the next bus stop, please?',
);
console.log(result);
// Output: "Où est le prochain arrêt de bus, s'il vous plaît ?"
```

**Streaming Translation (for long text):**

```javascript
const stream = translator.translateStreaming(longText);
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Supported Languages

The API supports a wide range of BCP 47 language codes: Here are the languages
supported by Chrome's implementation of the Translator API, formatted as a
Markdown list:

- **ar**: Arabic
- **bg**: Bulgarian
- **bn**: Bengali
- **cs**: Czech
- **da**: Danish
- **de**: German
- **el**: Greek
- **en**: English
- **es**: Spanish
- **fi**: Finnish
- **fr**: French
- **hi**: Hindi
- **hr**: Croatian
- **hu**: Hungarian
- **id**: Indonesian
- **it**: Italian
- **iw**: Hebrew
- **ja**: Japanese
- **kn**: Kannada
- **ko**: Korean
- **lt**: Lithuanian
- **mr**: Marathi
- **nl**: Dutch
- **no**: Norwegian
- **pl**: Polish
- **pt**: Portuguese
- **ro**: Romanian
- **ru**: Russian
- **sk**: Slovak
- **sl**: Slovenian
- **sv**: Swedish
- **ta**: Tamil
- **te**: Telugu
- **th**: Thai
- **tr**: Turkish
- **uk**: Ukrainian
- **vi**: Vietnamese
- **zh**: Chinese
- **zh-Hant**: Chinese (Traditional)

## Security & Performance

- **Permissions Policy:** Cross-origin iframes require explicit permission.
  ```html
  <iframe src="https://example.com/" allow="translator"></iframe>
  ```
- **Web Workers:** Currently **not supported** due to Permission Policy
  complexities.
- **Privacy:** No data is sent to Google servers during the translation process
  once the model is downloaded.
