# Expectations

- The drawer is not visible when the page first loads.
- The menu trigger button has `aria-expanded="false"` when the drawer is closed.
- Clicking the menu trigger button makes the drawer visible.
- When the drawer is open, the menu trigger button's `aria-expanded` attribute is `true`.
- The drawer element uses the popover API with `popover="manual"`.
- When the drawer is open, a dimmed backdrop (the `::backdrop` pseudo-element) is visible behind it that covers the rest of the page.
- The drawer's navigation sheet does not span the full width of the viewport when open, leaving a portion of the dimmed backdrop visible alongside it.
- Clicking the dimmed backdrop area outside the navigation sheet closes the drawer.
- Pressing the Escape key while the drawer is open closes the drawer.
- The main page content has the `inert` attribute applied while the drawer is open.
- The main page content no longer has the `inert` attribute after the drawer is closed.
- Keyboard focus is moved inside the drawer after it opens.
- After the drawer is closed, the menu trigger button's `aria-expanded` attribute returns to `false`.
- The drawer's horizontal scroll container uses CSS scroll snap with `scroll-snap-type: x mandatory`.
- Horizontally scrolling the drawer's scroll container all the way to its end position closes the drawer.
- The drawer's backdrop opacity decreases as the drawer's scroll container is scrolled toward the closed position.
