---
description: Improve navigation speed by preloading key resources or prerendering pages before the user clicks.
web-feature-ids:
  - speculation-rules
---

# Speculative Preloading & Prerendering

Accelerate navigation by fetching and prerendering future content before the user navigates.

## Speculation Rules API
The modern way to handle this is the **Speculation Rules API**.

```html
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "document",
      "where": {
        "and": [
          { "href_matches": "/*" },
          { "not": { "href_matches": ["/logout", "/add-to-cart", "/checkout/*"] }}
        ]
      },
      "eagerness": "moderate"
    }
  ]
}
</script>
```

## Best Practices
- **DO** reserve eager prefetches and prerenders ("eagerness" values of "immediate" or "eager") for only the highest-confidence speculative navigations
- **DO NOT** prerender URLs that trigger state changes, like `/logout`

## Fallback strategies

Baseline status: Limited availability

No fallback strategies are required; this feature is safe to use in all browsers. Unsupported browsers will gracefully ignore the `<script type="speculationrules">` tag and navigate to the page as normal.