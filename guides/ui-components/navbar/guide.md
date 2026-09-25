---
name: navbar
description: Build a site navigation bar that adapts across screen sizes and indicates the current page.
web-feature-ids:
  - popover
  - anchor-positioning
guides:
  - responsive-disclosure
  - icons
---

# Responsive Site Navigation

Build a site navigation bar that uses one semantic navigation tree at every size, presents a native popover on narrow containers, becomes an inline navigation on wide containers, and identifies the current page.

This guide describes site-navigation integration. It does not define application-menu behaviour. For reusable responsive disclosure behaviour, see {{ GUIDE_REF("responsive-disclosure") }}. For the decorative chevron, see {{ GUIDE_REF("icons") }}.

For component-driven layouts, fluid sizing, and typographic line-wrapping, see {{ GUIDE_REF("size-aware-styling") }}, {{ GUIDE_REF("fluid-scaling") }}, and {{ GUIDE_REF("improve-text-layout-and-legibility") }}.

---

## Core Markup

Use one `<nav>` landmark for narrow and wide layouts. Wrap it in a semantic `<header>` that acts as the layout query container with `container-type: inline-size`.

```html
<header class="site-header">
  <div class="header-inner">
    <a class="site-logo" href="index.html">Acme</a>

    <nav class="site-nav" aria-label="Primary navigation">
      <button
        class="menu-button"
        type="button"
        popovertarget="site-menu"
        popovertargetaction="toggle"
        aria-controls="site-menu"
      >
        <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
        </svg>
        <span>Menu</span>
      </button>

      <ul id="site-menu" class="site-menu" popover="auto">
        <li><a class="menu-link" href="index.html" aria-current="page">Home</a></li>
        <li><a class="menu-link" href="about.html">About</a></li>
      </ul>
    </nav>
  </div>
</header>
```

The button declaratively controls the menu with `popovertarget` and `aria-controls`. The `nav` remains the navigation landmark while the menu is closed. The decorative trigger icon is hidden from assistive technologies with `aria-hidden="true"` and `focusable="false"`. For the general popover control contract, see {{ GUIDE_REF("declarative-dialog-popover-control") }}.

---

## Narrow Layout: Popover Navigation

On narrow containers, keep `popover="auto"` on the navigation list. Anchor the fixed popover to the menu button and constrain its height so a long navigation can scroll without exceeding the viewport.

```css
.site-header {
  container-type: inline-size;
}

@container (inline-size < 45rem) {
  .menu-button {
    anchor-name: --menu-button;
  }

  .site-menu {
    position: fixed;
    inset: auto;
    inset-block-start: 4.75rem; /* fallback */
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

The first `inset-block-start` declaration is the fallback; the later `anchor()` declaration overrides it where Anchor Positioning is supported. For collision-aware positioning near viewport edges, see {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}.

---

## Wide Layout: Inline Navigation

On wide containers, hide the narrow-layout trigger and reset the popover presentation so the same list participates in the header as an inline navigation.

```css
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

CSS changes the presentation, but JavaScript must also synchronise the `popover` attribute with the header's container-query state. Keep the navigation as a popover only in the narrow layout; remove the attribute in the wide layout. Removing it closes an open popover, while restoring it leaves the menu closed until the trigger opens it. Use one shared layout-state function for the initial state and subsequent `ResizeObserver` updates; do not infer the layout from a hidden trigger or maintain a second breakpoint check.

---

## Nested Site Navigation

Use `<details>` and `<summary>` for nested site navigation, with the submenu represented by a nested list. Keep the submenu inline inside the narrow navigation popover. If the wide layout requires a floating submenu, promote that list to a native `popover="auto"` and synchronise it with the disclosure; keep the reusable disclosure behaviour in {{ GUIDE_REF("responsive-disclosure") }}.

The site-navigation-specific synchronisation is (use one shared layout-state function for the outer navigation as shown in the demo):

```js
const details = document.querySelector(".nav-dropdown");
const summary = details.querySelector("summary");
const submenu = details.querySelector(".dropdown-list");

details.addEventListener("toggle", () => {
  if (submenu.matches("[popover]")) {
    submenu.togglePopover({
      force: details.open,
      source: summary
    });
  }
});

submenu.addEventListener("toggle", (event) => {
  details.open = event.newState === "open";
});
```

Do not add document-level click-outside, Escape, focus-restoration, or expanded-state handlers. Native disclosure and popover behaviour provide those interactions. Let `<details>` own the summary click: intercepting it can reopen a submenu that light dismiss is trying to close. The `source: summary` option supplies the submenu's implicit anchor, so wide-layout positioning can use `position-area` without a separate `anchor-name` or `position-anchor` declaration.

For collision-aware submenu positioning, see {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}. Set `height: auto` on a wide floating submenu when needed to prevent Safari from stretching the positioned popover to its placement area:

```css
@container (inline-size >= 45rem) {
  .dropdown-list {
    position: absolute;
    position-area: block-end span-inline-end;
    position-try-fallbacks: flip-block;
    inset: auto;
    height: auto;
    display: grid;
    inline-size: max-content;
    min-inline-size: 12rem;
  }
}
```

---

## Indicating the Current Page

Use `aria-current="page"` to identify the current page. Set it at build time or with JavaScript, and use `[aria-current="page"]` as the CSS styling hook. The visual treatment is a design decision; do not assume a particular pseudo-element, border, or orientation.

---

## Transitions and Accessibility

If the navigation is animated, use `@starting-style` and `allow-discrete` for popover entry and exit, animate only `opacity` and `transform`, and respect `prefers-reduced-motion`. For the reusable transition pattern, see {{ GUIDE_REF("animate-element-entry-exit") }}.

Use logical properties for sizing, spacing, and positioning. Use `dvw` and `dvh` for viewport-relative limits, provide visible `:focus-visible` indicators, and adapt custom borders and current-page indicators under `forced-colors: active`.

---

## Fallbacks

{{ FEATURE_FALLBACKS("anchor-positioning") }}

For the mobile menu, put the absolute fallback declaration before the `anchor()` declaration. Do not wrap this simple fallback in an `@supports` rule: an unsupported `anchor()` declaration is discarded while the preceding declaration remains valid.
