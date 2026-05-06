# anchor-positioning

## Polyfill Limitations { #polyfill-limitations }

The `@oddbird/css-anchor-positioning` polyfill can be used to emulate anchor positioning. It does not support implicit anchors, so you MUST add explicit anchor names to the trigger. Additionally, `position-area` is not supported on popovers by the polyfill, so you MUST use `anchor()` on the desired insets instead of `position-area`.

## Polyfill Loading { #polyfill-loading }

**MANDATORY:** Conditionally load the anchor positioning polyfill only if the browser lacks native CSS support:

```html
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```
