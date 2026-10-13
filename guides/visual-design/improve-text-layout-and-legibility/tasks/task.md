---
base_app: daily-grind
---
- Improve the layout and legibility of short standalone text content, such as headings (`h1`, `h2`) no longer than a few lines, by enabling the browser to apply evenly balanced line breaks when wrapping text, and format paragraphs (`p`) and `blockquote` elements to avoid single-word orphans on the last line.
- improve the text layout across the site. make the main titles and section headings wrap nicely so they are balanced and even across multiple lines. for the descriptive paragraphs and blockquotes, let's use the browser's smart wrapping to prevent single-word orphans at the end of paragraphs. please avoid applying this globally using a universal selector or body selector to ensure we don't hit performance issues.
- can you fix the awkward text wrapping on the site? the h1 and h2 headings look messy when they wrap, and paragraphs sometimes end with just a single word on the last line. use specific element selectors for headings, paragraphs, and blockquotes to balance the headers and clean up those paragraph orphans cleanly without using global/body rules.
