---
name: navbar
description: Build a site navigation bar that adapts across screen sizes and indicates the current page.
web-feature-ids:
  - popover
  - anchor-positioning
  - viewport-units
  - logical-properties
  - focus-visible
  - forced-colors
  - starting-style
  - transition-behavior
  - interpolate-size
# - local-link
guides:
  - icons
  - animate-to-intrinsic-sizes
  - menu
---

# Responsive Site Navigation

Build a site navigation bar that uses one semantic navigation tree at every size, presents a native popover when the links do not fit, becomes an inline navigation when they do, and identifies the current page.

This guide describes site-navigation integration. It is navigation, not an application menu: links stay in the `Tab` order, with no `focusgroup`, `role="menu"`, `role="menuitem"`, `aria-haspopup="menu"` or arrow-key handling. For opening, positioning, hover preview and animating popovers, see {{ GUIDE_REF("menu") }}. For the menu and chevron icons, see {{ GUIDE_REF("icons") }}.

For component-driven layouts, fluid sizing, and typographic line-wrapping, see {{ GUIDE_REF("size-aware-styling") }}, {{ GUIDE_REF("fluid-scaling") }}, and {{ GUIDE_REF("improve-text-layout-and-legibility") }}.


## Core Markup

Use one `<nav>` landmark for narrow and wide layouts. Wrap it in a semantic `<header>` whose `data-nav` attribute (`inline` or `collapsed`) selects the layout.

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

There is no hard-coded breakpoint. Script collapses the navigation only when the inline row (brand, actions and every link) does not fit, so adding a link, a translation or larger text moves the point automatically. It sets `data-nav="collapsed"` on the header; without script the header keeps the inline layout.

```css
/* Keep the row's natural width measurable */
.header-inner > * {
  flex-shrink: 0;
  white-space: nowrap;
}

.site-header[data-nav="collapsed"] {
  .menu-button {
    anchor-name: --menu-button;
  }

  .site-menu {
    position: fixed;
    inset: auto;
    inset-block-start: anchor(--menu-button bottom);
    inset-inline-end: 1rem;
    inline-size: 80dvw;
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
.site-header:not([data-nav="collapsed"]) {
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

CSS changes the presentation, but JavaScript decides which layout applies and must also synchronize the `popover` attribute with it. Measure the inline row: show it inline, compare `scrollWidth` with `clientWidth` on the header's inner row, then set `data-nav`. Keep the navigation as a popover only in the collapsed layout; remove the attribute in the inline layout. Removing it closes an open popover, while restoring it leaves the menu closed until the trigger opens it. Run one shared function from a `ResizeObserver` (on width changes only, since collapsing changes the header's height) and again when `document.fonts.ready` resolves. Do not infer the layout from a hidden trigger.


## Nested Site Navigation

Use a `<button>` with `aria-expanded` and `aria-controls` as the trigger for nested site navigation, followed immediately by the submenu list. DO NOT use `<details>` and `<summary>`: `<summary>` has no ARIA role mapping, so screen readers announce it inconsistently (for example as a "disclosure triangle") and some do not announce the open state.

One list must be an inline disclosure when narrow and a floating popover when wide. A top-layer popover cannot render in flow, so `popover` is set only in the wide layout, where `popovertarget` opens it natively. In the narrow layout a small click handler toggles `hidden` and `aria-expanded`. Hide the narrow submenu from script, not in the markup, so its links stay visible without scripting.

Synchronize the layout state from the same function that handles the navigation list. When inline, set `popover="auto"` on the submenu, show it and let the native `toggle` event drive `aria-expanded`. When narrow, remove `popover`, set `hidden` from script and let a click handler toggle `hidden` and `aria-expanded`:

```js
const wide = inner.scrollWidth <= inner.clientWidth; // measured with data-nav="inline"
submenu.toggleAttribute("popover", wide);
submenu.hidden = !wide;
```

Do not add document-level click-outside, Escape or focus-restoration handlers. The native popover provides those interactions in the wide layout, and the narrow disclosure needs only the click handler. The declarative `popovertarget` makes the button the submenu's implicit anchor, so wide-layout positioning can use `position-area` without a separate `anchor-name` or `position-anchor` declaration.

### Hover preview

In the wide layout, preview the submenu on hover as described in {{ GUIDE_REF("menu") }}. Also preview it when the trigger receives keyboard focus (`:focus-visible` only, so a pointer click is not toggled twice); `Enter` or `Space` still toggles it.

Position the wide submenu with CSS Anchor Positioning as described in {{ GUIDE_REF("menu") }}, including its viewport-overflow fallbacks. For collision-aware positioning of a plain popover, see {{ GUIDE_REF("viewport-aware-dropdowns") }}. This submenu opens below its trigger, so use the top-level `position-area` there, not the menu guide's side-by-side submenu placement. Set `height: auto` on a wide floating submenu when needed to prevent Safari from stretching the positioned popover to its placement area:

```css
.site-header:not([data-nav="collapsed"]) {
  .dropdown-list[popover] { /* Scoped to the popover, so the list stays inline without scripting */
    position: absolute;
    position-area: block-end span-inline-end;
    position-try-fallbacks: flip-block;
    inset: auto;
    height: auto;
    inline-size: max-content;
    min-inline-size: 12rem;
  }

  .dropdown-list:popover-open {
    display: grid;
  }
}
```


## Indicating the Current Page

Use `aria-current="page"` to identify the current page. Set it at build time or with JavaScript, and use `[aria-current="page"]` as the CSS styling hook. The visual treatment is a design decision; do not assume a particular pseudo-element, border, or orientation.


## Transitions and Accessibility

If the navigation is animated (optional; add it when the abrupt open and close feels out of place), use `@starting-style` and `allow-discrete` for popover entry and exit, animate the popover with only `opacity` and `transform`, and respect `prefers-reduced-motion`. For the reusable transition pattern, see {{ GUIDE_REF("animate-element-entry-exit") }}. For a worked popover open and close transition, see {{ GUIDE_REF("menu") }}; use it for the wide floating submenu too.

### Narrow submenu slide-down

Optional. In the narrow layout the submenu is an inline list toggled with `hidden`, which opens instantly by default and is fully functional that way. To slide it open and closed:

- Keep the `[hidden]` list rendered with `display: grid` and `block-size: 0`, then transition `block-size` to `auto` with `interpolate-size: allow-keywords` and `overflow: clip`.
- Include `content-visibility: hidden` with `allow-discrete` in the transition so the content stays rendered until the close finishes.
- Scope it to the collapsed layout and `prefers-reduced-motion: no-preference`; outside it, `[hidden]` must stay `display: none`. In the wide layout the submenu is a popover and must not be clipped.
- For the general technique, see {{ GUIDE_REF("animate-to-intrinsic-sizes") }}.

Use logical properties for sizing, spacing, and positioning. Use `dvw` and `dvh` for viewport-relative limits, provide visible `:focus-visible` indicators, and adapt custom borders and current-page indicators under `forced-colors: active`.


## Fallbacks

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

For the mobile menu, put an absolute fallback declaration before the `anchor()` declaration. Do not wrap this simple fallback in an `@supports` rule: an unsupported `anchor()` declaration is discarded while the preceding declaration remains valid. Without Anchor Positioning the menu still opens as a popover at a fixed offset from the top of the viewport.

```css
.site-header[data-nav="collapsed"] {
  .site-menu {
    /* Example-only offset: use roughly your header height. Browsers without anchor() keep this one. */
    inset-block-start: 4.75rem;
    inset-block-start: anchor(--menu-button bottom);
  }
}
```

For the wide floating submenu, use the Anchor Positioning fallbacks in {{ GUIDE_REF("menu") }}.

{{ BASELINE_STATUS("starting-style") }}

{{ BASELINE_STATUS("transition-behavior") }}

{{ BASELINE_STATUS("interpolate-size") }}

Without `@starting-style` or `transition-behavior: allow-discrete`, the optional popover transitions are skipped, and without `interpolate-size` the narrow submenu slide-down is skipped too; the navigation and submenu open and close instantly, which is progressive enhancement and fully functional.

