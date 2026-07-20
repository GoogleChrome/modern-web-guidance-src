# Permissions

## `permissions` vs `host_permissions`

These are separate manifest keys — don't conflate them:

```json
{
  "permissions": ["tabs", "scripting", "storage"],
  "host_permissions": ["https://api.example.com/*"]
}
```

- `permissions` grants access to chrome.* APIs (`tabs`, `storage`, `scripting`, `desktopCapture`, etc.)
- `host_permissions` grants access to specific origins for `fetch`, `chrome.scripting.executeScript`, and reading tab URLs cross-origin

Scope `host_permissions` to specific domains rather than `<all_urls>` unless the extension genuinely needs to run on every site — broad host permissions draw extra Chrome Web Store review scrutiny.

## `tab.url` requires the `tabs` permission

Without it, `tab.url` and `tab.title` silently return `undefined` — no error thrown.

```js
// manifest.json — REQUIRED if you read tab.url or tab.title anywhere:
{ "permissions": ["tabs"] }
```

See `references/extensions/tab-management.md` for the full tabs/windows API.

## `activeTab` only works on direct user gestures — not from side panels

`activeTab` grants temporary access to the current tab ONLY when triggered by:
- Clicking the extension action icon
- A context menu item (including the `"tab"` context)
- A keyboard shortcut from the `commands` API
- Accepting an omnibox suggestion

It does **NOT** grant access when clicking a button in a side panel, a popup button that opens
later, or any programmatic trigger.

```js
// ❌ BROKEN — activeTab does NOT work from a side panel button click
document.getElementById('summarize').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.body.innerText });
});

// ✅ FIX — use "tabs" permission + specific host_permissions instead
// manifest.json: { "permissions": ["tabs", "scripting"], "host_permissions": ["<all_urls>"] }
```

See `references/extensions/side-panel.md` for the side-panel-specific writeup.

## `chrome.permissions.request()` requires a user gesture — call it directly in the click handler

`chrome.permissions.request()` (for optional/dynamic permissions) only works when called
synchronously within a user gesture (a click, keypress, etc.). If a UI context (side panel,
popup) sends a message to the service worker and the service worker calls
`chrome.permissions.request()` in response, Chrome no longer sees a user gesture — the call
fails silently or rejects, because the gesture context is lost crossing the message-passing
boundary.

```js
// ❌ BROKEN — side panel forwards the request through the service worker,
// losing the user-gesture context
// side-panel.js
button.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'REQUEST_PERMISSION' });
});
// service-worker.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'REQUEST_PERMISSION') {
    chrome.permissions.request({ permissions: ['downloads'] }); // no user-gesture context here
  }
});

// ✅ CORRECT — call chrome.permissions.request() directly inside the click handler
// side-panel.js
button.addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ permissions: ['downloads'] });
  if (granted) {
    chrome.runtime.sendMessage({ type: 'PERMISSION_GRANTED' });
  }
});
```

**Rule of thumb:** any API that requires a user gesture (`chrome.permissions.request`,
`activeTab`) must be called directly in the event handler of the UI context that received the
click. Do not route it through the service worker first. If the service worker needs to know
the outcome, have the UI context call the API itself and then message the result (not the
request) to the service worker.

## Checking and removing permissions

```js
// Check whether an optional permission is currently granted
const hasIt = await chrome.permissions.contains({ permissions: ['downloads'] });

// Remove a previously granted optional permission
await chrome.permissions.remove({ permissions: ['downloads'] });
```

Declare optional permissions in the manifest so they're eligible to be requested at runtime:

```json
{ "optional_permissions": ["downloads"] }
```
