import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSMediaRule,
  CSSStartingStyleRule,
  type CSSRule,
  type CSSStyleDeclaration,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - package.json in target lacks "type": "module" under moduleResolution nodenext
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getRuleStyle(rule: CSSRule): CSSStyleDeclaration | null {
  if ('style' in rule && rule.style) {
    return rule.style as CSSStyleDeclaration;
  }
  return null;
}

function hasTransitionWithDiscreteOverlayAndDisplay(style: CSSStyleDeclaration): boolean {
  const transition = style.getPropertyValue('transition').toLowerCase();
  const transitionProperty = style.getPropertyValue('transition-property').toLowerCase();
  const transitionBehavior = style.getPropertyValue('transition-behavior').toLowerCase();

  const propsText = `${transition} ${transitionProperty}`;
  const hasDisplay = /\b(display|all)\b/.test(propsText);
  const hasOverlay = /\b(overlay|all)\b/.test(propsText);
  const hasAllowDiscrete =
    /\ballow-discrete\b/.test(transitionBehavior) || /\ballow-discrete\b/.test(transition);

  return hasDisplay && hasOverlay && hasAllowDiscrete;
}

test.describe('hovercard Target Grader', () => {
  test('The popover uses position-area to position itself relative to the trigger link.', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const popovers = docs.flatMap((d) => Array.from(d.document.querySelectorAll('[popover]')));
    expect(popovers.length).toBeGreaterThan(0);

    const allRules = getRules(targetFiles);

    const hasPositionArea = allRules.some((rule) => {
      const style = getRuleStyle(rule);
      if (!style) return false;
      const posArea = style.getPropertyValue('position-area').trim();
      const insetArea = style.getPropertyValue('inset-area').trim();
      return posArea.length > 0 || insetArea.length > 0;
    });

    expect(hasPositionArea).toBe(true);
  });

  test('The popover has a transition that includes display: allow-discrete and overlay: allow-discrete.', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const popovers = docs.flatMap((d) => Array.from(d.document.querySelectorAll('[popover]')));
    expect(popovers.length).toBeGreaterThan(0);

    const allRules = getRules(targetFiles);

    const hasDiscreteTransition = allRules.some((rule) => {
      const style = getRuleStyle(rule);
      if (!style) return false;
      return hasTransitionWithDiscreteOverlayAndDisplay(style);
    });

    expect(hasDiscreteTransition).toBe(true);
  });

  test('The popover has a @starting-style block that defines its initial state for entry animations (e.g. opacity: 0).', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const popovers = docs.flatMap((d) => Array.from(d.document.querySelectorAll('[popover]')));
    expect(popovers.length).toBeGreaterThan(0);

    const startingStyleRules = getRules(targetFiles, CSSStartingStyleRule);
    expect(startingStyleRules.length).toBeGreaterThan(0);

    const hasStartingDeclarations = startingStyleRules.some((startingRule) => {
      const innerRules = getRules(startingRule);
      return innerRules.some((r) => {
        const style = getRuleStyle(r);
        if (!style) return false;
        return (
          style.getPropertyValue('opacity').trim().length > 0 ||
          style.getPropertyValue('transform').trim().length > 0 ||
          style.getPropertyValue('scale').trim().length > 0 ||
          style.getPropertyValue('translate').trim().length > 0
        );
      });
    });

    expect(hasStartingDeclarations).toBe(true);
  });

  test('If prefers-reduced-motion: reduce is active, the popover opens without a transform or opacity transition.', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const popovers = docs.flatMap((d) => Array.from(d.document.querySelectorAll('[popover]')));
    expect(popovers.length).toBeGreaterThan(0);

    const mediaRules = getRules(targetFiles, CSSMediaRule).filter((rule) =>
      rule.conditionText.includes('prefers-reduced-motion')
    );
    expect(mediaRules.length).toBeGreaterThan(0);

    const gatesMotionProperly = mediaRules.some((mediaRule) => {
      const condition = mediaRule.conditionText.toLowerCase();
      const innerRules = getRules(mediaRule);

      if (condition.includes('no-preference')) {
        return innerRules.some((r) => {
          const style = getRuleStyle(r);
          if (!style) return false;
          const trans = `${style.getPropertyValue('transition')} ${style.getPropertyValue('transition-property')} ${style.getPropertyValue('transition-duration')}`.toLowerCase();
          return /\b(opacity|transform|translate|scale|all)\b/.test(trans) && /[1-9]/.test(trans);
        });
      }

      if (condition.includes('reduce')) {
        return innerRules.some((r) => {
          const style = getRuleStyle(r);
          if (!style) return false;
          const trans = style.getPropertyValue('transition').toLowerCase();
          const dur = style.getPropertyValue('transition-duration').toLowerCase();
          const prop = style.getPropertyValue('transition-property').toLowerCase();
          return (
            trans.includes('none') ||
            prop.includes('none') ||
            /^0(s|ms)?(\s*,\s*0(s|ms)?)*$/.test(dur.trim())
          );
        });
      }

      return false;
    });

    expect(gatesMotionProperly).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Hovering over the link opens its associated popover.', async ({ page }) => {
      const trigger = page.locator('a[interestfor], .card a[href]').first();
      await expect(trigger).toBeVisible();
      await expect(page.locator('[popover]:popover-open')).toHaveCount(0);

      await trigger.hover();

      const openPopover = page.locator('[popover]:popover-open').first();
      await expect(openPopover).toBeVisible({ timeout: 5000 });
    });

    test('Focusing the link opens its associated popover.', async ({ page }) => {
      const trigger = page.locator('a[interestfor], .card a[href]').first();
      await expect(trigger).toBeVisible();
      await expect(page.locator('[popover]:popover-open')).toHaveCount(0);

      await trigger.focus();

      const openPopover = page.locator('[popover]:popover-open').first();
      await expect(openPopover).toBeVisible({ timeout: 5000 });
    });
  });
});
