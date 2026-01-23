---
description: Store, retrieve, and track user data with the chrome.storage API for persistent extension data.
filename: chrome-storage-best-practices
category: extensions
---

# Chrome Storage API Best Practices

The `chrome.storage` API provides a robust way for Chrome extensions to store and retrieve user data, sync it across devices, and track changes. This guide outlines best practices for using this API effectively.

## General Best Practices

### Choose the Right Storage Area

*   **`chrome.storage.local`**: Use for data that is specific to the user's local machine. It offers a generous quota and is suitable for most persistent data.
*   **`chrome.storage.sync`**: Ideal for data that needs to be synced across the user's Chrome instances. Be mindful of its stricter quotas and rate limits.
*   **`chrome.storage.managed`**: Use for configuration settings that are managed by a domain administrator. This area is read-only for extensions.
*   **`chrome.storage.session`** (Chrome 102+): For data that only needs to persist for the duration of the user's session. This data is stored in memory and is not persisted to disk.

### Handle Storage Operations Asynchronously

All `chrome.storage` operations are asynchronous. Always use callbacks or Promises (with `async/await`) to handle the results and avoid blocking the main thread.

```javascript
// Using callbacks
chrome.storage.local.get(['key1', 'key2'], function(result) {
  console.log('Values retrieved:', result);
});

// Using Promises with async/await
async function getData() {
  const result = await chrome.storage.local.get(['key1', 'key2']);
  console.log('Values retrieved:', result);
}
getData();
```

### Handle `chrome.runtime.lastError`

When using callbacks, always check for `chrome.runtime.lastError` to gracefully handle potential errors during storage operations.

```javascript
chrome.storage.local.get(['myKey'], function(result) {
  if (chrome.runtime.lastError) {
    console.error('Error retrieving data:', chrome.runtime.lastError);
    return;
  }
  console.log('Data:', result);
});
```

### Be Mindful of Quotas and Limits

*   **`local` and `session`**: Have a `QUOTA_BYTES` limit (default 5MB, but can be increased with `unlimitedStorage` permission).
*   **`sync`**: Has `QUOTA_BYTES` (100KB), `QUOTA_BYTES_PER_ITEM` (8KB), `MAX_ITEMS` (512), `MAX_WRITE_OPERATIONS_PER_MINUTE` (120), and `MAX_WRITE_OPERATIONS_PER_HOUR` (1800).

Exceeding these limits will cause operations to fail. Plan your data storage accordingly and consider implementing strategies to manage data size and usage.

### Serialize and Deserialize Data Appropriately

The `chrome.storage` API stores data as JSON-stringified key-value pairs. Ensure that the data you store is JSON-serializable. For complex objects, you might need to implement custom serialization and deserialization logic.

### Use `onChanged` Event for Real-time Updates

The `chrome.storage.onChanged` event is crucial for reacting to changes in storage. This is particularly useful for synchronizing data across different parts of your extension or for updating the UI in real-time.

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.myKey) {
      console.log('myKey changed:', changes.myKey.newValue);
      // Update UI or perform other actions
    }
  }
});
```

## Advanced Best Practices

### Using `unlimitedStorage` Permission

If your extension requires storing large amounts of data in `chrome.storage.local`, request the `unlimitedStorage` permission in your `manifest.json`. Be judicious with this permission, as it grants significant storage access.

```json
{
  "name": "My Extension",
  "version": "1.0",
    "manifest_version": 3,
  "permissions": [
    "storage",
    "unlimitedStorage"
  ]
}
```

### Structuring Storage Data

Organize your storage data logically. Instead of storing many individual keys, consider grouping related data under a single key as an object. This can make your code cleaner and reduce the number of storage operations.

```javascript
// Instead of:
// chrome.storage.local.set({ 'userFirstName': 'John', 'userLastName': 'Doe' });
// chrome.storage.local.get(['userFirstName', 'userLastName'], ...);

// Consider:
chrome.storage.local.set({ 'userInfo': { firstName: 'John', lastName: 'Doe' } });
chrome.storage.local.get(['userInfo'], (result) => {
  const userInfo = result.userInfo;
  console.log(userInfo.firstName, userInfo.lastName);
});
```

### Implementing Fallbacks and Graceful Degradation

When dealing with storage limits or potential data corruption, consider implementing fallback mechanisms. For instance, if a sync operation fails, you might want to fall back to using local storage.

### Versioning Your Storage Schema

As your extension evolves, your storage schema might need to change. Implement a versioning system for your stored data to handle upgrades and maintain backward compatibility. This can involve checking a version number in storage and migrating data if necessary.

```javascript
const STORAGE_VERSION = 2;

async function initializeStorage() {
  const settings = await chrome.storage.local.get('settings');
  if (!settings.settings || settings.settings.version !== STORAGE_VERSION) {
    // Migrate data to the new schema
    await migrateStorage();
    await chrome.storage.local.set({ settings: { version: STORAGE_VERSION } });
  }
}

async function migrateStorage() {
  // ... migration logic ...
  console.log('Storage migrated to version', STORAGE_VERSION);
}

initializeStorage();