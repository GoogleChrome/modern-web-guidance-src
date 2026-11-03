# Expectations

- The mobile navigation trigger is a native `<button>` element with `type="button"` and links to the popover menu element using declarative `popovertarget` and `aria-controls` attributes.
- The navigation tree does not use `focusgroup`, `role="menu"`, `role="menuitem"`, `role="menubar"` or `aria-haspopup="menu"`.
- In a container too narrow for the links to fit inline, the navigation list is a native popover (`popover="auto"`) positioned relative to the trigger button with CSS Anchor Positioning (`anchor-name` and `anchor()`).
- In a container wide enough for the links to fit inline, the trigger button is not displayed and the navigation list is laid out as a static, horizontal inline list without the `popover` attribute.
- The collapsed layout is chosen by measuring whether the inline row overflows, not by a hard-coded width such as a `45rem` container query.
- The current page link uses `[aria-current="page"]` as its styling hook, and the attribute is present on that link.
- Second-level navigation triggers are `<button>` elements with `aria-expanded` and `aria-controls`, not `<details>`/`<summary>`.
- On wide layouts, each nested submenu is a `popover="auto"` opened by its trigger's `popovertarget` and positioned relative to the trigger with CSS Anchor Positioning.
- A submenu trigger's `aria-expanded` is `true` while its submenu is open and `false` while it is closed.
- When the viewport width changes while the collapsed navigation menu is open and the layout stays collapsed, the menu stays open.
