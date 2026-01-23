---
description: Detect when a user is inactive to trigger application logic, like returning public kiosk apps to a home view or making chat apps show contacts as unreachable.
filename: idle-detection
category: ui
---

# Idle Detection

## Best Practices

Use the Idle Detection API to notify your application when a user is idle or when their screen is locked.

### Feature Detection

Check for support using `'IdleDetector' in window`.

```javascript
if ('IdleDetector' in window) {
  // Idle Detector API supported
}
```

### Permissions

Request the `'idle-detection'` permission. This requires a user gesture.

```js
// Make sure 'idle-detection' permission is granted.
const state = await IdleDetector.requestPermission();
if (state !== 'granted') {
  // Need to request permission first.
  return console.log('Idle detection permission not granted.');
}
```

**Note:** Initially, idle detection was gated behind the notifications permission. While many, but not all, use cases of this API involve notifications, the Idle Detection spec editors have decided to gate it behind a dedicated idle detection permission.

### Using the API

1. Instantiate `IdleDetector`.
2. Add an event listener for the `change` event.
3. Call `start()` with a `threshold` (minimum 60,000 ms) and an optional `AbortSignal`.

```js
try {
  const controller = new AbortController();
  const signal = controller.signal;

  const idleDetector = new IdleDetector();
  idleDetector.addEventListener('change', () => {
    const userState = idleDetector.userState;
    const screenState = idleDetector.screenState;
    console.log(`Idle change: ${userState}, ${screenState}.`);
  });

  await idleDetector.start({
    threshold: 60000,
    signal,
  });
  console.log('IdleDetector is active.');
} catch (err) {
  // Deal with initialization errors like permission denied,
  // running outside of top-level frame, etc.
  console.error(err.name, err.message);
}
```

### Stopping Idle Detection

Call the `abort()` method on the `AbortController`'s signal.

```js
controller.abort();
console.log('IdleDetector is stopped.');
```

### DevTools Support

Starting in Chromium&nbsp;94, you can [emulate idle events in DevTools](/docs/devtools/sensors#idle) without actually being idle. In DevTools, open the **Sensors** tab and look for **Emulate Idle Detector state**.

### Puppeteer Support

As of Puppeteer version&nbsp;5.3.1, you can [emulate the various idle states](https://pptr.dev/api/puppeteer.page.emulateidlestate/) to programmatically test how your web app's behavior changes.

## Polyfilling

Some aspects of the Idle Detection API are polyfillable and idle detection libraries like [idle.ts](https://github.com/dropbox/idle.ts) exist, but these approaches are constrained to a web app's own content area. Libraries cannot tell today when a user goes idle outside of its content area.

## Security and Permissions

The ability to use this API is controlled by the [`'idle-detection'` permission](https://w3c.github.io/permissions/#permission-registry). In order to use the API, an app also must be running in a [top-level secure context](https://www.w3.org/TR/secure-contexts/#examples-top-level).

### User Control and Privacy

The Idle Detection API limits the granularity of the reported idle events to mitigate attacks where seemingly independent websites, but that in fact are controlled by the same entity, might obtain user idle information and correlate the data to identify unique users across origins.