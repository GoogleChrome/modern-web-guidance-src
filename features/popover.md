# popover

## Polyfill Fallback { #polyfill-fallback }

If the browser does not support Popover, conditionally polyfill it by dynamically loading the `@oddbird/popover-polyfill` function builder and applying it:

```html
<script type="module">
  if (!HTMLElement.prototype.hasOwnProperty('popover')) {
    const { apply } = await import('https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover-fn.js');
    apply();
  }
</script>
```

## CSS Styling Warning { #css-warning }

**MANDATORY:** Because unsupporting browsers discard any CSS selectors they don't recognize, you MUST combine the standard `:popover-open` pseudo-class with the polyfilled `.\:popover-open` class using `:is()` or `:where()`. If you define them in separate selectors or without `:is()`, older browsers will throw away the entire styling rule:

```css
[popover]:is(:popover-open, .\:popover-open) {
  display: block;
}
```
