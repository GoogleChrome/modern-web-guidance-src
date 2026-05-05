---
base_app: daily-grind
---
Add a search bar at the very top of the page, above the logo. Make it so it's hidden on load and you have to pull down to see it. Use scroll-initial-target on the nav so the page starts there, and use mandatory scroll snapping. It is MANDATORY to provide a JavaScript fallback using scrollIntoView to scroll the nav into view on load if the browser does not support scroll-initial-target natively.
