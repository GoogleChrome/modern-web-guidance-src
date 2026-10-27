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
  type CallExpression,
  type ClassDeclaration,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type SourceFile,
  type StringLiteral,
  type NoSubstitutionTemplateLiteral,
} from 'ts-morph';
import { parseHTML } from 'linkedom';
import { parse, CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getStringLiteralValue(node: any): string | undefined {
  if (!node) return undefined;
  const kind = node.getKind?.();
  if (
    kind === SyntaxKind.StringLiteral ||
    kind === SyntaxKind.NoSubstitutionTemplateLiteral
  ) {
    return (node as StringLiteral | NoSubstitutionTemplateLiteral).getLiteralValue();
  }
  return undefined;
}

function getAllSourceFiles(): SourceFile[] {
  return getJsProject(targetFiles).getSourceFiles();
}

function getAllTemplateDocuments(): any[] {
  const htmlDocs = getHtmlDocuments(targetFiles);
  const templateDocs: any[] = [];

  for (const { document } of htmlDocs) {
    const templates: any[] = Array.from(document.querySelectorAll('template'));
    for (const tmpl of templates) {
      const inner = tmpl.innerHTML || tmpl.textContent || '';
      if (inner.trim()) {
        templateDocs.push(parseHTML(inner).document);
      }
    }
  }

  const sourceFiles = getAllSourceFiles();
  for (const sf of sourceFiles) {
    const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const expr of binaryExprs) {
      if (expr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
      const left = expr.getLeft();
      if (
        left.getKind() === SyntaxKind.PropertyAccessExpression &&
        (left as any).getName() === 'innerHTML'
      ) {
        const rightVal = getStringLiteralValue(expr.getRight());
        if (rightVal) {
          templateDocs.push(parseHTML(rightVal).document);
        }
      }
    }
  }

  return templateDocs;
}

function getShadowStyleSheets(): CSSStyleSheet[] {
  const sheets: CSSStyleSheet[] = [];
  const templateDocs = getAllTemplateDocuments();

  for (const doc of templateDocs) {
    const styleEls: any[] = Array.from(doc.querySelectorAll('style'));
    for (const styleEl of styleEls) {
      const css = styleEl.textContent || '';
      if (css.trim()) {
        sheets.push(parse(css));
      }
    }
  }

  const sourceFiles = getAllSourceFiles();
  for (const sf of sourceFiles) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propName = (expr as any).getName();
        if (propName === 'replaceSync' || propName === 'replace') {
          const argVal = getStringLiteralValue(call.getArguments()[0]);
          if (argVal) {
            sheets.push(parse(argVal));
          }
        }
      }
    }
  }

  return sheets;
}

function collectStyleRules(rules: any[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    } else if (rule && Array.isArray(rule.cssRules)) {
      result.push(...collectStyleRules(Array.from(rule.cssRules)));
    } else if (rule && rule.cssRules) {
      result.push(...collectStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

test.describe('shadow-dom Target Grader', () => {
  test('The custom element attaches an open shadow root (mode: "open") to encapsulate its internal DOM subtree', () => {
    const sourceFiles = getAllSourceFiles();
    const calls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasOpenShadowRoot = calls.some((call: CallExpression) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      if ((expr as any).getName() !== 'attachShadow') return false;

      const firstArg = call.getArguments()[0];
      if (!firstArg || firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
        return false;
      }

      const modeProp = (firstArg as ObjectLiteralExpression).getProperty('mode');
      if (!modeProp || modeProp.getKind() !== SyntaxKind.PropertyAssignment) {
        return false;
      }

      const init = (modeProp as PropertyAssignment).getInitializer();
      return getStringLiteralValue(init) === 'open';
    });

    expect(hasOpenShadowRoot).toBe(true);
  });

  test('The component defines a <template> once outside the constructor and builds each instance shadow root by cloning its .content without assigning innerHTML per instance', () => {
    const sourceFiles = getAllSourceFiles();
    const htmlDocs = getHtmlDocuments(targetFiles);

    // Check that a <template> is defined either in HTML or via document.createElement('template') outside any constructor
    const hasHtmlTemplate = htmlDocs.some(({ document }) =>
      Boolean(document.querySelector('template'))
    );

    const calls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasJsTemplateOutsideConstructor = calls.some((call) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      if ((expr as any).getName() !== 'createElement') return false;
      const arg = getStringLiteralValue(call.getArguments()[0]);
      if (arg?.toLowerCase() !== 'template') return false;
      return !call.getFirstAncestorByKind(SyntaxKind.Constructor);
    });

    // Check that inside a custom element class (constructor or method), .content is cloned via cloneNode(true) or importNode(..., true)
    const classes = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration)
    );

    const clonesTemplateWithoutPerInstanceInnerHTML = classes.some(
      (cls: ClassDeclaration) => {
        const classCalls = cls.getDescendantsOfKind(SyntaxKind.CallExpression);
        const hasCloneCall = classCalls.some((call) => {
          const expr = call.getExpression();
          if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
          const methodName = (expr as any).getName();

          if (methodName === 'cloneNode') {
            const receiver = (expr as any).getExpression();
            const isContent =
              receiver.getKind() === SyntaxKind.PropertyAccessExpression &&
              receiver.getName() === 'content';
            const firstArg = call.getArguments()[0];
            const isTrue = firstArg?.getKind() === SyntaxKind.TrueKeyword;
            return isContent && isTrue;
          }

          if (methodName === 'importNode') {
            const args = call.getArguments();
            const firstArg = args[0];
            const secondArg = args[1];
            const isContent =
              firstArg?.getKind() === SyntaxKind.PropertyAccessExpression &&
              (firstArg as any).getName() === 'content';
            const isTrue = secondArg?.getKind() === SyntaxKind.TrueKeyword;
            return isContent && isTrue;
          }

          return false;
        });

        const binaryExprs = cls.getDescendantsOfKind(SyntaxKind.BinaryExpression);
        const assignsInnerHtmlInInstance = binaryExprs.some((bin) => {
          if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
            return false;
          }
          // Ignore static initializers
          if (bin.getFirstAncestorByKind(SyntaxKind.PropertyDeclaration)?.isStatic()) {
            return false;
          }
          if (bin.getFirstAncestorByKind(SyntaxKind.ClassStaticBlockDeclaration)) {
            return false;
          }
          const left = bin.getLeft();
          return (
            left.getKind() === SyntaxKind.PropertyAccessExpression &&
            (left as any).getName() === 'innerHTML'
          );
        });

        return hasCloneCall && !assignsInnerHtmlInInstance;
      }
    );

    expect(
      (hasHtmlTemplate || hasJsTemplateOutsideConstructor) &&
        clonesTemplateWithoutPerInstanceInnerHTML
    ).toBe(true);
  });

  test('Light DOM children with slot attributes are projected into matching named <slot name="..."> elements inside the shadow root, while unslotted children are projected into the default <slot>', () => {
    const htmlDocs = getHtmlDocuments(targetFiles);
    const templateDocs = getAllTemplateDocuments();

    // Verify Light DOM uses custom elements with slotted children
    const lightSlottedEls = htmlDocs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('[slot]'))
    );
    const usedSlotNames = new Set(
      lightSlottedEls
        .map((el: any) => el.getAttribute('slot')?.trim())
        .filter(Boolean)
    );

    // Check if any custom element in Light DOM has unslotted element children
    const customElementsInLightDom = htmlDocs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('*')).filter((el: any) =>
        el.tagName.includes('-')
      )
    );
    const hasUnslottedLightChildren = customElementsInLightDom.some((ce: any) =>
      Array.from(ce.children).some((child: any) => !child.hasAttribute('slot'))
    );

    // Verify template has matching named <slot name="..."> for every used slot name in Light DOM
    const templateNamedSlots = new Set(
      templateDocs.flatMap((doc) =>
        Array.from(doc.querySelectorAll('slot[name]'))
          .map((slot: any) => slot.getAttribute('name')?.trim())
          .filter(Boolean)
      )
    );

    const allUsedSlotsExistInTemplate =
      usedSlotNames.size > 0 &&
      Array.from(usedSlotNames).every((name) => templateNamedSlots.has(name));

    const hasDefaultSlotInTemplate = templateDocs.some((doc) =>
      Boolean(doc.querySelector('slot:not([name]), slot[name=""]'))
    );

    const defaultSlotSatisfied =
      !hasUnslottedLightChildren || hasDefaultSlotInTemplate;

    expect(
      customElementsInLightDom.length > 0 &&
        allUsedSlotsExistInTemplate &&
        defaultSlotSatisfied
    ).toBe(true);
  });

  test('Adding or removing a slotted Light DOM element after upgrade updates the component state, attributes, or rendered DOM via a slotchange listener using assignedElements() or filtered assignedNodes()', () => {
    const sourceFiles = getAllSourceFiles();
    const calls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasSlotchangeListener = calls.some((call) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      if ((expr as any).getName() !== 'addEventListener') return false;
      const eventName = getStringLiteralValue(call.getArguments()[0]);
      if (eventName !== 'slotchange') return false;
      return Boolean(call.getArguments()[1]);
    });

    const usesAssignedElementsOrFilteredNodes = calls.some((call) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      const mName = (expr as any).getName();
      return mName === 'assignedElements' || mName === 'assignedNodes';
    });

    expect(hasSlotchangeListener && usesAssignedElementsOrFilteredNodes).toBe(true);
  });

  test('Component styles live in the shadow root via adoptedStyleSheets, a <style> element, or a <link rel="stylesheet"> inside the shadow tree', () => {
    const shadowSheets = getShadowStyleSheets();
    const templateDocs = getAllTemplateDocuments();
    const sourceFiles = getAllSourceFiles();

    const hasAdoptedStyleSheets = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((prop) => prop.getName() === 'adoptedStyleSheets')
    );

    const hasTemplateStyleOrLink = templateDocs.some((doc) =>
      Boolean(doc.querySelector('style, link[rel="stylesheet"]'))
    );

    const hasRulesInShadow = shadowSheets.some(
      (sheet) => sheet.cssRules.length > 0
    );

    expect(
      (hasAdoptedStyleSheets || hasTemplateStyleOrLink) && hasRulesInShadow
    ).toBe(true);
  });

  test('A Light DOM element outside the component that uses the same class name as an internal element does not receive the component styles', () => {
    const globalSheet = getCssStyleSheet(targetFiles);
    const globalRules = collectStyleRules(Array.from(globalSheet.cssRules));
    const shadowSheets = getShadowStyleSheets();
    const shadowRules = shadowSheets.flatMap((s) =>
      collectStyleRules(Array.from(s.cssRules))
    );

    // The component's card styles (e.g. .card or article inside shadow root) must not remain leaked as global .card rules
    const hasGlobalCardRule = globalRules.some((r) =>
      r.selectorText
        .split(',')
        .some((sel) => sel.trim() === '.card' || sel.trim().startsWith('.card '))
    );

    const hasEncapsulatedCardRule = shadowRules.some(
      (r) =>
        r.style.getPropertyValue('background') !== '' ||
        r.style.getPropertyValue('background-color') !== '' ||
        r.style.getPropertyValue('border-radius') !== '' ||
        r.style.getPropertyValue('box-shadow') !== ''
    );

    expect(!hasGlobalCardRule && hasEncapsulatedCardRule).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Dynamic slotchange updates component state, attributes, or rendered DOM when slotted Light DOM element is added or removed, ignoring whitespace text nodes', async ({
      page,
    }) => {
      const updatedProperly = await page.evaluate(async () => {
        const cards = Array.from(document.querySelectorAll('.grid > *')).filter(
          (el) => el.shadowRoot
        );
        if (cards.length < 2) return false;

        // Pick a card that currently has no [slot="badge"] child and no limited/badge host attribute
        const targetCard =
          cards.find(
            (c) =>
              !c.querySelector('[slot="badge"]') &&
              !c.hasAttribute('limited') &&
              !c.hasAttribute('badge')
          ) || cards[1];
        const sr = targetCard.shadowRoot!;
        const badgeSlot = sr.querySelector(
          'slot[name="badge"]'
        ) as HTMLSlotElement | null;
        if (!badgeSlot) return false;

        const getSnapshot = () => {
          const hostAttrs = targetCard
            .getAttributeNames()
            .sort()
            .map((a) => `${a}=${targetCard.getAttribute(a)}`)
            .join(';');
          const shadowState = Array.from(sr.querySelectorAll('*'))
            .map(
              (el) =>
                `${el.tagName}:${(el as HTMLElement).hidden}:${el.getAttribute('class') || ''}:${getComputedStyle(el).borderTopWidth}`
            )
            .join('|');
          return `${hostAttrs}__${shadowState}`;
        };

        const initialSnap = getSnapshot();

        // Append whitespace text node in the badge slot — should NOT trigger badge state
        const wsNode = document.createTextNode('   \n  ');
        targetCard.appendChild(wsNode);
        await new Promise((r) => setTimeout(r, 50));
        const afterWhitespaceSnap = getSnapshot();
        wsNode.remove();
        await new Promise((r) => setTimeout(r, 50));

        // Now add a slotted badge element dynamically
        const badgeEl = document.createElement('span');
        badgeEl.setAttribute('slot', 'badge');
        badgeEl.textContent = 'New';
        targetCard.appendChild(badgeEl);
        await new Promise((r) => setTimeout(r, 50));
        const afterAddSnap = getSnapshot();

        // Remove the slotted badge element dynamically
        badgeEl.remove();
        await new Promise((r) => setTimeout(r, 50));
        const afterRemoveSnap = getSnapshot();

        return (
          afterWhitespaceSnap === initialSnap &&
          afterAddSnap !== initialSnap &&
          afterRemoveSnap === initialSnap
        );
      });

      expect(updatedProperly).toBe(true);
    });

    test('A Light DOM element outside the component with an internal class name does not receive the component shadow styles', async ({
      page,
    }) => {
      const isIsolated = await page.evaluate(() => {
        const host = Array.from(document.querySelectorAll('.grid > *')).find(
          (el) => el.shadowRoot
        );
        if (!host || !host.shadowRoot) return false;

        const probe = document.createElement('div');
        probe.className = 'card';
        document.body.appendChild(probe);
        const probeStyle = window.getComputedStyle(probe);
        const probeBoxShadow = probeStyle.boxShadow;
        const probePadding = probeStyle.paddingTop;
        probe.remove();

        return probeBoxShadow === 'none' && probePadding === '0px';
      });

      expect(isIsolated).toBe(true);
    });
  });
});
