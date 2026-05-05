1. The `Summarizer` API should be available in the browser on `window.Summarizer`, but not on `window.ai.summarizer`.
1. The `Summarizer.availability()` function should return `available` or `downloadable` or `downloading` or `unavailable`.
1. The same options should be passed to both `Summarizer.availability()` and `Summarizer.create()`.
1. The `Summarizer` instance's `summarize()` or `summarizeStreaming()` method should be used to generate a summary.
1. A monitor for download progress should be implemented using the `downloadprogress` event.
