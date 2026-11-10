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
import type { Page } from '@playwright/test';

// @ts-ignore - import.meta.url is supported at runtime by Playwright/ESM
const targetFiles: string[] = getTargetFiles(import.meta.url);

const TOGGLE_ROLES = ['switch', 'checkbox', 'button', 'menuitemcheckbox'];

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

async function getBackendNodeId(
  session: Awaited<ReturnType<ReturnType<Page['context']>['newCDPSession']>>,
  expression: string
): Promise<number | null> {
  const evalRes = await session.send('Runtime.evaluate', {
    expression,
    returnByValue: false,
  });
  const objectId = evalRes.result?.objectId;
  if (!objectId) return null;
  try {
    const { node } = await session.send('DOM.describeNode', { objectId });
    return node.backendNodeId ?? null;
  } finally {
    await session.send('Runtime.releaseObject', { objectId }).catch(() => {});
  }
}

async function getInteractiveControl(page: Page) {
  const session = await page.context().newCDPSession(page);
  try {
    const { nodes: axNodes } = await session.send('Accessibility.getFullAXTree');

    const hostCount = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*')).filter((el) =>
        el.tagName.includes('-')
      );
      els.forEach((el, idx) => {
        el.setAttribute('data-grader-idx', String(idx));
      });
      return els.length;
    });

    for (let idx = 0; idx < hostCount; idx++) {
      const selector = `[data-grader-idx="${idx}"]`;
      const hostInfo = await page.evaluate((sel: string) => {
        const host = document.querySelector(sel);
        if (!host) return null;
        const innerNative = host.shadowRoot?.querySelector(
          'button, input:not([type="hidden"]), select, textarea, a[href]'
        );
        return {
          tagName: host.tagName.toLowerCase(),
          hasInnerNative: Boolean(innerNative),
        };
      }, selector);
      if (!hostInfo) continue;

      const hostBackendId = await getBackendNodeId(
        session,
        `document.querySelector(${JSON.stringify(selector)})`
      );
      const hostAx = hostBackendId
        ? axNodes.find((n: any) => n.backendDOMNodeId === hostBackendId)
        : null;
      const hostStateProp = hostAx?.properties?.find((p: any) =>
        ['checked', 'pressed', 'expanded'].includes(p.name)
      );
      if (hostAx && hostStateProp && !hostInfo.hasInnerNative) {
        return {
          mode: 'host' as const,
          selector,
          tagName: hostInfo.tagName,
          role: hostAx.role?.value,
          name: hostAx.name?.value,
          stateProp: hostStateProp.name,
          stateValue: String(hostStateProp.value?.value),
          nameSources: (hostAx.name?.sources ?? []) as Array<{
            attribute?: string;
            invalid?: boolean;
          }>,
        };
      }

      if (hostInfo.hasInnerNative) {
        const innerBackendId = await getBackendNodeId(
          session,
          `document.querySelector(${JSON.stringify(selector)})?.shadowRoot?.querySelector('button, input:not([type="hidden"]), select, textarea, a[href]')`
        );
        const innerAx = innerBackendId
          ? axNodes.find((n: any) => n.backendDOMNodeId === innerBackendId)
          : null;
        const innerStateProp = innerAx?.properties?.find((p: any) =>
          ['checked', 'pressed', 'expanded'].includes(p.name)
        );
        if (innerAx && innerStateProp) {
          return {
            mode: 'internal' as const,
            selector,
            tagName: hostInfo.tagName,
            role: innerAx.role?.value,
            name: innerAx.name?.value,
            stateProp: innerStateProp.name,
            stateValue: String(innerStateProp.value?.value),
            nameSources: (innerAx.name?.sources ?? []) as Array<{
              attribute?: string;
              invalid?: boolean;
            }>,
          };
        }
      }
    }
    return null;
  } finally {
    await session.detach();
  }
}

async function getControlState(
  page: Page,
  selector: string,
  mode: 'host' | 'internal'
) {
  const session = await page.context().newCDPSession(page);
  try {
    const { nodes: axNodes } = await session.send('Accessibility.getFullAXTree');
    const expr =
      mode === 'host'
        ? `document.querySelector(${JSON.stringify(selector)})`
        : `document.querySelector(${JSON.stringify(selector)})?.shadowRoot?.querySelector('button, input:not([type="hidden"]), select, textarea, a[href]')`;
    const backendNodeId = await getBackendNodeId(session, expr);
    if (!backendNodeId) return null;
    const axNode = axNodes.find((n: any) => n.backendDOMNodeId === backendNodeId);
    if (!axNode) return null;
    const stateProp = axNode.properties?.find((p: any) =>
      ['checked', 'pressed', 'expanded'].includes(p.name)
    );
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

async function clickControl(page: Page, selector: string, mode: 'host' | 'internal') {
  await page.evaluate(
    ({ sel, m }: { sel: string; m: 'host' | 'internal' }) => {
      const host = document.querySelector(sel) as HTMLElement | null;
      if (!host) return;
      const target =
        m === 'internal'
          ? (host.shadowRoot?.querySelector(
              'button, input:not([type="hidden"]), select, textarea, a[href]'
            ) as HTMLElement | null)
          : host;
      target?.click();
    },
    { sel: selector, m: mode }
  );
}

async function focusControl(page: Page, selector: string) {
  await page.evaluate((sel: string) => {
    const host = document.querySelector(sel) as HTMLElement | null;
    host?.focus();
  }, selector);
}

test.describe('accessible-web-components Target Grader', () => {
  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await page.evaluate(async () => {
        if (!window.customElements) return;
        const undefinedTags = new Set(
          Array.from(document.querySelectorAll(':not(:defined)'))
            .map((el) => el.tagName.toLowerCase())
            .filter((tag) => tag.includes('-'))
        );
        await Promise.race([
          Promise.all(
            Array.from(undefinedTags).map((tag) =>
              window.customElements.whenDefined(tag)
            )
          ),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      });
    });

    test('Places interactive control host in tab order (tabIndex = 0 in connectedCallback when no tabindex attribute exists, not in constructor)', async ({
      page,
    }) => {
      const control = await getInteractiveControl(page);
      if (!control) {
        expect(control).not.toBeNull();
        return;
      }

      const classes = getCustomElementClasses();
      const ctorSetsTabIndex = classes.some((cls) => {
        const ctor = cls.getConstructors()[0];
        return ctor
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
      });
      expect(ctorSetsTabIndex).toBe(false);

      if (control.mode === 'internal') {
        const internalFocusOk = await page.evaluate((sel: string) => {
          const host = document.querySelector(sel) as HTMLElement | null;
          if (!host) return false;
          const hostInTabOrder =
            host.hasAttribute('tabindex') || host.tabIndex >= 0;
          const inner = host.shadowRoot?.querySelector(
            'button, input:not([type="hidden"]), select, textarea, a[href]'
          ) as HTMLElement | null;
          return (
            !hostInTabOrder &&
            Boolean(inner) &&
            inner!.tabIndex >= 0 &&
            !inner!.hasAttribute('disabled')
          );
        }, control.selector);
        expect(internalFocusOk).toBe(true);
        return;
      }

      const validTabIndexInConnectedCallback = classes.some((cls) => {
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
              args[0].getText().replace(/['"`]/g, '').toLowerCase() ===
                'tabindex'
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

        return checksTabindexAttr && setsTabIndexZero;
      });

      expect(validTabIndexInConnectedCallback).toBe(true);
    });

    test('Exposes default semantic role via ElementInternals without setting a role attribute on the host element', async ({
      page,
    }) => {
      const control = await getInteractiveControl(page);
      const runtimeCheck = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter((el) =>
          el.tagName.includes('-')
        );
        return (
          hosts.length > 0 && hosts.every((el) => !el.hasAttribute('role'))
        );
      });

      if (!control || !runtimeCheck) {
        expect(Boolean(control) && runtimeCheck).toBe(true);
        return;
      }

      if (control.mode === 'internal') {
        expect(TOGGLE_ROLES.includes(control.role)).toBe(true);
        return;
      }

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

      expect(setsRoleViaInternals).toBe(true);
    });

    test('Exposes initial state (checked, pressed, or expanded) in the accessibility tree via ElementInternals without a matching aria-* attribute on the host', async ({
      page,
    }) => {
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

      const control = await getInteractiveControl(page);
      const hasInitialRoleAndStateInTree = Boolean(
        control &&
          TOGGLE_ROLES.includes(control.role) &&
          control.stateProp &&
          (control.stateValue === 'true' || control.stateValue === 'false')
      );

      if (!runtimeStateCheck || !hasInitialRoleAndStateInTree || !control) {
        expect(runtimeStateCheck && hasInitialRoleAndStateInTree).toBe(true);
        return;
      }

      if (control.mode === 'host') {
        const classes = getCustomElementClasses();
        const setsStateViaInternals = classes.some(
          (cls) =>
            getPropertyAccessAssignments(
              cls,
              /^(ariaChecked|ariaPressed|ariaExpanded)$/
            ).length > 0
        );
        expect(setsStateViaInternals).toBe(true);
      } else {
        expect(hasInitialRoleAndStateInTree).toBe(true);
      }
    });

    test('Interactive control host element receives focus directly', async ({
      page,
    }) => {
      const control = await getInteractiveControl(page);
      const hostReceivesFocus = control
        ? await page.evaluate(
            ({ sel, mode }: { sel: string; mode: 'host' | 'internal' }) => {
              const host = document.querySelector(sel);
              if (!(host instanceof HTMLElement)) return false;
              if (mode === 'internal') {
                const inner = host.shadowRoot?.querySelector(
                  'button, input:not([type="hidden"]), select, textarea, a[href]'
                ) as HTMLElement | null;
                if (!inner) return false;
                host.focus();
                return (
                  document.activeElement === host &&
                  host.shadowRoot?.activeElement === inner
                );
              }
              if (host.tabIndex !== 0) return false;
              host.focus();
              return (
                document.activeElement === host &&
                (!host.shadowRoot || host.shadowRoot.activeElement === null)
              );
            },
            { sel: control.selector, mode: control.mode }
          )
        : false;

      expect(hostReceivesFocus).toBe(true);
    });

    test('Clicking the custom element control toggles its state in the accessibility tree', async ({
      page,
    }) => {
      const control = await getInteractiveControl(page);
      let afterState = null;
      if (control) {
        await clickControl(page, control.selector, control.mode);
        afterState = await getControlState(page, control.selector, control.mode);
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

    test('Pressing Space while the custom element control has focus toggles its state in the accessibility tree', async ({
      page,
    }) => {
      const control = await getInteractiveControl(page);
      let afterState = null;
      if (control) {
        await focusControl(page, control.selector);
        await page.keyboard.press('Space');
        afterState = await getControlState(page, control.selector, control.mode);
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

    test('No aria-* state attribute is added to the host when the state changes', async ({
      page,
    }) => {
      const control = await getInteractiveControl(page);
      let stateToggled = false;
      let noAriaStateAttributes = false;
      if (control) {
        await clickControl(page, control.selector, control.mode);
        const afterState = await getControlState(
          page,
          control.selector,
          control.mode
        );
        stateToggled = Boolean(
          afterState && control.stateValue !== afterState.stateValue
        );
        noAriaStateAttributes = await page.evaluate(() => {
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
      }

      expect(Boolean(control && stateToggled && noAriaStateAttributes)).toBe(
        true
      );
    });

    test('Interactive custom element has a non-empty accessible name and valid same-tree or outward cross-boundary ARIA label references', async ({
      page,
    }) => {
      const control = await getInteractiveControl(page);
      const hasAccessibleName = Boolean(
        control && control.name && control.name.trim().length > 0
      );

      // CDP reports aria-labelledby (attribute or ariaLabelledByElements)
      // references that do not resolve to a valid same-tree or outward target
      // (e.g. into the host's own shadow root) as an invalid name source.
      const validLabelRefs = Boolean(
        control &&
          !control.nameSources.some(
            (src) => src.attribute === 'aria-labelledby' && src.invalid
          )
      );

      expect(Boolean(control) && hasAccessibleName && validLabelRefs).toBe(
        true
      );
    });
  });
});
