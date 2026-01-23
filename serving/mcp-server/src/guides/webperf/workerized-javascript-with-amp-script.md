---
description: Use amp-script to run JavaScript in a Worker thread, preventing it from blocking the main thread and ensuring smooth user experiences.
filename: workerized-javascript-with-amp-script
category: webperf
---

# Workerized JavaScript with amp-script

Reference docs:
- https://amp.dev/documentation/components/amp-script/
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API

## Best Practices

When JavaScript needs to perform computationally intensive tasks or avoid blocking the main thread, leverage `amp-script` to run it within a Web Worker. This allows your JavaScript to execute in a separate thread, ensuring that your web application remains responsive and provides a smooth user experience. `amp-script` simplifies the process by providing a way to use JavaScript within Workers without direct DOM access limitations.

```html
<amp-script javascript="YOUR_JAVASCRIPT_CODE_HERE" fallback="YOUR_FALLBACK_HTML_HERE">
  <!-- Content to display while the script is loading or if it fails -->
  Loading workerized script...
</amp-script>
```

Replace `YOUR_JAVASCRIPT_CODE_HERE` with your JavaScript code, which will be executed in a worker. The `fallback` attribute can contain HTML to display if the `amp-script` component or the script itself fails to load or execute.

## Fallback Strategies

If `amp-script` is not supported or if there are issues with script execution, consider the following fallback strategies:

### amp-script

- **DO** provide a fallback content within the `amp-script` tag itself, as shown in the example above. This content will be displayed if the `amp-script` component cannot be rendered or if the script fails to execute.
- **DO** ensure that any critical functionality provided by the workerized script has a graceful degradation path or is handled by alternative means if `amp-script` is unavailable.

### General JavaScript Execution

- **DO** implement feature detection for Web Workers if your application relies heavily on them outside of `amp-script`.
- **DO** provide alternative user flows or functionalities that do not depend on the workerized script if it fails to load or execute.
- **DO** consider using `try...catch` blocks within your JavaScript code to handle potential errors during script execution, especially when dealing with complex operations.