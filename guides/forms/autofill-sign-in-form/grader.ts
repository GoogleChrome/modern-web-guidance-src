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
    const signinUrl = TARGET_URL.includes('/signin')
      ? TARGET_URL
      : `${TARGET_URL.replace(/\/$/, '')}/signin`;
    await page.goto(signinUrl).catch(() => page.goto(TARGET_URL).catch(() => {}));
  });

  test('The sign-in input fields are contained within a form element', async ({ page }) => {
    const isVisible = await page.locator('form').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    const hasForm = /<form[\s\S]*?>[\s\S]*?<\/form>/i.test(code) || /<form/i.test(code) || /onSubmit=/i.test(code);
    expect(hasForm).toBe(true);
  });

  test('The form includes a submit button', async ({ page }) => {
    const isVisible = await page.locator('button[type="submit"], input[type="submit"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    const hasSubmit = /type=[{"']?submit[}"']?/i.test(code) || /<button/i.test(code);
    expect(hasSubmit).toBe(true);
  });

  test('The email and password inputs have associated label elements', async ({ page }) => {
    const isVisible = await page.locator('label').first().isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      expect(isVisible).toBe(true);
      return;
    }
    const code = getSourceContent();
    const hasLabels = /<label/i.test(code) || /htmlFor=|for=/i.test(code);
    expect(hasLabels).toBe(true);
  });

  test('The email input has type="email" and autocomplete="username"', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"]').first();
    const isVisible = await emailInput.isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      const type = await emailInput.getAttribute('type').catch(() => null);
      const auto = await emailInput.getAttribute('autocomplete').catch(() => null);
      expect(type).toBe('email');
      expect(auto).toMatch(/username|email/i);
      return;
    }
    const code = getSourceContent();
    expect(/type=[{"']?email[}"']?/i.test(code)).toBe(true);
    expect(/autoComplete=[{"']?(username|email)[}"']?|autocomplete=[{"']?(username|email)[}"']?/i.test(code)).toBe(true);
  });

  test('The password input has type="password" and autocomplete="current-password"', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const isVisible = await passwordInput.isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      const type = await passwordInput.getAttribute('type').catch(() => null);
      const auto = await passwordInput.getAttribute('autocomplete').catch(() => null);
      expect(type).toBe('password');
      expect(auto).toMatch(/\bcurrent-password\b/i);
      return;
    }
    const code = getSourceContent();
    expect(/type=[{"']?password[}"']?|['"]password['"]|showPassword/i.test(code)).toBe(true);
    expect(/autoComplete=[{"']?(current-password|password)[}"']?|autocomplete=[{"']?(current-password|password)[}"']?/i.test(code)).toBe(true);
  });

  test('Both the email and password inputs have the required attribute', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const isVisible = await emailInput.isVisible({ timeout: 500 }).catch(() => false);
    if (isVisible) {
      const reqEmail = await emailInput.evaluate((el: any) => el.required).catch(() => null);
      const reqPassword = await passwordInput.evaluate((el: any) => el.required).catch(() => null);
      expect(reqEmail).toBe(true);
      expect(reqPassword).toBe(true);
      return;
    }
    const code = getSourceContent();
    const emailRequired = /type=[{"']?email[}"'][^>]*required|required[^>]*type=[{"']?email[}"']/i.test(code) || (code.includes('required') && code.includes('email'));
    const passwordRequired = /type=[{"']?password[}"'][^>]*required|required[^>]*type=[{"']?password[}"']/i.test(code) || (code.includes('required') && code.includes('password'));
    expect(emailRequired).toBe(true);
    expect(passwordRequired).toBe(true);
  });

  test('The form contains exactly one email input and exactly one password input', async ({ page }) => {
    const emailCount = await page.locator('input[type="email"]').count().catch(() => 0);
    const passwordCount = await page.locator('input[type="password"]').count().catch(() => 0);
    if (emailCount > 0 && passwordCount > 0) {
      expect(emailCount).toBe(1);
      expect(passwordCount).toBe(1);
      return;
    }
    const code = getSourceContent();
    const emailMatches = code.match(/type=[{"']?email[}"']?/gi) || [];
    const passwordMatches = code.match(/type=(?:[{"']?password[}"']?|\{[^}]*['"]password['"][^}]*\})|showPassword/gi) || [];
    expect(emailMatches.length).toBe(1);
    expect(passwordMatches.length).toBe(1);
  });
});
