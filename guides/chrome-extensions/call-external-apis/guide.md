---
name: call-external-apis
description: Fetch data from external web services and APIs from any extension context.
web-feature-ids: []
---

# Call External APIs

Extensions can call external APIs using the standard `fetch()` API from any context: service worker, popup, side panel, or content scripts. Most modern APIs support CORS and work out of the box. For APIs that don't, declare `host_permissions` to bypass CORS restrictions.

## Determine if you need host_permissions

Test whether the API supports CORS before adding host_permissions. If the API returns `Access-Control-Allow-Origin: *` or your extension's origin, no host permissions are needed:

```bash
curl -H "Origin: https://example.com" -I https://api.example.com/endpoint
```

If the response includes `Access-Control-Allow-Origin`, the API supports CORS. If not, declare host permissions:

```json
{
  "host_permissions": ["https://api.example.com/*"]
}
```

DO NOT use `"<all_urls>"` just for API access — scope `host_permissions` to specific domains.

## Make API calls from extension contexts

`fetch()` works from service workers, popups, side panels, and content scripts:

```js
async function callAPI(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      console.error('Network error (offline or DNS failure):', err.message);
    } else {
      console.error('API error:', err.message);
    }
    return null;
  }
}

// Example usage with an API key
const data = await callAPI(
  `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${apiKey}`
);
```

Content scripts can also use `fetch()`, but they follow the web page's CORS rules rather than the extension's rules.

## Handle API keys safely

- Never hardcode API keys in published extension code — they are visible to anyone who inspects your extension package
- Store user-provided keys in `chrome.storage.local`
- For your own backend, authenticate via `chrome.identity` instead of embedding keys

```js
// Store a user-provided API key
async function saveApiKey(key) {
  await chrome.storage.local.set({ apiKey: key });
}

// Retrieve before making calls
async function callWithStoredKey(endpoint) {
  const { apiKey = '' } = await chrome.storage.local.get('apiKey');
  if (!apiKey) {
    showError('Please enter your API key in settings');
    return null;
  }
  return callAPI(`https://api.example.com${endpoint}?key=${apiKey}`);
}
```

## Service worker considerations

Fetch calls made from the service worker work normally, but remember the SW may terminate. For periodic polling, use `chrome.alarms` instead of `setInterval`:

```js
// ❌ BROKEN — interval dies with the SW
setInterval(() => fetchLatestData(), 60_000);

// ✅ CORRECT — alarm wakes the SW and triggers the fetch
chrome.alarms.create('fetch-data', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'fetch-data') {
    const data = await callAPI('https://api.example.com/latest');
    if (data) await chrome.storage.local.set({ latestData: data });
  }
});
```

## Fetch from content scripts

Content scripts can call APIs that support CORS without any extra permissions. For non-CORS APIs, have the content script send the request to the service worker instead:

```js
// content.js — ask service worker to make the call
const result = await chrome.runtime.sendMessage({
  type: 'FETCH',
  url: 'https://no-cors-api.example.com/data'
});

// service-worker.js — service worker has host_permissions, content script does not
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH') {
    fetch(msg.url)
      .then(r => r.json())
      .then(data => sendResponse({ data }))
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep channel open
  }
});
```
