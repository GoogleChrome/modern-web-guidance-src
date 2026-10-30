# Full-Page Screenshot Capture via `chrome.debugger`

Capturing a full-page screenshot beyond the visible viewport with `chrome.debugger` and CDP
`Page.captureScreenshot` requires handling three runtime hazards:
1. **Silent pixel corruption** when an unclipped capture exceeds the GPU maximum texture height
   (16,384 device px on Windows D3D11 and most macOS Metal hardware; 8,192 px on software or older
   drivers), plus a hard `Page is too large.` rejection at 131,072 CSS px.
2. **Indefinite hangs** (`Page.captureScreenshot` has no built-in timeout) when the target tab's
   renderer is frozen or discarded.
3. **Leaked debugger locks** (`"Another debugger is already attached to the tab"`) if
   `chrome.debugger.detach({ tabId })` is not called in a `finally` block.

## Permissions

```json
{ "permissions": ["debugger"] }
```

`"debugger"` triggers an install-time warning that the extension can read and change all data on all
websites, and shows a `"<Extension> started debugging this browser"` infobar (which closes 5 seconds
after detach). If you only need the visible viewport (or can scroll-and-stitch from a content
script), use `chrome.tabs.captureVisibleTab()` with `"activeTab"` instead.

## Avoid Unclipped `captureBeyondViewport` Calls

```js
// ❌ BROKEN: silently repeats/corrupts pixels past the GPU max texture size (8,192px or 16,384px),
// throws "Page is too large." at 131,072 CSS px, has no timeout, and never detaches the debugger.
await chrome.debugger.attach({ tabId }, '1.3');
const { data } = await chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
});
```

## Canonical Pattern: Activate, Slice with `clip`, Timeout, Stitch, and Detach

Passing a `clip` rectangle whose physical height stays within the GPU maximum texture limit
(`<= 8,192` device px) avoids GPU texture clamping and bypasses the 131,072 CSS px whole-page cap
at any page depth. Keep `captureBeyondViewport: true` on each slice so bands outside the visible
viewport render properly.

```js
function sendCommandWithTimeout(target, method, params, timeoutMs = 10000) {
  let timer;
  return Promise.race([
    chrome.debugger.sendCommand(target, method, params),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${method} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function captureFullPage(tabId) {
  // 1. Ensure the tab is active and rendering frames before attaching.
  await chrome.tabs.update(tabId, { active: true });
  await chrome.debugger.attach({ tabId }, '1.3');

  try {
    // 2. Read CSS layout dimensions from Page.getLayoutMetrics (do not use main-world
    // Runtime.evaluate for devicePixelRatio, which untrusted pages can override, or
    // deprecated contentSize, which includes browser zoom).
    const { cssContentSize } = await sendCommandWithTimeout(
      { tabId },
      'Page.getLayoutMetrics',
      {}
    );
    const pageWidthCss = Math.max(1, cssContentSize.width);
    const pageHeightCss = Math.max(1, cssContentSize.height);

    // 3. Capture slices (starting with a conservative height safe up to 4x DSF, then refining
    // from the first slice's width) and sum the exact slice heights so fractional DSF (125%)
    // never clips or leaves blank rows at the bottom of the canvas.
    let maxSliceHeightCss = Math.min(2048, pageHeightCss);
    let outputWidthPx = 0;
    let totalHeightPx = 0;
    const slices = [];

    for (let y = 0; y < pageHeightCss; ) {
      const height = Math.min(maxSliceHeightCss, pageHeightCss - y);
      const { data } = await sendCommandWithTimeout({ tabId }, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y, width: pageWidthCss, height, scale: 1 },
      });

      const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const sliceWidth = bitmap.width;
      const sliceHeight = bitmap.height;
      bitmap.close();

      if (!outputWidthPx) {
        outputWidthPx = sliceWidth;
        maxSliceHeightCss = Math.max(1, Math.floor(8192 / (sliceWidth / pageWidthCss)));
      }
      totalHeightPx += sliceHeight;

      // Validate OffscreenCanvas limits (65,535px per side and 268,435,456 total pixels).
      if (outputWidthPx > 65535 || totalHeightPx > 65535 || outputWidthPx * totalHeightPx > 268435456) {
        throw new Error(`Page dimensions (${outputWidthPx}x${totalHeightPx}px) exceed OffscreenCanvas limits`);
      }
      slices.push(blob);
      y += height;
    }

    // 4. Create the OffscreenCanvas with the exact summed height and draw each slice.
    const canvas = new OffscreenCanvas(outputWidthPx, totalHeightPx);
    const ctx = canvas.getContext('2d');
    let destY = 0;
    for (const blob of slices) {
      const bitmap = await createImageBitmap(blob);
      try {
        ctx.drawImage(bitmap, 0, destY);
        destY += bitmap.height;
      } finally {
        bitmap.close();
      }
    }

    return await canvas.convertToBlob({ type: 'image/png' });
  } finally {
    // 5. ALWAYS detach so the debugger infobar closes, SW keepalive releases, and retries succeed.
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}
```
