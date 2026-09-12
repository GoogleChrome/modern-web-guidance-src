---
name: load-shared-resources-declaratively
description: Serve popular, unmodified scripts, stylesheets, and JavaScript modules from a shared cross-origin cache using markup or import syntax alone, without writing custom caching logic.
web-feature-ids:
  - tmp-cross-origin-storage
---

# Load shared resources declaratively

Some resources are more naturally loaded declaratively, through HTML markup or JavaScript module imports, than through an imperative caching API. The Cross-Origin Storage (COS) API covers this case with two declarative surfaces that piggyback on the existing `integrity` mechanism: the `crossoriginstorage` attribute on `<link>`/`<script>` elements, and the `crossOriginStorage` import attribute on static and dynamic module imports. Both let markup or import syntax opt a resource into the shared cross-origin cache with no `navigator.crossOriginStorage` calls at all.

## How to implement

1. **Start from `integrity`.** Both declarative forms require an existing, valid `integrity` hash on the element or import, since that hash is what identifies the file in COS.
2. **Add the COS attribute alongside it.** For HTML, add `crossoriginstorage` to a `<link>` or `<script>` element. For module imports, add `crossOriginStorage` inside the same `with { ... }` block as `integrity`.
3. **Pick the value that matches the real sharing scope.** A valueless HTML attribute or an empty array (`[]`) for JavaScript imports means same-site-only. `"*"` means globally available. A space-separated (HTML) or array (JavaScript) list of origins restricts sharing to a specific trusted set.
4. **Keep `crossorigin` separate.** The `crossorigin` attribute controls the CORS request mode and is unrelated to `crossoriginstorage`, despite the similar name. Both can coexist on the same element.
5. **For dynamic imports, feature-detect first.** A static `import` statement with an unrecognized `crossOriginStorage` key is a hard parse-time failure, not an ignored attribute. Code that must keep working regardless of COS support should feature-detect and use dynamic `import()` instead.

## Example code

```html
<link
  rel="stylesheet"
  href="/assets/shared-widget.css"
  integrity="sha256-mXPhVm4mG5NhYQge+hY7V7c9Uy2mejppXiKq24un6AA="
  crossorigin="anonymous"
  crossoriginstorage="*"
/>
<script
  src="/assets/shared-widget.js"
  integrity="sha256-NDFkFtKeZCKtK3XKGa58d0kJVjCIrfdQGvPCW9HXt4s="
  crossorigin="anonymous"
  crossoriginstorage="*"
  defer
></script>
```

```javascript
// The static form can't degrade, so guard it with a feature check and
// fall back to a plain dynamic import when COS isn't supported.
const supportsCOS = !!navigator.crossOriginStorage?.requestFileHandle;

const mod = supportsCOS
  ? await import('/assets/shared-config.js', {
      with: {
        integrity: 'sha256-YKd8aU4ILF6re6EiM6lTEdAiGTFjVgVk9867zPSCAhs=',
        crossOriginStorage: '*',
      },
    })
  : await import('/assets/shared-config.js');
```

## Best practices

- **DO** add `crossoriginstorage` / `crossOriginStorage` only alongside a valid `integrity` value on the same element or import, never on its own.
- **DO** pick the value that matches the resource's real distribution: same-site default, an explicit origin list, or `'*'` for genuinely popular resources.
- **DO** keep the `src`/`href`/module specifier pointing at the resource's real, working network URL, since a COS lookup that doesn't succeed falls back to that URL exactly like ordinary `integrity`-checked fetches do.
- **DO** feature-detect before using the static import-attribute form, or use dynamic `import()` with a fallback, since an unrecognized import attribute key is a parse-time failure rather than a silently ignored one.
- **DO NOT** confuse `crossoriginstorage` with the unrelated `crossorigin` attribute, or `cross-origin-storage()` with the unrelated CSS `cross-origin()` modifier; they control different concerns and may coexist.
- **DO NOT** introduce a separate imperative fetch/cache step in JavaScript for a resource that already carries `integrity`; add the declarative attribute instead.

## Fallback strategy

{{ BASELINE_STATUS("tmp-cross-origin-storage") }}

The HTML form degrades gracefully: a browser that doesn't recognize `crossoriginstorage` simply ignores the attribute, per ordinary HTML attribute-parsing rules, and the element still loads via its plain `href`/`src`. The static JavaScript import-attribute form does not degrade the same way, since an unrecognized `with` key is a hard failure; feature-detect and use dynamic `import()` when broad compatibility matters.
