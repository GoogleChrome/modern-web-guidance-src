---
name: user-experience
description: Access and implement user experience enhancement guides for web applications. **You MUST use this skill whenever the user asks about styling, CSS, layout changes, custom components (like accordions or tabs), scrollbars, accessibility, or appearance adjustments.** Consult this guide first for any UI modification to see if a dedicated pattern or modern feature supports it.
---

# User Experience Guides

This directory contains guides for enhancing the user experience of web applications, focusing on styling, accessibility, and smooth interactions.

## Available Guides

| Guide Name | Description | Web Feature IDs |
| :--- | :--- | :--- |
| [`adapt-scrollbar-to-contrast-preferences`](./adapt-scrollbar-to-contrast-preferences) | Enhance scrollbar visibility for users who prefer high-contrast interfaces. | `scrollbar-color`, `prefers-contrast` |
| [`adapt-scrollbar-to-light-dark-preferences`](./adapt-scrollbar-to-light-dark-preferences) | Ensure the scrollbar visually matches the user's operating system light/dark mode preference. | `scrollbar-color`, `color-scheme`, `prefers-color-scheme` |
| [`customize-scrollbar-color-and-thickness`](./customize-scrollbar-color-and-thickness) | Customize the color or thickness of a scrollbar. | `scrollbar-color`, `scrollbar-width` |
| [`required-field-feedback`](./required-field-feedback) | Provide error message for required form fields that were skipped or left empty *only* after user interaction, to avoid preemptive errors and ensure feedback is timely and contextually relevant to the user's flow. | `user-pseudos` |
| [`search-hidden-content`](./search-hidden-content) | Hide content from view using patterns such as accordions, tabs, and "Read more" sections, while ensuring the hidden text reveals itself during native "Find in page" searches, allows search engine indexing, supports URL fragment deep links, and maintains ARIA accessibility. | `details`, `details-name`, `hidden-until-found` |
| [`select-menu-interaction`](./select-menu-interaction) | Validate that a non-default option has been chosen in a select menu only after the user has interacted with the control. | `user-pseudos` |
| [`style-parent-with-has`](./style-parent-with-has) | Style parent elements of a form field (e.g. labels or fieldsets) when the field is invalid. | `user-pseudos` |
| [`validate-input-after-interaction`](./validate-input-after-interaction) | Show form field validation feedback (e.g. password complexity or email format requirements) only after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing. | `user-pseudos` |

## How to use

1.  **Identify the problem**: Determine which user experience enhancement is needed based on the descriptions above.
2.  **Navigate to the guide**: Click on the guide name link or navigate to the subdirectory.
3.  **Read `guide.md`**: Each guide contains detailed implementation steps, example code, and best practices.
