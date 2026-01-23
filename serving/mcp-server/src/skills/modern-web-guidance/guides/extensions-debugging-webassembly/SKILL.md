---
description: Debugging WebAssembly applications in Chrome DevTools using source maps and DWARF information.
filename: debugging-webassembly
category: extensions
---

# Debugging WebAssembly with Chrome DevTools

This guide outlines best practices for debugging WebAssembly applications using Chrome DevTools, leveraging both DWARF information for C/C++ source-level debugging and raw WebAssembly debugging for cases without debug symbols.

## Source-Level Debugging with DWARF

When compiling WebAssembly from C/C++ using Emscripten, enabling debug information via the `-g` flag allows for a much richer debugging experience. This includes seeing original variable names, types, and stepping through source code.

### Setup

1.  **Compile with Debug Information**: Use the `-g` flag during compilation with Emscripten:
    ```bash
    emcc -g your_code.c -o your_code.html
    ```
2.  **Install Helper Extension**: Install the [Wasm Debugging extension](https://goo.gle/wasm-debugging-extension).
3.  **Enable Experiment**: In Chrome DevTools, go to **Settings** (gear icon) > **Experiments** and enable **WebAssembly Debugging: Enable DWARF support**. Reload DevTools.
4.  **Pause on Exceptions**: In the **Sources** panel, enable "Pause on exceptions" and "Pause on caught exceptions" to catch errors.

### Best Practices

*   **Navigate Call Stack**: When paused on an exception, use the **Call Stack** to navigate to the original C/C++ source line that caused the error.
*   **Inspect Scopes**: The **Scope** view will display original variable names and their values, making it easy to understand the program state. This extends to complex types like structs and arrays.
*   **Utilize Console Evaluation**: For complex C++ expressions, use the **Console** for evaluation. Be aware that support for very complex expressions might be limited.
*   **Watch Variables**: Add variables to the watch list or hover over them in the source code to monitor their values as the program executes.
*   **Step Through Code**: Use step-in, step-over, and step-out actions to control execution flow at the source code level.

## Raw WebAssembly Debugging

For code compiled without debug information, or for third-party libraries, DevTools provides a raw WebAssembly debugging experience.

### Improvements

*   **Improved Naming**: The disassembly view now generates more readable names for functions and variables using hints from the WebAssembly name section and import/export paths.
*   **Memory Inspector**: A new **Memory Inspector** allows you to view and reinterpret WebAssembly memory in hexadecimal and ASCII formats, and navigate to specific addresses. Right-click on `env.memory` in the **Scope** view and select **Inspect memory**.

### Caveats

*   **Limited Information**: Without DWARF information, variable types might be ambiguous, and inspecting complex data structures can be challenging.

## Advanced Scenarios

### Profiling

*   **DO** use the **Performance panel** for profiling WebAssembly code. Debugging a tiered-down, unoptimized version of the code will yield inaccurate performance measurements. Run the application with DevTools closed for accurate `console.time` or `performance.now` results.

### Path Mapping

*   **DO** configure path mappings in the C/C++ extension options if your build environment (e.g., Docker, VM) uses different file paths than your host machine. This ensures DevTools can locate the source files.

### Debugging Optimized Builds

*   **DO** disable function inlining when debugging optimized builds by using the `-fno-inline` flag alongside optimization flags (e.g., `-O3`). This improves the accuracy of debugging.
    ```bash
    emcc -g your_code.c -o your_code.html -O3 -fno-inline
    ```

### Separating Debug Information

*   **DO** use the `-gseparate-dwarf=filename.debug.wasm` flag to split debug information into a separate file. This can speed up module loading and compilation.
    ```bash
    emcc -g your_code.c -o your_code.html -gseparate-dwarf=your_code.debug.wasm
    ```
*   **DO** specify `SEPARATE_DWARF_URL` if debugging a production build with separate debug information to help the extension locate the file.

## Reporting Issues

If you encounter any issues, please report them to the Chrome DevTools issue tracker: [https://issues.chromium.org/issues/new?noWizard=true&template=0&component=1456350](https://issues.chromium.org/issues/new?noWizard=true&template=0&component=1456350).