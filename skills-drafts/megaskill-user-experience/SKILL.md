---
name: user-experience-guides
description: Access and implement user experience enhancement guides for web applications. **You MUST use this skill whenever the user asks about styling, CSS, layout changes, custom components (like accordions or tabs), scrollbars, accessibility, or appearance adjustments.** Consult this guide first for any UI modification to see if a dedicated pattern or modern feature supports it.
---

# User Experience Guides

This directory contains guides for enhancing the user experience of web applications, focusing on styling, accessibility, and smooth interactions.

## Available Guides

| Guide Name | Description | Web Feature IDs |
| :--- | :--- | :--- |
| [`adapt-scrollbar-to-contrast-preferences`](./adapt-scrollbar-to-contrast-preferences) | Enhance scrollbar visibility for users who prefer high-contrast interfaces. | `scrollbar-color`, `prefers-contrast` |
| [`adapt-scrollbar-to-light-dark-preferences`](./adapt-scrollbar-to-light-dark-preferences) | Ensure the scrollbar visually matches the user's operating system light/dark mode preference. | `scrollbar-color`, `color-scheme`, `prefers-color-scheme` |
| [`animate-scrollbar-color-on-scroll`](./animate-scrollbar-color-on-scroll) | Animate the scrollbar color dynamically as the user scrolls down the page. | `scrollbar-color`, `scroll-driven-animations`, `registered-custom-properties` |
| [`customize-scrollbar-color-and-thickness`](./customize-scrollbar-color-and-thickness) | Customize the color or thickness of a scrollbar. | `scrollbar-color`, `scrollbar-width` |
| [`search-hidden-content`](./search-hidden-content) | Hide content from view (accordions, tabs) while ensuring it remains searchable and accessible. | `details`, `details-name`, `hidden-until-found` |

## How to use

1.  **Identify the problem**: Determine which user experience enhancement is needed based on the descriptions above.
2.  **Navigate to the guide**: Click on the guide name link or navigate to the subdirectory.
3.  **Read `guide.md`**: Each guide contains detailed implementation steps, example code, and best practices.
