import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Form-Associated Custom Elements Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('Custom element class defines static formAssociated = true', () => {
    const project = getJsProject(targetFiles);
    const hasFormAssociated = project.getSourceFiles().some((sf) => {
      const prop = sf.getDescendantsOfKind(SyntaxKind.PropertyDeclaration).find(
        (p) => p.isStatic() && p.getName() === 'formAssociated' && p.getInitializer()?.getText() === 'true'
      );
      const getter = sf.getDescendantsOfKind(SyntaxKind.GetAccessor).find(
        (g) => g.isStatic() && g.getName() === 'formAssociated'
      );
      return Boolean(prop || getter);
    });
    expect(hasFormAssociated).toBe(true);
  });

  test('Custom element initializes ElementInternals via attachInternals', () => {
    const project = getJsProject(targetFiles);
    const hasAttachInternals = project.getSourceFiles().flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).some((c) => c.getExpression().getText().endsWith('attachInternals'));
    expect(hasAttachInternals).toBe(true);
  });

  test('Custom element updates form value via ElementInternals.setFormValue', () => {
    const project = getJsProject(targetFiles);
    const hasSetFormValue = project.getSourceFiles().flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).some((c) => c.getExpression().getText().endsWith('setFormValue'));
    expect(hasSetFormValue).toBe(true);
  });

  test('Custom element sets and clears validity via ElementInternals.setValidity', () => {
    const project = getJsProject(targetFiles);
    const hasSetValidity = project.getSourceFiles().flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).some((c) => c.getExpression().getText().endsWith('setValidity'));
    expect(hasSetValidity).toBe(true);
  });

  test('HTML template includes custom element within a form', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasCustomElementInForm = docs.some(({ document }) => {
      const ratingInput = document.querySelector('form rating-input, form [name="rating"]');
      return Boolean(ratingInput);
    });
    expect(hasCustomElementInForm).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {

    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          if (customElements.get('rating-input')) {
            resolve();
          } else {
            const timer = setTimeout(resolve, 1000);
            customElements.whenDefined('rating-input').then(() => {
              clearTimeout(timer);
              resolve();
            });
          }
        });
      });
    });

    test('Custom element renders without hidden input elements in light DOM or shadow DOM', async ({ page }) => {
      const inputCount = await page.evaluate(() => {
        const el = document.querySelector('rating-input');
        if (!el || !el.shadowRoot) return -1;
        const lightInputs = el.querySelectorAll('input').length;
        const shadowInputs = el.shadowRoot.querySelectorAll('input').length;
        return lightInputs + shadowInputs;
      });
      expect(inputCount).toBe(0);
    });

    test('Custom element matches :invalid when required and value is empty', async ({ page }) => {
      const isInvalid = await page.evaluate(() => {
        const el = document.querySelector('rating-input');
        return Boolean(el && el.matches(':invalid'));
      });
      expect(isInvalid).toBe(true);
    });

    test('Owning form checkValidity returns false when required custom element has empty value', async ({ page }) => {
      const isValid = await page.evaluate(() => {
        const el = document.querySelector('rating-input');
        const form = el ? (el as any).form || el.closest('form') : null;
        return form ? form.checkValidity() : null;
      });
      expect(isValid).toBe(false);
    });

    test('Owning form reportValidity returns false when required custom element has empty value', async ({ page }) => {
      const reportResult = await page.evaluate(() => {
        const el = document.querySelector('rating-input');
        const form = el ? (el as any).form || el.closest('form') : null;
        return form ? form.reportValidity() : null;
      });
      expect(reportResult).toBe(false);
    });

    test('Owning form reportValidity moves focus into custom element or its internal controls', async ({ page }) => {
      const hasFocus = await page.evaluate(() => {
        const el = document.querySelector('rating-input');
        const form = el ? (el as any).form || el.closest('form') : null;
        if (!el || !form) return false;
        form.reportValidity();
        return document.activeElement === el || (el.shadowRoot ? el.shadowRoot.activeElement !== null : false);
      });
      expect(hasFocus).toBe(true);
    });

    test('Clicking submit button does not fire submit event when required custom element is empty', async ({ page }) => {
      const submitted = await page.evaluate(() => {
        const el = document.querySelector('rating-input');
        const form = el ? (el as any).form || el.closest('form') : null;
        if (!el || !form) return null;
        let fired = false;
        form.addEventListener('submit', (e: Event) => {
          e.preventDefault();
          fired = true;
        });
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement | null;
        if (submitBtn) {
          submitBtn.click();
        } else {
          form.requestSubmit();
        }
        return fired;
      });
      expect(submitted).toBe(false);
    });

    test('Activating internal control updates custom element value property', async ({ page }) => {
      const valueAfterClick = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        if (!el || !el.shadowRoot) return null;
        const btn = el.shadowRoot.querySelector('button[data-value], [role="radio"], button') as HTMLElement | null;
        if (btn) btn.click();
        return el.value;
      });
      expect(valueAfterClick).toBeTruthy();
    });

    test('Setting non-empty value clears validity errors so custom element matches :valid', async ({ page }) => {
      const matchesValid = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        if (!el) return null;
        el.value = '3';
        return el.matches(':valid');
      });
      expect(matchesValid).toBe(true);
    });

    test('Setting non-empty value makes owning form checkValidity return true', async ({ page }) => {
      const formValid = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        const form = el ? el.form || el.closest('form') : null;
        if (!el || !form) return null;
        el.value = '3';
        return form.checkValidity();
      });
      expect(formValid).toBe(true);
    });

    test('Submitting owning form includes custom element value in FormData under its name attribute', async ({ page }) => {
      const formDataValue = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        const form = el ? el.form || el.closest('form') : null;
        if (!el || !form) return null;
        el.value = '4';
        const name = el.getAttribute('name') || el.name || 'rating';
        const data = new FormData(form);
        return data.get(name);
      });
      expect(formDataValue).toBe('4');
    });

    test('Resetting owning form invokes formResetCallback and restores initial empty value', async ({ page }) => {
      const valueAfterReset = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        const form = el ? el.form || el.closest('form') : null;
        if (!el || !form) return null;
        el.value = '4';
        form.reset();
        return el.value;
      });
      expect(valueAfterReset).toBe('');
    });

    test('Resetting owning form re-evaluates validity to invalid when required and empty', async ({ page }) => {
      const isInvalidAfterReset = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        const form = el ? el.form || el.closest('form') : null;
        if (!el || !form) return null;
        el.value = '4';
        form.reset();
        return el.matches(':invalid') && !form.checkValidity();
      });
      expect(isInvalidAfterReset).toBe(true);
    });

    test('Disabling ancestor fieldset disables internal controls', async ({ page }) => {
      const controlsDisabled = await page.evaluate(() => {
        const el = document.querySelector('rating-input');
        const fieldset = el ? el.closest('fieldset') : null;
        if (!el || !fieldset || !el.shadowRoot) return null;
        fieldset.disabled = true;
        const buttons = Array.from(el.shadowRoot.querySelectorAll('button'));
        return buttons.length > 0 && buttons.every((b) => b.disabled);
      });
      expect(controlsDisabled).toBe(true);
    });

    test('Clicking internal controls while disabled does not modify custom element value', async ({ page }) => {
      const valueUnchanged = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        const fieldset = el ? el.closest('fieldset') : null;
        if (!el || !fieldset || !el.shadowRoot) return null;
        el.value = '2';
        fieldset.disabled = true;
        const btn = el.shadowRoot.querySelector('button[data-value="5"], button:last-of-type') as HTMLElement | null;
        if (btn) btn.click();
        return el.value === '2';
      });
      expect(valueUnchanged).toBe(true);
    });

    test('Re-enabling ancestor fieldset re-enables controls unless custom element has its own disabled attribute', async ({ page }) => {
      const checkReEnable = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        const fieldset = el ? el.closest('fieldset') : null;
        if (!el || !fieldset || !el.shadowRoot) return null;
        fieldset.disabled = true;
        fieldset.disabled = false;
        const buttons = () => Array.from(el.shadowRoot.querySelectorAll('button')) as HTMLButtonElement[];
        const reEnabledWhenFieldsetRestored = buttons().every((b) => !b.disabled);

        el.setAttribute('disabled', '');
        fieldset.disabled = true;
        fieldset.disabled = false;
        const staysDisabledWithOwnAttribute = buttons().every((b) => b.disabled);

        el.removeAttribute('disabled');
        return reEnabledWhenFieldsetRestored && staysDisabledWithOwnAttribute;
      });
      expect(checkReEnable).toBe(true);
    });

    test('Invoking formStateRestoreCallback restores custom element value from provided state', async ({ page }) => {
      const restoredValue = await page.evaluate(() => {
        const el = document.querySelector('rating-input') as any;
        if (!el || typeof el.formStateRestoreCallback !== 'function') return null;
        el.formStateRestoreCallback('5');
        return el.value;
      });
      expect(restoredValue).toBe('5');
    });

  });
});
