---
name: load-shared-resources-declaratively
description: Serve popular, unmodified scripts, stylesheets, and JavaScript modules from a shared cross-origin cache using markup or import syntax alone, without writing custom caching logic.
web-feature-ids:
  - tmp-cross-origin-storage
  - subresource-integrity
---

# Load shared resources declaratively

Popular scripts, stylesheets, and JavaScript modules, such as UI frameworks or widget libraries served from a CDN, are byte-for-byte identical across many unrelated sites, yet every site's visitors download and cache their own copy. Cross-Origin Storage (COS) lets the browser keep one on-device copy of such a file, identified by its content hash, and serve it to every site that references the same bytes. Resources that already carry an `integrity` hash opt in through markup or import syntax alone: the `crossoriginstorage` attribute on `<link>` and `<script>` elements, or the `crossOriginStorage` import attribute on static and dynamic module imports. The browser handles the lookup, the network fallback, and storing the file, so no custom caching code is needed.

## How to implement

1. **Start from `integrity`.** Both declarative forms require an existing, valid `integrity` hash on the element or import, since that hash is what identifies the file in COS.
2. **Add the COS attribute alongside it.** For HTML, add `crossoriginstorage` to a `<link>` or `<script>` element. For module imports, add `crossOriginStorage` inside the same `with { ... }` block as `integrity`.
3. **Choose the sharing scope.** Pick it from the resource's real distribution, as described in the "Sharing scope" section.
4. **For module imports, use dynamic `import()` inside `try`/`catch`.** A static `import` with an unsupported `crossOriginStorage` key fails the whole module at parse time, and a dynamic `import()` with one rejects before fetching anything. Catch the rejection and import the same URL without the attribute.

## Example code

```html
<link
  rel="stylesheet"
  href="/assets/shared-widget.css"
  integrity="sha256-example-only-hash"
  crossorigin="anonymous"
  crossoriginstorage="*"
/>
<script
  src="/assets/shared-widget.js"
  integrity="sha256-example-only-hash"
  crossorigin="anonymous"
  crossoriginstorage="*"
  defer
></script>
```

```javascript
// MANDATORY: Use dynamic import() inside try/catch. A browser without
// native support for the crossOriginStorage import attribute rejects it
// before fetching anything, even when navigator.crossOriginStorage exists
// (for example, added by an extension), so that object is no signal for
// import attribute support.
let mod;
try {
  mod = await import('/assets/shared-config.js', {
    with: {
      integrity: 'sha256-YKd8aU4ILF6re6EiM6lTEdAiGTFjVgVk9867zPSCAhs=',
      crossOriginStorage: '*',
    },
  });
} catch {
  // Fall back to a plain import of the same URL.
  mod = await import('/assets/shared-config.js');
}
```

## Sharing scope

{{ FEATURE("tmp-cross-origin-storage", "sharing-scope") }}

## Best practices

- **DO** keep the `src`/`href`/module specifier pointing at the resource's real, working network URL, since a COS lookup that doesn't succeed falls back to that URL exactly like ordinary `integrity`-checked fetches do.
- **DO NOT** introduce a separate imperative fetch/cache step in JavaScript for a resource that already carries `integrity`; add the declarative attribute instead.
{{ FEATURE("tmp-cross-origin-storage", "naming") }}

## Fallback strategy

{{ FEATURE("tmp-cross-origin-storage", "browser-support") }}

The HTML form degrades gracefully: a browser that doesn't recognize `crossoriginstorage` simply ignores the attribute, per ordinary HTML attribute-parsing rules, and the element still loads via its plain `href`/`src`. The static JavaScript import-attribute form does not degrade the same way, since an unrecognized `with` key is a hard failure; use dynamic `import()` inside `try`/`catch` as shown in the example.

With the extension installed, `navigator.crossOriginStorage` exists, but the literal import attribute still fails: a static `import` fails to parse, and a dynamic `import()` rejects. For module imports, the extension provides two non-standard shims:

- **`<script type="module-cos">`:** the extension reads the script as text, resolves every static or dynamic import that carries `crossOriginStorage` and has a literal string specifier, and runs the rewritten source as a regular module. Computed specifiers such as variables or template literals are not rewritten.
- **`navigator.crossOriginStorage.__non_standard__import(specifier, options)`:** takes the same arguments as dynamic `import()`, including a computed specifier.

**DO NOT** make either shim the only code path, since neither exists outside the extension.
