1. The `Translator` API should be available in the browser on `window.Translator`, but not on `window.ai.translator`.
1. The `Translator.availability()` function must be called with both `sourceLanguage` and `targetLanguage` options.
1. The `Translator.availability()` function should return `available` or `downloadable` or `downloading` or `unavailable`.
1. The same `sourceLanguage` and `targetLanguage` options should be passed to both `Translator.availability()` and `Translator.create()`.
1. The `Translator` instance's `translate()` or `translateStreaming()` method should be used to generate a translation.
1. A monitor for download progress should be implemented using the `downloadprogress` event.
