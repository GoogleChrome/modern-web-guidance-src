---
description: Ensure consistent user experiences for keyboard navigators by maintaining logical source order, especially when visually reordering content with CSS.
filename: maintain-logical-source-order
category: a11y
---

# Content Reordering and Accessibility

When creating a layout using CSS, ensure you give the same experience for keyboard users as other users.

The order of content in your document is important for the accessibility of your site. A screen reader reads out content based on the document order, using the HTML elements to give additional meaning to that content.

A person navigating the site with a keyboard, rather than a touchscreen or mouse, tabs around the document. They jump from active element to active element, tabbing between links and form fields, in the order the elements exist in the document.

Therefore, starting with a well-structured document and using the right HTML elements is a key part of creating an accessible site. However, it's possible to undo some of that good work when you start using CSS.

## Source versus visual order

Website navigation is often marked up as a list of links. You can use [Flexbox](/articles/responsive-web-design-basics#flexbox) to turn these into a horizontal bar. In the following example, a commonly used pattern is created. Clicking into the example and tabbing between the links shows the focus moving in a logical direction from left to right, the order that we read in English.

<div class="wd-embed" style="height: 260px;" s>
  <iframe allow="camera; clipboard-read; clipboard-write; encrypted-media; geolocation; microphone; midi;"
  loading="lazy" src="https://codepen.io/web-dot-dev/embed/BaXyyKL?height=260&amp;default-tab=result&amp;editable=true"
  style="height: 100%; width: 100%; border: 0;"></iframe>
</div>

If you've created this navigation pattern and then were asked to move **Contact Us**, which is second in the source, to the end, you could use the Flexbox `order` property to move its location.

Tabbing through the items in the next example, which uses the `order` property to rearrange the items, reveals a problem.

<div class="wd-embed" style="height: 260px; width: 100%">
  <iframe allow="camera; clipboard-read; clipboard-write; encrypted-media; geolocation; microphone; midi;"
  loading="lazy" src="https://codepen.io/web-dot-dev/embed/XWvJJjP?height=260&amp;default-tab=result&amp;editable=true"
  style="height: 100%; width: 100%; border: 0;"></iframe>
</div>

The focus jumps to the final item and then back again. As far as the tab order is concerned, that item is the second item. Visually, however, it's the last item.

This example highlights the problem that arises if you rearrange and reorder content using CSS. The right fix for this problem is to change the order of the links in the source, rather than emulating that change using CSS.

## Which CSS properties can cause reordering?

Any layout method that lets you move elements around can cause this problem. The following CSS properties commonly cause content reordering problems:

- Using `position: absolute` and taking an item out of flow visually.
- The `order` property in Flexbox and Grid layout.
- The `row-reverse` and `column-reverse` values for `flex-direction` in Flexbox.
- The `dense` value for `grid-auto-flow` in Grid Layout.
- Any positioning by line name or number, or with `grid-template-areas` in Grid Layout.

In the next example, a layout is created using CSS Grid and the items are positioned using line numbers, without considering their order in the source.

<div class="wd-embed" style="height: 420px">
  <iframe allow="camera; clipboard-read; clipboard-write; encrypted-media; geolocation; microphone; midi;" loading="lazy" src="https://codepen.io/web-dot-dev/embed/wvVBBJg?height=420&amp;default-tab=result&amp;editable=true" style="height: 100%; width: 100%; border: 0;"></iframe>
</div>

Tabbing around this example shows how the focus jumps about, making for a very confusing experience, especially on a long page.

## Testing for the problem

<figure class="attempt-right">
  <img src="image/a-screenshot-the-accessi-34fee3f713b8b.jpg" alt="" width="800" height="919">
  <figcaption>A screenshot of the Accessibility Insights Tool demonstrating the confusing order of items.</figcaption>
</figure>

A quick test is to keyboard navigate through your page. Can you get to everything? Are there any strange jumps as you do so?

For a visual demonstration of content reordering, try the Tab Stop checker in the Chrome Extension, [Accessibility Insights](https://accessibilityinsights.io/). The screenshot shows the CSS Grid example in that tool, illustrating how focus has to jump around the layout.

## Content reordering and responsive web design

If you only have one presentation of your content, then you should be able to maintain a logically ordered source that reflects the layout. This can be harder when you consider the layout at different breakpoints. For example, it might make sense to move an element to the bottom of the layout on smaller screens.

At this time, there isn't a good solution for that particular problem. In most situations, developing mobile-first can help you keep your source and layout in order. The right prioritizations for mobile are often right for your content at-large. The key is to know when there's a possibility of content reordering. Test to make sure that the end experience isn't too jarring at each breakpoint.