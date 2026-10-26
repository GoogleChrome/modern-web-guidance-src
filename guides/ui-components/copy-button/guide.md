---
name: copy-button
description: Build a copy button that copies text from arbitrary elements to the clipboard.
web-feature-ids:
  - invoker-commands
  - async-clipboard
  - popover
guides:
  - icons
---

# Copy button

Build a button that copies the text of another element (code block, inline value, read-only field) or the current selection. Declare the target with Invoker Commands (`command` + `commandfor`) instead of per-button JavaScript wiring, and write with the Async Clipboard API.

## Implementation

### 1. Markup (MANDATORY)

```html
<!-- Custom commands MUST start with "--". commandfor is the id of the element whose text is copied. -->
<button type="button" class="copy-button" command="--copy" commandfor="snippet">
  <!-- Decorative icon, rendered however the codebase renders icons -->
  <span class="icon" aria-hidden="true"></span>
  <!-- Name the content being copied; several bare "Copy" buttons are indistinguishable to screen readers -->
  <span class="visually-hidden">Copy CSS code</span>
  <!-- Visual-only confirmation bubble; the live region below does the announcing -->
  <span class="tip" aria-hidden="true">Copied</span>
</button>
<pre><code id="snippet">…</code></pre>

<!-- One shared live region announces success and failure -->
<div id="copy-status" class="visually-hidden" role="status"></div>
```

- Use `type="button"` so the button never submits a form.
- Hide the label with a screen-reader-only class, not `display: none`. An `aria-label` on the button works too.
- Render the icon with whatever the codebase uses for icons (see {{ GUIDE_REF("icons") }}) and mark it decorative; the button's accessible name comes from the label, not the icon.

### 2. Handler (MANDATORY)

Put the copy logic in one function so the native and fallback paths share it.

```js
let selectedText = ''; // set by the optional selection popover (step 3)

async function copy(button, target, command = '--copy') {
  // Form controls expose text via .value; innerText (unlike textContent) keeps rendered line breaks
  const text = command === '--copy-selection'
    ? selectedText
    : target.matches('input, textarea') ? target.value : target.innerText.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    // success: set [data-copied] on `button`, announce "Copied to clipboard"
  } catch {
    // failure: announce "Copy failed. Select the text and copy it manually."
  }
}

// `command` events do not bubble: listen in the capture phase on document.
// event.source is the clicked button; event.target is the commandfor element.
document.addEventListener('command', (event) => {
  if (event.command.startsWith('--copy')) copy(event.source, event.target, event.command);
}, true);
```

- **Feedback:** set `data-copied` on the button and remove it after a short timeout (about 2s, example value). Style that state by swapping the icon (copy to check) and showing a visual "Copied" bubble marked `aria-hidden`. Do not rely on color alone.
- **Announce:** write to the live region by clearing it and setting the text on the next animation frame, so repeated identical messages are re-announced.
- **Repeat clicks:** clear the pending timeout and restart the animation instead of stacking timers.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, replace icon and bubble animations with an opacity fade.

### 3. Copy the current selection (optional)

Add this only for long prose where users want a floating button on selection. Skip it for code blocks, inline values, and fields.

- Use a `popover="manual"` element (not light-dismissed, so the selection survives) containing a button with `command="--copy-selection" commandfor="<container id>"`.
- Show it on `selectionchange` (debounced; wait for `pointerup` while dragging) only when the selection is non-collapsed and inside the container. Position it from `getSelection().getRangeAt(0).getBoundingClientRect()`.
- Assign the selected text to `selectedText` when showing the popover; `copy()` reads that saved string for `--copy-selection`; interacting with the button can collapse the live selection.
- Call `preventDefault()` on the popover's `pointerdown` to keep the selection. Hide on `Escape` and when the selection collapses, but not while focus is inside the popover.

## Fallbacks and browser support

### Invoker Commands

{{ BASELINE_STATUS("invoker-commands") }}

If your Baseline target does not include Invoker Commands, keep the same markup and add a click listener that calls the same `copy()` function. This is a short, robust fallback (progressive enhancement of the same experience):

```js
// Detect on the interface, not an instance
if (!('CommandEvent' in window)) {
  // Resolve the target from commandfor, as the browser does for command events
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[command^="--copy"]');
    if (button) copy(button, document.getElementById(button.getAttribute('commandfor')), button.getAttribute('command'));
  });
}
```

Register only one of the two paths so a click never copies twice.

### Async Clipboard

{{ BASELINE_STATUS("async-clipboard") }}

If your Baseline target does not include it, or the page is not a secure context, `navigator.clipboard` is undefined. Guard with `navigator.clipboard?.writeText` and fall back to selecting the text and calling `document.execCommand('copy')` (deprecated but widely supported, synchronous, and must run inside the click handler). If that also fails, take the failure path from `copy()`.

### Popover (optional selection button only)

{{ BASELINE_STATUS("popover") }}
