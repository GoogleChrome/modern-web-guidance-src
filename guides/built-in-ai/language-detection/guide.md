---
name: language-detection
description: Detect the language of user-generated content or already present site content.
web-feature-ids:
  - languagedetector
sources:
  - https://developer.chrome.com/docs/ai/language-detection
---

The **Language Detector API** is a client-side web API designed to identify the language of a given text string. By performing detection locally in the browser, it enhances user privacy and reduces the need for heavy external libraries or costly server-side calls.

## Key Use Cases
*   **Translation Prep:** Identifying the source language before sending text to a translator.
*   **Safety & Filtering:** Loading specific models for tasks like toxicity detection.
*   **Accessibility:** Labeling content with the correct `lang` attribute for screen readers.
*   **UI Localization:** Adjusting application interfaces based on the user's input language.

## Technical Requirements & Availability
As of May 2025, the API is supported in **Chrome 138+** (Desktop only). Mobile support is currently unavailable.

### Hardware & System Requirements
*   **OS:** Windows 10/11, macOS 13+, Linux, or Chromebook Plus.
*   **Storage:** 22 GB free space (model is removed if space drops below 10 GB).
*   **RAM/CPU:** 16 GB RAM and 4+ CPU cores.
*   **VRAM:** 4 GB+ if using a GPU.

## Implementation Guide

### 1. Feature Detection
Check if the browser supports the API before attempting to use it:

```javascript
if ('LanguageDetector' in self) {
  // The Language Detector API is available.
}
```

### 2. Model Management
The model is downloaded on-demand. You should check availability and monitor the download progress.

```javascript
const detector = await LanguageDetector.create({
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  },
});
```

### 3. Running Detection
The API returns a ranked list of potential languages with a confidence score between `0.0` and `1.0`.

```javascript
const someUserText = 'Hallo und herzlich willkommen!';
const results = await detector.detect(someUserText);

for (const result of results) {
  // result.detectedLanguage (e.g., 'de')
  // result.confidence (e.g., 0.999)
  console.log(result.detectedLanguage, result.confidence);
}
```

> [!CAUTION]
> Avoid using the detector on very short phrases or single words, as accuracy drops significantly.

## Security and Environment
*   **Iframes:** Cross-origin iframes require an explicit Permissions Policy to access the API.
    ```html
    <iframe src="https://cross-origin.example.com/" allow="language-detector"></iframe>
    ```
*   **Web Workers:** The API is **not** currently available in Web Workers due to Permission Policy complexities.
*   **Privacy:** No data is sent to Google or third parties during the detection process.
