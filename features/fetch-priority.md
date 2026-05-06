# fetch-priority

## Fallbacks { #fallbacks }

The `fetchpriority` attribute (or `priority` option in the Fetch API) is a progressive enhancement. If a browser does not support it, the hint is ignored, and the browser uses its default priority heuristics. No explicit feature detection or fallback logic is required for basic usage.

## Deprecated Importance { #deprecated-importance }

- **DO NOT** use the deprecated `importance` attribute/key. It has been replaced by `fetchpriority` (or `priority`) and is not supported by any browser.
