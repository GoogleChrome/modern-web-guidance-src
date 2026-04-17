import { test, expect } from '../../test-fixture.ts';
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
const htmlStr = fs.readFileSync(filePath, 'utf8');

// Use linkedom static analysis instead of headless browser
const { document } = parseHTML(htmlStr);

test.describe(`autofill-sign-in-form Expectations: ${demoName}`, () => {

  test('All inputs must be within a <form> element', () => {
    const inputCount = document.querySelectorAll('input').length;
    const inputsInFormCount = document.querySelectorAll('form input').length;
    expect(inputCount).toBeGreaterThan(0);
    expect(inputCount).toBe(inputsInFormCount);
  });

  test('The form must have a submit button', () => {
    const submitButton = document.querySelector('form button:not([type]), form button[type="submit"], form input[type="submit"]');
    expect(submitButton).not.toBeNull();
  });

  test('Every input in the form must have an associated label', () => {
    const inputs = Array.from(document.querySelectorAll('form input'));
    expect(inputs.length).toBeGreaterThan(0);
    
    for (const input of inputs) {
      const id = input.id;
      expect(id).not.toBeFalsy(); // Must have an id to link to a label
      const label = document.querySelector(`label[for="${id}"]`);
      expect(label).not.toBeNull();
      expect((label as HTMLElement).textContent?.trim()).not.toBe('');
    }
  });

  test('Labels must have a "for" attribute matching an input "id"', () => {
    const labels = Array.from(document.querySelectorAll('label'));
    expect(labels.length).toBeGreaterThan(0);
    
    for (const label of labels) {
      const forAttr = label.getAttribute('for');
      expect(forAttr).not.toBeFalsy();
      const input = document.getElementById(forAttr!);
      expect(input).not.toBeNull();
      expect(input?.tagName).toBe('INPUT');
    }
  });

  test('No element must use autocomplete="off"', () => {
    const badElements = document.querySelectorAll('[autocomplete="off"]');
    expect(badElements.length).toBe(0);
  });

  test('Email input must have type="email"', () => {
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput).not.toBeNull();
  });

  test('Email input must have autocomplete="username"', () => {
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput?.getAttribute('autocomplete')).toBe('username');
  });

  test('Password input must have type="password"', () => {
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).not.toBeNull();
  });

  test('Password input must have autocomplete="current-password"', () => {
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput?.getAttribute('autocomplete')).toBe('current-password');
  });

  test('Password input must have id="current-password"', () => {
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput?.id).toBe('current-password');
  });

  test('Email input must be required', () => {
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput?.hasAttribute('required')).toBe(true);
  });

  test('Password input must be required', () => {
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput?.hasAttribute('required')).toBe(true);
  });

  test('There must be exactly one email input', () => {
    const emailInputs = document.querySelectorAll('input[type="email"]');
    expect(emailInputs.length).toBe(1);
  });

  test('There must be exactly one password input', () => {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBe(1);
  });

});
