---
name: persistent-app-tours
description: Create persistent onboarding walkthroughs using tethered native overlays that stay open during user interaction.
web-feature-ids:
  - popover
  - anchor-positioning
sources:
  - https://developer.mozilla.org/docs/Web/API/Popover_API/Using
  - https://developer.chrome.com/blog/introducing-popover-api
---

# Creating Persistent App Tours

Onboarding tours require overlays that persist while users interact with the highlighted features. Unlike auto popovers, manual popovers do not close when the user clicks elsewhere on the page. Combining `popover="manual"` with CSS Anchor Positioning allows you to create non-modal, tethered tour steps.

### Recommended Implementation

#### HTML
```html
<div id="feature-target">Highlight this feature</div>

<div id="tour-step" popover="manual">
  <h3>Step 1</h3>
  <p>Learn how to use this feature.</p>
  <button popovertarget="tour-step" popovertargetaction="hide">Got it</button>
</div>
```

#### CSS
```css
#feature-target {
  anchor-name: --feature-target;
}

#tour-step {
  popover: manual;
  position-anchor: --feature-target;
  position-area: right center;
  inset: auto;
  margin: 1rem;
  padding: 1rem;
  border: 1px solid blue;
  border-radius: 0.5rem;
  background: aliceblue;
}
```

#### JavaScript
```javascript
document.getElementById('tour-step').showPopover();
```

### Implementation Guidelines

* **MANDATORY:** Use `popover="manual"` to prevent the tour step from closing accidentally during user interaction.
* **DO** use CSS Anchor Positioning to tether the tour step to the specific feature being explained.
* **DO** provide an explicit "Close" or "Next" button within the popover that uses `popovertargetaction="hide"`.

### Fallback strategies

#### popover

{{ BASELINE_STATUS("popover") }}

{{ INCLUDE("features/popover.md#polyfill-fallback") }}

Alternatively, for legacy support without a polyfill, use `position: fixed` and manually calculate coordinates via JavaScript `getBoundingClientRect()`.

#### anchor-positioning

{{ BASELINE_STATUS("anchor-positioning") }}

To support browsers without anchor positioning, you can choose between using a polyfill or a pure CSS fallback.

##### Option 1: Polyfill Fallback
{{ INCLUDE("features/anchor-positioning.md#polyfill-limitations") }}

```html
<script type="module">
  if (!CSS.supports('anchor-name: --foo')) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

```css
#tour-step {
  /* If using the anchor positioning polyfill with a popover, DO use `anchor()` functions instead of `position-area`. */
  left: anchor(right);
  top: anchor(top);
}
```

##### Option 2: Non-Polyfill CSS Fallback
If you prefer not to use a polyfill, you can default the tooltip to a fixed position at the bottom of the viewport using `@supports not`.

```css
@supports not (anchor-name: --foo) {
  #tour-step {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    margin: 0;
    border-radius: 0;
  }
}
```