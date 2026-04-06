import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const demoName = path.basename(filePath);
const htmlStr = fs.readFileSync(filePath, 'utf-8');

// Initialize a static parser
const { document } = parseHTML(htmlStr);

test.describe(`Autofill Payment Form Expectations: ${demoName}`, () => {

  test('All input, select, and textarea elements must be within a <form> element', () => {
    const nonFormInputs = document.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea)').length;
    expect(nonFormInputs).toBe(0);
  });

  test('Every input, select, or textarea element in a form must have an associated <label>', () => {
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
    if (inputs.length === 0) {
      expect(true).toBe(false);
      return;
    }
    const result = inputs.every(input => {
      const id = input.getAttribute('id');
      return id && document.querySelector(`label[for="${id}"]`);
    });
    expect(result).toBe(true);
  });

  test('Every label element must have a "for" attribute matching an input "id"', () => {
    const labels = Array.from(document.querySelectorAll('label'));
    if (labels.length === 0) {
      expect(true).toBe(false);
      return;
    }
    const result = labels.every(label => {
      const forAttr = label.getAttribute('for');
      return forAttr && document.getElementById(forAttr);
    });
    expect(result).toBe(true);
  });

  test('A single input element must be used for the payment card number', () => {
    const inputs = document.querySelectorAll('input[autocomplete="cc-number"]');
    expect(inputs.length).toBe(1);
  });

  test('The cardholder name input must allow Unicode characters', () => {
    const input = document.querySelector('input[autocomplete="cc-name"]');
    const pattern = input?.getAttribute('pattern');
    // If no pattern is provided, it doesn't enforce Latin-only, so it passes.
    // If a pattern is provided, it must allow a Unicode letter like 'é'.
    const isValid = pattern ? new RegExp(pattern, 'u').test('Jérôme') : true;
    expect(isValid).toBe(true);
  });

  test('The card security code input must not use type="password"', () => {
    const input = document.querySelector('input[autocomplete="cc-csc"]');
    expect(input?.getAttribute('type')).not.toBe('password');
  });

  test('No payment card input field should use type="number"', () => {
    const numberInputs = document.querySelectorAll('input[type="number"]').length;
    expect(numberInputs).toBe(0);
  });

  test('The payment card inputs must have inputmode="numeric"', () => {
    const ccInput = document.querySelector('input[autocomplete="cc-number"]');
    const cscInput = document.querySelector('input[autocomplete="cc-csc"]');
    
    expect(ccInput?.getAttribute('inputmode')).toBe('numeric');
    expect(cscInput?.getAttribute('inputmode')).toBe('numeric');
  });

  test('All required payment form fields must have the "required" attribute', () => {
    const fields = ['cc-number', 'cc-name', 'cc-exp', 'cc-csc'];
    const result = fields.every(field => {
      const input = document.querySelector(`input[autocomplete="${field}"]`);
      return input && input.hasAttribute('required');
    });
    expect(result).toBe(true);
  });

});
