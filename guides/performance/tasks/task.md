---
base_app: daily-grind
---
- the hero image at the top of the page is loading pretty slowly and it's our biggest element. can you optimize that header section for better performance? maybe preload that unsplash background with high fetch priority and move the styles into the head so they don't block the paint.
- can you use modern image formats like webp or avif instead of just jpeg for the hero? also make sure anything further down the page like the seasonal favorites section doesn't load until the user scrolls to it.
- the grid of coffee cards is getting a bit long. can you use some of that content visibility or containment stuff so it doesn't slow down the layout when we add more items?
- i'm worried about the unsplash images being on a separate domain. can you add some resource hints like preconnect to that origin and make sure none of our other assets are blocking the initial render?
