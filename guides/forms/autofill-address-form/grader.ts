import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe(`Autofill Address Form Expectations: ${demoName}`, () => {

  // Setup browser testing
  test.beforeEach(async ({ page, TARGET_URL }) => {
    // Only mock local routes if it's a file-based demo, else let the dev server handle it
    if (TARGET_URL.startsWith('http://localhost/')) {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }

    await page.goto(TARGET_URL);
  });

  test('Form elements must be within a <form> element', async ({ page }) => {
    const inputs = await page.locator('input, select, textarea').all();
    // In the base app, there might be no inputs at all, or some nav search?
    // We specifically care about the address form inputs.
    // However, the requirement says ALL input/select/textarea must be in a form.
    
    // First, ensure we actually have some form-like inputs to test (to avoid vacuous pass)
    // We'll look for inputs that are likely part of an address form.
    const addressRelated = page.locator('input, textarea').filter({ hasText: /(name|address|postal|zip|city|state|country)/i });
    
    // But the expectation is broad: "<input>, <select>, and <textarea> elements MUST be within a <form> element."
    // Let's check all of them.
    const allControls = await page.locator('input, select, textarea').all();
    expect(allControls.length).toBeGreaterThan(0); // Fail if no inputs found (negative state)

    for (const control of allControls) {
        const form = await control.evaluate(el => el.closest('form'));
        expect(form, `Element <${await control.evaluate(el => el.tagName.toLowerCase())}> should be inside a <form>`).not.toBeNull();
    }
  });

  test('Every form control must be visually labeled using a <label> element', async ({ page }) => {
    const allControls = await page.locator('input, select, textarea').all();
    expect(allControls.length).toBeGreaterThan(0);

    for (const control of allControls) {
        // Check if there is a label associated with it
        const id = await control.getAttribute('id');
        if (id) {
            const label = page.locator(`label[for="${id}"]`);
            await expect(label).toBeVisible();
        } else {
            // If no ID, it might be nested, but the expectation says "for attribute whose value matches the id"
            // So it MUST have an ID.
            throw new Error(`Form control <${await control.evaluate(el => el.tagName.toLowerCase())}> is missing an 'id' attribute for label association.`);
        }
    }
  });

  test('Every <label> must have a "for" attribute matching its associated form control ID', async ({ page }) => {
    const labels = await page.locator('label').all();
    expect(labels.length).toBeGreaterThan(0);

    for (const label of labels) {
        const forAttr = await label.getAttribute('for');
        expect(forAttr, 'Label must have a "for" attribute').not.toBeNull();
        const associated = page.locator(`#${forAttr}`);
        await expect(associated).toBeVisible();
    }
  });

  test('A single <textarea> must be used for the street address with autocomplete="street-address"', async ({ page }) => {
    // Locate the street address field. It's likely labeled "Address" or "Street Address", but not "Email Address".
    const addressField = page.getByLabel(/^(?!.*email).*(street\s+)?address/i).first();
    await expect(addressField).toBeVisible();
    
    const tagName = await addressField.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('textarea');
    
    const autocomplete = await addressField.getAttribute('autocomplete');
    expect(autocomplete).toBe('street-address');
  });

  test('The postal code input must have autocomplete="postal-code"', async ({ page }) => {
    const postalField = page.getByLabel(/postal|zip/i).first();
    await expect(postalField).toBeVisible();
    
    const autocomplete = await postalField.getAttribute('autocomplete');
    expect(autocomplete).toBe('postal-code');
  });

  test('The type="number" attribute MUST NOT be used on the postal code input', async ({ page }) => {
    const postalField = page.getByLabel(/postal|zip/i).first();
    await expect(postalField).toBeVisible();
    
    const type = await postalField.getAttribute('type');
    expect(type).not.toBe('number');
  });

  test('Patterns MUST NOT restrict input to characters a-zA-Z only', async ({ page }) => {
    const inputsWithPattern = await page.locator('input[pattern]').all();
    // Note: If no patterns exist, this might pass vacuously. 
    // But the expectation says "Patterns MUST NOT restrict...". 
    // This implies IF there is a pattern, it shouldn't be restrictive.
    // However, the negative state check should ensure we have the form.
    const addressForm = page.locator('form');
    await expect(addressForm).toBeVisible();

    for (const input of inputsWithPattern) {
        const pattern = await input.getAttribute('pattern');
        if (pattern) {
            // Check if pattern is basically [a-zA-Z]+ or similar
            expect(pattern).not.toMatch(/^\[a-zA-Z\][+*]?$/);
            expect(pattern).not.toMatch(/^[a-zA-Z]+$/);
            // More generally, it shouldn't be JUST latin letters.
            // If it's a complex pattern, we assume it's okay unless it's obviously [a-zA-Z]
        }
    }
  });

  test('Mandatory fields (name, address, postal code) must have the required attribute', async ({ page }) => {
    const nameField = page.getByLabel(/name/i).first();
    const addressField = page.getByLabel(/^(?!.*email).*(street\s+)?address/i).first();
    const postalField = page.getByLabel(/postal|zip/i).first();

    await expect(nameField).toHaveAttribute('required', '');
    await expect(addressField).toHaveAttribute('required', '');
    await expect(postalField).toHaveAttribute('required', '');
  });

});
