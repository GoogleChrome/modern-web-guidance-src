/**
 * EXPECTATIONS STATUS:
 * - Expectation 1: SKIPPED - The application does not collect age, date of birth, or granular demographic inputs.
 * - Expectation 2: SKIPPED - The base application already satisfies this expectation: no primary user flow is gated behind an account. Articles, search, multimedia, reports, and the reading list (anonymous server session initialised for every visitor in src/middleware.ts) all work without signing in; nothing redirects to sign-in and SignInForm does not even persist the returned token. The "Continue as guest" link pattern exists only because the solution patches added it.
 * - Expectation 3: TESTED - Validates that sensitive credential inputs provide inline explanations linked via aria-describedby or a nearby disclosure.
 * - Expectation 4: SKIPPED - The application does not request powerful browser permissions like camera, microphone, or geolocation.
 * - Expectation 5: SKIPPED - The application does not have a logout endpoint or flow.
 * - Expectation 6: SKIPPED - The application does not store persistent user profile data.
 * - Expectation 7: SKIPPED - The base application does not output emails, phone numbers, or tokens to logs or analytics payloads.
 * - Expectation 8: SKIPPED - The base application already satisfies this expectation and does not store credentials in client storage.
 * - Expectation 9: SKIPPED - The base application already satisfies this expectation: its only first-party session cookie is Astro's `astro-session`, which Astro sets with `httpOnly: true`, `sameSite: 'lax'`, and `secure: true` in production builds by default (astro/dist/core/session/runtime.js). The base app never overrides these defaults and sets no other session cookies, so there is no cookie configuration for an implementation to change.
 * - Expectation 10: SKIPPED - The application does not set cookies intended for cross-site third-party embed contexts.
 * - Expectation 11: SKIPPED - The application does not contain third-party embeds or iframes.
 * - Expectation 12: SKIPPED - The application does not contain third-party embeds.
 * - Expectation 13: TESTED - Validates that third-party tracking SDKs are removed in favor of static first-party markup.
 * - Expectation 14: SKIPPED - The application does not implement federated third-party sign-in.
 * - Expectation 15: TESTED - Validates that a restrictive Permissions-Policy HTTP response header is configured by default.
 * - Expectation 16: TESTED - Validates that a privacy-preserving Referrer-Policy HTTP response header is configured.
 * - Expectation 17: SKIPPED - The application does not perform user agent sniffing.
 * - Expectation 18: SKIPPED - The base application already satisfies this expectation and does not perform browser fingerprinting.
 */

import * as fs from 'node:fs';
import {
  SyntaxKind,
  type JsxElement,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type Node,
  type NoSubstitutionTemplateLiteral,
  type Project,
  type StringLiteral,
} from 'ts-morph';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getLoadedProject(files: string[]): Project {
  const project: Project = getJsProject(files);
  for (const file of files) {
    if (/\.mjs$/i.test(file) && !project.getSourceFile(file) && fs.existsSync(file) && !fs.statSync(file).isDirectory()) {
      project.createSourceFile(file, fs.readFileSync(file, 'utf8'), { overwrite: true });
    }
  }
  return project;
}

// ---------------------------------------------------------------------------
// Expectation 3 helpers: "nearby disclosure" form of inline explanatory text.
// expectations.md allows the explanation to be "linked via aria-describedby OR a
// nearby disclosure". The nearby-disclosure form is satisfied when the input's
// field container holds static copy (not a button/link label) that explains WHY
// the data is requested, as opposed to a format hint such as
// "Must be at least 8 characters".
// ---------------------------------------------------------------------------

/** Input types that never carry user-entered data and need no explanation. */
const NON_DATA_INPUT_TYPES = new Set([
  'checkbox', 'radio', 'submit', 'button', 'hidden', 'reset', 'file', 'range', 'color', 'image',
]);

/** Interactive controls whose labels are not explanatory copy (e.g. a "Why?" toggle). */
const INTERACTIVE_TAGS = new Set(['button', 'a', 'select', 'option', 'textarea', 'input']);

/** Copy that reads as a purpose/transparency explanation rather than a format hint. */
const PURPOSE_TEXT_RE = new RegExp(
  String.raw`\b(?:` +
    [
      String.raw`why (?:do |does |would )?(?:we|you)\b`,
      String.raw`we(?:'ll|'d|'re)? (?:use|uses|used|need|needs|ask|asks|asking|collect|collects|request|requests|require|requires|only|never|will|won't|do not|don't|send|sends|store|stores|keep|keeps|process)\b`,
      String.raw`used (?:solely |only |exclusively )?(?:to|for)\b`,
      String.raw`(?:helps?|allows?|enables?|lets?) us\b`,
      String.raw`(?:so|in order) (?:that )?we can\b`,
      String.raw`(?:needed|required|necessary) (?:to|for|so)\b`,
      String.raw`purpose`,
      String.raw`never (?:shared|sold|linked|stored|tracked)\b`,
    ].join('|') +
    ')',
  'i',
);

function jsxTagOf(el: JsxElement): string {
  return el.getOpeningElement().getTagNameNode().getText().toLowerCase();
}

/** True unless the input has a static `type` that cannot carry user data. */
function isDataInputJsx(input: JsxSelfClosingElement | JsxOpeningElement): boolean {
  const typeAttr = input.getAttributes().find(
    attr => attr.isKind(SyntaxKind.JsxAttribute) && attr.getNameNode().getText() === 'type',
  );
  if (!typeAttr || !typeAttr.isKind(SyntaxKind.JsxAttribute)) return true;
  const init = typeAttr.getInitializer();
  if (!init || !init.isKind(SyntaxKind.StringLiteral)) return true; // dynamic type: cannot rule out
  return !NON_DATA_INPUT_TYPES.has(init.getLiteralValue().toLowerCase());
}

/**
 * The element that wraps a single form field (label + input + help text).
 * For `<label>Email <input/></label>` the wrapper is the label's parent.
 * A whole `<form>` is never treated as a field container.
 */
function fieldContainerJsx(input: JsxSelfClosingElement | JsxOpeningElement): JsxElement | undefined {
  const start = input.isKind(SyntaxKind.JsxOpeningElement) ? input.getParent() : input;
  let container = start.getFirstAncestorByKind(SyntaxKind.JsxElement);
  if (container && jsxTagOf(container) === 'label') {
    container = container.getFirstAncestorByKind(SyntaxKind.JsxElement);
  }
  if (!container || jsxTagOf(container) === 'form') return undefined;
  return container;
}

/** Static text inside a container, excluding text rendered inside interactive controls. */
function staticTextJsx(container: JsxElement): string {
  const parts: string[] = [];
  for (const node of container.getDescendants()) {
    let text: string | undefined;
    if (node.isKind(SyntaxKind.JsxText)) {
      text = node.getText();
    } else if (
      (node.isKind(SyntaxKind.StringLiteral) || node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) &&
      node.getParentIfKind(SyntaxKind.JsxExpression)
    ) {
      text = node.getLiteralText();
    }
    if (!text) continue;
    const insideInteractive = node
      .getAncestors()
      .some(a => a.isKind(SyntaxKind.JsxElement) && INTERACTIVE_TAGS.has(jsxTagOf(a)));
    if (insideInteractive) continue;
    parts.push(text);
  }
  return parts.join(' ').replace(/\s+/g, ' ');
}

function hasNearbyDisclosureJsx(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    const inputs = [
      ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ].filter(el => el.getTagNameNode().getText().toLowerCase() === 'input');

    for (const input of inputs) {
      if (!isDataInputJsx(input)) continue;
      const container = fieldContainerJsx(input);
      if (container && PURPOSE_TEXT_RE.test(staticTextJsx(container))) {
        return true;
      }
    }
  }
  return false;
}

/** Static text inside an HTML container, excluding interactive controls and code. */
function staticTextHtml(container: any): string {
  const clone = container.cloneNode(true);
  clone.querySelectorAll('button, a, select, textarea, input, script, style').forEach((el: any) => el.remove());
  return String(clone.textContent || '').replace(/\s+/g, ' ');
}

function hasNearbyDisclosureHtml(document: any): boolean {
  const inputs: any[] = Array.from(document.querySelectorAll('input'));
  return inputs.some(input => {
    const type = String(input.getAttribute('type') || 'text').toLowerCase();
    if (NON_DATA_INPUT_TYPES.has(type)) return false;

    let container = input.parentElement;
    if (container && String(container.tagName).toLowerCase() === 'label') {
      container = container.parentElement;
    }
    if (!container || String(container.tagName).toLowerCase() === 'form') return false;

    return PURPOSE_TEXT_RE.test(staticTextHtml(container));
  });
}

// ---------------------------------------------------------------------------
// Expectation 15/16 helper: header name + value paired in a declaration.
// Headers are not always set with a direct `set('Name', value)` call. A common,
// valid pattern is a data table applied in a loop, e.g.
//   const HEADERS = [{ name: 'Permissions-Policy', value: 'camera=(), ...' }];
//   for (const h of HEADERS) headers.set(h.name, h.value);
// Resolve the value paired with a header-name literal across the usual shapes
// so the value check still targets that header's value, not the whole file.
// ---------------------------------------------------------------------------

type HeaderNameLiteral = StringLiteral | NoSubstitutionTemplateLiteral;

/** Text of the value paired with a header-name literal, or '' if no pairing is recognised. */
function pairedHeaderValueText(nameLiteral: HeaderNameLiteral): string {
  const parent: Node | undefined = nameLiteral.getParent();
  if (!parent) return '';

  // set('Name', value) / setHeader('Name', value) / append('Name', value)
  if (parent.isKind(SyntaxKind.CallExpression)) {
    return parent.getArguments().filter(a => a !== nameLiteral).map(a => a.getText()).join(' ');
  }
  if (parent.isKind(SyntaxKind.PropertyAssignment)) {
    // { 'Name': value }
    if (parent.getNameNode() === nameLiteral) return parent.getInitializer()?.getText() ?? '';
    // { name: 'Name', value: ... } -> sibling properties of the same object
    const obj = parent.getParentIfKind(SyntaxKind.ObjectLiteralExpression);
    return obj ? obj.getProperties().filter(p => p !== parent).map(p => p.getText()).join(' ') : '';
  }
  // ['Name', value]
  if (parent.isKind(SyntaxKind.ArrayLiteralExpression)) {
    return parent.getElements().filter(e => e !== nameLiteral).map(e => e.getText()).join(' ');
  }
  // headers['Name'] = value
  if (parent.isKind(SyntaxKind.ElementAccessExpression)) {
    const assignment = parent.getParentIfKind(SyntaxKind.BinaryExpression);
    return assignment ? assignment.getRight().getText() : '';
  }
  return '';
}

function hasHeaderDeclaration(project: Project, headerName: string, valueRe: RegExp): boolean {
  for (const sf of project.getSourceFiles()) {
    const literals: HeaderNameLiteral[] = [
      ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
      ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
    ];
    for (const literal of literals) {
      if (literal.getLiteralText().toLowerCase() !== headerName) continue;
      if (valueRe.test(pairedHeaderValueText(literal))) return true;
    }
  }
  return false;
}

test.describe('Privacy Guidelines Grader - devtools-times', () => {

  test('Expectation 3: Sensitive credential inputs provide inline explanatory text linked via aria-describedby or a nearby disclosure', () => {
    const project = getLoadedProject(targetFiles);
    let hasLinkedExplanation = false;

    for (const sf of project.getSourceFiles()) {
      const jsxInputs = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ].filter(el => el.getTagNameNode().getText().toLowerCase() === 'input');

      for (const input of jsxInputs) {
        const ariaAttr = input.getAttributes().find(attr =>
          attr.isKind(SyntaxKind.JsxAttribute) && attr.getNameNode().getText() === 'aria-describedby'
        );
        if (ariaAttr && ariaAttr.isKind(SyntaxKind.JsxAttribute)) {
          const init = ariaAttr.getInitializer();
          const describedByIds = init ? init.getText().replace(/['"`{}]/g, '').split(/\s+/) : [];
          for (const id of describedByIds) {
            if (!id) continue;
            const hasMatchingElement = sf.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr =>
              attr.getNameNode().getText() === 'id' &&
              attr.getInitializer()?.getText().replace(/['"`{}]/g, '') === id
            );
            if (hasMatchingElement) {
              hasLinkedExplanation = true;
              break;
            }
          }
        }
        if (hasLinkedExplanation) break;
      }
      if (hasLinkedExplanation) break;
    }

    const docs = getHtmlDocuments(targetFiles);
    const hasLinkedExplanationInHtml = docs.some(d => {
      const inputs: any[] = Array.from(d.document.querySelectorAll('input[aria-describedby]'));
      return inputs.some(input => {
        const describedBy = input.getAttribute('aria-describedby') || '';
        return describedBy.split(/\s+/).some((id: string) => Boolean(id && d.document.getElementById(id)));
      });
    });

    // expectations.md: "linked via aria-describedby OR a nearby disclosure".
    const hasNearbyDisclosure =
      hasNearbyDisclosureJsx(project) || docs.some(d => hasNearbyDisclosureHtml(d.document));

    const hasDescribedCredentialInputs = hasLinkedExplanation || hasLinkedExplanationInHtml || hasNearbyDisclosure;
    expect(hasDescribedCredentialInputs).toBe(true);
  });

  test('Expectation 13: Auxiliary third-party tracking SDKs are removed in favor of static first-party markup', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasTrackingScript = docs.some(d => {
      const scripts: any[] = Array.from(d.document.querySelectorAll('script[src]'));
      return scripts.some(s => /analytics-client/i.test(s.getAttribute('src') || ''));
    });

    expect(hasTrackingScript).toBe(false);
  });

  test('Expectation 15: Restrictive Permissions-Policy HTTP response header disables unused powerful features by default', () => {
    const project = getLoadedProject(targetFiles);
    let hasRestrictivePermissionsPolicy = false;

    for (const sf of project.getSourceFiles()) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        const args = call.getArguments();
        if (args.length >= 2) {
          const firstArgText = args[0].getText().replace(/['"`]/g, '').toLowerCase();
          if (firstArgText === 'permissions-policy') {
            const callText = call.getText();
            if (/=\(\)/.test(callText)) {
              hasRestrictivePermissionsPolicy = true;
              break;
            }
          }
        }
      }
      if (hasRestrictivePermissionsPolicy) break;
    }

    // Data-driven declarations, e.g. { name: 'Permissions-Policy', value: 'camera=(), ...' }
    if (!hasRestrictivePermissionsPolicy) {
      hasRestrictivePermissionsPolicy = hasHeaderDeclaration(project, 'permissions-policy', /=\(\)/);
    }

    expect(hasRestrictivePermissionsPolicy).toBe(true);
  });

  test('Expectation 16: Privacy-preserving Referrer-Policy HTTP response header is configured', () => {
    const project = getLoadedProject(targetFiles);
    let hasPrivacyReferrerPolicy = false;

    for (const sf of project.getSourceFiles()) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        const args = call.getArguments();
        if (args.length >= 2) {
          const firstArgText = args[0].getText().replace(/['"`]/g, '').toLowerCase();
          if (firstArgText === 'referrer-policy') {
            const callText = call.getText();
            if (/(strict-origin|no-referrer|same-origin)/i.test(callText)) {
              hasPrivacyReferrerPolicy = true;
              break;
            }
          }
        }
      }
      if (hasPrivacyReferrerPolicy) break;
    }

    // Data-driven declarations, e.g. { name: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    if (!hasPrivacyReferrerPolicy) {
      hasPrivacyReferrerPolicy = hasHeaderDeclaration(project, 'referrer-policy', /(strict-origin|no-referrer|same-origin)/i);
    }

    if (!hasPrivacyReferrerPolicy) {
      const docs = getHtmlDocuments(targetFiles);
      hasPrivacyReferrerPolicy = docs.some(d => {
        const meta = d.document.querySelector('meta[name="referrer" i]');
        if (meta) {
          const content = meta.getAttribute('content') || '';
          return /(strict-origin|no-referrer|same-origin)/i.test(content);
        }
        return false;
      });
    }

    expect(hasPrivacyReferrerPolicy).toBe(true);
  });

});
