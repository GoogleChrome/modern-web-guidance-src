---
name: progress
description: Build a styled progress bar that communicates completion of a task or process, in both determinate and indeterminate states.
web-feature-ids:
  - accent-color
  - progress
  - color-scheme
---

# Build a Styled Progress Bar

The `<progress>` element is the semantic way to represent the completion progress of a task, like downloading or uploading information or completing part of a multi-step process. Using the native element helps with accessibility, as screen readers have an implicit `role="progressbar"` and can announce values.

## How to implement

1.  **Use the native `<progress>` element**: It provides built-in accessibility and platform-consistent behavior.
2.  **Define the state**:
    *   **Determinate**: Set the `max` and `value` attributes. Note that `<progress>` does **not** support a `min` attribute; the minimum is always `0`.
    *   **Indeterminate**: Omit the `value` attribute for tasks of unknown duration to set the progress bar into an indeterminate state. You can also use the `:indeterminate` pseudo-class to explicitly put the progress bar in an indeterminate state. 
    *   **Mandatory:** If a progress bar needs to change from determinate to indeterminate, you must remove the value attribute (`element.removeAttribute('value')`);
3.  **Standardize Styles**: Use `appearance: none` and `border: unset` to normalize the progress bar across different browsers before applying more customized styles.
4.  **Ensure Accessibility**:
    *   **Associate a label**: Use `<label for="...">`, `aria-labelledby`, or `aria-label`. 
    *   **Contextual state**: Use `aria-describedby` to reference the loading progress of a section of a page. Use `aria-busy="true"` on the container being updated. Set `aria-busy` to `"false"` when the task is complete. 
    *   **Forced Announcements**: Set `tabindex="-1"` and call `.focus()` on the element in JavaScript when significant updates occur to force screen readers to announce the new progress.

## Example code: Determinate state

```html
  <label for="p">File progress:</label>
  <progress id="p" value="20" max="100">20%</progress>
  <button id="update-btn">Add 10%</button>

<style>
  :root {
    --brand-color: teal;
  
    color-scheme: light dark;
    /* Set accent color for progress and other built-in UI elements */
    accent-color: var(--brand-color, AccentColor); /* Use system accent color as a fallback */
  }

  progress {
    /* The progress bar inherits its accent-color from :root */

    /* Basic sizing */
    display: block;
    inline-size: 100%;
    max-inline-size: 400px;
    margin-block: 0.5rem;
  }
</style>

<script>
  const bar = document.getElementById('p');
  const btn = document.getElementById('update-btn');

  // Manually updates value attribute
  btn.addEventListener('click', () => {
    if (bar.value < bar.max) {
      bar.value += 10;
    } else {
      bar.value = 0; // Reset
    }
    // Sync fallback text
    bar.textContent = `${bar.value}%`;
  });
</script>
```

## Example code: Indeterminate state

```html
  <label for="p">Downloading...:</label>
  <!-- Omit value attribute for indeterminate state -->
  <progress id="p" max="100">Loading...</progress>

<style>
  :root {
    --brand-color: teal;
  
    color-scheme: light dark;
    /* Set accent color for progress and other built-in UI elements */
    accent-color: var(--brand-color, AccentColor); /* Use system accent color as a fallback */
  }

  progress {
    /* Basic sizing */
    display: block;
    inline-size: 100%;
    max-inline-size: 400px;
    margin-block: 0.5rem;
  }
</style>
```

## Customized Styling: Example code

```html
<section id="upload-container" aria-live="polite" aria-describedby="upload-progress">
  <label for="upload-progress">
    <span class="sr-only">File Upload Status:</span>
    <progress id="upload-progress" tabindex="-1">
      Preparing...
    </progress>
  </label>
  <p id="status-text">Preparing...</p>
</section>

<style>
  :root {
    /* Automatic theme adaptation */
    color-scheme: light dark;

     /* Set accent-color globally */
    accent-color: var(--accent-color, AccentColor);

    --color-dark-accent: oklch(52.451% 0.159 325);
    --accent-color: var(--color-dark-accent); 
    --color-surface: light-dark(oklch(95.6% 0.027 340), oklch(30% 0.027 340));
  }

  progress {
     /* Custom color for progress bar track */
    --progress-track-color: var(--color-surface);
    /* Reset default browser styles */
    appearance: none;
    border: unset;

    block-size: 0.5lh;
    inline-size: 100%;
    max-inline-size: 400px;
    margin-block: 0.5rem;
    display: block;
    /* Optional: Use large number on the border radius to ensure border is always rounded */
    border-radius: 1e5px;

    &[value] {
      --progress-color: var(--accent-color);
    }

    /* **Mandatory**: -moz- and -webkit- pseudo selectors cannot be grouped. If grouped one of the selectors will be ignored. */
    /* Apply color for custom progress track (background) */
    &,
    &::-webkit-progress-bar {
      background: var(--progress-track-color);
    }
    
    /* Apply color for custom progress bar */
    &::-webkit-progress-value {
      background: var(--progress-color);
    }

    &::-moz-progress-bar {
      background: var(--progress-color);
    }

    /* Indeterminate state animation */
    /* Optional: Use the :indeterminate psueudo-class as part of a selector (progress:indeterminate) */
    &:not([value]) {
      background: linear-gradient(90deg, transparent, var(--progress-color, currentColor), transparent);
      background-size: 200% 100%;
      animation: loading 2s infinite linear;
    }

    @keyframes loading {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }

    /* Respect prefers-reduced-motion */
    @media (prefers-reduced-motion: reduce) {
      &:not([value]) {
        /* Slow down the animation significantly and use a subtler visual change */
        animation-duration: 10s;
        background: linear-gradient(90deg, var(--color-surface), var(--accent-color), var(--color-surface));
        background-size: 200% 100%;
      }
    }

    /* Ensure track backgrounds don't hide animation in WebKit and Firefox.
       Note: These cannot be grouped or the entire rule will be ignored. */
    &:not([value])::-webkit-progress-bar {
      background: transparent;
    }
    &:not([value])::-moz-progress-bar {
      background: transparent;
    }
      /* Indicate when progress is programmatically focused */
    &:focus-visible {
      outline: 1px solid canvasText;
      outline-offset: 4px;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>

<script>
  const container = document.getElementById('upload-container');
  const bar = document.getElementById('upload-progress');
  const status = document.getElementById('status-text');

  function simulateTask() {
    container.setAttribute('aria-busy', 'true');

    setTimeout(() => {
      bar.max = 100;
      bar.value = 0;
      bar.textContent = "0%";
      // Force screen reader to announce the start of progress
      bar.focus();

      const interval = setInterval(() => {
        bar.value += 10;
        bar.textContent = `${bar.value}%`;

        if (bar.value >= 100) {
          clearInterval(interval);
          status.textContent = "Task Complete!";
          bar.textContent = "Task Complete!";
          container.setAttribute('aria-busy', 'false');
          bar.focus(); // Announce completion
        } else {
          status.textContent = `Progress: ${bar.value}%`;
        }
      }, 400);
    }, 2000);
  }

  simulateTask();
</script>
```


### Cross-Browser Normalization
Browsers have different default looks for `<progress>`. To achieve a truly custom design, you must override the browser's default styling:

```css
progress {
  /* Reset default browser styles */
  appearance: none; 
  border: unset;   

  /* Track color (background) for Chrome, Safari, and newer Edge */
  &,
  &::-webkit-progress-bar {
   background-color: var(--progress-bar-track-color);
  } 
  /* Progress bar color for Chrome, Safari, and newer Edge */
  &::-webkit-progress-value {
    background-color: var(--progress-bar-color);
  }
  /* Firefox */
  &::-moz-progress-bar {
    background-color: var(--progress-bar-color);
  }

  /* Indicate when progress is programmatically focused */
  &:focus-visible {
    outline: 1px solid canvasText;
    outline-offset: 4px;
  }
}
```

### Indeterminate Animations
The indeterminate state can be styled with a background animation to provide better visual feedback than the browser default:

```css
progress:not([value]) {
  appearance: none;
  background: linear-gradient(to right, #ccc 30%, #333 50%, #ccc 70%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

/* Ensure the animation is visible in WebKit browsers */
progress:not([value])::-webkit-progress-bar {
  background: transparent;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

## Best Practices

*   **DO** use `<progress>` for task completion. Use the `<meter>` element for scalar measurements.
*   **DO** use `accent-color` for simple branding and `color-scheme` for dark mode support.
*   **DO** normalize with `appearance: none` and `border: unset` if you need a specific custom look.
*   **DO** manage accessibility by ensuring labels are present and using `tabindex="-1"` + `.focus()` for dynamic updates.
*   **Mandatory:** **DO NOT** add a fallback value inside the `<progress>` element. It is not used by assistive technology and ignored by all modern browsers. 
*   **DO NOT** use `<progress>` for scroll position indicators; use scroll-driven animations instead.
*   **DO** respect `prefers-reduced-motion` if you apply custom animations.
*   **DO** ensure proper contrast between the progress bar and track when adden custom styles.

## Fallback strategies

{{ FEATURE_FALLBACKS("progress") }}

{{ FEATURE_FALLBACKS("accent-color") }}

{{ FEATURE_FALLBACKS("color-scheme") }}

The `accent-color` and `color-scheme` properties are progressive enhancements. Browsers that do not support them will use their default system colors and theme, maintaining a functional experience.

