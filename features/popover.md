# popover

## Polyfill Fallback { #polyfill-fallback }

If the browser does not support Popover, conditionally polyfill it using `@oddbird/popover-polyfill`:

```html
<script type="module">
  if (!HTMLElement.prototype.hasOwnProperty('popover')) {
    await import('https://unpkg.com/@oddbird/popover-polyfill');
  }
</script>
```
