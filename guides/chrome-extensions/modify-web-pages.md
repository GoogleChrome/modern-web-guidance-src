---
name: modify-web-pages
description: Read and modify the content of web pages by injecting scripts and styles into browser tabs.
---

# Read and Modify Web Pages

Content scripts let extensions access and change the DOM of any web page. They run in an isolated world — sharing the page's DOM but not its JavaScript variables — so extension code never conflicts with page scripts.

## Manifest setup

```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],       // which pages to inject into
    "js": ["content/content.js"],
    "css": ["content/content.css"],
    "run_at": "document_idle"        // after DOM is ready (recommended default)
  }]
}
```

Use `"run_at": "document_start"` only when you must intercept very early page behavior. Use `"document_idle"` otherwise — it guarantees the DOM is ready.

## Inject programmatically on demand

Use `chrome.scripting.executeScript` when you need to inject in response to user action rather than on every page load. This requires the `"scripting"` permission plus either `"activeTab"` (for clicks on the extension icon) or `host_permissions`.

```js
// Inject a file
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  files: ['content/content.js']
});

// Inject a function with arguments (no file needed)
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (color) => { document.body.style.backgroundColor = color; },
  args: ['yellow']
});
```

MANDATORY: `activeTab` only grants access when triggered by a direct user gesture (extension icon click, context menu, keyboard shortcut). It does NOT work from side panel button clicks — use `"tabs"` + `host_permissions` instead for those cases.

## Batch DOM updates to avoid janking the page

MANDATORY: Never loop over hundreds of elements synchronously. Batch DOM writes with `requestAnimationFrame` and yield between batches:

```js
async function highlightElements(elements) {
  const BATCH_SIZE = 20; // process 20 elements per animation frame
  for (let i = 0; i < elements.length; i += BATCH_SIZE) {
    const batch = elements.slice(i, i + BATCH_SIZE);
    await new Promise(resolve => requestAnimationFrame(() => {
      batch.forEach(el => el.classList.add('myext-highlight'));
      resolve();
    }));
    // Yield to the main thread between batches so the page stays responsive
    if (typeof scheduler !== 'undefined' && scheduler.yield) {
      await scheduler.yield();
    }
  }
}
```

Namespace CSS class names (e.g., `myext-highlight`) to avoid conflicts with the page's own styles.

## Watch for dynamic content

For single-page applications or infinite-scroll pages that add content after load, use `MutationObserver`:

```js
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        processNewElement(node);
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
```

## Communicate between content script and service worker

Content scripts can exchange messages with the service worker and other extension pages.

```js
// content.js → service worker (request/response)
const result = await chrome.runtime.sendMessage({ type: 'FETCH_DATA', url: location.href });

// service worker → content script in a specific tab
await chrome.tabs.sendMessage(tabId, { type: 'HIGHLIGHT', selector: '.important' });

// content.js: listen and respond to messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONTENT') {
    const text = document.body.innerText;
    sendResponse({ text });
    return true; // keep channel open when using sendResponse
  }
});
```

MANDATORY: Return `true` from `onMessage` listener if you call `sendResponse` asynchronously — Chrome closes the channel immediately after the listener returns otherwise.

## Announce readiness before the service worker sends messages

Content scripts are injected after the page loads. If the service worker sends a message immediately, the content script may not be listening yet:

```js
// content.js — signal that it's ready
chrome.runtime.sendMessage({ type: 'CONTENT_READY' });

// service-worker.js — wait for the signal before sending
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'CONTENT_READY' && sender.tab) {
    chrome.tabs.sendMessage(sender.tab.id, { type: 'INIT' });
  }
});
```

## `run_at` timing reference

| Value | When it runs |
|-------|-------------|
| `document_start` | Before DOM is constructed |
| `document_idle` | After DOM is ready (default, recommended) |
| `document_end` | After DOM complete, before images/subframes |
