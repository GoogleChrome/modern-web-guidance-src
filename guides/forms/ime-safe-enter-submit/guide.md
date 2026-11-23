---
name: ime-safe-enter-submit
description: Implement Enter-to-submit in textareas and single-line inputs (chat, search, inline rename) safely for IME (Input Method Editor) users to prevent submitting incomplete text.
web-feature-ids:
  - keyboard-events
---

# IME-safe enter-to-submit

Many chat interfaces submit their message when the user presses `Enter` in a `<textarea>`.

This works for users typing with direct Latin keyboard input (e.g. English), but breaks for users typing with an Input Method Editor (IME) to compose text in languages like Japanese, Chinese, or Korean.

In these contexts, the `Enter`/`Return` key is used to confirm the current character conversion candidate. If custom JavaScript listens to `keydown` on `Enter` and submits immediately, the user's message is sent while they are still converting characters, resulting in incomplete, fragmented, or incorrect messages.

The composition-active check applies to any custom `keydown` handler that acts on `Enter`, not only to multiline `<textarea>` fields. Single-line `<input>` fields with their own `Enter` handling, such as search and find bars, inline rename fields, modal dialog fields, and command palettes, receive the same IME-confirming `Enter` keydown as a `<textarea>` does, with `isComposing` set to `true`. Native implicit submission of a `<form>` from an `<input>` with no custom `Enter` handler needs no explicit handling, because browsers suppress implicit submission when the `Enter` keystroke is consumed by an IME.

## Implementation strategy

For a `<textarea>` or `<input>` with custom enter-to-submit, check the native `isComposing` property of the `KeyboardEvent` before submitting the content. Also call `event.preventDefault()`: the default action of `Enter` inserts a newline in a `<textarea>`, and in an `<input>` inside a `<form>` it triggers the browser's implicit submission, which would submit a second time.

```html
<form id="chat-form">
  <label for="chat-input" class="visually-hidden">Message</label>
  <textarea id="chat-input" placeholder="Type a message..."></textarea>
  <button type="submit" id="send-button">Send</button>
</form>
```

```js
const textarea = document.getElementById('chat-input');
const form = document.getElementById('chat-form');

textarea.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    // Prevent the default action (newline in a textarea, implicit form submission in an input)
    event.preventDefault();

    // If the user is composing text, return early.
    if (event.isComposing) {
      return;
    }

    form.requestSubmit();
  }
});
```

For a single-line `<input>`, use the same handler without the `!event.shiftKey` condition, which exists only because `Shift+Enter` inserts a newline in a `<textarea>`.

Note: Other custom submission shortcuts (such as `Cmd+Enter` or `Ctrl+Enter`) do not conflict with IME confirmation keys and do not require IME safety checks.

## Accessibility and testing

1. **Explicit submit button**: Always include a `<button type="submit">` element. Keyboard shortcuts are helpers; they must not replace native form submit paths.
2. **Accessible inputs**: Ensure all `<input>` and `<textarea>` elements are programmatically associated with a `<label>` using matching `id` and `for` attributes.

## Fallback strategies

{{ BASELINE_STATUS("keyboard-events", "api.KeyboardEvent.isComposing") }}

In recent versions of Safari, an event-ordering issue (WebKit bug 165004) delivered `compositionend` to script handlers before the confirming `Enter` `keydown`, even though the underlying events were dispatched in the opposite order. By the time the keydown handler ran, `event.isComposing` had already been reset to `false`, meaning the standard check alone would have failed to prevent premature submission.

If you need to support cross-browser compatibility across older versions of Safari and other platforms, adopt one of the following fallback strategies:

{# Maintainer references:
   - W3C UI Events spec (keyCode 229 during IME composition): https://w3c.github.io/uievents/#determine-keydown-keyup-keyCode
   - WebKit Bug 165004 (Safari firing compositionend before keydown): https://bugs.webkit.org/show_bug.cgi?id=165004 #}

### Strategy 1: Track `compositionend` with `event.timeStamp` (recommended)

Use the browser-reported event dispatch timestamp to detect the confirming `Enter` `keydown` without relying on the deprecated `KeyboardEvent.keyCode` API.

Because Safari dispatches the confirming `Enter` `keydown` event right next to `compositionend` (often within 5ms, and sometimes with the `keydown` timestamp slightly *earlier* due to handler delivery order inversion), comparing `event.timeStamp` values with `Math.abs()` reliably blocks premature submission and is unlikely to trigger false positives on mobile virtual keyboards under standard conditions.

```js
let lastCompositionEndAt = null;

textarea.addEventListener('compositionend', (event) => {
  // IMPORTANT: Always use event.timeStamp, not Date.now() or performance.now().
  // Handler-time measurements are vulnerable to drift when the main thread is blocked.
  lastCompositionEndAt = event.timeStamp;
});

textarea.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();

    if (event.isComposing) {
      return;
    }

    // Block submission if keydown occurs within a short window (50ms example threshold)
    // of composition ending. Math.abs handles Safari's inverted event delivery order.
    if (
      lastCompositionEndAt !== null &&
      Math.abs(event.timeStamp - lastCompositionEndAt) < 50
    ) {
      return;
    }

    form.requestSubmit();
  }
});
```

### Strategy 2: Check `event.keyCode === 229` (legacy alternative)

> [!WARNING]
> `KeyboardEvent.keyCode` is deprecated and triggers linters and modern-web checks. Prefer Strategy 1 in new code, and use this only when attaching a separate `compositionend` listener is not practical (for example, in a single-handler legacy codebase).

During IME composition, browsers report `keyCode: 229` (`VK_PROCESSKEY`) instead of `13` on `keydown`, even while setting `event.key === 'Enter'` on the confirming keystroke. Pairing `event.isComposing` with `event.keyCode === 229` catches Safari's out-of-order confirming `Enter` keydown. (This also means legacy `event.keyCode === 13` handlers are already immune to IME confirmation, whereas migrating them to `event.key === 'Enter'` without an IME guard introduces premature submission.) Because this check is nested under the `event.key === 'Enter'` gate, it avoids false positives from mobile virtual keyboards that emit `229` for normal character input.

```js
textarea.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();

    // Legacy fallback: KeyboardEvent.keyCode is deprecated; prefer Strategy 1 in new code.
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    form.requestSubmit();
  }
});
```
