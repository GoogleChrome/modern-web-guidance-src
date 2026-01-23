---
description: Structure web applications using Polymer's component model for modularity and reusability.
filename: polymer-app-structure
category: ui
---

# Building Apps with Polymer

Reference docs:
- https://www.webcomponents.org/element/@polymer/paper-toolbar
- https://www.webcomponents.org/element/@polymer/paper-icon-button
- https://www.webcomponents.org/element/@polymer/core-list
- https://www.webcomponents.org/element/@polymer/core-animated-pages

## Best Practices

### Structure

- **DO** break down your application into modular and reusable components.
- **DO** leverage Polymer's core and paper elements for common UI patterns like toolbars and buttons.
- **DO** use composition to build complex application scaffolds from smaller components.
- **DO** apply custom CSS to components to achieve brand-specific styling.
- **DO** use elements like `core-list` to efficiently display and bind data to lists of items.

### Transitions

- **DO** use `core-animated-pages` for creating smooth transitions between different application states.
- **DO** combine `core-animated-pages` with a routing solution to manage URLs and application state.
- **DO** consider declarative routers (e.g., `app-router`) for streamlined integration with `core-animated-pages`.
- **DO** explore imperative routers (e.g., Flatiron's Director) or libraries like `more-routing` for more fine-grained control over routing and transitions.

### Performance

- **DO** conditionally load Web Components polyfills to avoid unnecessary overhead on supporting platforms.
- **DO** use tools like Vulcanize to concatenate HTML Imports into a single bundle, reducing HTTP requests.

### Offline Experience

- **DO** implement offline capabilities for a true mobile app experience.
- **DO** explore Service Workers for robust offline support and caching strategies.
- **DO** cache essential application resources and data using Service Worker's install event.