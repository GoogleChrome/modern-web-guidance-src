---
base_app: daily-grind
---
- Refactor the seasonal favorites section into a single-page master-detail view with smooth same-document view transitions: wrap the list view in `#list-page` (with heading `#list-heading` and `.thumbnail` cards containing `.title` headings) and add a `#detail-page` view (with `#hero`, `#title`, and a Back button) so clicking a `.thumbnail` smoothly morphs the card and title into `#hero` and `#title` on `#detail-page` and back.
- make the transition from the seasonal menu cards to the details screen look like a seamless, high-quality app transition. the card image/color should morph directly into the detail hero background, and the product title should also smoothly slide and resize into the detail heading. also make sure it works nicely for users with reduced motion or accessibility needs.
- can you fix the aspect ratio distortion and stretching that happens when the thumbnail morphs into the detail hero during the page transition? also make sure the title text transition doesn't stretch or distort during the animation.
