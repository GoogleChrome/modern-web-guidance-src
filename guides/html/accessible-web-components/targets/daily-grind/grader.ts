import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type ClassDeclaration,
  type PropertyAccessExpression,
} from 'ts-morph';

// @ts-ignore - import.meta.url is supported at runtime by Playwright/ESM
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getCustomElementClasses(): ClassDeclaration[] {
  const project = getJsProject(targetFiles);
  return project
    .getSourceFiles()
    .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration))
    .filter((cls) => {
      const ext = cls.getExtends();
      return ext ? /\bHTMLElement\b/.test(ext.getText()) : false;
    });
}

function getPropertyAccessAssignments(
  cls: ClassDeclaration,
  propPattern: RegExp
): PropertyAccessExpression[] {
  return cls
    .getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .filter((bin) => bin.getOperatorToken().getText() === '=')
    .map((bin) => bin.getLeft())
    .filter((left): left is PropertyAccessExpression => {
      if (left.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      return propPattern.test((left as PropertyAccessExpression).getName());
    });
}

test.describe('accessible-web-components Target Grader', () => {
  test('Places interactive control host in tab order (tabIndex = 0 in connectedCallback when no tabindex attribute exists, not in constructor)', () => {
    const classes = getCustomElementClasses();
    const validTabIndexInConnectedCallback = classes.some((cls) => {
      const ctor = cls.getConstructors()[0];
      const ctorSetsTabIndex = ctor
        ? ctor
            .getDescendantsOfKind(SyntaxKind.BinaryExpression)
            .some(
              (bin) =>
                bin.getOperatorToken().getText() === '=' &&
                bin.getLeft().getKind() ===
                  SyntaxKind.PropertyAccessExpression &&
                (bin.getLeft() as PropertyAccessExpression).getName() ===
                  'tabIndex'
            )
        : false;

      const connectedCb = cls.getMethod('connectedCallback');
      if (!connectedCb) return false;

      const checksTabindexAttr = connectedCb
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          const expr = call.getExpression();
          const args = call.getArguments();
          return (
            expr.getKind() === SyntaxKind.PropertyAccessExpression &&
            (expr as PropertyAccessExpression).getName() === 'hasAttribute' &&
            args.length > 0 &&
            args[0].getText().replace(/['"`]/g, '').toLowerCase() === 'tabindex'
          );
        });

      const setsTabIndexZero = connectedCb
        .getDescendantsOfKind(SyntaxKind.BinaryExpression)
        .some(
          (bin) =>
            bin.getOperatorToken().getText() === '=' &&
            bin.getLeft().getKind() === SyntaxKind.PropertyAccessExpression &&
            (bin.getLeft() as PropertyAccessExpression).getName() ===
              'tabIndex' &&
            bin.getRight().getText() === '0'
        );

      return !ctorSetsTabIndex && checksTabindexAttr && setsTabIndexZero;
    });

    expect(validTabIndexInConnectedCallback).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Exposes default semantic role via ElementInternals without setting a role attribute on the host element', async ({
      page,
    }) => {
      const classes = getCustomElementClasses();
      const setsRoleViaInternals = classes.some((cls) => {
        const hasAttachInternals = cls
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((call) => {
            const expr = call.getExpression();
            return (
              expr.getKind() === SyntaxKind.PropertyAccessExpression &&
              (expr as PropertyAccessExpression).getName() === 'attachInternals'
            );
          });
        const assignsRole =
          getPropertyAccessAssignments(cls, /^role$/).length > 0;
        return hasAttachInternals && assignsRole;
      });

      const runtimeCheck = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter((el) =>
          el.tagName.includes('-')
        );
        return (
          hosts.length > 0 && hosts.every((el) => !el.hasAttribute('role'))
        );
      });

      expect(setsRoleViaInternals && runtimeCheck).toBe(true);
    });

    test('Exposes initial state (checked, pressed, or expanded) in the accessibility tree via ElementInternals without a matching aria-* attribute on the host', async ({
      page,
    }) => {
      const classes = getCustomElementClasses();
      const setsStateViaInternals = classes.some(
        (cls) =>
          getPropertyAccessAssignments(
            cls,
            /^(ariaChecked|ariaPressed|ariaExpanded)$/
          ).length > 0
      );

      const runtimeStateCheck = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter((el) =>
          el.tagName.includes('-')
        );
        if (hosts.length === 0) return false;
        return hosts.every(
          (el) =>
            !el.hasAttribute('aria-checked') &&
            !el.hasAttribute('aria-pressed') &&
            !el.hasAttribute('aria-expanded')
        );
      });

      const snapshot = await page.locator('body').ariaSnapshot();
      const hasInitialRoleInTree = /\b(switch|checkbox|button)\b/.test(snapshot);

      expect(
        setsStateViaInternals && runtimeStateCheck && hasInitialRoleInTree
      ).toBe(true);
    });

    test('Interactive control host element receives focus directly', async ({
      page,
    }) => {
      const hostReceivesFocus = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter(
          (el): el is HTMLElement =>
            el instanceof HTMLElement && el.tagName.includes('-')
        );
        if (hosts.length === 0) return false;
        const host = hosts[0];
        if (host.tabIndex !== 0) return false;
        host.focus();
        return (
          document.activeElement === host &&
          (!host.shadowRoot || host.shadowRoot.activeElement === null)
        );
      });

      expect(hostReceivesFocus).toBe(true);
    });

    test('Clicking the custom element control toggles its state in the accessibility tree', async ({
      page,
    }) => {
      const hostTag = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find((node) =>
          node.tagName.includes('-')
        );
        return el ? el.tagName.toLowerCase() : null;
      });

      const hostLocator = page
        .locator(hostTag || 'non-existent-custom-element')
        .first();
      const beforeSnapshot = await hostLocator.ariaSnapshot().catch(() => '');
      if (hostTag) {
        await hostLocator.click();
      }
      const afterClickSnapshot = await hostLocator
        .ariaSnapshot()
        .catch(() => '');
      const beforeChecked = /\[checked\]|\[pressed\]|\[expanded\]/.test(
        beforeSnapshot
      );
      const afterChecked = /\[checked\]|\[pressed\]|\[expanded\]/.test(
        afterClickSnapshot
      );

      expect(Boolean(hostTag) && beforeChecked !== afterChecked).toBe(true);
    });

    test('Pressing Space while the custom element control has focus toggles its state in the accessibility tree', async ({
      page,
    }) => {
      const hostTag = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && node.tagName.includes('-')
        );
        if (el) el.focus();
        return el ? el.tagName.toLowerCase() : null;
      });

      const hostLocator = page
        .locator(hostTag || 'non-existent-custom-element')
        .first();
      const beforeSnapshot = await hostLocator.ariaSnapshot().catch(() => '');
      if (hostTag) {
        await page.keyboard.press('Space');
      }
      const afterSpaceSnapshot = await hostLocator
        .ariaSnapshot()
        .catch(() => '');
      const beforeChecked = /\[checked\]|\[pressed\]|\[expanded\]/.test(
        beforeSnapshot
      );
      const afterChecked = /\[checked\]|\[pressed\]|\[expanded\]/.test(
        afterSpaceSnapshot
      );

      expect(Boolean(hostTag) && beforeChecked !== afterChecked).toBe(true);
    });

    test('No aria-* state attribute is added to the host when the state changes', async ({
      page,
    }) => {
      const hostTag = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find((node) =>
          node.tagName.includes('-')
        );
        return el ? el.tagName.toLowerCase() : null;
      });

      const hostLocator = page
        .locator(hostTag || 'non-existent-custom-element')
        .first();
      if (hostTag) {
        await hostLocator.click();
        await hostLocator.focus();
        await page.keyboard.press('Space');
        await hostLocator.click();
      }

      const noAriaStateAttributes = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter(
          (node) => node.tagName.includes('-')
        );
        if (hosts.length === 0) return false;
        return hosts.every(
          (el) =>
            !el.hasAttribute('aria-checked') &&
            !el.hasAttribute('aria-pressed') &&
            !el.hasAttribute('aria-expanded')
        );
      });

      expect(noAriaStateAttributes).toBe(true);
    });

    test('Interactive custom element has a non-empty accessible name and valid same-tree or outward cross-boundary ARIA label references', async ({
      page,
    }) => {
      const hostTag = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find((node) =>
          node.tagName.includes('-')
        );
        return el ? el.tagName.toLowerCase() : null;
      });

      const hostLocator = page
        .locator(hostTag || 'non-existent-custom-element')
        .first();
      const snapshot = await hostLocator.ariaSnapshot().catch(() => '');
      const hasAccessibleName = /"[^"]+"/.test(snapshot);

      const validLabelRefs = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter(
          (node) => node.tagName.includes('-')
        );
        if (hosts.length === 0) return false;

        return hosts.every((host) => {
          const ariaLabelledBy = host.getAttribute('aria-labelledby');
          if (ariaLabelledBy) {
            const root = host.getRootNode() as Document | ShadowRoot;
            const ids = ariaLabelledBy.trim().split(/\s+/);
            const allInSameTree = ids.every((id) =>
              Boolean(root.getElementById(id))
            );
            if (!allInSameTree) return false;
          }

          const labelledByEls = (
            host as HTMLElement & { ariaLabelledByElements?: Element[] | null }
          ).ariaLabelledByElements;
          if (labelledByEls && labelledByEls.length > 0) {
            const pointsIntoOwnShadow = Array.from(labelledByEls).some(
              (target) =>
                host.shadowRoot !== null &&
                target.getRootNode() === host.shadowRoot
            );
            if (pointsIntoOwnShadow) return false;
          }

          return true;
        });
      });

      expect(Boolean(hostTag) && hasAccessibleName && validLabelRefs).toBe(
        true
      );
    });
  });
});
