---
base_app: daily-grind
---
- can you add a layout density toggle with id toggle-spacious to the seasonal favorites section? wrap the seasonal favorites list in an ancestor div with the id target-container, and give the first card (the maple oat latte) the id target-item. when toggle-spacious is clicked, toggle a custom css property for layout density on target-container. use css to make the target-item card react directly to its ancestor's custom property change to update its padding (e.g., larger padding when spacious is active) without any javascript directly styling the target-item itself. also, hide the toggle button by default and use a css style query feature-check to display it only in browsers that support this style-based reactivity.
- make our menu section more responsive to user density preferences by styling the cards differently based on a layout container's state, and ensure the controls are hidden if the browser doesn't support this layout toggling.
