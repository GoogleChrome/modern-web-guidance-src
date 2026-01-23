---
description: Learn how to allow users to select, read, and monitor the progress of local files using JavaScript, covering both modern and legacy methods.
filename: file-handling-with-javascript
category: ui
---

# Handling Local Files with JavaScript

This guide walks through how to use JavaScript to interact with files on the user's local device, enabling features like file uploads and local file manipulation.

## The modern File System Access API {#file-system-access-api}

The File System Access API offers a robust way to read from and write to files and directories directly on the user's system. It is supported in most Chromium-based browsers. For broader compatibility, consider using the [browser-fs-access](https://github.com/GoogleChromeLabs/browser-fs-access) helper library, which gracefully falls back to older methods when the API is unavailable.

Refer to [The File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) for more details.

## Work with files, the classic way {#legacy-methods}

This guide also covers traditional JavaScript methods for file interaction.

## Select files {#select}

Users can select files in two primary ways:

### HTML input element {#select-input}

The simplest method is the [`<input type="file">`](https://developer.mozilla.org/docs/Web/HTML/Element/input/file) element. It leverages the operating system's native file picker. The `change` event on this element provides access to selected files via `event.target.files`, which is a [`FileList`](https://developer.mozilla.org/docs/Web/API/FileList) object containing individual [`File`](https://developer.mozilla.org/docs/Web/API/File) objects.

```html
<!-- The `multiple` attribute allows selecting multiple files. -->
<input type="file" id="file-selector" multiple>
<script>
  const fileSelector = document.getElementById('file-selector');
  fileSelector.addEventListener('change', (event) => {
    const fileList = event.target.files;
    console.log(fileList);
  });
</script>
```

**Best Practice:** Consider `window.showOpenFilePicker()` as a modern alternative for obtaining file handles that support both reading and writing. This can be polyfilled using libraries like [browser-fs-access](https://github.com/GoogleChromeLabs/browser-fs-access#opening-files).

### Custom drag-and-drop {#select-dnd}

For a more user-friendly experience, implement a custom drag-and-drop zone. While some browsers support dropping directly onto `<input type="file">`, a dedicated, larger drop surface is generally preferable.

**Best Practice:** Explore `DataTransferItem.getAsFileSystemHandle()` for drag-and-drop operations when using the File System Access API, as it provides file handles.

#### Define the drop zone {#define-drop-zone}

To make an element a drop target, listen for `dragover` and `drop` events. `dragover` should prevent the default browser behavior and indicate a copy operation, while `drop` will contain the selected files in `event.dataTransfer.files`.

```js
const dropArea = document.getElementById('drop-area');

dropArea.addEventListener('dragover', (event) => {
  event.stopPropagation();
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy'; // Visual feedback
});

dropArea.addEventListener('drop', (event) => {
  event.stopPropagation();
  event.preventDefault();
  const fileList = event.dataTransfer.files;
  console.log(fileList);
});
```

**Best Practice:** Always include `event.stopPropagation()` and `event.preventDefault()` in your `dragover` and `drop` event handlers to prevent unwanted browser navigation.

### What about directories? {#directories}

Accessing directories directly via JavaScript is limited. The [`webkitdirectory`](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/webkitdirectory) attribute on `<input type="file">` allows directory selection in some browsers, but has compatibility issues.

**Best Practice:** For directory access, the `window.showDirectoryPicker()` method from the File System Access API is the recommended modern approach, with polyfills available for broader support. Dragging directories into a drop zone will yield a `File` object representing the directory, but without access to its contents.

## Read file metadata {#read-metadata}

The [`File`](https://developer.mozilla.org/docs/Web/API/File) object provides essential metadata like `name`, `type` (MIME type), and `size`.

```js
function getMetadataForFileList(fileList) {
  for (const file of fileList) {
    const name = file.name ?? 'NOT SUPPORTED';
    const type = file.type ?? 'NOT SUPPORTED';
    const size = file.size ?? 'NOT SUPPORTED';
    console.log({file, name, type, size});
  }
}
```

## Read a file's content {#read-content}

Use the [`FileReader`](https://developer.mozilla.org/docs/Web/API/FileReader) API to read file content into memory as an [array buffer](https://developer.mozilla.org/docs/Web/API/FileReader/readAsArrayBuffer), [data URL](https://developer.mozilla.org/docs/Web/API/FileReader/readAsDataURL), or [text](https://developer.mozilla.org/docs/Web/API/FileReader/readAsText).

```js
function readImage(file) {
  if (file.type && !file.type.startsWith('image/')) {
    console.log('File is not an image.', file.type, file);
    return;
  }

  const reader = new FileReader();
  reader.addEventListener('load', (event) => {
    // Use event.target.result, e.g., to set an img element's src
    img.src = event.target.result;
  });
  reader.readAsDataURL(file);
}
```

### Monitor the progress of a file read {#monitor-progress}

For large files, provide user feedback using the `progress` event of `FileReader`. This event provides `loaded` and `total` properties to calculate the percentage completion.

```js/7-12
function readFile(file) {
  const reader = new FileReader();
  reader.addEventListener('load', (event) => {
    const result = event.target.result;
    // Process the loaded file content
  });

  reader.addEventListener('progress', (event) => {
    if (event.loaded && event.total) {
      const percent = (event.loaded / event.total) * 100;
      console.log(`Progress: ${Math.round(percent)}%`);
    }
  });
  reader.readAsDataURL(file);
}
```