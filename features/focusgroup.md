# Focusgroup

## Fallbacks

For browsers that do not support the `focusgroup` attribute, use feature detection and a polyfill like `@microsoft/focusgroup-polyfill`.

```javascript
(async () => {
    if (!HTMLElement.prototype.hasOwnProperty('focusGroup')) {
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

The polyfill has a limitation around focusgroups as or within the top-layer. To workaround, use the `toggle` event to first ensure all candidate focusgroup items have `tabindex=0` set and then call `polyfill()` on the focusgroup.

```javascript
const menu = document.querySelector('[focusgroup=menu][popover]');

menu.addEventListener('toggle', () => {
    for (const button of menu.querySelectorAll('button:not(:scope [focusgroup] button, [tabindex])')) {
        button.tabIndex = 0;
    }
}, { once: true });
```
