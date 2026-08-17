---
base_app: empty-app
---
- Create an extremely minimal web page that loads a popular, unmodified CSS stylesheet from '/assets/shared-widget.css' and a script from '/assets/shared-widget.js', both already carrying integrity attributes with known hashes. Opt both into a shared cross-origin cache so any origin that already has the identical bytes can reuse them, without writing any custom JavaScript caching logic. Write the page to index.html.
- Add a `<script type="module">` block that imports a shared configuration module from '/assets/shared-config.js' with a known integrity hash, opting it into the shared cross-origin cache for global reuse, but only when the browser supports doing so; fall back to a plain import otherwise. Show the loaded config or an error message in a div with id "module-status".
- I need a minimal page with a `<link>` for a shared CSS framework and a `<script>` for a shared JS framework, both already integrity-checked, that lets any site pull them from a shared cache instead of downloading its own copy, using markup attributes only, no custom fetch/cache code.
