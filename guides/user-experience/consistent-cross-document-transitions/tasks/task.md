---
base_app: daily-grind
---
- Create a two-page site with a list page and a detail page. Add a cross-document view transition between them. Ensure the destination page's critical content is fully loaded and styled before the transition animation begins, so no blank or partially rendered state is visible during the transition.
- Create a multi-page site with a shared header and a hero section on each page. Add cross-document view transitions that cross-fade smoothly between pages. The hero section must be visible in the transition snapshot, not added to the DOM after the animation starts.
- Create a multi-page site with a user-selectable theme stored in localStorage. Add cross-document view transitions between pages and ensure the theme is applied before the transition animates, so the destination page never flashes with the wrong theme during the transition.
