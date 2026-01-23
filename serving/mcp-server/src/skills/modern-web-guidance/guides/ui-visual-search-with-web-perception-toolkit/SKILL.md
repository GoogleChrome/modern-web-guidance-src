---
description: Enable visual search on your website by mapping real-world objects to content using the Web Perception Toolkit and structured data.
filename: visual-search-with-web-perception-toolkit
category: ui
---

# Visual Searching with the Web Perception Toolkit

Reference docs:
- [Web Perception Toolkit](https://github.com/GoogleChromeLabs/perception-toolkit)
- [Getting Started](https://perceptiontoolkit.dev/getting-started/)
- [I/O Sandbox demo](https://io.perceptiontoolkit.dev/)

## Best Practices

The Web Perception Toolkit enables visual search by allowing you to map real-world objects ("targets") to your website's content. This mapping is defined using structured data (JSON-LD).

### Structured Data for Target Recognition

The toolkit requires you to provide linked JSON data for the targets it should recognize. This data also includes information to be displayed to the user.

- **DO** include your structured data in a JSON linked data file.
- **DO** link this file using a `<script>` tag with the `"application/ld+json"` MIME type.
- **DO** define targets using a schema like `ARArtifact` with `arTarget` and `arContent` properties. The `arTarget` should specify the recognition method (e.g., `Barcode`), and `arContent` should link to relevant web content (`WebPage`).

```html
<script type="application/ld+json" src="//path/to/your/sitemap.jsonld"></script>
```

```js
[
  {
    "@context": "https://schema.googleapis.com/",
    "@type": "ARArtifact",
    "arTarget": {
      "@type": "Barcode",
      "text": "012345678912"
    },
    "arContent": {
      "@type": "WebPage",
      "url": "http://localhost:8080/demo/artifact-map/products/product1.html",
      "name": "Product 1",
      "description": "This is a product with a barcode",
      "image": "http://localhost:8080/demo/artifact-map/products/product1.png"
    }
  }
]
```

### Customizing the User Experience

You can customize the user interface beyond the default provided by the toolkit.

- **DO** leverage lifecycle events, particularly `PerceivedResults`, to respond to detected targets.
- **DO** call `event.preventDefault()` at the beginning of your event handler if you want to prevent the default UI from showing.
- **DO** process `event.detail.found` and `event.detail.lost` arrays to manage detected and lost targets.
- **DO** create custom UI elements like `Card` and `ActionButton` from `PerceptionToolkit.Elements` to build your user experience.
- **DO** append these elements to a container in your DOM.

```js
const container = document.querySelector('.container');
async function onPerceivedResults(event) {
  event.preventDefault();
  if (container.childNodes.length > 0) { return; }
  const { found, lost } = event.detail;
  const { ActionButton, Card } = PerceptionToolkit.Elements;

  if (found.length === 0 && lost.length === 0) {
    const button = new ActionButton();
    button.label = 'View catalog';
    button.addEventListener('click', () => {
      // Run code to launch a catalog.
    });
    const card = new Card();
    card.src = 'We wish we could help, but that\'s not our razor. Would you like to see our catalog?';
    card.appendChild(button);
    card.dataset.notRecognized = true; // Indicate this card is for unrecognized targets
    container.appendChild(card);
  } else if (found.length > 0) {
    const button = new ActionButton();
    button.label = 'Reorder';
    button.addEventListener('click', () => {
      // Run code to reorder.
    });
    const card = new Card();
    card.src = found[0].content; // Use content from the found target
    card.appendChild(button);
    container.appendChild(card);
  }
}
window.addEventListener(PerceptionToolkit.Events.PerceivedResults, onPerceivedResults);
```

### Styling Cards and Buttons

The toolkit provides default styling, but you can easily customize the look and feel.

- **DO** include the default stylesheet using a `<link>` element for basic styling.
- **DO** utilize the `style` properties of `Card` and `ActionButton` objects to apply custom organizational branding.

```html
<link rel="stylesheet" href="//path/to/toolkit/styles/perception-toolkit.css">
```

## Fallback Strategies

While the Web Perception Toolkit aims for broad compatibility, consider how users might interact in environments where camera access or specific features are limited. The toolkit's core functionality relies on browser capabilities for camera stream processing and potentially for structured data parsing.

- **DO** test your implementation across different devices and browsers to ensure a consistent experience.
- **DO** provide alternative ways for users to access content if visual search fails or is unavailable (e.g., a traditional search bar or catalog link).