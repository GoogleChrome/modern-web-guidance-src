# Expectations

- The mobile navigation trigger is a native `<button>` element with `type="button"` and links to the popover menu element (such as `<ul>`) using declarative `popovertarget` and `aria-controls` attributes.
- The navigation tree does not use `focusgroup`.
- The navigation tree does not use `role="menu"`, `role="menuitem"`, `role="menubar"` or `aria-haspopup="menu"`.
- Spacing, sizing, and positioning of the navigation elements use CSS logical properties (e.g., `inline-size`, `block-size`, `margin-inline`, `padding-block`, `inset-block-start`, `inset-inline-end`) instead of physical coordinates.
- Viewport-relative sizing on the navigation menu uses modern viewport units (`dvh` and `dvw`) instead of traditional `vh`/`vw`.
- In a container too narrow for the links to fit inline, the navigation list is a native popover (`popover="auto"`) positioned relative to the trigger button with CSS Anchor Positioning (`anchor-name` and `anchor()`).
- In a container wide enough for the links to fit inline, the trigger button is not displayed and the navigation list is laid out as a static, horizontal inline list.
- JavaScript synchronizes the outer navigation's `popover` attribute with the header's responsive layout so the navigation is a native popover only in the narrow layout and becomes a normal inline element in the wide layout.
- The current page link uses `[aria-current="page"]` as its styling hook, and the attribute is present on that link.
- The CSS Anchor Positioning declarations for the narrow menu include a declaration-level fallback before the `anchor()` declaration for browsers that do not support CSS Anchor Positioning.
- Second-level navigation triggers are `<button>` elements with `aria-expanded` and `aria-controls`, not `<details>`/`<summary>`, and their nested list is promoted to a popover only in the wide layout.
- On narrow layouts, the sub-navigation expands vertically inline inside the popover navigation panel, pushing other sibling list links down.
- On wide layouts, each nested submenu is a top-layer popover positioned relative to its trigger button using CSS Anchor Positioning.
- On wide layouts, each nested submenu is a `popover="auto"` opened by its trigger's `popovertarget`, so the browser provides light dismiss, Escape handling and focus restoration, and `aria-expanded` reflects whether it is open.
- On wide layouts with a hover-capable pointer, hovering a submenu's trigger opens its submenu.
- On wide layouts, the submenu still opens by click and by keyboard (`Enter`/`Space`) on its trigger button.
- On wide layouts, focusing a submenu's trigger without activating it does not open the submenu.
- High-contrast system support is provided under a `@media (forced-colors: active)` query to adapt custom borders, boundaries, and active-state visual indicators (e.g., using values like `CanvasText` and `Highlight`).
