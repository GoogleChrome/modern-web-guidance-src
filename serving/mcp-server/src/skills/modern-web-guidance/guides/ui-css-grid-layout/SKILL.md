---
description: Use CSS Grid Layout to create flexible and responsive web application layouts, enabling content to adapt to different screen sizes and overlap for unique designs.
filename: css-grid-layout
category: ui
---

# CSS Grid Layout

Reference docs:
- [CSS Grid Layout Module](https://www.w3.org/TR/css-grid-1/)
- [slides](http://sydcss-grid.appspot.com/)

## Executive summary

*   CSS Grid Layout allows for the definition of rows and columns for page layout.
*   Grids can adapt to utilize available space effectively.
*   Content order can be independent of the grid container's display order.
*   Layouts can be modified based on media queries, facilitating responsive design.
*   Content can overlap, enabling layouts not possible with other methods.
*   Grid Layout offers high performance.

## Try it out

To enable CSS Grid Layout in Chrome, you need to turn on an experimental flag.

1.  Navigate to `chrome://flags` in your browser.
2.  Scroll down and find the option to "Enable experimental Web Platform features".
3.  Click "Enable".
4.  You will be prompted to restart the browser. Click "Relaunch Now".

Once the browser has restarted, you will be able to use CSS Grid Layout.

## Best Practices

When implementing CSS Grid Layout, consider the following:

*   **Define your grid structure:** Use `display: grid` on a container element and then define your columns and rows using properties like `grid-template-columns`, `grid-template-rows`, `grid-gap`, etc.
*   **Place items explicitly or implicitly:** You can explicitly place grid items using `grid-column` and `grid-row` properties, or let the grid auto-place them.
*   **Leverage responsiveness:** Use media queries to adjust your grid's layout for different screen sizes, ensuring a consistent experience across devices.
*   **Consider content reordering:** Utilize the `order` property on grid items or redefine the grid structure in media queries to change the visual order of content without altering the source order.
*   **Explore overlapping content:** CSS Grid allows for items to occupy the same grid cells, enabling complex and visually interesting layouts. Use negative indices or span across defined lines for overlapping.
*   **Prioritize performance:** While generally performant, be mindful of overly complex grid definitions that might impact rendering speed on lower-end devices.

## Let us know what you think

CSS Grid Layout is a powerful new primitive for web development. We encourage you to experiment with it and provide feedback. You can share your thoughts by:

*   Leaving a comment on the blog post.
*   Sending an email to the [W3C CSS Working Group list](mailto:www-style@w3.org) with "[css-grid]" in the subject.
*   Logging bugs or sharing your experiences on social media.

We look forward to seeing the innovative layouts you create with this feature.