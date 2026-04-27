---
name: add-toolbar-popup
description: Add a quick-action popup that appears when users click the extension toolbar button.
web-feature-ids: []
---

# Add a Toolbar Popup

A popup is a small HTML page that appears when the user clicks the extension's toolbar icon. It closes automatically when the user clicks elsewhere. Use popups for quick actions, status displays, and settings — anything that takes only a few seconds to interact with.

## Manifest setup

MANDATORY: Using `chrome.action.*` APIs (setBadgeText, setIcon, onClicked) requires an `"action"` key in manifest.json. Without it, `chrome.action` is `undefined`.

```json
{
  "manifest_version": 3,
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "My Extension"  // tooltip on hover
  }
}
```

## Popup HTML

```html
<!-- popup/popup.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    /* Set popup size via CSS — default max is 800×600px */
    body { width: 320px; min-height: 200px; padding: 16px; font-family: system-ui; margin: 0; }
  </style>
</head>
<body>
  <h2>My Extension</h2>
  <div id="content"></div>
  <button id="action-btn">Do Something</button>
  <!-- No inline scripts — CSP blocks them -->
  <script src="popup.js"></script>
</body>
</html>
```

MANDATORY: All scripts must be external files. No `<script>alert()</script>` inline. No `onclick="..."` inline handlers. Use `addEventListener` instead.

## Popup JavaScript

```js
// popup/popup.js
document.addEventListener('DOMContentLoaded', async () => {
  // Restore saved state when popup opens
  const { savedValue = '' } = await chrome.storage.local.get('savedValue');
  document.getElementById('content').textContent = savedValue;
});

document.getElementById('action-btn').addEventListener('click', async () => {
  // Communicate with service worker
  const response = await chrome.runtime.sendMessage({ type: 'DO_ACTION' });
  document.getElementById('content').textContent = response.result;
});
```

## Persist state across popup open/close cycles

Popup state is lost when it closes. Use `chrome.storage` to persist anything important:

```js
const input = document.getElementById('search-input');

// Restore on open
document.addEventListener('DOMContentLoaded', async () => {
  const { lastSearch = '' } = await chrome.storage.local.get('lastSearch');
  input.value = lastSearch;
});

// Save on change
input.addEventListener('input', () => {
  chrome.storage.local.set({ lastSearch: input.value });
});
```

## Toggle between popup and action click

`chrome.action.onClicked` only fires when NO popup is set. Use this to open a side panel or run a script instead of showing a popup:

```js
// service-worker.js — remove default_popup from manifest to use this
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Or toggle dynamically:
chrome.action.setPopup({ popup: 'popup/popup.html' }); // show popup
chrome.action.setPopup({ popup: '' });                   // disable popup → enables onClicked
```

## Update the toolbar badge

Badges display a small text label on the extension icon — useful for counts or status.

```js
// service-worker.js
await chrome.action.setBadgeText({ text: '5' });
await chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
await chrome.action.setBadgeText({ text: '' }); // clear badge
```

MANDATORY: `"action": {}` must be present in manifest.json to use any `chrome.action.*` methods.
