---
description: Provides guidance on best practices for client-side data storage and caching in web applications, comparing options like IndexedDB and Local Storage.
filename: client-side-storage
category: data
---

# Client-side Storage

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API

## Best Practices

When deciding how to store data and cache critical app resources on the client, consider the trade-offs between different web storage options. IndexedDB is generally recommended for storing larger amounts of structured data, while Local Storage is suitable for simpler key-value pairs.

### Storing Data

*   **IndexedDB:** Use for structured data, large datasets, and when you need transactional capabilities. It's a low-level API, so consider using libraries to simplify its usage.
*   **Local Storage:** Suitable for storing small amounts of data, like user preferences or session tokens. It's synchronous and easier to use but has limitations on storage size and performance.

### Caching Resources

*   Leverage browser caching mechanisms (HTTP cache) for static assets like images, CSS, and JavaScript.
*   For dynamic content or application-specific data that needs to be available offline, consider using Service Workers in conjunction with IndexedDB to cache responses.

### Storage Limits and Quotas

*   Be aware that browser storage is not unlimited. Each origin typically has a quota that varies by browser and device.
*   You can check your storage quota using JavaScript:
    ```javascript
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      console.log(`Quota: ${estimate.quota} bytes`);
      console.log(`Usage: ${estimate.usage} bytes`);
    }
    ```
*   Understand how browser eviction works. Browsers may clear storage for origins that haven't been visited recently, especially on devices with limited storage.

### Testing Quota Exceeded Errors

*   To simulate quota limits and test how your application handles storage errors, you can start Chrome with limited storage using a command-line flag:
    `chrome --disk-cache-size=1 --media-cache-size=1`
    (Note: Specific flags and their effectiveness may vary across browser versions.)

## Fallback Strategies

If your application relies on specific storage mechanisms and needs to gracefully degrade when storage is full or unavailable:

### Feature Detection

*   Always check for the availability of storage APIs before using them.
    ```javascript
    // For IndexedDB
    if ('indexedDB' in window) {
      // IndexedDB is supported
    }

    // For Local Storage
    if ('localStorage' in window) {
      // Local Storage is supported
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        // Local Storage is available and usable
      } catch (e) {
        // Local Storage is available but disabled or full
      }
    }
    ```

### Graceful Degradation

*   If a primary storage method fails (e.g., quota exceeded), consider falling back to a less capable but available option, or inform the user about the limitation.
*   For critical data, implement mechanisms to sync data to a server when connectivity is available.

**DO** prioritize user experience by providing clear feedback when storage limitations impact functionality.
**DO NOT** assume unlimited storage space on the client.