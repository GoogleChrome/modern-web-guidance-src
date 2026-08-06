---
name: ime-safe-enter-submit
description: Implement keyboard text submission (like enter-to-submit in chat/textareas) safely for IME (Input Method Editor) users to prevent premature submission of incomplete text.
web-feature-ids:
  - keyboard-events
---

# IME-safe enter-to-submit

Many chat interfaces submit their message when the user presses `Enter` in a `<textarea>`.

This works for users typing with direct Latin keyboard input (e.g. English), but breaks for users typing with an Input Method Editor (IME) to compose text in languages like Japanese, Chinese, or Korean.

In these contexts, the `Enter`/`Return` key is used to confirm the current character conversion candidate. If custom JavaScript listens to `keydown` on `Enter` and submits immediately, the user's message is sent while they are still converting characters, resulting in incomplete, fragmented, or incorrect messages.

Note that the composition-active check only matters for multiline `<textarea>` fields where custom JavaScript intercepts `Enter` for submission. For single-line `<input>` fields inside a `<form>`, no explicit handling is required, as browsers natively suppress implicit submission when the `Enter` keystroke is consumed by an IME.

## Implementation strategy

For a `<textarea>` with custom enter-to-submit, check the native `isComposing` property of the `KeyboardEvent` before submitting the content. The default action of `Enter` in a `<textarea>` is to insert a newline, so you must also call `event.preventDefault()` to suppress that.

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
    // Prevent the default newline behavior
    event.preventDefault();

    // If the user is composing text, return early.
    if (event.isComposing) {
      return;
    }

    form.requestSubmit();
  }
});
```

Note: Other custom submission shortcuts (such as `Cmd+Enter` or `Ctrl+Enter`) do not conflict with IME confirmation keys and do not require IME safety checks.

## Accessibility and testing

1. **Explicit submit button**: Always include a `<button type="submit">` element. Keyboard shortcuts are helpers; they must not replace native form submit paths.
2. **Accessible inputs**: Ensure all `<input>` and `<textarea>` elements are programmatically associated with a `<label>` using matching `id` and `for` attributes.

## Fallback strategies

{{ BASELINE_STATUS("keyboard-events", "api.KeyboardEvent.isComposing") }}

In Safari, an event-ordering bug delivers `compositionend` to script handlers before the confirming `Enter` `keydown`, even though the underlying events are dispatched in the opposite order. By the time the keydown handler runs, `event.isComposing` has already been reset to `false`, meaning the standard check alone will fail to prevent premature submission.

If you need to support cross-browser compatibility across Safari and other platforms, adopt one of the following fallback strategies:

### Strategy 1: Add a `keyCode === 229` check (recommended)

By pairing `event.isComposing` with a check for `event.keyCode === 229`, you can reliably catch Safari's out-of-order confirming `Enter` keydown. Because this is nested under the `event.key === 'Enter'` gate, it is safe from mobile virtual keyboards that might use `229` for normal character layout entry.

```js
textarea.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();

    // Block submission if composing natively or if keyCode is 229
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    form.requestSubmit();
  }
});
```

### Strategy 2: The `event.timeStamp` window workaround (alternative)

For codebases that strictly forbid the use of deprecated APIs like `keyCode`, or if there are known issues with the `229` check in specific targeted environments, you can track the browser-reported event dispatch timestamp instead. 

Because Safari dispatches the confirming `Enter` keydown event extremely close to the `compositionend` event (often within 5ms, and sometimes with the keydown timestamp being slightly *earlier* due to handler delivery order inversion), checking the time difference is highly reliable and is unlikely to trigger false-positives on mobile virtual keyboards under standard conditions.

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

    // Block submission if the event occurs within a 50ms window of composition ending.
    // Math.abs handles Safari's inverted event delivery timing bug.
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
