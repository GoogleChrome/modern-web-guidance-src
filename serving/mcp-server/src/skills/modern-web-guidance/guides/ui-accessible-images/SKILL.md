---
description: Provides guidance on creating accessible images by offering strategies for decorative, informative, functional, and complex images, along with best practices for alternative text.
filename: accessible-images
category: ui
---

# Accessible Images

## Best Practices

When creating images for the web, it's crucial to ensure they are accessible to all users, including those who use assistive technologies (AT). This involves understanding the purpose of each image and providing appropriate alternative text or descriptions.

### Decorative Images

Decorative images add aesthetic value but do not convey essential information. They should be programmatically hidden from ATs.

**DO** hide decorative images using one of the following methods:
- An empty or null `alt` attribute (`alt=""`).
- Setting `role="presentation"` or `role="none"` on the image element.
- Using `aria-hidden="true"` on the image element.
- Adding the image as a CSS background, as screen readers cannot detect these.

**DO NOT** provide meaningful `alt` text for decorative images, as this can create unnecessary clutter for screen reader users.

### Informative Images

Informative images convey concepts, ideas, or emotions and are essential for understanding the content.

**DO** provide a concise and descriptive `alt` attribute that accurately reflects the image's purpose and content.
- For `<img>` elements, use the `alt` attribute: `<img src="image.jpg" alt="Description of the image">`.
- For inline `<svg>` elements, use `role="img"` and a `<title>` element for the description:
  ```html
  <svg role="img">
    <title>Description of the SVG image</title>
    <!-- SVG content -->
  </svg>
  ```

**DO NOT** use generic or unhelpful `alt` text like "image" or "picture."

### Functional Images

Functional images are linked to an action, such as a logo that links to the homepage or a search icon.

**DO** provide `alt` text that describes the *action* the image performs, not just its visual appearance.
- Example for a search icon: `<button><img src="search.png" alt="Search"></button>`
- For logos that are also links, consider how to convey both the visual and the action, potentially by combining visually hidden text with the image's `alt` text.

**DO NOT** omit alternative descriptions for functional images, as users will not understand what action the image performs.

### Complex Images

Complex images, such as infographics, maps, or charts, require more detailed explanations.

**DO** provide a short, descriptive `alt` attribute for the image itself, and then offer a more detailed explanation through one of the following methods:
- Link to a separate page or resource with the detailed explanation.
- Provide a jump link to a longer description later on the same page.
- Use the `aria-describedby` attribute to link the image to an element containing the longer description.
- Use `<figure>` and `<figcaption>` elements to semantically group the image and its description.

**DO** ensure the longer description is accessible and understandable for users who may not be able to visually interpret the complex image.

## Alternative Text Best Practices

*   **Be succinct and relevant:** Aim for `alt` text that is around 150 characters or less. If more detail is needed, use the complex image patterns.
*   **Avoid redundant phrases:** Do not start `alt` text with "image of," "photo of," or "graphic of," as screen readers already identify the element as an image.
*   **Be accurate and consistent:** Use descriptive filenames as a fallback for missing or ignored `alt` text.
*   **Use proper punctuation:** This helps screen readers parse the text correctly and makes descriptions sound natural.
*   **Write naturally:** Avoid keyword stuffing. Focus on conveying the image's meaning to a human user.
*   **Avoid special characters:** Use dashes between words in filenames and `alt` text instead of underscores or other special characters.

## Check your understanding {:.hide-from-toc}

Test your knowledge.

{# Include the quiz file #}

{% include "learn/accessibility/images/_quiz.html" %}