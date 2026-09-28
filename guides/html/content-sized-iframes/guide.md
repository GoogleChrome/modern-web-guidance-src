---
name: content-sized-iframes
description: Size embedded iframes—such as comment widgets, embedded forms, content previews, and third-party embeds—to fit their content so they never show an inner scrollbar, including after the embedded content changes.
web-feature-ids:
  - frame-sizing
  - resize-observer
---

# Content-sized iframes

By default an `<iframe>` is a fixed-size viewport (300×150px unless sized otherwise), so content taller than the frame gets an inner scrollbar. The legacy fix—measuring the embedded document in script, sending its height with `postMessage()`, and setting `iframe.style.height` in the parent—is fragile and needs code on both sides.

Responsive iframes replace that with a **double opt-in**:

- The **embedding page** sets `frame-sizing: content-height` on the `<iframe>`.
- The **embedded document** declares `<meta name="responsive-embedded-sizing" content="allow-origins=...">` and calls `window.requestResize()` when its content changes after load.

Both opt-ins are required. The iframe keeps its style, script, and origin isolation; only the content height is exposed, and only to the origins the embedded document allows.

## Implementation steps

1. **Embedding page: opt the iframe in.** Set `frame-sizing: content-height` and give the iframe a definite width (for example `width: 100%`). Leave the height `auto`: a `height` attribute or CSS `height` overrides the content height.
2. **Embedded document: MANDATORY meta opt-in.** Add `<meta name="responsive-embedded-sizing" content="allow-origins=...">` to the server-rendered `<head>`, before any `<body>` content. The `content="allow-origins=..."` value is required.
3. **Embedded document: request a resize after dynamic changes.** The browser measures the content after `DOMContentLoaded` and again at `load`. Later changes are **not** picked up automatically. Call `window.requestResize()` after each change that affects the content height.
4. **Optional: constrain the size.** Use `min-height` and `max-height` on the iframe. They clamp the content height like any other replaced element. Content taller than `max-height` scrolls inside the frame again.

## Embedding page

```html
<style>
  .embed {
    /* Give the frame a definite width. The embedded content is laid out at this width. */
    width: 100%;
    border: 0;
    /* Opt in: use the embedded document's content height as the iframe's natural height. */
    frame-sizing: content-height;
    /* DO NOT set `height` here or use a height attribute. An explicit height
       overrides the content height, so the frame stays fixed and scrolls. */

    /* OPTIONAL: reserve space for embeds in the first viewport to reduce layout shift.
       320px is an example; use the smallest typical height of your embed. */
    min-height: 320px;
    /* OPTIONAL: cap very long content; beyond this the frame scrolls internally. */
    max-height: 80vh;
  }
</style>

<!-- loading="lazy" defers offscreen embeds. It also makes sure the iframe is laid out
     before its document loads (see "Load the embedded document after the host lays out the frame"). -->
<iframe class="embed" src="https://widgets.example/comments?post=42" title="Comments" loading="lazy"></iframe>
```

`frame-sizing` values:

| Value | Effect |
|---|---|
| `auto` (initial) | Legacy behavior. The content size is ignored. |
| `content-height` / `content-block-size` | Height comes from the content. Use this for vertically growing embeds in horizontal writing modes. |
| `content-width` / `content-inline-size` | Width comes from the content. This is rarely useful because most documents fill whatever width they get. |

Logical values resolve against the writing mode of the `<iframe>` element, not the embedded document.

## Embedded document

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- MANDATORY: opt in to exposing the content size.
         - This must be in the initial HTML <head>. The opt-in is decided while parsing,
           so a <meta> added after the document has loaded has no effect.
         - content="allow-origins=..." is REQUIRED. A bare <meta name="responsive-embedded-sizing">
           does nothing.
         - List every origin that embeds this page, separated by spaces. Same-origin
           embedders are NOT implicitly allowed, so list your own origin too. -->
    <meta name="responsive-embedded-sizing"
          content="allow-origins=https://blog.example https://news.example">
    <style>
      /* DO NOT size the content with viewport units (vh/dvh/svh) or height: 100% on
         html/body. The frame's viewport is locked at its first layout, so these
         resolve to the initial frame height instead of following the content. */
    </style>
  </head>
  <body>…</body>
</html>
```

Use `allow-origins=*` only for widgets that anyone may embed, because it exposes the content height to every embedder. To control which sites can embed the page at all, also send `Content-Security-Policy: frame-ancestors <origins>`.

### Request a resize after content changes

```js
// requestResize() throws NotAllowedError when the document is not in an <iframe>
// (for example, when opened directly as a top-level page) or has no valid opt-in <meta>.
// Browsers without the feature don't have the method. Guard every call.
export function requestFrameResize() {
  if (typeof window.requestResize !== 'function') return;
  try {
    window.requestResize();
  } catch {
    // Not embedded or not opted in: there is nothing to resize.
  }
}

// DO: call it after you apply all DOM changes. It flushes style and layout
// synchronously and sends the new height to the embedding page. The frame can grow and shrink.
async function loadMoreComments() {
  const items = await fetchMoreComments();
  renderComments(items);
  requestFrameResize();
}
```

**Optional:** Height can also change without your code doing anything, for example when images decode, web fonts swap, or a `<details>` element toggles. For these cases, observe the document and request a resize whenever its size changes. Growing the frame does not change the embedded viewport, so this doesn't cause a resize loop.

```js
// OPTIONAL: catch height changes your code doesn't trigger directly.
new ResizeObserver(() => requestFrameResize()).observe(document.documentElement);
```

## Key constraints

- **Both opt-ins are required.** Without the `<meta>` (or with an origin that isn't allowed), the iframe keeps its default 150px height even with `frame-sizing` set. Without `frame-sizing`, the `<meta>` does nothing.
- **Explicit heights win.** A `height` attribute or CSS `height` disables content sizing. When you keep a legacy height as a fallback, override it with `height: auto` inside `@supports (frame-sizing: content-height)`.
- **The frame never gets shorter than it was at the embedded document's first layout.** The embedded viewport is locked at that size (150px for an unsized iframe, or the `min-height` if one is set). Content shorter than that leaves empty space, and `requestResize()` can't shrink the frame below it.
- **Width changes after load are not re-measured.** Because the viewport is locked, content that reflows when the iframe's width changes later (window resize, device rotation, a container animating its width) doesn't update the frame height, even after `requestResize()`. Size the iframe to its final width before it loads, for example `width: 100%` of a stable container. If an exact fit matters after a large width change, reload a stateless embed by reassigning its `src`.
- **Layout shift.** The frame grows when the embedded document loads, after the host page renders. For embeds in the first viewport, reserve space with `min-height`. Use `loading="lazy"` for embeds below the fold.

### Load the embedded document after the host lays out the frame

In Chrome 154, if the embedded document finishes its first layout **before** the embedding page has laid out the `<iframe>`, the frame collapses to 0px height. `requestResize()` doesn't recover it. This happens with `srcdoc` iframes written in the HTML and with `src` documents that load almost instantly (cached, or served by a service worker).

- For `src` embeds, add `loading="lazy"`. The browser then starts loading only after it has laid out the frame.
- For `srcdoc` embeds (`loading="lazy"` does not help), or to be safe with any embed, assign `srcdoc`/`src`, or insert the `<iframe>`, from script after the host has rendered:

```js
// Assign the document after the host's first layout so the frame has a real size
// when the embedded document first lays out.
const frame = document.querySelector('iframe.preview');
requestAnimationFrame(() => {
  frame.srcdoc = previewHtml; // previewHtml must include the responsive-embedded-sizing <meta> in its <head>.
});
```

## Fallback strategies

{{ FEATURE_FALLBACKS("frame-sizing") }}

If your Baseline target doesn't include responsive iframes, keep the legacy `postMessage()` resizing as a fallback, and run it **only** when `frame-sizing` isn't supported. Supporting browsers use the native path. Other browsers get the same no-scrollbar result from about 30 lines of script. The fallback needs code in both documents, so it only works for embedded documents you control.

**Embedding page:** use a fixed height by default and switch to content sizing where it's supported.

```css
.embed {
  width: 100%;
  height: 500px; /* Example fallback height, used until the fallback script reports a height. */
}

@supports (frame-sizing: content-height) {
  .embed {
    height: auto; /* MANDATORY: remove the fixed height so the content height applies. */
    frame-sizing: content-height;
  }
}
```

```js
// Embedding page: apply heights reported by the embed, only when native sizing is unavailable.
const EMBED_ORIGIN = 'https://widgets.example'; // Example: the embedded document's origin.
const frame = document.querySelector('.embed');

if (!CSS.supports('frame-sizing', 'content-height')) {
  window.addEventListener('message', (event) => {
    // MANDATORY: accept messages only from the expected origin AND this specific frame.
    if (event.origin !== EMBED_ORIGIN || event.source !== frame.contentWindow) return;
    if (event.data?.type !== 'embed-height' || !Number.isFinite(event.data.height)) return;
    frame.style.height = `${Math.ceil(event.data.height)}px`;
  });
}
```

**Embedded document:** report the content height to the parent.

```js
// Embedded document: report the content height to the parent, only when native sizing is unavailable.
const PARENT_ORIGIN = 'https://blog.example'; // Example: DO NOT use '*', which leaks the height to any embedder.

if (window.parent !== window && !CSS.supports('frame-sizing', 'content-height')) {
  const report = () => {
    // DO: use offsetHeight (not scrollHeight). documentElement.scrollHeight is clamped
    // to at least the current iframe viewport height, which prevents the frame from shrinking.
    window.parent.postMessage(
      { type: 'embed-height', height: document.documentElement.offsetHeight },
      PARENT_ORIGIN,
    );
  };
  // Report on every size change, which covers dynamic content, images, and fonts.
  new ResizeObserver(report).observe(document.documentElement);
}
```

Keep calling `requestFrameResize()` after dynamic changes in the embedded document as well. It's a no-op in browsers without the feature.
