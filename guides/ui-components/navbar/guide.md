---
name: navbar
description: Build a site navigation bar that adapts across screen sizes and indicates the current page.
web-feature-ids:
  - popover
  - nesting
  - anchor-positioning
  - viewport-unit-variants
  - logical-properties
  - focus-visible
  - forced-colors
  - starting-style
  - transition-behavior
  - interpolate-size
  - content-visibility
# - local-link
guides:
  - icons
  - animate-to-intrinsic-sizes
  - menu
---

# Responsive Site Navigation

Build a site navigation bar that uses one semantic navigation tree at every size, presents a native popover when the links do not fit, becomes an inline navigation when they do, and identifies the current page.

This guide describes site-navigation integration. It is navigation, not an application menu: links stay in the `Tab` order, with no `focusgroup`, `role="menubar"`, `role="menu"`, `role="menuitem"`, `aria-haspopup="menu"`, or arrow-key handling. For application command menus, see {{ GUIDE_REF("menu") }}; for menubars, see {{ GUIDE_REF("app-menus") }}. For the menu and chevron icons, see {{ GUIDE_REF("icons") }}.

For component-driven layouts, fluid sizing, and typographic line-wrapping, see {{ GUIDE_REF("size-aware-styling") }}, {{ GUIDE_REF("fluid-scaling") }}, and {{ GUIDE_REF("improve-text-layout-and-legibility") }}.


## Core Markup

Use one `<nav>` landmark for narrow and wide layouts. Wrap it in a semantic `<header>` whose `is-wide` class selects the inline layout. The collapsed layout is the default, so it is also what you get without script.

```html
<header class="site-header">
  <div class="header-inner">
    <a class="site-logo" href="index.html">Acme</a>

    <nav class="site-nav" aria-label="Primary">
      <button
        class="menu-button"
        type="button"
        popovertarget="site-menu"
        popovertargetaction="toggle"
        aria-controls="site-menu"
      >
        <!-- Decorative menu icon: insert as described in the icons guide -->
        <span>Menu</span>
      </button>

      <ul id="site-menu" class="site-menu" popover="auto">
        <li><a href="index.html" aria-current="page">Home</a></li>
        <li><a href="about.html">About</a></li>
        <li class="nav-dropdown">
          <button
            class="dropdown-trigger"
            type="button"
            aria-expanded="false"
            aria-controls="services-menu"
            popovertarget="services-menu"
          >
            Services
          </button>
          <ul id="services-menu" class="dropdown-list">
            <li><a href="design.html">Design</a></li>
            <li><a href="development.html">Development</a></li>
          </ul>
        </li>
      </ul>
    </nav>
  </div>
</header>
```

The button declaratively controls the menu with `popovertarget` and `aria-controls`. The `nav` remains the navigation landmark while the menu is closed. The trigger icon is decorative and the visible "Menu" text is the accessible name, so hide the icon from assistive technologies. For how to insert and hide icons, see {{ GUIDE_REF("icons") }}. For the general popover control contract, see {{ GUIDE_REF("declarative-dialog-popover-control") }}. Unlike the menu guide, use `popovertarget`: one toggle needs no invoker commands. As in the menu guide, place each popover (the menu list, and the submenu list) immediately after its trigger so browsers add no implicit `aria-details`.


## Narrow Layout: Popover Navigation

When collapsed, keep `popover="auto"` on the navigation list. Anchor the fixed popover to the menu button and constrain its height so a long navigation can scroll without exceeding the viewport.

There is no hard-coded breakpoint. Script collapses the navigation only when the inline row (brand, actions and every link) does not fit, so adding a link, a translation or larger text moves the point automatically. It adds `is-wide` to the header when the row fits; without script the header keeps the collapsed layout at every width.

```css
/* Keep the row's natural width measurable */
.header-inner > * {
  flex-shrink: 0;
  white-space: nowrap;
}

.site-header {
  .menu-button {
    anchor-name: --menu-button;
  }

  .site-menu {
    position: fixed;
    inset: auto;
    inset-block-start: anchor(--menu-button bottom);
    inset-inline-end: 1rem;
    inline-size: min(80dvw, 24rem);
    max-inline-size: calc(100dvw - 2rem);
    block-size: fit-content;
    max-block-size: calc(100dvh - 6rem);
    margin-block-start: 0.5rem;
    overflow: auto;
  }
}
```

The `anchor()` declaration places the menu below the button; see Fallbacks for browsers without Anchor Positioning. For collision-aware positioning near viewport edges, see {{ GUIDE_REF("viewport-aware-dropdowns") }}.


## Wide Layout: Inline Navigation

When the row fits, hide the collapsed-layout trigger and reset the popover presentation so the same list participates in the header as an inline navigation.

```css
.site-header.is-wide {
  .menu-button {
    display: none;
  }

  .site-menu {
    position: static;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    inline-size: auto;
    max-inline-size: none;
    block-size: auto;
    max-block-size: none;
    overflow: visible;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .site-menu::backdrop {
    display: none;
  }
}
```

CSS changes the presentation, but JavaScript decides which layout applies and must also synchronize the `popover` attribute with it. Measure the inline row: show it inline, compare `scrollWidth` with `clientWidth` on the header's inner row, then toggle `is-wide`. Add a temporary `is-measuring` class that sets `transition: none` on descendants for the measurement and remove it in `requestAnimationFrame`, otherwise the menu animates from its inline styles on every resize and flickers. Keep the navigation as a popover only in the collapsed layout; remove the attribute in the inline layout. Removing it closes an open popover, so note whether the menu was open and call `showPopover()` again if the layout is still collapsed; otherwise a resize closes the open menu. Run one shared function from `ResizeObserver`s on the header and the navigation list, so font loading and text changes are caught without special cases. Remeasure while inline on every notification, but while collapsed only when the header's width has grown. Switching to inline just to measure on every shrink makes the layout thrash. The tradeoff is that a collapsed menu that gets smaller by itself (for example a shorter translation) stays collapsed until the header grows. Do not infer the layout from a hidden trigger.


## Nested Site Navigation

Use a `<button>` with `aria-expanded` and `aria-controls` as the trigger for nested site navigation, followed immediately by the submenu list. DO NOT use `<details>` and `<summary>`: `<summary>` should map to a `button` role, but has not been consistently implemented in browsers, so screen readers announce it inconsistently (for example as "summary" or "disclosure triangle").

One list must be an inline disclosure when narrow and a floating popover when wide. A top-layer popover cannot render in flow, so `popover` is set only in the wide layout, where `popovertarget` opens it natively. Leave `popover` off the submenu in the markup: without script it stays a nested list inside the menu, matching the narrow layout. In the narrow layout a small click handler toggles `hidden` and `aria-expanded`. Hide the narrow submenu from script, not in the markup.

Synchronize the layout state from the same function that handles the navigation list. When inline, set `popover="auto"` on the submenu, clear `hidden`, and let the native `toggle` event drive `aria-expanded`. When narrow, remove `popover`, set `hidden` from script, and let a click handler toggle `hidden` and `aria-expanded`:

```js
const wide = inner.scrollWidth <= inner.clientWidth; // measured with is-wide set
if (wide) submenu.setAttribute("popover", "auto");
else submenu.removeAttribute("popover");
submenu.hidden = !wide;
trigger.setAttribute("aria-expanded", "false");
```

> [!NOTE]
> Use `setAttribute()`/`removeAttribute()`, NOT the `popover` JS property, as it can cause race conditions if popover is used through a polyfill.

Do not add document-level click-outside, Escape or focus-restoration handlers. The native popover provides those interactions in the wide layout, and the narrow disclosure needs only the click handler. The declarative `popovertarget` makes the button the submenu's implicit anchor, so wide-layout positioning can use `position-area` without a separate `anchor-name` or `position-anchor` declaration.

### Hover preview

In the wide layout, open the submenu (`submenu.showPopover({ source: trigger })`) on `pointerenter` of the parent `<li>` when `matchMedia("(hover: hover)").matches` and `event.pointerType !== "touch"`, and hide it on `pointerleave` if it is still only hover-previewed (if the user clicks the trigger while previewing, clear the preview flag and call `event.preventDefault()` so the click pins it open instead of toggling it closed). Do not open it when the trigger receives keyboard focus; only `Enter` or `Space` toggles it. Close the open submenu when focus moves to an element outside the submenu's whole list item (`focusout` with a non-null `relatedTarget` outside it), so tabbing or `Shift`+`Tab`bing away closes it.

Position the wide submenu below its trigger with CSS Anchor Positioning (`position-area: block-end span-inline-end` and `position-try-fallbacks: flip-block, flip-inline`). For collision-aware positioning of a plain popover, see {{ GUIDE_REF("viewport-aware-dropdowns") }}. Add a `::before` bridge across any margin gap above the submenu (with `overflow: visible` on the popover) so moving the pointer from the trigger into the submenu does not fire `pointerleave`, and set `height: auto` to prevent Safari from stretching the positioned popover to its placement area:

```css
.site-header.is-wide {
  .dropdown-list[popover] {
    position: absolute;
    position-area: block-end span-inline-end;
    position-try-fallbacks: flip-block, flip-inline;
    inset: auto;
    height: auto;
    inline-size: max-content;
    min-inline-size: 12rem;
    margin-block-start: 0.5rem;
    overflow: visible;
  }

  .dropdown-list::before {
    content: "";
    position: absolute;
    inset-inline: 0;
    inset-block-end: 100%;
    block-size: 0.5rem;
  }

  /* Also hides the list before script sets popover, so an open narrow disclosure cannot widen the measured row */
  .dropdown-list:not(:is(:popover-open, .\:popover-open)) {
    display: none;
  }

  .dropdown-list:is(:popover-open, .\:popover-open) {
    display: grid;
  }
}
```


## Indicating the Current Page

Use `aria-current="page"` to identify the current page. Set it at build time or with JavaScript, and use `[aria-current="page"]` as the CSS styling hook. The visual treatment is a design decision; do not assume a particular pseudo-element, border, or orientation. Do not indicate the current page with color alone (WCAG 1.4.1). Ensure the color of the visual indicator has a contrast of at least `3:1` with the background color.

## Transitions and Accessibility

If the navigation is animated (optional; add it when the abrupt open and close feels out of place), use `@starting-style`, include `display` and `overlay` in `transition`, and declare `transition-behavior: allow-discrete` as a separate property after `transition` (DO NOT put `allow-discrete` in the `transition` shorthand, which makes older browsers ignore the entire `transition` declaration) for both the mobile menu and the wide floating submenu. Animate only `opacity` and `translate`, and respect `prefers-reduced-motion`. For the reusable transition pattern, see {{ GUIDE_REF("animate-element-entry-exit") }}.

### Optional: Narrow submenu slide-down

Optional. In the narrow layout the submenu is an inline list toggled with `hidden`, which opens instantly by default and is fully functional that way. To slide it open and closed:

- Keep the `[hidden]` list rendered with `display: grid` and `block-size: 0`, then transition `block-size` to `auto` with `interpolate-size: allow-keywords` and `clip-path: inset(-6px)` to clip the slide without cutting off the focus ring (not `overflow: clip`, which clips the ring; `6px` is an example, use at least the ring's outline width plus offset).
- Set `content-visibility: hidden` on the `[hidden]` list, include `content-visibility` in `transition`, and declare `transition-behavior: allow-discrete` separately after `transition` so the content stays rendered until the close finishes.
- Scope it to the collapsed layout and `prefers-reduced-motion: no-preference`; outside it, `[hidden]` must stay `display: none`. In the wide layout the submenu is a popover and must not be clipped.
- For the general technique, see {{ GUIDE_REF("animate-to-intrinsic-sizes") }}.

Use logical properties for sizing, spacing, and positioning. Use `dvw` and `dvh` for viewport-relative limits, provide visible `:focus-visible` indicators, and adapt custom borders and current-page indicators under `forced-colors: active`.


## Fallbacks

{{ FEATURE_FALLBACKS("popover") }}

### Fallbacks & browser support for Anchor positioning

{{ BASELINE_STATUS("anchor-positioning") }}

For the mobile menu, put an absolute fallback declaration before the `anchor()` declaration. Do not wrap this simple fallback in an `@supports` rule: an unsupported `anchor()` declaration is discarded while the preceding declaration remains valid. Without Anchor Positioning the menu still opens as a popover at a fixed offset from the top of the viewport.

```css
.site-header {
  .site-menu {
    /* Example-only offset: use roughly your header height. Browsers without anchor() keep this one. */
    inset-block-start: 4.75rem;
    inset-block-start: anchor(--menu-button bottom);
  }
}
```

For the wide floating submenu, without CSS Anchor Positioning a popover falls back to centered viewport placement, which detaches the submenu from its navbar trigger. Override the submenu to `position: fixed; margin: 0` inside `@supports not (position-area: block-end)`, and when `event.newState === "open" && !CSS.supports("position-area", "block-end")` in the submenu's `toggle` handler, compute `top` and `left` from `trigger.getBoundingClientRect()` and `submenu.getBoundingClientRect()` (placing it below the trigger, flipping above if `top + size.height > innerHeight`, and clamping `left` to `[0, innerWidth - size.width]`).

### Transitions

{{ BASELINE_STATUS("starting-style") }}

{{ BASELINE_STATUS("transition-behavior") }}

{{ BASELINE_STATUS("interpolate-size") }}

{{ BASELINE_STATUS("content-visibility") }}

Gate the optional narrow submenu slide-down rules that override `[hidden]` with `display: grid` behind `@supports (interpolate-size: allow-keywords)`. Without the gate, browsers lacking keyword interpolation snap the list closed instead of sliding; with it, they keep native `[hidden]` behavior. Without `@starting-style` or `transition-behavior: allow-discrete`, the optional popover entry or exit transitions fall back to opening or closing immediately.

Without script nothing adds `is-wide`, so the header stays collapsed: the menu button opens the native popover and the submenu is a nested list. Do not write a separate no-script layout or a `no-js` class.

