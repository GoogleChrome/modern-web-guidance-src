---
name: html-markers
description: Mark positions and ranges in server-rendered HTML and attach data to them, so client-side code such as a hydration runtime can find them without adding elements that affect layout, styling, or accessibility.
web-feature-ids:
  - html-processing-instructions
---

# Marking HTML Positions and Ranges with Processing Instructions

HTML processing instructions (`<?target attr="value">`) let server-rendered HTML embed non-visual position and range markers with structured attributes directly in the DOM tree. Client-side code — such as a hydration runtime, island loader, or reactive template engine — can locate these `ProcessingInstruction` nodes and read or update their attributes in place.

Use HTML processing instructions instead of wrapper elements or unstructured comments:

- **No layout, selector, or accessibility side effects:** Unlike wrapper elements (`<span>`, `<div>`, or custom elements — even with `display: contents`), `ProcessingInstruction` nodes (`Node.PROCESSING_INSTRUCTION_NODE`) are non-visual `CharacterData` nodes. They generate no layout boxes, do not alter CSS child or sibling selectors (`:first-child`, `:nth-child()`, `:empty`, `>`, `+`), and do not appear in the accessibility tree.
- **Valid inside restricted HTML elements:** The HTML parser keeps processing instructions in place inside `<table>`, `<tbody>`, `<tr>`, `<colgroup>`, `<select>`, and `<head>` instead of moving them outside such elements or stripping them altogether.
- **Structured target and attribute API:** Unlike HTML comments (`<!-- ... -->`), which only expose a raw `.data` string, a `ProcessingInstruction` node exposes:
    - a `.target` property
    - a dedicated `NodeFilter.SHOW_PROCESSING_INSTRUCTION` traversal filter
    - element-like attribute methods such as:
        - `getAttribute()`
        - `setAttribute()`
        - `hasAttribute()`
        - `removeAttribute()`
        - `toggleAttribute()`
        - `getAttributeNames()`
        - `hasAttributes()`

If you want the browser to declaratively replace `<?marker>` or `<?start>`...`<?end>` placeholders as `<template for>` elements stream in from the server without custom client-side DOM traversal, see {{ GUIDE_REF("out-of-order-html-streaming") }} instead.

## 1. Authoring Position and Range Markers in HTML

An HTML processing instruction begins with `<?`, followed immediately by a `target` name, optional whitespace and attributes, and closes with `>` (or `?>`; the HTML parser strips a trailing `?` before `>` from the node's `.data`).

- **Target naming rules:** The `target` **MUST** start with an ASCII letter (`a-z`, `A-Z`) or underscore (`_`), followed by ASCII letters, digits, hyphens (`-`), or underscores (`_`).
- **MANDATORY: Do not use `xml` or `xml-stylesheet` as target names.** The HTML parser treats `<?xml ...>` and `<?xml-stylesheet ...>` (case-insensitively) as regular HTML comments for legacy compatibility rather than creating `ProcessingInstruction` nodes.
- **Choose clear target conventions for positions vs. ranges:** Use a single processing instruction (for example, `<?hydrate ...>`) to mark a specific node position or preceding an interactive element, and a paired start/end instruction (for example, `<?range-start ...>` and `<?range-end>`, or `<?start ...>` and `<?end>` when not paired with `<template for>`) to mark a multi-node DOM range.
- **MANDATORY: Quote all attribute values with `=` (`name="value"` or `name='value'`).** Unquoted values (`step=2`), boolean attributes without a value (`defer`), or duplicate attribute names prevent the browser from parsing the node's attributes, leaving its attribute map empty (`pi.hasAttributes()` returns `false`, where `pi` is the `ProcessingInstruction` DOM node). Represent boolean flags with an empty or explicit string (`defer=""` or `defer="true"`).
- **MANDATORY: Escape `>`, `<`, `&`, and quotes inside attribute values.** Unlike HTML element tags, the HTML parser does not ignore `>` inside quotes in a processing instruction: the first raw `>` character immediately closes `<?...>` even inside quotes, and a trailing `?` before `>` is stripped. Attribute values also cannot contain raw `<` or unescaped `&`. Always escape them as `&gt;`, `&lt;`, `&amp;`, `&quot;`, and `&apos;` in HTML markup (`pi.getAttribute()` automatically decodes them).
- **Use consistent lowercase or kebab-case names:** Unlike HTML elements, `pi.target` and `ProcessingInstruction` attribute names are **case-sensitive** (`pi.getAttribute('viewId')` does not match `viewid`).

```html
<!-- Position marker: attach hydration metadata before an interactive control
     without adding a wrapper element that would break flex/grid layout or selectors.
     MANDATORY: Quote all attribute values and escape quotes/brackets (&quot;, &gt;, &lt;, &amp;). -->
<div class="toolbar">
  <?hydrate component="like-button" step="1" label="Likes &gt; 0" hydrated="false">
  <button type="button" class="like-btn">Likes: <span>12</span></button>
</div>

<!-- Range markers: mark dynamic rows directly inside <tbody>.
     Processing instructions stay in place instead of being moved outside the table. -->
<table>
  <thead>
    <tr>
      <th scope="col">Task</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody aria-live="polite">
    <tr class="pinned-row">
      <td>System check</td>
      <td>Complete</td>
    </tr>
    <?range-start name="task-rows" filter="active">
    <tr>
      <td>Deploy edge worker</td>
      <td>Active</td>
    </tr>
    <tr>
      <td>Verify metrics</td>
      <td>Active</td>
    </tr>
    <?range-end>
  </tbody>
</table>
```

## 2. Locating Markers and Updating Ranges in JavaScript

Standard CSS selector APIs (`querySelector`, `querySelectorAll`) only match `Element` nodes and cannot find processing instructions.

### Discovering Markers and Reading Attributes

Use `document.createTreeWalker()` (or `document.createNodeIterator()`) with `NodeFilter.SHOW_PROCESSING_INSTRUCTION` to locate markers in tree order, then inspect `pi.target` and read or mutate attributes with `getAttribute()` and `setAttribute()`:

```javascript
// Walk all ProcessingInstruction nodes under a root container in a single pass.
function findMarkers(root = document.body) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_PROCESSING_INSTRUCTION
  );
  const markers = [];
  while (walker.nextNode()) {
    markers.push(walker.currentNode);
  }
  return markers;
}

// Example: Hydrate elements immediately following a <?hydrate ...> marker in place.
for (const pi of findMarkers()) {
  if (pi.target === 'hydrate' && pi.getAttribute('hydrated') !== 'true') {
    const step = Number(pi.getAttribute('step') ?? 1);
    const control = pi.nextElementSibling;
    if (control) {
      control.addEventListener('click', () => {
        const countEl = control.querySelector('span');
        if (countEl) {
          countEl.textContent = String(Number(countEl.textContent) + step);
        }
      });
      // Mutating attributes via setAttribute() / toggleAttribute() / removeAttribute()
      // automatically re-serializes pi.data with XML-escaped double-quoted attributes.
      pi.setAttribute('hydrated', 'true');
    }
  }
}
```

To create a marker imperatively in JavaScript, prefer `document.createProcessingInstruction(target, data)` over `new ProcessingInstruction(target, data)`. Both initialize the node's target, data, and attribute map identically, and `document.createProcessingInstruction()` works across all browsers.

### Resolving and Updating Marked Ranges

To manipulate the DOM nodes between a start marker (`<?range-start ...>` or `<?start ...>`) and its matching end marker (`<?range-end>` or `<?end>`), walk `nextSibling` while tracking a `nestingLevel` counter so nested ranges do not terminate the outer range early. Position a `Range` between `startMarker` and `endMarker` so replacing the range contents leaves both boundary markers intact for future updates:

```javascript
// Locate the matching end marker for a start marker, accounting for nested ranges.
function findRangeEnd(startMarker, startTarget = 'range-start', endTarget = 'range-end') {
  let nestingLevel = 0;
  let sibling = startMarker.nextSibling;

  while (sibling) {
    if (sibling.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
      if (sibling.target === startTarget) {
        nestingLevel += 1;
      } else if (sibling.target === endTarget) {
        if (nestingLevel === 0) return sibling;
        nestingLevel -= 1;
      }
    }
    sibling = sibling.nextSibling;
  }
  return null;
}

// Replace the DOM nodes inside a marked range while keeping both boundary markers in the DOM.
function replaceMarkedRange(startMarker, endMarker, newNodes) {
  const range = document.createRange();
  // Position the range strictly after startMarker and strictly before endMarker
  // so deleteContents() removes only the interior nodes and preserves the markers.
  range.setStartAfter(startMarker);
  range.setEndBefore(endMarker);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  fragment.append(...newNodes);
  range.insertNode(fragment);
}
```

## 3. Fallback Strategies

{{ BASELINE_STATUS("html-processing-instructions") }}

In browsers that do not yet support `html-processing-instructions`, the HTML parser parses `<?target ...>` as an HTML comment, creating a `Comment` node (`Node.COMMENT_NODE`) whose `.data` starts with `?` (such as `'?hydrate component="like-button" step="1"'`), and `ProcessingInstruction.prototype` lacks `getAttribute()` and its companion attribute methods.

**MANDATORY:** Keep the `<?target attr="value">` processing instruction syntax in your HTML for all browsers — do not rewrite markers as `<!-- ... -->` comments or wrapper elements. Because `document.createProcessingInstruction(target, data)` and `ProcessingInstruction.prototype` are widely available across all browsers, use feature detection (`Object.hasOwn(ProcessingInstruction.prototype, 'getAttribute')`) to polyfill the attribute methods on `ProcessingInstruction.prototype` and upgrade `?target ...` comment nodes in place to `ProcessingInstruction` nodes before running your marker logic:

```javascript
// Feature-detect native HTML processing instruction attribute support.
const supportsHtmlPI = Object.hasOwn(ProcessingInstruction.prototype, 'getAttribute');

if (!supportsHtmlPI) {
  const unescapeXml = (str) => str
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
  const escapeXml = (str) => String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
  const parseAttrs = (data) => {
    const map = new Map();
    const trimmed = data.trim();
    if (!trimmed) return map;
    const tokenRe = /([^\s=]+)\s*=\s*(?:"([^"<&]*(?:&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);[^"<&]*)*)"|'([^'<&]*(?:&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);[^'<&]*)*)')\s*/y;
    let pos = 0;
    while (pos < trimmed.length) {
      tokenRe.lastIndex = pos;
      const match = tokenRe.exec(trimmed);
      if (!match || map.has(match[1])) return new Map();
      map.set(match[1], unescapeXml(match[2] ?? match[3] ?? ''));
      pos = tokenRe.lastIndex;
    }
    return map;
  };
  const writeAttrs = (pi, map) => {
    pi.data = Array.from(map, ([k, v]) => `${k}="${escapeXml(v)}"`).join(' ');
  };

  Object.assign(ProcessingInstruction.prototype, {
    hasAttributes() { return parseAttrs(this.data).size > 0; },
    getAttributeNames() { return [...parseAttrs(this.data).keys()]; },
    getAttribute(name) { return parseAttrs(this.data).get(name) ?? null; },
    hasAttribute(name) { return parseAttrs(this.data).has(name); },
    setAttribute(name, value) {
      const map = parseAttrs(this.data).set(name, String(value));
      writeAttrs(this, map);
    },
    removeAttribute(name) {
      const map = parseAttrs(this.data);
      map.delete(name);
      writeAttrs(this, map);
    },
    toggleAttribute(name, force) {
      const map = parseAttrs(this.data);
      const keep = force ?? !map.has(name);
      if (keep && !map.has(name)) map.set(name, '');
      else if (!keep) map.delete(name);
      writeAttrs(this, map);
      return keep;
    },
  });
}

// Upgrade Comment nodes (<!--?target ...-->) created by non-supporting HTML parsers
// into real ProcessingInstruction nodes in place.
function upgradeFallbackMarkers(root = document) {
  if (supportsHtmlPI) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const comment of comments) {
    const match = /^\?([a-zA-Z_][a-zA-Z0-9_-]*)(?:\s+([\s\S]*?))?\??$/.exec(comment.data);
    if (match && !/^(?:xml|xml-stylesheet)$/i.test(match[1])) {
      comment.replaceWith(document.createProcessingInstruction(match[1], match[2] ?? ''));
    }
  }
}

upgradeFallbackMarkers(document);
```
