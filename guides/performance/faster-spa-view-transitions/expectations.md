# Expectations: `faster-spa-view-transitions`

- Inactive view elements have `content-visibility: hidden` applied in their computed styles.
- When a view element is active, it does not have `content-visibility: hidden` applied (its computed `content-visibility` is `visible`).
- Switching between views toggles the `content-visibility` state between the active and inactive view elements.
- Inactive view elements have the `inert` attribute applied (and removed when active) so hidden content is excluded from the keyboard tab order and accessibility tree.
- Switching to a view moves keyboard focus to the newly active view container.
- When `content-visibility: hidden` is not supported, a `@supports not (content-visibility: hidden)` fallback rule applies `display: none` to inactive view elements.
