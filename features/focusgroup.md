# Focusgroup

## Issues

- Put `focusgroup` on an element inside a `[popover]`, not on the `[popover]` itself.

{# Maintainer note: https://issues.chromium.org/issues/564673920 (fixed 2026-09), https://github.com/whatwg/html/issues/11641 #}

## Fallbacks

Load `@microsoft/focusgroup-polyfill` only when native support is missing:

```js
if (!(Object.hasOwn(HTMLElement.prototype, 'focusGroup'))) {
  const { polyfill } = await import('@microsoft/focusgroup-polyfill');
  polyfill();
}
```

- Use the `focusgroup` and `focusgroupstart` attributes, not the `focusGroup` property, which the polyfill does not add.
- The polyfill does not notice items hidden or shown later: add `focusgroup="none"` to an item while it is hidden.

{# Maintainer note: limitations from the v1.6.0 README and issues (https://github.com/microsoft/polyfills/tree/main/packages/focusgroup): #74 items in closed popovers, #72 leak on ancestor removal. menu, toolbar, and scroll-snap-realtime-feedback still ship their own fallbacks; migrate them separately. #}
