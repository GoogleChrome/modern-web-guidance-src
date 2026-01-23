---
description: Understand how browsers construct DOM and CSSOM trees to optimize page rendering speed.
filename: dom-cssom-construction
category: webperf
---

# Constructing the Object Model

## Document Object Model (DOM)

The browser constructs the DOM by parsing HTML bytes into characters, then tokens, then nodes, and finally linking these nodes into a tree data structure that represents the document's structure and relationships.

**Best Practices:**
- Ensure HTML is delivered to the browser as quickly as possible, as large amounts of HTML can slow down DOM construction.
- Be mindful of the time taken for DOM construction, especially for complex pages, as it can become a bottleneck for smooth animations.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link href="style.css" rel="stylesheet" />
    <title>Critical Path</title>
  </head>
  <body>
    <p>Hello <span>web performance</span> students!</p>
    <div><img src="awesome-photo.jpg" /></div>
  </body>
</html>
```

### DOM Construction Process:
1.  **Conversion:** Bytes → characters (based on encoding).
2.  **Tokenizing:** Characters → tokens (e.g., `<html>`, `<body>`).
3.  **Lexing:** Tokens → objects with properties and rules.
4.  **DOM Construction:** Objects linked into a tree capturing parent-child relationships.

## CSS Object Model (CSSOM)

The CSSOM is constructed similarly to the DOM: CSS bytes are converted into characters, then tokens, then nodes, which are then linked into a tree structure representing the styles.

**Best Practices:**
- Deliver CSS to the browser as quickly as possible, alongside HTML, to avoid render-blocking.
- Keep CSS independent of HTML to separate content and design concerns.
- Be aware that CSSOM construction and style recalculation contribute to rendering time.

```css
body {
  font-size: 16px;
}

p {
  font-weight: bold;
}

span {
  color: red;
}

p span {
  display: none;
}

img {
  float: right;
}
```

### CSSOM Construction Process:
1.  **Conversion:** Bytes → characters.
2.  **Tokenizing:** Characters → CSS tokens.
3.  **Lexing:** Tokens → CSS nodes.
4.  **CSSOM Construction:** Nodes linked into a tree, incorporating cascading rules and overriding user agent styles.

## Performance Considerations

- Use Chrome DevTools Performance panel to capture and inspect the construction and processing costs of DOM and CSSOM.
- DOM and CSSOM are independent data structures; the render tree links them together.
- The time taken for these construction processes directly impacts the Critical Rendering Path and overall page load performance.