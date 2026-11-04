* Stylesheets define `@keyframes` for both the entry and exit states, using either two separate `@keyframes` rules or a single `@keyframes` rule with `entry` and `exit` timeline-range selectors.
* Target elements attach the entry and exit animation(s)—either two separate animations or a single `@keyframes` animation with `entry` and `exit` range selectors.
* Target elements link their animation(s) to a view progress timeline using either an anonymous `view()` timeline (such as `view(inline)`) or a named `view-timeline` (using a `<dashed-ident>` name such as `--tl`).
* Animations are restricted to the `entry` and `exit` phases, either via `animation-range` or via `entry` and `exit` keyframe selectors inside `@keyframes`.
* Feature detection uses `@supports` checking both scroll-driven timeline support (such as `animation-timeline: view()` or `view-timeline: --tl`) and `animation-range: entry`.
* Animations respect user preferences for reduced motion using `@media (prefers-reduced-motion)`.
