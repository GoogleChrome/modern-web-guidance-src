import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { scanFiles } from '../scanners/index.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
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
    assert.match(matches[0]?.message ?? '', /address-line1/);
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
    const code = `
      export function AddressForm() {
        return (
          <form onSubmit={handleSubmit}>
            <input type="text" name="zipcode" id="zipcode" />
          </form>
        );
      }
    `;
    const matches = withVirtualSourceFile('AddressForm.tsx', code, (sourceFile) =>
            scanJsx('AddressForm.tsx', sourceFile, [matcher]),
          );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /postal-code/);
  });

  await t.test('flags zipcode input inside JSX in a .js component', () => {
    const code = `
      export function AddressForm() {
        return (
          <form onSubmit={handleSubmit}>
            <input type="text" name="zipcode" id="zipcode" />
          </form>
        );
      }
    `;
    const matches = withVirtualSourceFile('AddressForm.js', code, (sourceFile) =>
      scanJsx('AddressForm.js', sourceFile, [matcher]),
    );
    assert.equal(matches.length, 1);
  });

  await t.test('flags same-line <form><input ...></form> markup', () => {
    const html = `<form action="/quick"><input type="text" name="address1"></form>`;
    const matches = scanHtml('quick.html', html, [matcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('flags address input in .vue, .svelte, and .astro SFC files', () => {
    const vue = `
<template>
  <form>
    <input type="text" name="street-address" required />
  </form>
</template>
    `;
    const svelte = `
<form>
  <input type="text" name="postal_code" />
</form>
    `;
    const astro = `
---
const title = "Checkout";
---
<form>
  <input type="text" name="address_line_1" />
</form>
    `;

    const vueFindings = scanFiles(new Map([['src/Address.vue', vue]]), [autofillAddressFormRule]);
    assert.equal(vueFindings.length, 1);
    assert.match(vueFindings[0]?.message ?? '', /street-address/);

    const svelteFindings = scanFiles(new Map([['src/Address.svelte', svelte]]), [autofillAddressFormRule]);
    assert.equal(svelteFindings.length, 1);
    assert.match(svelteFindings[0]?.message ?? '', /postal-code/);

    const astroFindings = scanFiles(new Map([['src/Address.astro', astro]]), [autofillAddressFormRule]);
    assert.equal(astroFindings.length, 1);
    assert.match(astroFindings[0]?.message ?? '', /street-address/);
  });

  await t.test('flags address input inside nested Vue template v-if and v-for tags within form', () => {
    const vue = `
<template>
  <div class="checkout-page">
    <form action="/order" method="post">
      <template v-if="needsShipping">
        <div class="field">
          <input type="text" name="street_address" id="shipping_street" required>
        </div>
      </template>
    </form>
  </div>
</template>
    `;
    const findings = scanFiles(new Map([['src/NestedAddress.vue', vue]]), [autofillAddressFormRule]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.line, 7);
    assert.match(findings[0]?.message ?? '', /street-address/);
  });

  await t.test('flags address inputs in .gts templates, except ones that spread ...attributes', () => {
    const gts = [
      'export default class Address extends Component {',
      '  <template>',
      '    <form>',
      '      <input type="text" name="postal_code" />',
      '      <input type="text" name="street_address" ...attributes />',
      '    </form>',
      '  </template>',
      '}',
    ].join('\n');
    const findings = scanFiles(new Map([['app/components/address.gts', gts]]), [autofillAddressFormRule]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.line, 4);
    assert.match(findings[0]?.message ?? '', /postal-code/);
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

  await t.test('exempts non-postal address qualifiers (email_address1, ip_address, wallet_address)', () => {
    const html = `
      <form>
        <input type="email" name="email_address1">
        <input type="text" name="ip_address1">
        <input type="text" name="wallet_address1">
      </form>
    `;
    const matches = scanHtml('accounts.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts test directory fixtures', () => {
    const html = `
      <form>
        <input type="text" name="street_address">
      </form>
    `;
    const matches = scanHtml('src/components/test/data/autofill/form.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });
});
