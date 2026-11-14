import { test, expect } from '@playwright/test';

const underlineDemo = '/guides/ui-behaviors/anchor-positioning-tab-underline/demo.html';

for (const [layout, directionSelector, direction] of [
  ['left-to-right', 'html', 'ltr'],
  ['right-to-left', 'html', 'rtl'],
  ['right-to-left navigation in a left-to-right page', 'nav', 'rtl'],
]) {
  test(`tab underline follows the active item in ${layout} layout`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(underlineDemo);
    await page.locator(directionSelector).evaluate((element, dir) => {
      element.setAttribute('dir', dir);
    }, direction);

    const list = page.locator('nav ul');
    const links = list.locator('li a');
    for (const index of [0, 2, 4]) {
      await links.nth(index).click();

      const { tabLeft, tabWidth, underlineLeft, underlineWidth, borderWidth } = await list.evaluate((element, tabIndex) => {
        const tab = element.children[tabIndex].getBoundingClientRect();
        const underline = getComputedStyle(element, '::before');
        return {
          tabLeft: tab.left,
          tabWidth: tab.width,
          underlineLeft: parseFloat(underline.left),
          underlineWidth: parseFloat(underline.width),
          borderWidth: parseFloat(underline.borderBlockEndWidth),
        };
      }, index);

      expect(underlineLeft).toBeCloseTo(tabLeft, 1);
      expect(underlineWidth).toBeCloseTo(tabWidth, 1);
      expect(borderWidth).toBeGreaterThan(0);
    }
  });
}

for (const reducedMotion of /** @type {const} */ (['no-preference', 'reduce'])) {
  test(`tab underline respects prefers-reduced-motion: ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto(underlineDemo);

    const { transitions, underlineLeft, tabLeft } = await page.locator('nav li a').last().evaluate(async (link) => {
      const lastTab = link.closest('li');
      const list = link.closest('ul');
      if (!lastTab || !list || !(link instanceof HTMLAnchorElement)) {
        throw new Error('No navigation link in the last tab');
      }
      link.click();

      // Flush style so that any transitions from changing the active anchor are registered.
      const animations = list.getAnimations({ subtree: true });
      await Promise.all(animations.map((animation) => animation.finished));
      return {
        transitions: animations.length,
        underlineLeft: parseFloat(getComputedStyle(list, '::before').left),
        tabLeft: lastTab.getBoundingClientRect().left,
      };
    });

    if (reducedMotion === 'reduce') {
      expect(transitions).toBe(0);
    } else {
      expect(transitions).toBeGreaterThan(0);
    }
    expect(underlineLeft).toBeCloseTo(tabLeft, 1);
  });
}
