# Expectations: `faster-spa-view-transitions`

- Inactive view elements must have `content-visibility: hidden` applied in their computed styles.
- The active view element must not have `content-visibility: hidden` applied (it should be `visible` or default).
- The implementation must toggle the `content-visibility` state when switching between views.
- The implementation must use `aria-hidden="true"` on inactive view elements to ensure they are removed from the accessibility tree.
- The implementation should maintain focus management by moving focus to the active view container upon transition.
- If `content-visibility` is not supported, inactive view elements must have `display: none` applied in their computed styles.
