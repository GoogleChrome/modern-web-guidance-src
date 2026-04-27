---
name: run-background-tasks
description: Run background tasks reliably using extension service workers that terminate after inactivity and restart on demand.
web-feature-ids: []
---

# Run Background Tasks

Extension service workers are ephemeral: Chrome terminates them after ~30 seconds of inactivity and restarts them when a new event arrives. This is fundamentally different from Manifest V2 background pages, which stayed alive permanently.

## MANDATORY: Never store state in global variables

Global variables are lost when the service worker terminates. Every event handler must read state from storage:

```js
// ❌ BROKEN — count is reset to 0 every time the SW restarts
let count = 0;
chrome.tabs.onUpdated.addListener(() => { count++; });

// ✅ CORRECT — read from and write to storage on every event
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const { count = 0 } = await chrome.storage.local.get('count');
  await chrome.storage.local.set({ count: count + 1 });
  await chrome.action.setBadgeText({ text: String(count + 1) });
});
```

## MANDATORY: Register all event listeners synchronously at top level

Chrome replays queued events to a restarted SW only for listeners registered synchronously at module top level. Async or conditional registration misses events:

```js
// ✅ CORRECT — top-level synchronous registration, conditions checked inside
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const { enabled } = await chrome.storage.local.get('enabled');
  if (!enabled) return;
  // process...
});

// ❌ BROKEN — listener registered after an await; SW may miss events on restart
async function setup() {
  const { enabled } = await chrome.storage.local.get('enabled');
  if (enabled) chrome.tabs.onUpdated.addListener(handleUpdate); // too late
}
setup();
```

## Use alarms instead of setTimeout/setInterval

Timers are destroyed when the SW terminates. Use `chrome.alarms` for periodic tasks — they persist and wake the SW when they fire:

```js
// ❌ BROKEN — timer dies with the SW
setInterval(() => checkForUpdates(), 60_000);

// ✅ CORRECT — alarm persists and wakes the SW
chrome.alarms.create('check-updates', { periodInMinutes: 1 }); // minimum: 0.5 minutes
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-updates') checkForUpdates();
});
```

Create alarms in `onInstalled` so they persist after extension updates:

```js
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('check-updates', { periodInMinutes: 30 });
});
```

## One-time initialization on install

Use `onInstalled` for setup that should run once — setting defaults, creating context menus, etc. Context menus are recreated idempotently because they persist across SW restarts:

```js
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ settings: { theme: 'light', enabled: true } });
  }
  // Re-create context menus (they persist but re-creating is safe)
  chrome.contextMenus.create({ id: 'myItem', title: 'My Item', contexts: ['selection'] });
});
```

## Keep the SW alive during long operations

When the SW must stay alive (e.g., while streaming a response), use an open port connection from the popup or side panel:

```js
// popup.js or sidepanel.js — open port keeps SW alive
const port = chrome.runtime.connect({ name: 'keepalive' });

// service-worker.js — port stays open while popup/panel is visible
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepalive') {
    port.onDisconnect.addListener(() => { /* cleanup if needed */ });
  }
});
```

Do not abuse keepalive — Chrome may enforce stricter limits. For audio or recording tasks, use `chrome.offscreen` instead.

## Storage tier selection for background state

| Need | Use |
|------|-----|
| Survives browser restart, syncs across devices | `chrome.storage.sync` |
| Survives browser restart, local only | `chrome.storage.local` |
| Survives SW restart, cleared on browser close | `chrome.storage.session` |
| Avoid — lost on SW termination | global variables |
