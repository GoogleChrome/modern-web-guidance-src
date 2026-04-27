---
name: store-extension-data
description: Store and sync user settings and extension data that persists across browser sessions and service worker restarts.
web-feature-ids: []
---

# Store Extension Data

`chrome.storage` is the standard persistence layer for extensions. It works in all extension contexts (service worker, popup, side panel, content scripts) and survives service worker termination. Prefer it over `localStorage`, which doesn't work in service workers.

## Choose the right storage area

| Area | Persists across | Syncs | Quota | Use for |
|------|----------------|-------|-------|---------|
| `chrome.storage.local` | Browser restart | No | 10 MB | Most extension data |
| `chrome.storage.sync` | Browser restart | Yes, across devices | 100 KB total, 8 KB/item | User preferences, small settings |
| `chrome.storage.session` | SW restart (not browser restart) | No | 10 MB | Temporary state, tokens |

Permission required in manifest.json:
```json
{ "permissions": ["storage"] }
```

## Basic read and write

```js
// Write one or more values
await chrome.storage.local.set({ theme: 'dark', count: 42 });

// Read with defaults (use destructuring for clean access)
const { theme = 'light', count = 0 } = await chrome.storage.local.get(['theme', 'count']);

// Read a single key
const { apiKey = '' } = await chrome.storage.local.get('apiKey');

// Remove specific keys
await chrome.storage.local.remove('apiKey');
await chrome.storage.local.remove(['key1', 'key2']);

// Clear everything in this storage area
await chrome.storage.local.clear();
```

## Listen for changes across all contexts

`storage.onChanged` fires in every extension context (service worker, popup, side panel) when any value changes — no manual synchronization needed:

```js
chrome.storage.onChanged.addListener((changes, areaName) => {
  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(`${areaName}.${key}: ${oldValue} → ${newValue}`);
    if (key === 'theme') applyTheme(newValue);
  }
});
```

## Sync storage quotas

`chrome.storage.sync` imposes strict limits — violating them throws an error:
- `QUOTA_BYTES_PER_ITEM`: 8,192 bytes per key-value pair
- `QUOTA_BYTES`: 102,400 bytes total
- `MAX_ITEMS`: 512 keys
- `MAX_WRITE_OPERATIONS_PER_MINUTE`: 120

For large data, use `chrome.storage.local`. For sync, split large objects across multiple keys or compress values.

## Session storage for ephemeral state

`chrome.storage.session` survives service worker restarts (avoiding re-initialization overhead) but is cleared when the browser closes. Good for auth tokens, in-progress operation state, and caches:

```js
// Store recording state so it survives SW termination
await chrome.storage.session.set({ recordingState: 'recording' });
const { recordingState = 'idle' } = await chrome.storage.session.get('recordingState');
```

## Do not use localStorage in service workers

`localStorage` is unavailable in service workers and will throw a `ReferenceError`. In popup and other extension pages it technically works, but `chrome.storage` is preferred because it works everywhere and supports cross-context change events.
