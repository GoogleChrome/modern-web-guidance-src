---
name: persist-structured-data
description: Store, query, and update structured objects or binary data client-side across sessions without blocking the main thread, enabling offline access and fast local reads.
web-feature-ids:
  - indexeddb
  - getallrecords
  - storage-manager
  - storage-buckets
---

# Persist structured data with IndexedDB

When your application needs to persist client-side state across sessions — such as offline documents, cached API payloads, or user-generated content — use IndexedDB. Unlike `localStorage`, which blocks the main thread on synchronous disk I/O and only accepts strings, IndexedDB is asynchronous, transactional, and uses the structured clone algorithm to store JavaScript objects, binary data (`Blob`, `File`, `ArrayBuffer`), and platform capability objects (`FileSystemHandle`, non-extractable `CryptoKey`) directly without serializing them into strings or holding entire `Blob` payloads in memory at once. Never use `localStorage` for client-side persistence due to its main-thread performance cost.

## Opening a database, schema migrations, and connection lifecycle

1. **Version with positive integers:** Call `indexedDB.open(name, version)` with a positive integer version (`1`, `2`, etc.). Increment the version only when adding, modifying, or deleting object stores or indexes. Never decrement version numbers.
2. **Run sequential migrations in `onupgradeneeded`:** Check `event.oldVersion` and allow `if` blocks (or `switch` cases with fallthrough) to run sequentially from the user's existing version to the current version.
3. **Create indexes only for non-primary-key queries:** Every index adds write and storage overhead. If you only look up records by their primary key (`keyPath` or out-of-line key), do not create indexes. Call `store.createIndex()` only for secondary properties that you filter or sort by.
4. **MANDATORY: Unblock other tabs on `versionchange`:** Attach an `onversionchange` listener to every open `IDBDatabase` instance that calls `database.close()`. If another tab opens the database with a newer version, any open connection that fails to close will fire `onblocked` in the upgrading tab and stall the migration.
5. **MANDATORY: Close connections on `pagehide` for bfcache eligibility:** Open `IDBDatabase` connections prevent browsers from placing the page into the back/forward cache (bfcache). Close the connection during `pagehide` and reopen it on `pageshow` when `event.persisted` is `true`.

```javascript
const DB_NAME = "app-notes";
const DB_VERSION = 1; // Increment only when changing object stores or indexes.
const STORE_NAME = "notes";

let db = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Run migrations sequentially based on the user's previous schema version.
      if (event.oldVersion < 1) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        // Create an index only because we query/sort by `updatedAt` (not the primary key `id`).
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      // MANDATORY: Close connection so version upgrades in other tabs are not blocked.
      database.onversionchange = () => {
        database.close();
        db = null;
      };

      resolve(database);
    };

    request.onerror = () => reject(request.error);
  });
}

// MANDATORY: Close open connections on pagehide to keep the page eligible for bfcache.
window.addEventListener("pagehide", () => {
  if (db) {
    db.close();
    db = null;
  }
});

window.addEventListener("pageshow", async (event) => {
  if (event.persisted) {
    db = await openDatabase();
  }
});
```

## Batching requests in transactions and committing writes

- **Coalesce related operations into a single transaction:** Do not open a separate transaction for each individual record write when saving multiple items or updating related state. Opening one transaction per request sacrifices ACID atomicity and incurs repeated commit overhead.
- **Scope transaction mode appropriately:** Use `"readonly"` for read queries and `"readwrite"` for mutations. Multiple `"readonly"` transactions can execute concurrently, whereas `"readwrite"` transactions are serialized (only one `"readwrite"` transaction runs at a time per database).
- **MANDATORY: Do not `await` Promises inside an active transaction:** An IndexedDB transaction is only `"active"` during the synchronous task that created it and while an IDB event callback (`onsuccess` / `onerror`) is running; as soon as control yields to the event loop, the transaction becomes `"inactive"` (even if requests are still pending) and auto-commits once all queued requests finish. Manually wrapping individual `IDBRequest` objects in Promises or `await`-ing non-IDB work (such as `fetch()`, `Blob.arrayBuffer()`, or Web Crypto) mid-transaction causes the transaction to become inactive (and potentially auto-commit) before your `await` resumes, throwing `TransactionInactiveError` on the next request. Either:
  - Keep all request queueing synchronous (or chained inside `request.onsuccess` callbacks) and only wrap the outer transaction lifecycle (`oncomplete` / `onerror` / `onabort`) in a Promise, or
  - Use an established wrapper library (such as `Dexie.js` or `idb`) that manages transaction lifetimes, while still completing all non-IDB `async` work before opening the transaction.
- **MANDATORY: Call `tx.commit()` once all requests are queued:** Calling `tx.commit()` explicitly tells the browser that no additional requests will be scheduled on the transaction, allowing it to begin committing immediately without waiting for pending `onsuccess` event callbacks to finish dispatching.
- **MANDATORY: Wait for `tx.oncomplete` and handle both `tx.onerror` and `tx.onabort`:** Resolve write operations on `tx.oncomplete`, not `request.onsuccess`. A request's `success` event only means the in-flight operation succeeded; the transaction can still abort or roll back (for example, due to a later request error or `QuotaExceededError`).
- **Leave transaction `durability` at its default:** Do **not** pass `{ durability: "strict" }` to `database.transaction()`. The default (`"relaxed"`) commits once writes reach OS buffers; `"strict"` forces synchronous hardware disk flushes (`fsync`) that severely degrade write performance and are unnecessary for almost all web applications.
- **Choose `put()` vs. `add()` intentionally:** Use `store.put()` for insert-or-update (upsert) semantics, and `store.add()` only when an existing key should fail with a `ConstraintError`. Do not start transactions during `unload` or `beforeunload`, as browsers may terminate page-teardown I/O before commit.

```javascript
// Batch multiple writes into a single "readwrite" transaction.
// Precompute any async values (or pass Blobs directly) before opening the transaction.
function saveNotes(database, notes) {
  return new Promise((resolve, reject) => {
    // Leave transaction options at default durability (do not set { durability: "strict" }).
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const savedIds = [];
    const now = Date.now();

    for (const note of notes) {
      // `put()` inserts new records or updates existing ones; Blobs are stored natively.
      const request = store.put({ ...note, updatedAt: now });
      request.onsuccess = () => {
        savedIds.push(request.result);
      };
    }

    // Signal that no more requests will be added so the browser can commit immediately.
    tx.commit();

    // MANDATORY: Wait for `oncomplete` to confirm the transaction committed without rollback.
    tx.oncomplete = () => resolve(savedIds);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new DOMException("Transaction aborted", "AbortError"));
  });
}

// For read-modify-write updates, chain inside `request.onsuccess` to keep the transaction active.
function toggleNotePinned(database, id) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const note = getReq.result;
      if (!note) {
        tx.commit();
        return;
      }
      note.pinned = !note.pinned;
      note.updatedAt = Date.now();
      store.put(note);
      // No further requests will be queued after `put()`.
      tx.commit();
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new DOMException("Transaction aborted", "AbortError"));
  });
}
```

## Querying with indexes, key ranges, and `getAllRecords()`

- **Filter with `IDBKeyRange` instead of scanning in JavaScript:** Pass an `IDBKeyRange` (`IDBKeyRange.bound()`, `IDBKeyRange.lowerBound()`, `IDBKeyRange.upperBound()`, or `IDBKeyRange.only()`) to index or store queries so filtering happens in the storage engine.
- **Use `getAllRecords()` for reverse-order or batch reads with keys and values:** Standard `getAll()` only returns values in ascending key order, requiring slow per-record `openCursor(range, "prev")` round-trips when you need descending order or both keys and values. `getAllRecords({ query, count, direction })` retrieves `IDBRecord` entries (`{ key, primaryKey, value }`) in a single batch call and supports `direction: "prev"`.

```javascript
function getRecentNotes(database, { sinceTimestamp = 0, limit = 50 } = {}) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("updatedAt");
    const range = IDBKeyRange.lowerBound(sinceTimestamp);

    // Batch-read in reverse order without cursor iteration.
    const request = index.getAllRecords({
      query: range,
      count: limit,
      direction: "prev",
    });

    request.onsuccess = () => {
      // Each IDBRecord exposes `.key` (index key), `.primaryKey`, and `.value`.
      resolve(request.result.map((record) => record.value));
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new DOMException("Transaction aborted", "AbortError"));
  });
}
```

## Storage quota, persistence, and security considerations

- **Handle `QuotaExceededError` on writes (do not rely on `navigator.storage.estimate()` to check free space):** Browsers report a synthetic `quota` value in `navigator.storage.estimate()` to mitigate incognito-mode detection and disk-size fingerprinting. While `usage` reflects actual bytes consumed by your origin, `quota - usage` does not tell you how much physical disk space remains. Always catch `tx.error?.name === "QuotaExceededError"` in transaction `onerror`/`onabort` handlers to evict expendable caches or notify the user when storage is full.
- **Request persistent storage only when storing critical user data:** By default, IndexedDB uses best-effort persistence and may be evicted by the browser under device storage pressure. Call `navigator.storage.persist()` only after the user creates important local data that should not be evicted (some browsers grant persistence silently based on site engagement heuristics, while others display a permission prompt that is disruptive on initial page load).
- **Isolate critical data from expendable caches with Storage Buckets:** When your application stores both critical user data (such as unsynced drafts) and evictable caches, use `navigator.storageBuckets.open()` to place them in separate buckets with independent persistence and expiration policies instead of marking the entire origin persistent.
- **Understand the Same-Origin security model:** IndexedDB is isolated per origin by the Same-Origin Policy — other websites cannot access your database. It is appropriate for storing user documents, personal data (PII), offline application state, `FileSystemHandle` grants, and non-extractable `CryptoKey` objects. However, because any script running in your origin can read IndexedDB (for example, during an XSS attack) and data resides on the local disk:
  - Never store unencrypted passwords in client-side storage, and prefer `HttpOnly` cookies for session authentication credentials.
  - Clear local databases (`indexedDB.deleteDatabase(DB_NAME)` or `store.clear()`) when a user signs out so data is not left behind on shared devices.

## Progressive enhancement and fallbacks

{{ BASELINE_STATUS("indexeddb") }}

{{ BASELINE_STATUS("storage-manager") }}

### Batch reverse and key-value queries with `getAllRecords()`

{{ BASELINE_STATUS("getallrecords") }}

**MANDATORY:** Feature-detect `"getAllRecords" in IDBIndex.prototype` (or `IDBObjectStore.prototype`) and fall back to `openCursor(range, "prev")` for descending queries (or `getAll(range, count)` when ascending order is sufficient):

```javascript
function getRecentNotes(database, { sinceTimestamp = 0, limit = 50 } = {}) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("updatedAt");
    const range = IDBKeyRange.lowerBound(sinceTimestamp);

    if ("getAllRecords" in IDBIndex.prototype) {
      const req = index.getAllRecords({
        query: range,
        count: limit,
        direction: "prev",
      });
      req.onsuccess = () => resolve(req.result.map((r) => r.value));
    } else {
      // Fall back to a reverse cursor when getAllRecords() is unavailable.
      const results = [];
      const cursorReq = index.openCursor(range, "prev");
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    }

    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new DOMException("Transaction aborted", "AbortError"));
  });
}
```

### Isolating persistence policies with Storage Buckets

{{ BASELINE_STATUS("storage-buckets") }}

If your Baseline target does not support Storage Buckets, feature-detect `"storageBuckets" in navigator`. When supported, open a dedicated bucket for critical user data and access `bucket.indexedDB`; otherwise, fall back to the default origin `indexedDB` and request origin-wide persistence via `navigator.storage.persist()` when the user saves important data:

```javascript
// Call when saving critical user data (not on initial page load, which may prompt the user).
async function getDraftsIndexedDB() {
  if ("storageBuckets" in navigator) {
    // Isolate critical drafts in a dedicated persistent bucket; exposes a standard IDBFactory.
    const bucket = await navigator.storageBuckets.open("user-drafts", {
      persisted: true,
    });
    return bucket.indexedDB;
  }

  if (navigator.storage?.persist) {
    await navigator.storage.persist();
  }
  return indexedDB;
}
```
