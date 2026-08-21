---
name: scrollspy
description: Highlight the currently visible section of a page in a navigation menu
web-feature-ids:
  - scroll-marker-targets
  - scroll-target-group
guides:
  - scroll-progress-indicator
---

# Build a Scrollspy Navigation

A scrollspy navigation is a common UI pattern that automatically highlights the navigation link corresponding to the section of the page currently in the viewport. This provides users with a clear sense of where they are in a long document as they scroll.

This pattern is common in two scenarios:
- **Single-page websites**: Where the primary site navigation links to different sections of a single page rather than separate URLs.
- **Long-form content**: Where a table of contents or sidebar navigation tracks the user's progress through an article, guide, or documentation.

## How to implement

Traditionally, the scrollspy pattern required JavaScript and the `IntersectionObserver` API. Modern CSS provides a native way to achieve this using the `scroll-target-group` property and the `:target-current` pseudo-class.

1.  **Ensure Navigation Links use Fragment Identifiers**: Your navigation must consist of anchor links (`<a>`) that point to sections on the same page using fragment identifiers (e.g., `<a href="#section-1">`) that match the `id` of your content sections.
2.  **Enable Scroll Target Grouping**: Apply the `scroll-target-group: auto` property to the container of your navigation links. This tells the browser to treat these links as markers that track their respective targets.
3.  **Style the Active Link**: Use the `:target-current` pseudo-class on your navigation links to apply styles when their target section is visible in the scroll container.
4.  **Semantic State**: Use a script to update `aria-current="true"` on the active link when scrolling stops to ensure the state is correctly communicated to assistive technologies.

## Example code

This example highlights the active link in a fixed navigation menu as the user scrolls through sections.

```css

/* MANDATORY: The container of markers must have scroll-target-group: auto */
nav {
  /* Enables automatic tracking of fragment links */
  scroll-target-group: auto;
}
/* MANDATORY: Use :target-current to style the link whose target is in view. */
nav a:target-current {
  color: var(--accent, #007bff);
  border-bottom-color: var(--accent, #007bff);
}
```

```html
<nav>
  <a href="#intro">Introduction</a>
  <a href="#features">Features</a>
  <a href="#pricing">Pricing</a>
</nav>

<main>
  <section id="intro">
    <h2>Introduction</h2>
    <!-- content -->
  </section>
  <section id="features">
    <h2>Features</h2>
    <!-- content -->
  </section>
  <section id="pricing">
    <h2>Pricing</h2>
    <!-- content -->
  </section>
</main>

<script>
  if (CSS.supports('scroll-target-group: auto')) {
    const syncAriaCurrent = () => {
      const currentLink = document.querySelector('nav a:target-current');
      document.querySelectorAll('nav a').forEach(link => {
        link.setAttribute('aria-current', link === currentLink ? 'true' : 'false');
      });
    };
    // Update the aria on initial page load.
    setTimeout(syncAriaCurrent, 10);
    // Update the aria after scroll ends
    document.addEventListener('scrollend', syncAriaCurrent);
  }
</script>
```

## Best Practices

- **DO** use `scroll-target-group: auto` on a dedicated container for navigation links: This ensures the browser knows which links should be tracked.
- **DO** ensure targets have unique `id` attributes matching the links' `href` attributes.
- **DO** provide enough vertical space for sections: `scroll-target-group` most clearly identifies the visible target when sections are large enough that only one or two are visible at a time.
- **MANDATORY**: For accessibility, the visual state must be mirrored with `aria-current`. While `:target-current` handles the visual aspect, this is not exposed to screen readers.
- **DO NOT** rely solely on color for the active state: Include other visual cues like font weight, an underline, or an indicator dot to ensure the state is accessible to users with color vision deficiencies.

## Fallback strategies

{{ FEATURE_FALLBACKS("scroll-target-group") }}

For browsers that do not support `scroll-target-group`, you should use a fallback based on the `IntersectionObserver` API.

```html
<script>
  // Feature detection for scroll-target-group
  const supportsScrollTargetGroup = CSS.supports('scroll-target-group: auto');

  if (!supportsScrollTargetGroup) {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('main section');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            const isActive = link.getAttribute('href') === `#${id}`;
            // Use the escaped colon class for consistent styling
            link.classList.toggle('\:target-current', isActive);
            link.setAttribute('aria-current', isActive ? 'true' : 'false');
          });
        }
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });

    sections.forEach(section => observer.observe(section));
  }
</script>

<style>
  /* Fallback style if :target-current is not supported.
     Use :where() to combine the native pseudo-class with a fallback class for older browsers. DO NOT use `nav a:target-current, nav a.\:target-current, as the unrecognized pseudoselector invalidates the entire rule in older browsers. */
  nav a:where(:target-current, .\:target-current) {
    color: var(--accent, #007bff);
    border-bottom-color: var(--accent, #007bff);
    font-weight: bold;
  }
</style>
```
