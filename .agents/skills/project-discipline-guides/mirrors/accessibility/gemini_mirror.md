# Comprehensive Web Accessibility (a11y) Common Knowledge Mirror

This guide outlines the baseline accessibility knowledge, standard APIs, and modern best practices that I (the AI) natively understand and apply. This serves as a "Redundancy Mirror" to identify common knowledge that can be pruned from project-specific guidance.

## 1. Semantic HTML & Document Structure
The foundation of accessibility is the correct use of HTML elements to convey meaning and structure to assistive technologies (AT).

*   **Landmark Elements:** Always use landmarks instead of generic `<div>`s for page structure:
    *   `<header>`: Page or section header.
    *   `<nav>`: Navigation blocks.
    *   `<main>`: The primary content of the document (only one per page).
    *   `<section>`: Generic section of a document (should usually have a heading).
    *   `<article>`: Self-contained composition (blog post, card, comment).
    *   `<aside>`: Indirectly related content (sidebar, callout).
    *   `<footer>`: Page or section footer.
*   **Heading Hierarchy:**
    *   Maintain a logical order (`<h1>` through `<h6>`).
    *   Do not skip levels (e.g., `<h1>` followed by `<h3>`).
    *   Only one `<h1>` per page is recommended for clarity.
*   **Lists:** Use `<ul>`, `<ol>`, and `<li>` for grouped items so screen readers announce the item count.
*   **Buttons vs. Links:**
    *   `<a>`: Use for navigation to a different URL or anchor.
    *   `<button>`: Use for actions (submitting forms, opening dialogs, toggling menus).
*   **Tables:**
    *   Use `<th>` for headers with `scope="col"` or `scope="row"`.
    *   Use `<caption>` to describe the table's purpose.

## 2. WAI-ARIA (Accessible Rich Internet Applications)
ARIA should only be used when native HTML cannot provide the necessary semantics.

*   **The First Rule of ARIA:** If you can use a native HTML element or attribute with the semantics and behavior you require already built-in, instead of re-purposing an element and adding an ARIA role, state, or property to make it accessible, then do so.
*   **Essential Attributes:**
    *   `aria-label`: Provides a string as the accessible name (overrides inner text).
    *   `aria-labelledby`: References another element's ID to provide the accessible name.
    *   `aria-describedby`: References another element's ID to provide an extended description.
    *   `aria-hidden="true"`: Removes an element and its children from the accessibility tree.
    *   `aria-live`: Notifies AT of dynamic content changes (`polite`, `assertive`).
*   **States and Properties:**
    *   `aria-expanded`: Indicates if a menu or accordion is open/closed.
    *   `aria-pressed`: Indicates the state of a toggle button.
    *   `aria-checked`: Indicates the state of checkboxes or radio buttons.
    *   `aria-invalid`: Indicates that a form field has an error.
    *   `aria-required`: Indicates that a field must be filled.
    *   `aria-modal="true"`: Used inside a dialog to signal that content outside is inert.
*   **Roles:** Use `role="alert"`, `role="status"`, `role="dialog"`, `role="tablist"`, `role="tab"`, `role="tabpanel"`, etc., to define widget structures.

## 3. Focus Management & Keyboard Navigation
Every interactive element must be reachable and operable via keyboard.

*   **Focusability:**
    *   Native interactive elements (`<button>`, `<a>`, `<input>`, etc.) are focusable by default.
    *   `tabindex="0"`: Adds a non-interactive element (like a custom div component) to the natural tab order.
    *   `tabindex="-1"`: Makes an element programmatically focusable but removes it from the tab order.
    *   **Avoid** `tabindex > 0`.
*   **Focus Styles:**
    *   Never remove focus outlines (`outline: none`) without providing a highly visible alternative.
    *   Use the `:focus-visible` pseudo-class to show focus indicators only when the user is navigating via keyboard.
*   **Skip Links:** Provide a "Skip to Main Content" link as the first focusable element on the page.
*   **Focus Trapping:** When a modal is open, focus must be contained within the modal and restored to the triggering element when closed.
*   **The `inert` Attribute:** (Modern) Use the `inert` attribute on background content when a modal is active to prevent keyboard and screen reader access to "hidden" content.

## 4. Forms & User Input
*   **Labels:** Every form input must have a `<label>` associated via the `for` attribute (matching the input's `id`).
*   **Grouping:** Use `<fieldset>` and `<legend>` to group related controls (like a set of radio buttons).
*   **Error Handling:**
    *   Associate error messages with inputs using `aria-describedby`.
    *   Provide clear, text-based error messages (don't rely on color alone).
    *   Use `aria-live` to announce validation errors that appear dynamically.
*   **Autocomplete:** Use the `autocomplete` attribute (e.g., `email`, `tel`, `address-line1`) to help users with cognitive disabilities and speed up form filling.

## 5. Media & Visuals
*   **Alt Text:**
    *   Informative images: Use `alt` to describe the content/purpose.
    *   Decorative images: Use `alt=""` to hide them from screen readers.
    *   Functional images (e.g., an icon inside a button): The `alt` text should describe the action (e.g., "Search", not "Magnifying glass").
*   **Color Contrast:**
    *   WCAG AA: 4.5:1 for normal text, 3:1 for large text/UI components.
    *   WCAG AAA: 7:1 for normal text, 4.5:1 for large text.
*   **Don't Rely on Color Alone:** Use icons, text, or patterns to convey information (e.g., error states, active links).
*   **Reduced Motion:** Respect user preferences via `@media (prefers-reduced-motion: reduce)`. Disable or slow down animations.

## 6. Modern APIs & Cutting-Edge Features
*   **`<dialog>` Element:** Use the native `<dialog>` element for modals. It handles focus trapping and the `Escape` key automatically when opened with `showModal()`.
*   **Popover API:** (Modern) Use the `popover` attribute for non-modal overlays (tooltips, menus). It provides "light dismiss" behavior and top-layer management natively.
*   **`aria-haspopup`:** Indicate that an element triggers a popup (menu, listbox, tree, grid, or dialog).
*   **CSS `content-visibility: auto`:** Be aware that this can affect how screen readers find content on the page (items off-screen may be "missing" from the accessibility tree until rendered).

## 7. JavaScript Interaction Patterns
*   **Keyboard Events:** Listen for `Enter` and `Space` for custom controls. Ensure `Escape` closes overlays.
*   **Dynamic Content:** When content updates without a page reload, use `aria-live` or move focus to the new content/container.
*   **State Management:** Always sync the visual state with the ARIA state (e.g., changing `aria-expanded="true"` when a menu opens).

## 8. Clean Code & Testing Principles
*   **Automated Testing:** Use tools like `axe-core`, `Lighthouse`, or `eslint-plugin-jsx-a11y` as a baseline.
*   **Manual Testing:**
    *   Navigate using only the `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Arrow` keys.
    *   Test with a screen reader (VoiceOver, NVDA, or JAWS).
    *   Inspect the "Accessibility Tree" in Browser DevTools.
*   **Progressive Enhancement:** Ensure the core functionality works with basic HTML before adding complex ARIA or JS-driven behaviors.
