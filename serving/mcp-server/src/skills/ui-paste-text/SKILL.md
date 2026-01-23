---
description: Securely paste text from the user's clipboard into a web application using modern or classic JavaScript APIs.
filename: paste-text
category: ui
---

# Pasting Text

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand#paste

## Best Practices

To paste text from the user's clipboard into your web application, you have two primary options: the modern Async Clipboard API and the classic `document.execCommand()` method. The Async Clipboard API is the preferred method due to its asynchronous nature, which prevents blocking the main thread and offers better user experience, especially with larger amounts of data.

### Using the Async Clipboard API

The `navigator.clipboard.readText()` method allows you to asynchronously read text from the clipboard. This method automatically requests user permission if it hasn't been granted yet.

```js
const pasteButton = document.querySelector('#paste-button');

pasteButton.addEventListener('click', async () => {
   try {
     const text = await navigator.clipboard.readText();
     document.querySelector('textarea').value += text;
     console.log('Text pasted.');
   } catch (error) {
     console.log('Failed to read clipboard');
   }
});
```

### Using `document.execCommand()`

The `document.execCommand('paste')` method can be used to paste clipboard content at the current insertion point. However, this method is synchronous and can block the page if large amounts of data are pasted. It is generally recommended to use this only as a fallback.

```js
pasteButton.addEventListener('click', () => {
  document.querySelector('textarea').focus();
  const result = document.execCommand('paste');
  console.log('document.execCommand result: ', result);
});
```

## Progressive Enhancement

To ensure compatibility and a good user experience across different browsers, implement progressive enhancement by attempting to use the Async Clipboard API first and falling back to `document.execCommand()` if the modern API fails or is not supported.

```js
pasteButton.addEventListener('click', async () => {
   try {
     const text = await navigator.clipboard.readText();
     document.querySelector('textarea').value += text;
     console.log('Text pasted.');
   } catch (error) {
     console.log('Failed to read clipboard. Using execCommand instead.');
     document.querySelector('textarea').focus();
     const result = document.execCommand('paste');
     console.log('document.execCommand result: ', result);
   }
});
```

## Browser Compatibility

Ensure you check browser compatibility for both `api.Clipboard.readText` and `api.Document.execCommand` to understand where each API is supported. Modern browsers generally support the Async Clipboard API, while `document.execCommand('paste')` has broader, albeit older, support.

## Further Reading

- [Clipboard API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [Unblocking clipboard access](/async-clipboard#readtext())