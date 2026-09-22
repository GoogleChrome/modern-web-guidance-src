---
name: navbar
description: Build a site navigation bar that adapts across screen sizes and indicates the current page.
web-feature-ids:
  - popover
  - anchor-positioning
guides:
  - menu
  - overflow-popup
  - responsive-disclosure
---

# Responsive Site Navigation (Popover + Anchor Positioning)

A modern site navigation bar must adapt seamlessly across screen sizes, provide robust accessibility, and remain performant.

By combining the native **Popover API** and **CSS Anchor Positioning**, we can build a responsive navigation bar using a **single, semantic markup tree** without duplicate markup or heavy JS toggles. On narrow containers, the nav acts as an overlay popover that light-dismisses and anchors to the trigger. On wide containers, container queries transform it into an inline static header.

For component-driven layouts, container queries, fluid sizing, and typographic line-wrapping, see {{ GUIDE_REF("size-aware-styling") }}, {{ GUIDE_REF("fluid-scaling") }}, and {{ GUIDE_REF("improve-text-layout-and-legibility") }}. For color-scheme management and theme overrides, see {{ GUIDE_REF("component-specific-light-dark-theme") }}.

---

## Core Markup

Use a single `<nav>` container for both narrow and wide layouts. Wrap it in a semantic `<header>` that acts as the layout query container (`container-type: inline-size`).

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
        <li>
          <a class="menu-link" href="index.html" aria-current="page">Home</a>
        </li>
        <li>
          <a class="menu-link" href="about.html">About</a>
        </li>
      </ul>
    </nav>
  </div>
</header>
```

### Key Markup Notes:
- **`<nav>` wrapper**: Wrapping both the trigger button and the popover menu ensures the navigation landmark remains discoverable by screen readers while the popover is closed.
- **`popover="auto"`**: Provides keyboard dismiss (Escape), light dismiss, and accessible focus order on mobile. For details, see {{ GUIDE_REF("declarative-dialog-popover-control") }}.
- **`popovertarget` / `aria-controls`**: Establishes the declarative toggle contract without JavaScript.
- **`aria-current="page"`**: Conveys the active page to assistive technology.
- **`aria-hidden="true"` / `focusable="false"`**: Excludes the visual menu icon from screen readers.

---

## Narrow Viewports: Popover and Anchor Positioning

In narrow layouts, use CSS Anchor Positioning to tether the popover navigation panel to the trigger button.

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
    inset-block-start: anchor(--menu-button bottom);
    inset-inline-end: anchor(--menu-button right);
    inline-size: 80dvw;
    max-inline-size: calc(100dvw - 2rem);
    block-size: fit-content;
    margin-block-start: 0.5rem;
    overflow: auto;
  }
}
```

For more anchor-positioning patterns, see {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}.

---

## Wide Viewports: Transforming to Static Layout

To reuse the `<nav>` container on desktop, override the native popover styles so the menu displays inline instead of as an overlay.

```css
@container (inline-size >= 45rem) {
  .menu-button {
    display: none;
  }

  .site-menu {
    position: static;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    inline-size: auto;
    block-size: auto;
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

---

## Nested Dropdowns (Sub-navigation)

For sub-navigation, use native `<details>` and `<summary>` elements. They act as inline expandable lists on mobile. On desktop, they function as resilient floating dropdowns positioned using modern CSS Anchor Positioning, aligning with the techniques in {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}.

### Core Markup for Sub-navigation

```html
<li>
  <details class="nav-dropdown">
    <summary class="menu-link dropdown-trigger">
      <span>Services</span>
      <svg class="dropdown-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
      </svg>
    </summary>
    <ul class="dropdown-list">
      <li><a class="menu-link" href="design.html">Design</a></li>
      <li><a class="menu-link" href="development.html">Development</a></li>
    </ul>
  </details>
</li>
```

### Styling the Nested Sub-navigation

```css
.nav-dropdown > summary {
  list-style: none;
}
.nav-dropdown > summary::-webkit-details-marker {
  display: none;
}
.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  cursor: pointer;
}
.dropdown-icon {
  inline-size: 1.15rem;
  block-size: 1.15rem;
  transition: transform 180ms ease;
}
.nav-dropdown[open] .dropdown-icon {
  transform: rotate(180deg);
}

@container (inline-size < 45rem) {
  .dropdown-list {
    display: grid;
    gap: 0.25rem;
    padding-inline-start: 1.5rem;
  }
}

@container (inline-size >= 45rem) {
  .dropdown-trigger {
    anchor-name: --services-trigger;
  }
  .dropdown-list {
    position: absolute;
    position-anchor: --services-trigger;
    position-area: block-end span-inline-end;
    position-try-fallbacks: flip-block;
    inset: auto;
    display: grid;
    gap: 0.25rem;
    inline-size: max-content;
    min-inline-size: 12rem;
    padding: 0.5rem;
    z-index: 10;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 15%);
  }
}
```

For a deeper dive on edge-resilient overlay menus, see {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}. For sliding active visual indicators using anchor positioning, see {{ GUIDE_REF("anchor-positioning-tab-underline") }}.

### Dismissing Dropdowns on Click Outside and Escape

Because `<details>` elements do not natively close when clicking outside or pressing Escape, use a lightweight listener on desktop.

```javascript
document.addEventListener("click", (event) => {
  const isDesktop = getComputedStyle(document.querySelector(".menu-button")).display === "none";
  if (!isDesktop) return;

  document.querySelectorAll(".nav-dropdown[open]").forEach((details) => {
    if (!details.contains(event.target)) {
      details.removeAttribute("open");
    }
  });
});

document.addEventListener("keydown", (event) => {
  const isDesktop = getComputedStyle(document.querySelector(".menu-button")).display === "none";
  if (!isDesktop) return;

  if (event.key === "Escape") {
    document.querySelectorAll(".nav-dropdown[open]").forEach((details) => {
      details.removeAttribute("open");
      details.querySelector("summary").focus();
    });
  }
});
```

---

## Synchronizing Layout Resize

If a user resizes the browser to desktop while the mobile popover is active, the popover remains open in the background, causing accessibility issues. Use `ResizeObserver` to dismiss the popover when transitioning to desktop.

```javascript
const navigation = document.querySelector("#site-menu");
const header = document.querySelector(".site-header");
const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
const desktopBreakpoint = 45 * rootFontSize;

function closeNavigationOnDesktop(entry) {
  if (entry.contentRect.width >= desktopBreakpoint && navigation.matches(":popover-open")) {
    navigation.hidePopover();
  }
}

const headerObserver = new ResizeObserver(([entry]) => closeNavigationOnDesktop(entry));
headerObserver.observe(header);
```

---

## Indicating the Active Page

Convey the active page visually using a pseudo-element (`::before`) on the active link. Highlight the active page natively using the CSS `:local-link` pseudo-class and the semantic `aria-current="page"` attribute.

```css
.menu-link[aria-current="page"],
.menu-link:local-link {
  color: var(--accent);
}

@container (inline-size < 45rem) {
  .menu-link[aria-current="page"]::before,
  .menu-link:local-link::before {
    position: absolute;
    inset-block: 0.75rem;
    inset-inline-start: 0.3rem;
    inline-size: 0.2rem;
    border-radius: 99rem;
    background: currentColor;
    content: "";
  }
}

@container (inline-size >= 45rem) {
  .menu-link[aria-current="page"]::before,
  .menu-link:local-link::before {
    inset-block: auto 0.1rem;
    inset-inline: 0.8rem;
    inline-size: auto;
    block-size: 0.2rem;
  }
}
```

---

## Smooth Entry & Exit Transitions

Animate the popover transition on mobile layouts using `@starting-style` and `allow-discrete` to smoothly animate opacity and transform when toggled. For a complete guide on entry/exit animations, see {{ GUIDE_REF("animate-element-entry-exit") }}.

```css
@media (prefers-reduced-motion: no-preference) {
  @container (inline-size < 45rem) {
    .site-menu {
      transition: display 0.2s allow-discrete, opacity 0.2s ease, transform 0.2s ease;
      opacity: 0;
      transform: translateY(-0.5rem);
    }

    .site-menu:popover-open {
      opacity: 1;
      transform: translateY(0);
    }

    @starting-style {
      .site-menu:popover-open {
        opacity: 0;
        transform: translateY(-0.5rem);
      }
    }
  }
}
```

---

## Fallback Strategies

{{ FEATURE_FALLBACKS("anchor-positioning") }}

For browsers that do not support CSS Anchor Positioning, provide an absolute position fallback.

```css
@container (inline-size < 45rem) {
  @supports not (inset-block-start: anchor(--menu-button bottom)) {
    .site-menu {
      inset-block-start: 4.75rem;
      inset-inline-end: 1rem;
    }
  }
}
```

For guidelines on applying component-specific colors, see {{ GUIDE_REF("component-specific-light-dark-theme") }}.
