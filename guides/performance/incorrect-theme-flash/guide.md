---
name: prevent-incorrect-theme-flash
description: Leverage the color-scheme specification at the earliest possible stage: the HTML parsing layer, by placing <meta name="color-scheme" content="light dark"> high within the <head> of the HTML document. The browser is reliably informed of the document's supported color schemes well before it attempts its initial viewport paint.
web-feature-ids:
  - color-scheme
---