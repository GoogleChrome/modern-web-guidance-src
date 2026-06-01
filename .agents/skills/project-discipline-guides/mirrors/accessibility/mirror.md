# Lowest Common Denominator (LCD) Accessibility Mirror

This document represents the intersection of accessibility best practices, APIs, and guidelines consistently supported across the Gemini, Claude, and Codex knowledge mirrors. It serves as the baseline for "Common Knowledge" in web accessibility development.

## 1. Semantic HTML & Document Structure

*   **Landmark Elements**: Use semantic landmarks to define page structure instead of generic containers:
    *   `<header>`: Page or section header.
    *   `<nav>`: Navigation blocks.
    *   `<main>`: Primary content (one per page).
    *   `<section>`: Document section.
    *   `<article>`: Self-contained composition.
    *   `<aside>`: Complementary or related content.
    *   `<footer>`: Page or section footer.
*   **Heading Hierarchy**:
    *   Maintain a logical order (`<h1>` through `<h6>`).
    *   Do not skip heading levels (e.g., `<h1>` followed by `<h3>`).
    *   Use one `<h1>` per page to define the primary topic.
*   **Lists**: Use `<ul>`, `<ol>`, and `<li>` for grouping items to ensure screen readers announce item counts.
*   **Buttons vs. Links**:
    *   `<a>`: Use for navigation to a different URL or anchor.
    *   `<button>`: Use for actions (e.g., toggling menus, submitting forms, opening dialogs).
*   **Tables**:
    *   Use `<th>` for headers with the `scope` attribute (`col` or `row`).
    *   Use `<caption>` to describe the table’s purpose.

## 2. Forms & User Input

*   **Labels**: Every form input must have a `<label>` associated via the `for` attribute matching the input's `id`.
*   **Grouping**: Use `<fieldset>` and `<legend>` to group related controls, such as radio button sets.
*   **Input Types**: Use specific HTML5 input types (e.g., `type="email"`, `type="tel"`, `type="url"`) for better keyboard support and validation.
*   **Autocomplete**: Use the `autocomplete` attribute to assist users with cognitive disabilities and speed up form completion.
*   **Error Handling**:
    *   Associate error messages and help text with inputs using `aria-describedby`.
    *   Do not rely on color alone to indicate error states.
    *   Use `aria-live` to announce validation errors that appear dynamically.

## 3. WAI-ARIA (Accessible Rich Internet Applications)

*   **The First Rule of ARIA**: Prioritize native HTML elements and attributes over ARIA roles and states whenever possible.
*   **Essential Attributes**:
    *   `aria-label`: Provides a string as the accessible name (overrides inner text).
    *   `aria-labelledby`: References other element IDs to provide the accessible name.
    *   `aria-describedby`: References other element IDs to provide supplemental descriptions or error messages.
    *   `aria-hidden="true"`: Removes an element and its children from the accessibility tree.
    *   `aria-live`: Notifies assistive technology of dynamic content changes (`polite` or `assertive`).
*   **States and Properties**:
    *   `aria-expanded`: Indicates if a widget (like a menu or accordion) is open or closed.
    *   `aria-pressed`: Indicates the state of a toggle button.
    *   `aria-checked`: Indicates the state of checkboxes or radio buttons.
    *   `aria-invalid`: Signals that a form field has an error.
    *   `aria-required`: Signals that a field must be filled.
    *   `aria-modal="true"`: Used within a dialog to signal that content outside the modal is inert.
*   **Common Roles**: Use `role="alert"`, `role="status"`, `role="dialog"`, `role="tablist"`, `role="tab"`, and `role="tabpanel"` for custom widget structures.

## 4. Keyboard Navigation & Focus Management

*   **Focusability**:
    *   `tabindex="0"`: Adds a non-interactive element to the natural tab order.
    *   `tabindex="-1"`: Makes an element programmatically focusable but removes it from the natural tab order.
    *   **Avoid** positive `tabindex` values (`tabindex > 0`).
*   **Focus Indicators**:
    *   Never remove focus outlines (`outline: none`) without providing a visible alternative.
    *   Use the `:focus-visible` pseudo-class to show focus indicators only during keyboard navigation.
*   **Modals & Overlays**:
    *   When a modal is open, focus must be trapped within the modal container.
    *   Focus must be restored to the triggering element when the modal is closed.
    *   `Escape` key should close modal overlays.
*   **Skip Links**: Provide a "Skip to Main Content" link as the first focusable element on the page.

## 5. Media & Visual Design

*   **Alt Text**:
    *   Informative images: Use `alt` to describe the content or purpose.
    *   Decorative images: Use `alt=""` (empty string) to hide them from screen readers.
*   **Color Contrast**: Maintain WCAG AA standards (4.5:1 for normal text, 3:1 for large text/UI components).
*   **Non-Color Cues**: Ensure information is not conveyed by color alone; use text, icons, or patterns as well.
*   **Reduced Motion**: Respect user preferences via the `(prefers-reduced-motion: reduce)` media query to disable or slow down animations.

## 6. Modern Web APIs

*   **`<dialog>` Element**: Use for modals to handle focus trapping and the `Escape` key automatically via `showModal()`.
*   **Popover API**: Use the `popover` attribute for non-modal overlays (e.g., menus, tooltips) to provide native "light dismiss" behavior.
*   **`inert` Attribute**: Use on background content when a modal is active to prevent keyboard and screen reader access to hidden content.

## 7. Testing Principles

*   **Automated Testing**: Use tools like `axe-core` or `Lighthouse` as an initial baseline for catching common issues.
*   **Manual Testing**:
    *   Verify navigation using only the keyboard (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
    *   Test with a screen reader (e.g., VoiceOver, NVDA) to ensure correct announcement of roles and states.
    *   Inspect the "Accessibility Tree" in browser developer tools.
