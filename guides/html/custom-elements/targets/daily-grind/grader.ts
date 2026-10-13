import * as path from 'path';
import { pathToFileURL } from 'url';
import { SyntaxKind } from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';

const currentFile = typeof __filename !== 'undefined'
  ? __filename
  : path.resolve(process.cwd(), 'grader.ts');
const targetFiles: string[] = getTargetFiles(pathToFileURL(currentFile).href);

test.describe('daily-grind Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('Autonomous custom element is present in markup with a hyphenated kebab-case tag name', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasCustomElement = docs.some(({ document }) => {
      const all = Array.from(document.querySelectorAll('*')) as Array<{ tagName: string }>;
      return all.some(el => {
        const tag = el.tagName.toLowerCase();
        return tag.includes('-') && /^[a-z][a-z0-9]*-[a-z0-9-]*$/.test(tag);
      });
    });
    expect(hasCustomElement).toBe(true);
  });

  test('Custom element defines observedAttributes as a static field or getter', () => {
    const project = getJsProject(targetFiles);
    const hasObservedAttributes = project.getSourceFiles().some(sf => {
      const staticProps = sf.getDescendantsOfKind(SyntaxKind.PropertyDeclaration).some(p => p.isStatic() && p.getName() === 'observedAttributes');
      const staticGetters = sf.getDescendantsOfKind(SyntaxKind.GetAccessor).some(g => g.isStatic() && g.getName() === 'observedAttributes');
      return staticProps || staticGetters;
    });
    expect(hasObservedAttributes).toBe(true);
  });

  test('Stylesheet includes a :not(:defined) rule scoped to the custom element tag name', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const scopedNotDefinedRule = rules.find((r): r is CSSStyleRule => {
      if (!(r instanceof CSSStyleRule)) return false;
      const sel = r.selectorText.trim().toLowerCase();
      if (!sel.includes(':not(:defined)')) return false;
      if (sel.startsWith('body') || sel.startsWith('*') || sel.startsWith('html')) return false;
      return /^[a-z0-9]+-[a-z0-9-]+:not\(:defined\)/i.test(sel);
    });
    expect(Boolean(scopedNotDefinedRule)).toBe(true);
  });

  test('The :not(:defined) rule includes a fallback animation rather than hiding permanently', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const notDefinedRule = rules.find((r): r is CSSStyleRule => {
      if (!(r instanceof CSSStyleRule)) return false;
      const sel = r.selectorText.trim().toLowerCase();
      return sel.includes(':not(:defined)') && !sel.startsWith('body') && !sel.startsWith('*');
    });
    const style = notDefinedRule?.style;
    const hasAnimation = Boolean(
      style?.getPropertyValue('animation') ||
      style?.getPropertyValue('animation-name')
    );
    const displayNone = style?.getPropertyValue('display') === 'none';
    const visibilityHidden = style?.getPropertyValue('visibility') === 'hidden';
    const passes = Boolean(notDefinedRule && hasAnimation && !displayNone && !visibilityHidden);
    expect(passes).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Custom element upgrades without constructor errors and matches :defined', async ({ page }) => {
      const isUpgradedAndDefined = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.tagName.toLowerCase().includes('-'));
        if (!el) return false;
        const tagName = el.tagName.toLowerCase();
        const customConstructor = customElements.get(tagName);
        if (!customConstructor) return false;
        return el instanceof customConstructor && el.matches(':defined');
      });
      expect(isUpgradedAndDefined).toBe(true);
    });

    test('Custom element reads initial markup attributes upon upgrade and renders them in the DOM', async ({ page }) => {
      const rendersInitialAttributes = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.tagName.toLowerCase().includes('-'));
        if (!el) return false;
        const root = el.shadowRoot || el;
        const text = root.textContent || '';
        const initialAttrs = Array.from(el.attributes).filter(attr => attr.value.trim().length > 0);
        if (initialAttrs.length === 0) return false;
        return initialAttrs.some(attr => text.includes(attr.value));
      });
      expect(rendersInitialAttributes).toBe(true);
    });

    test('Calling setAttribute on an observed attribute re-renders the component', async ({ page }) => {
      const updatesOnSetAttribute = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.tagName.toLowerCase().includes('-')) as any;
        if (!el) return false;
        const root = el.shadowRoot || el;
        const observed: string[] = el.constructor.observedAttributes || [];
        if (!observed.includes('label') && !observed.includes('count')) return false;
        const testVal = 'UniqueTestValue987';
        const attrToTest = observed.includes('label') ? 'label' : 'count';
        el.setAttribute(attrToTest, testVal);
        const textAfterAttr = (root.textContent || '');
        return textAfterAttr.includes(testVal);
      });
      expect(updatesOnSetAttribute).toBe(true);
    });

    test('Setting a reflected property does not cause recursion errors', async ({ page }) => {
      const completesWithoutRecursion = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.tagName.toLowerCase().includes('-')) as any;
        if (!el || typeof el.count === 'undefined') return false;
        try {
          el.count = 4;
          return el.count === 4;
        } catch {
          return false;
        }
      });
      expect(completesWithoutRecursion).toBe(true);
    });

    test('Reading a reflected numeric property returns a number, not a string', async ({ page }) => {
      const isNumericType = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.tagName.toLowerCase().includes('-')) as any;
        if (!el || typeof el.count === 'undefined') return false;
        el.setAttribute('count', '5');
        return typeof el.count === 'number' && el.count === 5;
      });
      expect(isNumericType).toBe(true);
    });

    test('Setting a reflected boolean property to false removes the attribute rather than writing "false"', async ({ page }) => {
      const removesBooleanAttribute = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.tagName.toLowerCase().includes('-')) as any;
        if (!el || typeof el.disabled === 'undefined') return false;
        el.disabled = true;
        if (!el.hasAttribute('disabled')) return false;
        el.disabled = false;
        return !el.hasAttribute('disabled') && el.getAttribute('disabled') !== 'false';
      });
      expect(removesBooleanAttribute).toBe(true);
    });

    test('Changing a reflected property updates its corresponding attribute and rendered output', async ({ page }) => {
      const propertyUpdatesAttribute = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.tagName.toLowerCase().includes('-')) as any;
        if (!el || typeof el.count === 'undefined') return false;
        el.count = 8;
        const attrMatches = el.getAttribute('count') === '8';
        const root = el.shadowRoot || el;
        const renderedMatches = (root.textContent || '').includes('8');
        return attrMatches && renderedMatches;
      });
      expect(propertyUpdatesAttribute).toBe(true);
    });

    test('Changing an attribute updates the reflected property', async ({ page }) => {
      const attributeUpdatesProperty = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.tagName.toLowerCase().includes('-')) as any;
        if (!el || typeof el.count === 'undefined') return false;
        el.setAttribute('count', '6');
        return el.count === 6;
      });
      expect(attributeUpdatesProperty).toBe(true);
    });
  });
});
