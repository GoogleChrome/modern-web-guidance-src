---
name: execute-dynamic-code
description: Execute dynamic or user-provided code safely within Chrome Extension Content Security Policy restrictions.
web-feature-ids: []
---

# Execute Dynamic Code

Manifest V3 extensions enforce a strict Content Security Policy (CSP) that cannot be relaxed. `eval()`, `new Function()`, inline `<script>` tags, and inline event handlers are blocked in all extension pages. All JavaScript executed by the extension must also be bundled within the extension package — remotely hosted scripts are forbidden.

## What the extension CSP blocks

```js
// ❌ Blocked in all extension pages (popup, side panel, options page, etc.)
eval(userCode);
new Function('return ' + expr)();
setTimeout("doSomething()", 1000); // string form only
```

```html
<!-- ❌ Blocked — inline scripts -->
<script>alert('hi')</script>

<!-- ❌ Blocked — inline event handlers -->
<button onclick="doThing()">Click</button>

<!-- ✅ Correct -->
<script src="popup.js"></script>
```

## Option 1: Sandboxed page (recommended for code playgrounds)

Declare a sandboxed page in `manifest.json`. Sandboxed pages get a relaxed CSP that allows `eval()` and inline scripts, but they cannot access any `chrome.*` APIs.

```json
{
  "sandbox": { "pages": ["sandbox.html"] }
}
```

Embed the sandbox in an `<iframe>` in your extension page and communicate via `postMessage`. You CANNOT access `iframe.contentDocument` directly — sandboxed pages are cross-origin:

```js
// extension-page.js — send code to the sandbox
const iframe = document.getElementById('preview');
iframe.contentWindow.postMessage({ html, css, js }, '*');

// Listen for results back from the sandbox
window.addEventListener('message', (event) => {
  if (event.data.type === 'RESULT') {
    displayResult(event.data.output);
  }
});
```

```js
// sandbox.js — receive and execute code (eval is allowed here)
window.addEventListener('message', (event) => {
  const { html, css, js } = event.data;
  document.body.innerHTML = '';

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  try {
    eval(js);
    window.parent.postMessage({ type: 'RESULT', output: 'OK' }, '*');
  } catch (e) {
    window.parent.postMessage({ type: 'RESULT', error: e.message }, '*');
  }
});
```

## Option 2: Blob URL iframe

Create a self-contained HTML document via a blob URL. The blob document runs in a separate origin, bypassing the extension CSP. Also cannot access `chrome.*` APIs:

```js
function renderPreview(html, css, js) {
  const doc = `<!DOCTYPE html>
<html>
<head><style>${css}</style></head>
<body>${html}<script>${js}<\/script></body>
</html>`;

  const blob = new Blob([doc], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const iframe = document.getElementById('preview');
  if (iframe.dataset.blobUrl) URL.revokeObjectURL(iframe.dataset.blobUrl);
  iframe.dataset.blobUrl = url;
  iframe.src = url;
}
```

## Option 3: srcdoc attribute

Simpler than blob URLs for small documents:

```js
iframe.srcdoc = `<style>${css}</style>${html}<script>${js}<\/script>`;
```

## Remote code is forbidden in Manifest V3

All JavaScript and WebAssembly executed by the extension must be bundled inside the extension package. Chrome Web Store review detects remote script loading and rejects extensions with a "Blue Argon" notification.

```js
// ❌ FORBIDDEN — will cause Web Store rejection
const script = document.createElement('script');
script.src = 'https://cdn.example.com/lib.js';
document.head.appendChild(script);

// ❌ FORBIDDEN — fetching and evaluating remote code
const code = await fetch('https://example.com/logic.js').then(r => r.text());
eval(code);

// ✅ CORRECT — reference a locally bundled file
const script = document.createElement('script');
script.src = chrome.runtime.getURL('lib.js');
document.head.appendChild(script);
```

### How to fix remote code violations

- **Bundle the library**: Download it and include it in your extension package
- **Tree-shake**: Use Webpack/Rollup/Vite to strip unused code paths that trigger remote fetches
- **Build-time inlining**: Use a build plugin to fetch CDN files at build time and bundle them
- **Manual patch**: Edit the vendor file to remove the remote fetch; use `patch-package` to maintain the edit

### Valid exceptions to the remote code rule

| Mechanism | What it allows |
|-----------|---------------|
| `sandbox` page | `eval()` within the sandboxed iframe |
| `chrome.userScripts` | User-provided scripts (requires Developer Mode) |
| `chrome.debugger` | Code via Chrome DevTools Protocol |
| `chrome.devtools.inspectedWindow.eval` | DevTools extensions only |
