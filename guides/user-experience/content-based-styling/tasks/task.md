---
base_app: daily-grind
---
- update the cards in the seasonal favorites section so that if a card contains an img, it switches to a side-by-side flex layout. add a placeholder image to the maple oat latte card so we can see the new layout in action.
- we need the cards to be smart about their content. if a card doesn't have a view details button inside it, make its background color #f9f9f9. do this purely in css without adding new classes to the html.
- implement a layout shift for the grid cards where they become a row if they contain an image. use the modern css parent selector for this, but also include an @supports fallback block with a .has-image class just in case.