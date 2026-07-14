import { test, expect, type Page } from '@playwright/test';

let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(30000);
  
  sharedPage = await browser.newPage();
  const targetFile = process.env.TARGET_FILE;
  if (!targetFile) {
    throw new Error('TARGET_FILE environment variable is not defined.');
  }
  await sharedPage.goto(`file://${targetFile}`);
});

test.afterAll(async () => {
  test.setTimeout(30000);
  if (sharedPage) {
    await sharedPage.close();
  }
});

test('Target column elements must have content-visibility: auto in computed styles', async () => {
  test.setTimeout(30000);
  const contentVisibility = await sharedPage.evaluate(() => {
    const el = document.querySelector('.list') || document.querySelector('.board-column') || document.querySelector('[class*="column"]');
    if (!el) throw new Error('Could not find column elements');
    return window.getComputedStyle(el).contentVisibility;
  });
  
  expect(contentVisibility).toBe('auto');
});

test('Target column elements must have a non-zero contain-intrinsic-size specified', async () => {
  test.setTimeout(30000);
  const hasNonZeroSize = await sharedPage.evaluate(() => {
    const el = document.querySelector('.list') || document.querySelector('.board-column') || document.querySelector('[class*="column"]');
    if (!el) return false;
    const styles = window.getComputedStyle(el);
    const size = styles.getPropertyValue('contain-intrinsic-size') || styles.containIntrinsicSize || '';
    if (!size || size === 'none' || size === 'normal') return false;
    const numbers = size.match(/\d+/g);
    if (!numbers) return false;
    const allZeros = numbers.every(n => parseInt(n, 10) === 0);
    return !allZeros;
  });
  
  expect(hasNonZeroSize).toBe(true);
});

test('The implementation must exhibit isolated layout recalculations', async () => {
  test.setTimeout(30000);
  const hasIsolatedLayoutRecalc = await sharedPage.evaluate(() => {
    const col = document.querySelector('.list') || document.querySelector('.board-column') || document.querySelector('[class*="column"]');
    if (!col) return false;
    const colStyles = window.getComputedStyle(col);
    
    const card = document.querySelector('.card') || document.querySelector('[class*="card"]');
    const cardStyles = card ? window.getComputedStyle(card) : null;

    const colIsolated = colStyles.contentVisibility === 'auto' || (colStyles.contain && colStyles.contain !== 'none');
    const cardIsolated = cardStyles ? (cardStyles.contentVisibility === 'auto' || (cardStyles.contain && cardStyles.contain !== 'none')) : false;

    return colIsolated || cardIsolated;
  });
  
  expect(hasIsolatedLayoutRecalc).toBe(true);
});

test('The application must not exhibit global reflows when dragging items between columns', async () => {
  test.setTimeout(30000);
  const retainsContainmentDuringDrag = await sharedPage.evaluate(() => {
    const list = document.querySelector('.list') || document.querySelector('.board-column') || document.querySelector('[class*="column"]');
    if (!list) return false;
    
    const listCards = list.querySelector('.list-cards') || list;
    
    // Simulate dragging activity by dispatching a dragover event
    const dragEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
    listCards.dispatchEvent(dragEvent);
    
    const styles = window.getComputedStyle(list);
    const hasContainment = styles.contentVisibility === 'auto' || (styles.contain && styles.contain !== 'none');
    
    return hasContainment;
  });
  
  expect(retainsContainmentDuringDrag).toBe(true);
});

test('Target column elements should have contain fallback style applied for partial layout isolation', async () => {
  test.setTimeout(30000);
  const hasContainmentFallback = await sharedPage.evaluate(() => {
    let foundFallback = false;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          const cssText = rule.cssText;
          if (cssText.includes('contain:') && (cssText.includes('layout') || cssText.includes('strict') || cssText.includes('content'))) {
            foundFallback = true;
            break;
          }
        }
      } catch (e) {
        // Ignore cross-origin sheet security exceptions
      }
      if (foundFallback) break;
    }
    return foundFallback;
  });
  
  expect(hasContainmentFallback).toBe(true);
});
