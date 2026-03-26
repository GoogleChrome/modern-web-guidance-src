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

test.describe(`autofill-address-form Expectations: ${demoName}`, () => {

  test('All form controls must be within a <form> element', () => {
    const controls = Array.from(document.querySelectorAll('input, select, textarea'));
    if (controls.length === 0) {
      expect(true).toBe(false); // Should have controls
      return;
    }
    const allInsideForm = controls.every(el => !!el.closest('form'));
    expect(allInsideForm).toBe(true);
  });

  test('Every form control must have an associated <label>', () => {
    const controls = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]), select, textarea'));
    if (controls.length === 0) {
      expect(true).toBe(false);
      return;
    }
    const allHaveLabels = controls.every(control => {
      const id = (control as Element).id;
      return id && !!document.querySelector(`label[for="${id}"]`);
    });
    expect(allHaveLabels).toBe(true);
  });

  test('Every <label> must have a "for" attribute matching a control "id"', () => {
    const labels = Array.from(document.querySelectorAll('label'));
    if (labels.length === 0) {
      expect(true).toBe(false);
      return;
    }
    const labelsValid = labels.every(label => {
      const forAttr = label.getAttribute('for');
      const target = forAttr ? document.getElementById(forAttr) : null;
      return target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
    });
    expect(labelsValid).toBe(true);
  });

  test('A single <textarea> must be used for the street address', () => {
    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBe(1);
  });

  test('The street address textarea must have autocomplete="street-address"', () => {
    const textarea = document.querySelector('textarea');
    expect(textarea?.getAttribute('autocomplete')).toBe('street-address');
  });

  test('The postal code input must have autocomplete="postal-code"', () => {
    const input = document.querySelector('input[autocomplete="postal-code"]');
    expect(input).not.toBeNull();
  });

  test('The postal code input must not use type="number"', () => {
    const input = document.querySelector('input[autocomplete="postal-code"]');
    expect(input?.getAttribute('type')).not.toBe('number');
  });

  test('Name and address inputs must not restrict to Latin-only characters', () => {
    const controls = Array.from(document.querySelectorAll('input[pattern], textarea[pattern]'));
    const patterns = controls.map(el => el.getAttribute('pattern')).filter(Boolean) as string[];
    
    for (const pattern of patterns) {
      expect(new RegExp(`^(?:${pattern})$`, 'u').test('Renée Müller')).toBe(true);
    }
  });

  test('Required form fields must have the "required" attribute', () => {
    const nameInput = document.querySelector('input[autocomplete="name"]');
    const addressTextarea = document.querySelector('textarea[autocomplete="street-address"]');
    
    expect(nameInput?.hasAttribute('required')).toBe(true);
    expect(addressTextarea?.hasAttribute('required')).toBe(true);
  });

});
