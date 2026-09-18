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

## Core Markup (Single Semantic Tree)

Avoid duplicating navigation links. Use a single `<nav>` container for both mobile and desktop layouts, paired with a semantic native `<button>` trigger.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<header class="site-header">
  <div class="header-inner">
    <a class="site-logo" href="index.html">Acme</a>

    <!-- Mobile menu trigger -->
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

    <!-- Navigation menu acting as popover on mobile -->
    <nav id="site-menu" class="site-menu" popover="auto" aria-label="Primary navigation">
      <ul class="menu-list">
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

<main id="content" tabindex="-1">
  <h1>Page title</h1>
</main>
</body>
</html>
```

### Key Markup Notes:
- **`popover="auto"`**: Declares the navigation element as a native top-layer popover. It automatically benefits from keyboard dismiss (Escape), light dismiss (clicking outside), and correct tab focus order on mobile. For a comprehensive guide on declarative Popover attributes, see {{ GUIDE_REF("declarative-dialog-popover-control") }}.
- **`popovertarget` and `aria-controls`**: Establishes the declarative toggle contract without manual JS listeners.
- **`aria-current="page"`**: Explicitly conveys the active/current page to assistive technology.
- **Icon Visibility**: The SVG trigger icon uses `aria-hidden="true"` and `focusable="false"` to prevent duplicate screening or keyboard confusion.

---

## Narrow Viewports: Popover and Anchor Positioning

In mobile/narrow layouts, use CSS Anchor Positioning to tether the popover menu to the trigger button so that it stays perfectly aligned even when the layout shifts.

To achieve this:
1. Establish the anchor by assigning `anchor-name` to the trigger button.
2. Position the popover using `anchor()` functions on the inset properties.

```css
@container (inline-size < 45rem) {
  .menu-button {
    /* Define the anchor name */
    anchor-name: --menu-button;
  }

  .site-menu {
    position: fixed;
    inset: auto;

    /* Align top edge of popover with bottom of menu button */
    inset-block-start: anchor(--menu-button bottom);
    /* Align right edge of popover with right edge of menu button */
    inset-inline-end: anchor(--menu-button right);

    inline-size: 80dvw;
    max-inline-size: calc(100dvw - 2rem);
    block-size: fit-content;
    margin-block-start: 0.5rem;
    overflow: auto;
  }
}
```

For foundational anchor-positioning concepts, implicit anchors, or floating elements, see {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}.

---

## Wide Viewports: Transforming to Static Layout

To reuse the exact same `<nav>` container inline in wide/desktop layouts, we must **override the default user-agent popover styles**. Because closed popovers default to `display: none` and open ones use `position: fixed` or `position: absolute`, we must manually reset these properties.

```css
@container (inline-size >= 45rem) {
  /* 1. Hide the mobile trigger button */
  .menu-button {
    display: none;
  }

  /* 2. Reset popover styling to integrate inline */
  .site-menu {
    position: static;      /* Override fixed/absolute positioning */
    display: block;        /* Force visibility regardless of popover status */
    inline-size: auto;
    block-size: auto;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    overflow: visible;
  }

  /* 3. Hide backdrop overlay on desktop */
  .site-menu::backdrop {
    display: none;
  }

  /* 4. Display menu items horizontally */
  .menu-list {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
}
```

---

## Synchronizing Layout Resize (JavaScript Constraint)

If a user opens the mobile menu popover and then resizes the browser to a wide viewport, the popover's internal state is still active (`:popover-open`). Although CSS overrides the visual presentation, keeping the popover state active causes issues with keyboard focus, light-dismiss, and accessibility state.

**You MUST use JavaScript to listen for the viewport breakpoint and dismiss the popover when transitioning to desktop.**

```javascript
const menu = document.querySelector("#site-menu");
const headerInner = document.querySelector(".header-inner");
const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
const desktopBreakpoint = 45 * rootFontSize;

function closeMenuOnDesktop(entry) {
  // Match the container query, not the viewport, so padding cannot cause a breakpoint mismatch.
  if (entry.contentRect.width >= desktopBreakpoint && menu.matches(":popover-open")) {
    menu.hidePopover();
  }
}

const headerObserver = new ResizeObserver(([entry]) => closeMenuOnDesktop(entry));
headerObserver.observe(headerInner);
```

---

## Indicating the Active Page

Convey the active page visually using a pseudo-element (`::before`) on the active link. The visual indicator should adapt its orientation dynamically to match the layout.

```css
/* Mobile: Vertical indicator bar on the left edge */
.menu-link[aria-current="page"] {
  color: var(--accent);
}

.menu-link[aria-current="page"]::before {
  position: absolute;
  inset-block: 0.75rem;
  inset-inline-start: 0.3rem;
  inline-size: 0.2rem;
  border-radius: 99rem;
  background: currentColor;
  content: "";
}

/* Desktop: Horizontal indicator bar at the bottom edge */
@container (inline-size >= 45rem) {
  .menu-link[aria-current="page"]::before {
    inset-block: auto 0.1rem;
    inset-inline: 0.8rem;
    inline-size: auto;
    block-size: 0.2rem;
  }
}
```

For a deeper look on using pseudo-elements and anchors to design sliding active visual indicators, see {{ GUIDE_REF("anchor-positioning-tab-underline") }}.

---

## Smooth Entry & Exit Transitions

On mobile, use `@starting-style` to enable entry and exit transitions for the popover element, resolving the traditional issue where `display: none` prevents CSS transitions.

```css
@media (prefers-reduced-motion: no-preference) {
  @container (inline-size < 45rem) {
    .site-menu {
      /* Transition the display property using allow-discrete */
      transition:
        display 180ms allow-discrete,
        opacity 180ms ease,
        transform 180ms ease;
      opacity: 0;
      transform: translateY(-0.5rem);
    }

    /* Target state when popover is open */
    .site-menu:popover-open {
      opacity: 1;
      transform: translateY(0);
    }

    /* Start states when entering the DOM / becoming visible */
    @starting-style {
      .site-menu:popover-open {
        opacity: 0;
        transform: translateY(-0.5rem);
      }
    }
  }
}
```

For more on modern transitions for elements toggled between `display: none` and visible, see {{ GUIDE_REF("animate-element-entry-exit") }} and {{ GUIDE_REF("animate-to-from-top-layer") }}.

---

## Fallback Strategies

{{ FEATURE_FALLBACKS("anchor-positioning") }}

For browsers that do not support CSS Anchor Positioning, provide a fallback absolute position using `@supports not`. This ensures the menu remains fully accessible and positioned sensibly.

```css
@container (inline-size < 45rem) {
  /* Fallback for browsers that do not support CSS anchor positioning */
  @supports not (inset-block-start: anchor(--menu-button bottom)) {
    .site-menu {
      inset-block-start: 4.75rem;
      inset-inline-end: 1rem;
    }
  }
}
```

For best practices on applying component-specific colors and resolving the `light-dark()` inheritance gotcha, see {{ GUIDE_REF("component-specific-light-dark-theme") }}.
