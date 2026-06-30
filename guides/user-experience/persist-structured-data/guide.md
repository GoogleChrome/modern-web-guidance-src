---
name: persist-structured-data
description: Store and retrieve structured application data client-side using IndexedDB, enabling offline access, fast local reads, and reduced network dependency without relying on cookies or localStorage for complex data.
web-feature-ids:
  - indexeddb
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
  - https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
---

# Persist structured data with IndexedDB

When your application needs to store structured data client-side — for offline access, caching API responses, or persisting user-generated content across sessions — IndexedDB is the appropriate storage mechanism. Unlike `localStorage`, which is limited to string key-value pairs and blocks the main thread, IndexedDB supports structured objects, indexes for efficient querying, and large storage quotas via an asynchronous, transactional API.

## How to implement

1. **Open (or create) a database:** Call `indexedDB.open()` with a database name and version number. If the database doesn't exist or the version is higher than the current one, the `upgradeneeded` event fires, giving you the opportunity to define or update the schema.

2. **Define object stores and indexes in `upgradeneeded`:** Create object stores (analogous to tables) with a `keyPath` or `autoIncrement` key generator. Add indexes on properties you need to query by.

3. **Read and write data through transactions:** All data access goes through transactions. Use `"readwrite"` transactions for writes (`put`, `add`, `delete`) and `"readonly"` transactions for reads (`get`, `getAll`, `openCursor`).

4. **Handle version changes gracefully:** Listen for the `versionchange` event on the database connection so you can close it when another tab upgrades the schema.

## Example code

This example stores and retrieves a collection of notes. The database uses `autoIncrement` for keys and an index on the `updatedAt` property to support ordering by recency.

```javascript
const DB_NAME = "app-notes";
const DB_VERSION = 1;
const STORE_NAME = "notes";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Only create the store if it doesn't already exist.
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        // Index for querying notes by last-updated time.
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      // MANDATORY: Handle version changes from other tabs.
      db.onversionchange = () => {
        db.close();
      };

      resolve(db);
    };

    request.onerror = (event) => {
      reject(request.error);
    };
  });
}

async function addNote(db, note) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record = { ...note, updatedAt: Date.now() };
    const request = store.add(record);

    request.onsuccess = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllNotes(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("updatedAt");

    // Retrieve all notes ordered by updatedAt (ascending).
    const request = index.getAll();

    request.onsuccess = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteNote(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.delete(id);

    request.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Usage
const db = await openDatabase();
await addNote(db, { title: "First note", body: "Hello, IndexedDB!" });
const notes = await getAllNotes(db);
```

## Best Practices

- **DO** wrap IndexedDB operations in Promises or use a thin promise wrapper. The raw event-based API is error-prone and difficult to compose with `async`/`await`.
- **DO** perform all schema changes (creating/deleting object stores and indexes) inside the `upgradeneeded` handler. This is the only context where structural changes are allowed.
- **DO** handle the `versionchange` event on the database connection to close it when another tab upgrades the schema. Failing to do so blocks the upgrade.
- **DO** keep transactions short-lived. A transaction becomes inactive as soon as control returns to the event loop without a pending request on it.
- **DO** use `put()` when you want insert-or-update semantics. Use `add()` only when you want an error if the key already exists.
- **DO** use indexes and key ranges (`IDBKeyRange`) for efficient queries instead of iterating all records with a cursor.
- **DO** use `"readonly"` transactions for reads. Multiple readonly transactions can run concurrently, but only one `"readwrite"` transaction per object store is active at a time.
- **DO NOT** store sensitive data (tokens, passwords, PII) in IndexedDB without encryption. IndexedDB is not a secure store — any script running on the origin can access it.
- **DO NOT** rely on IndexedDB transactions completing during page `unload` or `beforeunload`. The browser may abort them.
- **DO NOT** use IndexedDB for simple key-value pairs where `localStorage` would suffice. IndexedDB adds complexity that is only justified when you need structured queries, large storage, or non-blocking access.

## Browser support and fallback strategies

{{ BASELINE_STATUS("indexeddb") }}

IndexedDB is supported in all modern browsers. However, if it doesn't meet your Baseline target, use feature detection to check its availability and conditionally fall back to `localStorage` for older browsers.

```javascript
if (indexedDB) {
  // IndexedDB is available.
} else {
  // Extremely old browser — fall back to localStorage for basic persistence.
}
```

### Storage quota

Browsers impose per-origin storage limits. Use the Storage API to check available space before writing large amounts of data:

```javascript
if (navigator.storage && navigator.storage.estimate) {
  const { usage, quota } = await navigator.storage.estimate();
  console.log(`Using ${usage} of ${quota} bytes.`);
}
```

To request persistent storage that won't be evicted under storage pressure:

```javascript
if (navigator.storage && navigator.storage.persist) {
  const granted = await navigator.storage.persist();
  console.log(granted ? "Storage is persistent." : "Storage may be evicted.");
}
```
