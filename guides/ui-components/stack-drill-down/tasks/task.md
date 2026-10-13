---
base_app: daily-grind
---
- Build full-screen hierarchical navigation that lets users drill down into nested views when clicking a seasonal favorite link (`.item` -> `#/view/1`, `#/view/2`, etc.) and swipe or click a back button (`.back`, with an `h2` title in each detail view) to return, with browser history and deep-linking kept in sync and a card-stacking parallax transition between views. Use `.Stack` for the main container, `.Stack-view` for each view, and `.Stack-viewContent` for each view's inner content wrapper.
- hey, can we update the coffee shop website so that the detailed menu views load dynamically in a native mobile-style slider interface where users can swipe left or right to navigate between sections, and the URL updates as they scroll?
- can you build a stack-based drill-down navigation component for our coffee menu details? it needs to allow deep-linking directly to a menu item (like `#/view/1`), have a back button on detail pages, hide scrollbars, keep focus state in sync, and support swipe-to-dismiss without breaking when opening in new tabs with command click.
