# Expectations: `improve-next-page-load-performance`

- The speculation rules are defined inside a `<script type="speculationrules">` element unless delivered via a `Speculation-Rules` HTTP response header.
- The `<script type="speculationrules">` content is valid JSON.
- The rule set uses valid top-level keys (`"prefetch"`, `"prerender"`, `"prerender_until_script"`, or `"tag"`), defaulting to `"prefetch"` unless prerendering is explicitly required.
- Each rule object specifies either a `"where"` document rule object (using `"href_matches"`, `"selector_matches"`, `"and"`, `"or"`, or `"not"`) or a `"urls"` array of URL strings.
- No rule object includes the deprecated `"source"` property.
- Broad document rules that match site-wide links (such as `"href_matches": "/*"`) use `"eagerness": "moderate"` or `"conservative"` rather than `"eager"` or `"immediate"`.
- State-changing URLs (such as `/logout` or cart mutation routes) are excluded from speculation rules (omitted from `"urls"` lists and excluded via `"not"` conditions in broad `"where"` document rules).
- Any rule that sets `"eagerness"` uses `"immediate"`, `"eager"`, `"moderate"`, or `"conservative"`, and any rule using `"immediate"` targets at most 10 specific URLs.
- Speculation rules are applied to a multi-page application (MPA) with full-document navigations rather than a client-side routed Single Page Application (SPA).
