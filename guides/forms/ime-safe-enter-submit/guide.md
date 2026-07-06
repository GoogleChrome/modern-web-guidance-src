---
name: ime-safe-enter-submit
description: Implement keyboard text submission (like Enter-to-submit in chat/text areas) safely for IME (Input Method Editor) users to prevent premature submission of incomplete text.
web-feature-ids:
  - keyboard-events
---

# IME-safe enter-to-submit

Many chat-style text inputs submit the message from a `keydown` handler when the user presses `Enter`.

While this works for users typing with direct Latin keyboard input (e.g. English), it breaks for users who type using an Input Method Editor (IME) to compose text. This includes composition-based languages like Japanese, Chinese, and Korean. 

In these contexts, the `Enter`/`Return` key is used to confirm the current character conversion candidate. If an application listens to `keydown` on `Enter` and submits immediately, the user's message is sent while they are still converting characters, resulting in incomplete, fragmented, or incorrect messages.

To ensure inputs are IME-safe, you must check whether text composition is active before treating an `Enter` keystroke as a submit shortcut.

## Implementation strategy

To ensure inputs are IME-safe, check the native `isComposing` property before treating an `Enter` keystroke as a submit shortcut.

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
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    // DO NOT submit the message if the user is currently composing text using an IME.
    // The Enter key during composition confirms candidate selection, not submission.
    !event.isComposing
  ) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  // Perform actual message sending logic here
  sendMessage(textarea.value);
  textarea.value = '';
});
```

Note: Historically, legacy codebases using the deprecated `event.keyCode === 13` check did not trigger this bug because browsers mapped keypresses during active composition to code `229`. If you are modernizing your keyboard event listeners from `keyCode` to `event.key === 'Enter'`, you **MUST** pair it with `!event.isComposing` to avoid introducing a regression for IME users.

## Accessibility and testing

1. **Explicit submit button**: Always include a `<button type="submit">` element. Keyboard shortcuts are helpers; they must not replace native form submit paths.
2. **Visual clues**: Make sure screen readers announce the availability of the input.
3. **Testing protocol**: When validating your input fields, test by enabling a Japanese, Chinese, or Korean keyboard input layout. Type a word and press `Enter` to confirm the suggestion candidate; the input field must not submit the form.

## Fallback strategies

{{ FEATURE_FALLBACKS("keyboard-events") }}

If you need to support legacy browsers, specific framework-wrapped event systems (like some older React/Vue synthetic keyboard events), or mobile webviews where the native `event.isComposing` property might be unreliable or delayed, implement state-based composition tracking manually using composition events:

```js
const textarea = document.getElementById('chat-input');
const form = document.getElementById('chat-form');

let isComposing = false;

// Track when composition starts and ends to maintain an explicit boolean flag.
// This acts as a reliable fallback for keydown event timing anomalies.
textarea.addEventListener('compositionstart', () => {
  isComposing = true;
});

textarea.addEventListener('compositionend', () => {
  isComposing = false;
});

textarea.addEventListener('keydown', (event) => {
  // Check both the native event.isComposing property and our custom flag.
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing &&
    !isComposing
  ) {
    event.preventDefault();
    form.requestSubmit();
  }
});
```
