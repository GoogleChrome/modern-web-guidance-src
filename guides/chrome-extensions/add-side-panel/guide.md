---
name: add-side-panel
description: Add a persistent side panel that stays open while users browse, enabling extended interactions alongside the web page.
web-feature-ids: []
---

# Add a Persistent Side Panel

The Side Panel API lets extensions show a persistent panel to the right of the web page. Unlike a popup, the side panel stays open when the user clicks away and is resizable. Use it for features that require sustained interaction: reading assistants, note-taking, research tools, etc.

## Manifest setup

```json
{
  "manifest_version": 3,
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"  // path to your panel HTML
  },
  "action": {},  // required to use chrome.action.onClicked
  "background": { "service_worker": "service-worker.js" }
}
```

## MANDATORY: Provide an explicit open trigger

Declaring `side_panel` in the manifest does NOT make it openable. You must add one of these triggers:

```js
// service-worker.js

// Option A: Open when the user clicks the extension icon (most common)
// Remove "default_popup" from "action" if you use this approach
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Option B: Auto-open on action click (simplest — do NOT also set default_popup)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
// ⚠️ The property is openPanelOnActionClick — NOT openPanelOnActionIconClick
// Using the wrong name causes a TypeError that silently aborts the service worker

// Option C: Open from a context menu item
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'open-panel') {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
```

## Side panel HTML

Side panel pages follow standard extension CSP rules: no inline scripts, no `eval()`.

```html
<!-- sidepanel/sidepanel.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui; padding: 16px; }
  </style>
</head>
<body>
  <h2>My Panel</h2>
  <div id="content"></div>
  <script src="sidepanel.js"></script>
</body>
</html>
```

## Read or modify the active tab from the side panel

MANDATORY: `activeTab` does NOT work from side panel button clicks. Side panel interactions are not "direct user gestures" that activate `activeTab`. Use `"tabs"` + `host_permissions` instead:

```json
{
  "permissions": ["tabs", "scripting", "sidePanel"],
  "host_permissions": ["<all_urls>"]
}
```

```js
// sidepanel.js — get page content via scripting API
document.getElementById('summarize').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText.substring(0, 4000)
  });
  document.getElementById('content').textContent = result;
});
```

## Show different panel content per tab

```js
// service-worker.js
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  if (tab.url.includes('github.com')) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel/github-panel.html',
      enabled: true
    });
  } else {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
  }
});
```

## Communicate with the service worker

The side panel is a full extension page with access to all `chrome.*` APIs.

```js
// sidepanel.js → service worker
const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

// Keep service worker alive while panel is open (prevents 30s termination)
const port = chrome.runtime.connect({ name: 'sidepanel-keepalive' });
```

## Side panel vs popup

| Feature | Side Panel | Popup |
|---------|-----------|-------|
| Stays open | Yes | Closes on click-away |
| Resizable | Yes (by user) | Fixed size |
| Runs alongside page | Yes | Overlays page |
| Best for | Extended interaction | Quick one-off actions |
