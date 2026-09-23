# Interest Invokers

The Interest Invokers API provides a declarative way to establish a relationship between a source element (like a button or link) and a target popover element (like a tooltip or hovercard) based on user "interest" (hover, focus, or long-press).

## Accessibility

When you use `interestfor`, the browser handles the assistive-technology wiring for you:

- **Implicit semantics:** A target with `popover="hint"` gains an implicit minimum role of `tooltip`. **DO NOT** set `role="tooltip"` yourself.
- **Implicit association:** The browser implicitly associates the source element with the target via `aria-describedby` when the target is plaintext, or via `aria-details` when the target contains interactive content. **DO NOT** add `aria-describedby` or `aria-details` to the trigger.
- **Interactive content:** Because the association switches to `aria-details` when needed, the target IS allowed to contain interactive content (e.g. a link inside an "interest card").

## Timing

By default, interest is shown and lost for keyboard and mouse users with a delay of half a second. This prevents the targeted popover from opening while tabbing through a page or moving your mouse around, and from closing while moving your mouse from the trigger to the popover. To adjust the timing, use the `interest-delay` CSS property.

```css
[interestfor]{
  /* Shorthand for interest-delay-start and interest-delay-end */
  interest-delay: .2s;
}
```

## Fallbacks

Interest invokers must be conditionally polyfilled using the `interestfor` polyfill package from NPM. Prefer bundling the polyfill over using the CDN.

**MANDATORY:** Feature detect by checking for the `interestForElement` property on `HTMLButtonElement.prototype`, and load the polyfill **only** when native support is missing.

```html
<script type="module">
  if (!HTMLButtonElement.prototype.hasOwnProperty("interestForElement")) {
    // CDN link only used for example, prefer bundling.
    await import("https://unpkg.com/interestfor@latest");
  }
</script>
```

### CSS Polyfill Caveats

When using the polyfill, the CSS API changes slightly to account for the lack of native pseudo-class and property support:

- **Pseudo-classes:** The polyfill cannot define real `:interest-source` and `:interest-target` pseudo-classes, so it applies `.interest-source` and `.interest-target` classes instead. **MANDATORY:** Combine them with `:is()` to support both native and polyfilled states.

```css
/* Styles to apply when the effect is being previewed */
:is(:interest-source, .interest-source) { /* ... */ }
:is(:interest-target, .interest-target) { /* ... */ }
```

- **CSS Properties:** For `interest-delay`, `interest-delay-start`, and `interest-delay-end`, the polyfill requires using CSS variables as it cannot read the custom properties directly in all browsers.

```css
/* Adjust the start and end delay for interest invokers */
[interestfor] {
  --interest-delay-start: 0.2s;
  interest-delay-start: var(--interest-delay-start);
  --interest-delay-end: 0.1s;
  interest-delay-end: var(--interest-delay-end);
}
```
