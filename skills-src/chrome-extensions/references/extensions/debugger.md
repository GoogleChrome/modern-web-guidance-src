# Chrome Debugger API (`chrome.debugger`)

The `chrome.debugger` API attaches a Chrome DevTools Protocol (CDP) session to one or more tabs,
allowing extensions to call CDP domains (`Page`, `Runtime`, `Network`, `DOM`, etc.) directly.

**Use `chrome.debugger` when:** you need CDP capabilities that have no dedicated extension API
(such as full-page screenshots beyond the viewport via `Page.captureScreenshot` or protocol-level
network/DOM inspection).  
**Use `chrome.tabs.captureVisibleTab()` with `"activeTab"` when:** you only need a screenshot of the
visible viewport.

## Permissions

```json
{ "permissions": ["debugger"] }
```

`"debugger"` triggers an install-time warning that the extension can read and change all data on all
websites, and displays a `"<Extension> started debugging this browser"` infobar while attached
(which closes 5 seconds after detach).

## Attaching, Sending Commands, and Detaching

Always wrap `chrome.debugger` sessions in a `try ... finally` block so the debugger detaches on
every code path, and race `sendCommand` against a timeout (`Promise.race`) because CDP commands can
hang indefinitely if a target tab's renderer is frozen or discarded:

```js
await chrome.debugger.attach({ tabId }, '1.3');
try {
  const { cssContentSize } = await chrome.debugger.sendCommand({ tabId }, 'Page.getLayoutMetrics');
} finally {
  await chrome.debugger.detach({ tabId }).catch(() => {});
}
```

Common `chrome.debugger.attach({ tabId })` errors:
- `"Another debugger is already attached to the tab with id: <tabId>."`: This same extension still
  holds an active `chrome.debugger` session on `tabId` from an earlier call that missed `detach`.
  External CDP test harnesses and open DevTools windows do not trigger this error.
- `"Cannot attach to this target."` / `"Cannot access a chrome:// URL"`: The tab is showing a
  security interstitial (such as an HTTPS certificate error page) or is on a restricted origin
  (`chrome://`, another extension's `chrome-extension://` page, or the Chrome Web Store).

## Full-Page Screenshot Capture

To capture a full page beyond the visible viewport with `Page.captureScreenshot`:

1. **Activate the tab before capturing**: `Page.captureScreenshot` hangs indefinitely if the target
   tab is in the background and not actively rendering frames. Call
   `await chrome.tabs.update(tabId, { active: true })` before capturing, and wrap `sendCommand` in
   a timeout.
2. **Read CSS dimensions from `Page.getLayoutMetrics`**: Use `Math.max(1, cssContentSize.width)` and
   `Math.max(1, cssContentSize.height)` from `Page.getLayoutMetrics` (`Page.captureScreenshot`
   rejects `0` width or height). Do not read `window.devicePixelRatio` from the page's main world or
   use deprecated `contentSize`.
3. **Capture in vertical `clip` slices (`<= 8,192` device px tall)**: Never call
   `Page.captureScreenshot({ captureBeyondViewport: true })` unclipped on a full page. Unclipped
   captures silently repeat or corrupt pixels past the GPU maximum texture height (`16,384` device
   px on D3D11/Metal, `8,192` device px on software/older drivers) with no error, and throw
   `"Page is too large."` at `131,072` CSS px. Pass `captureBeyondViewport: true` with a vertical
   `clip: { x: 0, y, width, height, scale: 1 }` band, starting with a `2,048` CSS px slice height
   (safe up to `4x` display scaling), deriving the actual scale factor in the service worker from
   the first decoded PNG (`bitmap.width / width`), and capping subsequent slices at
   `Math.max(1, Math.floor(8192 / scale))` CSS px.
4. **Stitch slices on an `OffscreenCanvas` using exact decoded heights**: Decode each base64 PNG
   slice with `createImageBitmap()` (calling `bitmap.close()` after drawing) and sum the exact
   `bitmap.height` values before creating the `OffscreenCanvas` so fractional display scaling
   (`125%`, `150%`) never clips or leaves blank rows. Verify the final canvas stays within
   `OffscreenCanvas` limits (`<= 65,535` px per side and `<= 268,435,456` total pixels).
