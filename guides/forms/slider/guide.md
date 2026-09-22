---
name: slider
description: Style a native slider in a brand-consistent way while preserving native functionality and accessibility.
web-feature-ids:
  - accent-color
  - input-range
#  later: ::slider-thumb, ::slider-track, ::slider-fill
guides:
  - slider-tooltip
---

<!--
Instead of re-creating the control, this guide shows how to style <input type=range> for common needs.
Once css-forms-1 ::slider-thumb, ::slider-track, ::slider-fill are in place, the current guidance moves to the fallbacks section.

Link to slider-tooltip if a tooltip is also desired.
 -->

# Brand-Consistent Range Slider

## Overview

The native `<input type="range">` element is the most robust, performant, and accessible way to let users select a value from a range. Re-creating sliders from scratch using custom elements and touch handlers is error-prone, breaking keyboard controls (such as arrow keys, `Home`, `End`), screen reader announcements, and mobile touch scaling.

Instead of re-creating the control, this guide shows how to style `<input type="range">` for any numerical input needs (e.g., volume, rating, temperature, progress) using the modern `accent-color` property. This themes the interactive slider thumb and native track fill in one line of CSS while keeping all native browser layout, performance, and accessibility features intact.

If you also need a tooltip that displays the current value following the thumb, see the `slider-tooltip` guide.

## Implementation

### 1. Structure the HTML

Always use a native `<input type="range">` programmatically associated with a `<label>`. This ensures correct accessibility, keyboard navigation, and screen reader announcements across all devices.

Configure the range and stepping granularity (`min`, `max`, `step`) based on your specific use case. Initialize the `aria-valuetext` attribute with your unit formatting so screen readers announce human-readable units (e.g. "70 percent", "22 degrees", "3 stars") rather than raw numbers:

```html
<div class="slider-group">
  <!-- Use a descriptive label programmatically linked to the input -->
  <label for="range-slider">Volume Level</label>
  <input
    type="range"
    id="range-slider"
    min="0"               <!-- Adjust min value based on use case -->
    max="100"             <!-- Adjust max value based on use case -->
    value="70"            <!-- Set initial starting value -->
    step="1"              <!-- Optional: Adjust step granularity (e.g. step="5" or "0.1") -->
    aria-valuetext="70%"  <!-- Match the initial formatted unit (e.g., '70%', '22°C', '3 Stars') -->
  />
  
  <!-- Explicit instructions helper for keyboard and screen-reader users -->
  <div class="instructions">
    Use Arrows to adjust, PageUp/PageDown to adjust by larger increments, and Home/End to jump to boundaries.
  </div>
</div>
```

### 2. Apply Brand Colors via `accent-color`

Use `accent-color` to style the native slider thumb. Configure colors using CSS custom properties and media queries to dynamically support dark mode.

```css
:root {
  --brand-color: #0066cc;
  --track-bg: #e0e0e0;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --brand-color: #4da6ff;
    --track-bg: #333333;
  }
}

input[type="range"] {
  accent-color: var(--brand-color); /* Style native interactive thumb and track fill */
  width: 100%;
  height: 2.5rem; /* Generous touch target area conforming to web accessibility standards */
  cursor: pointer;
}

.instructions {
  font-size: 0.85rem;
  opacity: 0.7;
  margin-top: 0.25rem;
}
```

### 3. Maintain Keyboard Focus Indicators

Ensure keyboard users have a visible focus indicator by styling the `:focus-visible` state explicitly when overriding default browser controls.

```css
input[type="range"]:focus-visible {
  outline: 2px solid var(--brand-color);
  outline-offset: 4px;
}
```

### 4. Display the Current Value and Update Screen Readers Dynamically

To show the selected value visually and ensure assistive technologies announce the updated units dynamically as the user slides, programmatically update both your visual text display and the `aria-valuetext` attribute on the `input` event.

Format the text using appropriate units (%, degrees, currency, stars) matching your specific use case:

```html
<!-- Display text placed next to or above the slider -->
<span id="value-display">70%</span>
```

```javascript
const slider = document.getElementById('range-slider');
const display = document.getElementById('value-display');

// Adaptive formatter function based on the slider's numeric purpose
function formatValue(value) {
  // Example formats: 
  // For percentages: return `${value}%`;
  // For degrees: return `${value}°C`;
  // For ratings: return `${value} Stars`;
  return `${value}%`;
}

slider.addEventListener('input', (e) => {
  const formattedValue = formatValue(e.target.value);
  display.textContent = formattedValue;
  
  // Set aria-valuetext so VoiceOver announces the descriptive unit rather than the raw number
  slider.setAttribute('aria-valuetext', formattedValue); 
});
```

---

## Fallback Strategies

If your Baseline target includes older browsers that do not support the `accent-color` property, implement a progressive enhancement custom styling fallback.

{{ FEATURE_FALLBACKS("accent-color") }}

### Custom Slider Fallback

Target unsupported browsers using the `@supports not` rule. These styles reset the default slider appearance and build custom track, thumb, and fill components using browser-specific pseudo-elements.

#### 1. Fallback CSS

```css
@supports not (accent-color: var(--brand-color)) {
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    outline: none;
  }

  /* WebKit Track (updated via JS progress variable) */
  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(
      to right,
      var(--brand-color) var(--progress, 0%),
      var(--track-bg) var(--progress, 0%)
    );
  }

  /* WebKit Thumb */
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: var(--brand-color);
    cursor: pointer;
    margin-top: -6px; /* Centered relative to track */
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    transition: transform 0.1s ease;
  }

  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  /* Firefox Track */
  input[type="range"]::-moz-range-track {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: var(--track-bg);
  }

  /* Firefox Thumb */
  input[type="range"]::-moz-range-thumb {
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: var(--brand-color);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    transition: transform 0.1s ease;
  }

  input[type="range"]::-moz-range-thumb:hover {
    transform: scale(1.1);
  }

  /* Firefox Progress Fill */
  input[type="range"]::-moz-range-progress {
    background-color: var(--brand-color);
    height: 8px;
    border-radius: 4px;
  }

  /* Focus Indicators for Custom Fallbacks */
  input[type="range"]:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--brand-color);
    outline-offset: 4px;
  }

  input[type="range"]:focus-visible::-moz-range-thumb {
    outline: 2px solid var(--brand-color);
    outline-offset: 4px;
  }
}
```

#### 2. JavaScript Progressive Enhancement

Unlike Firefox, WebKit browsers do not support a native `::-moz-range-progress` pseudo-element to dynamically fill the track background. To emulate this in the WebKit fallback, use a progressive enhancement script that conditionally updates the `--progress` CSS custom property on the range input, executing only if `accent-color` is unsupported.

```javascript
// Initialize and update progress variable in WebKit when accent-color is unsupported
if (!CSS.supports('accent-color')) {
  const slider = document.getElementById('range-slider');

  const updateProgressProperty = (val) => {
    // Map progress relative to min/max range boundaries
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const percent = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--progress', `${percent}%`);
  };

  updateProgressProperty(slider.value);

  slider.addEventListener('input', (e) => {
    updateProgressProperty(e.target.value);
  });
}
```
