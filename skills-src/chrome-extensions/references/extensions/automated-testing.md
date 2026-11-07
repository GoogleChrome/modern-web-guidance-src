# Testing Extensions Under Automation

Driving an unpacked extension through CDP (Puppeteer, Playwright, or a raw CDP client) hits four
constraints that manual testing does not trigger.

## 1. Do not use `--load-extension` on branded Google Chrome

Branded Google Chrome (stable, beta, dev, and canary) ignores `--load-extension` and
`goog:chromeOptions.extensions`, logging:

```
--load-extension is not allowed in Google Chrome, ignoring.
```

There is no flag or policy override for `--load-extension` on branded builds. Use one of these two
supported paths instead:

- **Chrome for Testing or Chromium**: Pass `--load-extension=/path/to/ext` and
  `--disable-extensions-except=/path/to/ext`. Both switches work on unbranded builds.
- **Branded Google Chrome**: Load the unpacked directory via CDP `Extensions.loadUnpacked` on the
  browser target (used by Puppeteer's `enableExtensions: ['/path/to/ext']`), or via WebDriver BiDi
  `webExtension.install` (ChromeDriver: add `--enable-unsafe-extension-debugging` to Chrome args).

## 2. Handle `"Another debugger is already attached"` and `"Cannot attach to this target"`

Your external CDP test harness (Puppeteer, Playwright, or ChromeDriver) can remain attached to a
tab while an extension debugs that same tab. When `chrome.debugger.attach({ tabId })` fails under
automation, check the exact error message:

- `"Another debugger is already attached to the tab with id: <tabId>."`: **This same extension**
  still holds an active `chrome.debugger` session on `tabId` from an earlier capture (a missed
  `detach`) or a concurrent call. Always call `await chrome.debugger.detach({ tabId }).catch(() => {})`
  in a `finally` block.
- `"Cannot attach to this target."`: On a tab target, the tab is displaying a security error
  interstitial (such as a self-signed HTTPS certificate warning on a local test server; launch with
  `--ignore-certificate-errors`). Restricted URLs return scheme-specific
  errors (`"Cannot access a chrome:// URL"`, `"Cannot access a chrome-extension:// URL of different extension"`,
  or `"The extensions gallery cannot be scripted."`).

## 3. Wake stopped MV3 service workers and trigger actions via events or `Extensions.triggerAction`

A stopped MV3 service worker has no attachable CDP target. If you attach while the worker is
starting (or with `waitForDebuggerOnStart`), `Runtime.evaluate` executes before the worker script
evaluates: `self.location.href` is set, but `chrome.*` APIs and top-level bindings are `undefined`
until `Runtime.runIfWaitingForDebugger` releases execution.

To wake a stopped worker or trigger extension logic under automation:

- **Trigger the toolbar action via CDP**: Call `Extensions.triggerAction({ id: extensionId, targetId: tabTargetId })`
  on the browser target (or Puppeteer's `page.triggerExtensionAction()`). Because `tab` targets are
  omitted from `/json/list` and default `Target.getTargets()` calls, look up `tabTargetId` via
  `Target.getTargets({ filter: [{ type: 'tab' }] })`.
- **Send an extension message**: Open an extension page in a tab and call
  `chrome.runtime.sendMessage`:

```js
// Wakes the service worker via a genuine extension event
await extensionPage.evaluate(() => chrome.runtime.sendMessage({ type: 'PING' }));
```

## 4. Match service worker targets in `/json/list` by full URL

The DevTools target list (`/json/list`) is process-wide and includes other installed extensions and
web page service workers that may also end in `background.js`. Always match the full
`chrome-extension://<id>/<manifest-relative-path>` URL:

```js
// ❌ BROKEN: matches unrelated extensions or web page service workers named background.js
const bad = targets.find((t) => t.type === 'service_worker' && t.url.endsWith('background.js'));

// ✅ CORRECT: match the exact extension origin and manifest-relative script path
const target = targets.find(
  (t) => t.type === 'service_worker' && t.url === `chrome-extension://${extensionId}/background.js`
);
```

Immediately after reloading or updating an extension, the stopping worker target can briefly remain
in `/json/list` alongside the new worker with the same URL. Wait for `/json/list` to settle to a
single matching `service_worker` entry before attaching.
