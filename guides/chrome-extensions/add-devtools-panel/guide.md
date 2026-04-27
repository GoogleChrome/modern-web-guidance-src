---
name: add-devtools-panel
description: Add a custom panel to Chrome DevTools for inspecting application state, monitoring network activity, or debugging page behavior.
web-feature-ids: []
---

# Add a Custom DevTools Panel

Extensions can add panels to Chrome DevTools using a DevTools page — a hidden background page that exists only while DevTools is open. The DevTools page registers panels; the panels themselves are normal extension pages with access to DevTools-specific APIs.

## Manifest setup

```json
{
  "devtools_page": "devtools/devtools.html"
}
```

No `"permissions"` entry is needed — DevTools API access is implicit.

## DevTools page

The DevTools page is invisible; its sole job is to create panels:

```html
<!-- devtools/devtools.html -->
<!DOCTYPE html>
<html><body>
  <script src="devtools.js"></script>
</body></html>
```

```js
// devtools/devtools.js
chrome.devtools.panels.create(
  'My Panel',                     // tab title in DevTools
  '',                             // icon path (empty string = no icon)
  'devtools/panel/panel.html',    // ⚠️ RELATIVE TO EXTENSION ROOT — see note below
  (panel) => {
    panel.onShown.addListener((panelWindow) => { /* panel became visible */ });
    panel.onHidden.addListener(() => { /* panel hidden */ });
  }
);
```

MANDATORY: The panel HTML path is relative to the **extension root**, NOT relative to `devtools.js`. If your file is at `devtools/devtools.js` and the panel at `devtools/panel/panel.html`, the correct path is `"devtools/panel/panel.html"` — not `"panel/panel.html"`.

## Panel content

The panel HTML is a standard extension page:

```html
<!-- devtools/panel/panel.html -->
<!DOCTYPE html>
<html>
<head>
  <style> body { font-family: system-ui; padding: 16px; } </style>
</head>
<body>
  <div id="output"></div>
  <script src="panel.js"></script>
</body>
</html>
```

## Access DevTools APIs

`chrome.devtools.*` APIs are only available in the DevTools page and panel contexts — not in the service worker:

```js
// devtools/panel/panel.js

// Get the tab ID of the page being inspected
const tabId = chrome.devtools.inspectedWindow.tabId;

// Run JavaScript in the inspected page (like typing in the Console)
chrome.devtools.inspectedWindow.eval('document.title', (result, isException) => {
  if (!isException) document.getElementById('output').textContent = result;
});

// Monitor network requests as they complete
chrome.devtools.network.onRequestFinished.addListener((request) => {
  console.log(request.request.url, request.response.status);
});

// Get all captured requests (HAR format)
chrome.devtools.network.getHAR((harLog) => {
  harLog.entries.forEach(entry => processEntry(entry));
});
```

## Communicate with the service worker

Use a port connection for bidirectional messaging between the panel and service worker:

```js
// devtools/panel/panel.js — open a port to the service worker
const port = chrome.runtime.connect({ name: 'devtools-panel' });
port.postMessage({ type: 'INIT', tabId: chrome.devtools.inspectedWindow.tabId });
port.onMessage.addListener((msg) => {
  document.getElementById('output').textContent = JSON.stringify(msg, null, 2);
});

// service-worker.js — receive panel connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'devtools-panel') return;
  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'INIT') {
      const data = await fetchSomeData(msg.tabId);
      port.postMessage({ type: 'DATA', data });
    }
  });
});
```

## File structure

```
my-extension/
├── manifest.json
└── devtools/
    ├── devtools.html       ← "devtools_page" in manifest
    ├── devtools.js
    └── panel/
        ├── panel.html      ← path in create(): "devtools/panel/panel.html"
        └── panel.js
```

## Key constraints

- DevTools pages are destroyed when DevTools closes; they do not persist
- One DevTools page instance exists per inspected tab
- `chrome.devtools.*` APIs are unavailable in the service worker — use messaging to bridge
