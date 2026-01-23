---
description: Use web workers to offload computationally expensive tasks from the main thread, improving web performance and responsiveness.
filename: web-worker-performance
category: webperf
---

# Offloading Work with Web Workers

Reference docs:
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Web Workers Overview](/learn/performance/web-worker-overview)

## Best Practices

Web workers are ideal for offloading tasks that don't require direct DOM manipulation, such as data processing, complex calculations, or network requests, to a separate thread. This prevents the main thread from being blocked, leading to a smoother user experience and improved metrics like Interaction to Next Paint (INP).

### When to Use Web Workers

*   **Computationally Intensive Tasks:** Operations like image manipulation (e.g., EXIF data extraction), data analysis, or complex algorithm execution that would otherwise freeze the UI.
*   **Background Data Fetching & Processing:** Handling large API responses, performing calculations on fetched data, or synchronizing data in the background without impacting foreground responsiveness.
*   **Third-Party Script Isolation:** Running external scripts that might be resource-heavy or less trusted in a dedicated worker thread.

### How to Implement

1.  **Create a Worker Script:** Define a separate JavaScript file (e.g., `exif-worker.js`) that contains the code to be executed in the web worker.
2.  **Instantiate the Worker:** In your main thread JavaScript, create a new `Worker` object, passing the path to your worker script:
    ```javascript
    const myWorker = new Worker('/path/to/your/worker.js');
    ```
3.  **Communicate with the Worker:**
    *   **Main Thread to Worker:** Use `worker.postMessage(data)` to send data to the worker.
    *   **Worker to Main Thread:** Inside the worker script, use `self.postMessage(data)` to send data back. In the main thread, listen for messages using `worker.addEventListener('message', (event) => { ... });`.
4.  **Handle Data:** Process the received data in the appropriate thread. For example, convert raw data into HTML for display on the main thread.
5.  **Import Scripts (Worker):** Use `importScripts()` within the worker to load additional scripts, like libraries (e.g., `exif-reader.js`). Note that modern browsers also support static `import` syntax for module workers.

### Example: EXIF Data Extraction

The following code demonstrates how to offload EXIF data extraction from an image to a web worker.

**Main Thread (`scripts.js`):**

```javascript
// Register the Exif reader web worker:
const exifWorker = new Worker('/js/with-worker/exif-worker.js');

// ... (rest of your main thread code to get image URL)

document.getElementById('image-form').addEventListener('submit', event => {
  event.preventDefault();
  // Send the image URL to the web worker on submit:
  exifWorker.postMessage(`${imageFetchPrefix}${imageInput.value}`);
});

// This listens for the Exif metadata to come back from the web worker:
exifWorker.addEventListener('message', ({ data }) => {
  // This populates the Exif metadata viewer:
  exifDataPanel.innerHTML = data.message;
  // ... (update UI to show metadata)
});
```

**Worker Thread (`exif-worker.js`):**

```javascript
// Import the exif-reader script:
importScripts('/js/with-worker/exifreader.js');

// Set up a messaging pipeline to send the Exif data to the `window`:
self.addEventListener('message', ({ data }) => {
  getExifDataFromImage(data).then(status => {
    self.postMessage(status);
  });
});

// Function to fetch image, read as ArrayBuffer, and extract EXIF data
const getExifDataFromImage = imageUrl => new Promise(resolve => {
  fetch(imageUrl, {
    headers: {
      'Range': `bytes=0-${2 ** 10 * 64}` // Fetch only the first 64 KiB
    }
  }).then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onload = () => {
        const tags = ExifReader.load(reader.result, { expanded: true });
        resolve({
          status: true,
          message: exifToMarkup(tags) // Convert tags to HTML
        });
      };
      reader.readAsArrayBuffer(blob);
    });
});

// Helper function to convert EXIF data to HTML markup
const exifToMarkup = exif => Object.values(exif).map(tag => `
  <details>
    <summary><h2>${Object.keys(tag)[0]}</h2></summary>
    <p>${Object.values(tag)[0].description || Object.values(tag)[0].value}</p>
  </details>
`).join('');
```

## Fallback Strategies

While web workers are widely supported, it's good practice to consider scenarios where they might not be available or if your worker script fails to load.

*   **Feature Detection:** Before instantiating a `Worker`, check for its existence:
    ```javascript
    if (window.Worker) {
      const myWorker = new Worker('worker.js');
      // ... proceed with worker usage
    } else {
      // Provide a fallback experience (e.g., perform the task on the main thread
      // with a warning, or disable the feature).
      console.warn('Web Workers not supported. Falling back to main thread processing.');
      // Call a function to perform the task on the main thread
      performTaskOnMainThread();
    }
    ```
*   **Error Handling:** Implement error handling for worker initialization and communication:
    ```javascript
    myWorker.onerror = (error) => {
      console.error('Web worker error:', error.message);
      // Handle the error, potentially by falling back to main thread processing.
    };
    ```
*   **Graceful Degradation:** If a task is critical for core functionality but very heavy, consider a less performant but universally available solution (e.g., processing on the main thread with clear UI feedback) if web workers fail.

By offloading heavy tasks to web workers, you can significantly improve the perceived performance and responsiveness of your web applications, leading to a better user experience.