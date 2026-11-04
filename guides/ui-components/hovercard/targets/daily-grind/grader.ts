import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import type { Document } from 'linkedom';
import {
  CSSStyleRule,
  CSSGroupingRule,
  CSSMediaRule,
  CSSStartingStyleRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore - package.json omits "type": "module", causing nodenext to infer CJS
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule) {
      result.push(...collectAllRules(rule.cssRules));
    }
  }
  return result;
}

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  return collectAllRules(rules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
}

function ruleHasDiscreteDisplayAndOverlayTransition(rule: CSSStyleRule): boolean {
  const transition = rule.style.getPropertyValue('transition');
  const transitionProp = rule.style.getPropertyValue('transition-property');
  const transitionBehavior = rule.style.getPropertyValue('transition-behavior');
  const combinedProps = `${transition} ${transitionProp}`;

  const hasDisplay = /\b(display|all)\b/.test(combinedProps);
  const hasOverlay = /\b(overlay|all)\b/.test(combinedProps);
  const hasAllowDiscrete =
    /\ballow-discrete\b/.test(transitionBehavior) || /\ballow-discrete\b/.test(transition);

  return hasDisplay && hasOverlay && hasAllowDiscrete;
}

function ruleHasAnimatedOpacityOrTransformTransition(rule: CSSStyleRule): boolean {
  const transition = rule.style.getPropertyValue('transition');
  const transitionProp = rule.style.getPropertyValue('transition-property');
  const transitionDuration = rule.style.getPropertyValue('transition-duration');
  const combinedProps = `${transition} ${transitionProp}`;

  const transitionsOpacityOrTransform = /\b(opacity|transform|all)\b/.test(combinedProps);
  if (!transitionsOpacityOrTransform) return false;

  if (/\bnone\b/.test(transitionProp) || /\bnone\b/.test(transition)) return false;
  if (/^0(s|ms)?$/.test(transitionDuration.trim())) return false;

  return true;
}

test.describe('hovercard Target Grader', () => {
  test('Trigger links use interestfor to open their associated popover on hover and focus', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasAssociatedInterestPopover = docs.some(({ document }) => {
      const triggers = Array.from(document.querySelectorAll('a[interestfor]'));
      return (
        triggers.length > 0 &&
        triggers.every((trigger) => {
          const targetId = trigger.getAttribute('interestfor')?.trim();
          if (!targetId) return false;
          const targetEl = document.getElementById(targetId);
          return Boolean(targetEl && targetEl.hasAttribute('popover'));
        })
      );
    });
    expect(hasAssociatedInterestPopover).toBe(true);
  });

  test('The popover uses position-area (or inset-area) to position itself relative to the trigger link', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const hasPositionArea = styleRules.some((rule) => {
      const posArea =
        rule.style.getPropertyValue('position-area').trim() ||
        rule.style.getPropertyValue('inset-area').trim();
      return posArea.length > 0 && posArea !== 'none';
    });
    expect(hasPositionArea).toBe(true);
  });

  test('The popover has a transition that includes display: allow-discrete and overlay: allow-discrete', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const hasDiscreteTransition = styleRules.some((rule) =>
      ruleHasDiscreteDisplayAndOverlayTransition(rule),
    );
    expect(hasDiscreteTransition).toBe(true);
  });

  test('The popover has a @starting-style block that defines its initial state for entry animations', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);
    const startingStyleRules = allRules.filter(
      (r): r is CSSStartingStyleRule => r instanceof CSSStartingStyleRule,
    );
    const hasStartingStyleState = startingStyleRules.some((startingRule) => {
      const innerStyleRules = collectStyleRules(startingRule.cssRules);
      return innerStyleRules.some(
        (rule) =>
          rule.style.getPropertyValue('opacity').trim().length > 0 ||
          rule.style.getPropertyValue('transform').trim().length > 0 ||
          rule.style.getPropertyValue('scale').trim().length > 0 ||
          rule.style.getPropertyValue('translate').trim().length > 0,
      );
    });
    expect(hasStartingStyleState).toBe(true);
  });

  test('If prefers-reduced-motion: reduce is active, the popover opens without a transform or opacity transition', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);
    const mediaRules = allRules.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule);

    const gatedByNoPreference = mediaRules.some(
      (media) =>
        /\bprefers-reduced-motion\s*:\s*no-preference\b/i.test(media.conditionText) &&
        collectStyleRules(media.cssRules).some((rule) =>
          ruleHasAnimatedOpacityOrTransformTransition(rule),
        ),
    );

    const disabledInReduce = mediaRules.some(
      (media) =>
        /\bprefers-reduced-motion\s*:\s*reduce\b/i.test(media.conditionText) &&
        collectStyleRules(media.cssRules).some((rule) => {
          const transition = rule.style.getPropertyValue('transition');
          const transitionProp = rule.style.getPropertyValue('transition-property');
          const transitionDuration = rule.style.getPropertyValue('transition-duration');
          return (
            /\bnone\b/.test(transition) ||
            /\bnone\b/.test(transitionProp) ||
            /^0(s|ms)?$/.test(transitionDuration.trim())
          );
        }),
    );

    expect(gatedByNoPreference || disabledInReduce).toBe(true);
  });
});
