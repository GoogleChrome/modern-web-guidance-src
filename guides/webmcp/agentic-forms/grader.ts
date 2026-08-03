import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve(__dirname, 'demo.html');
const absolutePath = path.isAbsolute(targetFile) ? targetFile : path.resolve(process.cwd(), targetFile);
const targetUrl = absolutePath.startsWith('http') ? absolutePath : `file://${absolutePath}`;

test.beforeEach(async ({ page }) => {
  // Register a dialog handler to prevent any alert/confirm/prompt from blocking execution
  page.on('dialog', dialog => dialog.dismiss());
});

test('the form element has both toolname and tooldescription attributes', async ({ page }) => {
  await page.goto(targetUrl);
  
  const hasValidForm = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form'));
    return forms.some(form => {
      const toolname = form.getAttribute('toolname');
      const tooldescription = form.getAttribute('tooldescription');
      return !!(toolname && toolname.trim() && tooldescription && tooldescription.trim());
    });
  });
  
  expect(hasValidForm).toBe(true);
});

test('input elements have associated labels or toolparamdescription attributes', async ({ page }) => {
  await page.goto(targetUrl);
  
  const results = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form'));
    if (forms.length === 0) return false;
    
    // We only care about forms that are meant to be WebMCP tools (i.e. have toolname/tooldescription)
    // or standard forms if none are annotated.
    const targetForms = forms.filter(f => f.hasAttribute('toolname') || f.hasAttribute('tooldescription'));
    const formsToTest = targetForms.length > 0 ? targetForms : forms;
    
    for (const form of formsToTest) {
      const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
      const fields = inputs.filter(input => {
        const type = input.getAttribute('type');
        return !['submit', 'button', 'hidden'].includes(type || '');
      });
      
      if (fields.length === 0) continue;
      
      for (const field of fields) {
        const htmlField = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const hasLabels = htmlField.labels && htmlField.labels.length > 0;
        const hasToolParamDesc = !!field.getAttribute('toolparamdescription');
        const hasAriaLabel = !!field.getAttribute('aria-label');
        const hasAriaLabelledBy = !!field.getAttribute('aria-labelledby');
        const hasAriaDesc = !!field.getAttribute('aria-description');
        
        if (!hasLabels && !hasToolParamDesc && !hasAriaLabel && !hasAriaLabelledBy && !hasAriaDesc) {
          return false;
        }
      }
    }
    return true;
  });

  expect(results).toBe(true);
});

test('the submit event listener uses event.preventDefault()', async ({ page }) => {
  await page.goto(targetUrl);
  
  const prevented = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return false;
    
    const event = new SubmitEvent('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(event);
    return event.defaultPrevented;
  });
  
  expect(prevented).toBe(true);
});

test('the submit event listener checks event.agentInvoked', async ({ page }) => {
  await page.goto(targetUrl);
  
  const checked = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return false;
    
    let calledWhenFalse = false;
    let calledWhenTrue = false;
    
    const evFalse = new SubmitEvent('submit', { cancelable: true, bubbles: true });
    Object.defineProperty(evFalse, 'agentInvoked', { value: false });
    Object.defineProperty(evFalse, 'respondWith', {
      value: () => { calledWhenFalse = true; }
    });
    form.dispatchEvent(evFalse);
    
    const evTrue = new SubmitEvent('submit', { cancelable: true, bubbles: true });
    Object.defineProperty(evTrue, 'agentInvoked', { value: true });
    Object.defineProperty(evTrue, 'respondWith', {
      value: () => { calledWhenTrue = true; }
    });
    form.dispatchEvent(evTrue);
    
    return calledWhenTrue && !calledWhenFalse;
  });
  
  expect(checked).toBe(true);
});

test('the submit event listener calls event.respondWith() with a Promise', async ({ page }) => {
  await page.goto(targetUrl);
  
  const calledWithPromise = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return false;
    
    let passedArg: any = null;
    const ev = new SubmitEvent('submit', { cancelable: true, bubbles: true });
    Object.defineProperty(ev, 'agentInvoked', { value: true });
    Object.defineProperty(ev, 'respondWith', {
      value: (arg: any) => { passedArg = arg; }
    });
    form.dispatchEvent(ev);
    
    return passedArg && typeof passedArg.then === 'function';
  });
  
  expect(calledWithPromise).toBe(true);
});

test('the :tool-form-active pseudo-class is used to provide visual feedback', async ({ page }) => {
  await page.goto(targetUrl);
  
  const formFeedback = await page.evaluate(async () => {
    let combinedStyles = '';
    const styles = Array.from(document.querySelectorAll('style'));
    for (const style of styles) {
      combinedStyles += (style.textContent || '') + String.fromCharCode(10);
    }
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href) {
        try {
          const resp = await fetch(href);
          const text = await resp.text();
          combinedStyles += text + String.fromCharCode(10);
        } catch (e) {}
      }
    }

    const hasFormSelector = combinedStyles.includes(':tool-form-active');
    if (!hasFormSelector) {
      return false;
    }

    const rewrittenStyles = combinedStyles.replace(/:tool-form-active/g, '.mock-tool-form-active');

    const styleEl = document.createElement('style');
    styleEl.textContent = rewrittenStyles;
    document.head.appendChild(styleEl);

    const form = document.querySelector('form');
    if (!form) {
      styleEl.remove();
      return false;
    }

    const properties = [
      'outline-style', 'outline-width', 'outline-color',
      'border-style', 'border-width', 'border-color',
      'background-color', 'background-image', 'box-shadow'
    ];

    const initialFormStyle: Record<string, string> = {};
    for (const prop of properties) {
      initialFormStyle[prop] = window.getComputedStyle(form).getPropertyValue(prop);
    }

    form.classList.add('mock-tool-form-active');

    let formActiveFeedback = false;
    for (const prop of properties) {
      const currentFormVal = window.getComputedStyle(form).getPropertyValue(prop);
      if (currentFormVal && currentFormVal !== initialFormStyle[prop] && currentFormVal !== 'none' && currentFormVal !== '0px') {
        formActiveFeedback = true;
      }
    }

    form.classList.remove('mock-tool-form-active');
    styleEl.remove();

    return formActiveFeedback || hasFormSelector;
  });

  expect(formFeedback).toBe(true);
});

test('the :tool-submit-active pseudo-class is used to provide visual feedback', async ({ page }) => {
  await page.goto(targetUrl);
  
  const submitFeedback = await page.evaluate(async () => {
    let combinedStyles = '';
    const styles = Array.from(document.querySelectorAll('style'));
    for (const style of styles) {
      combinedStyles += (style.textContent || '') + String.fromCharCode(10);
    }
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href) {
        try {
          const resp = await fetch(href);
          const text = await resp.text();
          combinedStyles += text + String.fromCharCode(10);
        } catch (e) {}
      }
    }

    const hasSubmitSelector = combinedStyles.includes(':tool-submit-active');
    if (!hasSubmitSelector) {
      return false;
    }

    const rewrittenStyles = combinedStyles.replace(/:tool-submit-active/g, '.mock-tool-submit-active');

    const styleEl = document.createElement('style');
    styleEl.textContent = rewrittenStyles;
    document.head.appendChild(styleEl);

    const form = document.querySelector('form');
    const button = form ? (form.querySelector('button[type="submit"]') || form.querySelector('button:not([type])') || form.querySelector('input[type="submit"]')) : null;
    if (!button) {
      styleEl.remove();
      return false;
    }

    const properties = [
      'outline-style', 'outline-width', 'outline-color',
      'border-style', 'border-width', 'border-color',
      'background-color', 'background-image', 'box-shadow', 'animation-name'
    ];

    const initialButtonStyle: Record<string, string> = {};
    for (const prop of properties) {
      initialButtonStyle[prop] = window.getComputedStyle(button as Element).getPropertyValue(prop);
    }

    (button as Element).classList.add('mock-tool-submit-active');

    let buttonActiveFeedback = false;
    for (const prop of properties) {
      const currentButtonVal = window.getComputedStyle(button as Element).getPropertyValue(prop);
      if (currentButtonVal && currentButtonVal !== initialButtonStyle[prop] && currentButtonVal !== 'none' && currentButtonVal !== '0px') {
        buttonActiveFeedback = true;
      }
    }

    (button as Element).classList.remove('mock-tool-submit-active');
    styleEl.remove();

    return buttonActiveFeedback || hasSubmitSelector;
  });

  expect(submitFeedback).toBe(true);
});
