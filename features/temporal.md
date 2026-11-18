# Temporal

## Fallbacks

For browsers that do not yet support the native `Temporal` API, use feature detection and dynamically load `temporal-polyfill` (~15 KB min+gz).

Note that importing `temporal-polyfill` does not automatically assign the `Temporal` object to the global scope. Assign it explicitly if your code relies on `globalThis.Temporal`.

```javascript
// Check if Temporal is supported natively
(async () => {
  if (typeof Temporal === 'undefined') {
    // Load the polyfill conditionally
    const module = await import('https://esm.sh/temporal-polyfill');
    globalThis.Temporal = module.Temporal;
    // Extend Date.prototype if needed
    Date.prototype.toTemporalInstant = module.toTemporalInstant;
  }
  initializeApp();
})();
```
