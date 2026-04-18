---
base_app: daily-grind
---
- Add new section headers inside the main content area of the page (e.g., within the cards or sections). These headers should stick to the top when scrolling.
- Use the class `sticky-container` for the container and `sticky-header` for the header.
- To avoid collisions with the existing site navigation, you MUST use a named container (e.g., `container-name: section-header`).
- When the headers are stuck at the top, change their background color to blue and reduce their padding.
- I want my headers to feel more compact and distinct when they are stuck at the top of the page.
- Ensure there is enough scrollable content *above* the first sticky header so that it is not stuck on initial page load.
- The implementation should assume the document/viewport is the scroll root.
