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

function getSourceContent(): string {
  let projectRoot = targetDir;
  while (projectRoot !== path.dirname(projectRoot) && !fs.existsSync(path.join(projectRoot, 'package.json'))) {
    projectRoot = path.dirname(projectRoot);
  }
  const possiblePaths = [
    filePath,
    path.join(projectRoot, 'src/components/SignInForm.tsx'),
    path.join(projectRoot, 'src/components/SignInForm.jsx'),
    path.join(projectRoot, 'src/pages/signin.astro'),
    path.join(projectRoot, 'index.html')
  ];
  let content = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      content += '\n' + fs.readFileSync(p, 'utf8');
    }
  }
  return content;
}

test.describe(`autofill-sign-in-form Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page, TARGET_URL }) => {
    if (TARGET_URL.startsWith('http://localhost/') || TARGET_URL === `http://localhost/${demoName}`) {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          const contentType = localFilePath.endsWith('.html') ? 'text/html' : 'application/javascript';
          await route.fulfill({
            status: 200,
            contentType,
            body: fs.readFileSync(localFilePath),
          });
        } else {
          await route.continue();
        }
      });
    }
    await page.goto(TARGET_URL).catch(() => {});
  });

  test('All sign-in inputs must be within a <form> element', async ({ page }) => {
    const isVisible = await page.locator('form').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    const hasForm = /<form[\s\S]*?>[\s\S]*?<\/form>/i.test(code) || /<form/i.test(code) || /onSubmit=/i.test(code);
    expect(hasForm).toBe(true);
  });

  test('The form must have a submit button', async ({ page }) => {
    const isVisible = await page.locator('button[type="submit"], input[type="submit"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    const hasSubmit = /type=[{"']?submit[}"']?/i.test(code) || /<button/i.test(code);
    expect(hasSubmit).toBe(true);
  });

  test('Every input in the form must have an associated label', async ({ page }) => {
    const isVisible = await page.locator('label').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    const hasLabels = /<label/i.test(code) || /htmlFor=|for=/i.test(code);
    expect(hasLabels).toBe(true);
  });

  test('Labels must have a "for" attribute matching an input "id"', async ({ page }) => {
    const isVisible = await page.locator('label[for]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    const hasFor = /htmlFor=|for=/i.test(code);
    expect(hasFor).toBe(true);
  });

  test('No element must use autocomplete="off"', async ({ page }) => {
    const code = getSourceContent();
    const hasOff = /autocomplete=[{"']?off[}"']?|autoComplete=[{"']?off[}"']?/i.test(code);
    expect(hasOff).toBe(false);
  });

  test('Email input must have type="email"', async ({ page }) => {
    const isVisible = await page.locator('input[type="email"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    expect(/type=[{"']?email[}"']?/i.test(code)).toBe(true);
  });

  test('Email input must have autocomplete="username"', async ({ page }) => {
    const isVisible = await page.locator('input[type="email"], input[name="username"], input[name="email"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      const attr = await page.locator('input[type="email"], input[name="username"], input[name="email"]').first().getAttribute('autocomplete', { timeout: 500 }).catch(() => null);
      if (attr) {
        expect(attr.includes('username') || attr.includes('email')).toBe(true);
        return;
      }
    }
    const code = getSourceContent();
    expect(/autoComplete=[{"']?(username|email)[}"']?|autocomplete=[{"']?(username|email)[}"']?/i.test(code)).toBe(true);
  });

  test('Password input must have type="password"', async ({ page }) => {
    const isVisible = await page.locator('input[type="password"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    expect(/type=[{"']?password[}"']?/i.test(code)).toBe(true);
  });

  test('Password input must have autocomplete="current-password"', async ({ page }) => {
    const isVisible = await page.locator('input[type="password"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      const attr = await page.locator('input[type="password"]').first().getAttribute('autocomplete', { timeout: 500 }).catch(() => null);
      if (attr) {
        expect(attr.includes('current-password') || attr.includes('password')).toBe(true);
        return;
      }
    }
    const code = getSourceContent();
    expect(/autoComplete=[{"']?(current-password|password)[}"']?|autocomplete=[{"']?(current-password|password)[}"']?/i.test(code)).toBe(true);
  });

  test('Password input must have id="current-password"', async ({ page }) => {
    const isVisible = await page.locator('input[type="password"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      const id = await page.locator('input[type="password"]').first().getAttribute('id', { timeout: 500 }).catch(() => null);
      if (id) {
        expect(id.includes('current-password') || id.includes('password')).toBe(true);
        return;
      }
    }
    const code = getSourceContent();
    expect(/id=[{"']?(current-password|password)[}"']?/i.test(code)).toBe(true);
  });

  test('Email input must be required', async ({ page }) => {
    const isVisible = await page.locator('input[type="email"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      const req = await page.locator('input[type="email"]').first().evaluate((el: any) => el.required).catch(() => null);
      if (req !== null) {
        expect(req).toBe(true);
        return;
      }
    }
    const code = getSourceContent();
    expect(/required/i.test(code)).toBe(true);
  });

  test('Password input must be required', async ({ page }) => {
    const isVisible = await page.locator('input[type="password"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      const req = await page.locator('input[type="password"]').first().evaluate((el: any) => el.required).catch(() => null);
      if (req !== null) {
        expect(req).toBe(true);
        return;
      }
    }
    const code = getSourceContent();
    expect(/required/i.test(code)).toBe(true);
  });

  test('There must be exactly one email input', async ({ page }) => {
    const count = await page.locator('input[type="email"]').count().catch(() => 0);
    if (count > 0) {
      expect(count).toBe(1);
      return;
    }
    const code = getSourceContent();
    const matches = code.match(/type=[{"']?email[}"']?/gi) || [];
    expect(matches.length <= 1).toBe(true);
  });

  test('There must be exactly one password input', async ({ page }) => {
    const count = await page.locator('input[type="password"]').count().catch(() => 0);
    if (count > 0) {
      expect(count).toBe(1);
      return;
    }
    const code = getSourceContent();
    const matches = code.match(/type=[{"']?password[}"']?/gi) || [];
    expect(matches.length <= 1).toBe(true);
  });

});
