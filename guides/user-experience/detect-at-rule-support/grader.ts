import { test, expect } from '@playwright/test';

test.describe('Detect at-rule support expectations', () => {

  test.beforeEach(async ({ page }) => {
    let fileUrl = process.env.TARGET_FILE || `file://${process.cwd()}/demo.html`;
    if (!fileUrl.startsWith('http') && !fileUrl.startsWith('file://')) {
      fileUrl = `file://${fileUrl}`;
    }
    await page.goto(fileUrl);
  });

  test('The CSS contains at least one @supports at-rule(@<at-keyword>) block', async ({ page }) => {
    const validRules = await page.evaluate(() => {
      const rules: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSSupportsRule) {
              if (/at-rule\(\s*@[a-zA-Z0-9-]+\s*\)/.test(rule.conditionText)) {
                rules.push(rule.conditionText);
              }
            }
          }
        } catch(e: any) {
          if (e.name !== 'SecurityError') throw e;
        }
      }
      return rules;
    });
    
    expect(validRules.length).toBeGreaterThan(0);
  });

  test('At least one @supports at-rule(...) block evaluates to true at runtime', async ({ page }) => {
    const atRuleCalls = await page.evaluate(() => {
      const calls: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSSupportsRule) {
              const matches = rule.conditionText.match(/at-rule\([^)]*\)/g);
              if (matches) calls.push(...matches);
            }
          }
        } catch(e: any) {
          if (e.name !== 'SecurityError') throw e;
        }
      }
      return calls;
    });

    expect(atRuleCalls.length).toBeGreaterThan(0);

    let hasTrueEvaluation = false;
    for (const call of atRuleCalls) {
      const isSupported = await page.evaluate((c) => CSS.supports(c), call);
      if (isSupported) {
        hasTrueEvaluation = true;
        break;
      }
    }
    expect(hasTrueEvaluation).toBe(true);
  });

  test('The argument passed to at-rule() is a single at-keyword without preludes or blocks', async ({ page }) => {
    const codeContents = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '');
      const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '');
      return [...styles, ...scripts];
    });

    let foundAtRuleCall = false;

    for (const content of codeContents) {
      const cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
      const matches = [...cleaned.matchAll(/at-rule\(([^)]*)\)/g)];
      for (const match of matches) {
        foundAtRuleCall = true;
        const arg = (match[1] || '').trim();
        // The argument must be a single at-keyword token
        expect(arg).toMatch(/^@[a-zA-Z0-9-]+$/);
        // Specifically forbid @charset as per the guide
        expect(arg).not.toBe('@charset');
      }
    }
    
    // We expect to find at least one usage to validate
    expect(foundAtRuleCall).toBe(true);
  });

  test('The at-rule() function is only used inside condition contexts', async ({ page }) => {
    const styleContents = await page.evaluate(() => {
      const inlineStyles = Array.from(document.querySelectorAll('[style]')).map(el => el.getAttribute('style') || '');
      const styleTags = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '');
      return [...styleTags, ...inlineStyles];
    });

    for (const style of styleContents) {
      const cleanedStyle = style.replace(/\/\*[\s\S]*?\*\//g, '');
      const parts = cleanedStyle.split('at-rule(');
      for (let i = 1; i < parts.length; i++) {
        const before = (parts[i - 1] || '').trimEnd();
        const validPrecedingRegex = /(@supports|supports\s*\()$|(and|or|not|\()$/i;
        expect(validPrecedingRegex.test(before)).toBeTruthy();
      }
    }
  });

  test('JavaScript feature detection does not use the invalid in CSS pattern', async ({ page }) => {
    const scriptContents = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || '');
    });

    for (const script of scriptContents) {
      const invalidJSPatterns = [...script.matchAll(/['"`]at-rule\([^)]*\)['"`]\s+in\s+CSS/g)];
      expect(invalidJSPatterns.length).toBe(0);
    }
  });

});
