---
description: Port complex native applications with deep dependencies to the web using Emscripten and WebAssembly.
filename: porting-complex-native-apps
category: extensions
---

# Porting Complex Native Applications to the Web

Porting native applications with complex dependency trees and dynamic linking requirements to the web can be achieved using Emscripten by carefully managing build systems, adapting dynamic loading mechanisms, and leveraging WebAssembly.

## System Root Management

When porting libraries with intricate dependencies like libgphoto2, which relies on libusb and libtool, it's essential to manage their build paths effectively. Instead of overriding individual dependency paths, creating a custom system root (sysroot) simplifies the process.

- **DO** utilize Emscripten's cache `sysroot` as a unified location for all dependencies.
- **DO** configure build systems (e.g., using `./configure --prefix=$(SYSROOT)`) to install dependencies within this custom sysroot.
- **DO** ensure that libraries automatically find their dependencies installed in the shared sysroot.

## Handling Dynamic Linking

Dynamic linking on the web presents challenges due to limitations in WebAssembly dynamic module loading and the lack of standard directory enumeration over HTTP. Libtool's "Dlpreopening" mechanism offers a viable solution.

- **DO** leverage libtool's "Dlpreopening" feature to emulate dynamic loading by linking objects statically into the program at compile time.
- **DO** use `-dlpreopen` flags during the linking phase to specify the libraries that should be pre-opened.
- **DON'T** rely on `dlopen()` for enumerating dynamic libraries in a directory, as this is often not supported or practical in a web environment.
- **DO** hardcode the list of necessary plugins (e.g., specific port adapters and camera libraries) for Emscripten builds if dynamic enumeration is not feasible.
- **DO** rename exposed symbols using a convention like `{library name}_LTX_{function name}` when using libtool preloading to prevent name clashes.

## Generating Settings UIs

Automatically generating user interfaces for application settings, like those provided by gPhoto2, requires a robust mechanism for querying and updating widget states.

- **DO** use the C API of the library to query widget properties (name, type, value, read-only status, etc.).
- **DO** recursively traverse the widget tree to build a representation suitable for JavaScript.
- **DO** employ a frontend framework (like React or Preact) that handles efficient DOM updates based on diffing the UI state.
- **DO** implement a strategy to manage bidirectional data flow between the UI and the native application, especially when external sources (like a camera) can update settings.
- **DO** opt-out of UI updates for input fields that are currently in focus to prevent disrupting user input.

## Building Live "Video" Feeds

Streaming live preview images from devices, such as cameras, to a web application can be achieved by repeatedly capturing frames and rendering them.

- **DO** capture preview images from the device using the library's API (e.g., `gp_camera_capture_preview`).
- **DO** convert the captured image data into a format suitable for web APIs (e.g., `Blob`).
- **DO** utilize modern browser APIs like `createImageBitmap` for efficient image decoding in a background thread.
- **DO** use `transferFromImageBitmap` to update a canvas element, ensuring smooth rendering without blocking the main thread.
- **DO** monitor performance and aim for a high frame rate (e.g., 30+ FPS) to provide a near real-time experience.

## Synchronizing USB Access

Concurrent access to USB devices from different parts of a web application can lead to conflicts and errors. A promise-based asynchronous queue is an effective solution for managing these accesses.

- **DO** build a promise-based asynchronous queue to serialize all operations that interact with the USB device context.
- **DO** chain each operation within the queue's promise chain to ensure sequential execution.
- **DO** handle errors gracefully, distinguishing between recoverable operation errors and critical, application-halting errors.
- **DO** keep the module context private and ensure all accesses go through the scheduling function to prevent accidental direct access.
- **DO** wrap every device access in a `schedule()` call to enforce synchronized operation.