---
name: navbar
description: Build a site navigation bar that adapts across screen sizes and indicates the current page.
web-feature-ids:
  - popover
  - anchor-positioning
  - container-queries
  - viewport-units
  - logical-properties
  - focus-visible
  - forced-colors
  - starting-style
  - transition-behavior
# - local-link
guides:
  - responsive-disclosure
  - icons
  - menu
---

# Responsive Site Navigation

Build a site navigation bar that uses one semantic navigation tree at every size, presents a native popover on narrow containers, becomes an inline navigation on wide containers, and identifies the current page.

This guide describes site-navigation integration. It is navigation, not an application menu: links stay in the `Tab` order, with no `focusgroup`, `role="menu"`, `role="menuitem"`, `aria-haspopup="menu"` or arrow-key handling. For positioning and animating the popover, see {{ GUIDE_REF("menu") }}. Use only those popover techniques, not its `focusgroup` and arrow-key menu model. For reusable responsive disclosure behavior, see {{ GUIDE_REF("responsive-disclosure") }}. For the menu and chevron icons, see {{ GUIDE_REF("icons") }}.

For component-driven layouts, fluid sizing, and typographic line-wrapping, see {{ GUIDE_REF("size-aware-styling") }}, {{ GUIDE_REF("fluid-scaling") }}, and {{ GUIDE_REF("improve-text-layout-and-legibility") }}.


## Core Markup

Use one `<nav>` landmark for narrow and wide layouts. Wrap it in a semantic `<header>` that acts as the layout query container with `container-type: inline-size`.

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

On narrow containers, keep `popover="auto"` on the navigation list. Anchor the fixed popover to the menu button and constrain its height so a long navigation can scroll without exceeding the viewport.

The breakpoint is the container width at which the inline row (brand, actions and every link) stops fitting. The values below are examples: measure your own widest inline row and round up, in `rem` so text zoom scales it. A short navigation can collapse at a narrower width. When items are added, raise it: too low causes horizontal scrolling, too high collapses a navigation that would have fit.

{# Maintainer note: @container conditions cannot use var(), so the breakpoint is repeated by hand in each query and in the script. #}

```css
.site-header {
  container-type: inline-size;
}

/* Example value: use the width at which your inline row stops fitting */
@container (inline-size < 45rem) {
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

On wide containers, hide the narrow-layout trigger and reset the popover presentation so the same list participates in the header as an inline navigation.

```css
/* Same value as the narrow query */
@container (inline-size >= 45rem) {
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

CSS changes the presentation, but JavaScript must also synchronize the `popover` attribute with the header's container-query state. Keep the navigation as a popover only in the narrow layout; remove the attribute in the wide layout. Removing it closes an open popover, while restoring it leaves the menu closed until the trigger opens it. Use one shared layout-state function for the initial state and subsequent `ResizeObserver` updates; do not infer the layout from a hidden trigger or maintain a second breakpoint check.


## Nested Site Navigation

Use a `<button>` with `aria-expanded` and `aria-controls` as the trigger for nested site navigation, followed immediately by the submenu list. DO NOT use `<details>` and `<summary>`: `<summary>` has no ARIA role mapping, so screen readers announce it inconsistently (for example as a "disclosure triangle") and some do not announce the open state.

One list must be an inline disclosure when narrow and a floating popover when wide. A top-layer popover cannot render in flow, so `popover` is set only in the wide layout, where `popovertarget` opens it natively. In the narrow layout a small click handler toggles `hidden` and `aria-expanded`. Hide the narrow submenu from script, not in the markup, so its links stay visible without scripting. Keep the reusable disclosure behavior in {{ GUIDE_REF("responsive-disclosure") }}.

Synchronize the `popover` attributes across the container breakpoint and keep `aria-expanded` in step with the submenu:

```js
const header = document.querySelector(".site-header");
const menu = document.querySelector("#site-menu");
const trigger = document.querySelector(".dropdown-trigger");
const submenu = document.querySelector("#services-menu");

const setExpanded = (open) => trigger.setAttribute("aria-expanded", String(open));

// Narrow layout: an inline disclosure, hidden by script
submenu.hidden = true;
trigger.addEventListener("click", () => {
  if (submenu.matches("[popover]")) return; // Wide layout: the native popover handles the click
  submenu.hidden = !submenu.hidden;
  setExpanded(!submenu.hidden);
});

// Wide layout: follow the native popover
submenu.addEventListener("toggle", (event) => {
  setExpanded(event.newState === "open");
});

function syncLayoutState(width) {
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const isWide = width >= 45 * rootFontSize; // Keep equal to the container query width

  if (isWide && menu.hasAttribute("popover")) {
    menu.removeAttribute("popover");
    submenu.hidden = false;
    submenu.setAttribute("popover", "auto");
    setExpanded(false);
  } else if (!isWide && !menu.hasAttribute("popover")) {
    menu.setAttribute("popover", "auto");
    submenu.removeAttribute("popover");
    submenu.hidden = true;
    setExpanded(false);
  }
}

const layoutObserver = new ResizeObserver(([entry]) => {
  syncLayoutState(entry.contentRect.width);
});
layoutObserver.observe(header);
```

Do not add document-level click-outside, Escape or focus-restoration handlers. The native popover provides those interactions in the wide layout, and the narrow disclosure needs only the click handler above. The declarative `popovertarget` makes the button the submenu's implicit anchor, so wide-layout positioning can use `position-area` without a separate `anchor-name` or `position-anchor` declaration.

### Hover preview

As well as click and keyboard opening, preview the submenu on hover in the wide layout. Call `submenu.showPopover({ source: trigger })` on `pointerenter` of the wrapping `<li>` and `hidePopover()` on `pointerleave`. Keep any margin between the trigger and the submenu hoverable with a transparent `::before` that fills it (the submenu needs `overflow: visible`, since a popover clips by default), so the pointer never leaves the `<li>` while crossing and no close delay is needed. Run it only when `matchMedia("(hover: hover)").matches` and the submenu is a popover, ignore touch pointers, and close only a submenu the hover opened. A click on the trigger while the preview is open should keep it open: call `preventDefault()` on that click, because the native toggle would otherwise close it. Do not preview on focus: keyboard users open the submenu with `Enter` or `Space` on the button.

Position the wide submenu with CSS Anchor Positioning as described in {{ GUIDE_REF("menu") }}, including its viewport-overflow fallbacks. For collision-aware positioning of a plain popover, see {{ GUIDE_REF("viewport-aware-dropdowns") }}. This submenu opens below its trigger, so use the top-level `position-area` there, not the menu guide's side-by-side submenu placement. Set `height: auto` on a wide floating submenu when needed to prevent Safari from stretching the positioned popover to its placement area:

```css
/* Same value as the narrow query */
@container (inline-size >= 45rem) {
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

Use logical properties for sizing, spacing, and positioning. Use `dvw` and `dvh` for viewport-relative limits, provide visible `:focus-visible` indicators, and adapt custom borders and current-page indicators under `forced-colors: active`.


## Fallbacks

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

For the mobile menu, put an absolute fallback declaration before the `anchor()` declaration. Do not wrap this simple fallback in an `@supports` rule: an unsupported `anchor()` declaration is discarded while the preceding declaration remains valid. Without Anchor Positioning the menu still opens as a popover at a fixed offset from the top of the viewport.

```css
/* Same value as the narrow query above */
@container (inline-size < 45rem) {
  .site-menu {
    /* Example-only offset: use roughly your header height. Browsers without anchor() keep this one. */
    inset-block-start: 4.75rem;
    inset-block-start: anchor(--menu-button bottom);
  }
}
```

The wide floating submenu is different: without Anchor Positioning a popover falls back to centered viewport placement and detaches from its trigger, which a single declaration cannot fix. Position it from script instead, and gate the overrides with `@supports not (position-area: block-end)` so browsers with Anchor Positioning are unaffected:

- In the submenu's `toggle` handler, when it opens and `CSS.supports("position-area", "block-end")` is false, place it below the trigger, flipping above and clamping to the viewport when it would overflow.
- Apply the result as `left` and `top`, with `position: fixed`, `inset: auto` and `margin: 0` so the coordinates are viewport-relative.

If `showPopover({ source })` is unavailable for the hover preview, give the trigger an `anchor-name` and the submenu a matching `position-anchor` instead of relying on the implicit anchor.

{{ BASELINE_STATUS("starting-style") }}

{{ BASELINE_STATUS("transition-behavior") }}

Without `@starting-style` or `transition-behavior: allow-discrete`, the optional popover transitions are skipped and the navigation and submenu open and close instantly, which is progressive enhancement and fully functional.

