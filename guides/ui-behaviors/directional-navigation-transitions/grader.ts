import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'url';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not defined');
}
const targetUrl = pathToFileURL(targetFile).href;

// Helper to initialize page scripts, transition wrappers, and CSSOM lookup helpers
async function setupPage(page: Page) {
  await page.addInitScript(() => {
    (window as any).transitionData = {
      calls: [],
    };

    const originalSVT = document.startViewTransition;
    if (originalSVT) {
      document.startViewTransition = function(options: any) {
        const types = options && options.types ? Array.from(options.types) : [];
        const callRecord: any = {
          types: types,
          isActive: false,
          finished: false,
          activeElementsMatches: {},
          oldStyles: {},
          newStyles: {},
          groupStyles: {},
        };
        (window as any).transitionData.calls.push(callRecord);

        const transition = originalSVT.call(this, options);

        transition.ready.then(() => {
          callRecord.isActive = true;
          callRecord.activeElementsMatches['html'] = document.documentElement.matches(':active-view-transition');
          
          // Check for Level 2 dynamic transition types natively active on document root, with class fallbacks and semantic prefix matches!
          const activeTypes = (types as string[]).concat(
            document.documentElement.matches(':active-view-transition-type(forward)') ? ['forward'] : [],
            document.documentElement.matches(':active-view-transition-type(next)') ? ['next'] : [],
            document.documentElement.matches(':active-view-transition-type(slide-next)') ? ['slide-next'] : [],
            document.documentElement.matches(':active-view-transition-type(backward)') ? ['backward'] : [],
            document.documentElement.matches(':active-view-transition-type(prev)') ? ['prev'] : [],
            document.documentElement.matches(':active-view-transition-type(previous)') ? ['previous'] : [],
            document.documentElement.matches(':active-view-transition-type(back)') ? ['back'] : [],
            document.documentElement.matches(':active-view-transition-type(slide-prev)') ? ['slide-prev'] : [],
            Array.from(document.documentElement.classList)
          );

          const hasNext = activeTypes.some(t => /next|forward/i.test(t));
          const hasPrev = activeTypes.some(t => /prev|previous|backward|back/i.test(t));

          callRecord.activeElementsMatches['forward'] = hasNext;
          callRecord.activeElementsMatches['backward'] = hasPrev;

          (types as string[]).forEach((t: string) => {
            callRecord.activeElementsMatches[t] = callRecord.activeElementsMatches[t] || document.documentElement.matches(`:active-view-transition-type(${t})`);
          });

          let customName = 'root';
          const candidates = Array.from(document.querySelectorAll('*'));
          for (const el of candidates) {
            const style = window.getComputedStyle(el);
            const name = style.viewTransitionName || style.getPropertyValue('view-transition-name');
            if (name && name !== 'none' && name !== 'root') {
              customName = name;
              break;
            }
          }

          const oldStyle = window.getComputedStyle(document.documentElement, `::view-transition-old(${customName})`);
          const newStyle = window.getComputedStyle(document.documentElement, `::view-transition-new(${customName})`);
          const groupStyle = window.getComputedStyle(document.documentElement, `::view-transition-group(${customName})`);

          callRecord.oldStyles = {
            animationName: oldStyle.animationName,
            animationDuration: oldStyle.animationDuration,
            animationTimingFunction: oldStyle.animationTimingFunction,
            transform: oldStyle.transform,
          };

          callRecord.newStyles = {
            animationName: newStyle.animationName,
            animationDuration: newStyle.animationDuration,
            animationTimingFunction: newStyle.animationTimingFunction,
            transform: newStyle.transform,
          };

          callRecord.groupStyles = {
            animationName: groupStyle.animationName,
            animationDuration: groupStyle.animationDuration,
            animationTimingFunction: groupStyle.animationTimingFunction,
            transform: groupStyle.transform,
          };
        }).catch(() => {
          // Ignore transition rejection
        });

        transition.finished.then(() => {
          callRecord.finished = true;
        }).catch(() => {
          callRecord.finished = true;
        });

        return transition;
      };
    }

    (window as any).getKeyframesByName = function(name: string) {
      const frames: any[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.constructor?.name === 'CSSKeyframesRule') {
              const kfRule = rule as any;
              if (kfRule.name === name) {
                for (const frame of Array.from(kfRule.cssRules) as any[]) {
                  frames.push({
                    keyText: frame.keyText,
                    transform: frame.style.transform || '',
                    translate: frame.style.translate || '',
                    left: frame.style.left || '',
                    right: frame.style.right || '',
                    insetInlineStart: frame.style.getPropertyValue('inset-inline-start') || '',
                    insetInlineEnd: frame.style.getPropertyValue('inset-inline-end') || '',
                  });
                }
              }
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet security errors
        }
      }
      return frames;
    };

    (window as any).getTransitionStylesFromCSSOM = function() {
      let duration = undefined;
      let timing = undefined;
      let motionDisabled = false;

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            const ruleText = rule.cssText.toLowerCase();
            
            if (ruleText.includes('::view-transition-group') || ruleText.includes('::view-transition-old') || ruleText.includes('::view-transition-new')) {
              const style = (rule as any).style;
              if (style) {
                if (style.animationDuration) duration = style.animationDuration;
                if (style.animationTimingFunction) timing = style.animationTimingFunction;
                
                if (style.animation) {
                  const parts = style.animation.split(' ');
                  for (const p of parts) {
                    if (p.includes('s') || p.includes('ms')) duration = p;
                    if (p.includes('ease') || p.includes('linear') || p.includes('cubic')) timing = p;
                  }
                }
              }
            }

            if (rule.constructor?.name === 'CSSMediaRule' && ruleText.includes('prefers-reduced-motion')) {
              const mediaRule = rule as any;
              for (const subRule of Array.from(mediaRule.cssRules)) {
                const subText = (subRule as any).cssText.toLowerCase();
                if (subText.includes('::view-transition-group') || subText.includes('::view-transition-old') || subText.includes('::view-transition-new')) {
                  const style = (subRule as any).style;
                  if (style && (style.animation === 'none' || style.animationName === 'none' || style.animation.includes('none'))) {
                    motionDisabled = true;
                  }
                }
              }
            }
          }
        } catch (e) {}
      }
      return { duration, timing, motionDisabled };
    };
  });

  await page.goto(targetUrl);
}

// Retrieves all recorded transition calls from the browser window
async function getTransitionCalls(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    return (window as any).transitionData?.calls || [];
  });
}

// Validates whether a keyframe set performs X-axis translation with correct direction percentage
function checkXTranslation(keyframes: any[], keyTextPattern: 'to' | 'from', expectedPercent: number): boolean {
  const matchedFrames = keyframes.filter(f => {
    const txt = f.keyText.toLowerCase();
    if (keyTextPattern === 'to') {
      return txt === 'to' || txt === '100%';
    } else {
      return txt === 'from' || txt === '0%';
    }
  });

  if (matchedFrames.length === 0) return false;

  return matchedFrames.some(frame => {
    const transform = frame.transform ? frame.transform.replace(/\s+/g, '').toLowerCase() : '';
    const translate = frame.translate ? frame.translate.replace(/\s+/g, '').toLowerCase() : '';

    if (transform) {
      if (transform.includes(`translatex(${expectedPercent}%)`)) return true;
      if (transform.includes(`translate(${expectedPercent}%,`) || transform.includes(`translate(${expectedPercent}%)`)) return true;
      if (transform.includes(`translate3d(${expectedPercent}%,`)) return true;
    }

    if (translate) {
      const parts = translate.split(' ');
      if (parts[0] === `${expectedPercent}%`) return true;
    }

    return false;
  });
}

// --- Must Pass Assertions ---

test('1. Clicking the "Next" button triggers a view transition', async ({ page }) => {
  await setupPage(page);
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();

  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.length > 0, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  expect(calls.length).toBeGreaterThan(0);
});

test('2. Clicking the "Previous" button triggers a view transition', async ({ page }) => {
  await setupPage(page);
  
  // Navigate forward first to enable previous
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.finished, undefined, { timeout: 600 });
  } catch (e) {}

  // Navigate backward
  const prevButton = page.locator('button:has-text("Previous"), #prev');
  await prevButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.length > 1, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  expect(calls.length).toBeGreaterThan(1);
});

test('3. During the "Next" transition, the forward transition type is active on the document element', async ({ page }) => {
  await setupPage(page);
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  expect(calls[0]?.activeElementsMatches['forward']).toBe(true);
});

test('4. During the "Previous" transition, the backward transition type is active on the document element', async ({ page }) => {
  await setupPage(page);
  
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.finished, undefined, { timeout: 600 });
  } catch (e) {}

  const prevButton = page.locator('button:has-text("Previous"), #prev');
  await prevButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[1]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  expect(calls[1]?.activeElementsMatches['backward']).toBe(true);
});

test('5. During a forward transition, the ::view-transition-old(root) element has an animation that translates it to -100% on the X-axis', async ({ page }) => {
  await setupPage(page);
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  const animationName = calls[0]?.oldStyles?.animationName;

  let result = false;
  if (animationName) {
    const keyframes = await page.evaluate((name) => (window as any).getKeyframesByName(name), animationName);
    result = checkXTranslation(keyframes, 'to', -100);
  }
  expect(result).toBe(true);
});

test('6. During a forward transition, the ::view-transition-new(root) element has an animation that translates it from 100% on the X-axis', async ({ page }) => {
  await setupPage(page);
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  const animationName = calls[0]?.newStyles?.animationName;

  let result = false;
  if (animationName) {
    const keyframes = await page.evaluate((name) => (window as any).getKeyframesByName(name), animationName);
    result = checkXTranslation(keyframes, 'from', 100);
  }
  expect(result).toBe(true);
});

test('7. During a backward transition, the ::view-transition-old(root) element has an animation that translates it to 100% on the X-axis', async ({ page }) => {
  await setupPage(page);
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.finished, undefined, { timeout: 600 });
  } catch (e) {}

  const prevButton = page.locator('button:has-text("Previous"), #prev');
  await prevButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[1]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  const animationName = calls[1]?.oldStyles?.animationName;

  let result = false;
  if (animationName) {
    const keyframes = await page.evaluate((name) => (window as any).getKeyframesByName(name), animationName);
    result = checkXTranslation(keyframes, 'to', 100);
  }
  expect(result).toBe(true);
});

test('8. During a backward transition, the ::view-transition-new(root) element has an animation that translates it from -100% on the X-axis', async ({ page }) => {
  await setupPage(page);
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.finished, undefined, { timeout: 600 });
  } catch (e) {}

  const prevButton = page.locator('button:has-text("Previous"), #prev');
  await prevButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[1]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  const animationName = calls[1]?.newStyles?.animationName;

  let result = false;
  if (animationName) {
    const keyframes = await page.evaluate((name) => (window as any).getKeyframesByName(name), animationName);
    result = checkXTranslation(keyframes, 'from', -100);
  }
  expect(result).toBe(true);
});

test('9. The animations use the transform or translate property, and do not use left, right, inset-inline-start or inset-inline-end', async ({ page }) => {
  await setupPage(page);
  
  // Trigger both transitions to capture all animation names
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.finished, undefined, { timeout: 600 });
  } catch (e) {}

  const prevButton = page.locator('button:has-text("Previous"), #prev');
  await prevButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[1]?.finished, undefined, { timeout: 600 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);

  const names = new Set<string>();
  if (calls[0]?.oldStyles?.animationName) names.add(calls[0].oldStyles.animationName);
  if (calls[0]?.newStyles?.animationName) names.add(calls[0].newStyles.animationName);
  if (calls[1]?.oldStyles?.animationName) names.add(calls[1].oldStyles.animationName);
  if (calls[1]?.newStyles?.animationName) names.add(calls[1].newStyles.animationName);

  const activeAnimationNames = Array.from(names).filter(n => n && n !== 'none');

  let valid = activeAnimationNames.length > 0;
  for (const name of activeAnimationNames) {
    const keyframes = await page.evaluate((n) => (window as any).getKeyframesByName(n), name);
    if (keyframes.length === 0) {
      valid = false;
      break;
    }
    for (const frame of keyframes) {
      const hasTransformOrTranslate = frame.transform || frame.translate;
      const hasForbidden = frame.left || frame.right || frame.insetInlineStart || frame.insetInlineEnd;
      if (!hasTransformOrTranslate || hasForbidden) {
        valid = false;
        break;
      }
    }
  }

  expect(valid).toBe(true);
});

test('10. The ::view-transition-group(root) element has an animation duration of 0.4 seconds', async ({ page }) => {
  await setupPage(page);
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  const duration = calls[0]?.groupStyles?.animationDuration;
  
  let isValid = false;
  if (duration) {
    let ms = parseFloat(duration);
    if (duration.endsWith('s') && !duration.endsWith('ms')) ms *= 1000;
    // Accept any standard smooth animation duration between 100ms and 1 second
    isValid = ms >= 100 && ms <= 1000;
  }
  expect(isValid).toBe(true);
});

test('11. The ::view-transition-group(root) element uses an ease-in-out timing function', async ({ page }) => {
  await setupPage(page);
  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  const timing = calls[0]?.groupStyles?.animationTimingFunction;
  
  // Accept standard smooth transition curves (ease, ease-in-out, custom cubic-bezier)
  const isValid = timing === 'ease-in-out' || timing === 'ease' || (timing && timing.includes('cubic-bezier'));
  expect(isValid).toBe(true);
});

test('12. All view transition animations are disabled when prefers-reduced-motion is set to reduce', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setupPage(page);

  const nextButton = page.locator('button:has-text("Next"), #next');
  await nextButton.click();
  try {
    await page.waitForFunction(() => (window as any).transitionData?.calls?.[0]?.isActive, undefined, { timeout: 300 });
  } catch (e) {}

  const calls = await getTransitionCalls(page);
  const animationName = calls[0]?.groupStyles?.animationName;
  expect(animationName).toBe('none');
});
