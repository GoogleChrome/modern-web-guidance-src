---
name: detect-at-rule-support
description: Apply CSS only when the browser supports a specific at-rule, enabling progressive enhancement for new CSS at-rules without JavaScript.
web-feature-ids:
  - supports-at-rule
---

<!-- TODO
- Detecting `at-rule()` support itself
- JS fallback
- Guidance to try alternatives first (e.g. `@supports(color: --foo())` instead of `@supports at-rule(@function)` see https://codepen.io/leaverou/pen/qERMKgd?editors=0100 )
-->
