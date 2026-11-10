import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSRule,
  CSSStyleRule,
  CSSSupportsRule,
  CSSNestedDeclarations,
  type CSSGroupingRule,
} from 'cssomnom';
import type { Page } from '@playwright/test';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...collectStyleRules(Array.from((rule as CSSGroupingRule).cssRules)));
    }
  }
  return result;
}

function collectSupportsRules(rules: Iterable<CSSRule>): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSSupportsRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...collectSupportsRules(Array.from((rule as CSSGroupingRule).cssRules)));
    }
  }
  return result;
}

function ruleHasPropertyValue(
  rule: CSSRule,
  prop: string,
  expectedValue: string,
): boolean {
  if (
    rule instanceof CSSStyleRule &&
    rule.style.getPropertyValue(prop).trim() === expectedValue
  ) {
    return true;
  }
  if (
    rule instanceof CSSNestedDeclarations &&
    rule.style.getPropertyValue(prop).trim() === expectedValue
  ) {
    return true;
  }
  if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
    return Array.from((rule as CSSGroupingRule).cssRules).some((child) =>
      ruleHasPropertyValue(child, prop, expectedValue),
    );
  }
  return false;
}

async function clickSectionNavControl(page: Page, sectionPattern: RegExp): Promise<void> {
  const link = page.locator('nav').getByRole('link', { name: sectionPattern }).first();
  if ((await link.count()) > 0) {
    await link.click();
    return;
  }
  const button = page.locator('nav').getByRole('button', { name: sectionPattern }).first();
  if ((await button.count()) > 0) {
    await button.click();
    return;
  }
  const tab = page.getByRole('tab', { name: sectionPattern }).first();
  await tab.click();
}

function countSpaViewElements(): number {
  const inactiveSamples = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
    (el) => {
      const style = window.getComputedStyle(el);
      return (
        el.inert ||
        style.contentVisibility === 'hidden' ||
        el.hidden ||
        (style.display === 'none' &&
          !['NAV', 'FOOTER', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName) &&
          !el.classList.contains('hidden'))
      );
    },
  );
  let candidates: HTMLElement[] = [];
  if (inactiveSamples.length > 0 && inactiveSamples[0].parentElement) {
    const parent = inactiveSamples[0].parentElement;
    const tagName = inactiveSamples[0].tagName;
    candidates = Array.from(parent.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.tagName === tagName,
    );
  } else {
    candidates = inactiveSamples;
  }

  return candidates.filter((el) => !candidates.some((other) => other !== el && el.contains(other)))
    .length;
}

async function ensureMultipleViewsRendered(page: Page): Promise<void> {
  const initialCount = await page.evaluate(countSpaViewElements);

  if (initialCount < 2) {
    await clickSectionNavControl(page, /^World$/i);
    await expect
      .poll(async () => {
        return page.evaluate(countSpaViewElements);
      })
      .toBeGreaterThanOrEqual(2);
  }
}

async function getSpaViewsState(page: Page) {
  return page.evaluate(() => {
    const inactiveSamples = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
      (el) => {
        const style = window.getComputedStyle(el);
        return (
          el.inert ||
          style.contentVisibility === 'hidden' ||
          el.hidden ||
          (style.display === 'none' &&
            !['NAV', 'FOOTER', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName) &&
            !el.classList.contains('hidden'))
        );
      },
    );
    let candidates: HTMLElement[] = [];
    if (inactiveSamples.length > 0 && inactiveSamples[0].parentElement) {
      const parent = inactiveSamples[0].parentElement;
      const tagName = inactiveSamples[0].tagName;
      candidates = Array.from(parent.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.tagName === tagName,
      );
    } else {
      candidates = inactiveSamples;
    }
    const els = candidates.filter(
      (el) => !candidates.some((other) => other !== el && el.contains(other)),
    );
    return els.map((el, index) => {
      const style = window.getComputedStyle(el);
      const isInactive =
        el.hasAttribute('inert') ||
        (el as HTMLElement & { inert?: boolean }).inert === true ||
        el.getAttribute('aria-hidden') === 'true' ||
        el.hidden ||
        style.display === 'none' ||
        style.contentVisibility === 'hidden';
      return {
        index,
        id: el.id || `view-${index}`,
        isInactive,
        contentVisibility: style.contentVisibility,
        inertAttr: el.hasAttribute('inert'),
        inertProp: Boolean((el as HTMLElement & { inert?: boolean }).inert),
        ariaHidden: el.getAttribute('aria-hidden'),
        isFocused:
          document.activeElement === el ||
          (document.activeElement !== document.body && el.contains(document.activeElement)),
      };
    });
  });
}

test.describe('faster-spa-view-transitions Target Grader', () => {
  test('When content-visibility: hidden is not supported, a @supports not (content-visibility: hidden) fallback rule applies display: none to inactive view elements', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const allStyleRules = collectStyleRules(rules);
    const hasContentVisibilityHidden = allStyleRules.some(
      (r) => r.style.getPropertyValue('content-visibility').trim() === 'hidden',
    );
    expect(hasContentVisibilityHidden).toBe(true);

    const supportsRules = collectSupportsRules(rules);
    expect(supportsRules.length).toBeGreaterThan(0);

    const matchingSupportsRule = supportsRules.find((sr) => {
      const cond = sr.conditionText.replace(/\s+/g, ' ').trim().toLowerCase();
      return (
        cond.includes('not') &&
        cond.includes('content-visibility') &&
        cond.includes('hidden') &&
        ruleHasPropertyValue(sr, 'display', 'none')
      );
    });

    expect(matchingSupportsRule).toBeDefined();
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Inactive view elements have content-visibility: hidden applied in their computed styles', async ({
      page,
    }) => {
      await ensureMultipleViewsRendered(page);
      const views = await getSpaViewsState(page);
      expect(views.length).toBeGreaterThanOrEqual(2);

      const inactiveViews = views.filter((v) => v.isInactive);
      expect(inactiveViews.length).toBeGreaterThan(0);

      for (const view of inactiveViews) {
        expect(view.contentVisibility).toBe('hidden');
      }
    });

    test('When a view element is active, it does not have content-visibility: hidden applied (its computed content-visibility is visible)', async ({
      page,
    }) => {
      await ensureMultipleViewsRendered(page);
      const views = await getSpaViewsState(page);
      expect(views.length).toBeGreaterThanOrEqual(2);

      const activeViews = views.filter((v) => !v.isInactive);
      const inactiveViews = views.filter((v) => v.isInactive);
      expect(inactiveViews.length).toBeGreaterThan(0);
      expect(activeViews.length).toBe(1);

      expect(activeViews[0].contentVisibility).toBe('visible');
    });

    test('Switching between views toggles the content-visibility state between the active and inactive view elements', async ({
      page,
    }) => {
      await clickSectionNavControl(page, /^World$/i);
      await expect
        .poll(async () => {
          const views = await getSpaViewsState(page);
          return views.length >= 2 && views.some((v) => v.contentVisibility === 'hidden');
        })
        .toBe(true);

      const viewsAfterFirstSwitch = await getSpaViewsState(page);
      const firstActive = viewsAfterFirstSwitch.find((v) => v.contentVisibility === 'visible');
      expect(firstActive).toBeDefined();

      await clickSectionNavControl(page, /^Reports$/i);
      await expect
        .poll(async () => {
          const views = await getSpaViewsState(page);
          const prevViewNow = views.find((v) => v.index === firstActive!.index);
          const currentActive = views.find(
            (v) => v.contentVisibility === 'visible' && v.index !== firstActive!.index,
          );
          return prevViewNow?.contentVisibility === 'hidden' && Boolean(currentActive);
        })
        .toBe(true);

      const viewsAfterSecondSwitch = await getSpaViewsState(page);
      const secondActive = viewsAfterSecondSwitch.find(
        (v) => v.contentVisibility === 'visible' && v.index !== firstActive!.index,
      );
      expect(secondActive).toBeDefined();

      // Switch back to World and verify the cached view becomes visible again while Reports becomes hidden
      await clickSectionNavControl(page, /^World$/i);
      await expect
        .poll(async () => {
          const views = await getSpaViewsState(page);
          const worldView = views.find((v) => v.index === firstActive!.index);
          const reportsView = views.find((v) => v.index === secondActive!.index);
          return (
            worldView?.contentVisibility === 'visible' &&
            reportsView?.contentVisibility === 'hidden'
          );
        })
        .toBe(true);
    });

    test('Inactive view elements have the inert attribute applied (and removed when active) so hidden content is excluded from the keyboard tab order and accessibility tree', async ({
      page,
    }) => {
      await clickSectionNavControl(page, /^World$/i);
      await expect
        .poll(async () => {
          const views = await getSpaViewsState(page);
          return views.length >= 2 && views.some((v) => v.isInactive);
        })
        .toBe(true);

      const viewsOnWorld = await getSpaViewsState(page);
      const activeOnWorld = viewsOnWorld.find((v) => !v.isInactive);
      const inactiveOnWorld = viewsOnWorld.filter((v) => v.isInactive);

      expect(activeOnWorld).toBeDefined();
      expect(inactiveOnWorld.length).toBeGreaterThan(0);

      expect(activeOnWorld!.inertAttr || activeOnWorld!.inertProp).toBe(false);
      for (const inactiveView of inactiveOnWorld) {
        expect(inactiveView.inertAttr || inactiveView.inertProp).toBe(true);
      }

      // Switch back to Top News to verify inert is removed when an inactive view becomes active and applied to the previously active view
      await clickSectionNavControl(page, /^Top News$/i);
      await expect
        .poll(async () => {
          const views = await getSpaViewsState(page);
          const worldViewNow = views.find((v) => v.index === activeOnWorld!.index);
          const newActive = views.find((v) => !v.isInactive && v.index !== activeOnWorld!.index);
          return (
            Boolean(worldViewNow && (worldViewNow.inertAttr || worldViewNow.inertProp)) &&
            Boolean(newActive && !newActive.inertAttr && !newActive.inertProp)
          );
        })
        .toBe(true);
    });

    test('Switching to a view moves keyboard focus to the newly active view container', async ({
      page,
    }) => {
      await clickSectionNavControl(page, /^Multimedia$/i);

      await expect
        .poll(async () => {
          const views = await getSpaViewsState(page);
          if (views.length < 2) return false;
          const activeView = views.find((v) => !v.isInactive);
          return Boolean(activeView && activeView.isFocused);
        })
        .toBe(true);
    });
  });
});
