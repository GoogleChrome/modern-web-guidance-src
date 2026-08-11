---
name: load-shared-resources-declaratively
description: Serve popular, unmodified scripts, stylesheets, and JavaScript modules from a shared cross-origin cache using markup or import syntax alone, without writing custom caching logic.
web-feature-ids:
  - cross-origin-storage
---

<!-- This use case covers COS's declarative HTML and JavaScript integrations: the `crossoriginstorage` attribute on `<link>`/`<script>` elements that already carry `integrity`, and the `crossOriginStorage` import attribute on static and dynamic module imports. Both let markup or import syntax opt a resource into the shared cross-origin cache without any imperative `navigator.crossOriginStorage` calls. -->
