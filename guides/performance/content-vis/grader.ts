import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}
const filePath = path.resolve(targetFile);
const demoUrl = `file://${filePath}`;
const demoName = path.basename(filePath);

// TODO: add testing to ensure this grader fails against the negative demo. (it currently passes.)

// TODO: also determine if we want to dynamically generate these assertions based on the base or base+updated app.

test.describe(`Content-Visibility usage: ${demoName}`, () => {
    test('has content-visibility: auto', () => {
        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toContain('content-visibility: auto');
    });
});


test.describe(`Content-Visibility Best Practices: ${demoName}`, () => {
    
    test.beforeEach(async ({ page }) => {
        await page.goto(demoUrl);
        // Allow time for JS execution and rendering (demo.html has a 500ms delay)
        await page.waitForTimeout(1000);
    });

    test('Elements with content-visibility: auto must have contain-intrinsic-size', async ({ page }) => {
        const violations = await page.evaluate(() => {
            const all = document.querySelectorAll('*');
            const bad: string[] = [];
            for (const el of Array.from(all)) {
                const style = getComputedStyle(el);
                if (style.contentVisibility === 'auto') {
                    // Check if contain-intrinsic-size is set and not 'none'
                    // Note: Browsers might return 'none' or '0px' if not set, depending on defaults/inheritance.
                    // Also 'auto none' means auto behavior is on but no placeholder size is set (defaults to 0px), which causes layout shift.
                    const size = style.containIntrinsicSize;
                    if (!size || size === 'none' || size === 'auto none') {
                        let identifier = el.tagName.toLowerCase();
                        if (el.className) identifier += `.${el.className.split(' ').join('.')}`;
                        else if (el.id) identifier += `#${el.id}`;
                        bad.push(identifier);
                    }
                }
            }
            return bad;
        });
        
        expect(violations, 
            `Found elements with content-visibility: auto but missing contain-intrinsic-size. \nViolations: ${violations.join(', ')}`
        ).toEqual([]);
    });

    test('contain-intrinsic-size should use the "auto" keyword', async ({ page }) => {
        const violations = await page.evaluate(() => {
            const all = document.querySelectorAll('*');
            const bad: string[] = [];
            for (const el of Array.from(all)) {
                const style = getComputedStyle(el);
                if (style.contentVisibility === 'auto') {
                    const size = style.containIntrinsicSize;
                    // We expect 'auto' to be present to remember rendered size.
                    // If size is 'auto none', strictly speaking 'auto' is present, but it's useless without a length.
                    // We enforce that 'auto' is used correctly (with a length).
                    // Also if size is 'none' or missing, it fails.
                    if (!size || !size.includes('auto') || size === 'auto none') {
                        let identifier = el.tagName.toLowerCase();
                        if (el.className) identifier += `.${el.className.split(' ').join('.')}`;
                        else if (el.id) identifier += `#${el.id}`;
                        bad.push(identifier);
                    }
                }
            }
            return bad;
        });

        expect(violations, 
            `Found elements with content-visibility: auto where contain-intrinsic-size does not use "auto" keyword correctly (or at all). \nViolations: ${violations.join(', ')}`
        ).toEqual([]);
    });

    test('content-visibility: auto should not be applied to body', async ({ page }) => {
        const isBodyAuto = await page.evaluate(() => {
            return getComputedStyle(document.body).contentVisibility === 'auto';
        });
        expect(isBodyAuto, 'content-visibility: auto should not be applied to the body element, as it can delay LCP.').toBe(false);
    });

    test('content-visibility: hidden should be paired with aria-hidden="true"', async ({ page }) => {
         const violations = await page.evaluate(() => {
            const all = document.querySelectorAll('*');
            const bad: string[] = [];
            for (const el of Array.from(all)) {
                const style = getComputedStyle(el);
                if (style.contentVisibility === 'hidden') {
                    // If content is hidden for performance, it should also be hidden from a11y tree explicitly 
                    // if it's meant to be invisible (as 'hidden' implies). 
                    // The expectation is that authors must handle a11y explicitly.
                    if (el.getAttribute('aria-hidden') !== 'true') {
                        let identifier = el.tagName.toLowerCase();
                        if (el.className) identifier += `.${el.className.split(' ').join('.')}`;
                        else if (el.id) identifier += `#${el.id}`;
                        bad.push(identifier);
                    }
                }
            }
            return bad;
        });
        
        expect(violations, 
            `Found elements with content-visibility: hidden but missing aria-hidden="true". \nViolations: ${violations.join(', ')}`
        ).toEqual([]);
    });
});
