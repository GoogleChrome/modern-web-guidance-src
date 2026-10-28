---
name: copy-button
description: Build a copy button that copies text from arbitrary elements to the clipboard.
web-feature-ids:
  - invoker-commands
  - async-clipboard
  - popover
  - prefers-reduced-motion
  - logical-properties
  - focus-within
  - interaction
guides:
  - icons
---

# Copy button

Build a button that copies the text of another element (code block, inline value, read-only field) or the current selection. Declare the target with Invoker Commands (`command` + `commandfor`) instead of per-button JavaScript wiring, and write with the Async Clipboard API.

## Implementation

### 1. Markup

```html
<!-- Custom commands MUST start with "--". commandfor is the id of the element whose text is copied. -->
<span class="copy"> <!-- positioning context for the bubble -->
  <!-- aria-label names the content being copied; several bare "Copy" buttons are indistinguishable to screen readers -->
  <button type="button" class="copy-button" command="--copy" commandfor="snippet" aria-label="Copy CSS code">
    <!-- Decorative icon, rendered however the codebase renders icons -->
    <span class="icon" aria-hidden="true"></span>
  </button>
  <!-- The confirmation bubble IS the live region. Keep it empty until a copy, and outside the button:
       a button's children are presentational, so a live region inside one is not reliably announced -->
  <span class="tip" role="status"></span>
</span>
<pre><code id="snippet">…</code></pre>
```

- Use `type="button"` so the button never submits a form.
- Size the button at least 24×24 CSS px with `min-inline-size`/`min-block-size` (not `inline-size`/`block-size`), so content can grow the target but never shrink it.
- Name an icon-only button with `aria-label`. If the button shows visible text, that text is the name; do not add an `aria-label` that differs from it.
- Render the icon with whatever the codebase uses for icons (see {{ GUIDE_REF("icons") }}) and mark it decorative; the button's accessible name comes from `aria-label`, not the icon.

### 2. Copying logic

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
    report(button, true); // see Feedback below
  } catch {
    report(button, false); // clipboard access can be denied: show the failure too, not only announce it
  }
}

// `command` events do not bubble: listen in the capture phase on document.
// event.source is the clicked button; event.target is the commandfor element.
document.addEventListener('command', (event) => {
  if (event.command.startsWith('--copy')) copy(event.source, event.target, event.command);
}, true);
```

- **One element for sighted and screen reader users:** `report()` sets `data-copied` (or `data-failed`) on the button and writes the message into the bubble, which is both the visible feedback and the live region. Sighted and screen reader users then get the same message for both outcomes. Keep messages short ("Copied", "Copy failed").
- **Show and hide the bubble with `opacity`,** not `display: none` or `visibility: hidden`, which take it out of the accessibility tree so the text is not announced.
- **Announce repeats:** VoiceOver skips a message identical to the previous one from the same region, even if the region was emptied in between. Track the last message in a variable (not by reading the bubble, which is cleared) and, when a message repeats, append a no-break space (`\u00A0`) so it differs. It is not read aloud. One page-wide value is the simplest way to track it: a message from another button's bubble gets the space too, which is harmless. Do not use `ariaNotify()` for this.
- **Clean up:** after a short timeout, remove the state attributes and clear the bubble's text, so no stale "Copied" is left for screen reader browse mode.
- **Not color alone:** swap the icon (copy to check) on success and use the bubble text for both outcomes.
- **Repeat clicks:** clear the pending timeout and restart the animation instead of stacking timers. DO NOT disable the button while showing feedback: copying is idempotent, and disabling drops keyboard focus, announces a misleading unavailable state, and blocks retrying after a failure.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, replace icon and bubble animations with an opacity fade.

```js
const timers = new WeakMap();
let lastMessage = ''; // One page-wide value is the simplest way to track repeats; VoiceOver skips a repeat from the same region

function report(button, ok) {
  const tip = button.nextElementSibling; // the role="status" bubble
  clearTimeout(timers.get(button));
  button.removeAttribute('data-copied');
  button.removeAttribute('data-failed');
  let message = ok ? 'Copied' : 'Copy failed';
  if (message === lastMessage) message += '\u00A0'; // differs from the last one, so it is announced
  lastMessage = message;
  tip.textContent = '';
  void button.offsetWidth; // restart the CSS animation
  button.setAttribute(ok ? 'data-copied' : 'data-failed', '');
  requestAnimationFrame(() => (tip.textContent = message));
  timers.set(button, setTimeout(() => { // 2000ms is an example value
    button.removeAttribute('data-copied');
    button.removeAttribute('data-failed');
    tip.textContent = '';
  }, 2000));
}
```

{# Maintainer note: the no-break space workaround is for a VoiceOver bug (WebKit bug 222189, rdar://74532730) and is what WordPress's a11y package does (packages/a11y/src/shared/filter-message.ts). A tester found that in Chrome and Safari TP VoiceOver does read a repeat from a different region and skips only a repeat from the same bubble, so the guide no longer claims it skips across regions. ariaNotify() was tried and rejected: missing in a Safari that should have it, and on iPhone VoiceOver read the button name over the announcement. Revisit when it is dependable. #}

### 3. Copy the current selection (optional)

Add this only for long prose where users want a floating button on selection. Skip it for code blocks, inline values, and fields.

- Use a `popover="manual"` element (not light-dismissed, so the selection survives) containing a button with `command="--copy-selection" commandfor="<container id>"`.
- Show it on `selectionchange` (debounced; wait for `pointerup` while dragging) only when the selection is non-collapsed and inside the container. A triple-click ends at the start of the next element, so do not require the end node to be inside: clip the range's end to the container and accept it when the clipped text equals the selected text. Copy and position from the clipped range. Position it from `getSelection().getRangeAt(0).getBoundingClientRect()`: above the selection for a fine pointer, but below it (with a gap that clears the selection handles) under `(pointer: coarse)`, because touch browsers open their own selection menu above the selection and would cover the button.
- Assign the selected text to `selectedText` when showing the popover; `copy()` reads that saved string for `--copy-selection`; interacting with the button can collapse the live selection.
- Call `preventDefault()` on the popover's `pointerdown` to keep the selection. Hide on `Escape` and when the selection collapses, but not while focus is inside the popover (re-check when focus leaves it) or while a press on it is being handled. Safari on iPhone does not focus a tapped button and clears the selection anyway, so `:focus-within` is false and the popover would hide before the feedback shows. Set a flag on the popover's `pointerdown`, skip the hide while it is set, and clear it and re-check when the feedback ends (and on `pointercancel`).
- DO NOT hide the popover when the copy feedback timeout ends: a keyboard user's focus is on its button, and hiding it drops focus to the page, so the next `Tab` starts from the top. If `Escape` hides it while focus is inside, first move focus to the container: set `tabindex="-1"` on it just before the move and remove it on `blur`. Do not leave it in the markup, because a focusable container makes `Tab` skip the copy button in Firefox after a click in the text.

### 4. Buttons shown only on hover or focus (optional)

Code blocks often keep the button hidden until the block is hovered. Reveal it for keyboard users too, and never make it hover-only.

```css
.code-block { position: relative; }
.code-block .copy { position: absolute; inset-block-start: .5rem; inset-inline-end: .5rem; }

/* Only hide where hover exists; touch devices keep the button visible */
@media (hover: hover) {
  .code-block .copy-button { opacity: 0; transition: opacity .15s; }
  .code-block:hover .copy-button,
  .code-block:focus-within .copy-button,
  .code-block .copy-button:focus-visible,
  .code-block .copy-button[data-copied],
  .code-block .copy-button[data-failed] { opacity: 1; }
}
```

- Hide with `opacity` only. `display: none` and `visibility: hidden` remove the button from the tab order, so keyboard users could never reach it.
- Reveal on `:focus-within` of the container, as well as `:hover`, so the button shows when focus is on it or on focusable content in the block (such as a scrollable `<pre tabindex="0">`).
- Keep it visible on `(hover: none)` devices, where there is no hover to reveal it.
- Keep it visible while feedback shows (`data-copied` / `data-failed`), so the state does not vanish when the pointer leaves.
- Keep the button's 24×24 px minimum size and its accessible name; a hidden-by-opacity button is still announced by screen readers.
- DO NOT add `aria-hidden`, `inert` or `hidden` to the button to "hide" it, and do not toggle them on hover. Screen reader users (VoiceOver included) must be able to reach it with no hover, and focus moving onto it (including a screen reader cursor that moves focus) is what makes it visible.
- Add `padding-inline-end` on the `<pre>` so the button clears the code at rest. On a horizontally scrolling `<pre>` this padding only appears at the end of the scroll range, so a long line can still pass under the button while scrolling. Accept this: give the button a mostly opaque background (about 85%) with a visible border so it stays legible over code, and add `backdrop-filter: blur()` so any code beneath is blurred, and do not shrink the code area with extra margin, which wastes space on narrow viewports.

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
    if (!button) return;
    const target = document.getElementById(button.getAttribute('commandfor'));
    if (target) copy(button, target, button.getAttribute('command')); // a missing target would throw inside copy()
  });
}
```

Register only one of the two paths so a click never copies twice.

### Async Clipboard

{{ BASELINE_STATUS("async-clipboard", "api.Clipboard.writeText") }}

`navigator.clipboard` is only available in secure contexts (`https:` or `localhost`), and the write is rejected when permission is denied. `copy()` already covers both: a missing `navigator.clipboard` throws inside the `try`, so the failure message is shown and announced. DO NOT add a `document.execCommand('copy')` fallback: it is deprecated, and serving the page over HTTPS removes the cause.

Only the optional selection button (step 3) uses Popover.

{{ FEATURE_FALLBACKS("popover") }}
