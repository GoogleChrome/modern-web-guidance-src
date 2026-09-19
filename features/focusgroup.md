# Focusgroup

## Fallbacks

For browsers that do not support the `focusgroup` attribute, use feature detection and a polyfill like `@microsoft/focusgroup-polyfill`.

```javascript
(async () => {
    if (!('focusGroup' in HTMLElement.prototype)) {
        const { polyfill } = await import("https://esm.sh/@microsoft/focusgroup-polyfill");
        // Polyfills 
        polyfill();
    }
})();
```

If `focusgroup` is supported, individual behaviours can be feature detected with the `focusGroup` element property’s `supports()` method:

```javascript
const myTabList = document.createElement('div');

myTabList.setAttribute('focusgroup', 'tablist');

if (!myTabList.focusGroup.supports('tablist')) polyfill(myTabList);
```
