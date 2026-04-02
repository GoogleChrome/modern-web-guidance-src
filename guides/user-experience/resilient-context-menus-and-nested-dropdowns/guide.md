---
name: resilient-context-menus-and-nested-dropdowns
description: Build accessible, responsive menus, tooltips, dropdowns, or contextual overlays that must be tethered to specific UI elements, guaranteeing that the overlay automatically repositions itself (e.g., flipping axes) when it encounters viewport edges, ensuring it never gets cut off.
web-feature-ids:
  - anchor-positioning
sources:
  - https://web.dev/learn/css/anchor-positioning
  - https://css-tricks.com/css-anchor-positioning-guide/
  - https://webkit.org/blog/17240/a-gentle-introduction-to-anchor-positioning/
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning
---

Modern web interfaces often require overlays (menus, tooltips, submenus) that remain tethered to a trigger element while adapting to the viewport constraints. Traditionally, this required complex JavaScript libraries (like Popper.js or Floating UI) to calculate positions and handle collisions. 

CSS Anchor Positioning provides a declarative, performance-optimized way to handle these relationships entirely in CSS, allowing browsers to manage the positioning and overflow logic.

### 1. Define the Anchor and Target Relationship

The first step is to uniquely identify the trigger (anchor) and link it to the overlay (target).

```css
.menu-trigger {
  /* Give the anchor a unique name */
  anchor-name: --main-menu-trigger;
}

.menu-overlay {
  position: absolute;
  /* Link this target to the anchor */
  position-anchor: --main-menu-trigger;
}
```

<!-- Use the Popover API (`popover="auto"`) for the overlay to ensure it is placed in the top-layer and handled accessibly by the browser. -->

### 2. Positioning with `position-area`

Instead of manual `top`/`left` offsets, use `position-area` to place the target on a 3x3 grid relative to the anchor.

```css
.menu-overlay {
  /* 
     Position the menu below the anchor (bottom), 
     aligned to the start of the anchor and spanning to its end (span-inline-end).
  */
  position-area: bottom span-inline-end;
  
  /* Reset insets to allow the grid to take control */
  inset: auto;
}
```

<!-- Prefer logical keywords (`span-inline-end`, `block-start`) over physical ones (`left`, `top`) to support RTL and different writing modes automatically. -->

### 3. Implement Edge-Resilience (Fallbacks)

To prevent the menu from being cut off at the edge of the screen, define "try tactics" that the browser should attempt if the default position overflows.

```css
.menu-overlay {
  /* 
     If the menu overflows the bottom, flip it to the top (flip-block).
     If it overflows the inline edges, flip it horizontally (flip-inline).
  */
  position-try-fallbacks: flip-block, flip-inline;
}
```

### 4. Handling Nested Submenus with `anchor-scope`

When creating nested dropdowns, you often reuse class names for anchors. Use `anchor-scope` to prevent submenus from accidentally tethering to the wrong trigger.

```css
/* Each menu item that contains a submenu acts as a scope */
.has-submenu {
  anchor-scope: --submenu-trigger;
}

.has-submenu > .trigger {
  anchor-name: --submenu-trigger;
}

.has-submenu > .submenu {
  position-anchor: --submenu-trigger;
  /* Position submenus to the side of their trigger */
  position-area: inline-end span-block-end;
  position-try-fallbacks: flip-inline, flip-block;
}
```

### 5. Managing Visibility

Use `position-visibility` to hide the menu if its anchor is no longer visible (e.g., scrolled out of view).

```css
.menu-overlay {
  /* Hide the target if its anchor is scrolled away */
  position-visibility: anchors-visible;
}
```

### Fallback strategies

{{ BASELINE_STATUS("anchor-positioning") }}

For browsers that do not yet support Anchor Positioning, the most robust approach is to use a polyfill that detects the missing CSS properties and applies the same logic via JavaScript.

```javascript
/* 
   MANDATORY: Feature-detect before loading a polyfill. 
   Check for 'anchorName' in document.documentElement.style.
*/
if (!("anchorName" in document.documentElement.style)) {
  // Load the CSS Anchor Positioning polyfill dynamically
  import("https://unpkg.com/@oddbird/css-anchor-positioning");
}
```

If a polyfill is not used, provide a basic fallback by ensuring the overlay has a sensible default `top`/`left` position or is simply displayed as a standard block element within the flow for basic accessibility.
