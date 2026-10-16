// @ts-check

/**
 * @fileoverview Safe DOM utilities, adapted from safedom (~/code/safedom/src/safedom.js).
 *
 * `dom` and `SafeHTML` are unchanged from safedom. `render()` is the one deliberate difference: safedom throws when
 * `setHTML()` is missing, but this page must also work in Safari, which hasn't shipped the Sanitizer API. So `render()`
 * uses `setHTML()` when it exists and falls back to a documented, inert-template path when it doesn't. See
 * `renderWithoutSanitizerAPI()` for exactly what that fallback does and doesn't guarantee.
 *
 * safedom's caveats still apply (dom`` has no attribute-context awareness):
 *   - Always quote attribute values: `title="${x}"`, never `title=${x}`.
 *   - Never interpolate untrusted values into href/src/action/style. HTML-escaping doesn't stop `javascript:` URLs.
 *
 * This page doesn't ship the Trusted Types CSP that safedom recommends (the rest of the dashboard assigns innerHTML),
 * so the fallback's `template.innerHTML` assignment is allowed. If that CSP is ever added, the fallback will throw,
 * which is the correct loud failure.
 */

// Module-private brand. dom`` is the only caller with it — external code cannot construct a SafeHTML. Modeled on Trusted Types (no public constructor).
const BRAND = Symbol('SafeHTML');
export class SafeHTML {
  #html;
  /**
   * @param {string} html
   * @param {symbol} brand
   */
  constructor(html, brand) {
    if (brand !== BRAND) {
      throw new TypeError('SafeHTML cannot be constructed directly. Use the dom`` tag.');
    }
    this.#html = html;
  }
  get html() { return this.#html; }
  toString() { return this.#html; }
}

/**
 * @typedef {string | number | boolean | bigint | SafeHTML | null | undefined} DomValue
 * @typedef {DomValue | Iterable<DomValue>} DomArg
 */

/**
 * Tagged template for safe HTML. Interpolated values are HTML-escaped; nested SafeHTML values (and arrays of them) pass through unescaped.
 * @param {TemplateStringsArray} strings
 * @param {...DomArg} values
 * @returns {SafeHTML}
 */
export function dom(strings, ...values) {
  /**
   * @param {DomArg} v
   * @returns {string}
   */
  function stringify(v) {
    if (v == null) return '';
    if (v instanceof SafeHTML) return v.html;
    if (typeof v === 'object' && Symbol.iterator in v) {
      return Array.from(/** @type {Iterable<any>} */ (v), stringify).join('');
    }
    return escapeHTML(v);
  }

  let html = '';
  for (let i = 0; i < strings.length; i++) {
    html += strings[i];
    if (i < values.length) {
      html += stringify(values[i]);
    }
  }
  return new SafeHTML(html, BRAND);
}

// `new Sanitizer({})` uses the permissive Baseline block-list: strips XSS vectors (script, event handlers, javascript: URLs) but preserves normal
// presentation attributes (class, id, aria-*, data-*, title, href, etc.). https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#built-in-safe-baseline-configuration
// Feature-detected via globalThis: referencing a bare `Sanitizer` at module scope would throw a ReferenceError in Safari and take the whole page down.
const defaultRenderSanitizer = typeof globalThis.Sanitizer === 'function' ? new globalThis.Sanitizer({}) : undefined;

/**
 * Render a SafeHTML fragment into an element.
 *
 * Where the Sanitizer API exists (Chrome 146+, Firefox 148+), this is exactly safedom's render(): Element.setHTML() with
 * the Baseline sanitizer as a second defense layer on top of dom``'s escaping. Elsewhere (Safari), it uses
 * renderWithoutSanitizerAPI().
 *
 * Note: <iframe>, <embed>, <object>, <script>, and <base> are marked "Sanitization: Unsafe" in the HTML spec, so
 * setHTML() removes them under ANY config. Callers that need an iframe must create it with DOM APIs after rendering.
 * The fallback removes the same elements so both paths produce the same DOM.
 * @param {Element} el
 * @param {SafeHTML} safeHtml
 */
export function render(el, safeHtml) {
  if (!(safeHtml instanceof SafeHTML)) {
    throw new Error('render() only accepts results from the dom`` tag');
  }
  if (typeof el.setHTML === 'function' && defaultRenderSanitizer) {
    el.setHTML(safeHtml.html, {sanitizer: defaultRenderSanitizer});
    return;
  }
  renderWithoutSanitizerAPI(el, safeHtml);
}

/**
 * Fallback for browsers without Element.setHTML() / Sanitizer (currently Safari).
 *
 * READ THIS BEFORE CHANGING IT.
 *
 * safedom's SKILL.md says never fall back to setHTMLUnsafe()/innerHTML, because doing so silently drops the browser's
 * sanitizer. That's still true. This fallback exists only because this page must render in Safari, and it's acceptable
 * here for these reasons, all of which must stay true:
 *   1. The primary defense is dom``'s escaping, which is identical on both paths. Every interpolated value is escaped,
 *      so the only markup in the string is markup we wrote in template literals.
 *   2. All interpolated data comes from demos.gen.json, which is generated from frontmatter in this repo. There's no
 *      user- or third-party-supplied input on this page.
 *   3. The markup is parsed into a <template>, whose content is inert: parsing it doesn't execute scripts, fetch
 *      resources, or fire event handlers. Nothing runs until we've scrubbed it and moved it into the document.
 *
 * The scrub below approximates the spec's "remove unsafe" step (built-in safe baseline + event handlers + javascript:
 * URLs). It is NOT a sanitizer and must not be treated as one. It's a backstop for mistakes in our own templates (e.g.
 * an unquoted attribute that lets an escaped value break out), and it keeps the output identical to the setHTML() path
 * so Safari doesn't render elements Chromium/Firefox would drop. If this page ever renders untrusted input, delete
 * this fallback and require the Sanitizer API instead (or use a real sanitizer).
 * @param {Element} el
 * @param {SafeHTML} safeHtml
 */
function renderWithoutSanitizerAPI(el, safeHtml) {
  const template = document.createElement('template');
  template.innerHTML = safeHtml.html;
  scrubLikeSafeBaseline(template.content);
  el.replaceChildren(template.content);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// The built-in safe baseline's removeElements: HTML elements marked "Sanitization: Unsafe" (script, iframe, embed, object, base),
// plus the obsolete frame element, plus SVG script and SVG use.
// https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#built-in-safe-baseline-configuration
const UNSAFE_ELEMENTS_SELECTOR = 'script, iframe, embed, object, base, frame';
const UNSAFE_SVG_ELEMENTS = new Set(['script', 'use']);

// Superset of the spec's "navigating URL attributes" (a/area href, form action, button/input formaction, SVG a href/xlink:href).
// Checking these names on every element is stricter than the spec, which is fine for a backstop.
const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'action', 'formaction']);

// SVG animation elements can retarget an href to a javascript: URL at runtime; the spec's "animating URL attributes" rule drops them.
const SVG_ANIMATION_ELEMENTS = new Set(['animate', 'animateMotion', 'animateTransform', 'set']);

/**
 * Mutates `root` in place to approximate setHTML()'s "remove unsafe" behavior. See renderWithoutSanitizerAPI() for why
 * this exists and why it's only a backstop.
 *
 * Checked against Chromium 145's setHTML() with `new Sanitizer({})`: same output for event handlers, javascript: URLs,
 * iframe/object/embed, and SVG script/use. Two intentional differences, both on the strict side: Chromium 145 still
 * keeps <base> (the current spec marks it Unsafe), and for SVG <set>/<animate> targeting href it strips the
 * attributeName attribute where we drop the whole element.
 * @param {DocumentFragment} root
 */
function scrubLikeSafeBaseline(root) {
  // querySelectorAll matches by local name in any namespace, so this also catches SVG <script>.
  for (const node of root.querySelectorAll(UNSAFE_ELEMENTS_SELECTOR)) node.remove();

  for (const node of root.querySelectorAll('*')) {
    if (node.namespaceURI === SVG_NS) {
      if (UNSAFE_SVG_ELEMENTS.has(node.localName)) {
        node.remove();
        continue;
      }
      const attributeName = node.getAttribute('attributeName');
      if (SVG_ANIMATION_ELEMENTS.has(node.localName) && (attributeName === 'href' || attributeName === 'xlink:href')) {
        node.remove();
        continue;
      }
    }

    // Snapshot first: node.attributes is a live NamedNodeMap, and removing while iterating it skips the next attribute.
    for (const attr of Array.from(node.attributes)) {
      // Event handler content attributes (onclick, onerror, ...). The spec removes all of them in safe mode.
      if (attr.name.startsWith('on')) {
        node.removeAttributeNode(attr);
        continue;
      }
      if (URL_ATTRIBUTES.has(attr.name) && isJavaScriptURL(attr.value)) {
        node.removeAttributeNode(attr);
      }
    }
  }
}

/**
 * Mirrors the spec's "contains a javascript: URL" check: run the URL parser and look at the scheme. Using the parser
 * (rather than a string prefix check) handles leading whitespace, control characters, and mixed case the same way the
 * browser does when it navigates.
 * @param {string} value
 */
function isJavaScriptURL(value) {
  try {
    return new URL(value, document.baseURI).protocol === 'javascript:';
  } catch {
    // Unparseable URLs can't navigate anywhere, so they can't be javascript: URLs. (Spec: "If url is failure, then return false.")
    return false;
  }
}

/**
 * Escapes HTML special characters.
 * @param {unknown} str
 * @returns {string}
 */
export function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
