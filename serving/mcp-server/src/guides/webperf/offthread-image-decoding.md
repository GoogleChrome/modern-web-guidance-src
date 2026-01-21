---
description: Improve UI responsiveness by decoding images off the main thread using createImageBitmap and Web Workers.
filename: offthread-image-decoding
category: webperf
---

# Off-Thread Image Decoding

## Best Practices

To prevent UI jank and improve responsiveness when decoding images, leverage `createImageBitmap()` in conjunction with Web Workers. This allows computationally intensive image decoding to occur in the background, freeing up the main thread for critical UI tasks.

### Decoding with `createImageBitmap()`

The `createImageBitmap()` API provides a direct way to decode images into an `ImageBitmap` primitive, which can then be efficiently drawn to a canvas. This is particularly useful when working with image data from sources like `fetch()` or IndexedDB.

```js
// When fetching from a URL and drawing to canvas
fetch(url)
    .then(response => response.blob())
    .then(blob => createImageBitmap(blob))
    .then(imageBitmap => ctx.drawImage(imageBitmap, 0, 0));

// When working with blobs from IndexedDB
// Assume blob is retrieved from IndexedDB
createImageBitmap(blob)
    .then(imageBitmap => ctx.drawImage(imageBitmap, 0, 0));
```

### Using `createImageBitmap()` in Web Workers

For optimal performance, delegate the decoding process to a Web Worker. This ensures that the main thread remains unblocked, even when dealing with multiple or large image files.

**In the Worker:**

```js
// worker.js
self.onmessage = (event) => {
  const imageURL = event.data.imageURL;
  fetch(imageURL)
    .then(response => response.blob())
    .then(blob => createImageBitmap(blob))
    .then(imageBitmap => {
      // Transfer the imageBitmap back to the main thread.
      // The second argument is an array of Transferable objects.
      self.postMessage({ imageBitmap }, [imageBitmap]);
    })
    .catch(err => {
      self.postMessage({ err: err.message });
    });
};
```

**In the Main Thread:**

```js
// main.js
const worker = new Worker('worker.js');
const canvasContext = canvas.getContext('2d');

worker.onmessage = (evt) => {
  if (evt.data.err) {
    console.error("Image decoding error:", evt.data.err);
    return;
  }
  canvasContext.drawImage(evt.data.imageBitmap, 0, 0);
};

// To start decoding, send a message to the worker
worker.postMessage({ imageURL: 'path/to/your/image.jpg' });
```

### Considerations for Main Thread Decoding

While `createImageBitmap()` can be called on the main thread, be mindful that it is a CPU-intensive operation. In Chrome 50 and later, there are plans for the browser to automatically handle decoding on a separate thread. However, until then, actively offloading this work to Web Workers is the recommended approach to prevent blocking essential rendering and scripting tasks.

## Helper Libraries

For simplified implementation, consider using helper libraries that abstract away the complexities of worker communication and off-thread decoding. These libraries can provide a more streamlined developer experience while still reaping the performance benefits.

When fine-grained control over image decoding is necessary, `createImageBitmap()` is a powerful tool. Integrate it into your workflow, especially when dealing with dynamic or numerous image assets, to ensure a smoother and more performant user experience.