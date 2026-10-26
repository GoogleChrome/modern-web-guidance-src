# `ariaNotify()` method

## Fallbacks

{{ BASELINE_STATUS("ariaNotify") }}

Use an ARIA live region, ensuring that the container is present in the page on load, and then add the messages to the live region container when relevant.

```html
<!-- Pre-populated hidden live region container -->
<div id="notification" aria-live="assertive"></div>
```

This content will be present in the DOM, and can be read by a screen reader after the message has been announced. Therefore, in order to provide context to this region, when the live region has content, add in text immediately before the container to provide context to the announcement. This will help people understand the purpose of the content if they identify it when reading the page.

```html
<p class="inclusively-hidden">Screen reader announcements</p>
<!-- Pre-populated hidden live region container -->
<div id="notification" aria-live="assertive">
  Dynamic announcement injected into the existing container.
</div>
```
