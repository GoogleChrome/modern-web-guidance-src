---
description: Use TransformStream to process data in chunks as it streams, enabling efficient manipulation of data from sources like network responses.
filename: transformstream-data-processing
category: data
---

# Transform Streams for Chunked Data Processing

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/TransformStream
- https://developer.mozilla.org/docs/Web/API/Streams_API

## Best Practices

When working with large data transfers or network responses, using `TransformStream` allows you to process the data in smaller, manageable chunks rather than waiting for the entire resource to load. This improves performance and user experience by allowing processing to begin sooner.

The `TransformStream` API provides a way to pipe data from a `ReadableStream` to a `WritableStream` while applying a transformation to each chunk in between.

Here's an example of a custom `TransformStream` that converts incoming data to uppercase:

```javascript
class UpperCaseTransformStream {
  constructor() {
    return new TransformStream({
      transform(chunk, controller) {
        // Process each chunk and enqueue the transformed chunk
        controller.enqueue(chunk.toUpperCase());
      },
    });
  }
}

// Example usage with a fetch request
button.addEventListener('click', async () => {
  const response = await fetch('/path/to/your/data');
  const readableStream = response.body
    .pipeThrough(new TextDecoderStream()) // Decode response as text
    .pipeThrough(new UpperCaseTransformStream()); // Apply our custom transformation

  const reader = readableStream.getReader();
  let processedData = '';
  while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      processedData += value;
  }
  // Use the fully processed data
  console.log(processedData);
});
```

### Chaining Multiple Transformations

You can chain multiple `TransformStream` instances together to perform a sequence of operations on the data.

```javascript
const processingStream = response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new UpperCaseTransformStream()) // First transformation
  .pipeThrough(new SomeOtherTransformStream()); // Second transformation
```

## Browser Compatibility

Ensure that the browsers you are targeting support `TransformStream`. As of recent updates, Chrome, Safari, and Firefox all have cross-browser support for `TransformStream`.

It's good practice to check for compatibility if you need to support older browsers. You can use the `api.TransformStream` property for browser compatibility checks.

## Demo

A practical demonstration can showcase how `TransformStream` can be used to process data in real-time, for example, by transforming text received from a server.

<div class="wd-embed" style="height: 420px;">
  <iframe
    allow="camera; clipboard-read; clipboard-write; encrypted-media; geolocation; microphone; midi"
    loading="lazy"
    src="https://googlechrome.github.io/samples/transformstream-demo/"
    style="height: 100%; width: 100%; border: 0;"
  ></iframe>
</div>