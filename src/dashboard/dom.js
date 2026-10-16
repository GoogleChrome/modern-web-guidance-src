// @ts-check

/**
 * Escaping-only subset of safedom (~/code/safedom). The dom`` tag is the safety layer: every interpolation is
 * HTML-escaped unless it's already a SafeHTML.
 *
 * render() uses innerHTML, not setHTML(). Two reasons: Safari has no Sanitizer API, and setHTML() always runs the
 * safe baseline removal, which drops <iframe> (spec-marked "Sanitization: Unsafe") no matter what Sanitizer config is
 * passed. That kills the demo gallery.
 * https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#built-in-safe-baseline-configuration
 *
 * Caveats (no attribute-context awareness): always quote attribute values, and never interpolate untrusted values
 * into href/src (escaping doesn't stop `javascript:` URLs).
 */

/**
 * @typedef {string | number | boolean | SafeHTML | null | undefined} DomValue
 * @typedef {DomValue | Iterable<DomValue>} DomArg
 */

const BRAND = Symbol('SafeHTML');

export class SafeHTML {
  #html;
  /**
   * @param {string} html
   * @param {symbol} brand
   */
  constructor(html, brand) {
    if (brand !== BRAND) throw new TypeError('SafeHTML cannot be constructed directly. Use the dom`` tag.');
    this.#html = html;
  }
  get html() { return this.#html; }
}

/**
 * @param {DomArg} v
 * @returns {string}
 */
function stringify(v) {
  if (v == null || v === false) return '';
  if (v instanceof SafeHTML) return v.html;
  if (typeof v === 'object' && Symbol.iterator in v) return Array.from(v, stringify).join('');
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * @param {TemplateStringsArray} strings
 * @param {...DomArg} values
 * @returns {SafeHTML}
 */
export function dom(strings, ...values) {
  return new SafeHTML(strings.reduce((html, s, i) => html + s + (i < values.length ? stringify(values[i]) : ''), ''), BRAND);
}

/**
 * @param {Element} el
 * @param {SafeHTML} safeHtml
 */
export function render(el, safeHtml) {
  if (!(safeHtml instanceof SafeHTML)) throw new TypeError('render() only accepts results from the dom`` tag');
  el.innerHTML = safeHtml.html;
}
