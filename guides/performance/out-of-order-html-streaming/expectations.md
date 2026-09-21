1. The page should initially render fallback content (such as a loading skeleton) within a range defined by `<?start>` and `<?end>` processing instructions.
1. The fallback content should be automatically replaced by the final content delivered in a `<template for="...">` element once that part of the HTML stream is processed.
1. Placeholder containers should have stable dimensions (e.g. `min-height` or `aspect-ratio`) to prevent layout shifts when the content is patched.
1. For imperative updates, the `Response.textStream()` method should be used to get a stream of HTML from a fetch response.
1. The `streamHTMLUnsafe()` method should be used to pipe an HTML stream directly into a DOM element's contents.
1. When streaming content that contains interactive components or scripts, the `runScripts: true` option should be passed to `streamHTMLUnsafe()`.
1. `setHTMLUnsafe()` should be used instead of `innerHTML` for one-shot updates of HTML content provided by the server.
1. Containers receiving out-of-order updates should have appropriate `aria-live` attributes to notify screen reader users of the changes.
