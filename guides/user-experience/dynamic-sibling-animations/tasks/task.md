---
base_app: daily-grind
---
- add a staggered animation to the cards in the .grid so they anmiate in sequentially, each card 100ms after the previous card
- can you make the seasonal favorites cards animate in one after another instead of all at once? make sure it degrades gracefully on older browsers and respects accessibility motion preferences.
- implement a stagger effect on the nav links so they fade in sequentially. use sibling-index() for the delay and add a js fallback loop for browsers that don't support it yet.
- the coffee cards look too static when the page loads. make them pop in one by one.