# hidden-until-found

## Fallbacks { #fallbacks }

The `hidden="until-found"` attribute is a progressive enhancement. In browsers that do not support it, elements will remain permanently hidden unless a fallback reveals them. Use feature detection targeting `onbeforematch` and reveal the content to ensure it remains searchable via Find-in-page in unsupporting browsers.

```javascript
if (!('onbeforematch' in HTMLElement.prototype)) {
  document.querySelectorAll('[hidden="until-found"]').forEach(el => {
    // Unsupported browsers show content to maintain searchability
    el.removeAttribute('hidden'); 
    // MANDATORY: also update any aria references to this element.
  });
}
```
