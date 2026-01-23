---
description: Enable web applications to share links, text, and files with other applications installed on the device, mimicking native app sharing capabilities.
filename: web-share-api
category: pwa
---

# Web Share API

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API
- https://docs.google.com/document/d/1tKPkHA5nnJtmh2TgqWmGSREUzXgMUFDL6yMdVZHqUsg/edit?usp=sharing

## Best Practices

The Web Share API allows web apps to integrate with the OS sharing UI.

### Sharing links and text

To share links and text, use the `navigator.share()` method. This method requires an object with at least one of the following properties: `title`, `text`, or `url`.

```js
if (navigator.share) {
  navigator.share({
    title: 'web.dev',
    text: 'Check out web.dev.',
    url: 'https://web.dev/',
  })
    .then(() => console.log('Successful share'))
    .catch((error) => console.log('Error sharing', error));
}
```

When sharing a URL, it's recommended to share the page's canonical URL instead of the current URL to ensure a consistent user experience across devices.

```js
let url = document.location.href;
const canonicalElement = document.querySelector('link[rel=canonical]');
if (canonicalElement !== null) {
    url = canonicalElement.href;
}
navigator.share({url});
```

### Sharing files

To share files, first check for support using `navigator.canShare()`, then call `navigator.share()` with an array of files.

```js
if (navigator.canShare && navigator.canShare({ files: filesArray })) {
  navigator.share({
    files: filesArray,
    title: 'Vacation Pictures',
    text: 'Photos from September 27 to October 14.',
  })
  .then(() => console.log('Share was successful.'))
  .catch((error) => console.log('Sharing failed', error));
} else {
  console.log(`Your system doesn't support sharing files.`);
}
```

Note that the data object passed to `canShare()` only supports the `files` property. Various file types are supported, but check the documentation for a complete list.

### Sharing in third-party iframes

To enable sharing from a third-party iframe, include the `allow="web-share"` attribute on the iframe element.

```html
<iframe allow="web-share" src="https://third-party.example.com/iframe.html"></iframe>
```

## Browser support

Browser support for the Web Share API can be nuanced. Always use feature detection (e.g., checking for `navigator.share` and `navigator.canShare()`) rather than assuming support.

## Fallback strategies

If the Web Share API is not supported, provide alternative ways for users to share content, such as direct links to social media platforms or email clients.

- **DO** use `if ('share' in navigator)` for feature detection of `navigator.share()`.
- **DO** use `if ('canShare' in navigator)` for feature detection of `navigator.canShare()`.
- **DO** provide alternative sharing methods if the API is not available.