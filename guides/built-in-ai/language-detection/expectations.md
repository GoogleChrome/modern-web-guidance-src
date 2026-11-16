1. The page should use the `LanguageDetector` API on `window.LanguageDetector`, and must not access the deprecated `window.ai.languageDetector` API.
1. The implementation should check API availability via `LanguageDetector.availability()`.
1. The implementation should create a detector with `LanguageDetector.create()` and call `detect()` with the input text.
1. The page should display the detected language result.
