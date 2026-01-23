---
description: Stream multiple network responses sequentially into a single response or stream for improved performance and user experience.
filename: stream-multiple-responses
category: webperf
---

# Stream Multiple Responses

Workbox Streams provides utilities for handling and composing streams of data, enabling efficient handling of network responses that can be delivered in chunks rather than all at once. This is particularly useful for large assets or when you want to present data to the user as it becomes available.

## Best Practices

### Concatenating Streams

The `concatenate` method allows you to combine multiple `StreamSource` (which can be `Response`, `ReadableStream`, or `BodyInit`) Promises into a single stream. This is useful when you need to assemble a single response from several independent sources.

The `concatenateToResponse` method is similar but directly constructs a `Response` object from the concatenated streams, allowing you to specify headers.

```javascript
import * as workboxStreams from 'workbox-streams';

// Example sources
const source1 = fetch('/stream-part-1').then(res => res.body);
const source2 = fetch('/stream-part-2').then(res => res.body);

// Concatenate streams into a single stream
const { stream, waitUntil } = workboxStreams.concatenate([source1, source2]);

// Use the stream as needed, e.g., for a Response body
const response = new Response(stream, {
  headers: { 'Content-Type': 'text/plain' }
});

// If used in a FetchEvent, pass waitUntil to the event
// fetchEvent.respondWith(response);
// fetchEvent.waitUntil(waitUntil);


// Concatenate streams into a Response object
const headers = new Headers({ 'Content-Type': 'application/octet-stream' });
const { response: concatenatedResponse, waitUntil: concatWaitUntil } = workboxStreams.concatenateToResponse([source1, source2], headers);

// If used in a FetchEvent, pass waitUntil to the event
// fetchEvent.respondWith(concatenatedResponse);
// fetchEvent.waitUntil(concatWaitUntil);
```

### Creating a Stream Strategy

The `strategy` method provides a convenient way to create a routing handler that uses Workbox Streams. It accepts an array of `StreamsHandlerCallback` functions and `HeadersInit`.

On browsers that support `ReadableStream`, it will create a streaming response. For browsers that do not, it will automatically fall back to concatenating all stream sources into a single response.

```javascript
import * as workbox from 'workbox-routing';
import * as workboxStreams from 'workbox-streams';

// Define your stream handler callbacks
const streamHandler1 = async ({ request }) => {
  const response = await fetch(request.url + '/part1');
  return response.body; // Or response, or other BodyInit
};

const streamHandler2 = async ({ request }) => {
  const response = await fetch(request.url + '/part2');
  return response.body;
};

const headers = { 'Content-Type': 'text/plain' };

// Create a streaming strategy
const streamingStrategy = workboxStreams.strategy(
  [streamHandler1, streamHandler2],
  headers
);

// Register the strategy with the router
workbox.registerRoute('/stream-resource', streamingStrategy);
```

### Feature Detection

The `isSupported` method is crucial for determining if the current browser environment can handle `ReadableStream` construction, which is essential for true streaming responses.

```javascript
import * as workboxStreams from 'workbox-streams';

if (workboxStreams.isSupported()) {
  console.log('Streaming is supported in this browser.');
  // Proceed with streaming logic
} else {
  console.log('Streaming is not supported. Falling back to non-streaming methods.');
  // Implement fallback logic, like using `concatenate` directly
}
```

## Fallback Strategies

When `workboxStreams.isSupported()` returns `false`, it indicates that the browser does not natively support `ReadableStream`. In such cases, Workbox Streams gracefully handles this by falling back to a non-streaming approach. The `concatenate` and `concatenateToResponse` methods will still work by waiting for all promises to resolve and then combining their content.

When implementing your own streaming logic or using the `strategy` method, ensure you have a robust fallback mechanism in place. The `strategy` method handles this automatically, but if you are manually orchestrating streams, you should:

1.  **Feature Detect:** Use `workboxStreams.isSupported()` to check for stream support.
2.  **Conditional Logic:** Based on the feature detection, either use Workbox's streaming utilities or implement a fallback that concatenates all the data into a single, final response.
3.  **`waitUntil`:** In both streaming and non-streaming scenarios, it's important to use the `waitUntil` promise returned by `concatenate` or `concatenateToResponse` (or manage promises manually) within your `FetchEvent` handler to ensure that the entire response body is fully processed before the event ends.