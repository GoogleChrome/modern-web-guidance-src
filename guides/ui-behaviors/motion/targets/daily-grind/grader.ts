import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSMediaRule, CSSStyleRule } from 'cssomnom';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

// Expectation 1: SKIPPED - The base application does not contain discrete entry/exit elements such as <dialog> or [popover].
// Expectation 2: TESTED - The base application contains transitions on navigation links and buttons that must honor prefers-reduced-motion.

const testFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(path.resolve('grader.ts')).href;

const targetFiles: string[] = getTargetFiles(testFileUrl);

test.describe('Motion Target Grader - Daily Grind', () => {
  test('Defines a prefers-reduced-motion media query to honor user motion preferences', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const mediaRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSMediaRule => r instanceof CSSMediaRule && r.conditionText.includes('prefers-reduced-motion')
    );

    const docs = getHtmlDocuments(targetFiles);
    const hasUtilityMediaQuery = docs.some((d) =>
      Boolean(d.document.querySelector('[class*="motion-reduce:"]'))
    );

    expect(mediaRules.length > 0 || hasUtilityMediaQuery).toBe(true);
  });

  test('Dampens or disables transitions or animations in prefers-reduced-motion query without blanket 0.01ms override', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const mediaRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSMediaRule => r instanceof CSSMediaRule && r.conditionText.includes('prefers-reduced-motion')
    );

    const innerRules = mediaRules.flatMap((m) =>
      Array.from(m.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
    );

    const hasBlanketOverride = innerRules.some((r) => {
      const duration = r.style.getPropertyValue('animation-duration');
      const transitionDuration = r.style.getPropertyValue('transition-duration');
      const animation = r.style.getPropertyValue('animation');
      const transition = r.style.getPropertyValue('transition');
      return (
        duration.includes('0.01ms') ||
        transitionDuration.includes('0.01ms') ||
        animation.includes('0.01ms') ||
        transition.includes('0.01ms')
      );
    });

    const docs = getHtmlDocuments(targetFiles);
    const hasUtilityReducedMotion = docs.some((d) =>
      Boolean(d.document.querySelector('[class*="motion-reduce:"]'))
    );

    const hasDampenedMotion =
      innerRules.some((r) => {
        const transition = r.style.getPropertyValue('transition');
        const animation = r.style.getPropertyValue('animation');
        const transitionDuration = r.style.getPropertyValue('transition-duration');
        const animationDuration = r.style.getPropertyValue('animation-duration');
        return (
          /\b(none|0s|0ms)\b/.test(transition) ||
          /\b(none|0s|0ms)\b/.test(animation) ||
          /\b(0s|0ms|0)\b/.test(transitionDuration) ||
          /\b(0s|0ms|0)\b/.test(animationDuration) ||
          animation.includes('var(') ||
          transition.includes('var(')
        );
      }) || hasUtilityReducedMotion;

    expect(hasDampenedMotion && !hasBlanketOverride).toBe(true);
  });
});
