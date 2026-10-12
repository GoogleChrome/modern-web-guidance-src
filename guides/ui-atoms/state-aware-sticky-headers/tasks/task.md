---
base_app: daily-grind
---
- Add section headers inside the main content area of the page using `.sticky-container` for the sticky wrapper and `.sticky-header` for the inner header element. When a section header is actively stuck at the top of the viewport while scrolling, change its background color to blue, add a shadow, and reduce its padding. Ensure there is enough scrollable content both above and below the first sticky header so it is unstuck on initial load and can be scrolled until stuck at the top of the viewport.
- Add sticky headers to the main sections of the page that stick to the top of the viewport as I scroll down. I want them to look compact and distinct when they are stuck, maybe a blue background with a shadow. Please use modern CSS container queries instead of Javascript so it's performant. Ensure there is enough scrollable content *above* the first sticky header so that it is not stuck on initial page load.
