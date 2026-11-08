import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSMediaRule,
  type CSSRule,
  type CSSStyleDeclaration,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllRules(ruleList: any): CSSRule[] {
  const result: CSSRule[] = [];
  const rules: CSSRule[] = Array.from(ruleList || []);
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && (rule as any).cssRules) {
      result.push(...getAllRules((rule as any).cssRules));
    }
  }
  return result;
}

function getKeyframeRules(rules: CSSRule[]): CSSKeyframesRule[] {
  return rules.filter((r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule);
}

function getAnimationNames(rule: CSSStyleRule, keyframes: CSSKeyframesRule[]): string[] {
  const names: string[] = [];
  const animName = rule.style.getPropertyValue('animation-name');
  if (animName && animName !== 'none') {
    for (const part of animName.split(',')) {
      const trimmed = part.trim();
      if (trimmed) names.push(trimmed);
    }
  }
  const animShorthand = rule.style.getPropertyValue('animation');
  if (animShorthand && animShorthand !== 'none') {
    for (const kf of keyframes) {
      const regex = new RegExp(`\\b${kf.name}\\b`);
      if (regex.test(animShorthand) && !names.includes(kf.name)) {
        names.push(kf.name);
      }
    }
  }
  return names;
}

function getXTranslationFromStyle(style: CSSStyleDeclaration): string | null {
  const transform = style.getPropertyValue('transform');
  if (transform) {
    const match = transform.match(/translate(?:x|3d)?\(\s*(-?\d+(?:\.\d+)?%)/i);
    if (match) return match[1];
  }
  const translate = style.getPropertyValue('translate');
  if (translate) {
    const match = translate.match(/^(-?\d+(?:\.\d+)?%)/);
    if (match) return match[1];
  }
  return null;
}

function getKeyframeTranslation(kf: CSSKeyframesRule, targetStep: 'to' | 'from'): string | null {
  const steps: CSSKeyframeRule[] = Array.from(kf.cssRules as any);
  for (const step of steps) {
    const stepText = step.keyText.trim().toLowerCase();
    const isMatch =
      targetStep === 'to'
        ? stepText === 'to' || stepText === '100%'
        : stepText === 'from' || stepText === '0%';
    if (isMatch) {
      const x = getXTranslationFromStyle(step.style);
      if (x !== null) return x;
    }
  }
  return null;
}

function parseDurationSeconds(val: string): number | null {
  const match = val.match(/(\d+(?:\.\d+)?)\s*(s|ms)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return match[2].toLowerCase() === 'ms' ? num / 1000 : num;
}

test.describe('Directional Navigation Transitions Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('During a forward transition, the ::view-transition-old(root) element has an animation that translates it to -100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet.cssRules);
    const keyframes = getKeyframeRules(rules);

    const forwardOldRules = rules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        /:active-view-transition-type\(\s*forward\s*\).*::view-transition-old/i.test(r.selectorText)
    );

    expect(forwardOldRules.length).toBeGreaterThan(0);

    let translationX: string | null = null;
    for (const rule of forwardOldRules) {
      const animNames = getAnimationNames(rule, keyframes);
      for (const name of animNames) {
        const kf = keyframes.find((k) => k.name === name);
        if (kf) {
          const trans = getKeyframeTranslation(kf, 'to');
          if (trans !== null) {
            translationX = trans;
            break;
          }
        }
      }
      if (translationX !== null) break;
    }

    expect(translationX).toBe('-100%');
  });

  test('During a forward transition, the ::view-transition-new(root) element has an animation that translates it from 100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet.cssRules);
    const keyframes = getKeyframeRules(rules);

    const forwardNewRules = rules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        /:active-view-transition-type\(\s*forward\s*\).*::view-transition-new/i.test(r.selectorText)
    );

    expect(forwardNewRules.length).toBeGreaterThan(0);

    let translationX: string | null = null;
    for (const rule of forwardNewRules) {
      const animNames = getAnimationNames(rule, keyframes);
      for (const name of animNames) {
        const kf = keyframes.find((k) => k.name === name);
        if (kf) {
          const trans = getKeyframeTranslation(kf, 'from');
          if (trans !== null) {
            translationX = trans;
            break;
          }
        }
      }
      if (translationX !== null) break;
    }

    expect(translationX).toMatch(/^\+?100%$/);
  });

  test('During a backward transition, the ::view-transition-old(root) element has an animation that translates it to 100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet.cssRules);
    const keyframes = getKeyframeRules(rules);

    const backwardOldRules = rules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        /:active-view-transition-type\(\s*backward\s*\).*::view-transition-old/i.test(r.selectorText)
    );

    expect(backwardOldRules.length).toBeGreaterThan(0);

    let translationX: string | null = null;
    for (const rule of backwardOldRules) {
      const animNames = getAnimationNames(rule, keyframes);
      for (const name of animNames) {
        const kf = keyframes.find((k) => k.name === name);
        if (kf) {
          const trans = getKeyframeTranslation(kf, 'to');
          if (trans !== null) {
            translationX = trans;
            break;
          }
        }
      }
      if (translationX !== null) break;
    }

    expect(translationX).toMatch(/^\+?100%$/);
  });

  test('During a backward transition, the ::view-transition-new(root) element has an animation that translates it from -100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet.cssRules);
    const keyframes = getKeyframeRules(rules);

    const backwardNewRules = rules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        /:active-view-transition-type\(\s*backward\s*\).*::view-transition-new/i.test(r.selectorText)
    );

    expect(backwardNewRules.length).toBeGreaterThan(0);

    let translationX: string | null = null;
    for (const rule of backwardNewRules) {
      const animNames = getAnimationNames(rule, keyframes);
      for (const name of animNames) {
        const kf = keyframes.find((k) => k.name === name);
        if (kf) {
          const trans = getKeyframeTranslation(kf, 'from');
          if (trans !== null) {
            translationX = trans;
            break;
          }
        }
      }
      if (translationX !== null) break;
    }

    expect(translationX).toBe('-100%');
  });

  test('The animations use the transform or translate property, and do not use left, right, inset-inline-start or inset-inline-end', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet.cssRules);
    const keyframes = getKeyframeRules(rules);

    expect(keyframes.length).toBeGreaterThan(0);

    const usesTransformOrTranslate = keyframes.some((kf) => {
      const steps: CSSKeyframeRule[] = Array.from(kf.cssRules as any);
      return steps.some(
        (step) =>
          Boolean(step.style.getPropertyValue('transform')) ||
          Boolean(step.style.getPropertyValue('translate'))
      );
    });
    expect(usesTransformOrTranslate).toBe(true);

    const forbiddenProps = ['left', 'right', 'inset-inline-start', 'inset-inline-end'];
    const usesForbidden = keyframes.some((kf) => {
      const steps: CSSKeyframeRule[] = Array.from(kf.cssRules as any);
      return steps.some((step) =>
        forbiddenProps.some((prop) => Boolean(step.style.getPropertyValue(prop)))
      );
    });
    expect(usesForbidden).toBe(false);
  });

  test('The ::view-transition-group(root) element has an animation duration between 0.2 and 0.6 seconds', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet.cssRules);

    const groupRules = rules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule && /::view-transition-group/i.test(r.selectorText)
    );

    expect(groupRules.length).toBeGreaterThan(0);

    let duration: number | null = null;
    for (const rule of groupRules) {
      const durProp = rule.style.getPropertyValue('animation-duration');
      duration = parseDurationSeconds(durProp);
      if (duration === null) {
        const animProp = rule.style.getPropertyValue('animation');
        duration = parseDurationSeconds(animProp);
      }
      if (duration !== null) break;
    }

    expect(duration).not.toBeNull();
    expect(duration!).toBeGreaterThanOrEqual(0.2);
    expect(duration!).toBeLessThanOrEqual(0.6);
  });

  test('The ::view-transition-group(root) element uses a non-linear timing function (e.g. an ease keyword or cubic-bezier()), not linear', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet.cssRules);

    const groupRules = rules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule && /::view-transition-group/i.test(r.selectorText)
    );

    expect(groupRules.length).toBeGreaterThan(0);

    const NON_LINEAR_RE = /\bease(?:-in|-out|-in-out)?\b|\bcubic-bezier\s*\(|\blinear\s*\(/i;
    let isNonLinear = false;
    let isExplicitLinear = false;

    for (const rule of groupRules) {
      const tf = rule.style.getPropertyValue('animation-timing-function');
      const anim = rule.style.getPropertyValue('animation');
      const combined = [tf, anim].filter(Boolean).join(' ');
      if (NON_LINEAR_RE.test(combined)) {
        isNonLinear = true;
      }
      if (/\blinear\b(?!\s*\()/i.test(combined)) {
        isExplicitLinear = true;
      }
    }

    expect(isNonLinear).toBe(true);
    expect(isExplicitLinear).toBe(false);
  });

  test('All view transition animations are disabled when prefers-reduced-motion is set to reduce', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet.cssRules);

    const mediaRules = rules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule && /prefers-reduced-motion\s*:\s*reduce/i.test(r.conditionText)
    );

    expect(mediaRules.length).toBeGreaterThan(0);

    const vtRulesInMedia = mediaRules.flatMap((m) => {
      const childRules: CSSRule[] = Array.from(m.cssRules as any);
      return childRules.filter(
        (r): r is CSSStyleRule =>
          r instanceof CSSStyleRule && /::view-transition/i.test(r.selectorText)
      );
    });

    expect(vtRulesInMedia.length).toBeGreaterThan(0);

    const allDisabled = vtRulesInMedia.every((rule) => {
      const anim = rule.style.getPropertyValue('animation').trim();
      const animName = rule.style.getPropertyValue('animation-name').trim();
      const animDuration = rule.style.getPropertyValue('animation-duration').trim();
      return anim === 'none' || animName === 'none' || animDuration === '0s' || animDuration === '0';
    });

    expect(allDisabled).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        (window as any).__vtEvents = [];

        if (typeof CSS !== 'undefined' && CSS.supports) {
          const origSupports = CSS.supports;
          CSS.supports = function (...args: any[]) {
            if (typeof args[0] === 'string' && args[0].includes('active-view-transition-type')) {
              return true;
            }
            return origSupports.apply(this, args as any);
          };
        }

        const orig = Document.prototype.startViewTransition || document.startViewTransition;

        const wrapper = function (this: Document, callbackOrOptions: any) {
          let types: string[] = [];
          let updateFn: (() => void | Promise<void>) | undefined;

          if (typeof callbackOrOptions === 'function') {
            updateFn = callbackOrOptions;
          } else if (callbackOrOptions && typeof callbackOrOptions === 'object') {
            updateFn = callbackOrOptions.update;
            if (Array.isArray(callbackOrOptions.types)) {
              types = [...callbackOrOptions.types];
            }
          }

          const eventRecord: {
            types: string[];
            activeTypesDuringTransition: string[];
          } = {
            types: [...types],
            activeTypesDuringTransition: [],
          };
          (window as any).__vtEvents.push(eventRecord);

          let transition: any;
          if (orig) {
            try {
              transition = orig.call(this, callbackOrOptions);
            } catch {
              if (updateFn) updateFn();
            }
          } else {
            if (updateFn) {
              try {
                const res = updateFn();
                if (res && typeof res.then === 'function') {
                  res.catch(() => {});
                }
              } catch {}
            }
            transition = {
              types: new Set(types),
              ready: Promise.resolve(),
              updateCallbackDone: Promise.resolve(),
              finished: Promise.resolve(),
              skipTransition: () => {},
            };
          }

          if (transition && transition.types && typeof transition.types.forEach === 'function') {
            transition.types.forEach((t: string) => {
              if (!eventRecord.types.includes(t)) {
                eventRecord.types.push(t);
              }
            });
          }

          const recordActiveTypes = () => {
            try {
              if (document.documentElement.matches(':active-view-transition-type(forward)')) {
                if (!eventRecord.activeTypesDuringTransition.includes('forward')) {
                  eventRecord.activeTypesDuringTransition.push('forward');
                }
              }
              if (document.documentElement.matches(':active-view-transition-type(backward)')) {
                if (!eventRecord.activeTypesDuringTransition.includes('backward')) {
                  eventRecord.activeTypesDuringTransition.push('backward');
                }
              }
            } catch {}
          };

          recordActiveTypes();
          if (transition && transition.ready && typeof transition.ready.then === 'function') {
            transition.ready.then(recordActiveTypes).catch(() => {});
          }

          return transition;
        };

        Document.prototype.startViewTransition = wrapper;
        document.startViewTransition = wrapper;
      });

      await page.goto(TARGET_URL);
    });

    test('Clicking the "Next" button triggers a view transition', async ({ page }) => {
      const nextButton = page
        .locator('button, [role="button"]')
        .filter({ hasText: /next/i })
        .or(page.getByRole('button', { name: /next/i }))
        .or(page.locator('#next, [data-next], [data-carousel-next], [aria-label*="next" i]'))
        .first();

      await expect(nextButton).toBeVisible();
      await nextButton.click();

      await page.waitForFunction(() => ((window as any).__vtEvents?.length ?? 0) > 0);
      const count = await page.evaluate(() => (window as any).__vtEvents?.length ?? 0);
      expect(count).toBeGreaterThan(0);
    });

    test('Clicking the "Previous" button triggers a view transition', async ({ page }) => {
      const nextButton = page
        .locator('button, [role="button"]')
        .filter({ hasText: /next/i })
        .or(page.getByRole('button', { name: /next/i }))
        .or(page.locator('#next, [data-next], [data-carousel-next], [aria-label*="next" i]'))
        .first();
      const prevButton = page
        .locator('button, [role="button"]')
        .filter({ hasText: /prev(ious)?/i })
        .or(page.getByRole('button', { name: /prev(ious)?/i }))
        .or(
          page.locator('#prev, #previous, [data-previous], [data-carousel-prev], [aria-label*="prev" i]')
        )
        .first();

      await expect(prevButton).toBeVisible();
      if (await prevButton.isDisabled()) {
        await nextButton.click();
        await page.evaluate(() => {
          (window as any).__vtEvents = [];
        });
      }
      await prevButton.click();

      await page.waitForFunction(() => ((window as any).__vtEvents?.length ?? 0) > 0);
      const count = await page.evaluate(() => (window as any).__vtEvents?.length ?? 0);
      expect(count).toBeGreaterThan(0);
    });

    test('During the "Next" transition, the forward transition type is active on the document element', async ({
      page,
    }) => {
      const nextButton = page
        .locator('button, [role="button"]')
        .filter({ hasText: /next/i })
        .or(page.getByRole('button', { name: /next/i }))
        .or(page.locator('#next, [data-next], [data-carousel-next], [aria-label*="next" i]'))
        .first();

      await expect(nextButton).toBeVisible();
      await nextButton.click();

      await page.waitForFunction(() => ((window as any).__vtEvents?.length ?? 0) > 0);
      const hasForward = await page.evaluate(() => {
        const events = (window as any).__vtEvents || [];
        return events.some(
          (e: any) =>
            e.types.includes('forward') || e.activeTypesDuringTransition.includes('forward')
        );
      });
      expect(hasForward).toBe(true);
    });

    test('During the "Previous" transition, the backward transition type is active on the document element', async ({
      page,
    }) => {
      const nextButton = page
        .locator('button, [role="button"]')
        .filter({ hasText: /next/i })
        .or(page.getByRole('button', { name: /next/i }))
        .or(page.locator('#next, [data-next], [data-carousel-next], [aria-label*="next" i]'))
        .first();
      const prevButton = page
        .locator('button, [role="button"]')
        .filter({ hasText: /prev(ious)?/i })
        .or(page.getByRole('button', { name: /prev(ious)?/i }))
        .or(
          page.locator('#prev, #previous, [data-previous], [data-carousel-prev], [aria-label*="prev" i]')
        )
        .first();

      await expect(prevButton).toBeVisible();
      if (await prevButton.isDisabled()) {
        await nextButton.click();
        await page.evaluate(() => {
          (window as any).__vtEvents = [];
        });
      }
      await prevButton.click();

      await page.waitForFunction(() => ((window as any).__vtEvents?.length ?? 0) > 0);
      const hasBackward = await page.evaluate(() => {
        const events = (window as any).__vtEvents || [];
        return events.some(
          (e: any) =>
            e.types.includes('backward') || e.activeTypesDuringTransition.includes('backward')
        );
      });
      expect(hasBackward).toBe(true);
    });
  });
});
