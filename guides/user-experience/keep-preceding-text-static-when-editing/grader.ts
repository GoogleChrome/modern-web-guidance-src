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

test.describe(`text-wrap: stable Expectations: ${demoName}`, () => {

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

    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(demoUrl);
  });

  test('all contenteditable elements must have text-wrap: stable', async ({ page }) => {
    const editables = page.locator('[contenteditable="true"]');
    const count = await editables.count();
    expect(count, 'Should have at least one contenteditable element').toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      const textWrap = await editables.nth(i).evaluate(el => getComputedStyle(el).textWrap);
      expect(textWrap).toBe('stable');
    }
  });

  test('editing text at the end must not cause earlier lines to shift', async ({ page }) => {
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();

    // Identify the first word and a word in the middle to monitor
    const monitorWords = await editor.evaluate((el) => {
      const elRect = el.getBoundingClientRect();
      const text = (el as HTMLElement).innerText;
      const words = text.trim().split(/\s+/).filter((w: string) => w.length > 2);
      const firstWord = words[0];
      const midWord = words[Math.floor(words.length / 2)];
      
      const getPos = (word: string) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const index = node.textContent?.indexOf(word) ?? -1;
          if (index !== -1) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + word.length);
            const rect = range.getBoundingClientRect();
            return { x: rect.x - elRect.x, y: rect.y - elRect.y };
          }
          node = walker.nextNode();
        }
        return null;
      };

      return {
        first: { word: firstWord, pos: getPos(firstWord) },
        mid: { word: midWord, pos: getPos(midWord) }
      };
    });

    expect(monitorWords.first.pos, 'Should find first word').not.toBeNull();
    const initialFirstPos = monitorWords.first.pos!;

    // Focus end and type significantly
    await editor.focus();
    await page.keyboard.press('End');
    // Type words one by one to simulate more realistic typing
    const extraText = ' adding more and more text to the end of the element to see if the browser maintains the stability of the preceding lines as requested by the text-wrap stable property.';
    await page.keyboard.type(extraText);

    // Check positions again
    const finalFirstPos = await editor.evaluate((el, word: string) => {
      const elRect = el.getBoundingClientRect();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const index = node.textContent?.indexOf(word) ?? -1;
        if (index !== -1) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + word.length);
          const rect = range.getBoundingClientRect();
          return { x: rect.x - elRect.x, y: rect.y - elRect.y };
        }
        node = walker.nextNode();
      }
      return null;
    }, monitorWords.first.word);

    // The first word should definitely not have shifted its Y position relative to element top
    expect(finalFirstPos?.y).toBeCloseTo(initialFirstPos.y, 1);
  });
});
