import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSRule,
  CSSStyleRule,
  CSSMediaRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  type CSSGroupingRule,
} from 'cssomnom';

// @ts-ignore - package.json lacks "type": "module" in daily-grind, causing tsc module nodenext to flag import.meta
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...getAllRules((rule as CSSGroupingRule).cssRules));
    }
  }
  return result;
}

function getKeyframesRules(allRules: CSSRule[]): CSSKeyframesRule[] {
  return allRules.filter(
    (r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule || r.type === CSSRule.KEYFRAMES_RULE
  );
}

function getMatchingKeyframes(rules: CSSStyleRule[], allKeyframes: CSSKeyframesRule[]): CSSKeyframesRule[] {
  return allKeyframes.filter((kf) =>
    rules.some((r) => {
      const animName = r.style.getPropertyValue('animation-name');
      const anim = r.style.getPropertyValue('animation');
      return (
        animName === kf.name ||
        anim.includes(kf.name) ||
        new RegExp(`\\b${kf.name}\\b`).test(r.style.cssText)
      );
    })
  );
}

function translatesToMinus100X(style: { getPropertyValue: (p: string) => string; cssText: string }): boolean {
  const transform = style.getPropertyValue('transform');
  const translate = style.getPropertyValue('translate');
  const css = style.cssText;
  const combined = [transform, translate, css].join(' ');
  return (
    /translateX\(\s*-100%\s*\)/i.test(combined) ||
    /translate\(\s*-100%\s*(?:,\s*[^)]+)?\)/i.test(combined) ||
    /translate3d\(\s*-100%\s*,\s*[^)]+\)/i.test(combined) ||
    /\btranslate:\s*-100%/i.test(combined)
  );
}

function translatesToPlus100X(style: { getPropertyValue: (p: string) => string; cssText: string }): boolean {
  const transform = style.getPropertyValue('transform');
  const translate = style.getPropertyValue('translate');
  const css = style.cssText;
  const combined = [transform, translate, css].join(' ');
  return (
    /translateX\(\s*(?:\+)?100%\s*\)/i.test(combined) ||
    /translate\(\s*(?:\+)?100%\s*(?:,\s*[^)]+)?\)/i.test(combined) ||
    /translate3d\(\s*(?:\+)?100%\s*,\s*[^)]+\)/i.test(combined) ||
    /\btranslate:\s*(?:\+)?100%/i.test(combined)
  ) && !combined.includes('-100%');
}

test.describe('directional-navigation-transitions Target Grader', () => {

  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & CSS RULES) ---

  test('During a forward transition, the ::view-transition-old(root) element has an animation that translates it to -100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const forwardOldRules = allRules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        /active-view-transition-type\(\s*['"]?forward['"]?\s*\)/.test(r.selectorText) &&
        r.selectorText.includes('::view-transition-old')
    );
    expect(forwardOldRules.length).toBeGreaterThan(0);

    const keyframes = getMatchingKeyframes(forwardOldRules, getKeyframesRules(allRules));
    expect(keyframes.length).toBeGreaterThan(0);

    const hasTranslateMinus100 = keyframes.some((kf) => {
      const endingKeyframes = Array.from(kf.cssRules).filter(
        (kr): kr is CSSKeyframeRule =>
          kr instanceof CSSKeyframeRule && /^(to|100\s*%)$/i.test(kr.keyText.trim())
      );
      return endingKeyframes.some((kr) => translatesToMinus100X(kr.style));
    });
    expect(hasTranslateMinus100).toBe(true);
  });

  test('During a forward transition, the ::view-transition-new(root) element has an animation that translates it from 100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const forwardNewRules = allRules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        /active-view-transition-type\(\s*['"]?forward['"]?\s*\)/.test(r.selectorText) &&
        r.selectorText.includes('::view-transition-new')
    );
    expect(forwardNewRules.length).toBeGreaterThan(0);

    const keyframes = getMatchingKeyframes(forwardNewRules, getKeyframesRules(allRules));
    expect(keyframes.length).toBeGreaterThan(0);

    const hasTranslate100 = keyframes.some((kf) => {
      const startingKeyframes = Array.from(kf.cssRules).filter(
        (kr): kr is CSSKeyframeRule =>
          kr instanceof CSSKeyframeRule && /^(from|0\s*%)$/i.test(kr.keyText.trim())
      );
      return startingKeyframes.some((kr) => translatesToPlus100X(kr.style));
    });
    expect(hasTranslate100).toBe(true);
  });

  test('During a backward transition, the ::view-transition-old(root) element has an animation that translates it to 100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const backwardOldRules = allRules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        /active-view-transition-type\(\s*['"]?backward['"]?\s*\)/.test(r.selectorText) &&
        r.selectorText.includes('::view-transition-old')
    );
    expect(backwardOldRules.length).toBeGreaterThan(0);

    const keyframes = getMatchingKeyframes(backwardOldRules, getKeyframesRules(allRules));
    expect(keyframes.length).toBeGreaterThan(0);

    const hasTranslate100 = keyframes.some((kf) => {
      const endingKeyframes = Array.from(kf.cssRules).filter(
        (kr): kr is CSSKeyframeRule =>
          kr instanceof CSSKeyframeRule && /^(to|100\s*%)$/i.test(kr.keyText.trim())
      );
      return endingKeyframes.some((kr) => translatesToPlus100X(kr.style));
    });
    expect(hasTranslate100).toBe(true);
  });

  test('During a backward transition, the ::view-transition-new(root) element has an animation that translates it from -100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const backwardNewRules = allRules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        /active-view-transition-type\(\s*['"]?backward['"]?\s*\)/.test(r.selectorText) &&
        r.selectorText.includes('::view-transition-new')
    );
    expect(backwardNewRules.length).toBeGreaterThan(0);

    const keyframes = getMatchingKeyframes(backwardNewRules, getKeyframesRules(allRules));
    expect(keyframes.length).toBeGreaterThan(0);

    const hasTranslateMinus100 = keyframes.some((kf) => {
      const startingKeyframes = Array.from(kf.cssRules).filter(
        (kr): kr is CSSKeyframeRule =>
          kr instanceof CSSKeyframeRule && /^(from|0\s*%)$/i.test(kr.keyText.trim())
      );
      return startingKeyframes.some((kr) => translatesToMinus100X(kr.style));
    });
    expect(hasTranslateMinus100).toBe(true);
  });

  test('The animations use the transform or translate property, and do not use left, right, inset-inline-start or inset-inline-end', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const keyframeRules = getKeyframesRules(allRules);

    expect(keyframeRules.length).toBeGreaterThan(0);

    const usesTransformOrTranslate = keyframeRules.some((kf) =>
      Array.from(kf.cssRules).some((kr) => {
        if (!(kr instanceof CSSKeyframeRule)) return false;
        const transform = kr.style.getPropertyValue('transform');
        const translate = kr.style.getPropertyValue('translate');
        return Boolean(transform || translate);
      })
    );
    expect(usesTransformOrTranslate).toBe(true);

    const forbiddenProps = ['left', 'right', 'inset-inline-start', 'inset-inline-end'];
    const usesForbiddenInsets = keyframeRules.some((kf) =>
      Array.from(kf.cssRules).some((kr) => {
        if (!(kr instanceof CSSKeyframeRule)) return false;
        return forbiddenProps.some((prop) => Boolean(kr.style.getPropertyValue(prop)));
      })
    );
    expect(usesForbiddenInsets).toBe(false);
  });

  test('The ::view-transition-group(root) element has an animation duration between 0.2 and 0.6 seconds', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const groupRules = allRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.includes('::view-transition-group')
    );
    expect(groupRules.length).toBeGreaterThan(0);

    const durationsInSeconds: number[] = [];
    for (const rule of groupRules) {
      const durationProp = rule.style.getPropertyValue('animation-duration');
      const animProp = rule.style.getPropertyValue('animation');
      const css = rule.style.cssText;

      for (const str of [durationProp, animProp, css].filter(Boolean)) {
        const matches = str.matchAll(/(\d+(?:\.\d+)?)\s*(s|ms)\b/g);
        for (const match of matches) {
          const val = parseFloat(match[1]);
          const unit = match[2];
          durationsInSeconds.push(unit === 'ms' ? val / 1000 : val);
        }
      }
    }

    expect(durationsInSeconds.length).toBeGreaterThan(0);
    const hasValidDuration = durationsInSeconds.some((d) => d >= 0.2 && d <= 0.6);
    expect(hasValidDuration).toBe(true);
  });

  test('The ::view-transition-group(root) element uses a non-linear timing function (e.g. an ease keyword or cubic-bezier()), not linear', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const groupRules = allRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.includes('::view-transition-group')
    );
    expect(groupRules.length).toBeGreaterThan(0);

    const timingStrings: string[] = [];
    for (const rule of groupRules) {
      const timingProp = rule.style.getPropertyValue('animation-timing-function');
      const animProp = rule.style.getPropertyValue('animation');
      const css = rule.style.cssText;
      for (const str of [timingProp, animProp, css].filter(Boolean)) {
        timingStrings.push(str);
      }
    }

    expect(timingStrings.length).toBeGreaterThan(0);
    const nonLinearRegex = /\bease(?:-in|-out|-in-out)?\b|\bcubic-bezier\s*\(|\blinear\s*\(/i;
    const hasNonLinear = timingStrings.some((s) => nonLinearRegex.test(s));
    expect(hasNonLinear).toBe(true);

    const hasExplicitLinear = timingStrings.some((s) => /\blinear\b(?!\s*\()/i.test(s));
    expect(hasExplicitLinear).toBe(false);
  });

  test('All view transition animations are disabled when prefers-reduced-motion is set to reduce', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);

    const reducedMotionMediaRules = allRules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule &&
        r.conditionText.includes('prefers-reduced-motion') &&
        r.conditionText.includes('reduce')
    );
    expect(reducedMotionMediaRules.length).toBeGreaterThan(0);

    const vtRulesInReducedMotion = reducedMotionMediaRules.flatMap((m) =>
      Array.from(m.cssRules).filter(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.includes('view-transition')
      )
    );
    expect(vtRulesInReducedMotion.length).toBeGreaterThan(0);

    const allDisabled = vtRulesInReducedMotion.every((r) => {
      const anim = r.style.getPropertyValue('animation');
      const animName = r.style.getPropertyValue('animation-name');
      const animDuration = r.style.getPropertyValue('animation-duration');
      const css = r.style.cssText;
      return (
        anim === 'none' ||
        animName === 'none' ||
        (animDuration.trim() !== '' &&
          parseFloat(animDuration) / (animDuration.trim().endsWith('ms') ? 1000 : 1) <= 0.01) ||
        /\banimation\s*:\s*none\b/.test(css) ||
        /\banimation-name\s*:\s*none\b/.test(css)
      );
    });
    expect(allDisabled).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        // Ensure ViewTransition prototype has 'types' support for feature detection
        if (typeof (window as any).ViewTransition === 'undefined') {
          (window as any).ViewTransition = class ViewTransition {
            types = new Set<string>();
            finished = Promise.resolve();
            ready = Promise.resolve();
            updateCallbackDone = Promise.resolve();
            skipTransition() {}
          };
        } else if (!('types' in (window as any).ViewTransition.prototype)) {
          Object.defineProperty((window as any).ViewTransition.prototype, 'types', {
            get() {
              return this._types || (this._types = new Set());
            },
            set(val) {
              this._types = val;
            },
            configurable: true,
          });
        }

        // Ensure CSS.supports for :active-view-transition-type returns true for feature detection
        if (typeof CSS !== 'undefined' && CSS.supports) {
          const origSupports = CSS.supports.bind(CSS);
          CSS.supports = function (...args: any[]) {
            const query = args.length === 1 ? args[0] : `(${args[0]}: ${args[1]})`;
            if (typeof query === 'string' && query.includes(':active-view-transition-type')) {
              return true;
            }
            return origSupports.apply(CSS, args as any);
          };
        }

        // Instrument document.startViewTransition to track transitions and types
        (window as any).__viewTransitions = [];
        const originalStartViewTransition = document.startViewTransition
          ? document.startViewTransition.bind(document)
          : null;

        document.startViewTransition = function (param: any) {
          const record: {
            types: string[];
            activeMatchesForward: boolean;
            activeMatchesBackward: boolean;
          } = {
            types: [],
            activeMatchesForward: false,
            activeMatchesBackward: false,
          };

          let updateCallback: (() => any) | undefined;
          if (typeof param === 'function') {
            updateCallback = param;
          } else if (param && typeof param === 'object') {
            updateCallback = param.update;
            if (Array.isArray(param.types)) {
              record.types = [...param.types];
            } else if (param.types && typeof param.types[Symbol.iterator] === 'function') {
              record.types = Array.from(param.types);
            }
          }

          const wrappedUpdate = async () => {
            try {
              record.activeMatchesForward = document.documentElement.matches(':active-view-transition-type(forward)');
            } catch {
              // Browser may not support pseudo-class selector query
            }
            try {
              record.activeMatchesBackward = document.documentElement.matches(':active-view-transition-type(backward)');
            } catch {
              // Browser may not support pseudo-class selector query
            }

            if (record.types.includes('forward')) {
              record.activeMatchesForward = true;
            }
            if (record.types.includes('backward')) {
              record.activeMatchesBackward = true;
            }

            if (updateCallback) {
              return await updateCallback();
            }
          };

          (window as any).__viewTransitions.push(record);

          let transition: any;
          if (originalStartViewTransition) {
            if (typeof param === 'function') {
              transition = originalStartViewTransition(wrappedUpdate);
            } else if (param && typeof param === 'object') {
              transition = originalStartViewTransition({ ...param, update: wrappedUpdate });
            } else {
              transition = originalStartViewTransition(param);
            }
          } else {
            const res = wrappedUpdate();
            transition = {
              finished: Promise.resolve(res),
              ready: Promise.resolve(),
              updateCallbackDone: Promise.resolve(res),
              skipTransition: () => {},
              types: new Set(record.types),
            };
          }

          // Intercept transition.types.add if called after startViewTransition
          if (transition && transition.types && typeof transition.types.add === 'function') {
            const origAdd = transition.types.add.bind(transition.types);
            transition.types.add = function (t: string) {
              if (!record.types.includes(t)) {
                record.types.push(t);
              }
              if (t === 'forward') record.activeMatchesForward = true;
              if (t === 'backward') record.activeMatchesBackward = true;
              return origAdd(t);
            };
          }

          return transition;
        };
      });

      await page.goto(TARGET_URL);
    });

    test('Clicking the "Next" button triggers a view transition', async ({ page }) => {
      const nextBtn = page.getByRole('button', { name: /next/i });
      await expect(nextBtn).toBeVisible({ timeout: 3000 });

      await nextBtn.click();

      await page.waitForFunction(
        () => ((window as any).__viewTransitions?.length ?? 0) > 0,
        null,
        { timeout: 3000 }
      );
      const count = await page.evaluate(() => (window as any).__viewTransitions?.length ?? 0);
      expect(count).toBeGreaterThan(0);
    });

    test('Clicking the "Previous" button triggers a view transition', async ({ page }) => {
      const nextBtn = page.getByRole('button', { name: /next/i });
      await expect(nextBtn).toBeVisible({ timeout: 3000 });
      await nextBtn.click();

      const prevBtn = page.getByRole('button', { name: /prev/i });
      await expect(prevBtn).toBeVisible({ timeout: 3000 });
      await expect(prevBtn).toBeEnabled({ timeout: 3000 });

      const countBefore = await page.evaluate(() => (window as any).__viewTransitions?.length ?? 0);
      await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'), null, { timeout: 3000 });
      await prevBtn.click();

      await page.waitForFunction(
        (prev) => ((window as any).__viewTransitions?.length ?? 0) > prev,
        countBefore,
        { timeout: 3000 }
      );
      const countAfter = await page.evaluate(() => (window as any).__viewTransitions?.length ?? 0);
      expect(countAfter).toBeGreaterThan(countBefore);
    });

    test('During the "Next" transition, the forward transition type is active on the document element', async ({ page }) => {
      const nextBtn = page.getByRole('button', { name: /next/i });
      await expect(nextBtn).toBeVisible({ timeout: 3000 });

      await nextBtn.click();

      await page.waitForFunction(
        () => ((window as any).__viewTransitions?.length ?? 0) > 0,
        null,
        { timeout: 3000 }
      );
      const lastTransition = await page.evaluate(() => {
        const list = (window as any).__viewTransitions;
        return list && list.length > 0 ? list[list.length - 1] : null;
      });

      expect(lastTransition).not.toBeNull();
      const isForwardActive =
        lastTransition.types?.includes('forward') || Boolean(lastTransition.activeMatchesForward);
      expect(isForwardActive).toBe(true);
    });

    test('During the "Previous" transition, the backward transition type is active on the document element', async ({ page }) => {
      const nextBtn = page.getByRole('button', { name: /next/i });
      await expect(nextBtn).toBeVisible({ timeout: 3000 });
      await nextBtn.click();

      const prevBtn = page.getByRole('button', { name: /prev/i });
      await expect(prevBtn).toBeVisible({ timeout: 3000 });
      await expect(prevBtn).toBeEnabled({ timeout: 3000 });

      const countBefore = await page.evaluate(() => (window as any).__viewTransitions?.length ?? 0);
      await prevBtn.click();

      await page.waitForFunction(
        (prev) => ((window as any).__viewTransitions?.length ?? 0) > prev,
        countBefore,
        { timeout: 3000 }
      );
      const lastTransition = await page.evaluate(() => {
        const list = (window as any).__viewTransitions;
        return list && list.length > 0 ? list[list.length - 1] : null;
      });

      expect(lastTransition).not.toBeNull();
      const isBackwardActive =
        lastTransition.types?.includes('backward') || Boolean(lastTransition.activeMatchesBackward);
      expect(isBackwardActive).toBe(true);
    });

  });
});
