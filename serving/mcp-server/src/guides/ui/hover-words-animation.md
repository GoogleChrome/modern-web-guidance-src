---
description: Create animated text effects that respond to user motion preferences, enhancing interactivity while respecting accessibility.
filename: hover-words-animation
category: ui
---

# Split Text - Hover Words

Reference docs:
- [Split Text Animations Article](/articles/building/split-text-animations)
- [Split Text Animations Video on YouTube](https://www.youtube.com/watch?v=3hvN7bkjZBk)
- [Split Text Animations Source on Github](https://github.com/argyleink/gui-challenges/tree/main/split-text)

## Best Practices

This pattern creates interactive word effects that respect user's motion preferences. It splits text into individual characters or words, allowing for fine-grained animation control.

### Respecting Motion Preferences

To ensure accessibility and a better user experience, always consider the user's operating system-level motion preferences. The `prefers-reduced-motion` media query is crucial for this.

- **DO** use the `prefers-reduced-motion` media query to conditionally apply animations.
- **DO** provide simpler or disabled animations when `prefers-reduced-motion` is enabled.

```css
/* Default animation */
.animated-word {
  /* animation properties */
}

/* Reduced motion animation */
@media (prefers-reduced-motion: reduce) {
  .animated-word {
    /* alternative, simpler animation or no animation */
    animation: none;
  }
}
```

### Performance Considerations

Animating individual characters can be performance-intensive. Optimize your animations for smooth playback.

- **DO** use hardware-accelerated CSS properties like `transform` and `opacity` for animations.
- **DO** limit the number of elements being animated simultaneously if possible.
- **DO** consider using techniques like `will-change` judiciously to hint to the browser about upcoming animations, but avoid overusing it.

### Structural Best Practices

Organize your HTML and CSS to facilitate the splitting and animation process.

- **DO** ensure your markup is semantic and accessible.
- **DO** use a clear naming convention for your CSS classes.
- **DO** consider using JavaScript to split the text if CSS alone is not sufficient for the desired effect, but ensure the JavaScript is efficient.

**Example JavaScript (conceptual):**

```javascript
function splitTextIntoWords(selector) {
  const elements = document.querySelectorAll(selector);
  elements.forEach(element => {
    const text = element.innerText;
    const words = text.split(' ');
    element.innerHTML = ''; // Clear original text
    words.forEach(word => {
      const wordSpan = document.createElement('span');
      wordSpan.classList.add('animated-word'); // Add class for styling/animation
      wordSpan.innerText = word + ' '; // Add word and space back
      element.appendChild(wordSpan);
    });
  });
}

// Call the function with the appropriate selector
// splitTextIntoWords('.your-text-container');
```

## Fallback Strategies

While modern browsers offer good support for animation, consider scenarios where advanced animations might not render as intended or where specific JS features are relied upon.

### CSS Animations

- **DO** ensure basic text visibility and readability even if CSS animations fail to load or render due to browser limitations or CSS parsing errors.
- **DO** provide a non-animated fallback for the text content itself.

### JavaScript Enhancements

If JavaScript is used to enhance the animation:

- **DO** ensure the core text content is present and readable without JavaScript.
- **DO** check for browser compatibility of any JavaScript APIs used for animation (e.g., Web Animations API).
- **DO** conditionally load or execute JavaScript animation logic only if the necessary browser features are detected.