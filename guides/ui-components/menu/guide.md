---
name: menu
description: Build an accessible application command menu with nested submenus.
web-feature-ids:
  - container-scroll-state-queries
  - popover
  - subgrid
  - menu
  - sticky-positioning
  - anchor-positioning
  - focusgroup
guides:
  - resilient-context-menus-and-nested-dropdowns
---

# Build an application command menu

Use a command menu for actions that change the current interface, such as creating, saving, or changing preferences. Use ordinary links inside a [`<nav>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/nav) landmark when items primarily take users to destinations. That navigation pattern normally uses `Tab` and `Shift` + `Tab`; it is not automatically an ARIA menu.

> [!NOTE]
> **Choose the pattern deliberately.** `role="menu"` and `role="menubar"` describe composite application widgets with managed focus and arrow-key navigation. They are not required for every navigation bar. Use the menu pattern only when that interaction model is appropriate for the component, including application navigation that intentionally behaves like a desktop menubar.

This guide demonstrates a command menu using the proposed [`focusgroup`](https://open-ui.org/components/scoped-focusgroup.explainer/) feature. The focusgroup supplies focus movement and minimum menu semantics; it does not perform command selection, manage submenu state, or restore focus after dismissal. The demo uses Microsoft's [focusgroup polyfill](https://github.com/microsoft/polyfills/tree/main/packages/focusgroup) while native support is emerging.

## Setup a sticky menu bar with scroll-state queries

When nesting a menu trigger or bar within a header, you often want the header to stick to the top of the viewport and adapt its styling when stuck. Combining `position: sticky` with **Container Scroll-State Queries** lets you apply dynamic visual treatment (like a box-shadow or background color change) seamlessly without using a scroll event listener in JavaScript.

```css
/* Configure the header container to track its scroll/stuck state */
.bar-wrap {
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  container-type: scroll-state;
  container-name: bar;
}

/* Default styling for the menu bar */
.bar {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--surface);
  border-block-end: 1px solid var(--line);
  transition: box-shadow 0.2s ease;
}

/* Apply a shadow only when the container is stuck at the top */
@container bar scroll-state(stuck: top) {
  .bar {
    box-shadow: 0 0.2rem 0.8rem rgba(0, 0, 0, 0.15);
  }
}
```

## Open and position the menu

Use a button as the menu trigger. The [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) places the menu in the top layer and supplies light-dismiss behaviour. `popovertargetaction="toggle"` makes pointer activation explicit.

> [!IMPORTANT]
> **Workaround for popover clobbering focusgroup semantics:**
> There is a known browser implementation bug where a parent `[popover]` clobbers the `focusgroup`'s semantics (see [Chromium Bug #564673920](https://issues.chromium.org/issues/564673920)). To work around this, **always nest the focusgroup container inside the popover div** instead of declaring `focusgroup` on the popover element itself.

```html
<!-- Trigger button -->
<button id="file-trigger" type="button" popovertarget="file-menu" popovertargetaction="toggle" aria-haspopup="menu">
  File
</button>

<!-- Popover container -->
<div id="file-menu" popover="auto" aria-labelledby="file-trigger">
  <!-- WORKAROUND: Nest focusgroup inside popover to preserve semantics -->
  <div focusgroup="menu" aria-label="File commands">
    <button type="button">New file</button>
    <button type="button">Save</button>
    <button id="preferences-trigger" type="button" popovertarget="preferences-menu" popovertargetaction="toggle" aria-haspopup="menu" aria-expanded="false">
      Preferences <span aria-hidden="true">›</span>
    </button>
  </div>
</div>
```

The focusgroup receives the minimum menu role and its buttons receive the minimum menu-item semantics when native support or the polyfill is active. A native button's visible text supplies its accessible name, so do not add a redundant `aria-label` to a button that already has a visible label. Keep decorative submenu indicators `aria-hidden="true"`. Use `aria-label` for genuinely icon-only controls, not to duplicate visible button text. The JavaScript must still move focus to the first item when opening, implement selection, synchronise expanded state, and restore focus when closing.

### Position the menu with CSS Anchor Positioning

Use [CSS anchor positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning) to tether the popover menu to its trigger button automatically. This avoids complex absolute coordinate calculation in JavaScript.

```css
/* Define the anchor name on the trigger button */
#file-trigger {
  anchor-name: --file-trigger;
}

/* Position the popover menu relative to its anchor trigger */
#file-menu {
  position-anchor: --file-trigger;
  position-area: block-end span-inline-end; /* Places menu below the button, aligned to its starting edge */
  inset: auto; /* Clear standard popover insets to let anchor positioning control layout */
}
```

Keep the opening, closing, and keyboard traversal independent of CSS anchor positioning, ensuring the interaction contract functions robustly even in unsupported browsers.

## Implement menu keyboard interaction

Do not implement a second roving-tabindex system when using `focusgroup="menu"`. Its focus behaviour handles movement between menu items, including the supported boundary behaviour. JavaScript remains responsible for the parts focusgroup does not cover:

- Opening the menu with pointer activation, `Enter`, `Space`, or `ArrowDown`.
- Moving focus to the first enabled item after opening.
- Activating a command with `Enter` or `Space`.
- Closing with `Escape` and restoring focus to the invoking trigger.
- Allowing `Tab` to leave the menu rather than trapping it.

The demos use the Microsoft polyfill as a fallback. In production, pin or self-host the dependency and test its output with the browsers and assistive technologies you support.

## Add a submenu

A submenu trigger is a focusgroup-managed menu item with `aria-haspopup="menu"` and an accurate `aria-expanded` state. Its submenu is another popover containing its own nested `focusgroup="menu"`. `ArrowRight` opens the submenu and moves focus to its first item. `ArrowLeft` closes it and returns focus to the parent trigger. `Escape` closes the current level and restores focus.

Pointer activation must provide the same result as keyboard activation. Keep the submenu open while focus moves into it, and ensure that clicking outside closes all open levels without leaving focus in hidden content.

### Position the submenu with CSS Anchor Positioning

Use CSS anchor positioning to lay out the nested submenu seamlessly beside its trigger.

```css
/* Define anchor name on the submenu trigger */
#preferences-trigger {
  anchor-name: --preferences-trigger;
}

/* Position the submenu popover relative to its trigger button */
#preferences-menu {
  position-anchor: --preferences-trigger;
  position-area: inline-end span-block-start; /* Aligns to the side of the parent menu item */
  inset: auto;
}

/* On narrow viewports, position the submenu underneath its parent item to prevent clipping/overlapping */
@media (max-width: 40rem) {
  #preferences-menu {
    position-area: block-end span-inline-start;
  }
}
```

## Align menu item content

When rows include icons, labels, shortcuts, or submenu indicators, define the columns once on the focusgroup and use `subgrid` for each row. Keep shortcut text supplementary: it must not be the only way to understand or operate an item, and it should be hidden from assistive technology when it duplicates the interaction instructions.

```css
[focusgroup="menu"] {
  display: grid;
  grid-template-columns: auto 1fr auto;
}

[focusgroup="menu"] > * {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
}
```

## Test with VoiceOver and NVDA

Automated checks cannot verify the whole interaction contract. Test each demo with a keyboard and at least one screen reader:

1. Tab to the trigger and confirm its name, button role, and collapsed/expanded state.
2. Open the menu with the mouse, Enter, Space, and ArrowDown; confirm focus moves to the first item.
3. Use Up, Down, Home, and End and confirm the focusgroup/polyfill moves focus and the focused item is announced once.
4. Open the submenu with Right Arrow or its button; return with Left Arrow and Escape.
5. Confirm Tab leaves the menu, and closing never leaves focus on hidden content.
6. In VoiceOver, test both Control + Option navigation and keyboard interaction. In NVDA, test browse mode and focus mode; pressing Enter on the menu trigger should enter the interactive menu. Each item should be announced once with its name and menu-item role, not once as a button and again as a separate text node.

These checks complement [WCAG 2.2 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order), [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), and [Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value). WCAG requires keyboard operability and understandable focus management; it does not require arrow keys for every navigation component.

## Progressive enhancement and fallbacks

Load the focusgroup polyfill as a fallback while native support is emerging:

```js
await import('https://unpkg.com/@microsoft/focusgroup');
```

For production, pin or self-host the dependency and provide a failure path. If focusgroup cannot load, use an equivalent tested implementation or render the controls as an ordinary in-flow disclosure instead of exposing an incomplete menu widget.

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

{{ FEATURE_FALLBACKS("subgrid") }}

{{ FEATURE_FALLBACKS("container-scroll-state-queries") }}
