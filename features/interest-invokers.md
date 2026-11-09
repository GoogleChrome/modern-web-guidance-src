# Interest Invokers

The Interest Invokers API provides a declarative way to establish a relationship between a source element (like a button or link) and a target popover element (like a tooltip or hovercard) based on user "interest" (hover, focus, or long-press).

## Accessibility

`interestfor` is specified to wire hint popovers (`popover="hint"`) for assistive technology itself, based on what the target contains. A **plain hint** (text and images only) becomes the trigger's accessible description, or its name if it has none. A **rich hint** (headings, links, or other interactive content) gets a minimum role of `tooltip`, the trigger gets `aria-expanded` and an `aria-details` relation while the hint is open, and the open hint comes right after the trigger in the tab order so keyboard users can reach its content.

Browsers and screen readers do not yet expose this consistently, so add the equivalent explicit ARIA as well. It is additive: where the browser already exposes the same semantics, screen readers announce them once, and hover, focus, and touch behavior is unchanged.

- **Plain hint that repeats the trigger's accessible name** (e.g. an icon-only button with `aria-label="Bold"` and a "Bold" tooltip): add nothing. A description identical to the name would be read twice.
- **Plain hint on a trigger with no accessible name of its own** (an icon-only button without `aria-label`): `aria-labelledby` on the trigger pointing at the hint, so the hint becomes the name.
- **Any other plain hint:** `role="tooltip"` on the hint and `aria-describedby` on the trigger, so the text is read with the trigger, including when reading through the page rather than tabbing.
- **Rich hints:** `aria-expanded` on the trigger, kept in sync with the popover's `toggle` event, so a screen reader user hears that the trigger has collapsible content and whether it is open.
- **DO NOT** attach a rich hint to a control that already uses `aria-expanded` for something else (for example, a button that opens a menu). Its hint would go unannounced; give that hint its own trigger instead.
- **DO NOT** move focus into the target when interest is shown (no `autofocus`, no `focus()` in an `interest` listener). Interest is triggered by hover or focus alone, so moving focus would fail WCAG 3.2.1 (On Focus).

Wire this with a short script instead of hand-authoring the attributes, so the markup stays declarative and the same rules apply to every hint. The script should:

1. Run in every browser, before loading the `interestfor` polyfill, once the DOM is parsed, and expose a function that can be called again for content inserted later. Scanning upfront is required: a browse-mode screen reader user needs the attributes in place before any interaction, so wiring them lazily on `focus` or `interest` is too late, and so is waiting for the polyfill, which wires its ARIA only on `load` and adds no `role="tooltip"` to plain hints.
2. For every `[interestfor]` trigger whose target has `popover="hint"`, classify the target the way the browser and polyfill do: **rich** if it contains headings, lists, tables, sectioning elements, `<details>`, focusable elements (links, buttons, form controls, `contenteditable`, `tabindex` other than `-1`), or any element with a `role` other than `presentation`, `none`, `generic`, or `image`; **plain** otherwise.
3. **Plain:** normalize whitespace and compare the hint text with the trigger's accessible name (`aria-labelledby` targets, else `aria-label`, else text content including image `alt`, else `title`). Equal: do nothing. Otherwise set `role="tooltip"` on the hint if it has no role, then point `aria-describedby` at the hint when the trigger has a name, or `aria-labelledby` when it has none, unless the trigger already has that attribute.
4. **Rich:** set `aria-expanded` on the trigger to the popover's current state (`:popover-open`), unless the trigger already has `aria-expanded`. Remember which triggers the script owns.
5. **Rich, where `interestfor` is supported natively** (`Object.hasOwn(HTMLButtonElement.prototype, "interestForElement")`): keep `aria-expanded` in sync from the popover's `toggle` event with a single capturing listener on `document`, updating every trigger with a matching `interestfor` that the script owns. The polyfill syncs `aria-expanded` itself.

Things that are easy to get wrong:

- `toggle` does not bubble. A bubbling listener on `document` never fires; use the capture phase (or a listener per popover).
- Sync `aria-expanded` from `toggle`, not from `interest`/`loseinterest`. The popover is the source of truth: it can be closed by `Escape`, light dismiss, or another invoker, and several triggers can share one hint.
- A hidden popover is a valid `aria-describedby` or `aria-labelledby` target. Do not force the hint open or duplicate its text to make it "visible".
- Do not add `aria-haspopup` or a live region to either kind of hint.
- Do not override author ARIA: an existing `aria-describedby`, `aria-labelledby`, or `aria-expanded` on the trigger wins.

## Timing

By default, interest is shown and lost for keyboard and mouse users with a delay of half a second. This prevents the targeted popover from opening while tabbing through a page or moving your mouse around, and from closing while moving your mouse from the trigger to the popover. To adjust the timing, use the `interest-delay` CSS property.

```css
[interestfor]{
  /* Shorthand for interest-delay-start and interest-delay-end */
  interest-delay: 0.2s 0.1s;
}
```

If users are likely to move through multiple triggers in quick succession, set the initial delay to `0s` if an interest-triggered popover is already open.

```css
:root:has(:interest-source) [interestfor] {
  interest-delay-start: 0s;
}
```

## Fallbacks

Interest invokers must be conditionally polyfilled using the `interestfor` polyfill package from NPM. Prefer bundling the polyfill over using the CDN.

**MANDATORY:** Feature detect by checking for the `interestForElement` property on `HTMLButtonElement.prototype`, and load the polyfill **only** when native support is missing.

```html
<script type="module">
  if (!Object.hasOwn(HTMLButtonElement.prototype, "interestForElement")) {
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
