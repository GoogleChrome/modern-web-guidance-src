---
description: Display streamed LLM responses from APIs like Gemini securely and performantly using frontend best practices.
filename: render-streamed-llm-responses
category: ai
---

# Render Streamed LLM Responses

Reference docs:
- https://ai.google.dev/gemini-api/docs/text-generation?lang=rest#generate-a-text-stream
- https://github.com/explainers-by-googlers/prompt-api/
- https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent
- https://developer.mozilla.org/en-US/docs/Web/API/Element/append
- https://github.com/cure53/DOMPurify
- https://github.com/thetarnav/streaming-markdown

## Best Practices

When dealing with streamed responses from Large Language Models (LLMs), it's crucial to update the user interface efficiently and securely.

### Rendering Plain Text

For unformatted plain text, avoid repeatedly setting `textContent` or `innerText` as this can be inefficient due to the browser re-parsing and replacing content. Instead, use the `append()` method or `insertAdjacentText('beforeend', chunk)` to add new chunks to the DOM without discarding existing content.

**NOT RECOMMENDED** — `textContent`

```js
// Don't do this!
output.textContent += chunk;
// Also don't do this!
output.innerText += chunk;
```

**RECOMMENDED** — `append()`

```js
output.append(chunk);
// Equivalent, but more flexible:
output.insertAdjacentText('beforeend', chunk);
// Equivalent, but less ergonomic:
output.appendChild(document.createTextNode(chunk));
```

### Rendering Markdown

When rendering Markdown-formatted text, directly concatenating chunks, parsing the entire string, and then using `innerHTML` poses security and performance risks. A malicious prompt could inject harmful HTML, and re-parsing the entire document for each chunk is inefficient.

**NOT RECOMMENDED** — `innerHTML` with full parsing

```js
chunks += chunk;
const html = marked.parse(chunks)
output.innerHTML = html;
```

To address these challenges, use a DOM sanitizer and a streaming Markdown parser.

**RECOMMENDED** — DOM sanitizer and streaming Markdown parser

Treat LLM output as user-generated content. Sanitize the combined chunks using a library like DOMPurify. If the sanitizer detects any malicious content, stop rendering immediately. Use a streaming Markdown parser like `streaming-markdown` which processes chunks individually and appends to the DOM, avoiding full re-renders.

```js
// `smd` is the streaming Markdown parser.
// `DOMPurify` is the HTML sanitizer.
// `chunks` is a string that concatenates all chunks received so far.
chunks += chunk;
// Sanitize all chunks received so far.
DOMPurify.sanitize(chunks);
// Check if the output was insecure.
if (DOMPurify.removed.length) {
  // If the output was insecure, immediately stop what you were doing.
  // Reset the parser and flush the remaining Markdown.
  smd.parser_end(parser);
  return;
}
// Parse each chunk individually.
smd.parser_write(parser, chunk);
```

## Performance and Security Improvements

Activating features like "Paint flashing" in Chrome DevTools can visualize how the browser efficiently renders only the necessary parts of the UI as new chunks arrive, significantly improving performance for larger outputs.

When a model generates insecure output, the sanitization step prevents any harm by halting rendering immediately upon detection.

## Demo

Explore the [AI Streaming Parser](https://chrome.dev/web-ai-demos/ai-streaming-parser/) demo to experiment with these concepts. You can enable "Paint flashing" in DevTools to observe rendering optimizations and test the security measures by intentionally triggering insecure model responses.

<iframe allow="language-model" src="https://chrome.dev/web-ai-demos/ai-streaming-parser/"
style="width: 100%; height: 450px;"></iframe>

## Conclusion

Securely and performantly rendering streamed LLM responses is vital for production AI applications. Employing sanitization prevents the display of malicious content, and using streaming Markdown parsers optimizes rendering efficiency by avoiding unnecessary re-processing. These best practices are applicable to both client-side and server-side implementations.