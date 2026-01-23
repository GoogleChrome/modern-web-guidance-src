---
description: Build a responsive slide-out side navigation component using HTML, CSS, and JavaScript for a better user experience.
filename: responsive-sidenav
category: ui
---

# Responsive Side Navigation Component

## Best Practices

**HTML Structure:**
- Use semantic HTML elements like `<aside>` for navigation and `<main>` for primary content.
- Include a `<nav>` element within the `<aside>` for navigation links.
- Use an `<a>` tag with a unique `id` and `href` matching a URL hash (e.g., `#sidenav-open`) to trigger the sidenav's visibility.
- Add descriptive `title` and `aria-label` attributes to interactive elements like open/close buttons for accessibility.
- Embed SVG icons directly for navigation toggles, ensuring they have appropriate accessibility attributes.

**CSS Layout and Styling:**
- Utilize CSS Grid for overall page layout, allowing for flexible stacking of main content and sidenav based on viewport size.
- Employ `position: sticky` for the sidenav on smaller viewports to ensure it remains in view while scrolling.
- Use `overscroll-behavior: contain` to manage scrolling behavior within the sidenav.
- Leverage the `:target` pseudo-selector in conjunction with the sidenav's `id` and the URL hash to control its visibility.
- Apply CSS transforms (`translateX`) for smooth slide-in and slide-out animations.
- Set `will-change: transform` to hint to the browser about impending transform animations.
- Use CSS transitions for animating the `transform` and `visibility` properties.
- Respect `prefers-reduced-motion` media query by reducing or removing animations for users who prefer less motion.
- Hide navigation toggles (`#sidenav-button`, `#sidenav-close`) on larger viewports using `@media (min-width: 540px) { display: none; }`.
- Ensure touch interactions are handled gracefully with properties like `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation`.

**JavaScript Enhancements:**
- Implement keyboard navigation: Use the `keyup` event listener on the sidenav to close it when the `Escape` key is pressed, by setting `document.location.hash = ''`.
- Manage focus: Utilize the `transitionend` event to manage focus. After a transition, if the sidenav is open, focus the close button; otherwise, focus the open button. This improves the user experience for keyboard and screen reader users.

```html
<!-- Example HTML Structure -->
<body>
  <aside id="sidenav-open">
    <nav>
      <!-- Navigation links -->
      <h4>My</h4>
      <a href="#">Dashboard</a>
      <a href="#">Profile</a>
      <!-- ... more links -->
    </nav>
    <a href="#" id="sidenav-close" title="Close Menu" aria-label="Close Menu"></a>
  </aside>

  <main>
    <header>
      <a href="#sidenav-open" id="sidenav-button" class="hamburger" title="Open Menu" aria-label="Open Menu">
        <svg viewBox="0 0 50 40" role="presentation" focusable="false" aria-label="trigram for heaven symbol">
          <line x1="0" x2="100%" y1="10%" y2="10%" />
          <line x1="0" x2="100%" y1="50%" y2="50%" />
          <line x1="0" x2="100%" y1="90%" y2="90%" />
        </svg>
      </a>
      <h1>Site Title</h1>
    </header>
    <article>
      <!-- Page content -->
    </article>
  </main>
</body>
```

```css
/* Example CSS Snippets */
body {
  display: grid;
  grid: [stack] 1fr / min-content [stack] 1fr;

  @media (max-width: 540px) {
    & > :matches(aside, main) {
      grid-area: stack;
    }
  }
}

#sidenav-open {
  --easeOutExpo: cubic-bezier(0.16, 1, 0.3, 1);
  --duration: .6s;

  @media (max-width: 540px) {
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow: hidden auto;
    overscroll-behavior: contain;
    visibility: hidden; /* not keyboard accessible when closed */
    transform: translateX(-110vw);
    will-change: transform;
    transition:
      transform var(--duration) var(--easeOutExpo),
      visibility 0s linear var(--duration);

    &:target {
      visibility: visible;
      transform: translateX(0);
      transition: transform var(--duration) var(--easeOutExpo);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    --duration: 1ms;
  }
}

#sidenav-button,
#sidenav-close {
  /* ... tap/touch styles ... */
  @media (min-width: 540px) {
    display: none;
  }
}
```

```js
// Example JavaScript Snippets
const sidenav = document.querySelector('#sidenav-open');
const closenav = document.querySelector('#sidenav-close');
const opennav = document.querySelector('#sidenav-button');

sidenav.addEventListener('keyup', e => {
  if (e.code === 'Escape') {
    document.location.hash = '';
  }
});

sidenav.addEventListener('transitionend', e => {
  if (e.propertyName !== 'transform') {
    return;
  }
  const isOpen = document.location.hash === '#sidenav-open';
  isOpen ? closenav.focus() : opennav.focus();
});
```

## Fallback Strategies

While modern browsers offer excellent support for the features used in this component (CSS Grid, `:target`, `position: sticky`, CSS Transforms, basic JS events), consider the following for broader compatibility if needed:

### JavaScript Polyfills:
- **For older browser support for `:target` behavior:** While `:target` is widely supported, complex interactions might require JavaScript-based state management if extreme legacy browser support is a concern.
- **For animation fallbacks:** If CSS transitions/animations are not supported, JavaScript-based animation libraries (e.g., GSAP) could be used, though this adds complexity.

### Accessibility Fallbacks:
- **ARIA roles and states:** Ensure appropriate ARIA roles (`role="navigation"`, `aria-label` for buttons) are used to convey structure and function to assistive technologies.
- **Focus Management:** Rigorous focus management is crucial, especially when dynamically showing/hiding content. The provided JavaScript handles this for opening and closing.
- **Reduced Motion:** The `prefers-reduced-motion` media query is essential for users sensitive to motion.

Always test your implementation across a range of browsers and devices to ensure a consistent and accessible user experience.