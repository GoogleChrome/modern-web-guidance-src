# Interest Invokers

The Interest Invokers API provides a declarative way to establish a relationship between a source element (like a button or link) and a target popover element (like a tooltip or hovercard) based on user "interest" (hover, focus, or long-press).

## Accessibility

`interestfor` (and the `interestfor` polyfill) wires target popovers for assistive technology automatically based on what the target contains and how the trigger behaves:

- **Plain hints** (text and images only, with no interactive, structural, or non-tooltip semantics):
  - **Hint that repeats the trigger's accessible name** (e.g. an icon-only button with `aria-label="Bold"` and a "Bold" tooltip): nothing is added, so the name is not announced twice.
  - **Trigger with no accessible name of its own** (e.g. an icon-only button without `aria-label` when the hint is always present): the hint supplies the trigger's accessible name (`aria-labelledby`) as a fallback.
  - **Trigger that also opens the hint on activation** (a toggletip with `popovertarget` and `popovertargetaction="show"`): `popovertarget` supplies `aria-expanded`, and `aria-describedby` is omitted so the expanded state communicates that pressing the button reveals the hint. Place the hint right after the trigger in the DOM so reading keys reach its content in sequence once open.
  - **Trigger that does something else on activation** (a link or an action button): the hint becomes the trigger's accessible description (`aria-describedby`), without `aria-expanded`.
- **Rich hints** (headings, lists, links, or other structured/interactive content, such as a hovercard):
  - The target gets a minimum role of `tooltip`, the trigger gets an `aria-details` relation, and while open the hint is placed right after the trigger in the focus order so keyboard users can reach its content.
  - The trigger gets `aria-expanded` unless the trigger is a link (`<a href>`) whose target contains no focusable elements (so screen readers do not announce `"collapsed, link"` when `Enter` navigates rather than expanding).

When authoring hints:

- Do not add redundant `role="tooltip"`, `aria-describedby`, `aria-labelledby`, `aria-details`, `aria-expanded`, `aria-haspopup`, or live regions when `interestfor` (or `popovertarget`) already wires them. Any explicit `aria-describedby`, `aria-labelledby`, `aria-details`, or `aria-expanded` on the trigger (or `role` on the target) takes precedence if you intentionally override the default relationship.
- Not every screen reader reads descriptions when moving through the page (NVDA skips them in browse mode by design), so a hint exposed as a description must only carry supplemental content the user can afford to miss. Link previews and tooltips on action controls qualify; anything the user needs belongs in a toggletip or inline.
- **DO NOT** attach a hint that opens on activation to a control that already uses `aria-expanded` for something else (for example, a menu button). Give that hint its own trigger instead.
- **DO NOT** move focus into the target when interest is shown (no `autofocus`, no `focus()` in an `interest` listener). Interest is triggered by hover or focus alone, so moving focus would fail WCAG 3.2.1 (On Focus).

## Timing

By default, interest is shown and lost for keyboard and mouse users with a delay of half a second. This prevents the targeted popover from opening while tabbing through a page or moving your mouse around, and from closing while moving your mouse from the trigger to the popover. To adjust the timing, use the `interest-delay` CSS property.

```css
[interestfor]{
  /* Shorthand for interest-delay-start and interest-delay-end */
  interest-delay: 0.2s 0.1s;
}
```

If users are likely to move through multiple triggers in quick succession, set the initial delay to `0s` if an interest-triggered popover is already open. To prevent performance issues with `:has()`, select a nearby container with a small number of child nodes, and target the triggers as directly as possible.

```css
.container:has( > li > a:interest-source) [interestfor] {
  interest-delay-start: 0s;
}
```

## Fallbacks

Interest invokers must be conditionally polyfilled using the `interestfor` polyfill package from NPM. Prefer bundling the polyfill over using the CDN.

**MANDATORY:** Feature detect by checking for the `interestForElement` property on `HTMLButtonElement.prototype`, and load the polyfill **only** when native support is missing.

```html
<script type="module">
  if (!("interestForElement" in HTMLButtonElement.prototype)) {
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

Set the initial delay to `0s` if an interest-triggered popover is already open and users are likely to move through multiple triggers in quick succession.

```css
.container:has([interestfor]:is(:interest-source, .interest-source)) [interestfor] {
  --interest-delay-start: 0s;
}
```
