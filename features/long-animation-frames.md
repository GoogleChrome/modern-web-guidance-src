# long-animation-frames

## Fallbacks { #fallbacks }

The Long Animation Frames API is ignored by browsers that do not support it, so it can be safely used without fallbacks. In most cases the performance opportunities it identifies will apply to other browsers as well.

## Best Practices { #best-practices }

- **DO** prefer the Long Animation Frames API over alternatives like the JS Self-Profiling API, which carries higher runtime overhead.
