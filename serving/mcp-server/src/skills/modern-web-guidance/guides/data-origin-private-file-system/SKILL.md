---
description: Use the origin private file system (OPFS) for high-performance, origin-private file storage within web applications, enabling offline data persistence and efficient data manipulation.
filename: origin-private-file-system
category: data
---

# Origin Private File System (OPFS)

The Origin Private File System (OPFS) provides a dedicated, high-performance storage mechanism for web applications, isolated to a specific origin. It allows for direct, low-level file manipulation, making it ideal for scenarios requiring fast read/write operations and offline data access.

## Best Practices

### Accessing the OPFS Root

The entry point to OPFS is an initially empty root directory for the origin, accessed asynchronously via `navigator.storage.getDirectory()`.

```js
const opfsRoot = await navigator.storage.getDirectory();
```

### Creating Files and Folders

Use `getFileHandle()` and `getDirectoryHandle()` on a directory handle to create new files and folders. The `{create: true}` option ensures they are created if they don't exist.

```js
const fileHandle = await opfsRoot.getFileHandle('my-data.txt', { create: true });
const directoryHandle = await opfsRoot.getDirectoryHandle('my-folder', { create: true });
```

### Writing to Files via Streaming

For efficient file writes, utilize `createWritable()` to get a `FileSystemWritableFileStream`, then `write()` data and `close()` the stream to persist changes.

```js
const writable = await fileHandle.createWritable();
await writable.write('Some content');
await writable.close();
```

### Reading Files

Obtain a `File` object from a `FileSystemFileHandle` using `getFile()` and then read its content, for example, as text.

```js
const file = await fileHandle.getFile();
console.log(await file.text());
```

### Deleting Files and Folders

Use the `remove()` method on file or directory handles. For recursive deletion of directories, pass `{recursive: true}`.

```js
await fileHandle.remove();
await directoryHandle.remove({ recursive: true });
```

### Synchronous Operations in Web Workers

For maximum performance, especially with WebAssembly, use OPFS within Web Workers. Obtain a `FileSystemSyncAccessHandle` from a `FileSystemFileHandle` via `createSyncAccessHandle()` for synchronous, in-place file operations like `read()`, `write()`, `truncate()`, and `flush()`.

```js
// In a Web Worker
const syncAccessHandle = await fileHandle.createSyncAccessHandle();
const content = new TextEncoder().encode('Fast data');
syncAccessHandle.write(content, { at: 0 });
syncAccessHandle.flush();
```

**IMPORTANT:** The `createSyncAccessHandle()` method is asynchronous, even though the handle it returns provides synchronous methods.

### Debugging OPFS

Until browser DevTools have built-in support, use the [OPFS Explorer Chrome extension](https://chrome.google.com/webstore/detail/opfs-explorer/acndjpgkpaclldomagafnognkcgjignd) to inspect and manage OPFS content.

## Fallback Strategies

OPFS is well-supported in modern browsers. However, for older browsers or specific environments where direct file system access might be restricted, consider alternative storage mechanisms like IndexedDB or Local Storage. These might not offer the same performance benefits but provide broader compatibility.

- **Feature Detection:** Before attempting to use OPFS, check for the existence of `navigator.storage` and `navigator.storage.getDirectory`.
- **Progressive Enhancement:** Design your application to function without OPFS, offering degraded functionality or alternative storage if OPFS is unavailable.