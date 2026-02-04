# content-visibility Performance Demo

This project demonstrates the dramatic rendering performance improvements provided by the CSS `content-visibility` property. It uses computationally expensive rendering techniques to showcase how skipping the rendering of off-screen content can reduce initial load times by orders of magnitude.

## Key Files

- **`golden-demo.html`**: The primary demonstration. It features a "Long Feed" of 500 complex cards and a toggle to enable or disable `content-visibility: auto`.
- **`negative-demo.html`**: An unoptimized version of the demo with all `content-visibility` logic and controls stripped out. Useful for baseline A/B testing in performance tools.
- **`generate-negative.js`**: A robust Node.js utility that regenerates `negative-demo.html` from `golden-demo.html` using a marker-based `indexOf` parser.
- **`expectations.md`**: A detailed list of requirements for a successful `content-visibility` implementation.

## Demo Highlights

- **Engineered Rendering Stress**: 500 cards utilizing heavy SVG filters (`feTurbulence`), backdrop blurs, and stacked drop-shadows to ensure the performance impact of deferred rendering is immediately obvious.
- **Live Metrics**: Built-in measurement of injection-to-paint timing with auto-detection of the optimization state.
- **Persistence**: Optimization settings persist via `sessionStorage` for stable benchmarking across refreshes.

## Implementation Expectations

For a successful and correct implementation of `content-visibility`, we adhere to a set of strategic, dimensional, and accessibility requirements.

*See the full list of requirements in [expectations.md](./expectations.md).*

## Automated Testing

This project uses **Playwright** to assert that implementation expectations are being met. The suite includes static source checks, functional browser assertions (performance and A11y), and API discipline monitoring.

### Running Tests

```bash
pnpm install
pnpm test
```

*See the implementation details in [tests/content-visibility.spec.js](./tests/content-visibility.spec.js).*

## Development

### Generating the Negative Demo
If you make changes to the layout or complexity in `golden-demo.html`, you can update the unoptimized version by running:

```bash
node generate-negative.js
```

### Browser Support
The `content-visibility` property is part of **Baseline 2024** and is supported in all modern versions of Chrome, Edge, Safari, and Firefox.