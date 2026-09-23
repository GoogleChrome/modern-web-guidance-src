---
name: avoid-redundant-large-asset-downloads
description: Avoid re-downloading and re-storing large shared assets, such as AI models, Wasm modules, or fully-bundled JavaScript libraries, that a visitor's browser may already hold from an unrelated site.
web-feature-ids:
  - tmp-cross-origin-storage
  - fetch
  - web-cryptography
  - permissions-policy
---

# Avoid redundant large asset downloads

Large shared assets such as AI model weights, Wasm modules, game engine cores, or fully-bundled JavaScript libraries are often identical across many unrelated sites. Without a shared cache, each origin downloads and stores its own copy, even when the visitor's browser already holds the exact same bytes from a different site. The Cross-Origin Storage (COS) API, exposed via `navigator.crossOriginStorage`, lets origins store and retrieve such files by content hash instead of by URL, so one on-device copy can serve every site that needs it.

## How to implement

1. **Compute the asset's hash when you build or publish your site.** Hash the exact bytes of the large asset you serve (for example, a model file, a Wasm binary, or a third-party library such as three.js) with `crypto.subtle.digest()`, and include the result as a lowercase hex string in your built code. The hash is what identifies the file in COS, and computing it on page load would require downloading the file first.
2. **Feature-detect before use, then fall back immediately if it's absent.** Check `navigator.crossOriginStorage?.requestFileHandle` once up front. If COS isn't implemented in this browser, skip straight to a normal network fetch.
3. **Once support is confirmed, still call every method defensively.** Wrap each COS call in `try`/`catch`. Even a fully implemented COS can legitimately reject a call, for example due to availability gating or a Permissions Policy restriction, so a passed feature-detection check does not guarantee success.
4. **Check COS before fetching from the network.** Call `requestFileHandle(hash)` first. If it resolves, read the file with `handle.getFile()` and skip the network entirely.
5. **Treat any rejection as a cache miss, not proof of absence.** The user agent may withhold a file's presence for privacy reasons even when it is physically stored, and a `NotFoundError` never distinguishes that case from a genuine miss. Fall back to a normal network fetch either way.
6. **Store what you fetch.** After a network fetch, request a writable handle with `{ create: true }`, write the complete file, and close the stream, so the next origin that asks for the same hash can skip the download.
7. **Choose the `origins` scope deliberately.** Pick it from the resource's real distribution, as described in the "Sharing scope" section.

## Example code

At build time, compute the hash once and inline it into your code:

```javascript
// build-hash.js (Node.js)
import { readFile } from 'node:fs/promises';

const bytes = await readFile('dist/assets/shared-library.js');
const digest = await crypto.subtle.digest('SHA-256', bytes);
const hex = Array.from(new Uint8Array(digest), (byte) =>
  byte.toString(16).padStart(2, '0'),
).join('');
```

At runtime, load every large shared asset through one reusable helper that looks the file up by that hash:

```javascript
/**
 * Loads a large shared asset from COS when available, otherwise from the
 * network, and stores network responses in COS for the next origin.
 * @param {string} url The asset's real, working network URL.
 * @param {{algorithm: string, value: string}} hash The build-time hash.
 * @param {'*' | string[]} [origins] Sharing scope; omit for same-site only.
 * @returns {Promise<Blob>}
 */
async function loadAsset(url, hash, origins) {
  // Feature-detect once, up front, and fall back to the network
  // immediately if COS isn't implemented in this browser.
  const supportsCOS = !!navigator.crossOriginStorage?.requestFileHandle;

  if (supportsCOS) {
    try {
      // Check COS first. If another origin already stored this exact
      // hash, this resolves with no network request at all.
      const handle = await navigator.crossOriginStorage.requestFileHandle(hash);
      return await handle.getFile();
    } catch (err) {
      // A NotFoundError does not prove the file is absent from COS. Fall
      // back to the network either way; never treat it as fatal.
    }
  }

  const response = await fetch(url);
  const fileBlob = await response.blob();

  if (supportsCOS) {
    // Write back to the cache.
    try {
      const handle = await navigator.crossOriginStorage.requestFileHandle(hash, {
        create: true,
        // Only pass `origins` when the caller chose a scope, so omitting it
        // keeps the same-site-only default.
        ...(origins && { origins }),
      });
      const writable = await handle.createWritable();
      await writable.write(fileBlob);
      await writable.close();
      // Never call getFile() on this handle before write()/close() has
      // resolved; use the blob already in hand instead.
    } catch {
      // Storing is a nice-to-have for future visitors, not required for
      // this page to work.
    }
  }

  return fileBlob;
}

const library = await loadAsset(
  '/assets/shared-library.js',
  {
    algorithm: 'SHA-256',
    // Example-only hash value; use the hex string from your build step.
    value: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
  },
  // MANDATORY: origins: '*' is only appropriate for genuinely popular,
  // non-proprietary resources.
  '*',
);
```

## Sharing scope

{{ FEATURE("tmp-cross-origin-storage", "sharing-scope") }}

## Best practices

- **DO** feature-detect `navigator.crossOriginStorage?.requestFileHandle` once, up front, and fall back to the network immediately when it's absent.
- **DO** still wrap every COS call in `try`/`catch` after a successful feature-detection check, since a fully implemented COS can still legitimately reject a call.
- **DO** treat any rejection as an ordinary cache miss and fall back to the network, never as definitive proof the file is absent.
- **DO** write the complete file with `createWritable()` / `write()` / `close()` (or `pipeTo()`) every time you store, even if the file might already exist in COS.
- **DO NOT** use an enumerated list of origins as a substitute for `origins: '*'`; lists have an implementation-defined maximum length precisely to prevent this.
- **DO NOT** call `getFile()` on a handle you just obtained via `create: true` until that handle's `write()`/`close()` has resolved.
- **DO NOT** treat `NotAllowedError` the same as `NotFoundError`; `NotAllowedError` means Permissions Policy blocks COS in this context, which is a distinct condition worth handling separately.
- **DO** use `Promise.all()` over individual `requestFileHandle()` calls when you need multiple distinct hashes concurrently, rather than a single batched call.

## Fallback strategy

{{ FEATURE("tmp-cross-origin-storage", "browser-support") }}

The COS API is a progressive enhancement over a normal network fetch. Guard every access to `navigator.crossOriginStorage` with a single up-front feature-detection check, and always keep a working network-fetch path as the fallback for browsers without COS support. Once support is confirmed, still call each method defensively with `try`/`catch`, since availability gating, GREASE'ing, and Permissions Policy can all cause a legitimate rejection even in a browser that implements COS.
