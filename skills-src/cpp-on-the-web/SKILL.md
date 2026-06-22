---
name: cpp-on-the-web
description: Compiling C and C++ for the modern web using WebAssembly. Use this skill when you need to port C++ code, build C++ libraries with Emscripten, or set up high-performance C++ components in the browser.
---

# Compiling C++ to the Web using WebAssembly

This skill provides guidance for using **Emscripten** to target the modern web with C and C++. It focuses on ES6 module output, clean JS/C++ interop, and common pitfalls.

## Quick Start

1. **Installation:** Use the [Emscripten SDK (emsdk)](https://github.com/emscripten-core/emsdk) as the quickest way to install.
   ```bash
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```
2. **Environment:** Ensure `emcc` is in your PATH.
3. **Boilerplate:** Use the `hello-world` template in `assets/hello-world`.
   - `main.cpp`: Basic Embind example.
   - `index.html`: Modern ES6 module loading.
   - `Makefile`: Recommended flags for modern web.

## Recommended Compilation Flags

- `-sSTRICT`: Opt into modern Emscripten behavior.
- `-sEXPORT_ES6`: Output a modern ES6 module (this implies `-sMODULARIZE`).
- `-sENVIRONMENT=web`: For optimal codesize limit the output only run on the web.
- `-Werror -Wall`: Treat warnings as errors for safer C++ code.
- `-Oz/-Os`: To minimal the payload size use `-Oz/-Os` for release builds rather then `-O2/O3`.
- `-flto`: Use this flag when both compiling and linking in release mode to enable LTO for optimal performance.
- `-sALLOW_MEMORY_GROWTH`: Allow the WASM heap to grow (required for many real-world apps).
- `--bind`: Enable **Embind** for clean, class-based interop.

## Best Practices

- **Prefer standard flags:** Use standard compiler flags (e.g., `-pthread`, `-g`, `-O3`) over Emscripten-specific `-s` flags where possible.
- **Boolean flags:** For boolean Emscripten flags (like `-sSTRICT`), omit the `=1` suffix. Emscripten treats the presence of the flag as enabled.
- **List-based flags:** For flags that take lists (e.g., `-sEXPORTED_FUNCTIONS`), use the simple comma-separated form (e.g., `main,malloc`) rather than the more verbose JSON form.

### Separate Compilation

For larger projects, always use separate compilation (compiling `.cpp` to `.o` files before linking). This allows for incremental builds and is the standard practice for C/C++ development.

**Compilation step:**
```bash
em++ -c main.cpp -o main.o $(CXXFLAGS)
```

**Linking step:**
```bash
em++ main.o -o module.mjs $(LDFLAGS)
```

### Optimized Builds (Release)

```bash
emcc -O3 -flto -c main.cpp -o main.o
emcc -O3 -flto -sSTRICT -sEXPORT_ES6 --bind main.o -o module.mjs
```

### Debug Builds

```bash
emcc -g -c main.cpp -o main.o
emcc -g -sSTRICT -sEXPORT_ES6 --bind main.o -o module.mjs
```

## Modern Web Workflows

- **Interop with JS:** Prefer **Embind** over `extern "C"`. It handles complex types (strings, vectors, objects) and classes more safely.
- **Async Execution:** Use **Asyncify** (`-sASYNCIFY`) or **JSPI** (`-sJSPI`) for C++ code that needs to call async JavaScript functions.
- **Porting Libraries:** See `references/library-porting.md` for CMake, autoconf, and Docker workflows.

## Common Pitfalls to Avoid

- **Blocking the Main Thread:** C++ code that runs for long periods without returning control to the browser will freeze the UI. Use `emscripten_set_main_loop()` or offload to a Web Worker.
- **Direct File Access:** Standard I/O (e.g., `fopen`) is virtualized. Use MEMFS for small files or specialized Emscripten APIs for persistent storage (IDBFS).
- **Manual Memory Management:** While C++ uses pointers, Emscripten's heap is separate. Be careful with large allocations and always allow memory growth.
- **Standard Sockets:** Standard BSD sockets won't work in a browser. Use WebSockets or the Emscripten Fetch API.

## Reference Materials

- **Library Porting & Docker**: [library-porting.md](references/library-porting.md)
- **Asset Template**: `assets/hello-world/`
