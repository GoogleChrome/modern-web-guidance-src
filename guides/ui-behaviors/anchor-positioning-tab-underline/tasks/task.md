---
base_app: daily-grind
---
- Update the main nav menu (`nav ul`) so the active tab (`li.active`, defaulting to the first `li` on initial load) displays a `--accent` colored underline indicator that smoothly glides to the newly selected tab when a nav item is clicked.
- can you make an animated underline for the nav links? set it up so when the 'active' class moves to a different li, the orange line smoothly slides over to it. try using css anchor positioning for the effect.
- add a slick sliding indicator to the header menu that shows the current page. just make a line under the active item that moves to the new item when the active class updates. make sure the animation is disabled for users who prefer reduced motion.
- style the nav list so there's an active tab indicator that transitions across the menu. use a pseudo-element on the ul and tether it to the active li. use the orange accent color and make sure it has a fallback for older browsers that don't support the newest css features.
