---
name: persist-structured-data
description: Store and retrieve structured application data client-side using IndexedDB, enabling offline access, fast local reads, and reduced network dependency without relying on cookies or localStorage for complex data.
web-feature-ids:
  - indexeddb
  - getallrecords
---

# Persist structured data with IndexedDB

When your application needs to store structured data client-side — for offline access, caching API responses, or persisting user-generated content across sessions — IndexedDB is the appropriate storage mechanism. Unlike `localStorage`, which is limited to string key-value pairs and blocks the main thread, IndexedDB supports structured objects, indexes for efficient querying, and large storage quotas via an asynchronous, transactional API.

## How to implement

1. **Open (or create) a database with an integer version:** Call `indexedDB.open()` with a database name and an integer version (e.g., `1`). Increment the version number only when you need to modify the schema (adding or removing object stores or indexes). Never decrement version numbers.

2. **Define object stores and indexes in `upgradeneeded`:** When creating the database or bumping the version, the `upgradeneeded` event fires. Check `event.oldVersion` to execute sequential migrations across version increments. Create object stores using `createObjectStore()` with a `keyPath` or `autoIncrement` key generator, and create indexes with `createIndex()`.

3. **Read and write data through transactions:** All operations require transactions (`"readonly"` for queries, `"readwrite"` for mutations). To ensure durability on write operations, resolve Promises when the transaction emits `oncomplete` rather than when the request emits `onsuccess`, and handle both `onerror` and `onabort`.

4. **Manage connection lifecycle for version changes and bfcache:** Attach a `versionchange` listener to close database connections when another tab initiates an upgrade. In addition, close open database connections during the `pagehide` event and reopen them on `pageshow` to remain eligible for the browser back/forward cache (bfcache).

## Example code

This example stores and retrieves notes with timestamps. The database uses `autoIncrement` for keys and an index on `updatedAt` for sorting. It demonstrates Promise-wrapped transactions, durable write completion, abort handling, and bfcache connection management.

```javascript
const DB_NAME = "app-notes";
const DB_VERSION = 1;
const STORE_NAME = "notes";

let db = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Handle incremental schema migrations based on oldVersion.
      if (event.oldVersion < 1) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        // Index for querying and ordering notes by update timestamp.
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const database = event.target.result;

      // MANDATORY: Close connection if another tab upgrades the database version.
      database.onversionchange = () => {
        database.close();
        db = null;
      };

      resolve(database);
    };

    request.onerror = () => reject(request.error);
  });
}

// Back/forward cache (bfcache) lifecycle management:
// Open IndexedDB connections block pages from entering bfcache.
window.addEventListener("pagehide", () => {
  if (db) {
    db.close();
    db = null;
  }
});

window.addEventListener("pageshow", async (event) => {
  // Reconnect if the page was restored from bfcache.
  if (event.persisted) {
    db = await openDatabase();
  }
});

async function addNote(database, note) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record = { ...note, updatedAt: Date.now() };
    const request = store.add(record);

    let generatedKey;
    request.onsuccess = () => {
      generatedKey = request.result;
    };

    // MANDATORY: Resolve on transaction complete to ensure data is committed to disk.
    tx.oncomplete = () => resolve(generatedKey);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException("Transaction aborted", "AbortError"));
  });
}

async function getAllNotes(database) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("updatedAt");

    // Retrieve all notes ordered by updatedAt (ascending).
    const request = index.getAll();

    request.onsuccess = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException("Transaction aborted", "AbortError"));
  });
}

async function deleteNote(database, id) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.delete(id);

    // Wait for oncomplete to confirm durable deletion.
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException("Transaction aborted", "AbortError"));
  });
}

// Usage
db = await openDatabase();
await addNote(db, { title: "First note", body: "Hello, IndexedDB!" });
const notes = await getAllNotes(db);
```

## Best Practices

- **DO** wrap IndexedDB operations in Promises or use a lightweight Promise wrapper. The raw event-based API is error-prone and cumbersome to integrate with `async`/`await`.
- **DO** resolve write transactions on `tx.oncomplete` rather than `request.onsuccess`. Request success only signifies that the request succeeded in memory, whereas transaction completion guarantees durability on disk.
- **DO** handle both `tx.onerror` and `tx.onabort` on transactions to catch failed or aborted operations and rollbacks.
- **DO** perform all schema migrations inside `onupgradeneeded` and check `event.oldVersion` to run version upgrades sequentially.
- **DO** use positive integers for database versions and only increment the version when changing object stores or indexes. Never decrement version numbers.
- **DO** close database connections during the `pagehide` event and re-establish them during `pageshow` when restored (`event.persisted === true`) to preserve back/forward cache (bfcache) eligibility.
- **DO** handle the `versionchange` event on the database connection to close it when another tab upgrades the schema. Failing to do so blocks the upgrade in other tabs.
- **DO** keep transactions short-lived. A transaction automatically becomes inactive as soon as control returns to the microtask loop without a pending request.
- **DO** use `put()` when you want insert-or-update semantics. Use `add()` only when you want an error if the key already exists.
- **DO** use indexes and key ranges (`IDBKeyRange`) for efficient queries instead of iterating all records with a cursor.
- **DO** use `"readonly"` transactions for reads. Multiple readonly transactions can run concurrently, but only one `"readwrite"` transaction per object store is active at a time.
- **DO NOT** store sensitive data (tokens, passwords, PII) in IndexedDB without encryption. IndexedDB is not a secure enclave — any script executing in the origin context can read its contents.
- **DO NOT** rely on IndexedDB transactions completing during page `unload` or `beforeunload`. Browsers may terminate ongoing I/O prematurely.
- **DO NOT** use IndexedDB for simple string key-value pairs where `localStorage` suffices. IndexedDB adds architectural complexity justified primarily for structured queries, binary storage, and large non-blocking datasets.

## Storage quota and persistence

Browsers impose per-origin storage quotas based on available disk space. Use the Storage API to check available space before writing large amounts of data:

```javascript
if (navigator.storage && navigator.storage.estimate) {
  const { usage, quota } = await navigator.storage.estimate();
  console.log(`Using ${usage} of ${quota} bytes.`);
}
```

By default, data in IndexedDB is stored under "best-effort" persistence, meaning the browser may evict it under storage pressure. Request persistent storage to prevent automatic eviction:

```javascript
if (navigator.storage && navigator.storage.persist) {
  const granted = await navigator.storage.persist();
  console.log(granted ? "Storage is persistent." : "Storage may be evicted under pressure.");
}
```

## Browser support and fallback strategies

{{ BASELINE_STATUS("indexeddb") }}

IndexedDB is supported in all modern browsers. However, if it doesn't meet your Baseline target, use feature detection to check its availability and conditionally fall back to `localStorage` for older browsers.

```javascript
if (typeof indexedDB !== "undefined") {
  // IndexedDB is available.
} else {
  // Fall back to localStorage for simple key-value persistence.
}
```

### Querying records and modern APIs

{{ BASELINE_STATUS("getallrecords") }}

While `getAll()` returns values and `getAllKeys()` returns keys, `getAllRecords()` retrieves records containing both keys and values in a single call. If `getAllRecords()` doesn't meet your Baseline target, use `getAll()` or cursor iteration (`openCursor()`) for broader compatibility, or feature-detect `IDBObjectStore.prototype.getAllRecords` before using it.
