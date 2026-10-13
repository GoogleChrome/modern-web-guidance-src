---
base_app: daily-grind
---
- Add an info button (`id="anchor"`) next to the Maple Oat Latte "View Details" link that opens a tooltip (`id="tooltip"`) positioned above the button by default. When the tooltip flips below the button near the top of the viewport, its directional arrow and border-radius/margin styling should automatically adapt to point toward the trigger.
- build a position-aware tooltip for the 'rewards' link in the navigation menu that shows a short promo text. when we scroll the page and the popover flips to its fallback position, its design elements and pointer arrow should automatically adapt to the new orientation purely using modern CSS positioning and state queries instead of scripting.
- can you implement a responsive info tooltip for the 'dark roast espresso' card that opens when clicking a small badge? the popup should be anchored to the badge, use native popover behavior, and have a visual indicator arrow that repositions itself dynamically to always point towards the badge depending on the layout's fallback placement, completely driven by style queries on the container's active fallback state.
