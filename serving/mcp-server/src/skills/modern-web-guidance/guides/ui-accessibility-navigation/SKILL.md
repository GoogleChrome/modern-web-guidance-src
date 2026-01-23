---
description: Improve navigation for assistive technology users by structuring content with headings and landmarks, and providing skip links.
filename: accessibility-navigation
category: ui
---

# Accessibility Navigation

Reference docs:
- [HTML5 Landmark elements](https://www.w3.org/TR/2017/NOTE-wai-aria-practices-1.1-20171214/examples/landmarks/HTML5.html)
- [Headings don't skip levels audit](https://web.dev/inspect-accessibility-errors/#headings-don-t-skip-levels)
- [The page contains a heading, skip link, or landmark region audit](https://web.dev/inspect-accessibility-errors/#the-page-contains-a-heading-skip-link-or-landmark-region)

## Best Practices

Screen readers and other assistive technologies rely on semantic HTML elements to help users navigate and understand web content. By using headings to create a clear outline and landmarks to define major sections, you can significantly improve the experience for users of these technologies. Additionally, skip links allow users to bypass repetitive navigation elements.

### Use headings to outline the page

Organize your content with `h1` through `h6` elements to create a logical structure. This allows users navigating by headings to form a mental model of the page. A common pattern is to use a single `h1` for the main title, `h2` for major sections, and `h3` for subsections.

```html
<h1>Company name</h1>
<section>
  <h2>Section Heading</h2>
  ...
  <h3>Sub-section Heading</h3>
</section>
```

### Don't skip heading levels

Avoid skipping heading levels (e.g., going from an `h2` to an `h4`) to maintain the outline structure. If you need specific styling, use CSS rather than relying on default browser styles that might break the semantic hierarchy.

For example, if "IN THE NEWS" is a section heading (`h2`) and the headlines below it are sub-sections (`h3`), use these tags even if the visual styling of the `h3` needs to be larger than the `h2`.

You can use the Lighthouse Accessibility audit to check for skipped heading levels.

### Use landmarks to aid navigation

Utilize HTML5 landmark elements like `<main>`, `<nav>`, and `<aside>` to define distinct regions of your page. This provides easily identifiable jump points for assistive technologies. Avoid excessive use of landmarks, as too many can be overwhelming. Aim for a single `<main>` element.

Lighthouse recommends manually auditing your site to ensure HTML5 landmark elements are used effectively for navigation.

### Bypass repetitive content with skip links

Implement skip links to allow users to bypass blocks of repetitive content, such as navigation menus, that appear at the beginning of many pages. A skip link is an offscreen anchor that becomes visible on focus, typically linking to the main content area.

```html
<!-- index.html -->
<a class="skip-link" href="#main">Skip to main</a>
...
<main id="main">
  [Main content]
</main>
```

```css
/* style.css */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000000;
  color: white;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

Many popular websites, including GitHub, The NY Times, and Wikipedia, use skip links. Test this by pressing the `TAB` key a few times when visiting these sites.

The Lighthouse Accessibility audit includes a check for the presence of a heading, skip link, or landmark region. While the audit is somewhat broad, passing it indicates good structural content.