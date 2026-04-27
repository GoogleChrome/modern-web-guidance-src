---
name: chrome-extension
description: >
  Build Chrome Extensions using Manifest V3 best practices. Use this skill whenever the user asks
  to create, modify, debug, or understand Chrome browser extensions, add-ons, or anything involving
  the Chrome Extensions API. Trigger on mentions of: 'Chrome extension', 'browser extension',
  'manifest.json', 'content script', 'service worker' (in browser context), 'popup' (in browser
  extension context), 'side panel', 'chrome.* API', 'background script', 'declarativeNetRequest',
  'chrome.identity', 'chrome.storage', 'DevTools panel', 'omnibox', 'context menu' (in extension
  context), or any request to build functionality that integrates with the Chrome browser UI.
  Also trigger when the user has an existing extension and wants to migrate from Manifest V2 to V3,
  fix a service worker lifetime issue, debug CSP errors, or add a new capability to their extension.
---

# Chrome Extension Skill

Build production-quality Chrome extensions using Manifest V3. Apply EVERY rule below to EVERY extension.

## Mandatory Rules

These address the most common causes of broken extensions. Violating any produces a non-functional build.

### 1. Icons: only reference files you create — or omit icons entirely

```
❌ BROKEN — referencing files that don't exist or reusing one file for all sizes:
   "icons": { "16": "icon.png", "48": "icon.png", "128": "icon.png" }

✅ CORRECT — each size is a separate file at the correct pixel dimensions:
   "icons": { "16": "icons/icon-16.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
   (where icon-16.png is 16×16px, icon-48.png is 48×48px, icon-128.png is 128×128px)

✅ ALSO CORRECT — omit icons from manifest if you cannot generate real PNG files:
   (just remove the "icons" and "default_icon" fields — Chrome uses a default icon)
```

**If you include icon references, you MUST create the actual image files.** Generate them with a script (see "Generating Extension Icons" below) or leave them out. Never reference non-existent files.

### 2. Side panel: you MUST provide a way to open it

Defining `"side_panel": {"default_path": "..."}` does NOT make it openable. Use `chrome.action.onClicked` + `sidePanel.open()`, or `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`. See the Side Panel reference below for all trigger options. If the extension has both a popup AND side panel, add a button in the popup that calls `chrome.sidePanel.open()`.

### 3. Code execution: sandboxed iframes ONLY

Extension CSP blocks `eval()`, `new Function()`, inline `<script>` in all extension pages. You CANNOT relax this. Two critical errors to avoid:

```js
// ❌ BROKEN — direct iframe DOM access throws SecurityError
iframe.contentDocument.write(html);
// Error: Blocked a frame with origin "chrome-extension://..." from accessing a cross-origin frame

// ❌ BROKEN — eval in extension page
eval(userCode); // CSP blocks this
```

Use sandbox + `postMessage`, blob URLs, or `srcdoc` instead. See "CSP & Sandboxed Code Execution" below for full examples.

### 4. `tab.url` requires the `tabs` permission

Without it, `tab.url` silently returns `undefined` — no error thrown.

```js
// manifest.json — REQUIRED if you read tab.url or tab.title anywhere:
{ "permissions": ["tabs"] }
```

### 5. Always use async/await — never `.then()` chains

```js
// ❌ BAD
chrome.tabs.query({active: true, currentWindow: true}).then(tabs => {
  chrome.scripting.executeScript({target: {tabId: tabs[0].id}, files: ['content.js']}).then(() => {});
});

// ✅ GOOD
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
```

For `runtime.onMessage` listeners that do async work:

```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const data = await chrome.storage.local.get('key');
    sendResponse({ data });
  })();
  return true; // keeps channel open
});
```

### 6. Content scripts: don't block the main thread

When modifying many DOM elements, batch with `requestAnimationFrame` and yield between batches with `scheduler.yield()`. See "Content Scripts & DOM Manipulation" below for the full batching pattern.

### 7. Service workers are ephemeral — never store state in variables

```js
// ❌ BROKEN — state lost when SW terminates (~30s of inactivity)
let count = 0;
chrome.tabs.onUpdated.addListener(() => { count++; });

// ✅ CORRECT — persist in chrome.storage, read on every event
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const { count = 0 } = await chrome.storage.local.get('count');
  await chrome.storage.local.set({ count: count + 1 });
  await chrome.action.setBadgeText({ text: String(count + 1) });
});
```

Use `chrome.alarms` instead of `setTimeout`/`setInterval`.

### 8. chrome.identity: extension ID differs between dev and production

The OAuth `client_id` is tied to a specific extension ID which changes between unpacked development and the Chrome Web Store. Stabilize it by adding a `"key"` field to manifest.json (pack once → extract key from .crx → add to manifest). See "Authentication with chrome.identity" below for full steps. Always remind users to update the OAuth client after publishing.

### 9. Context menus: show user feedback after action

When a context menu item performs an action (save, copy, etc.), confirm it to the user. Use a notification, badge flash, or injected toast — don't let actions happen silently.

```js
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // ... perform action ...
  // Show confirmation via injected toast
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (msg) => {
      const toast = document.createElement('div');
      toast.textContent = msg;
      Object.assign(toast.style, {
        position: 'fixed', bottom: '20px', right: '20px', padding: '12px 24px',
        background: '#333', color: '#fff', borderRadius: '8px', zIndex: '999999',
        fontSize: '14px', transition: 'opacity 0.3s'
      });
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
    },
    args: ['Saved to Reading List ✓']
  });
});
```

### 10. `chrome.action` API requires `action` in manifest

Using `chrome.action.setBadgeText`, `chrome.action.setIcon`, or `chrome.action.onClicked` requires
an `"action"` key in manifest.json — even if it's empty. Without it, `chrome.action` is `undefined`.

```js
// ❌ BROKEN — manifest has no "action" key
await chrome.action.setBadgeText({ text: '5' });
// TypeError: Cannot read properties of undefined (reading 'setBadgeText')

// ✅ FIX — add "action" to manifest.json (at minimum an empty object)
// manifest.json:
{ "action": {} }
// or with a popup:
{ "action": { "default_popup": "popup/popup.html" } }
```

### 11. `activeTab` only works on direct user gestures — not from side panels

`activeTab` grants temporary access to the current tab ONLY when triggered by:
- Clicking the extension action icon
- A context menu item
- A keyboard shortcut from the `commands` API
- Accepting an omnibox suggestion

It does **NOT** grant access when clicking a button in a side panel, popup button that opens later,
or any programmatic trigger.

```js
// ❌ BROKEN — activeTab does NOT work from a side panel button click
// manifest.json: { "permissions": ["activeTab", "scripting"] }
// sidepanel.js:
document.getElementById('summarize').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // This FAILS — activeTab was not activated by this button click
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.body.innerText });
});

// ✅ FIX — use "tabs" permission + specific host_permissions instead
// manifest.json: { "permissions": ["tabs", "scripting"], "host_permissions": ["<all_urls>"] }
```

If the extension needs to read/modify page content from a side panel or on tab change, use `tabs` + `host_permissions` instead of `activeTab`.

### 12. DevTools panel URLs are relative to the extension root

When creating a DevTools panel, the panel HTML path is relative to the **extension root**, NOT
relative to the devtools page that calls `chrome.devtools.panels.create()`.

```js
// ❌ BROKEN — path relative to devtools/ directory
// File at: devtools/devtools.js
chrome.devtools.panels.create("My Panel", "", "panel/panel.html");
// Chrome looks for <ext-root>/panel/panel.html — NOT <ext-root>/devtools/panel/panel.html

// ✅ CORRECT — full path from extension root
chrome.devtools.panels.create("My Panel", "", "devtools/panel/panel.html");
```

File structure this assumes:
```
my-extension/
├── manifest.json
├── devtools/
│   ├── devtools.html     ← manifest "devtools_page" points here
│   ├── devtools.js
│   └── panel/
│       ├── panel.html    ← create() path: "devtools/panel/panel.html"
│       └── panel.js
```

### 13. Offscreen documents have NO access to most chrome.* APIs

Offscreen documents (`chrome.offscreen`) run in a DOM context for tasks like audio playback,
media recording, or DOM parsing — but they are **severely restricted**. Most `chrome.*` APIs
are unavailable, including `chrome.downloads`, `chrome.tabs`, `chrome.action`, and others.

```js
// ❌ BROKEN — chrome.downloads is undefined in offscreen documents
// offscreen.js:
const url = URL.createObjectURL(blob);
chrome.downloads.download({ url, filename: 'recording.webm' }); // TypeError: Cannot read properties of undefined

// ❌ BROKEN — chrome.action is undefined in offscreen documents
chrome.action.setBadgeText({ text: 'REC' }); // TypeError

// ✅ CORRECT — send data back to the service worker, let IT call chrome.downloads
// offscreen.js:
const blob = new Blob(chunks, { type: 'video/webm' });
const reader = new FileReader();
reader.onload = () => {
  chrome.runtime.sendMessage({
    type: 'DOWNLOAD_RECORDING',
    dataUrl: reader.result,
    filename: 'recording.webm'
  });
};
reader.readAsDataURL(blob);

// service-worker.js:
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_RECORDING') {
    chrome.downloads.download({
      url: message.dataUrl,
      filename: message.filename
    });
  }
});
```

**The only APIs available in offscreen documents are:**
- `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` (for communicating with the service worker)
- `chrome.runtime.getURL`
- Standard Web APIs (DOM, fetch, MediaRecorder, Canvas, Web Audio, etc.)

**Rule of thumb:** Offscreen documents do the Web API work (recording, parsing, audio).
The service worker does all chrome.* API work (downloads, badge updates, notifications).
Always use `chrome.runtime.sendMessage` to bridge between them.

### 14. Notifications and badge icons must reference real image files

`chrome.notifications.create()` requires a valid `iconUrl` pointing to an actual image file
in your extension. If the file doesn't exist or the path is wrong, the call fails with
`"Unable to download all specified images."`

```js
// ❌ BROKEN — icon file doesn't exist
chrome.notifications.create('reminder', {
  type: 'basic',
  iconUrl: 'icons/icon-128.png', // File not in extension!
  title: 'Reminder',
  message: 'Time is up!'
});
// Error: "Unable to download all specified images."

// ✅ OPTION A — use a real icon file that you generated
chrome.notifications.create('reminder', {
  type: 'basic',
  iconUrl: 'icons/icon-128.png', // File exists and is a valid 128×128 PNG
  title: 'Reminder',
  message: 'Time is up!'
});

// ✅ OPTION B — generate a data URL at runtime (no file needed)
function getIconDataUrl() {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4688F1';
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 120, 24);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', 64, 64);
  return canvas.convertToBlob().then(blob => {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  });
}

// Usage in service worker:
const iconUrl = await getIconDataUrl();
chrome.notifications.create('reminder', {
  type: 'basic',
  iconUrl,
  title: 'Reminder',
  message: 'Time is up!'
});
```

This applies to ALL image references in chrome.* APIs — notifications, `chrome.action.setIcon`,
context menu icons, etc. **If you reference a file, it must exist.**

### 15. Tab capture: guard against double-start with state locking

`chrome.tabCapture.getMediaStreamId()` fails with `"Cannot capture a tab with an active stream"`
if called while a previous capture is still active. Fast double-clicks on the extension icon
easily trigger this. Use explicit state locking:

```js
// ❌ BROKEN — no guard against rapid clicks
let isRecording = false;
chrome.action.onClicked.addListener(async (tab) => {
  if (isRecording) {
    stopRecording();
    isRecording = false;
  } else {
    isRecording = true;
    startRecording(tab); // Second click during startup = "active stream" error
  }
});

// ✅ CORRECT — use transitional states to lock out concurrent operations
// State machine: 'idle' → 'starting' → 'recording' → 'stopping' → 'idle'
// Store state in chrome.storage.session (survives SW restart, cleared on browser close)

chrome.action.onClicked.addListener(async (tab) => {
  const { recordingState = 'idle' } = await chrome.storage.session.get('recordingState');

  // Ignore clicks during transitions
  if (recordingState === 'starting' || recordingState === 'stopping') return;

  if (recordingState === 'idle') {
    await chrome.storage.session.set({ recordingState: 'starting' });
    try {
      await startRecording(tab);
      await chrome.storage.session.set({ recordingState: 'recording' });
      await chrome.action.setBadgeText({ text: 'REC' });
      await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    } catch (err) {
      console.error('Failed to start recording:', err);
      await chrome.storage.session.set({ recordingState: 'idle' });
    }
  } else if (recordingState === 'recording') {
    await chrome.storage.session.set({ recordingState: 'stopping' });
    try {
      await stopRecording();
    } finally {
      await chrome.storage.session.set({ recordingState: 'idle' });
      await chrome.action.setBadgeText({ text: '' });
    }
  }
});
```

This pattern applies to any chrome API that manages exclusive resources:
`chrome.tabCapture`, `chrome.desktopCapture`, `chrome.offscreen.createDocument` (only one
offscreen document allowed at a time).

### 16. `chrome.desktopCapture` requires a target tab with URL access

When calling `chrome.desktopCapture.chooseDesktopMedia()` from a service worker, you must pass
the active tab as the `targetTab` parameter. The tab object must have its `url` field populated,
which requires the `"tabs"` permission.

```js
// ❌ BROKEN — called without targetTab from service worker
chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'], (streamId) => { ... });
// Error: "A target tab is required when called from a service worker context."

// ❌ BROKEN — tab doesn't have url field (missing "tabs" permission)
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'], tab, (streamId) => { ... });
// Error: "targetTab doesn't have URL field set."

// ✅ CORRECT — "tabs" permission in manifest + pass tab object
// manifest.json: { "permissions": ["tabs", "desktopCapture"] }
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'], tab, (streamId) => {
  if (!streamId) return; // User cancelled
  // Send streamId to offscreen document for getUserMedia
});
```

**Note:** For modern tab recording, prefer `chrome.tabCapture.getMediaStreamId()` when you
only need the current tab's audio/video. Use `chrome.desktopCapture` only when the user
should choose which screen/window to capture.

### 17. `chrome.windows` has NO `.query()` method — use `getAll`, `getLastFocused`, or `getCurrent`

Unlike `chrome.tabs.query()`, the `chrome.windows` API does NOT have a `.query()` method.
This is a common confusion because `tabs.query()` is used so frequently.

```js
// ❌ BROKEN — chrome.windows.query does not exist
const windows = await chrome.windows.query({ focused: true });
// TypeError: chrome.windows.query is not a function

// ✅ CORRECT — use the right method for your need
const focused = await chrome.windows.getLastFocused({ populate: true }); // single window
const current = await chrome.windows.getCurrent({ populate: true });     // window running this code
const all = await chrome.windows.getAll({ populate: true });             // all windows

// To get the focused/active window with its tabs:
const win = await chrome.windows.getLastFocused({ populate: true });
const tabs = win.tabs; // array of Tab objects
```

**`chrome.windows` methods summary:**
- `getAll({ populate })` — all open windows (populate: true includes tabs)
- `getLastFocused({ populate })` — most recently focused window
- `getCurrent({ populate })` — window running the calling code
- `get(windowId, { populate })` — specific window by ID
- `create()`, `update()`, `remove()` — modify windows

### 18. `sidePanel.setPanelBehavior`: the property is `openPanelOnActionClick` — no "Icon"

```js
// ❌ BROKEN — "Icon" is not part of the property name; causes synchronous TypeError that aborts the SW
chrome.sidePanel.setPanelBehavior({ openPanelOnActionIconClick: true });
// TypeError: Unexpected property: 'openPanelOnActionIconClick'

// ✅ CORRECT
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

## Always Manifest V3

Never generate Manifest V2 code.
- `background.service_worker` not `background.scripts`
- `chrome.action` not `chrome.browserAction`
- `chrome.scripting.executeScript` not `chrome.tabs.executeScript`
- `host_permissions` is separate from `permissions`
- No inline scripts in HTML — use `<script src="file.js">`
- No inline event handlers — use `addEventListener`

## Output Checklist

Verify EVERY item before delivering:

- [ ] `manifest_version: 3` — no V2 APIs anywhere
- [ ] All icon files referenced in manifest exist as real files with correct dimensions — or icons are omitted
- [ ] Side panel has an explicit open trigger (not just a manifest declaration)
- [ ] Code execution uses sandbox/blob/srcdoc — no `eval()` in extension pages
- [ ] `tabs` permission declared if `tab.url` or `tab.title` is accessed
- [ ] All code uses `async`/`await` — no `.then()` chains
- [ ] Content scripts batch DOM updates with `requestAnimationFrame`
- [ ] Service worker stores NO state in global variables — uses `chrome.storage`
- [ ] No inline scripts or event handlers in HTML
- [ ] Context menu actions show user confirmation
- [ ] `"action": {}` (or more) present in manifest if using `chrome.action.*` APIs
- [ ] If reading/scripting tabs from a side panel: use `tabs` + `host_permissions` (NOT `activeTab`)
- [ ] DevTools panel paths in `chrome.devtools.panels.create()` are relative to extension root
- [ ] Offscreen documents use ONLY `chrome.runtime` messaging — no `chrome.downloads`, `chrome.action`, etc.
- [ ] All image refs in `chrome.notifications`, `chrome.action.setIcon`, etc. point to real files (or use data URLs)
- [ ] Tab/desktop capture uses state locking to prevent double-start errors
- [ ] `chrome.desktopCapture.chooseDesktopMedia` passes `targetTab` with `tabs` permission
- [ ] `chrome.windows` calls use `getAll`/`getLastFocused`/`getCurrent` — NOT `.query()` (it doesn't exist)
- [ ] `sidePanel.setPanelBehavior` uses `openPanelOnActionClick` — NOT `openPanelOnActionIconClick`
- [ ] Error handling on all async operations
- [ ] `host_permissions` scoped to specific domains (not `<all_urls>` unless needed)
- [ ] `return true` in `onMessage` listeners with async responses
