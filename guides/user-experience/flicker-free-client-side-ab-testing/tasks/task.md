---
base_app: empty-app
---
- Create a landing page with a hero section and a call-to-action button. Load an A/B testing script from `https://cdn.example.com/experiment-sdk.js` that modifies the DOM to show different variants to different users. Ensure the user never sees the original content flash before the experiment variant is applied.
- Create a product page that loads a client-side experimentation SDK to inject variant styles and content. The page must not show any flash of the original content before the experiment takes effect, and must not use an anti-flicker snippet that hides the page with `opacity: 0`.
- Create a page with a hero section that fetches a variant configuration from `/api/experiment?id=hero-cta` and applies the variant by setting a `data-variant` attribute on the `<html>` element. The page must not render until the variant has been applied, but HTML parsing should not be blocked.
