---
description: Enable websites to capture keys normally reserved by the OS for immersive, full-screen web applications like games or remote access apps.
filename: keyboard-lock-api
category: ui
---

# Keyboard Lock API

Reference docs:
- https://developer.mozilla.org/docs/Web/API/Keyboard
- https://wicg.github.io/keyboard-lock/
- https://www.w3.org/TR/uievents-code/#keyboard-key-codes

## Best Practices

To provide an immersive, full-screen experience for web applications like games or remote desktop streaming, the Keyboard Lock API allows websites to capture keys that are normally reserved by the operating system. This API is only available when JavaScript-initiated full screen is active.

### Fullscreen Prerequisite

Ensure that your application enters JavaScript-initiated full screen mode before attempting to lock the keyboard.

```js
await document.documentElement.requestFullscreen();
```

### Feature Detection

Before using the Keyboard Lock API, check for its availability in the browser.

```js
if ('keyboard' in navigator && 'lock' in navigator.keyboard) {
  // Keyboard Lock API is supported!
}
```

### Locking the Keyboard

The `navigator.keyboard.lock()` method enables the capture of key presses. You can choose to capture all keys or specific keys.

#### Capturing All Keys

To capture all key presses, call `lock()` without any arguments.

```js
navigator.keyboard.lock();
```

#### Capturing Specific Keys

To capture specific keys, provide an array of key codes to the `lock()` method. This example captures the 'W', 'A', 'S', and 'D' keys.

```js
await navigator.keyboard.lock([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);
```

You can then handle these captured key presses using standard keyboard event listeners like `onkeydown`.

```js
document.addEventListener('keydown', (event) => {
  if ((event.code === 'KeyA') && !(event.ctrlKey || event.metaKey)) {
    // Respond to 'A' key press when not combined with Ctrl or Meta
  }
});
```

### Unlocking the Keyboard

The `navigator.keyboard.unlock()` method releases all captured keys. This method is called implicitly when a document is closed.

```js
navigator.keyboard.unlock();
```

## Security Considerations

To prevent users from being trapped in a web page, browsers typically provide an escape hatch. In Chrome, a long press (two seconds) of the <kbd>Esc</kbd> key triggers an exit from keyboard lock.

## Demo

Test the Keyboard Lock API with this [demo](https://chrome.dev/keyboard-lock/).