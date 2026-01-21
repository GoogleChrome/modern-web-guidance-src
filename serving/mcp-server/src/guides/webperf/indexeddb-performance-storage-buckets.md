---
description: Improve IndexedDB performance by leveraging storage buckets for concurrent access.
filename: indexeddb-performance-storage-buckets
category: webperf
---

# Maximum IndexedDB performance with Storage Buckets

Reference docs:
- https://developer.chrome.com/blog/indexeddb-storage-buckets-performance
- https://wicg.github.io/storage-buckets/
- https://github.com/WICG/storage-buckets/blob/main/explainer.md

## Best Practices

The Chrome team has made significant performance improvements to IndexedDB (IDB) by moving its backing store to a separate sequence. This allows for faster concurrent use of IDB, both from the same site and across different sites.

### Cross-site Usage

If your application uses IndexedDB across different sites, you don't need to take any specific action. The performance improvements are automatically applied once the browser-level changes are in place (available from Chrome 126).

### Same-site Usage

To benefit from these performance enhancements for same-site usage, you should segregate your IDB usage into different instances using [storage buckets](/docs/web-platform/storage-buckets). This allows for more efficient concurrent operations.

Here's a code example demonstrating how to use storage buckets for separate IndexedDB instances:

```js
// Open the main IndexedDB instance
const request = indexedDB.open('main', 1);
request.onsuccess = (event) => {
  /* Do stuff with the main instance. */
};

// By default, use the regular IDB instance.
let idb = indexedDB;

// Open a separate storage bucket if the API is supported.
if ('storageBuckets' in navigator) {
  try {
    const bucket = await navigator.storageBuckets.open('logs-bucket');
    // Get access to the storage bucket's IDB instance.
    idb = bucket.indexedDB;
  } catch (error) {
    console.error('Failed to open storage bucket:', error);
    // Fallback to default IDB if bucket opening fails
    idb = indexedDB;
  }
}

// Open a separate IDB instance within the (potentially new) storage bucket
const bucketRequest = idb.open('logs', 1);
bucketRequest.onsuccess = (event) => {
  /* Do stuff with the separate instance. */
};
```

**DO** ensure you check for `navigator.storageBuckets` support before attempting to open a storage bucket.
**DO** consider implementing fallback logic in case opening a storage bucket fails.
**DO** use separate IndexedDB instances for distinct data types or functionalities within the same site to maximize concurrency benefits.

## Browser Support

The performance gains described in this post are realized through progressive enhancement. You can start benefiting as soon as the Storage Buckets API is supported in your browser (from Chrome 122). The full sharding of IDB instances for maximum performance is available from Chrome 126.

## DevTools

When inspecting IndexedDB instances in Chrome DevTools, you can identify the storage bucket associated with each instance. Look for the **Bucket name** section, which will display the name of the storage bucket used.

![Chrome DevTools inspecting the IndexedDB section. There are two logs databases, the storage bucket name "logs bucket" is highlighted.](maximumindexed--6emtap4mss6.png)

## Related Links

- [Not all storage is created equal: introducing Storage Buckets](/docs/web-platform/storage-buckets)
- [Draft specification](https://wicg.github.io/storage-buckets/)
- [Explainer](https://github.com/WICG/storage-buckets/blob/main/explainer.md)

## Acknowledgements

This post was reviewed by [Evan Stade](https://www.linkedin.com/in/evan-stade-4585826) and [Rachel Andrew](https://rachelandrew.co.uk/).