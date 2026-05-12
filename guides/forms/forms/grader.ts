import { test, expect } from '@playwright/test';
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
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Forms Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('The implementation MUST use a <form> element to wrap interactive controls', async ({ page }) => {
    const hasForm = await page.locator('form').count();
    expect(hasForm).toBeGreaterThan(0);
    
    const allInsideForm = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
      return controls.length > 0 && controls.every(el => !!el.closest('form'));
    });
    expect(allInsideForm).toBe(true);
  });

  test('The <form> element MUST specify the "action" attribute', async ({ page }) => {
    const action = await page.locator('form').first().getAttribute('action');
    expect(action).toBeTruthy();
  });

  test('The <form> element MUST use method="POST" for sensitive data', async ({ page }) => {
    const method = await page.locator('form').first().getAttribute('method');
    expect(method?.toUpperCase()).toBe('POST');
  });

  test('Every form control MUST have a "name" attribute', async ({ page }) => {
    const allHaveName = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]), select, textarea'));
      return controls.length > 0 && controls.every(control => !!control.getAttribute('name'));
    });
    expect(allHaveName).toBe(true);
  });

  test('The implementation MUST use semantic tags like <button type="submit">', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]');
    await expect(submitBtn.first()).toBeAttached();
  });

  test('The implementation MUST use <fieldset> and <legend> to group related controls', async ({ page }) => {
    const fieldset = page.locator('fieldset');
    const legend = page.locator('fieldset legend, legend');
    await expect(fieldset.first()).toBeAttached();
    await expect(legend.first()).toBeAttached();
  });

  test('Submit buttons MUST use actionable language', async ({ page }) => {
    const buttonText = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"], input[type="submit"], [id*="submit" i], [class*="submit" i], button');
      if (!btn) return '';
      return (btn.textContent || (btn as HTMLInputElement).value || '').trim();
    });
    expect(buttonText.length).toBeGreaterThan(0);
    // "Submit" is too generic for "actionable language" like "Save changes" or "Create Account"
    // In demo it is "Next" or "Complete Registration".
    // In negative demo it is "Submit".
    expect(buttonText.toLowerCase()).not.toBe('submit');
    expect(buttonText.toLowerCase()).not.toBe('click');
  });

  test('Mutually exclusive options (1-5) MUST use radio buttons', async ({ page }) => {
    const hasViolation = await page.evaluate(() => {
      const groups: Record<string, number> = {};
      const radios = document.querySelectorAll('input[type="radio"]');
      radios.forEach(r => {
        const name = (r as HTMLInputElement).name;
        groups[name] = (groups[name] || 0) + 1;
      });
      // Check for any group with 6+ options using radios
      return Object.values(groups).some(count => count > 5);
    });
    expect(hasViolation).toBe(false);
    
    // Also check if some small set is NOT using radios? 
    // Hard to verify without knowing intent, but we can check if a select has 2-5 options.
    const selectViolation = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      return selects.some(s => s.options.length > 1 && s.options.length <= 5);
    });
    expect(selectViolation).toBe(false);
  });

  test('Mutually exclusive options (6+) MUST NOT use radio buttons', async ({ page }) => {
    const violation = await page.evaluate(() => {
      const groups: Record<string, number> = {};
      const radios = document.querySelectorAll('input[type="radio"]');
      radios.forEach(r => {
        const name = (r as HTMLInputElement).name;
        groups[name] = (groups[name] || 0) + 1;
      });
      return Object.values(groups).some(count => count >= 6);
    });
    expect(violation).toBe(false);
  });

  test('Massive or dynamic sets (10+) MUST use <datalist>', async ({ page }) => {
    // Check if there's an input that *should* be a datalist or a select that is too large
    const violation = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const largeSelect = selects.some(s => s.options.length > 10);
      const largeRadios = Array.from(document.querySelectorAll('input[type="radio"]')).length > 10;
      const hasDatalist = !!document.querySelector('datalist');
      // If we have many options but no datalist, it's a potential violation
      return (largeSelect || largeRadios) && !hasDatalist;
    });
    expect(violation).toBe(false);
  });

  test('Every input MUST be associated with a semantic <label>', async ({ page }) => {
    const labelsValid = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select, textarea'));
      return controls.length > 0 && controls.every(control => {
        const id = control.id;
        const labelFor = id ? document.querySelector(`label[for="${id}"]`) : null;
        const labelWrap = control.closest('label');
        return !!(labelFor || labelWrap);
      });
    });
    expect(labelsValid).toBe(true);
  });

  test('Labels MUST be visually placed above form controls', async ({ page }) => {
    const labelsAbove = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'));
      return controls.every(control => {
        const id = control.id;
        const label = (id ? document.querySelector(`label[for="${id}"]`) : null) || control.closest('label');
        if (!label) return false; // Fail if no label
        const cStyle = window.getComputedStyle(control);
        if (cStyle.display === 'none') return true;
        
        // If label wraps control, it's valid.
        if (label.contains(control)) return true;
        
        const lRect = label.getBoundingClientRect();
        const cRect = control.getBoundingClientRect();
        // Label bottom should be above control top
        return lRect.bottom <= cRect.top + 5;
      });
    });
    expect(labelsAbove).toBe(true);
  });

  test('Labels MUST be visible', async ({ page }) => {
    const visibleLabels = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select'));
      return controls.length > 0 && controls.every(control => {
        const id = control.id;
        const label = (id ? document.querySelector(`label[for="${id}"]`) : null) || control.closest('label');
        if (!label) return false;
        
        const cStyle = window.getComputedStyle(control);
        if (cStyle.display === 'none') return true;
        
        const lStyle = window.getComputedStyle(label);
        return lStyle.display !== 'none' && lStyle.visibility !== 'hidden' && parseFloat(lStyle.opacity) > 0;
      });
    });
    expect(visibleLabels).toBe(true);
  });

  test('Vertical margin between label and input MUST be less than margin between groups', async ({ page }) => {
    const gestaltProximity = await page.evaluate(() => {
      const group = document.querySelector('.form-group, .field, .form-row, div:has(label)');
      const nextGroup = group?.nextElementSibling;
      
      if (!group || !nextGroup) return false;
      
      const label = group.querySelector('label');
      const input = group.querySelector('input, select, textarea');
      
      if (!label || !input) return false;
      
      const labelToInputMargin = input.getBoundingClientRect().top - label.getBoundingClientRect().bottom;
      const groupToGroupMargin = nextGroup.getBoundingClientRect().top - group.getBoundingClientRect().bottom;
      
      return labelToInputMargin < groupToGroupMargin;
    });
    expect(gestaltProximity).toBe(true);
  });

  test('Implementation MUST use aria-describedby', async ({ page }) => {
    const hasAriaDescribedBy = await page.locator('[aria-describedby]').count();
    expect(hasAriaDescribedBy).toBeGreaterThan(0);
  });

  test('The "lang" attribute MUST be defined on the <html> element', async ({ page }) => {
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('Required fields MUST have native validation and indicators', async ({ page }) => {
    const ok = await page.evaluate(() => {
      const requiredInputs = Array.from(document.querySelectorAll('input[required], textarea[required]'));
      if (requiredInputs.length === 0) return false; // In a real form some things should be required
      return requiredInputs.every(input => {
        const id = input.id;
        const label = (id ? document.querySelector(`label[for="${id}"]`) : null) || input.closest('label');
        return label && (label.textContent?.includes('*') || label.textContent?.toLowerCase().includes('required'));
      });
    });
    expect(ok).toBe(true);
  });

  test('Implementation MUST use autocomplete', async ({ page }) => {
    const hasAutocomplete = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[autocomplete]'));
      return inputs.length >= 2; // Expect at least name/email or similar
    });
    expect(hasAutocomplete).toBe(true);
  });

  test('Implementation MUST use inputmode="numeric"', async ({ page }) => {
    const needsNumeric = await page.evaluate(() => {
      const fields = Array.from(document.querySelectorAll('input'));
      return fields.some(f => {
        const idOrName = (f.id + f.name + f.placeholder).toLowerCase();
        return idOrName.includes('zip') || idOrName.includes('phone') || idOrName.includes('passcode') || idOrName.includes('card');
      });
    });
    
    if (!needsNumeric) {
      // Skip if no field seems to need numeric input
      expect(true).toBe(true);
      return;
    }
    
    const hasInputMode = await page.locator('[inputmode="numeric"]').count();
    expect(hasInputMode).toBeGreaterThan(0);
  });

  test('Implementation MUST NOT use type="number" for zip/cc', async ({ page }) => {
    const violation = await page.evaluate(() => {
      // Find anything that looks like a zip or CC field
      const fields = Array.from(document.querySelectorAll('input'));
      return fields.some(f => {
        const idOrName = (f.id + f.name + f.placeholder).toLowerCase();
        return (idOrName.includes('zip') || idOrName.includes('cc') || idOrName.includes('credit')) && f.type === 'number';
      });
    });
    expect(violation).toBe(false);
  });

  test('Input font-size MUST be at least 16px', async ({ page }) => {
    const fontSizeOk = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea, select'));
      return inputs.length > 0 && inputs.every(input => {
        const style = window.getComputedStyle(input);
        if (style.display === 'none') return true;
        return parseFloat(style.fontSize) >= 15.5;
      });
    });
    expect(fontSizeOk).toBe(true);
  });

  test('Tap targets MUST be at least 48px', async ({ page }) => {
    const tapTargetOk = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea, select'));
      
      if (buttons.length === 0 && inputs.length === 0) return true;
      
      const buttonsOk = buttons.every(b => {
        const style = window.getComputedStyle(b);
        if (style.display === 'none') return true;
        const rect = b.getBoundingClientRect();
        // Ignore elements that are currently hidden/not rendered (0x0)
        if (rect.width === 0 && rect.height === 0) return true;
        return rect.width >= 48 && rect.height >= 48;
      });
      
      const inputsOk = inputs.every(i => {
        const style = window.getComputedStyle(i);
        if (style.display === 'none') return true;
        const rect = i.getBoundingClientRect();
        // Ignore elements that are currently hidden/not rendered (0x0)
        if (rect.width === 0 && rect.height === 0) return true;
        return rect.width >= 48 && rect.height >= 48;
      });
      
      return buttonsOk && inputsOk;
    });
    expect(tapTargetOk).toBe(true);
  });

  test('Focus outlines MUST NOT be disabled', async ({ page }) => {
    const focusOk = await page.evaluate(() => {
      const input = document.querySelector('input:not([type="hidden"])') as HTMLInputElement;
      if (!input) return false;
      input.focus();
      const style = window.getComputedStyle(input);
      // It should change something or not be 'none'
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none' || style.borderColor !== 'rgb(238, 238, 238)';
    });
    expect(focusOk).toBe(true);
  });

  test('Validation MUST NOT show on input', async ({ page }) => {
    const input = page.locator('input[required]').first();
    if (await input.count() === 0) throw new Error('No required input found');
    await input.focus();
    await input.type('a');
    const error = page.locator('.error-message, [role="alert"]').filter({ visible: true });
    await expect(error).toHaveCount(0);
  });

  test('Validation MUST show on blur', async ({ page }) => {
    const input = page.locator('input[required]').first();
    if (await input.count() === 0) throw new Error('No required input found');
    
    const describedById = await input.getAttribute('aria-describedby');
    
    await input.focus();
    await input.type('a');
    await input.press('Backspace');
    await input.blur();
    
    if (describedById) {
      // Check if the described element is visible
      const error = page.locator(`#${describedById}`).filter({ visible: true });
      if (await error.count() > 0) {
        await expect(error.first()).toBeVisible();
        return;
      }
    }
    
    // Fallback to standard selectors
    const error = page.locator('.error-message, [role="alert"]').filter({ visible: true });
    await expect(error.first()).toBeVisible();
  });

  test('Implementation MUST provide password toggle', async ({ page }) => {
    const toggle = page.locator('button:has-text("Show"), button:has-text("Hide"), .password-toggle, [aria-label*="password" i], button:has([class*="eye" i])');
    await expect(toggle.first()).toBeAttached();
  });

  test('Implementation MUST include CSRF token', async ({ page }) => {
    const csrf = page.locator('input[type="hidden"][name*="csrf" i]');
    await expect(csrf.first()).toBeAttached();
  });

  test('Implementation MUST NOT use inline JavaScript', async ({ page }) => {
    const hasInline = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).some(el => {
        return Array.from(el.attributes).some(attr => attr.name.startsWith('on'));
      });
    });
    expect(hasInline).toBe(false);
  });

  test('Implementation MUST use single field for names', async ({ page }) => {
    const hasSplit = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (text.includes('first name') && text.includes('last name')) || 
             (!!document.querySelector('[name*="first" i]') && !!document.querySelector('[name*="last" i]'));
    });
    expect(hasSplit).toBe(false);
  });

  test('Implementation MUST use textarea for addresses', async ({ page }) => {
    const area = page.locator('textarea');
    await expect(area.first()).toBeAttached();
  });

  test('Implementation MUST display progress', async ({ page }) => {
    const progress = page.locator('.progress-tracker, [aria-label*="progress" i], .step');
    await expect(progress.first()).toBeAttached();
  });

});
