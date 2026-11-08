import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import { CSSStyleRule, CSSKeyframesRule, CSSKeyframeRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore - import.meta.url is supported in the Playwright ESM runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('custom-elements Target Grader', () => {

  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('Autonomous custom elements are registered via customElements.define() with a hyphenated kebab-case tag name', () => {
    const project: Project = getJsProject(targetFiles);
    const callExprs = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const defineCalls = callExprs.filter(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        return (
          propAccess.getName() === 'define' &&
          propAccess.getExpression().getText().includes('customElements')
        );
      }
      return false;
    });

    expect(defineCalls.length).toBeGreaterThan(0);

    const resolveTagString = (node: any): string | null => {
      if (!node) return null;
      const kind = node.getKind();
      if (kind === SyntaxKind.StringLiteral || kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
        return node.getText().slice(1, -1);
      }
      if (kind === SyntaxKind.Identifier) {
        const defs = node.getDefinitions?.() ?? [];
        for (const def of defs) {
          const decl = def.getDeclarationNode?.();
          const init = decl?.getInitializer?.();
          if (init) {
            const resolved = resolveTagString(init);
            if (resolved) return resolved;
          }
        }
      }
      if (kind === SyntaxKind.PropertyAccessExpression) {
        const propName = node.getName();
        const objText = node.getExpression().getText();
        for (const sf of project.getSourceFiles()) {
          for (const cls of sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
            if (cls.getName() === objText) {
              const prop = cls.getProperty(propName);
              const init = prop?.getInitializer?.();
              if (init) {
                const resolved = resolveTagString(init);
                if (resolved) return resolved;
              }
              const getter = cls.getGetAccessor(propName);
              const ret = getter?.getDescendantsOfKind(SyntaxKind.ReturnStatement)?.[0]?.getExpression();
              if (ret) {
                const resolved = resolveTagString(ret);
                if (resolved) return resolved;
              }
            }
          }
        }
      }
      return null;
    };

    const hasValidKebabTag = defineCalls.some(call => {
      const args = call.getArguments();
      if (args.length < 2) return false;
      const tagName = resolveTagString(args[0]);
      return tagName !== null && /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tagName);
    });

    expect(hasValidKebabTag).toBe(true);
  });

function collectAllRules(ruleList: Iterable<unknown>): unknown[] {
  const out: unknown[] = [];
  for (const rule of ruleList) {
    out.push(rule);
    if (
      rule &&
      typeof rule === 'object' &&
      !(rule instanceof CSSKeyframesRule) &&
      'cssRules' in rule &&
      rule.cssRules
    ) {
      out.push(...collectAllRules(rule.cssRules as Iterable<unknown>));
    }
  }
  return out;
}

  test('The stylesheet includes a :not(:defined) rule scoped to the custom element tag name that fails open via CSS animation', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = collectAllRules(stylesheet.cssRules);

    const styleRules = rules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const keyframesRules = rules.filter((r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule);
    const notDefinedRules = styleRules.filter(r => r.selectorText.includes(':not(:defined)'));
    expect(notDefinedRules.length).toBeGreaterThan(0);

    const parseTimeMs = (token: string): number => {
      const value = parseFloat(token);
      if (!Number.isFinite(value)) return 0;
      return token.toLowerCase().endsWith('ms') ? value : value * 1000;
    };

    const validRule = notDefinedRules.find(r => {
      const selectors = r.selectorText.split(',').map(s => s.trim());
      const isScopedToCustomElement = selectors.every(sel => {
        if (!sel.includes(':not(:defined)')) return false;
        const beforeNotDefined = sel.split(':not(:defined)')[0].replace(/:has\(\s*$/, '').trim();
        if (!beforeNotDefined) return false;
        if (/^(?:html|body|:root|\*)$/i.test(beforeNotDefined)) return false;
        const hasCustomTag = /\b[a-z][a-z0-9]*(-[a-z0-9]+)+\b/i.test(sel);
        const hasScopedSubtree = /[.#[]/.test(beforeNotDefined) || /\b(?!html\b|body\b)[a-z][a-z0-9-]*\b/i.test(beforeNotDefined);
        return hasCustomTag || hasScopedSubtree;
      });
      if (!isScopedToCustomElement) return false;

      const displayVal = r.style.getPropertyValue('display').trim();
      if (displayVal === 'none') return false;

      const animation = r.style.getPropertyValue('animation').trim();
      const animationName = r.style.getPropertyValue('animation-name').trim();
      const hasAnimation =
        (animation.length > 0 && animation !== 'none') ||
        (animationName.length > 0 && animationName !== 'none');

      const animationDelay = r.style.getPropertyValue('animation-delay').trim();
      const timeTokens = animation
        .split(/[\s,]+/)
        .filter(token => /^(?:\d*\.\d+|\d+)(?:ms|s)$/i.test(token));
      const hasDelay =
        (timeTokens.length >= 2 && parseTimeMs(timeTokens[1]) > 0) ||
        (animationDelay.length > 0 && parseTimeMs(animationDelay) > 0);

      if (!hasAnimation || !hasDelay) return false;

      const visibilityVal = r.style.getPropertyValue('visibility').trim();
      if (visibilityVal === 'hidden') {
        const animTokens = `${animation} ${animationName}`
          .split(/[\s,]+/)
          .map(t => t.replace(/^["']|["']$/g, '').trim())
          .filter(Boolean);
        const matchingKeyframes = keyframesRules.filter(kf => animTokens.includes(kf.name));
        const revealsVisibility = matchingKeyframes.some(kf =>
          Array.from(kf.cssRules).some(
            entry =>
              entry instanceof CSSKeyframeRule &&
              entry.style.getPropertyValue('visibility')?.trim() === 'visible',
          ),
        );
        if (!revealsVisibility) return false;
      }

      return true;
    });

    expect(validRule).toBeDefined();
    expect(keyframesRules.length).toBeGreaterThan(0);
  });

  test('observedAttributes is a static field or static getter present when customElements.define() runs', () => {
    const project: Project = getJsProject(targetFiles);
    const classDecls = project.getSourceFiles().flatMap(sf => [
      ...sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration),
      ...sf.getDescendantsOfKind(SyntaxKind.ClassExpression),
    ]);

    const customElementClasses = classDecls.filter(cls => {
      const heritage = cls.getHeritageClauses();
      return heritage.some(h => h.getText().includes('HTMLElement'));
    });

    expect(customElementClasses.length).toBeGreaterThan(0);

    const hasStaticObservedAttributes = customElementClasses.some(cls => {
      const hasStaticProp = cls.getProperties().some(
        p => p.isStatic() && p.getName() === 'observedAttributes'
      );
      const hasStaticGetter = cls.getGetAccessors().some(
        g => g.isStatic() && g.getName() === 'observedAttributes'
      );
      if (hasStaticProp || hasStaticGetter) return true;

      const sf = cls.getSourceFile();
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some(call =>
        call.getArguments().some(arg => arg.getText().includes('observedAttributes'))
      );
    });

    expect(hasStaticObservedAttributes).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {

    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Autonomous custom elements upgrade without constructor errors and match :defined', async ({ page }) => {
      const result = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const customEls = allElements.filter(el => el.tagName.includes('-'));
        if (customEls.length === 0) return { count: 0, allDefined: false, constructorOk: false };

        const ctors = new Set<CustomElementConstructor>();
        const allDefined = customEls.every(el => {
          const Ctor = customElements.get(el.tagName.toLowerCase());
          if (!Ctor) return false;
          ctors.add(Ctor);
          return el.matches(':defined') && el instanceof Ctor;
        });
        if (!allDefined || ctors.size === 0) {
          return { count: customEls.length, allDefined: false, constructorOk: false };
        }

        let constructorOk = true;
        for (const Ctor of ctors) {
          try {
            const instance = new Ctor();
            if (!(instance instanceof HTMLElement) || !instance.matches(':defined')) {
              constructorOk = false;
              break;
            }
          } catch {
            constructorOk = false;
            break;
          }
        }

        return { count: customEls.length, allDefined, constructorOk };
      });

      expect(result.count).toBeGreaterThan(0);
      expect(result.allDefined).toBe(true);
      expect(result.constructorOk).toBe(true);
    });

    test('A custom element with observed attributes reads initial attribute values in markup upon upgrade and renders the initial state', async ({ page }) => {
      const result = await page.evaluate(() => {
        const observedEls = Array.from(document.querySelectorAll('*')).filter(el => {
          if (!el.tagName.includes('-') || !el.matches(':defined')) return false;
          const Ctor = customElements.get(el.tagName.toLowerCase()) as any;
          const observed: string[] = Ctor?.observedAttributes || [];
          return Array.isArray(observed) && observed.length > 0;
        });
        if (observedEls.length === 0) return { count: 0, renderedCount: 0 };

        const isValueReflected = (node: Element, value: string): boolean => {
          const v = value.trim();
          if (!v) return false;
          const root = node.shadowRoot || node;
          const rootText = root.textContent || '';
          if (rootText.includes(v)) return true;
          const attrNames = ['href', 'src', 'alt', 'title', 'aria-label', 'value', 'data-value'];
          for (const child of Array.from(root.querySelectorAll('*'))) {
            for (const attrName of attrNames) {
              const attrVal = child.getAttribute(attrName);
              if (attrVal && attrVal.includes(v)) return true;
            }
          }
          return false;
        };

        let renderedCount = 0;
        for (const el of observedEls) {
          const Ctor = customElements.get(el.tagName.toLowerCase()) as any;
          const observed: string[] = Ctor?.observedAttributes || [];
          const presentObserved = observed.filter(attr => el.hasAttribute(attr) && (el.getAttribute(attr) ?? '') !== '');
          if (presentObserved.some(attr => isValueReflected(el, el.getAttribute(attr)!))) {
            renderedCount++;
          }
        }

        return { count: observedEls.length, renderedCount };
      });

      expect(result.count).toBeGreaterThan(0);
      expect(result.renderedCount).toBe(result.count);
    });

    test('Calling setAttribute() on an observed attribute triggers attributeChangedCallback and re-renders without recursion when setting a reflected property', async ({ page }) => {
      // Lifecycle callbacks are snapshotted at customElements.define(), so wrapping the callback
      // on an upgraded instance never counts. Wrap the class prototype before registration instead.
      await page.addInitScript(() => {
        const counts: Record<string, number> = {};
        (window as any).__graderAttrChangedCounts = counts;
        const origDefine = customElements.define.bind(customElements);
        customElements.define = (name: string, ctor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
          const proto = ctor.prototype as any;
          const origCallback = proto.attributeChangedCallback;
          if (typeof origCallback === 'function') {
            proto.attributeChangedCallback = function (...args: any[]) {
              counts[name] = (counts[name] ?? 0) + 1;
              return origCallback.apply(this, args);
            };
          }
          return origDefine(name, ctor, options);
        };
      });
      await page.reload();

      const result = await page.evaluate(async () => {
        const el = Array.from(document.querySelectorAll('*')).find(e => {
          if (!e.tagName.includes('-') || !e.matches(':defined')) return false;
          const Ctor = customElements.get(e.tagName.toLowerCase()) as any;
          return Array.isArray(Ctor?.observedAttributes) && Ctor.observedAttributes.length > 0;
        }) as any;
        if (!el) return null;

        const tagName = el.tagName.toLowerCase();
        const Ctor = customElements.get(tagName) as any;
        const observed: string[] = Ctor?.observedAttributes || [];
        if (!Array.isArray(observed) || observed.length === 0) return null;

        const isValueReflected = (node: Element, value: string): boolean => {
          const v = value.trim();
          if (!v) return false;
          const root = node.shadowRoot || node;
          if ((root.textContent || '').includes(v)) return true;
          const attrNames = ['href', 'src', 'alt', 'title', 'aria-label', 'value', 'data-value'];
          for (const child of Array.from(root.querySelectorAll('*'))) {
            for (const attrName of attrNames) {
              const attrVal = child.getAttribute(attrName);
              if (attrVal && attrVal.includes(v)) return true;
            }
          }
          return false;
        };

        const toProp = (attr: string): string | null => {
          const camel = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          if (camel in el) return camel;
          if (attr in el) return attr;
          return null;
        };

        const isNumericOrBoolean = (attr: string, prop: string): boolean => {
          if (typeof el[prop] === 'boolean' || typeof el[prop] === 'number') return true;
          const prev = el.getAttribute(attr);
          el.setAttribute(attr, '3');
          const numeric = typeof el[prop] === 'number' && el[prop] === 3;
          if (prev === null) el.removeAttribute(attr);
          else el.setAttribute(attr, prev);
          return numeric;
        };

        const counts: Record<string, number> = (window as any).__graderAttrChangedCounts;
        const callbackCalls = () => counts[tagName] ?? 0;

        const preferred = ['name', 'title', 'label', 'heading', 'description', 'cta', 'image-alt', 'alt'];
        const stringCandidates = [
          ...preferred.filter(a => observed.includes(a)),
          ...observed.filter(a => !preferred.includes(a)),
        ].filter(attr => {
          const prop = toProp(attr);
          return prop !== null && !isNumericOrBoolean(attr, prop);
        });

        const newVal = 'Test-Roast-Special-99';
        let strAttr = observed[0];
        let strProp: string = toProp(strAttr) || strAttr;
        let callbackFired = false;
        let renderedAfterAttr = false;

        for (const attr of stringCandidates) {
          const prop = toProp(attr)!;
          const before = callbackCalls();
          el.setAttribute(attr, newVal);
          await Promise.resolve();
          const fired = callbackCalls() > before;
          const rendered = isValueReflected(el, newVal);
          if (fired && rendered) {
            strAttr = attr;
            strProp = prop;
            callbackFired = true;
            renderedAfterAttr = true;
            break;
          }
        }

        if (!callbackFired || !renderedAfterAttr) {
          const before = callbackCalls();
          el.setAttribute(strAttr, newVal);
          await Promise.resolve();
          callbackFired = callbackCalls() > before;
          renderedAfterAttr = isValueReflected(el, newVal);
        }

        let noRecursion = true;
        const beforePropCalls = callbackCalls();
        const propVal = 'Reflected-Property-Roast-42';
        try {
          el[strProp] = propVal;
          await Promise.resolve();
        } catch {
          noRecursion = false;
        }
        const deltaCalls = callbackCalls() - beforePropCalls;
        if (deltaCalls > 5) noRecursion = false;
        const renderedAfterProp = isValueReflected(el, propVal);

        return {
          hasObserved: observed.length > 0,
          callbackFired,
          renderedAfterAttr,
          noRecursion,
          renderedAfterProp,
        };
      });

      expect(result).not.toBeNull();
      expect(result!.hasObserved).toBe(true);
      expect(result!.callbackFired).toBe(true);
      expect(result!.renderedAfterAttr).toBe(true);
      expect(result!.noRecursion).toBe(true);
      expect(result!.renderedAfterProp).toBe(true);
    });

    test('When the custom element reflects a numeric property, reading the property returns a number, not a string', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => {
          if (!e.tagName.includes('-') || !e.matches(':defined')) return false;
          const Ctor = customElements.get(e.tagName.toLowerCase()) as any;
          return Array.isArray(Ctor?.observedAttributes) && Ctor.observedAttributes.length > 0;
        }) as any;
        if (!el) return null;

        const Ctor = customElements.get(el.tagName.toLowerCase()) as any;
        const observed: string[] = Ctor?.observedAttributes || [];

        const candidates = ['count', 'price', ...observed];
        for (const attr of candidates) {
          const prop = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          if (prop in el) {
            const prevAttr = el.getAttribute(attr);
            el.setAttribute(attr, '3');
            const val = el[prop];
            if (prevAttr === null) el.removeAttribute(attr);
            else el.setAttribute(attr, prevAttr);

            if (typeof val === 'number' && val === 3) {
              return { found: true, type: typeof val, value: val };
            }
          }
        }
        return { found: false, type: 'undefined', value: null };
      });

      expect(result).not.toBeNull();
      expect(result!.found).toBe(true);
      expect(result!.type).toBe('number');
      expect(result!.value).toBe(3);
    });

    test('When the custom element reflects a boolean property, setting the property to false removes the attribute rather than writing "false"', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => {
          if (!e.tagName.includes('-') || !e.matches(':defined')) return false;
          const Ctor = customElements.get(e.tagName.toLowerCase()) as any;
          return Array.isArray(Ctor?.observedAttributes) && Ctor.observedAttributes.length > 0;
        }) as any;
        if (!el) return null;

        const Ctor = customElements.get(el.tagName.toLowerCase()) as any;
        const observed: string[] = Ctor?.observedAttributes || [];

        const candidates = ['featured', 'disabled', 'sold-out', ...observed];
        for (const attr of candidates) {
          const prop = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          if (prop in el && typeof el[prop] === 'boolean') {
            el[prop] = true;
            const hasWhenTrue = el.hasAttribute(attr);
            const valWhenTrue = el.getAttribute(attr);

            el[prop] = false;
            const hasWhenFalse = el.hasAttribute(attr);
            const valWhenFalse = el.getAttribute(attr);

            return {
              found: true,
              hasWhenTrue,
              valWhenTrue,
              hasWhenFalse,
              valWhenFalse,
            };
          }
        }
        return { found: false, hasWhenTrue: false, valWhenTrue: null, hasWhenFalse: true, valWhenFalse: 'false' };
      });

      expect(result).not.toBeNull();
      expect(result!.found).toBe(true);
      expect(result!.hasWhenTrue).toBe(true);
      expect(result!.hasWhenFalse).toBe(false);
      expect(result!.valWhenFalse).toBeNull();
    });

    test('Changing either a reflected property or its attribute updates the other and the rendered output', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const el = Array.from(document.querySelectorAll('*')).find(e => {
          if (!e.tagName.includes('-') || !e.matches(':defined')) return false;
          const Ctor = customElements.get(e.tagName.toLowerCase()) as any;
          return Array.isArray(Ctor?.observedAttributes) && Ctor.observedAttributes.length > 0;
        }) as any;
        if (!el) return null;

        const Ctor = customElements.get(el.tagName.toLowerCase()) as any;
        const observed: string[] = Ctor?.observedAttributes || [];
        if (!Array.isArray(observed) || observed.length === 0) return null;

        const isValueReflected = (node: Element, value: string): boolean => {
          const v = value.trim();
          if (!v) return false;
          const root = node.shadowRoot || node;
          if ((root.textContent || '').includes(v)) return true;
          const attrNames = ['href', 'src', 'alt', 'title', 'aria-label', 'value', 'data-value'];
          for (const child of Array.from(root.querySelectorAll('*'))) {
            for (const attrName of attrNames) {
              const attrVal = child.getAttribute(attrName);
              if (attrVal && attrVal.includes(v)) return true;
            }
          }
          return false;
        };

        const toProp = (attr: string): string | null => {
          const camel = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          if (camel in el) return camel;
          if (attr in el) return attr;
          return null;
        };

        // Discover reflected numeric property/attribute pairs
        const numericPairs: Array<{ attr: string; prop: string; supportsFloat: boolean }> = [];
        const numOrder = ['price', 'count', 'rating', 'quantity', ...observed];
        const seenNum = new Set<string>();
        for (const attr of numOrder) {
          if (!observed.includes(attr) || seenNum.has(attr)) continue;
          seenNum.add(attr);
          const prop = toProp(attr);
          if (!prop || typeof el[prop] === 'boolean') continue;
          const prev = el.getAttribute(attr);
          el.setAttribute(attr, '3');
          const isNum = typeof el[prop] === 'number' && el[prop] === 3;
          let supportsFloat = false;
          if (isNum) {
            el.setAttribute(attr, '6.25');
            supportsFloat = el[prop] === 6.25;
          }
          if (prev === null) el.removeAttribute(attr);
          else el.setAttribute(attr, prev);
          if (isNum) numericPairs.push({ attr, prop, supportsFloat });
        }

        // Discover reflected string property/attribute pair that renders to DOM
        const numAttrs = new Set(numericPairs.map(p => p.attr));
        const strPreferred = ['name', 'title', 'label', 'heading', 'description', 'cta', 'image-alt', 'alt'];
        const strOrder = [
          ...strPreferred.filter(a => observed.includes(a)),
          ...observed.filter(a => !strPreferred.includes(a)),
        ].filter(attr => {
          if (numAttrs.has(attr)) return false;
          const prop = toProp(attr);
          return prop !== null && typeof el[prop] !== 'boolean';
        });

        let stringSync = false;
        let attrFromProp: string | null = null;
        let renderedFromProp = false;
        let propFromAttr: unknown = null;
        let renderedFromAttr = false;

        for (const strAttr of strOrder) {
          const strProp = toProp(strAttr)!;
          el[strProp] = 'Hazelnut-Cortado';
          await Promise.resolve();
          const a1 = el.getAttribute(strAttr);
          const r1 = isValueReflected(el, 'Hazelnut-Cortado');

          el.setAttribute(strAttr, 'Vanilla-Flat-White');
          await Promise.resolve();
          const p2 = el[strProp];
          const r2 = isValueReflected(el, 'Vanilla-Flat-White');

          attrFromProp = a1;
          renderedFromProp = r1;
          propFromAttr = p2;
          renderedFromAttr = r2;
          if (a1 === 'Hazelnut-Cortado' && r1 && p2 === 'Vanilla-Flat-White' && r2) {
            stringSync = true;
            break;
          }
        }

        // Test Numeric Property <-> Attribute & Rendered Output
        let numericSync = false;
        const orderedNumPairs = [
          ...numericPairs.filter(p => p.supportsFloat),
          ...numericPairs.filter(p => !p.supportsFloat),
        ];
        for (const { attr, prop, supportsFloat } of orderedNumPairs) {
          const v1 = supportsFloat ? 6.25 : 4;
          const s1 = String(v1);
          const s2 = supportsFloat ? '7.5' : '2';
          const v2 = Number(s2);

          el[prop] = v1;
          await Promise.resolve();
          const numAttr1 = el.getAttribute(attr);
          const numRendered1 = isValueReflected(el, s1);

          el.setAttribute(attr, s2);
          await Promise.resolve();
          const numProp2 = el[prop];
          const numRendered2 = isValueReflected(el, s2) || isValueReflected(el, v2.toFixed(2));

          if (numAttr1 === s1 && numRendered1 && numProp2 === v2 && numRendered2) {
            numericSync = true;
            break;
          }
        }

        return {
          stringSync,
          attrFromProp,
          renderedFromProp,
          propFromAttr,
          renderedFromAttr,
          numericSync,
        };
      });

      expect(result).not.toBeNull();
      expect(result!.stringSync).toBe(true);
      expect(result!.numericSync).toBe(true);
    });
  });
});
