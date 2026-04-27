---
name: add-context-menu
description: Add custom items to the browser right-click context menu that act on selected text, links, images, or the current page.
---

# Add Context Menu Actions

Context menus let extensions add items to the browser's right-click menu. Items can target selected text, links, images, the page, or specific element types. Context menus persist across service worker restarts but must be re-created in `onInstalled` (re-creation is idempotent).

## Manifest setup

```json
{ "permissions": ["contextMenus"] }
```

## Create menu items on install

```js
// service-worker.js
chrome.runtime.onInstalled.addListener(() => {
  // Show only when user right-clicks a link
  chrome.contextMenus.create({
    id: 'save-link',
    title: 'Save to Reading List',
    contexts: ['link']
  });

  // %s in title is replaced with the selected text
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate "%s"',
    contexts: ['selection']
  });

  // Show on any right-click within a page
  chrome.contextMenus.create({
    id: 'open-panel',
    title: 'Open My Extension Panel',
    contexts: ['page']
  });
});
```

## Handle clicks

```js
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'save-link':
      await saveLink(info.linkUrl);
      break;
    case 'translate-selection':
      await translateText(info.selectionText, tab.id);
      break;
    case 'open-panel':
      await chrome.sidePanel.open({ windowId: tab.windowId });
      break;
  }
});
```

## MANDATORY: Show user feedback after actions

When a context menu action performs an operation (save, copy, analyze), confirm it visually. Silent actions confuse users. Inject a brief toast notification into the page:

```js
async function showToast(tabId, message) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (msg) => {
      const toast = document.createElement('div');
      toast.textContent = msg;
      Object.assign(toast.style, {
        position: 'fixed', bottom: '20px', right: '20px', padding: '12px 24px',
        background: '#333', color: '#fff', borderRadius: '8px', zIndex: '999999',
        fontSize: '14px', fontFamily: 'system-ui', boxShadow: '0 2px 8px rgba(0,0,0,.3)'
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    },
    args: [message]
  });
}

// Usage in click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-link') {
    await saveLink(info.linkUrl);
    await showToast(tab.id, 'Link saved to Reading List ✓');
  }
});
```

## Submenus

```js
chrome.contextMenus.create({ id: 'parent', title: 'My Extension', contexts: ['selection'] });
chrome.contextMenus.create({ id: 'translate-en', parentId: 'parent', title: 'Translate to English', contexts: ['selection'] });
chrome.contextMenus.create({ id: 'translate-es', parentId: 'parent', title: 'Translate to Spanish', contexts: ['selection'] });
```

## Update or remove items

```js
chrome.contextMenus.update('save-link', { title: 'Saved! ✓', enabled: false });
chrome.contextMenus.remove('save-link');
chrome.contextMenus.removeAll(); // remove all items for this extension
```

## Available context types

`all`, `page`, `frame`, `selection`, `link`, `editable`, `image`, `video`, `audio`, `action`

## Info object properties

| Property | Available when context is |
|----------|--------------------------|
| `info.selectionText` | `selection` |
| `info.linkUrl` | `link` |
| `info.srcUrl` | `image`, `video`, `audio` |
| `info.pageUrl` | Always (requires `tabs` permission for full URL) |
| `info.frameUrl` | `frame` |
