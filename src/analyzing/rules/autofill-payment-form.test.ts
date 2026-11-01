import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher } from '../schema.ts';
import { autofillPaymentFormRule } from './autofill-payment-form.ts';

const matcher = autofillPaymentFormRule.matcher as DomRuleMatcher;

void test('autofill-payment-form: positive brownfield matches', async (suiteContext) => {
  await suiteContext.test('flags input[name="card_number"] lacking autocomplete inside form', () => {
    const html = `
      <form action="/checkout" method="post">
        <label for="card">Credit Card Number</label>
        <input type="text" id="card" name="card_number" required>
        <button type="submit">Pay Now</button>
      </form>
    `;
    const matches = scanHtml('checkout.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /cc-number/);
  });

  await suiteContext.test('flags input[id="cc-num"] with autocomplete="off"', () => {
    const html = `
      <form action="/order" method="post">
        <label for="cc-num">Card Number</label>
        <input type="text" id="cc-num" name="cardNumber" autocomplete="off">
      </form>
    `;
    const matches = scanHtml('order.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /cc-number/);
  });

  await suiteContext.test('flags input[name="exp_date"] lacking autocomplete inside form', () => {
    const html = `
      <form action="/pay" method="post">
        <label for="exp">Expiry Date</label>
        <input type="text" id="exp" name="exp_date" placeholder="MM/YY">
      </form>
    `;
    const matches = scanHtml('pay.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /cc-exp/);
  });

  await suiteContext.test('flags input[name="exp_month"] suggesting cc-exp-month', () => {
    const html = `
      <form action="/billing" method="post">
        <input type="text" id="exp-month" name="exp_month" placeholder="MM">
      </form>
    `;
    const matches = scanHtml('billing.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /cc-exp-month/);
  });

  await suiteContext.test('flags input[name="cvv"] type="password" anti-pattern inside form', () => {
    const html = `
      <form action="/pay" method="post">
        <label for="cvv">Security Code</label>
        <input type="password" id="cvv" name="cvv" maxlength="4">
      </form>
    `;
    const matches = scanHtml('pay.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /type="password"/);
    assert.match(matches[0]?.message ?? '', /cc-csc/);
  });

  await suiteContext.test('flags input[name="card_number"] type="number" anti-pattern inside form', () => {
    const html = `
      <form action="/pay" method="post">
        <input type="number" id="card_num" name="card_number">
      </form>
    `;
    const matches = scanHtml('pay.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /type="number"/);
    assert.match(matches[0]?.message ?? '', /cc-number/);
  });

  await suiteContext.test('flags input with explicit form attribute matching payment identifiers', () => {
    const html = `
      <div>
        <input type="text" id="card_input" name="card_number" form="payment-form">
      </div>
      <form id="payment-form" action="/pay"></form>
    `;
    const matches = scanHtml('detached.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /cc-number/);
  });

  await suiteContext.test('flags input with dashboard-card-number identifier inside form', () => {
    const html = `
      <form action="/billing" method="post">
        <label for="dashboard-card-number">Card Number</label>
        <input type="text" id="dashboard-card-number" name="dashboard_card_number" required>
      </form>
    `;
    const matches = scanHtml('dashboard-billing.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /cc-number/);
  });

  await suiteContext.test('flags card number on user profile billing form', () => {
    const html = `
      <form action="/profile/billing" method="post">
        <input type="text" id="profile_card_number" name="profile_card_number" placeholder="Card number">
      </form>
    `;
    const matches = scanHtml('profile.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /cc-number/);
  });

  await suiteContext.test('flags JSX cardholder name input in CheckoutForm component', () => {
    const code = `
      export function CheckoutForm() {
        return (
          <form onSubmit={handlePay}>
            <input type="text" name="cardholder_name" id="cardholder_name" />
          </form>
        );
      }
    `;
    const matches = withVirtualSourceFile('CheckoutForm.tsx', code, (sourceFile) =>
            scanJsx('CheckoutForm.tsx', sourceFile, [matcher]),
          );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /cc-name/);
  });
});

void test('autofill-payment-form: negative / exempt cases', async (suiteContext) => {
  await suiteContext.test('exempts input with valid autocomplete="cc-number"', () => {
    const html = `
      <form action="/checkout" method="post">
        <input type="text" name="card_number" autocomplete="cc-number">
      </form>
    `;
    const matches = scanHtml('checkout.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts input with valid autocomplete="cc-exp"', () => {
    const html = `
      <form action="/checkout" method="post">
        <input type="text" name="exp_date" autocomplete="cc-exp">
      </form>
    `;
    const matches = scanHtml('checkout.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts input with valid autocomplete="cc-csc"', () => {
    const html = `
      <form action="/checkout" method="post">
        <input type="text" name="cvv" autocomplete="cc-csc">
      </form>
    `;
    const matches = scanHtml('checkout.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts inputs outside of forms without form attribute', () => {
    const html = `
      <div>
        <input type="text" name="card_number" id="card_number">
      </div>
    `;
    const matches = scanHtml('detached.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts non-text input types', () => {
    const html = `
      <form action="/search">
        <input type="checkbox" name="credit_card_save">
        <input type="radio" name="card_type">
        <input type="button" name="verify_card" value="Verify">
        <input type="search" name="search_card_transactions">
      </form>
    `;
    const matches = scanHtml('form.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts disabled, readonly, or hidden inputs', () => {
    const html = `
      <form action="/checkout">
        <input type="text" name="card_number" disabled>
        <input type="text" name="card_number" readonly>
        <input type="hidden" name="card_token">
      </form>
    `;
    const matches = scanHtml('readonly.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts dynamic framework autocomplete attribute', () => {
    const html = `
      <form action="/checkout">
        <input type="text" name="card_number" :autocomplete="cardAutocomplete">
      </form>
    `;
    const matches = scanHtml('vue.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts JSX input with spread attributes', () => {
    const code = `
      export function CustomCardInput(props: any) {
        return (
          <form>
            <input name="card_number" {...props} />
          </form>
        );
      }
    `;
    const matches = withVirtualSourceFile('CustomCardInput.tsx', code, (sourceFile) =>
            scanJsx('CustomCardInput.tsx', sourceFile, [matcher]),
          );
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts non-card numbers such as bank routing and account numbers', () => {
    const html = `
      <form>
        <input name="bank_account_number" type="text" />
        <input name="routing_number" type="text" />
      </form>
    `;
    const matches = scanHtml('checkout.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts search and filter inputs on cards', () => {
    const html = `
      <form action="/dashboard">
        <input name="card_filter" placeholder="Filter cards by keyword" type="text" />
        <input name="search_query" placeholder="Search cards" type="text" />
      </form>
    `;
    const matches = scanHtml('dashboard.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts non-payment expiration fields like session and coupon expiry', () => {
    const html = `
      <form action="/settings">
        <input name="session_expiration" type="text" />
        <input name="coupon_expiry" type="text" />
      </form>
    `;
    const matches = scanHtml('settings.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts kanban or flashcard name inputs without payment context', () => {
    const html = `
      <form action="/board/columns/1">
        <input name="card_name" placeholder="Enter task card title" type="text" />
      </form>
    `;
    const matches = scanHtml('board.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts test and fixture files', () => {
    const html = `
      <form action="/checkout">
        <input type="text" name="card_number">
      </form>
    `;
    const matches = scanHtml('tests/fixtures/payment.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });
});
