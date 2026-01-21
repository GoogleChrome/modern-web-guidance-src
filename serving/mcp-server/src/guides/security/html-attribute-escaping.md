---
description: Protect against mutation XSS vulnerabilities by understanding how the HTML specification now escapes '<' and '>' characters in attributes.
filename: html-attribute-escaping
category: security
---

# HTML Spec Change: Escaping `<` and `>` in Attributes

Reference docs:
- [HTML specification update](https://github.com/whatwg/html/pull/6362)
- [Mutation XSS](https://cure53.de/fp170.pdf)

## Best Practices

This change ensures that `<` and `>` characters within HTML attributes are now consistently escaped to `&lt;` and `&gt;` respectively. This is a security enhancement to prevent mutation XSS (mXSS) vulnerabilities.

### What Changed

When serializing DOM elements to HTML strings (e.g., via `outerHTML` or `innerHTML`), the browser will now escape these characters in attribute values.

**Before:**

```html
<div data-content="<u>hello</u>"></div>
```

When reading `div.outerHTML`, the output would be:

```html
<div data-content="<u>hello</u>"></div>
```

**After:**

```html
<div data-content="&lt;u&gt;hello&lt;/u&gt;"></div>
```

When reading `div.outerHTML`, the output will now be:

```html
<div data-content="&lt;u&gt;hello&lt;/u&gt;"></div>
```

### What Didn't Change

This change **does not** affect HTML parsing. An attribute containing `<` or `>` will still be parsed correctly, and the value retrieved through DOM APIs will remain decoded.

```html
<div id="div1" data-content="<u>hello</u>"></div>
<div id="div2" data-content="&lt;u&gt;hello&lt;/u&gt;"></div>
```

Both `div` elements will parse identically, and `div.dataset.content` will return `"<u>hello</u>"` for both.

### Retrieving Attribute Values Safely

To retrieve attribute values, always use standard DOM APIs. These APIs will return the decoded values, unaffected by the serialization change.

-   `Element.getAttribute(name)`
-   `Element.getAttributeNS(namespaceURI, localName)`
-   `HTMLElement.dataset`
-   `Element.attributes`

**Example:**

```html
<div data-content="&lt;u&gt;"></div>
```

```js
const div = document.querySelector("div");
// All of the following will log "<u>"
console.log(div.getAttribute("data-content"));
console.log(div.dataset.content);
console.log(div.attributes['data-content'].value);
```

### Potential Breakages

#### Using `innerHTML` or `outerHTML` to Extract Attributes

Code that relies on parsing `innerHTML` or `outerHTML` with regular expressions to extract attribute values might break.

**Example of potential breakage:**

```html
<div data-content="<u>"></div>
```

```js
const div = document.querySelector("div");
// Previously: content would be "<u>"
// Now: content will be "&lt;u&gt;"
const content = div.outerHTML.match(/"([^"]+)"/)[1];
console.log(content);
```

**Recommendation:** Avoid parsing HTML with regular expressions. Use the DOM APIs mentioned above for reliable attribute retrieval.

#### End-to-End Tests

If your end-to-end tests compare generated HTML against static expected values, and those values contain `<` or `>`, these tests may fail.

**Action:** Update your test expectations to reflect the new escaped format (`&lt;` and `&gt;`).

## Summary

The HTML specification now mandates the escaping of `<` and `>` characters within attribute values during HTML serialization. This security measure helps mitigate mXSS vulnerabilities. Developers should ensure they are using standard DOM APIs for attribute retrieval and update any tests or code that might be affected by this serialization change.

## Additional Information

-   [Original bug report](https://github.com/whatwg/html/issues/6235)
-   [Pull request](https://github.com/whatwg/html/pull/6362)
-   [ChromeStatus entry](https://chromestatus.com/feature/6264983847174144)
-   [Security Rationale Blog Post](https://bughunters.google.com/blog/5038742869770240)