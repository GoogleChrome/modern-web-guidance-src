# Expectations

- **MANDATORY**: The page uses a single semantic `<nav>` element with an explicit accessibility label (e.g., `aria-label="Primary navigation"`) that functions across both mobile and desktop layouts.
- **MANDATORY**: The mobile navigation trigger is a native `<button>` element with `type="button"` and links to the nav element using declarative `popovertarget` and `aria-controls` attributes.
- **MANDATORY**: Any decorative SVG icons inside the trigger button have `aria-hidden="true"` and `focusable="false"`.
- **MANDATORY**: The current/active page link inside the navigation menu is indicated using the `aria-current="page"` attribute.
- **MANDATORY**: The containing header (e.g., `.header-inner`) declares `container-type: inline-size` to support container query layouts.
- **MANDATORY**: Spacing, sizing, and positioning of the navigation element use CSS logical properties (e.g., `inline-size`, `block-size`, `margin-inline`, `padding-block`, `inset-block-start`, `inset-inline-end`) instead of physical coordinates.
- **MANDATORY**: Under narrow layouts (`@container (inline-size < 45rem)`), the `<nav>` element functions as a native popover using `popover="auto"` and is positioned relative to the trigger button using CSS Anchor Positioning (`anchor-name` and `anchor()`).
- **MANDATORY**: Under wide layouts (`@container (inline-size >= 45rem)`), the mobile trigger button is hidden (`display: none`), and the popover element is transformed into a static horizontal inline header by resetting its styles (including `position: static`, `display: block` or `display: flex`, and `::backdrop { display: none }`).
- **MANDATORY**: A JavaScript `ResizeObserver` is registered on the containing header to programmatically dismiss the popover (`menu.hidePopover()`) when the container matches or exceeds the desktop breakpoint if it is currently open, matching container query layouts precisely.
- **MANDATORY**: The active page link is styled with a distinct visual indicator (e.g., a pseudo-element `::before`) whose orientation transforms dynamically based on the active container query layout (vertical on narrow viewports, horizontal on wide viewports).
- **MANDATORY**: Popover open/close transitions on mobile layouts implement `@starting-style` and `transition` with `allow-discrete` to ensure smooth entry and exit animation of the popover elements.
- **MANDATORY**: Transitions are completely disabled or dampened under a `@media (prefers-reduced-motion: reduce)` media query.
- **MANDATORY**: A native CSS fallback using `@supports not` is provided for browsers that do not support CSS Anchor Positioning, falling back to container-relative coordinates.
