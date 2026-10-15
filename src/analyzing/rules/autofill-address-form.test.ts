import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher } from '../schema.ts';
import { autofillAddressFormRule } from './autofill-address-form.ts';

const matcher = autofillAddressFormRule.matcher as DomRuleMatcher;

void test('autofill-address-form: positive brownfield matches', async (t) => {
  await t.test('flags input[name="street_address"] lacking autocomplete inside form', () => {
    const html = `
      <form action="/checkout" method="post">
        <label for="street">Street Address</label>
        <input type="text" id="street" name="street_address" required>
        <button type="submit">Continue</button>
      </form>
    `;
    const matches = scanHtml('checkout.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /street-address/);
  });

  await t.test('flags textarea[id="address_line_1"] inside form', () => {
    const html = `
      <form action="/shipping" method="post">
        <label for="address_line_1">Address</label>
        <textarea id="address_line_1" name="address1"></textarea>
      </form>
    `;
    const matches = scanHtml('shipping.html', html, [matcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('flags postal_code input with autocomplete="off"', () => {
    const html = `
      <form action="/billing" method="post">
        <input type="text" name="postal_code" id="postal_code" autocomplete="off">
      </form>
    `;
    const matches = scanHtml('billing.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /postal-code/);
  });

  await t.test('flags zipcode input inside JSX form', () => {
    const project = createInMemoryProject();
    const code = `
      export function AddressForm() {
        return (
          <form onSubmit={handleSubmit}>
            <input type="text" name="zipcode" id="zipcode" />
          </form>
        );
      }
    `;
    const sourceFile = project.createSourceFile('AddressForm.tsx', code);
    const matches = scanJsx('AddressForm.tsx', sourceFile, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /postal-code/);
  });
});

void test('autofill-address-form: negative / exempt cases', async (t) => {
  await t.test('exempts input with valid autocomplete="street-address"', () => {
    const html = `
      <form action="/checkout" method="post">
        <input type="text" name="street_address" autocomplete="street-address">
      </form>
    `;
    const matches = scanHtml('checkout.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts search inputs (type="search" or name includes "search")', () => {
    const html = `
      <form action="/search" method="get">
        <input type="search" name="street_address_search">
        <input type="text" name="search_zipcode">
      </form>
    `;
    const matches = scanHtml('search.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts inputs outside of forms without form attribute', () => {
    const html = `
      <div>
        <input type="text" name="street_address" id="street_address">
      </div>
    `;
    const matches = scanHtml('non-form.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts disabled or readonly address fields', () => {
    const html = `
      <form>
        <input type="text" name="postal_code" disabled>
        <input type="text" name="street_address" readonly>
      </form>
    `;
    const matches = scanHtml('profile.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts XML or non-HTML/JSX test fixtures (e.g. spec.js)', () => {
    const html = `
      <form>
        <input type="text" name="street_address">
      </form>
    `;
    const matches = scanHtml('xfa_parser_spec.js', html, [matcher]);
    assert.equal(matches.length, 0);
  });
});
