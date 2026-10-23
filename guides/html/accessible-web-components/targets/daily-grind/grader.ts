import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import type { Page } from '@playwright/test';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('daily-grind Target Grader', () => {

  // --- STATIC ASSERTIONS ---

  test('Default semantic role is exposed via ElementInternals and never set on the host', () => {
    const project = getJsProject(targetFiles);
    const htmlDocs = getHtmlDocuments(targetFiles);

    const customElementsInHtml = htmlDocs.flatMap(d =>
      Array.from(d.document.querySelectorAll('*')).filter((el: any) => el.tagName.includes('-'))
    );

    const setsRoleViaInternals = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      const callsAttachInternals = text.includes('attachInternals()');
      const assignsRole = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some(expr => {
        const left = expr.getLeft().getText();
        const op = expr.getOperatorToken().getText();
        return left.endsWith('.role') && op === '=';
      });
      return callsAttachInternals && assignsRole;
    });

    const htmlHasHostRole = customElementsInHtml.some((el: any) => el.hasAttribute('role'));

    const passed = customElementsInHtml.length > 0 && setsRoleViaInternals && !htmlHasHostRole;
    expect(passed).toBe(true);
  });

  test('Initial state is exposed via ElementInternals without matching aria-* attribute on host', () => {
    const project = getJsProject(targetFiles);
    const htmlDocs = getHtmlDocuments(targetFiles);

    const customElementsInHtml = htmlDocs.flatMap(d =>
      Array.from(d.document.querySelectorAll('*')).filter((el: any) => el.tagName.includes('-'))
    );

    const setsStateViaInternals = project.getSourceFiles().some(sf => {
      return sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some(expr => {
        const left = expr.getLeft().getText();
        const op = expr.getOperatorToken().getText();
        return (
          op === '=' &&
          (left.endsWith('.ariaChecked') || left.endsWith('.ariaPressed') || left.endsWith('.ariaExpanded'))
        );
      });
    });

    const htmlHasHostAriaState = customElementsInHtml.some((el: any) =>
      el.hasAttribute('aria-checked') || el.hasAttribute('aria-pressed') || el.hasAttribute('aria-expanded')
    );

    const passed = customElementsInHtml.length > 0 && setsStateViaInternals && !htmlHasHostAriaState;
    expect(passed).toBe(true);
  });

  test('Host tabIndex is set in connectedCallback with guard and not in constructor or static elements', () => {
    const project = getJsProject(targetFiles);
    const classes = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration).concat(sf.getDescendantsOfKind(SyntaxKind.ClassExpression) as any)
    );

    let tabIndexValid = false;
    if (classes.length > 0) {
      const isInteractiveHostClass = (cls: any) => {
        const text = cls.getText();
        return (
          text.includes('attachInternals') &&
          !text.includes('delegatesFocus: true') &&
          !text.includes('delegatesFocus:true') &&
          (/\.role\s*=|setHostRole\s*\(/.test(text) ||
            /\.aria(Checked|Pressed|Expanded)\s*=|setHostAria(Checked|Pressed|Expanded)\s*\(/.test(text))
        );
      };

      const interactiveClasses = classes.filter(isInteractiveHostClass);

      const allInteractiveValid = interactiveClasses.length > 0 && interactiveClasses.every(cls => {
        const constructor = cls.getConstructors()[0];
        const constructorSetsTabIndex = constructor ? constructor.getText().includes('this.tabIndex') : false;
        const connectedCallback = cls.getMethod('connectedCallback');
        const connectedText = connectedCallback ? connectedCallback.getText() : '';
        const connectedSetsTabIndex = connectedText.includes('tabIndex') && connectedText.includes('tabindex');

        return !constructorSetsTabIndex && connectedSetsTabIndex;
      });

      const staticClasses = classes.filter(cls => !isInteractiveHostClass(cls));
      const staticDoNotSetTabIndex = staticClasses.every(cls => !cls.getText().includes('this.tabIndex'));

      tabIndexValid = allInteractiveValid && staticDoNotSetTabIndex;
    }

    expect(tabIndexValid).toBe(true);
  });

  test('When accessible name comes from aria-labelledby, referenced ID is in the same tree', () => {
    const htmlDocs = getHtmlDocuments(targetFiles);
    const customElementsInHtml = htmlDocs.flatMap(d =>
      Array.from(d.document.querySelectorAll('*')).filter((el: any) => el.tagName.includes('-'))
    );

    let valid = false;
    if (customElementsInHtml.length > 0) {
      valid = htmlDocs.every(({ document }) => {
        const labelledEls = Array.from(document.querySelectorAll('*')).filter((el: any) =>
          el.tagName.includes('-') && el.hasAttribute('aria-labelledby')
        );
        return labelledEls.every((el: any) => {
          const id = el.getAttribute('aria-labelledby');
          return Boolean(document.getElementById(id));
        });
      });
    }

    expect(valid).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {

    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await page.evaluate(async () => {
        const customTag = Array.from(document.querySelectorAll('*'))
          .map(el => el.tagName.toLowerCase())
          .find(tag => tag.includes('-'));
        if (customTag && window.customElements) {
          await window.customElements.whenDefined(customTag);
        }
      });
    });

    async function getInteractiveControl(page: Page) {
      const session = await page.context().newCDPSession(page);
      try {
        const { root } = await session.send('DOM.getDocument', { depth: -1 });
        const { nodes: axNodes } = await session.send('Accessibility.getFullAXTree');

        const elements = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('*')).filter(el => el.tagName.includes('-'));
          return els.map((el, idx) => {
            if (!el.id) {
              el.setAttribute('data-grader-idx', String(idx));
            }
            return {
              tagName: el.tagName.toLowerCase(),
              id: el.id,
              selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}[data-grader-idx="${idx}"]`,
            };
          });
        });

        for (const item of elements) {
          const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: item.selector });
          if (!nodeId) continue;
          const { node: domNode } = await session.send('DOM.describeNode', { nodeId });
          const axNode = axNodes.find((n: any) => n.backendDOMNodeId === domNode.backendNodeId);
          if (!axNode) continue;
          const stateProp = axNode.properties?.find((p: any) => ['checked', 'pressed', 'expanded'].includes(p.name));
          if (stateProp) {
            return {
              selector: item.selector,
              tagName: item.tagName,
              role: axNode.role?.value,
              name: axNode.name?.value,
              stateProp: stateProp.name,
              stateValue: String(stateProp.value?.value),
            };
          }
        }
        return null;
      } finally {
        await session.detach();
      }
    }

    async function getControlState(page: Page, selector: string) {
      const session = await page.context().newCDPSession(page);
      try {
        const { root } = await session.send('DOM.getDocument', { depth: -1 });
        const { nodes: axNodes } = await session.send('Accessibility.getFullAXTree');
        const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
        if (!nodeId) return null;
        const { node: domNode } = await session.send('DOM.describeNode', { nodeId });
        const axNode = axNodes.find((n: any) => n.backendDOMNodeId === domNode.backendNodeId);
        if (!axNode) return null;
        const stateProp = axNode.properties?.find((p: any) => ['checked', 'pressed', 'expanded'].includes(p.name));
        return {
          role: axNode.role?.value,
          name: axNode.name?.value,
          stateProp: stateProp?.name,
          stateValue: stateProp ? String(stateProp.value?.value) : null,
        };
      } finally {
        await session.detach();
      }
    }

    test('Host element receives focus and is in the tab order', async ({ page }) => {
      const control = await getInteractiveControl(page);
      let focusOnHost = false;
      if (control) {
        focusOnHost = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return false;
          el.focus();
          return document.activeElement === el;
        }, control.selector);
      }
      const passed = Boolean(control && focusOnHost);
      expect(passed).toBe(true);
    });

    test('Clicking the control toggles its state in the accessibility tree', async ({ page }) => {
      const control = await getInteractiveControl(page);
      let afterState = null;
      if (control) {
        await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          el?.click();
        }, control.selector);
        afterState = await getControlState(page, control.selector);
      }
      const passed = Boolean(
        control &&
        afterState &&
        control.stateValue !== null &&
        afterState.stateValue !== null &&
        control.stateValue !== afterState.stateValue
      );
      expect(passed).toBe(true);
    });

    test('Pressing Space while focused toggles state in the accessibility tree', async ({ page }) => {
      const control = await getInteractiveControl(page);
      let afterState = null;
      if (control) {
        await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          el?.focus();
        }, control.selector);
        await page.keyboard.press('Space');
        afterState = await getControlState(page, control.selector);
      }
      const passed = Boolean(
        control &&
        afterState &&
        control.stateValue !== null &&
        afterState.stateValue !== null &&
        control.stateValue !== afterState.stateValue
      );
      expect(passed).toBe(true);
    });

    test('No aria-* state attribute is added to the host when state changes', async ({ page }) => {
      const control = await getInteractiveControl(page);
      let hostHasAriaState = false;
      let stateToggled = false;
      if (control) {
        await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          el?.click();
        }, control.selector);
        const afterState = await getControlState(page, control.selector);
        stateToggled = Boolean(afterState && control.stateValue !== afterState.stateValue);
        hostHasAriaState = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel);
          return Boolean(
            el && (el.hasAttribute('aria-checked') || el.hasAttribute('aria-pressed') || el.hasAttribute('aria-expanded'))
          );
        }, control.selector);
      }
      const passed = Boolean(control && stateToggled && !hostHasAriaState);
      expect(passed).toBe(true);
    });

    test('Custom element has a non-empty accessible name', async ({ page }) => {
      const control = await getInteractiveControl(page);
      const passed = Boolean(control && control.name && control.name.trim().length > 0);
      expect(passed).toBe(true);
    });
  });
});
