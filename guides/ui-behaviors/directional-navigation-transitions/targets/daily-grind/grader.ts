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
  type CSSRule,
} from 'cssomnom';
import type { Page } from '@playwright/test';

const targetFiles: string[] = getTargetFiles(import.meta.url);

// --- CSS helpers ---

const REDUCED_MOTION = /prefers-reduced-motion\s*:\s*reduce/i;

/**
 * Flattens every rule in the sheet, descending into any grouping rule
 * (@media, @layer, @supports, …) but not into @keyframes.
 * When `skipReducedMotion` is set, rules inside `prefers-reduced-motion: reduce`
 * blocks are omitted (so `animation: none` overrides don't mask the real settings).
 */
function flattenRules(rules: Iterable<CSSRule>, skipReducedMotion = false): CSSRule[] {
  const out: CSSRule[] = [];
  for (const rule of Array.from(rules)) {
    if (skipReducedMotion && rule instanceof CSSMediaRule && REDUCED_MOTION.test(rule.conditionText)) {
      continue;
    }
    out.push(rule);
    if (!(rule instanceof CSSKeyframesRule) && 'cssRules' in rule && (rule as any).cssRules) {
      out.push(...flattenRules((rule as any).cssRules, skipReducedMotion));
    }
  }
  return out;
}

function getRules(skipReducedMotion = false) {
  const all = flattenRules(getCssStyleSheet(targetFiles).cssRules, skipReducedMotion);
  return {
    styleRules: all.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule),
    keyframes: all.filter((r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule),
    mediaRules: all.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule),
  };
}

/** Splits on `sep` while ignoring separators nested inside parentheses. */
function splitTopLevel(value: string, sep: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && sep.test(ch)) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const splitLayers = (v: string) => splitTopLevel(v, /,/);
const splitTokens = (v: string) => splitTopLevel(v, /\s/);

function getAnimationNames(rule: CSSStyleRule, keyframeNames: Set<string>): string[] {
  const longhand = rule.style.getPropertyValue('animation-name');
  if (longhand.trim()) return splitLayers(longhand);
  const shorthand = rule.style.getPropertyValue('animation');
  return splitLayers(shorthand)
    .flatMap(splitTokens)
    .filter((t) => keyframeNames.has(t));
}

/** Keyframes referenced by `:active-view-transition-type(<type>)::view-transition-<pseudo>(root)`. */
function findDirectionalKeyframes(
  type: 'forward' | 'backward',
  pseudo: 'old' | 'new',
): CSSKeyframesRule[] {
  const { styleRules, keyframes } = getRules(true);
  const typeRe = new RegExp(`:active-view-transition-type\\([^)]*\\b${type}\\b[^)]*\\)`, 'i');
  const pseudoRe = new RegExp(`::view-transition-${pseudo}\\(\\s*(root|\\*)\\s*\\)`, 'i');
  const names = new Set(keyframes.map((k) => k.name));
  const referenced = new Set(
    styleRules
      .filter((r) => typeRe.test(r.selectorText) && pseudoRe.test(r.selectorText))
      .flatMap((r) => getAnimationNames(r, names)),
  );
  return keyframes.filter((k) => referenced.has(k.name));
}

function findKeyframe(rule: CSSKeyframesRule, offset: 'from' | 'to'): CSSKeyframeRule | undefined {
  const aliases = offset === 'from' ? ['from', '0%'] : ['to', '100%'];
  return Array.from(rule.cssRules).find(
    (kf): kf is CSSKeyframeRule =>
      kf instanceof CSSKeyframeRule &&
      kf.keyText.split(',').some((k) => aliases.includes(k.trim().toLowerCase())),
  );
}

/** Returns the X translation of a keyframe from either `translate` or `transform`. */
function getTranslateX(kf: CSSKeyframeRule): string | undefined {
  const translate = kf.style.getPropertyValue('translate').trim();
  if (translate && translate !== 'none') return splitTokens(translate)[0]?.toLowerCase();
  const transform = kf.style.getPropertyValue('transform');
  const match = /translate(?:x|3d)?\(\s*([^,\s)]+)/i.exec(transform);
  return match?.[1].toLowerCase();
}

function slidesTo(
  type: 'forward' | 'backward',
  pseudo: 'old' | 'new',
  offset: 'from' | 'to',
  sign: '-' | '+',
): boolean {
  const expected = sign === '-' ? ['-100%', '-100vw'] : ['100%', '100vw'];
  return findDirectionalKeyframes(type, pseudo).some((rule) => {
    const kf = findKeyframe(rule, offset);
    const x = kf && getTranslateX(kf);
    return Boolean(x && expected.includes(x));
  });
}

function getGroupRules(): CSSStyleRule[] {
  return getRules(true).styleRules.filter((r) =>
    /::view-transition-group\(\s*root\s*\)/i.test(r.selectorText),
  );
}

function parseSeconds(token: string): number | undefined {
  const m = /^(-?[\d.]+)(ms|s)$/i.exec(token.trim());
  if (!m) return undefined;
  return m[2].toLowerCase() === 'ms' ? Number(m[1]) / 1000 : Number(m[1]);
}

const EASING = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|cubic-bezier\(.*\)|linear\(.*\)|steps\(.*\))$/i;

// --- Browser helpers ---

async function installTransitionSpy(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__transitions = [];
    const orig = document.startViewTransition?.bind(document);
    if (!orig) return;
    (document as any).startViewTransition = (arg?: any) => {
      const record = { types: [] as string[], activeTypesDuringUpdate: [] as string[] };
      if (arg && typeof arg === 'object' && Array.isArray(arg.types)) record.types.push(...arg.types);
      const userUpdate = typeof arg === 'function' ? arg : arg?.update;
      const update = async () => {
        for (const t of ['forward', 'backward']) {
          try {
            if (document.documentElement.matches(`:active-view-transition-type(${t})`)) {
              record.activeTypesDuringUpdate.push(t);
            }
          } catch {}
        }
        return userUpdate?.();
      };
      const transition =
        arg && typeof arg === 'object' ? orig({ ...arg, update }) : orig(update);
      transition.types?.forEach((t: string) => {
        if (!record.types.includes(t)) record.types.push(t);
      });
      const origAdd = transition.types?.add?.bind(transition.types);
      if (origAdd) {
        transition.types.add = (t: string) => {
          if (!record.types.includes(t)) record.types.push(t);
          return origAdd(t);
        };
      }
      w.__transitions.push(record);
      w.__lastTransition = transition;
      return transition;
    };
  });
}

function nextButton(page: Page) {
  return page
    .locator('#next')
    .or(page.getByRole('button', { name: /\bnext\b/i }))
    .first();
}

function prevButton(page: Page) {
  return page
    .locator('#prev')
    .or(page.getByRole('button', { name: /\bprev(ious)?\b/i }))
    .first();
}

type TransitionRecord = { types: string[]; activeTypesDuringUpdate: string[] };

/**
 * Clicks until a view transition is recorded. Buttons rendered by client-side
 * frameworks may be visible before hydration attaches their click handlers,
 * so a single early click can be silently dropped.
 */
async function clickUntilTransition(page: Page, which: 'next' | 'prev'): Promise<void> {
  const button = which === 'next' ? nextButton(page) : prevButton(page);
  for (let attempt = 0; attempt < 5; attempt++) {
    await button.click({ timeout: 5000 });
    const recorded = await page
      .waitForFunction(() => (window as any).__transitions?.length > 0, null, { timeout: 300 })
      .then(() => true)
      .catch(() => false);
    if (recorded) return;
  }
}

async function clickAndCapture(page: Page, which: 'next' | 'prev'): Promise<TransitionRecord[]> {
  // "Previous" is typically disabled on the first item, so advance first.
  if (which === 'prev') {
    await clickUntilTransition(page, 'next');
    await page.evaluate(async () => {
      const finished = (window as any).__lastTransition?.finished;
      if (finished) {
        await Promise.race([finished.catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
      }
      (window as any).__transitions = [];
    });
  }
  await clickUntilTransition(page, which);
  return page.evaluate(() => (window as any).__transitions as TransitionRecord[]);
}

const hasType = (t: { types: string[]; activeTypesDuringUpdate: string[] }, type: string) =>
  t.types.includes(type) || t.activeTypesDuringUpdate.includes(type);

test.describe('directional-navigation-transitions Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('During a forward transition, the ::view-transition-old(root) element has an animation that translates it to -100% on the X-axis', () => {
    expect(slidesTo('forward', 'old', 'to', '-')).toBe(true);
  });

  test('During a forward transition, the ::view-transition-new(root) element has an animation that translates it from 100% on the X-axis', () => {
    expect(slidesTo('forward', 'new', 'from', '+')).toBe(true);
  });

  test('During a backward transition, the ::view-transition-old(root) element has an animation that translates it to 100% on the X-axis', () => {
    expect(slidesTo('backward', 'old', 'to', '+')).toBe(true);
  });

  test('During a backward transition, the ::view-transition-new(root) element has an animation that translates it from -100% on the X-axis', () => {
    expect(slidesTo('backward', 'new', 'from', '-')).toBe(true);
  });

  test('The animations use the transform or translate property, and do not use left, right, inset-inline-start or inset-inline-end', () => {
    const directional = new Set(
      (['forward', 'backward'] as const).flatMap((type) =>
        (['old', 'new'] as const).flatMap((pseudo) => findDirectionalKeyframes(type, pseudo)),
      ),
    );
    const frames = [...directional].flatMap((k) =>
      Array.from(k.cssRules).filter((r): r is CSSKeyframeRule => r instanceof CSSKeyframeRule),
    );
    const usesTransform = frames.some(
      (kf) => kf.style.getPropertyValue('transform') || kf.style.getPropertyValue('translate'),
    );
    const usesInsets = frames.some((kf) =>
      ['left', 'right', 'inset', 'inset-inline', 'inset-inline-start', 'inset-inline-end'].some(
        (p) => kf.style.getPropertyValue(p),
      ),
    );
    expect(directional.size > 0 && usesTransform && !usesInsets).toBe(true);
  });

  test('The ::view-transition-group(root) element has an animation duration between 0.2 and 0.6 seconds', () => {
    const durations = getGroupRules().flatMap((r) => {
      const longhand = r.style.getPropertyValue('animation-duration');
      const tokens = longhand.trim()
        ? splitLayers(longhand)
        : splitLayers(r.style.getPropertyValue('animation')).map(
            (layer) => splitTokens(layer).find((t) => parseSeconds(t) !== undefined) ?? '',
          );
      return tokens.map(parseSeconds).filter((s): s is number => s !== undefined);
    });
    expect(durations.some((s) => s >= 0.2 && s <= 0.6)).toBe(true);
  });

  test('The ::view-transition-group(root) element uses a non-linear timing function (e.g. an ease keyword or cubic-bezier()), not linear', () => {
    const easings = getGroupRules().flatMap((r) => {
      const longhand = r.style.getPropertyValue('animation-timing-function');
      if (longhand.trim()) return splitLayers(longhand);
      return splitLayers(r.style.getPropertyValue('animation')).flatMap((layer) =>
        splitTokens(layer).filter((t) => EASING.test(t)),
      );
    });
    const nonLinear = easings.some((e) => /^(ease|cubic-bezier\(|linear\()/i.test(e));
    expect(nonLinear).toBe(true);
  });

  test('All view transition animations are disabled when prefers-reduced-motion is set to reduce', () => {
    const { mediaRules } = getRules();
    const disables = mediaRules
      .filter((m) => REDUCED_MOTION.test(m.conditionText))
      .flatMap((m) =>
        flattenRules(m.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule),
      )
      .some((r) => {
        if (!/::view-transition|\*/.test(r.selectorText)) return false;
        const anim = r.style.getPropertyValue('animation');
        const name = r.style.getPropertyValue('animation-name');
        const dur = r.style.getPropertyValue('animation-duration');
        return (
          /\bnone\b/i.test(anim) ||
          /\bnone\b/i.test(name) ||
          /(^|\s)(0s|0ms|0\.0*1ms)($|\s|,)/i.test(dur)
        );
      });
    expect(disables).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await installTransitionSpy(page);
      await page.goto(TARGET_URL);
    });

    test('Clicking the "Next" button triggers a view transition', async ({ page }) => {
      const transitions = await clickAndCapture(page, 'next');
      expect(transitions.length).toBeGreaterThan(0);
    });

    test('Clicking the "Previous" button triggers a view transition', async ({ page }) => {
      const transitions = await clickAndCapture(page, 'prev');
      expect(transitions.length).toBeGreaterThan(0);
    });

    test('During the "Next" transition, the forward transition type is active on the document element', async ({
      page,
    }) => {
      const transitions = await clickAndCapture(page, 'next');
      expect(transitions.some((t) => hasType(t, 'forward'))).toBe(true);
    });

    test('During the "Previous" transition, the backward transition type is active on the document element', async ({
      page,
    }) => {
      const transitions = await clickAndCapture(page, 'prev');
      expect(transitions.some((t) => hasType(t, 'backward'))).toBe(true);
    });
  });
});
