import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../test-fixture.ts';
import {
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSStyleRule,
  CSSMediaRule,
  type CSSRule,
} from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllRules(rules: CSSRule[]): CSSRule[] {
  const result: CSSRule[] = [];
  for (const r of rules) {
    result.push(r);
    if ('cssRules' in r && (r as any).cssRules) {
      result.push(...getAllRules(Array.from((r as any).cssRules)));
    }
  }
  return result;
}

function findAnimationForTransition(
  rules: CSSRule[],
  type: 'forward' | 'backward',
  pseudo: 'old' | 'new',
): CSSKeyframesRule | undefined {
  const allRules = getAllRules(rules);
  const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
  const keyframeRules = allRules.filter((r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule);

  const targetRule = styleRules.find((r) => {
    const sel = r.selectorText.toLowerCase();
    const hasType =
      sel.includes(`active-view-transition-type(${type})`) ||
      new RegExp(`active-view-transition-type\\s*\\(\\s*${type}\\s*\\)`).test(sel);
    const hasPseudo =
      sel.includes(`::view-transition-${pseudo}(root)`) ||
      sel.includes(`::view-transition-${pseudo}(*)`);
    return hasType && hasPseudo;
  });

  if (!targetRule) return undefined;

  const animName = targetRule.style.getPropertyValue('animation-name');
  if (animName && animName.trim()) {
    const matched = keyframeRules.find((k) => k.name === animName.trim());
    if (matched) return matched;
  }

  const anim = targetRule.style.getPropertyValue('animation');
  if (anim && anim.trim()) {
    const tokens = anim.split(/\s+/);
    for (const token of tokens) {
      const matched = keyframeRules.find((k) => k.name === token.trim());
      if (matched) return matched;
    }
  }

  return undefined;
}

function getKeyframeTransform(kf: CSSKeyframeRule): string {
  const transform = kf.style.getPropertyValue('transform');
  const translate = kf.style.getPropertyValue('translate');
  return `${transform} ${translate}`.toLowerCase().trim();
}

test.describe('directional-navigation-transitions Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('During a forward transition, the ::view-transition-old(root) element has an animation that translates it to -100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const kfRule = findAnimationForTransition(rules, 'forward', 'old');
    const toKf = kfRule
      ? Array.from(kfRule.cssRules).find(
          (kf): kf is CSSKeyframeRule =>
            kf instanceof CSSKeyframeRule && (kf.keyText === '100%' || kf.keyText === 'to'),
        )
      : undefined;
    const transformVal = toKf ? getKeyframeTransform(toKf) : '';
    const translatesToNeg100 =
      /(-100%|-100vw)/.test(transformVal) &&
      /(translatex|translate\s*\(\s*-100%|translate3d\s*\(\s*-100%|translate:\s*-100%)/.test(
        transformVal,
      );
    expect(translatesToNeg100).toBe(true);
  });

  test('During a forward transition, the ::view-transition-new(root) element has an animation that translates it from 100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const kfRule = findAnimationForTransition(rules, 'forward', 'new');
    const fromKf = kfRule
      ? Array.from(kfRule.cssRules).find(
          (kf): kf is CSSKeyframeRule =>
            kf instanceof CSSKeyframeRule && (kf.keyText === '0%' || kf.keyText === 'from'),
        )
      : undefined;
    const transformVal = fromKf ? getKeyframeTransform(fromKf) : '';
    const translatesFromPos100 =
      /(100%|100vw)/.test(transformVal) &&
      !transformVal.includes('-100%') &&
      /(translatex|translate\s*\(\s*100%|translate3d\s*\(\s*100%|translate:\s*100%)/.test(
        transformVal,
      );
    expect(translatesFromPos100).toBe(true);
  });

  test('During a backward transition, the ::view-transition-old(root) element has an animation that translates it to 100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const kfRule = findAnimationForTransition(rules, 'backward', 'old');
    const toKf = kfRule
      ? Array.from(kfRule.cssRules).find(
          (kf): kf is CSSKeyframeRule =>
            kf instanceof CSSKeyframeRule && (kf.keyText === '100%' || kf.keyText === 'to'),
        )
      : undefined;
    const transformVal = toKf ? getKeyframeTransform(toKf) : '';
    const translatesToPos100 =
      /(100%|100vw)/.test(transformVal) &&
      !transformVal.includes('-100%') &&
      /(translatex|translate\s*\(\s*100%|translate3d\s*\(\s*100%|translate:\s*100%)/.test(
        transformVal,
      );
    expect(translatesToPos100).toBe(true);
  });

  test('During a backward transition, the ::view-transition-new(root) element has an animation that translates it from -100% on the X-axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const kfRule = findAnimationForTransition(rules, 'backward', 'new');
    const fromKf = kfRule
      ? Array.from(kfRule.cssRules).find(
          (kf): kf is CSSKeyframeRule =>
            kf instanceof CSSKeyframeRule && (kf.keyText === '0%' || kf.keyText === 'from'),
        )
      : undefined;
    const transformVal = fromKf ? getKeyframeTransform(fromKf) : '';
    const translatesFromNeg100 =
      /(-100%|-100vw)/.test(transformVal) &&
      /(translatex|translate\s*\(\s*-100%|translate3d\s*\(\s*-100%|translate:\s*-100%)/.test(
        transformVal,
      );
    expect(translatesFromNeg100).toBe(true);
  });

  test('The animations use the transform or translate property, and do not use left, right, inset-inline-start or inset-inline-end', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(Array.from(stylesheet.cssRules));
    const keyframeRules = allRules.filter(
      (r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule,
    );

    const hasKeyframes = keyframeRules.length > 0;
    const hasTransformOrTranslate = keyframeRules.some((kfRule) => {
      const kfs = Array.from(kfRule.cssRules).filter(
        (r): r is CSSKeyframeRule => r instanceof CSSKeyframeRule,
      );
      return kfs.some(
        (kf) =>
          Boolean(kf.style.getPropertyValue('transform')) ||
          Boolean(kf.style.getPropertyValue('translate')),
      );
    });
    const usesDisallowedPositionProperties = keyframeRules.some((kfRule) => {
      const kfs = Array.from(kfRule.cssRules).filter(
        (r): r is CSSKeyframeRule => r instanceof CSSKeyframeRule,
      );
      return kfs.some((kf) => {
        const s = kf.style;
        return Boolean(
          s.getPropertyValue('left') ||
            s.getPropertyValue('right') ||
            s.getPropertyValue('inset-inline-start') ||
            s.getPropertyValue('inset-inline-end') ||
            s.getPropertyValue('inset'),
        );
      });
    });

    const isPerformant =
      hasKeyframes && hasTransformOrTranslate && !usesDisallowedPositionProperties;
    expect(isPerformant).toBe(true);
  });

  test('The ::view-transition-group(root) element has an animation duration of 0.4 seconds', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(Array.from(stylesheet.cssRules));
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const groupRule = styleRules.find((r) =>
      /::view-transition-group\s*\(\s*root\s*\)/i.test(r.selectorText),
    );
    const duration = groupRule?.style.getPropertyValue('animation-duration') || '';
    const anim = groupRule?.style.getPropertyValue('animation') || '';
    const has04sDuration =
      /(^|\s)(0?\.4s|400ms)($|\s)/i.test(duration) || /(^|\s)(0?\.4s|400ms)($|\s)/i.test(anim);
    expect(has04sDuration).toBe(true);
  });

  test('The ::view-transition-group(root) element uses an ease-in-out timing function', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(Array.from(stylesheet.cssRules));
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const groupRule = styleRules.find((r) =>
      /::view-transition-group\s*\(\s*root\s*\)/i.test(r.selectorText),
    );
    const timing = groupRule?.style.getPropertyValue('animation-timing-function') || '';
    const anim = groupRule?.style.getPropertyValue('animation') || '';
    const hasEaseInOut = /\bease-in-out\b/i.test(timing) || /\bease-in-out\b/i.test(anim);
    expect(hasEaseInOut).toBe(true);
  });

  test('All view transition animations are disabled when prefers-reduced-motion is set to reduce', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(Array.from(stylesheet.cssRules));
    const mediaRules = allRules.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule);
    const motionMedia = mediaRules.find((m) =>
      /prefers-reduced-motion\s*:\s*reduce/i.test(m.conditionText),
    );
    const innerRules = motionMedia
      ? getAllRules(Array.from(motionMedia.cssRules)).filter(
          (r): r is CSSStyleRule => r instanceof CSSStyleRule,
        )
      : [];
    const disablesTransitions = innerRules.some((r) => {
      const sel = r.selectorText.toLowerCase();
      const isVt = sel.includes('::view-transition') || sel === '*' || sel.includes('*');
      if (!isVt) return false;
      const anim = r.style.getPropertyValue('animation');
      const name = r.style.getPropertyValue('animation-name');
      const dur = r.style.getPropertyValue('animation-duration');
      return (
        /\bnone\b/i.test(anim) ||
        /\bnone\b/i.test(name) ||
        /(^|\s)(0s|0ms|0\.01ms)($|\s)/i.test(dur)
      );
    });
    expect(disablesTransitions).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        (window as any).__transitions = [];
        const orig = document.startViewTransition
          ? document.startViewTransition.bind(document)
          : null;
        document.startViewTransition = function (opts: any) {
          (window as any).__transitions.push(opts);
          if (orig) {
            try {
              return orig(opts);
            } catch {
              // fallback
            }
          }
          if (typeof opts === 'function') {
            opts();
          } else if (opts && typeof opts.update === 'function') {
            opts.update();
          }
          return {
            finished: Promise.resolve(),
            ready: Promise.resolve(),
            updateCallbackDone: Promise.resolve(),
            skipTransition: () => {},
          };
        };
      });
      await page.goto(TARGET_URL);
    });

    test('Clicking the "Next" button triggers a view transition', async ({ page }) => {
      const nextBtn = page.getByRole('button', { name: /next/i });
      await nextBtn.click({ timeout: 4000 });
      const transitionCount = await page.evaluate(
        () => (window as any).__transitions?.length ?? 0,
      );
      expect(transitionCount).toBeGreaterThan(0);
    });

    test('Clicking the "Previous" button triggers a view transition', async ({ page }) => {
      const prevBtn = page.getByRole('button', { name: /prev/i });
      await prevBtn.click({ timeout: 4000 });
      const transitionCount = await page.evaluate(
        () => (window as any).__transitions?.length ?? 0,
      );
      expect(transitionCount).toBeGreaterThan(0);
    });

    test('During the "Next" transition, the forward transition type is active on the document element', async ({
      page,
    }) => {
      const nextBtn = page.getByRole('button', { name: /next/i });
      await nextBtn.click({ timeout: 4000 });
      const hasForwardType = await page.evaluate(() => {
        const transitions = (window as any).__transitions ?? [];
        return transitions.some((t: any) => {
          const types = t?.types;
          if (Array.isArray(types)) return types.includes('forward');
          if (types && typeof types.has === 'function') return types.has('forward');
          return false;
        });
      });
      expect(hasForwardType).toBe(true);
    });

    test('During the "Previous" transition, the backward transition type is active on the document element', async ({
      page,
    }) => {
      const prevBtn = page.getByRole('button', { name: /prev/i });
      await prevBtn.click({ timeout: 4000 });
      const hasBackwardType = await page.evaluate(() => {
        const transitions = (window as any).__transitions ?? [];
        return transitions.some((t: any) => {
          const types = t?.types;
          if (Array.isArray(types)) return types.includes('backward');
          if (types && typeof types.has === 'function') return types.has('backward');
          return false;
        });
      });
      expect(hasBackwardType).toBe(true);
    });
  });
});
