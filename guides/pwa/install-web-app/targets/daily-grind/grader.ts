import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Document } from 'linkedom';
import { SyntaxKind, type Project } from 'ts-morph';
import {
  test,
  expect,
  skipUnless,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';

const targetFiles: string[] = getTargetFiles(import.meta.url);

const SUCCESS_TEXT_RE = /\b(installed|opened|launch(?:ed)?)\b/i;
const ABORTED_TEXT_RE = /\b(cancel(?:l?ed)?|abort(?:ed)?|could\s+not\s+complete|did\s+not\s+complete)\b/i;
const INVALID_DATA_TEXT_RE = /\b(invalid|could\s+not\s+start)\b/i;

function findManifestData(docs: Array<{ file: string; document: Document }>) {
  for (const { file, document } of docs) {
    const links = Array.from(document.querySelectorAll('link[rel="manifest"]')) as any[];
    for (const link of links) {
      const href = link.getAttribute('href')?.trim();
      if (!href) continue;

      const cleanHref = href.split(/[?#]/)[0].replace(/^\//, '');
      const candidatePaths = [
        path.resolve(path.dirname(file), cleanHref),
        path.resolve(process.cwd(), cleanHref),
        ...targetFiles.filter((f) => path.basename(f) === path.basename(cleanHref)),
      ];

      for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          const raw = fs.readFileSync(candidate, 'utf8');
          const parsed = JSON.parse(raw);
          return { href, file: candidate, manifest: parsed };
        }
      }
    }
  }
  return null;
}

function hasInstallElementInDocs(docs: Array<{ file: string; document: Document }>): boolean {
  return docs.some(({ document }) => Boolean(document.querySelector('install')));
}

function hasCustomInstallMechanismInAst(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  const hasNavigatorInstall = sourceFiles.some((sf) =>
    sf
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((pae) => pae.getName() === 'install' && /\b(navigator|Navigator)\b/.test(pae.getExpression().getText())),
  );
  const hasBeforeInstallPrompt = sourceFiles.some((sf) =>
    sf
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .some((lit) => lit.getLiteralValue() === 'beforeinstallprompt'),
  );
  return hasNavigatorInstall || hasBeforeInstallPrompt;
}

const FIND_CUSTOM_INSTALL_BUTTON_SOURCE = `
  (() => {
    const byId = document.querySelector('button#install-app, [role="button"]#install-app, button[id*="install" i], [id*="install" i][role="button"]');
    if (byId && byId.tagName.toLowerCase() !== 'install') return byId;
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    return buttons.find((el) => el.tagName.toLowerCase() !== 'install' && /\\binstall\\b/i.test((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.id || ''))) || null;
  })()
`;

const READ_STATUS_TEXT_SOURCE = `
  (() => {
    const statusEl = document.querySelector('#install-status, [role="status"], [aria-live], output');
    if (statusEl && (statusEl.textContent || '').trim()) {
      return (statusEl.textContent || '').trim();
    }
    return (document.body.textContent || '').trim();
  })()
`;

test.describe('install-web-app Target Grader', () => {
  test('The document links to a web app manifest whose id provides a stable identity for the installable app', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const manifestData = findManifestData(docs);
    expect(manifestData).not.toBeNull();
    expect(typeof manifestData?.manifest?.id).toBe('string');
    expect(manifestData?.manifest?.id.trim().length).toBeGreaterThan(0);
  });

  test('The page contains either an <install> element that offers browser-controlled installation of the current web app, or a custom install button that uses navigator.install() or the beforeinstallprompt event', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const project: Project = getJsProject(targetFiles);

    const installEls = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('install')) as any[],
    );
    const hasCurrentAppInstallEl = installEls.some((el) => {
      const manifestAttr = el.getAttribute('manifest');
      return !manifestAttr || !/^https?:\/\//i.test(manifestAttr) || manifestAttr.startsWith('/');
    });

    const hasCustomButtonInDom = docs.some(({ document }) =>
      Array.from(document.querySelectorAll('button, [role="button"]')).some((el: any) => {
        const text = `${el.textContent || ''} ${el.getAttribute('id') || ''} ${el.getAttribute('aria-label') || ''}`;
        return /\binstall\b/i.test(text);
      }),
    );
    const hasCustomInstall = hasCustomButtonInDom && hasCustomInstallMechanismInAst(project);

    expect(hasCurrentAppInstallEl || hasCustomInstall).toBe(true);
  });

  test.describe('Browser tests', () => {
    test('When the page uses an <install> element, a "success" installresult event reports that the app was installed or opened', async ({
      page,
      TARGET_URL,
    }) => {
      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const project: Project = getJsProject(targetFiles);
      expect(hasInstallElementInDocs(docs) || hasCustomInstallMechanismInAst(project)).toBe(true);

      await page.goto(TARGET_URL);
      const hasInstallEl = (await page.locator('install').count()) > 0;
      if (hasInstallEl) {
        const statusText = await page.evaluate(() => {
          const el = document.querySelector('install')!;
          const ev = new Event('installresult');
          Object.defineProperty(ev, 'result', { value: 'success', enumerable: true });
          el.dispatchEvent(ev);
          const s = document.querySelector('#install-status, [role="status"], [aria-live], output');
          return s ? (s.textContent || '').trim() : '';
        });
        expect(statusText).toMatch(SUCCESS_TEXT_RE);
      } else {
        const hasHandler = project
          .getSourceFiles()
          .some((sf) => sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((s) => SUCCESS_TEXT_RE.test(s.getLiteralValue())));
        expect(hasHandler).toBe(true);
      }
    });

    test('When the page uses an <install> element, an "aborted" installresult event reports that installation was canceled or could not complete', async ({
      page,
      TARGET_URL,
    }) => {
      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const project: Project = getJsProject(targetFiles);
      expect(hasInstallElementInDocs(docs) || hasCustomInstallMechanismInAst(project)).toBe(true);

      await page.goto(TARGET_URL);
      const hasInstallEl = (await page.locator('install').count()) > 0;
      if (hasInstallEl) {
        const statusText = await page.evaluate(() => {
          const el = document.querySelector('install')!;
          const ev = new Event('installresult');
          Object.defineProperty(ev, 'result', { value: 'aborted', enumerable: true });
          el.dispatchEvent(ev);
          const s = document.querySelector('#install-status, [role="status"], [aria-live], output');
          return s ? (s.textContent || '').trim() : '';
        });
        expect(statusText).toMatch(ABORTED_TEXT_RE);
      } else {
        const hasHandler = project
          .getSourceFiles()
          .some((sf) => sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((s) => ABORTED_TEXT_RE.test(s.getLiteralValue())));
        expect(hasHandler).toBe(true);
      }
    });

    test('When the page uses an <install> element, an "invalid-data" installresult event reports that installation could not start because the app data is invalid', async ({
      page,
      TARGET_URL,
    }) => {
      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const project: Project = getJsProject(targetFiles);
      expect(hasInstallElementInDocs(docs) || hasCustomInstallMechanismInAst(project)).toBe(true);

      await page.goto(TARGET_URL);
      const hasInstallEl = (await page.locator('install').count()) > 0;
      if (hasInstallEl) {
        const statusText = await page.evaluate(() => {
          const el = document.querySelector('install')!;
          const ev = new Event('installresult');
          Object.defineProperty(ev, 'result', { value: 'invalid-data', enumerable: true });
          el.dispatchEvent(ev);
          const s = document.querySelector('#install-status, [role="status"], [aria-live], output');
          return s ? (s.textContent || '').trim() : '';
        });
        expect(statusText).toMatch(INVALID_DATA_TEXT_RE);
      } else {
        const hasHandler = project
          .getSourceFiles()
          .some((sf) => sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((s) => INVALID_DATA_TEXT_RE.test(s.getLiteralValue())));
        expect(hasHandler).toBe(true);
      }
    });

    test('When navigator.install() and beforeinstallprompt are unsupported, any custom install button remains hidden', async ({
      page,
      TARGET_URL,
    }) => {
      skipUnless({ unsupported: 'navigator-install, beforeinstallprompt' });

      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const project: Project = getJsProject(targetFiles);
      expect(hasInstallElementInDocs(docs) || hasCustomInstallMechanismInAst(project)).toBe(true);

      await page.addInitScript(() => {
        try {
          delete (Navigator.prototype as any).install;
        } catch {
          // ignore
        }
        try {
          delete (navigator as any).install;
        } catch {
          // ignore
        }
      });

      await page.goto(TARGET_URL);

      const isCustomButtonVisible = await page.evaluate((findBtnSrc) => {
        // eslint-disable-next-line no-eval
        const btn = eval(findBtnSrc) as HTMLElement | null;
        if (!btn) return false;
        const style = window.getComputedStyle(btn);
        return !btn.hidden && style.display !== 'none' && style.visibility !== 'hidden';
      }, FIND_CUSTOM_INSTALL_BUTTON_SOURCE);

      expect(isCustomButtonVisible).toBe(false);
    });

    test('When the page uses a custom install button and navigator.install() is available, the button is visible and activating it requests installation exactly once', async ({
      page,
      TARGET_URL,
    }) => {
      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const project: Project = getJsProject(targetFiles);
      expect(hasInstallElementInDocs(docs) || hasCustomInstallMechanismInAst(project)).toBe(true);

      await page.addInitScript(() => {
        (window as any).__installCalls = 0;
        const mockInstall = function () {
          (window as any).__installCalls++;
          return new Promise<void>((resolve) => {
            (window as any).__resolveInstall = resolve;
          });
        };
        Object.defineProperty(Navigator.prototype, 'install', {
          value: mockInstall,
          configurable: true,
          writable: true,
        });
      });

      await page.goto(TARGET_URL);

      const hasCustomBtn = await page.evaluate((findBtnSrc) => {
        // eslint-disable-next-line no-eval
        return Boolean(eval(findBtnSrc));
      }, FIND_CUSTOM_INSTALL_BUTTON_SOURCE);

      if (hasCustomBtn) {
        const result = await page.evaluate(async (findBtnSrc) => {
          // eslint-disable-next-line no-eval
          const btn = eval(findBtnSrc) as HTMLElement;
          const style = window.getComputedStyle(btn);
          const visibleBefore = !btn.hidden && style.display !== 'none' && style.visibility !== 'hidden';
          btn.click();
          // Click a second time while in-flight to verify single-activation guard or single request per activation
          btn.click();
          const callsWhilePending = (window as any).__installCalls;
          if ((window as any).__resolveInstall) {
            (window as any).__resolveInstall();
          }
          await new Promise((r) => setTimeout(r, 20));
          return { visibleBefore, callsWhilePending };
        }, FIND_CUSTOM_INSTALL_BUTTON_SOURCE);

        expect(result.visibleBefore).toBe(true);
        expect(result.callsWhilePending).toBe(1);
      } else {
        await expect(page.locator('install')).toHaveCount(1);
      }
    });

    test("When navigator.install() is unsupported and the page uses a custom install button, a beforeinstallprompt event reveals the button and activating it calls the captured event's prompt() method exactly once", async ({
      page,
      TARGET_URL,
    }) => {
      skipUnless({ unsupported: 'navigator-install' });

      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const project: Project = getJsProject(targetFiles);
      expect(hasInstallElementInDocs(docs) || hasCustomInstallMechanismInAst(project)).toBe(true);

      await page.addInitScript(() => {
        try {
          delete (Navigator.prototype as any).install;
        } catch {
          // ignore
        }
        try {
          delete (navigator as any).install;
        } catch {
          // ignore
        }
      });

      await page.goto(TARGET_URL);

      const hasCustomBtn = await page.evaluate((findBtnSrc) => {
        // eslint-disable-next-line no-eval
        return Boolean(eval(findBtnSrc));
      }, FIND_CUSTOM_INSTALL_BUTTON_SOURCE);

      if (hasCustomBtn) {
        const result = await page.evaluate(async (findBtnSrc) => {
          // eslint-disable-next-line no-eval
          const btn = eval(findBtnSrc) as HTMLElement;
          let promptCalls = 0;
          const bipEvent = new Event('beforeinstallprompt', { cancelable: true }) as any;
          bipEvent.prompt = () => {
            promptCalls++;
            return Promise.resolve();
          };
          bipEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
          window.dispatchEvent(bipEvent);

          const style = window.getComputedStyle(btn);
          const visibleAfterEvent = !btn.hidden && style.display !== 'none' && style.visibility !== 'hidden';
          btn.click();
          await new Promise((r) => setTimeout(r, 20));
          return { visibleAfterEvent, promptCalls };
        }, FIND_CUSTOM_INSTALL_BUTTON_SOURCE);

        expect(result.visibleAfterEvent).toBe(true);
        expect(result.promptCalls).toBe(1);
      } else {
        await expect(page.locator('install')).toHaveCount(1);
      }
    });

    test('When navigator.install() is unsupported and the page uses a custom install button, accepting or dismissing the beforeinstallprompt prompt discards the captured event and hides the button unless a new beforeinstallprompt event is fired', async ({
      page,
      TARGET_URL,
    }) => {
      skipUnless({ unsupported: 'navigator-install' });

      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const project: Project = getJsProject(targetFiles);
      expect(hasInstallElementInDocs(docs) || hasCustomInstallMechanismInAst(project)).toBe(true);

      await page.addInitScript(() => {
        try {
          delete (Navigator.prototype as any).install;
        } catch {
          // ignore
        }
        try {
          delete (navigator as any).install;
        } catch {
          // ignore
        }
      });

      await page.goto(TARGET_URL);

      const hasCustomBtn = await page.evaluate((findBtnSrc) => {
        // eslint-disable-next-line no-eval
        return Boolean(eval(findBtnSrc));
      }, FIND_CUSTOM_INSTALL_BUTTON_SOURCE);

      if (hasCustomBtn) {
        const result = await page.evaluate(async (findBtnSrc) => {
          // eslint-disable-next-line no-eval
          const btn = eval(findBtnSrc) as HTMLElement;
          let promptCalls = 0;
          const fireBip = (outcome: 'accepted' | 'dismissed') => {
            const ev = new Event('beforeinstallprompt', { cancelable: true }) as any;
            ev.prompt = () => {
              promptCalls++;
              return Promise.resolve();
            };
            ev.userChoice = Promise.resolve({ outcome, platform: 'web' });
            window.dispatchEvent(ev);
          };

          fireBip('dismissed');
          btn.click();
          await new Promise((r) => setTimeout(r, 30));

          const styleAfterDismiss = window.getComputedStyle(btn);
          const hiddenAfterDismiss =
            btn.hidden || styleAfterDismiss.display === 'none' || styleAfterDismiss.visibility === 'hidden';

          // Clicking again without a new beforeinstallprompt event should not call prompt() again
          btn.click();
          await new Promise((r) => setTimeout(r, 20));
          const callsAfterSecondClick = promptCalls;

          // Firing a new beforeinstallprompt event should reveal the button again
          fireBip('accepted');
          const styleAfterNewEvent = window.getComputedStyle(btn);
          const visibleAfterNewEvent =
            !btn.hidden && styleAfterNewEvent.display !== 'none' && styleAfterNewEvent.visibility !== 'hidden';

          btn.click();
          await new Promise((r) => setTimeout(r, 30));
          const styleAfterAccept = window.getComputedStyle(btn);
          const hiddenAfterAccept =
            btn.hidden || styleAfterAccept.display === 'none' || styleAfterAccept.visibility === 'hidden';

          return {
            hiddenAfterDismiss,
            callsAfterSecondClick,
            visibleAfterNewEvent,
            hiddenAfterAccept,
          };
        }, FIND_CUSTOM_INSTALL_BUTTON_SOURCE);

        expect(result.hiddenAfterDismiss).toBe(true);
        expect(result.callsAfterSecondClick).toBe(1);
        expect(result.visibleAfterNewEvent).toBe(true);
        expect(result.hiddenAfterAccept).toBe(true);
      } else {
        await expect(page.locator('install')).toHaveCount(1);
      }
    });

    test('Completing an installation action reports that the app was installed (or opened), while cancellation is reported as cancellation rather than as an application error', async ({
      page,
      TARGET_URL,
    }) => {
      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const project: Project = getJsProject(targetFiles);
      expect(hasInstallElementInDocs(docs) || hasCustomInstallMechanismInAst(project)).toBe(true);

      await page.addInitScript(() => {
        (window as any).__installMode = 'success';
        Object.defineProperty(Navigator.prototype, 'install', {
          value: function () {
            if ((window as any).__installMode === 'abort') {
              return Promise.reject(new DOMException('User canceled installation', 'AbortError'));
            }
            return Promise.resolve();
          },
          configurable: true,
          writable: true,
        });
      });

      await page.goto(TARGET_URL);

      const pageErrors: Error[] = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const outcomes = await page.evaluate(
        async ({ findBtnSrc, readStatusSrc }) => {
          // eslint-disable-next-line no-eval
          const btn = eval(findBtnSrc) as HTMLElement | null;
          const installEl = document.querySelector('install');

          let successStatus = '';
          let cancelStatus = '';

          if (btn && !btn.hidden) {
            (window as any).__installMode = 'abort';
            btn.click();
            await new Promise((r) => setTimeout(r, 30));
            // eslint-disable-next-line no-eval
            cancelStatus = eval(readStatusSrc) as string;

            (window as any).__installMode = 'success';
            btn.hidden = false;
            btn.removeAttribute('aria-disabled');
            btn.click();
            await new Promise((r) => setTimeout(r, 30));
            // eslint-disable-next-line no-eval
            successStatus = eval(readStatusSrc) as string;
          } else if (installEl) {
            const successEv = new Event('installresult');
            Object.defineProperty(successEv, 'result', { value: 'success', enumerable: true });
            installEl.dispatchEvent(successEv);
            // eslint-disable-next-line no-eval
            successStatus = eval(readStatusSrc) as string;

            const abortEv = new Event('installresult');
            Object.defineProperty(abortEv, 'result', { value: 'aborted', enumerable: true });
            installEl.dispatchEvent(abortEv);
            // eslint-disable-next-line no-eval
            cancelStatus = eval(readStatusSrc) as string;
          }

          return { successStatus, cancelStatus };
        },
        { findBtnSrc: FIND_CUSTOM_INSTALL_BUTTON_SOURCE, readStatusSrc: READ_STATUS_TEXT_SOURCE },
      );

      expect(pageErrors).toHaveLength(0);
      expect(outcomes.successStatus).toMatch(SUCCESS_TEXT_RE);
      expect(outcomes.cancelStatus).toMatch(ABORTED_TEXT_RE);
    });
  });
});
