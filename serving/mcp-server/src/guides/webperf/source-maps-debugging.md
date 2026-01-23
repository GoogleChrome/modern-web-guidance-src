---
description: Enable debugging of minified and combined JavaScript code by mapping it back to its original source files.
filename: source-maps-debugging
category: webperf
---

# Source Maps for Debugging Minified JavaScript

Source maps are a powerful utility that allows developers to debug minified and combined JavaScript code as if it were still in its original, unbuilt state. This enables a much smoother debugging experience without sacrificing performance gains from optimization.

## Best Practices

*   **Generate Source Maps during build:** Ensure your build process (e.g., using Closure Compiler, UglifyJS, or other bundlers) is configured to generate source maps alongside your minified JavaScript files.
*   **Enable Source Maps in DevTools:** In your browser's developer tools, ensure the "Enable source maps" option is checked. This allows the browser to automatically parse and utilize the generated source map files.
*   **Deploy Source Maps with Production Code:** For effective debugging in production, deploy the generated source map files along with your minified JavaScript.
*   **Understand the `//# sourceMappingURL` directive:** This special comment at the end of your minified JavaScript file tells the browser's developer tools where to find the corresponding source map.
*   **Consider `sourceURL` for Evals:** For code executed via `eval()`, use the `//# sourceURL=<filename>` comment to give these dynamically generated scripts more meaningful names in the dev tools.
*   **Be Aware of XSSI:** To mitigate potential Cross-Site Script Inclusion (XSSI) issues, prepend source map files with `)]}` to invalidate JavaScript syntax, forcing an error that dev tools can handle.
*   **Upload Original Source Files:** For debugging to work, ensure your original source files are accessible to the developer tools. This might involve uploading them to a server or having them locally available.

## How Source Maps Work

1.  **Minification/Combination:** Your original JavaScript files are processed, minified, and combined into a single file for production.
2.  **Source Map Generation:** Alongside the minified file, a source map (`.map` file) is generated. This map contains information about the original file names, line numbers, and column positions for each piece of code in the minified file.
3.  **`sourceMappingURL` Directive:** The minified JavaScript file includes a comment like `//# sourceMappingURL=your-code.js.map`, pointing the browser to the source map file.
4.  **Developer Tools Integration:** When you set a breakpoint or encounter an error in the minified code, the developer tools read the `sourceMappingURL` directive, fetch the source map, and use it to translate the location in the minified code back to the corresponding line and column in your original source file. This allows you to inspect variables and step through code as if it were unminified.

## Anatomy of a Source Map (V3 Spec)

A source map is a JSON object with the following key properties:

*   `version`: The source map specification version (usually 3).
*   `file`: The name of the generated (minified) file.
*   `sourceRoot`: An optional URL prefix for the sources.
*   `sources`: An array of the original file names.
*   `names`: An array of original variable and function names.
*   `mappings`: A string containing Base64 VLQ (Variable-Length Quantity) encoded data that maps generated positions to original positions.

The `mappings` section is crucial for reducing the source map's size. It uses a clever encoding scheme where each segment represents a position and is relative to the previous segment, minimizing redundancy.

## Limitations and Future Considerations

*   **Watch Expressions:** Inspecting variables or arguments in watch expressions can be challenging as their names in the minified code may not directly correspond to their original names without reverse mapping.
*   **`displayName` and `debugName`:** While `displayName` was an experimental feature for naming anonymous functions, it's largely deprecated. `debugName` is a proposed alternative for better debugging of dynamically generated code.
*   **Browser Support:** While widely supported now, always check compatibility for older browsers. The `//# sourceMappingURL` syntax became the standard to avoid conflicts with IE conditional compilation comments.

By adopting source maps, developers can significantly improve their debugging workflow for production JavaScript, leading to faster issue resolution and more efficient development cycles.