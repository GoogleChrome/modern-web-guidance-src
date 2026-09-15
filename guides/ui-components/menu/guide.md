---
name: menu
description: Build a menu component that displays a list of options or actions, with support for nested submenus.
web-feature-ids:
  - container-scroll-state-queries
  - popover
  - subgrid
  - menu
  - sticky-positioning
  - anchor-positioning
guides:
  - resilient-context-menus-and-nested-dropdowns
---

# Build a Menu Component with Support for Nested Submenus

## Overview

A menu component allows users to trigger a list of options or actions from a menubar or control trigger. Historically, building a robust, multi-level dropdown menu with support for nested submenus required heavy JavaScript scripting to position overlays, prevent visual clipping, and manage keyboard focus trapping.

Modern CSS completely replaces these manual scripting requirements. By combining the **Popover API** (for top-layer stacking) and **CSS Anchor Positioning** (for wrapperless placement), you can build a native menu component with support for nested submenus that remain fully accessible. Leveraging **CSS Subgrid** ensures that icons, action labels, and keyboard shortcuts align perfectly across menu items, while **CSS Scroll State Container Queries** natively handle menu scroll overflow visual hints and stuck menu bar transformations.

### The Flat Top-Layer Pattern

Historically, all submenu `<menu>` or `<ul>` elements had to be nested recursively inside their parent `<li>` items to resolve absolute offsets. In modern CSS, **all menus and submenus are declared flatly at the body root as independent sibling elements**.

This flat structure represents a major architectural shift and resolves critical cross-browser layout bugs:

*   **Top-Layer Stacking**: Setting the native `popover` attribute promotes the menu to the browser's **Top Layer** when opened, rendering it above all standard layouts and making it completely immune to parent `z-index` limits or `overflow: hidden`/`overflow: auto` clipping.
*   **Popover Ancestry & Light-Dismiss**: By keeping submenus flat at the body root, you completely bypass WebKit/Safari layout clipping bugs where parent fixed drawers with scroll ports (`overflow: auto`) slice or hide nested DOM child elements. To establish correct popover ancestry so the parent doesn't close on submenu open (light-dismiss), trigger the submenu by programmatically invoking `.click()` on its trigger button inside keyboard listeners rather than calling `.showPopover()` on the submenu element directly.
*   **Wrapperless CSS Anchor Positioning**: By declaring a unique `anchor-name` on any trigger element, any flat popover can bind and position itself relative to that trigger wrapperlessly (e.g., aligning submenus to the top-right of their parent trigger).
*   **Built-in Focus and Tab Safety**: When popovers are closed, they are natively set to `display: none` by the browser, safely removing them from keyboard tab order and accessibility trees to eliminate "ghost focus" traps.

### Command Menus vs. Navigation Menus

Specifying the correct semantic elements and ARIA roles is critical for search engines and assistive technology users:

*   **Use `<menu>` for App Commands**: Choose `<menu>` when dropdown options represent **actions, commands, or settings** that execute immediate state changes on the current page (e.g., "New File", "Save", "Preferences").
    *   **Structure**: Nest `<button>` elements inside list-item `<li>` wrappers.
    *   **ARIA Roles**: Apply `role="menu"` on `<menu>`, `role="none"` on the intermediate `<li>` list items, and `role="menuitem"` directly on the `<button>` controls. This overrides generic bullet-list announcements, prompting screen readers to treat the component as a unified desktop-style application menu.
*   **Use `<nav>` for Page Navigation**: Choose `<nav>` when options represent **navigational hyperlinks** that redirect the browser to different URLs, sections, or views (e.g., "Home", "About Us", "Contact").
    *   **Structure**: Nest standard unordered lists `<ul>` containing list items `<li>` with semantic anchor `<a>` elements.
    *   **ARIA Roles**: Keep default browser semantics. Do **not** apply `role="menu"` or `role="menuitem"`.

---

## Implementation steps

1.  **Define a State-Aware Sticky Header**: Set `position: sticky` and `container-type: scroll-state` on your menubar wrapper to track when the menu is pinned.
2.  **Declare Popover Targets**: Apply the standard `popover` attribute to the `<menu>` overlay so it sits in the top-layer, and link it to its trigger button via `popovertarget`.
3.  **Position Overlays Natively**: Use CSS Anchor Positioning (`anchor-name` on the trigger, `position-anchor` on the popover) to align the menu list relative to the button wrapperlessly.
4.  **Create a Subgrid Sizing Template**: Configure the main `<menu>` container as a 4-column grid (representing Icons, Labels, Shortcuts, and Submenu arrows) and apply `grid-template-columns: subgrid` to the list item wrapper button.
5.  **Inject Stuck & Overflow Queries**: Use `@container scroll-state(...)` queries to style the header when it is stuck to the viewport, and to dynamically display top/bottom gradient shadow overlays inside overflowing menus.

---

## Example: Keyboard-Navigable Application Menu

### 1. HTML Structure

```html
<!-- Sticky Menubar Wrapper with Scroll State -->
<div class="sticky-wrapper">
  <div class="menubar" role="menubar">
    <button id="file-trigger" class="menu-trigger" popovertarget="file-menu" aria-haspopup="menu">
      File
    </button>
  </div>
</div>

<!-- Popover Menu placed at the body root -->
<div id="file-menu" popover class="popover-menu">
  <!-- Scrollable container with Scroll State overflow queries -->
  <div class="scrollable-menu">
    <div class="shadow-indicator shadow-indicator-top"></div>
    
    <!-- Semantically mapped menu layout -->
    <menu class="menu-list" role="menu">
      <li class="menu-item-wrapper" role="none">
        <button id="preferences-trigger" class="menu-item" role="menuitem" aria-haspopup="true" aria-expanded="false">
          <svg class="menu-icon" viewBox="0 0 24 24"><path d="..."/></svg>
          <span class="menu-label">Preferences</span>
          <span class="menu-arrow" aria-hidden="true"></span>
        </button>

        <!-- Standard nested submenu menu - no popover attribute needed, fully nested in DOM -->
        <menu class="submenu" role="menu" aria-label="Preferences">
          <li class="menu-item-wrapper" role="none">
            <button class="menu-item" role="menuitem">
              <span class="menu-label">User Theme</span>
            </button>
          </li>
        </menu>
      </li>
    </menu>

    <div class="shadow-indicator shadow-indicator-bottom"></div>
  </div>
</div>
```

### 2. CSS Style Rules

```css
/* Sticky Menubar and scroll-state container queries */
.sticky-wrapper {
  position: sticky;
  top: 0;
  container-type: scroll-state;
  container-name: menubar-container;
  z-index: 100;
  overflow-anchor: none; /* REQUIRED: Prevent layout flickering oscillations */
}

/* Query stuck: top natively to visually style the header once pinned */
@container menubar-container scroll-state(stuck: top) {
  .menubar {
    background-color: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
}

/* Popover API & Anchor Positioning definitions */
#file-trigger {
  anchor-name: --file-anchor;
}

.popover-menu {
  display: none;
  position: absolute;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
}

.popover-menu:popover-open {
  display: block;
}

#file-menu {
  position-anchor: --file-anchor;
  top: anchor(bottom);
  left: anchor(left);
}

/* Submenu standard nested menu - styled as standard absolute child on desktop */
.submenu {
  display: none;
  position: absolute;
  left: 100%;
  top: 0;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.25rem;
  margin-left: 0.25rem;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  z-index: 10;
}

/* Show submenu dynamically when trigger button is expanded */
.menu-item[aria-expanded="true"] + .submenu {
  display: block;
}

/* Submenu Hover Bridge (Diagonal Aim Pointer Safeguard) */
.submenu::after {
  content: "";
  position: absolute;
  right: 100%; /* Position flush against trigger's right edge */
  top: 0;
  bottom: 0;
  width: 0.25rem; /* Bridges the margin-left gap between trigger and submenu */
}

/* CSS Subgrid column alignments (Icons, Labels, Shortcuts) */
/* Define 4 standard columns (Icon, Label, Shortcut, Arrow) that collapse dynamically */
.menu-list {
  --track-icon: 0px;
  --track-shortcut: 0px;
  --track-arrow: 0px;

  display: grid;
  grid-template-columns: var(--track-icon) 1fr var(--track-shortcut) var(--track-arrow);
  column-gap: 0px; /* Zero gaps to prevent offset artifacts from collapsed 0px columns */
  row-gap: 0.1rem;
}

/* Dynamically expand column tracks to auto size ONLY when their respective element exists in the list */
.menu-list:has(.menu-icon) { --track-icon: auto; }
.menu-list:has(.menu-shortcut) { --track-shortcut: auto; }
.menu-list:has(.menu-arrow) { --track-arrow: auto; }

.menu-item-wrapper {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid; /* Delegates tracks to parent .menu-list */
  position: relative; /* REQUIRED: Anchor point for standard absolute nested submenus */
}

.menu-item {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
}

.menu-icon {
  grid-column: 1;
  width: 1rem;
  height: 1rem;
  fill: currentColor;
  margin-inline-end: 0.5rem; /* Gap between Icon (Col 1) and Label (Col 2) */
}

.menu-label {
  grid-column: 2;
}

.menu-shortcut {
  grid-column: 3;
  margin-inline-start: 1.5rem; /* Gap between Label (Col 2) and Shortcut (Col 3) */
}

/* Submenu indicator arrows styled via modern CSS Mask Icon technique */
.menu-arrow {
  grid-column: 4;
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  background-color: currentColor;
  margin-inline-start: 0.5rem; /* Gap between Shortcut (Col 3) and Arrow (Col 4) */
  transition: transform 0.2s ease-out; /* Smooth visual transition when rotating arrow */
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>') no-repeat center / contain;
  -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>') no-repeat center / contain;
}

/* Scroll scroller and Scroll State overflow shadow indications */
.scrollable-menu {
  max-block-size: 200px;
  overflow-y: auto;
  container-type: scroll-state;
  container-name: file-scroller;
  position: relative;
}
.shadow-indicator {
  position: sticky;
  left: 0;
  right: 0;
  height: 12px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.shadow-indicator-top {
  top: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.1), transparent);
}

.shadow-indicator-bottom {
  bottom: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.1), transparent);
}

/* Display shadows dynamically when scroller overflows and is scrollable */
@container file-scroller scroll-state(scrollable: top) {
  .shadow-indicator-top {
    opacity: 1;
  }
}

@container file-scroller scroll-state(scrollable: bottom) {
  .shadow-indicator-bottom {
    opacity: 1;
  }
}

/* Submenu Hover Bridge (Diagonal Aim Pointer Safeguard) */
#preferences-submenu::after {
  content: "";
  position: absolute;
  right: 100%; /* Position flush against trigger's right edge */
  top: 0;
  bottom: 0;
  width: 0.25rem; /* Bridges the margin-left gap between trigger and submenu */
}

/* Responsive Mobile Drawer Transformation */
@media (max-width: 48rem) {
  /* Both top-level menus and nested submenus transform into stackable bottom drawers */
  .popover-menu {
    position: fixed;
    inset-block-start: auto; /* REQUIRED: Overrides browser default popover top:0 to prevent full-screen stretching */
    inset-block-end: 0;
    inset-inline: 0;
    margin: 0;
    border-radius: 12px 12px 0 0;
    inline-size: 100%;
    max-block-size: 60vh;
    transform: translateY(100%);
    transition: transform 0.25s ease-out;
  }

  .popover-menu:popover-open {
    transform: translateY(0);
  }

  /* Clamp scrollport height inside mobile drawers to prevent full viewport stretch */
  .scrollable-menu {
    max-block-size: 50vh;
  }
}
```

---

## Strategic Implementation & Best Practices

*   **DO** use the semantic `<menu>` tag containing `<li>` and interactive `<button role="menuitem">` controls to ensure a perfectly standard, screen-reader discoverable accessibility tree.
*   **DO** set `overflow-anchor: none` on the parent container of any sticky-positioned element to prevent layout flickering when changing stuck-state box styles.
*   **DO NOT** use absolute layout margin hacks or third-party positioning scripts to track the trigger. Leverage native CSS Anchor Positioning to keep the overlay completely wrapperless.
*   **DO** use `display: grid; grid-template-columns: subgrid` to ensure elements like icons, labels, shortcuts, and arrows line up flawlessly across independent rows without hardcoded padding variables.
*   **DO** style outlines exclusively on `:focus-visible` to protect mouse and touch clicks while presenting highly visible indicators for keyboard navigation.
*   **DO** implement an invisible "hover bridge" pseudo-element (`::after`) on nested submenus to span visual margin gaps, ensuring diagonal pointer trajectories (safe mouse-aim) never trigger adjacent items.
*   **DO** use fluid media queries to override absolute layouts on mobile viewports, transforming the top-layer popover into a fixed bottom drawer to maximize touch target sizing and accessibility.

---

## Known issues

*   **WebKit/Safari Nested Popover Clipping**: If a nested popover is physically nested in the HTML DOM inside a parent popover that contains scrollports (`overflow: auto`), WebKit/Safari incorrectly clips and completely hides the nested child popover on mobile drawers. **The Solution:** Keep all menus and submenus flat at the body root as sibling elements, and programmatically invoke `.click()` on the trigger button inside keyboard listeners rather than calling `.showPopover()` directly on the submenu element. This establishes perfect, cross-browser native popover target ancestry for light-dismiss without physical DOM nesting.

---

## Fallback strategies

### Sticky and Stuck-State Fallback
If scroll-state Queries are unsupported, the menubar will still stick to the viewport top natively using `position: sticky`, but it will not receive background blur or edge shadows. No custom JS fallback is required as this degrades gracefully.

### Popover and Anchor Positioning Fallback
For environments lacking native Popover and Anchor positioning, write standard relative container wrappers on trigger buttons and set fallback static styles inside `@supports not` directives.

### Polyfill Loader for Older Environments
To guarantee absolute, cross-browser compatibility on historical browsers that lack native Popover or CSS Anchor Positioning support, conditionally load the standard polyfills. Use a lightweight inline script to check feature support and asynchronously import the polyfill libraries only when missing:

```javascript
/* Conditionally load Popover and Anchor Positioning polyfills in older browsers */
(async () => {
  const supportsPopover = HTMLButtonElement.prototype.hasOwnProperty('popovertarget');
  const supportsAnchor = 'anchorName' in document.documentElement.style;

  if (!supportsPopover) {
    await import('https://unpkg.com/@oddbird/popover-polyfill');
  }
  if (!supportsAnchor) {
    await import('https://unpkg.com/@oddbird/css-anchor-positioning');
  }
})();
```

### Advanced Subskill Reference
For exhaustive details on edge-repositioning, axis-flipping, and popover viewport boundary try tactics, reference {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}. For full swipeable touch gestures, scroll-linked backdrop timelines, and interactive drawer behaviors on smaller mobile viewports, reference {{ GUIDE_REF("navigation-drawer") }}.

{{ FEATURE_FALLBACKS("popover") }}
{{ FEATURE_FALLBACKS("anchor-positioning") }}
{{ FEATURE_FALLBACKS("subgrid") }}
{{ FEATURE_FALLBACKS("container-scroll-state-queries") }}
