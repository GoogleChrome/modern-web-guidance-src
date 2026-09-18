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

Avoid duplicating navigation links. Use a single `<nav>` container for both mobile and desktop layouts, wrapped in a containing semantic `<header>` element that declares `container-type: inline-size` to serve as the layout query container.

```html
<!-- Container for container queries (container-type: inline-size) -->
<header class="site-header">
  <div class="header-inner">
    <a class="site-logo" href="index.html">Acme</a>

    <!-- Mobile navigation trigger button -->
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

    <!-- Navigation panel acting as a popover on mobile layouts -->
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
```

### Key Markup Notes:
- **`popover="auto"`**: Declares the navigation element as a native top-layer popover. It automatically benefits from keyboard dismiss (Escape), light dismiss (clicking outside), and correct tab focus order on mobile. For a comprehensive guide on declarative Popover attributes, see {{ GUIDE_REF("declarative-dialog-popover-control") }}.
- **`popovertarget` and `aria-controls`**: Establishes the declarative toggle contract without manual JS listeners.
- **`aria-current="page"`**: Explicitly conveys the active/current page to assistive technology.
- **Icon Visibility**: The SVG trigger icon uses `aria-hidden="true"` and `focusable="false"` to prevent duplicate screening or keyboard confusion.

---

## Narrow Viewports: Popover and Anchor Positioning

In mobile/narrow layouts, use CSS Anchor Positioning to tether the popover navigation panel to the trigger button so that it stays perfectly aligned even when the layout shifts.

To achieve this:
1. Establish the anchor by assigning `anchor-name` to the trigger button.
2. Position the popover using `anchor()` functions on the inset properties.

```css
/* Declare container type on parent header */
.site-header {
  container-type: inline-size;
}

@container (inline-size < 45rem) {
  .menu-button {
    /* Define the anchor name */
    anchor-name: --menu-button;
  }

  .site-menu {
    position: fixed;
    inset: auto;

    /* Align top edge of popover with bottom of navigation button */
    inset-block-start: anchor(--menu-button bottom);
    /* Align right edge of popover with right edge of navigation button */
    inset-inline-end: anchor(--menu-button right);

    inline-size: 80dvw;
    max-inline-size: calc(100dvw - 2rem);
    block-size: fit-content;
    margin-block-start: 0.5rem; /* Gap below the trigger */
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

  /* 2. Reset popover structural styling to integrate inline */
  .site-menu {
    position: static;      /* Override fixed/absolute positioning */
    display: block;        /* Force visibility regardless of popover status */
    inline-size: auto;
    block-size: auto;
    margin: 0;             /* MANDATORY: Clear native popover panel styles when inline */
    padding: 0;            /* MANDATORY: Clear native padding inside popovers */
    border: 0;             /* MANDATORY: Remove native borders from popovers */
    background: transparent; /* MANDATORY: Reset solid backgrounds when inline */
    box-shadow: none;      /* MANDATORY: Remove top-layer shadow when inline */
    overflow: visible;
  }

  /* 3. Hide backdrop overlay on desktop */
  .site-menu::backdrop {
    display: none;
  }

  /* 4. Display navigation items horizontally */
  .menu-list {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
}
```

---

## Nested Dropdowns (Sub-navigation)

For second-level navigation items, avoid creating nested overlay popovers on mobile viewports which are visually cluttered and difficult to navigate. Instead, use native `<details>` and `<summary>` elements to create sub-navigation lists that adapt structurally to both layout container sizes.

- **On narrow viewports:** The sub-navigation behaves as an inline expandable list (disclosure toggle) that naturally pushes other navigation links down.
- **On wide viewports:** The sub-navigation behaves as an absolutely positioned floating dropdown box.

### Core Markup for Sub-navigation

Wrap the sub-navigation list inside a `<details>` element within your `<li>` lists:

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

Hide native details arrow elements, style the custom chevron indicator, and control layout transitions between mobile inline expansion and desktop floating layouts.

```css
/* Base styles to clear native details arrows and style triggers */
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

/* Narrow layout: static, indented inline sub-list */
@container (inline-size < 45rem) {
  .dropdown-list {
    display: grid;
    gap: 0.25rem;
    padding-inline-start: 1.5rem; /* Indent sublinks inside mobile navigation panel */
  }
}

/* Wide layout: floating absolute-positioned sub-navigation card */
@container (inline-size >= 45rem) {
  .nav-dropdown {
    position: relative;
  }
  .dropdown-list {
    position: absolute;
    inset-block-start: 100%;
    inset-inline-start: 0;
    display: grid;
    gap: 0.25rem;
    inline-size: max-content;
    min-inline-size: 12rem;
    padding: 0.5rem;
    background: var(--surface-raised); /* MANDATORY: Prevents transparent background clashing with underlying text */
    border: 1px solid var(--border);    /* MANDATORY: Defensively sets borders to frame the card */
    border-radius: 0.5rem;
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 15%);
    z-index: 10;
  }
}
```

For a deeper look on using pseudo-elements and anchors to design sliding active visual indicators, see {{ GUIDE_REF("anchor-positioning-tab-underline") }}.

### Closing Sub-navigation on Click Outside and Escape (JS Constraint)

Because open `<details>` sub-navigation panels do not naturally close on click outside or when pressing the `Escape` key, use a small, lightweight event listener on desktop viewports to dismiss active sub-navigation cards. 

To prevent breakpoint duplication and layout mismatch issues inside JavaScript, check layout state by querying whether the trigger button `.menu-button` is hidden (`display === "none"`).

```javascript
// Close details sub-navigation on desktop when clicking outside or pressing Escape
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
      details.querySelector("summary").focus(); // Return keyboard focus to trigger
    });
  }
});
```

---

## Synchronizing Layout Resize (JavaScript Constraint)

If a user opens the mobile navigation panel and then resizes the browser to a wide viewport, the popover's internal state is still active (`:popover-open`). Although CSS overrides the visual presentation, keeping the popover state active causes issues with keyboard focus, light-dismiss, and accessibility state.

**You MUST use JavaScript to listen for the viewport breakpoint and dismiss the popover when transitioning to desktop.**

```javascript
const navigation = document.querySelector("#site-menu");
const header = document.querySelector(".site-header");
const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
const desktopBreakpoint = 45 * rootFontSize;

function closeNavigationOnDesktop(entry) {
  // Match the container query, not the viewport, so padding cannot cause a breakpoint mismatch.
  if (entry.contentRect.width >= desktopBreakpoint && navigation.matches(":popover-open")) {
    navigation.hidePopover();
  }
}

const headerObserver = new ResizeObserver(([entry]) => closeNavigationOnDesktop(entry));
headerObserver.observe(header);
```

---

## Indicating the Active Page

Convey the active page visually using a pseudo-element (`::before`) on the active link. The visual indicator should adapt its orientation dynamically to match the layout.

```css
/* Mobile: Vertical indicator bar on the left edge */
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

---

## Smooth Entry & Exit Transitions

On mobile, use `@starting-style` to enable entry and exit transitions for the popover element, resolving the traditional issue where `display: none` prevents CSS transitions.

```css
@media (prefers-reduced-motion: no-preference) {
  @container (inline-size < 45rem) {
    .site-menu {
      /* Transition opacity, transform, and display using allow-discrete */
      transition:
        display 0.2s allow-discrete,
        opacity 0.2s ease,
        transform 0.2s ease;
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

For browsers that do not support CSS Anchor Positioning, provide a fallback absolute position using `@supports not`. This ensures the navigation remains fully accessible and positioned sensibly.

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
