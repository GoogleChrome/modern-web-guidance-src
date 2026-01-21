---
description: Allow Chrome apps to interact with the user's local file system for reading and writing files.
filename: file-system-access
category: extensions
---

# File System Access

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/fileSystem

## Best Practices

The `chrome.fileSystem` API enables Chrome Apps to read and write files on the user's local file system. This is crucial for applications like text editors or file management tools.

### Choosing Files and Directories

Use `chrome.fileSystem.chooseEntry()` to prompt the user to select a file or directory. You can specify options like `accepts` to filter by file type or extension, `acceptsMultiple` to allow multiple selections, and `suggestedName` for saving files. The `type` option can be set to `openFile`, `openWritableFile`, `saveFile`, or `openDirectory`.

```javascript
chrome.fileSystem.chooseEntry(
  { type: 'openFile', accepts: [{
    description: 'Text Files',
    mimeTypes: ['text/plain'],
    extensions: ['txt']
  }]},
  function(fileEntry) {
    if (!fileEntry) {
      console.log('User did not select a file.');
      return;
    }
    // Process the selected fileEntry
    fileEntry.file(function(file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        console.log('File content:', e.target.result);
      };
      reader.onerror = function(e) {
        console.error('Error reading file:', e);
      };
      reader.readAsText(file);
    });
  }
);
```

### Writing to Files

To write to files, you often need to ensure you have a writable entry. If the initial `chooseEntry` call didn't return a writable entry, you can use `chrome.fileSystem.getWritableEntry()`. Alternatively, use `chooseEntry` with `type: 'openWritableFile'` or `type: 'saveFile'`.

```javascript
chrome.fileSystem.chooseEntry(
  { type: 'saveFile', suggestedName: 'my_document.txt' },
  function(fileEntry) {
    if (!fileEntry) {
      console.log('User did not select a save location.');
      return;
    }
    fileEntry.createWriter(function(fileWriter) {
      const blob = new Blob(['This is the content to write.'], { type: 'text/plain' });
      fileWriter.write(blob);
      console.log('File written successfully.');
    }, function(e) {
      console.error('Error getting file writer:', e);
    });
  }
);
```

### Managing File Entry Persistence

The `chrome.fileSystem.retainEntry()` method returns an ID that can be used with `chrome.fileSystem.restoreEntry()` to regain access to a file entry. This is useful for keeping track of user-selected files across app sessions. Without explicit retention, entries are only kept while the app is running. Apps with the `retainEntries` permission can retain entries indefinitely.

```javascript
// When an entry is selected and processed
chrome.fileSystem.retainEntry(selectedEntry, function(entryId) {
  console.log('Entry retained with ID:', entryId);
  // Store entryId for later restoration
});

// Later, to restore an entry
const entryIdToRestore = 'some-stored-id';
chrome.fileSystem.restoreEntry(entryIdToRestore, function(entry) {
  if (entry) {
    console.log('Entry restored:', entry);
    // Use the restored entry
  } else {
    console.error('Failed to restore entry.');
  }
});
```

### Permissions

Ensure your app's manifest includes the `fileSystem` permission. For writing operations, the `write` sub-permission is required. For opening directories, the `directory` sub-permission is necessary.

```json
{
  "manifest_version": 2,
  "name": "File System App",
  "version": "1.0",
  "permissions": [
    "fileSystem"
  ]
}
```

## Fallback Strategies

The `chrome.fileSystem` API is a Chrome-specific API and is not part of web standards. Therefore, there are no direct web-based fallbacks for accessing the local file system in the same way. For web applications, consider using the File System Access API (currently available in Chrome and Edge) or the `input type="file"` element for user-initiated file access.

- **DO** use `chrome.fileSystem` for Chrome Apps requiring deep local file system integration.
- **DO** check `chrome.runtime.lastError` for error handling after API calls.
- **DO** inform users why file system access is needed and how their data will be used.