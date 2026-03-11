---
name: create-contextual-tooltips
description: Create contextual tooltips for certain elements on the page that provide additional information to the user. The tooltips are initially not show, they appear only when the user shows interest in the element, such as hovering or focusing it.
web-feature-ids:
- popover
- anchor-positioning
- popover-hint
- interest-invokers
sources:
- https://developer.mozilla.org/docs/Web/API/Popover_API
- https://developer.mozilla.org/docs/Web/CSS/Guides/Anchor_positioning
- https://developer.mozilla.org/docs/Web/API/Popover_API/Using_interest_invokers
---

# Creating Contextual Tooltips

Contextual tooltips provide secondary information about a UI element. By combining `popover="hint"` with the Interest Invoker API's `interestfor` attribute, tooltips are wired declaratively to their trigger element — the browser handles showing and hiding them on hover and keyboard focus with no JavaScript required. The `hint` popover type keeps tooltips in a separate ephemeral stack so they won't dismiss other active UI layers like open dropdown menus.

### Implementation Guidelines

Create an invoking element and a tooltip with markup like so:

```html
<button class="anchor" interestfor="tip">Hover Me</button>
<div id="tip" popover="hint">Contextual info bubble</div>
```

Then apply CSS to style it:

```css
[popover="hint"] {
  position: fixed;
  position-area: top center;
  inset: auto;
  position-try-options: flip-block;
}
```

This creates an implicit anchor relationship, positions the tooltip at the top center of the invoking element, and flips it underneath the invoking element when a user scrolls it off screen.

* **MANDATORY:** Apply `popover="hint"` to the tooltip element to ensure it is ephemeral and does not close other active UI layers.
* **MANDATORY:** Put an `id` on the `popover` which is the value for the the `interestfor` property.
* **MANDATORY:** Add `interestfor="<tooltip-id>"` to the trigger element (a `<button>` or `<a>`). This declaratively links the invoker to its tooltip popover. The browser automatically shows and hides the popover when the user hovers or focuses the invoker.
* **DO** include the `interestfor` polyfill (`npm: interestfor`) as a `<script>` tag for browsers that do not yet natively support the Interest Invoker API. The polyfill monitors hover and keyboard focus on `document.body` and fires `interest`/`loseinterest` events, automatically showing and hiding the popover target to match native behavior.
* **DO** use `popover=auto` if `popover=hint` is not supported in your browser support matrix.
* **DO** set `inset: auto` on the popover to reset the browser's default centering behavior before applying anchor styles.
* **DO** use `position-area` for simplified placement. For example, `position-area: top center` places the tooltip directly above the anchor. Note: if the user wants to animate the tooltip between positions, do not use `position-area` and use `top/left/bottom/right` positioning instead.
* **DO** use `position-try-options: flip-block` to ensure the tooltip remains visible by flipping to the bottom if it overflows the top of the viewport.
* **DO NOT** use `z-index` to manage the tooltip's visibility; the Top Layer handles this natively.
* **DO NOT** wire tooltip show/hide events manually with `mouseenter`/`mouseleave` JavaScript when the `interestfor` attribute (or its polyfill) can be used instead.

### Fallback Strategies
#### interest-invokers

The Interest Invoker API (`interestfor` attribute) is Baseline Limited availability. For browsers that do not yet support it natively:

* **Guidance:** Feature detect and load the [`interestfor` polyfill](https://www.npmjs.com/package/interestfor). It replicates native Interest Invoker API behavior and requires no changes to markup — the same `interestfor` attribute used for the native API is also read by the polyfill.

```js
<script>
  // Feature-detect native Interest Invoker API support.
  // If the browser doesn't support it, dynamically load the polyfill.
  if (!('interestForElement' in HTMLButtonElement.prototype)) {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/interestfor/dist/interestfor.min.js';
    document.head.appendChild(script);
  }
</script>
```

#### popover-hint

The hint state is currently only in Chrome. If the browser does not support `popover="hint"`, use `popover="auto"`, which may close other open auto popovers when the tooltip appears. This is still preferable to not using the Popover API at all.

* **Guidance:** Keep `popover="hint"` on the tooltip element and let it naturally degrade to `popover="auto"` behavior in unsupported browsers. Do **not** replace it with `popover="manual"` + JavaScript event listeners — `popover="auto"` still provides Top Layer promotion, correct stacking, and light-dismiss behavior, which are all better than a manually managed element.

```html
<script src="interestfor.min.js" async></script>
```

#### anchor-positioning

* **Guidance:** Use the [CSS Anchor Positioning Polyfill](https://github.com/oddbird/css-anchor-positioning). For a non-polyfill fallback, default the tooltip to a fixed position at the bottom of the viewport using `@supports not (anchor-name: --foo)`.