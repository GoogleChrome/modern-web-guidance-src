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

test.describe(`Autofill Sign-up Form Expectations: ${demoName}`, () => {

  test('Input elements MUST be within a <form> element', () => {
    const inputs = Array.from(document.querySelectorAll('input'));
    if (inputs.length === 0) {
      expect(true).toBe(false);
      return;
    }
    const allInputsInForm = inputs.every(i => !!i.closest('form'));
    expect(allInputsInForm).toBe(true);
  });

  test('The form MUST have a submit button', () => {
    const submitBtn = document.querySelector('form button:not([type]), form button[type="submit"], form input[type="submit"]');
    expect(submitBtn).not.toBeNull();
  });

  test('Every <input> in the form MUST be labeled using a <label> element', () => {
    const inputs = Array.from(document.querySelectorAll('form input:not([type="submit"]):not([type="button"]):not([type="hidden"])'));
    if (inputs.length === 0) {
      expect(true).toBe(false);
      return;
    }
    const allLabeled = inputs.every(i => {
      return !!document.querySelector(`label[for="${i.id}"]`) || !!i.closest('label');
    });
    expect(allLabeled).toBe(true);
  });

  test('Every <label> MUST have a "for" attribute matching an input "id"', () => {
    const labels = Array.from(document.querySelectorAll('label'));
    if (labels.length === 0) {
      expect(true).toBe(false);
      return;
    }
    const labelsValid = labels.every(l => {
      const forId = l.getAttribute('for');
      return forId && document.getElementById(forId)?.tagName === 'INPUT';
    });
    expect(labelsValid).toBe(true);
  });

  test('The email input MUST have type="email"', () => {
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput).not.toBeNull();
  });

  test('The email input MUST have autocomplete="username"', () => {
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput?.getAttribute('autocomplete')).toBe('username');
  });

  test('The password input MUST have type="password"', () => {
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).not.toBeNull();
  });

  test('The password input MUST have autocomplete="new-password"', () => {
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput?.getAttribute('autocomplete')).toBe('new-password');
  });

  test('The password input MUST have id="new-password"', () => {
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput?.id).toBe('new-password');
  });

  test('The email input MUST have the "required" attribute', () => {
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput?.hasAttribute('required')).toBe(true);
  });

  test('The password input MUST have the "required" attribute', () => {
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput?.hasAttribute('required')).toBe(true);
  });

  test('There MUST be exactly one email input', () => {
    const emailInputs = document.querySelectorAll('input[type="email"]');
    expect(emailInputs.length).toBe(1);
  });

  test('There MUST be exactly one password input', () => {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBe(1);
  });

  test('Name input pattern MUST NOT restrict to Latin-only characters', () => {
    const nameInput = document.querySelector('input[autocomplete="name"], input[id*="name"], input[name*="name"]');
    const pattern = nameInput?.getAttribute('pattern');
    if (!pattern) return; // If no pattern, it doesn't restrict to latin-only, test passes implicitly.
    expect(new RegExp(`^(?:${pattern})$`, 'u').test('Renée')).toBe(true);
  });

});
