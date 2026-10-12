---
base_app: daily-grind
---
- Add an options dropdown overlay to the coffee shop navigation bar with a trigger button (`id="trigger-btn"`) and an overlay panel (`id="action-panel"`) containing action buttons for "Seasonal Offers", "Account Settings", and "Support". Tether the panel directly below the trigger button aligned to its start edge, and ensure it automatically repositions itself (flipping vertically or horizontally) if it collides with viewport boundaries so it is never cut off.
- let's build a floating action list for the coffee shop's navigation bar that is anchored to a new button with id trigger-btn. the list should have id action-panel and should stay positioned directly below the button, but if it gets too close to the bottom of the screen, it should flip to show above the button to stay on-screen.
- please implement an interactive options overlay that is attached to a trigger-btn in the header of our coffee shop page. the overlay should use action-panel as its id, rendering above all other page content to avoid layout clipping, and must adjust its position automatically so that it never overflows the left, right, top, or bottom edges of the screen.
