import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project, type CallExpression } from 'ts-morph';
import type { Document } from 'linkedom';
import { CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore - import.meta.url is valid in Playwright's ESM runner even when package.json lacks "type": "module"
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('shadow-dom Target Grader', () => {
  test('Custom element attaches an open shadow root via attachShadow({ mode: "open" })', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasOpenShadowRoot = callExpressions.some((call: CallExpression) => {
      const expr = call.getExpression();
      const isAttachShadow =
        expr.isKind(SyntaxKind.PropertyAccessExpression) &&
        expr.getName() === 'attachShadow';
      if (!isAttachShadow) return false;

      const args = call.getArguments();
      if (args.length === 0) return false;
      const firstArg = args[0];
      if (!firstArg.isKind(SyntaxKind.ObjectLiteralExpression)) return false;

      return firstArg.getProperties().some((prop) => {
        if (!prop.isKind(SyntaxKind.PropertyAssignment)) return false;
        const propName = prop.getName().replace(/['"`]/g, '');
        const initializer = prop.getInitializer();
        if (propName !== 'mode' || !initializer) return false;
        const val = initializer.getText().replace(/['"`]/g, '');
        return val === 'open';
      });
    });

    expect(hasOpenShadowRoot).toBe(true);
  });

  test('Component clones a <template> content (cloneNode or importNode) when building its shadow tree', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasTemplateClone = callExpressions.some((call: CallExpression) => {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      const methodName = expr.getName();
      if (methodName !== 'cloneNode' && methodName !== 'importNode') return false;

      const args = call.getArguments();
      return args.some((arg) => arg.getKind() === SyntaxKind.TrueKeyword);
    });

    expect(hasTemplateClone).toBe(true);
  });

  test('Template and custom elements use named slots and matching Light DOM slot attributes', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const project: Project = getJsProject(targetFiles);

    const hasLightDomSlottedElements = docs.some((d) =>
      Boolean(d.document.querySelector('.grid [slot], main [slot]'))
    );

    const hasTemplateSlotsInHtml = docs.some((d) => {
      const templates = Array.from(d.document.querySelectorAll('template'));
      return templates.some((tmpl: any) => {
        const root = tmpl.content || tmpl;
        return Boolean(root.querySelector && root.querySelector('slot'));
      });
    });

    const hasTemplateSlotsInJs = project.getSourceFiles().some((sf) => {
      const literals = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.TemplateExpression),
      ];
      return literals.some((lit) => lit.getText().includes('<slot'));
    });

    expect(hasLightDomSlottedElements && (hasTemplateSlotsInHtml || hasTemplateSlotsInJs)).toBe(true);
  });

  test('Component styles are encapsulated inside the shadow root rather than global .card styles', () => {
    const globalStylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const globalRules = Array.from(globalStylesheet.cssRules);
    const hasGlobalCardRule = globalRules.some(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.trim() === '.card'
    );

    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasTemplateStyle = docs.some((d) => {
      const templates = Array.from(d.document.querySelectorAll('template'));
      return templates.some((tmpl: any) => {
        const root = tmpl.content || tmpl;
        return Boolean(
          root.querySelector && root.querySelector('style, link[rel="stylesheet"]')
        );
      });
    });

    const project: Project = getJsProject(targetFiles);
    const hasConstructedStyleSheet = project.getSourceFiles().some((sf) => {
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      return propAccesses.some(
        (pa) => pa.getName() === 'adoptedStyleSheets' || pa.getName() === 'replaceSync'
      );
    });

    expect(!hasGlobalCardRule && (hasTemplateStyle || hasConstructedStyleSheet)).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Seasonal cards render with an open shadowRoot containing projected slot elements', async ({ page }) => {
      const isShadowRenderedAndProjected = await page.evaluate(() => {
        const grid = document.querySelector('.grid');
        if (!grid || grid.children.length === 0) return false;
        const cards = Array.from(grid.children);
        return cards.every((card) => {
          if (!card.tagName.includes('-') || !card.shadowRoot) return false;
          const slots = Array.from(card.shadowRoot.querySelectorAll('slot'));
          if (slots.length === 0) return false;
          const totalAssigned = slots.reduce(
            (count, slot) => count + slot.assignedElements().length,
            0
          );
          return totalAssigned > 0;
        });
      });

      expect(isShadowRenderedAndProjected).toBe(true);
    });

    test('Light DOM element with .card class outside the component does not receive encapsulated card styles', async ({ page }) => {
      const externalCardBg = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.className = 'card';
        document.body.appendChild(probe);
        const bg = window.getComputedStyle(probe).backgroundColor;
        probe.remove();
        return bg;
      });

      expect(externalCardBg).toBe('rgba(0, 0, 0, 0)');
    });
  });
});
