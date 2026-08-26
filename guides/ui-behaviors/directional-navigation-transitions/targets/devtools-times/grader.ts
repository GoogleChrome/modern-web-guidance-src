import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../test-fixture.ts';
import {
  CSSStyleRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSMediaRule,
  type CSSStyleSheet,
  type CSSRule,
  type CSSRuleList,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: CSSRuleList | CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules && !(rule instanceof CSSKeyframesRule)) {
      result.push(...getAllStyleRules(rule.cssRules as CSSRuleList));
    }
  }
  return result;
}

function getKeyframeRules(stylesheet: CSSStyleSheet): CSSKeyframesRule[] {
  return Array.from(stylesheet.cssRules).filter(
    (r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule
  );
}

function findKeyframeRule(
  keyframeRules: CSSKeyframesRule[],
  animName: string
): CSSKeyframesRule | undefined {
  if (!animName) return undefined;
  const trimmed = animName.trim();
  return (
    keyframeRules.find((k) => trimmed.includes(k.name)) ||
    keyframeRules.find((k) => k.name === trimmed)
  );
}

test.describe('Directional Navigation Transitions Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('During a forward transition, the ::view-transition-old(root) element has an animation that translates it to -100% on the X-axis', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const keyframeRules = getKeyframeRules(stylesheet);

    const fwdOldRule = styleRules.find(
      (r) =>
        /active-view-transition-type\(\s*['"]?forward['"]?\s*\)/i.test(r.selectorText) &&
        /view-transition-old/i.test(r.selectorText)
    );
    const animName =
      fwdOldRule?.style.getPropertyValue('animation-name') ||
      fwdOldRule?.style.getPropertyValue('animation') ||
      fwdOldRule?.style.cssText ||
      '';
    const kf = findKeyframeRule(keyframeRules, animName);
    const toKeyframe = Array.from(kf?.cssRules || []).find(
      (k) => (k as CSSKeyframeRule).keyText === 'to' || (k as CSSKeyframeRule).keyText === '100%'
    ) as CSSKeyframeRule | undefined;
    const prop =
      toKeyframe?.style.getPropertyValue('transform') ||
      toKeyframe?.style.getPropertyValue('translate') ||
      toKeyframe?.style.cssText ||
      '';

    const isValid = Boolean(
      fwdOldRule &&
        kf &&
        (/translate(X|3d)?\(\s*-100%/i.test(prop) || /translate:\s*-100%/i.test(prop))
    );
    expect(isValid).toBe(true);
  });

  test('During a forward transition, the ::view-transition-new(root) element has an animation that translates it from 100% on the X-axis', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const keyframeRules = getKeyframeRules(stylesheet);

    const fwdNewRule = styleRules.find(
      (r) =>
        /active-view-transition-type\(\s*['"]?forward['"]?\s*\)/i.test(r.selectorText) &&
        /view-transition-new/i.test(r.selectorText)
    );
    const animName =
      fwdNewRule?.style.getPropertyValue('animation-name') ||
      fwdNewRule?.style.getPropertyValue('animation') ||
      fwdNewRule?.style.cssText ||
      '';
    const kf = findKeyframeRule(keyframeRules, animName);
    const fromKeyframe = Array.from(kf?.cssRules || []).find(
      (k) => (k as CSSKeyframeRule).keyText === 'from' || (k as CSSKeyframeRule).keyText === '0%'
    ) as CSSKeyframeRule | undefined;
    const prop =
      fromKeyframe?.style.getPropertyValue('transform') ||
      fromKeyframe?.style.getPropertyValue('translate') ||
      fromKeyframe?.style.cssText ||
      '';

    const isValid = Boolean(
      fwdNewRule &&
        kf &&
        (/translate(X|3d)?\(\s*100%/i.test(prop) || /translate:\s*100%/i.test(prop))
    );
    expect(isValid).toBe(true);
  });

  test('During a backward transition, the ::view-transition-old(root) element has an animation that translates it to 100% on the X-axis', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const keyframeRules = getKeyframeRules(stylesheet);

    const backOldRule = styleRules.find(
      (r) =>
        /active-view-transition-type\(\s*['"]?backward['"]?\s*\)/i.test(r.selectorText) &&
        /view-transition-old/i.test(r.selectorText)
    );
    const animName =
      backOldRule?.style.getPropertyValue('animation-name') ||
      backOldRule?.style.getPropertyValue('animation') ||
      backOldRule?.style.cssText ||
      '';
    const kf = findKeyframeRule(keyframeRules, animName);
    const toKeyframe = Array.from(kf?.cssRules || []).find(
      (k) => (k as CSSKeyframeRule).keyText === 'to' || (k as CSSKeyframeRule).keyText === '100%'
    ) as CSSKeyframeRule | undefined;
    const prop =
      toKeyframe?.style.getPropertyValue('transform') ||
      toKeyframe?.style.getPropertyValue('translate') ||
      toKeyframe?.style.cssText ||
      '';

    const isValid = Boolean(
      backOldRule &&
        kf &&
        (/translate(X|3d)?\(\s*100%/i.test(prop) || /translate:\s*100%/i.test(prop))
    );
    expect(isValid).toBe(true);
  });

  test('During a backward transition, the ::view-transition-new(root) element has an animation that translates it from -100% on the X-axis', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const keyframeRules = getKeyframeRules(stylesheet);

    const backNewRule = styleRules.find(
      (r) =>
        /active-view-transition-type\(\s*['"]?backward['"]?\s*\)/i.test(r.selectorText) &&
        /view-transition-new/i.test(r.selectorText)
    );
    const animName =
      backNewRule?.style.getPropertyValue('animation-name') ||
      backNewRule?.style.getPropertyValue('animation') ||
      backNewRule?.style.cssText ||
      '';
    const kf = findKeyframeRule(keyframeRules, animName);
    const fromKeyframe = Array.from(kf?.cssRules || []).find(
      (k) => (k as CSSKeyframeRule).keyText === 'from' || (k as CSSKeyframeRule).keyText === '0%'
    ) as CSSKeyframeRule | undefined;
    const prop =
      fromKeyframe?.style.getPropertyValue('transform') ||
      fromKeyframe?.style.getPropertyValue('translate') ||
      fromKeyframe?.style.cssText ||
      '';

    const isValid = Boolean(
      backNewRule &&
        kf &&
        (/translate(X|3d)?\(\s*-100%/i.test(prop) || /translate:\s*-100%/i.test(prop))
    );
    expect(isValid).toBe(true);
  });

  test('The animations use the transform or translate property, and do not use left, right, inset-inline-start or inset-inline-end', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const keyframeRules = getKeyframeRules(stylesheet);

    const directionalKeyframes = keyframeRules.filter((k) =>
      Array.from(k.cssRules).some((kf) => {
        const text = (kf as CSSKeyframeRule).style.cssText;
        return /translate|transform/i.test(text) || /100%|-100%/.test(text);
      })
    );

    const hasDirectionalKeyframes = directionalKeyframes.length >= 4;
    const allUseTransformOrTranslate = directionalKeyframes.every((k) =>
      Array.from(k.cssRules).some((kf) => {
        const style = (kf as CSSKeyframeRule).style;
        const prop =
          style.getPropertyValue('transform') ||
          style.getPropertyValue('translate') ||
          style.cssText;
        return /transform|translate/i.test(prop);
      })
    );
    const noneUseInsets = directionalKeyframes.every((k) =>
      Array.from(k.cssRules).every((kf) => {
        const style = (kf as CSSKeyframeRule).style;
        return (
          !style.getPropertyValue('left') &&
          !style.getPropertyValue('right') &&
          !style.getPropertyValue('inset-inline-start') &&
          !style.getPropertyValue('inset-inline-end') &&
          !style.getPropertyValue('inset') &&
          !style.getPropertyValue('inset-inline')
        );
      })
    );

    const isValid = hasDirectionalKeyframes && allUseTransformOrTranslate && noneUseInsets;
    expect(isValid).toBe(true);
  });

  test('The ::view-transition-group(root) element has an animation duration of 0.4 seconds', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const groupRule = styleRules.find((r) =>
      /::view-transition-group(\(\s*root\s*\))?/i.test(r.selectorText)
    );
    const duration =
      groupRule?.style.getPropertyValue('animation-duration') ||
      groupRule?.style.getPropertyValue('animation') ||
      groupRule?.style.cssText ||
      '';

    const isValid = Boolean(groupRule && /\b(0?\.4s|400ms)\b/i.test(duration));
    expect(isValid).toBe(true);
  });

  test('The ::view-transition-group(root) element uses an ease-in-out timing function', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const groupRule = styleRules.find((r) =>
      /::view-transition-group(\(\s*root\s*\))?/i.test(r.selectorText)
    );
    const timing =
      groupRule?.style.getPropertyValue('animation-timing-function') ||
      groupRule?.style.getPropertyValue('animation') ||
      groupRule?.style.cssText ||
      '';

    const isValid = Boolean(groupRule && /\bease-in-out\b/i.test(timing));
    expect(isValid).toBe(true);
  });

  test('All view transition animations are disabled when prefers-reduced-motion is set to reduce', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const mediaRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSMediaRule => r instanceof CSSMediaRule
    );

    const reducedMedia = mediaRules.find(
      (m) =>
        m.conditionText.includes('prefers-reduced-motion') &&
        m.conditionText.includes('reduce')
    );
    const reducedStyleRules = reducedMedia ? getAllStyleRules(reducedMedia.cssRules) : [];
    const disabledRule = reducedStyleRules.find(
      (r) =>
        /view-transition/i.test(r.selectorText) ||
        /\*/.test(r.selectorText) ||
        /root/i.test(r.selectorText)
    );
    const animProp =
      disabledRule?.style.getPropertyValue('animation') ||
      disabledRule?.style.getPropertyValue('animation-name') ||
      disabledRule?.style.getPropertyValue('animation-duration') ||
      disabledRule?.style.cssText ||
      '';

    const isValid = Boolean(
      disabledRule && (/\bnone\b/i.test(animProp) || /\b0s\b/i.test(animProp))
    );
    expect(isValid).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        (window as any).__transitions = [];
        const orig = document.startViewTransition;
        document.startViewTransition = function (optsOrCb: any) {
          const record: {
            called: boolean;
            types: string[];
            activeTypesDuringUpdate: string[];
          } = {
            called: true,
            types: [],
            activeTypesDuringUpdate: [],
          };

          if (optsOrCb && typeof optsOrCb === 'object' && Array.isArray(optsOrCb.types)) {
            record.types.push(...optsOrCb.types);
          }

          let userUpdate: (() => void | Promise<void>) | undefined;
          if (typeof optsOrCb === 'function') {
            userUpdate = optsOrCb;
          } else if (optsOrCb && typeof optsOrCb.update === 'function') {
            userUpdate = optsOrCb.update;
          }

          const wrappedUpdate = async () => {
            try {
              if (document.documentElement.matches(':active-view-transition-type(forward)')) {
                record.activeTypesDuringUpdate.push('forward');
              }
            } catch {}
            try {
              if (document.documentElement.matches(':active-view-transition-type(backward)')) {
                record.activeTypesDuringUpdate.push('backward');
              }
            } catch {}

            if (userUpdate) {
              return await userUpdate();
            }
          };

          let transition: any;
          if (orig) {
            try {
              if (typeof optsOrCb === 'function') {
                transition = orig.call(document, wrappedUpdate);
              } else if (optsOrCb && typeof optsOrCb === 'object') {
                transition = orig.call(document, {
                  ...optsOrCb,
                  update: wrappedUpdate,
                });
              }
            } catch {
              try {
                transition = orig.call(document, wrappedUpdate);
              } catch {}
            }
          }

          if (transition && transition.types) {
            if (typeof transition.types.forEach === 'function') {
              transition.types.forEach((t: string) => {
                if (!record.types.includes(t)) record.types.push(t);
              });
            }
            const origAdd = transition.types.add;
            if (typeof origAdd === 'function') {
              transition.types.add = function (t: string) {
                if (!record.types.includes(t)) record.types.push(t);
                return origAdd.call(transition.types, t);
              };
            }
          }

          (window as any).__transitions.push(record);

          return (
            transition || {
              types: new Set(record.types),
              ready: Promise.resolve(),
              finished: Promise.resolve(),
              updateCallbackDone: Promise.resolve(),
              skipTransition() {},
            }
          );
        };
      });

      await page.goto(TARGET_URL);
    });

    test('Clicking the "Next" button triggers a view transition', async ({ page }) => {
      const nextBtn = page
        .locator('button, [role="button"], a')
        .filter({ hasText: /\bnext\b/i })
        .or(page.getByRole('button', { name: /\bnext\b/i }))
        .or(
          page.locator(
            '[aria-label*="next" i], [data-direction="forward"], [data-slider-next], [data-story-next]'
          )
        )
        .first();

      await nextBtn.click({ timeout: 5000 });
      await page
        .waitForFunction(() => (window as any).__transitions?.length > 0, null, { timeout: 5000 })
        .catch(() => {});

      const transitionTriggered = await page.evaluate(() => {
        const transitions = (window as any).__transitions || [];
        return transitions.length > 0;
      });
      expect(transitionTriggered).toBe(true);
    });

    test('Clicking the "Previous" button triggers a view transition', async ({ page }) => {
      const prevBtn = page
        .locator('button, [role="button"], a')
        .filter({ hasText: /\bprev(ious)?\b/i })
        .or(page.getByRole('button', { name: /\bprev(ious)?\b/i }))
        .or(
          page.locator(
            '[aria-label*="prev" i], [data-direction="backward"], [data-slider-prev], [data-story-prev]'
          )
        )
        .first();

      await prevBtn.click({ timeout: 5000 });
      await page
        .waitForFunction(() => (window as any).__transitions?.length > 0, null, { timeout: 5000 })
        .catch(() => {});

      const transitionTriggered = await page.evaluate(() => {
        const transitions = (window as any).__transitions || [];
        return transitions.length > 0;
      });
      expect(transitionTriggered).toBe(true);
    });

    test('During the "Next" transition, the forward transition type is active on the document element', async ({
      page,
    }) => {
      const nextBtn = page
        .locator('button, [role="button"], a')
        .filter({ hasText: /\bnext\b/i })
        .or(page.getByRole('button', { name: /\bnext\b/i }))
        .or(
          page.locator(
            '[aria-label*="next" i], [data-direction="forward"], [data-slider-next], [data-story-next]'
          )
        )
        .first();

      await nextBtn.click({ timeout: 5000 });
      await page
        .waitForFunction(() => (window as any).__transitions?.length > 0, null, { timeout: 5000 })
        .catch(() => {});

      const isForwardActive = await page.evaluate(() => {
        const transitions = (window as any).__transitions || [];
        const last = transitions[transitions.length - 1];
        return Boolean(
          last &&
            (last.types?.some((t: string) => /\bforward\b/i.test(t)) ||
              last.activeTypesDuringUpdate?.some((t: string) => /\bforward\b/i.test(t)))
        );
      });
      expect(isForwardActive).toBe(true);
    });

    test('During the "Previous" transition, the backward transition type is active on the document element', async ({
      page,
    }) => {
      const prevBtn = page
        .locator('button, [role="button"], a')
        .filter({ hasText: /\bprev(ious)?\b/i })
        .or(page.getByRole('button', { name: /\bprev(ious)?\b/i }))
        .or(
          page.locator(
            '[aria-label*="prev" i], [data-direction="backward"], [data-slider-prev], [data-story-prev]'
          )
        )
        .first();

      await prevBtn.click({ timeout: 5000 });
      await page
        .waitForFunction(() => (window as any).__transitions?.length > 0, null, { timeout: 5000 })
        .catch(() => {});

      const isBackwardActive = await page.evaluate(() => {
        const transitions = (window as any).__transitions || [];
        const last = transitions[transitions.length - 1];
        return Boolean(
          last &&
            (last.types?.some((t: string) => /\bbackward\b/i.test(t)) ||
              last.activeTypesDuringUpdate?.some((t: string) => /\bbackward\b/i.test(t)))
        );
      });
      expect(isBackwardActive).toBe(true);
    });
  });
});
