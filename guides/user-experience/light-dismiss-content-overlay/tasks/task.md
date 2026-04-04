---
base_app: daily-grind
---
- convert the header nav links into a mobile-friendly side drawer menu. Use a `<button>` with the text 'Menu' as the trigger. The menu should be displayed as an overlay and allow the user to swipe it closed. The background should dim or fade as the user swipes. When the menu is open, the main page content should be non-interactive (inert).
- change the top navigation bar into a mobile-friendly drawer menu that you can swipe away. Use a `<button>` with the text 'Menu' as the trigger and ensure the drawer has the attribute `popover='manual'`. make sure the main content is disabled when the menu is out, and dim the background smoothly as you swipe it closed.
- implement a slide-out side navigation for the links like 'rewards' and 'locations'. Use a `<button>` with the text 'Menu' as the trigger and ensure the overlay has the attribute `popover='manual'`. make it an overlay that feels like a native app where you can swipe left to dismiss it. use scroll-snap for the physics and ensure the rest of the page is inert so users can't click the 'order now' button by accident while the menu is open.
