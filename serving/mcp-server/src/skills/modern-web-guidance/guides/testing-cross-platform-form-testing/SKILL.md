---
description: Ensure forms work across various devices, browsers, platforms, and contexts by implementing accessible design patterns and testing strategies.
filename: cross-platform-form-testing
category: testing
---

# Cross-Platform Form Testing

This document outlines best practices for ensuring web forms are functional and accessible across a wide range of devices, browsers, platforms, and user contexts.

## Best Practices

### Keyboard Accessibility

*   **Ensure clear focus indicators:** Use the `:focus` CSS pseudo-class to visually highlight active form fields. For more advanced control, utilize `:focus-visible` to show focus indicators only for keyboard users.
*   **Test with keyboard navigation:** Navigate through the entire form using only the `tab` key to identify any illogical jumps or unclear active elements.

```css
input:focus {
  outline: 4px solid #222;
}
```

*   **Learn more:** [Designing accessible focus indicators](https://www.sarasoueidan.com/blog/focus-indicators/) and [Using `:focus-visible`](/articles/style-focus#use_focus-visible_to_selectively_show_a_focus_indicator).

### Logical Tab Order

*   **Match visual and DOM order:** Ensure the order in which users tab through form elements matches their visual presentation on the page to prevent illogical navigation jumps.
*   **Learn more:** [Ensure visual order on the page follows DOM order](/visual-order-follows-dom).

### Touch Device Usability

*   **Adequate tap target size:** Ensure buttons have a minimum tap target size of 48px and that form controls (`<input>`, `<select>`) are large enough to be easily tapped.
*   **Sufficient spacing:** Provide ample spacing between form controls to prevent accidental taps.
*   **Learn more:** [Accessible tap targets](/articles/accessible-tap-targets).

### Optimized On-Screen Keyboards

*   **Use `type` and `inputmode` attributes:** Employ attributes like `type="tel"` or `inputmode="numeric"` to present optimized on-screen keyboards for specific input types, improving user efficiency.

```html
<input type="tel" inputmode="tel">
```

*   **Demo:** [Optimized Keyboard Demo](https://codepen.io/web-dot-dev/pen/88f1ffed62ef6bdd513351823b7aaa0f)

### Visible Form Buttons

*   **Prevent obscuration:** Utilize the `env()` CSS function to ensure form submission buttons are not hidden by browser toolbars or device UI elements, especially on mobile devices.
*   **Learn more:** [Using `env()` to ensure buttons are not obscured by device UI](https://developer.mozilla.org/docs/Web/CSS/env()#using_env_to_ensure_buttons_are_not_obscured_by_device_ui).

### Cross-Platform Testing

*   **Test on diverse devices:** Regularly test forms on various devices (desktops, laptops, tablets, smartphones), operating systems, and browsers.
*   **Utilize testing services:** Consider services like BrowserStack (free for open source) or Browserling (free trial) for extensive cross-browser and cross-device testing.

### Contextual Usability

*   **Consider environmental factors:** Test forms in different lighting conditions to ensure adequate contrast ratios for readability.
*   **Simulate real-world usage:** Imagine users interacting with the form while walking, in noisy environments, or under stressful conditions. Ensure the form is intuitive and easy to use in these scenarios.
*   **Learn more:** [Color and contrast accessibility](/articles/color-and-contrast-accessibility).

### Poor Connectivity Testing

*   **Simulate slow networks:** Use tools like WebPageTest or browser DevTools (Network Throttling) to simulate slow connections and different network types.
*   **Optimize for performance:** Ensure forms load and function efficiently even under poor network conditions.
*   **Learn more:** [Testing with low bandwidth and high latency](/articles/performance-poor-connectivity#testing).

## Sharing Test Results

*   **Document and share:** Thoroughly document all testing performed and share the results with your team. This aids in prioritizing issues and ensuring everyone is aware of critical tasks.
*   **Learn more:** [Sharing test results](/articles/performance-audit-share).

### Check your understanding {:.hide-from-toc}

Test your knowledge of cross-platform testing

<div class="wd-assessment"><devsite-multiple-choice>
   <div><p>Can you show focus indicators only for keyboard users?</p>
</div>
<div>
   <div>No</div>
   <div>Try again!</div>
</div>
<div correct>
   <div>Yes, using <code>:focus-visible</code>.</div>
   <div>🎉</div>
</div>
<div>
   <div>Yes, using <code>:focus-detected</code>.</div>
   <div>Try again!</div>
</div>
<div>
   <div>Yes, using <code>:focus-shown</code>.</div>
   <div>Try again!</div>
</div>
</devsite-multiple-choice>
</div>

## Resources

*   [WebPageTest](https://webpagetest.org/easy): Website Performance and Optimization Tests
*   [Testing with low bandwidth and high latency](/articles/performance-poor-connectivity#testing)
*   [Sharing test results](/articles/performance-audit-share)
*   [BrowserStack](https://www.browserstack.com)
*   [Browserling](https://www.browserling.com)