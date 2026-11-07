import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type Project,
  type PropertyAccessExpression,
  type ElementAccessExpression,
} from 'ts-morph';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSStartingStyleRule,
  CSSNestedDeclarations,
  type CSSRule,
  type CSSStyleDeclaration,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore - import.meta.url is supported in Playwright ESM runtime
const targetFiles: string[] = getTargetFiles(import.meta.url);

interface FlatDecl {
  style: CSSStyleDeclaration;
  rule: CSSRule;
  selectorChain: string[];
  mediaConditions: string[];
  inStartingStyle: boolean;
}

function collectCssDeclarations(
  rules: Iterable<CSSRule>,
  selectorChain: string[] = [],
  mediaConditions: string[] = [],
  inStartingStyle = false,
): FlatDecl[] {
  const result: FlatDecl[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      const nextSelectors = [...selectorChain, rule.selectorText];
      if (rule.style && rule.style.length > 0) {
        result.push({
          style: rule.style,
          rule,
          selectorChain: nextSelectors,
          mediaConditions,
          inStartingStyle,
        });
      }
      if (rule.cssRules && rule.cssRules.length > 0) {
        result.push(
          ...collectCssDeclarations(
            rule.cssRules,
            nextSelectors,
            mediaConditions,
            inStartingStyle,
          ),
        );
      }
    } else if (rule instanceof CSSNestedDeclarations) {
      if (rule.style && rule.style.length > 0) {
        result.push({
          style: rule.style,
          rule,
          selectorChain,
          mediaConditions,
          inStartingStyle,
        });
      }
    } else if (rule instanceof CSSMediaRule) {
      const nextMedia = [...mediaConditions, rule.conditionText];
      if (rule.cssRules && rule.cssRules.length > 0) {
        result.push(
          ...collectCssDeclarations(
            rule.cssRules,
            selectorChain,
            nextMedia,
            inStartingStyle,
          ),
        );
      }
    } else if (rule instanceof CSSStartingStyleRule) {
      if (rule.cssRules && rule.cssRules.length > 0) {
        result.push(
          ...collectCssDeclarations(
            rule.cssRules,
            selectorChain,
            mediaConditions,
            true,
          ),
        );
      }
    } else if ('cssRules' in rule && (rule as { cssRules?: Iterable<CSSRule> }).cssRules) {
      const childRules = (rule as { cssRules: Iterable<CSSRule> }).cssRules;
      result.push(
        ...collectCssDeclarations(
          childRules,
          selectorChain,
          mediaConditions,
          inStartingStyle,
        ),
      );
    }
  }
  return result;
}

function getTransitionProperties(style: CSSStyleDeclaration): string {
  return [
    style.getPropertyValue('transition'),
    style.getPropertyValue('transition-property'),
  ]
    .filter(Boolean)
    .join(' ');
}

function hasTransitionBehaviorAllowDiscrete(style: CSSStyleDeclaration): boolean {
  const tb = style.getPropertyValue('transition-behavior');
  const trans = style.getPropertyValue('transition');
  return /\ballow-discrete\b/.test(tb) || /\ballow-discrete\b/.test(trans);
}

test.describe('motion Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('Discrete entry and exit animations use transition-behavior: allow-discrete, @starting-style, and include overlay when animating top-layer elements', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const decls = collectCssDeclarations(stylesheet.cssRules);
    expect(decls.length).toBeGreaterThan(0);

    const hasAllowDiscrete = decls.some((d) =>
      hasTransitionBehaviorAllowDiscrete(d.style),
    );
    const hasOverlayTransition = decls.some((d) =>
      /\boverlay\b/.test(getTransitionProperties(d.style)),
    );
    const hasDisplayTransition = decls.some((d) =>
      /\bdisplay\b/.test(getTransitionProperties(d.style)),
    );
    const hasStartingStyleWithProperties = decls.some(
      (d) => d.inStartingStyle && d.style.length > 0,
    );

    expect(hasAllowDiscrete).toBe(true);
    expect(hasOverlayTransition).toBe(true);
    expect(hasDisplayTransition).toBe(true);
    expect(hasStartingStyleWithProperties).toBe(true);
  });

  test('Animations and spatial transitions honor user motion preferences using @media (prefers-reduced-motion: reduce) or @media (prefers-reduced-motion: no-preference)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const decls = collectCssDeclarations(stylesheet.cssRules);
    expect(decls.length).toBeGreaterThan(0);

    const motionMediaDecls = decls.filter((d) =>
      d.mediaConditions.some((cond) =>
        /prefers-reduced-motion\s*:\s*(reduce|no-preference)/i.test(cond),
      ),
    );
    expect(motionMediaDecls.length).toBeGreaterThan(0);

    const handlesMotionInMedia = motionMediaDecls.some((d) => {
      const propNames = Array.from({ length: d.style.length }, (_, i) =>
        d.style.item(i),
      );
      return propNames.some((prop) =>
        /^(animation|transition|transform|translate|scale|rotate)/i.test(prop),
      );
    });

    expect(handlesMotionInMedia).toBe(true);
  });

  test('Reduced-motion styles do not use a blanket 0.01ms duration override', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const decls = collectCssDeclarations(stylesheet.cssRules);
    expect(decls.length).toBeGreaterThan(0);

    const motionMediaDecls = decls.filter((d) =>
      d.mediaConditions.some((cond) => /prefers-reduced-motion/i.test(cond)),
    );
    expect(motionMediaDecls.length).toBeGreaterThan(0);

    const reduceDecls = decls.filter((d) =>
      d.mediaConditions.some((cond) =>
        /prefers-reduced-motion\s*:\s*reduce/i.test(cond),
      ),
    );

    const hasNearZeroOverride = reduceDecls.some((d) => {
      const animDur = d.style.getPropertyValue('animation-duration');
      const transDur = d.style.getPropertyValue('transition-duration');
      const anim = d.style.getPropertyValue('animation');
      const trans = d.style.getPropertyValue('transition');
      const combined = `${animDur} ${transDur} ${anim} ${trans}`;
      return /\b0\.0+1ms\b|\b0\.00001s\b/i.test(combined);
    });

    expect(hasNearZeroOverride).toBe(false);
  });

  test('Reduced-motion styles do not disable non-motion transitions such as color or background-color changes on interactive elements', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const decls = collectCssDeclarations(stylesheet.cssRules);
    expect(decls.length).toBeGreaterThan(0);

    const motionMediaDecls = decls.filter((d) =>
      d.mediaConditions.some((cond) => /prefers-reduced-motion/i.test(cond)),
    );
    expect(motionMediaDecls.length).toBeGreaterThan(0);

    // Base styles (outside `prefers-reduced-motion: no-preference`) must keep color / background transitions
    const baseDecls = decls.filter(
      (d) =>
        !d.mediaConditions.some((cond) =>
          /prefers-reduced-motion\s*:\s*no-preference/i.test(cond),
        ),
    );
    const hasBaseColorOrBgTransition = baseDecls.some((d) => {
      const trans = getTransitionProperties(d.style);
      return /\b(color|background(-color)?|border-color)\b/i.test(trans);
    });
    expect(hasBaseColorOrBgTransition).toBe(true);

    // Inside `prefers-reduced-motion: reduce`, interactive elements or universal selectors must not nuke transitions with `transition: none` or `transition-duration: 0s`
    const reduceDecls = decls.filter((d) =>
      d.mediaConditions.some((cond) =>
        /prefers-reduced-motion\s*:\s*reduce/i.test(cond),
      ),
    );
    const disablesInteractiveTransitions = reduceDecls.some((d) => {
      const selectorPath = d.selectorChain.join(' ');
      const targetsInteractiveOrGlobal =
        /(\*|nav|\ba\b|\bbutton\b|\.btn|\.card)/i.test(selectorPath);
      if (!targetsInteractiveOrGlobal) return false;
      const trans = d.style.getPropertyValue('transition').trim();
      const transProp = d.style.getPropertyValue('transition-property').trim();
      const transDur = d.style.getPropertyValue('transition-duration').trim();
      return (
        /^none\b/i.test(trans) ||
        /^none\b/i.test(transProp) ||
        /^0(m?s)?$/i.test(transDur)
      );
    });
    expect(disablesInteractiveTransitions).toBe(false);
  });

  test('Auto-running or persistent animations provide a mechanism to pause and resume the animation', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const decls = collectCssDeclarations(stylesheet.cssRules);
    expect(docs.length).toBeGreaterThan(0);

    // 1. HTML has a banner control button in the hero section
    const hasHeroPauseControl = docs.some(({ document }) => {
      const buttons = Array.from(
        document.querySelectorAll('header button, .hero button, button'),
      ) as Array<{ textContent?: string | null; getAttribute(name: string): string | null }>;
      return buttons.some((btn) => {
        const text = btn.textContent || '';
        const label = btn.getAttribute('aria-label') || '';
        return /\bpause\b/i.test(text) || /\bpause\b/i.test(label);
      });
    });
    expect(hasHeroPauseControl).toBe(true);

    // 2. CSS has an infinite animation and a paused state (or JS calls .pause())
    const hasInfiniteAnimation = decls.some((d) => {
      const anim = d.style.getPropertyValue('animation');
      const iter = d.style.getPropertyValue('animation-iteration-count');
      return /\binfinite\b/i.test(anim) || /\binfinite\b/i.test(iter);
    });
    expect(hasInfiniteAnimation).toBe(true);

    const hasCssPausedState = decls.some((d) =>
      /\bpaused\b/i.test(d.style.getPropertyValue('animation-play-state')),
    );
    expect(hasCssPausedState).toBe(true);
  });

  test('JavaScript AnimationEvent and TransitionEvent listeners access the triggered animation via event.animation rather than filtering event.target.getAnimations() by name', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    const propAccesses: PropertyAccessExpression[] = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression),
    );
    const elemAccesses: ElementAccessExpression[] = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.ElementAccessExpression),
    );

    // Must access `.animation` on an event object
    const accessesEventAnimation =
      propAccesses.some((pa) => pa.getName() === 'animation') ||
      elemAccesses.some((ea) => {
        const arg = ea.getArgumentExpression();
        return arg !== undefined && /^['"`]animation['"`]$/.test(arg.getText());
      });
    expect(accessesEventAnimation).toBe(true);

    // Must update `data-last-animation-state` or `dataset.lastAnimationState`
    const setsLastAnimationState =
      propAccesses.some((pa) => pa.getName() === 'lastAnimationState') ||
      sourceFiles.some((sf) =>
        sf
          .getDescendantsOfKind(SyntaxKind.StringLiteral)
          .some((lit) => lit.getLiteralValue() === 'data-last-animation-state'),
      );
    expect(setsLastAnimationState).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        if (
          typeof AnimationEvent !== 'undefined' &&
          !('animation' in AnimationEvent.prototype)
        ) {
          Object.defineProperty(AnimationEvent.prototype, 'animation', {
            value: null,
            writable: true,
            configurable: true,
          });
        }
        if (
          typeof TransitionEvent !== 'undefined' &&
          !('animation' in TransitionEvent.prototype)
        ) {
          Object.defineProperty(TransitionEvent.prototype, 'animation', {
            value: null,
            writable: true,
            configurable: true,
          });
        }
      });
      await page.goto(TARGET_URL);
    });

    test('Clicking View Details opens an animated drink-details overlay with discrete entry/exit transitions and overlay support', async ({
      page,
    }) => {
      const viewDetailsBtn = page
        .locator('.card')
        .getByRole('button', { name: /view details/i })
        .or(page.locator('.card a', { hasText: /view details/i }))
        .first();
      await expect(viewDetailsBtn).toBeVisible();

      await viewDetailsBtn.click();

      const dialog = page.locator('dialog[open], [popover]:popover-open').first();
      await expect(dialog).toBeVisible();

      const overlayStyles = await dialog.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          transitionProperty: cs.transitionProperty,
          transitionBehavior: cs.transitionBehavior,
        };
      });

      expect(overlayStyles.transitionBehavior).toContain('allow-discrete');
      expect(overlayStyles.transitionProperty).toMatch(/\boverlay\b|\ball\b/);
    });

    test('Interactive elements preserve non-motion color or background-color transitions when prefers-reduced-motion: reduce is active', async ({
      page,
      TARGET_URL,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(TARGET_URL);

      // Verify the page actually implements reduced-motion media queries in its stylesheets
      const hasReducedMotionMediaRule = await page.evaluate(() => {
        const checkRules = (rules: CSSRuleList): boolean => {
          for (const rule of Array.from(rules)) {
            if (
              rule instanceof window.CSSMediaRule &&
              /prefers-reduced-motion/i.test(rule.conditionText)
            ) {
              return true;
            }
            if (
              'cssRules' in rule &&
              (rule as CSSGroupingRule).cssRules &&
              checkRules((rule as CSSGroupingRule).cssRules)
            ) {
              return true;
            }
          }
          return false;
        };
        return Array.from(document.styleSheets).some((sheet) =>
          checkRules(sheet.cssRules),
        );
      });
      expect(hasReducedMotionMediaRule).toBe(true);

      const navLink = page.locator('nav a').first();
      await expect(navLink).toBeVisible();

      const linkTransition = await navLink.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          property: cs.transitionProperty,
          duration: cs.transitionDuration,
        };
      });

      expect(linkTransition.property).toMatch(/\b(color|all)\b/i);
      const durations = linkTransition.duration
        .split(',')
        .map((d) => parseFloat(d.trim()));
      expect(durations.some((d) => d > 0.01)).toBe(true);
    });

    test('Hero daily-roast banner animation can be paused and resumed via its control button', async ({
      page,
    }) => {
      const pauseBtn = page
        .locator('header, .hero')
        .getByRole('button', { name: /pause/i })
        .first();
      await expect(pauseBtn).toBeVisible();

      const isPlayingBefore = await page.evaluate(() => {
        const hero = document.querySelector('header, .hero');
        if (!hero) return false;
        const allEls = [hero, ...Array.from(hero.querySelectorAll('*'))];
        return allEls.some((el) => {
          const cs = window.getComputedStyle(el);
          return (
            cs.animationName !== 'none' && cs.animationPlayState === 'running'
          );
        });
      });
      expect(isPlayingBefore).toBe(true);

      await pauseBtn.click();

      const isPausedAfterClick = await page.evaluate(() => {
        const hero = document.querySelector('header, .hero');
        if (!hero) return false;
        const allEls = [hero, ...Array.from(hero.querySelectorAll('*'))];
        return allEls.some((el) => {
          const cs = window.getComputedStyle(el);
          const anims =
            typeof el.getAnimations === 'function' ? el.getAnimations() : [];
          return (
            cs.animationPlayState === 'paused' ||
            anims.some((a) => a.playState === 'paused')
          );
        });
      });
      expect(isPausedAfterClick).toBe(true);

      const resumeBtn = page
        .locator('header, .hero')
        .getByRole('button', { name: /resume|play|pause/i })
        .first();
      await resumeBtn.click();

      const isPlayingAfterResume = await page.evaluate(() => {
        const hero = document.querySelector('header, .hero');
        if (!hero) return false;
        const allEls = [hero, ...Array.from(hero.querySelectorAll('*'))];
        return allEls.some((el) => {
          const cs = window.getComputedStyle(el);
          return (
            cs.animationName !== 'none' && cs.animationPlayState === 'running'
          );
        });
      });
      expect(isPlayingAfterResume).toBe(true);
    });

    test('AnimationEvent and TransitionEvent listeners read event.animation and update body[data-last-animation-state]', async ({
      page,
    }) => {
      const stateAfterSyntheticEvent = await page.evaluate(() => {
        // Ensure `animation` is recognized on AnimationEvent.prototype and TransitionEvent.prototype
        // even in browser engines where it is not yet natively defined on the prototype,
        // so feature-detection checks (`'animation' in AnimationEvent.prototype`) succeed.
        if (
          typeof AnimationEvent !== 'undefined' &&
          !('animation' in AnimationEvent.prototype)
        ) {
          Object.defineProperty(AnimationEvent.prototype, 'animation', {
            value: null,
            writable: true,
            configurable: true,
          });
        }
        if (
          typeof TransitionEvent !== 'undefined' &&
          !('animation' in TransitionEvent.prototype)
        ) {
          Object.defineProperty(TransitionEvent.prototype, 'animation', {
            value: null,
            writable: true,
            configurable: true,
          });
        }

        document.body.removeAttribute('data-last-animation-state');
        const evt = new AnimationEvent('animationstart', {
          bubbles: true,
          animationName: 'synthetic-nonexistent-anim',
        });
        Object.defineProperty(evt, 'animation', {
          value: {
            playState: 'running',
            animationName: 'synthetic-direct-anim',
            effect: { pseudoElement: null },
          },
          configurable: true,
        });
        document.body.dispatchEvent(evt);
        return document.body.getAttribute('data-last-animation-state');
      });

      expect(stateAfterSyntheticEvent).toBeTruthy();
      expect(stateAfterSyntheticEvent).toContain('running');
    });
  });
});
