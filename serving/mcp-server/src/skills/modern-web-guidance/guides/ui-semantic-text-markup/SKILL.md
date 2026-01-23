---
description: Use semantic HTML elements to structure content and improve accessibility for better SEO and screen reader compatibility.
filename: semantic-text-markup
category: ui
---

# Text Markup Best Practices

This guide covers best practices for semantically marking up text content in HTML to enhance accessibility, search engine optimization (SEO), and overall content structure.

## Headings

Use heading elements (`<h1>` to `<h6>`) to outline your document structure logically. This helps screen reader users navigate content and search engines understand the hierarchy of information.

- **DO** use headings to represent the structure of your document as if you were outlining it.
- **DO NOT** use headings solely for styling purposes. Use CSS for visual presentation.
- **DO** ensure that heading levels are implemented hierarchically (e.g., an `<h2>` should not appear before an `<h1>`).

## Paragraphs

Use the `<p>` element to mark up distinct paragraphs of text.

- **DO** wrap each paragraph in `<p>` tags.
- **DO** close your `<p>` tags, even though they are optional in some contexts.

## Quotes and Citations

Use `<blockquote>` for block-level quotations and `<q>` for inline quotations. Use `<cite>` to identify the source of a quotation or other creative work.

- **DO** use `<blockquote>` for longer, block-level quotes.
- **DO** use `<q>` for shorter, inline quotes.
- **DO** use `<cite>` to provide the title of a work or the name of its author.
- **DO** use the `cite` attribute on `<blockquote>` or `<q>` to provide a URL for the source of the quote, if applicable. This is machine-readable and not visible to the user.
- **DO NOT** include the citation within the `<blockquote>` or `<q>` element itself unless it's an integral part of the quote.
- **DO** use `<br>` sparingly for line breaks within physical addresses, poetry, or signature blocks, not for separating paragraphs.

## HTML Entities

Use HTML entities to display special characters or reserved characters.

- **DO** use `&lt;` for the less-than symbol (`<`).
- **DO** use `&gt;` for the greater-than symbol (`>`).
- **DO** use `&amp;` for the ampersand symbol (`&`).
- **DO** use `&quot;` for the double-quote symbol (`"`).
- **DO** use named entities like `&copy;` for copyright (©), `&trade;` for trademark (™), and `&nbsp;` for non-breaking space.
- **DO** ensure your document includes `<meta charset="UTF-8">` in the `<head>` for proper character encoding.
- **DO** escape characters not supported by UTF-8 if necessary.

## Accessibility Considerations

- **DO** use semantic HTML elements to provide structure and meaning to your content. This aids screen readers and other assistive technologies.
- **DO** provide accessible names for landmarks (like sections) using `aria-labelledby` when appropriate.
- **DO NOT** overuse landmarks, as too many can be disorienting for screen reader users.