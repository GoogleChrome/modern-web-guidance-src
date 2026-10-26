import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

import { pathToFileURL } from 'url';

const testFileUrl: string = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : `${pathToFileURL(process.cwd()).href}/grader.ts`;

const targetFiles: string[] = getTargetFiles(testFileUrl);

test.describe('prerendering-custom-elements Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('Initial HTML markup includes declarative shadow root template inside custom element host', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasDsdTemplate = docs.some(({ document }) => {
      const templates = Array.from(document.querySelectorAll('template[shadowrootmode]'));
      if (templates.length === 0) return false;
      return templates.some((tpl: any) => {
        const mode = tpl.getAttribute('shadowrootmode');
        const parentTag = tpl.parentElement?.tagName.toLowerCase() || '';
        return mode?.toLowerCase() === 'open' && parentTag.includes('-');
      });
    });
    expect(hasDsdTemplate).toBe(true);
  });

  test('Declarative shadow root template contains embedded style or stylesheet link', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasEmbeddedStyles = docs.some(({ document }) => {
      const templates = Array.from(document.querySelectorAll('template[shadowrootmode]'));
      if (templates.length === 0) return false;
      return templates.some((tpl: any) => {
        const style = tpl.content?.querySelector('style, link[rel="stylesheet"]')
          || tpl.querySelector?.('style, link[rel="stylesheet"]');
        return Boolean(style);
      });
    });
    expect(hasEmbeddedStyles).toBe(true);
  });

  test('Light DOM content stays in Light DOM and renders through slots without being duplicated in template', () => {
    const docs = getHtmlDocuments(targetFiles);
    const isValid = docs.some(({ document }) => {
      const hosts = Array.from(document.querySelectorAll('*')).filter((el: any) => el.tagName.includes('-'));
      if (hosts.length === 0) return false;
      return hosts.every((host: any) => {
        const tpl = host.querySelector('template[shadowrootmode]');
        if (!tpl) return false;
        const lightChildren = Array.from(host.children).filter((c: any) => c !== tpl);
        if (lightChildren.length === 0) return false;

        const slots = tpl.content
          ? Array.from(tpl.content.querySelectorAll('slot'))
          : Array.from(tpl.querySelectorAll('slot'));
        if (slots.length === 0) return false;

        const hasLightHeading = lightChildren.some((c: any) => c.tagName.toLowerCase() === 'h3');
        const tplHasHeading = tpl.content
          ? tpl.content.querySelector('h3') !== null
          : tpl.querySelector('h3') !== null;
        return hasLightHeading && !tplHasHeading;
      });
    });
    expect(isValid).toBe(true);
  });

  test('Custom element constructor checks for existing shadowRoot before calling attachShadow', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const attachShadowCalls = sourceFiles.flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).filter(call => {
      const expr = call.getExpression().getText();
      return expr === 'this.attachShadow' || expr.endsWith('.attachShadow');
    });

    const isGuarded = attachShadowCalls.length > 0 && attachShadowCalls.every(call => {
      const enclosing = call.getFirstAncestorByKind(SyntaxKind.Constructor)
        || call.getFirstAncestorByKind(SyntaxKind.MethodDeclaration)
        || call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
      if (!enclosing) return false;
      const hasShadowRootCheck = /\bshadowRoot\b/.test(enclosing.getText());
      const ifAncestor = call.getFirstAncestorByKind(SyntaxKind.IfStatement);
      return hasShadowRootCheck && ifAncestor !== undefined;
    });

    expect(isGuarded).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {

    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('HTML parser attaches open shadowRoot and removes declarative template from Light DOM', async ({ page }) => {
      const isAttachedAndRemoved = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter(el => el.tagName.includes('-'));
        if (hosts.length === 0) return false;
        return hosts.every(host => {
          const hasOpenShadow = host.shadowRoot !== null && host.shadowRoot.mode === 'open';
          const templateRemoved = host.querySelector('template[shadowrootmode]') === null;
          return hasOpenShadow && templateRemoved;
        });
      });
      expect(isAttachedAndRemoved).toBe(true);
    });

    test.describe('JavaScript disabled checks', () => {
      test.use({ javaScriptEnabled: false });

      test('Pre-rendered shadow content applies component styles when JavaScript is disabled', async ({ page }) => {
        const hasStylesApplied = await page.evaluate(() => {
          const hosts = Array.from(document.querySelectorAll('*')).filter(el => el.tagName.includes('-'));
          if (hosts.length === 0) return false;
          return hosts.every(host => {
            if (!host.shadowRoot) return false;
            const card = host.shadowRoot.querySelector('.card, article') || host;
            const style = window.getComputedStyle(card);
            const hostStyle = window.getComputedStyle(host);
            const hasStyledChild = Array.from(host.shadowRoot.querySelectorAll('*')).some(el => {
              const s = window.getComputedStyle(el);
              return s.borderTopWidth !== '0px' || s.borderRadius !== '0px';
            });
            return (
              style.backgroundColor === 'rgb(255, 255, 255)' ||
              style.padding === '20px' ||
              style.display === 'grid' ||
              style.borderTopWidth !== '0px' ||
              hostStyle.backgroundColor === 'rgb(255, 255, 255)' ||
              hostStyle.padding === '20px' ||
              hostStyle.display === 'block' ||
              hasStyledChild
            );
          });
        });
        expect(hasStylesApplied).toBe(true);
      });
    });

    test('Light DOM elements are projected to shadow root slots at runtime', async ({ page }) => {
      const isSlotted = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter(el => el.tagName.includes('-'));
        if (hosts.length === 0) return false;
        return hosts.every(host => {
          const heading = host.querySelector('h3');
          if (!heading) return false;
          const assignedSlot = (heading as any).assignedSlot;
          return assignedSlot !== null && host.shadowRoot !== null && !host.shadowRoot.querySelector('h3');
        });
      });
      expect(isSlotted).toBe(true);
    });

    test('Custom element upgrades reusing existing declarative shadowRoot without calling attachShadow or replacing nodes', async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        (window as any).__attachShadowCalls = 0;
        const orig = HTMLElement.prototype.attachShadow;
        HTMLElement.prototype.attachShadow = function (init) {
          (window as any).__attachShadowCalls++;
          return orig.call(this, init);
        };
      });

      await page.goto(TARGET_URL);

      const preserved = await page.evaluate(() => {
        const hosts = Array.from(document.querySelectorAll('*')).filter(el => el.tagName.includes('-'));
        if (hosts.length === 0) return false;
        const upgraded = hosts.every(host => {
          const isDefined = customElements.get(host.tagName.toLowerCase()) !== undefined;
          return isDefined && host.shadowRoot !== null && host.shadowRoot.childNodes.length > 0;
        });
        const attachCalls = (window as any).__attachShadowCalls;
        return upgraded && attachCalls === 0;
      });

      expect(preserved).toBe(true);
    });

    test('Interactive controls in pre-rendered shadow DOM toggle component state after upgrade', async ({ page }) => {
      const toggled = await page.evaluate(async () => {
        const host = Array.from(document.querySelectorAll('*')).find(el => el.tagName.includes('-'));
        if (!host || !host.shadowRoot) return false;
        const button = host.shadowRoot.querySelector('button, [id="toggle"]') as HTMLButtonElement | null;
        if (!button) return false;

        const beforeState = `${document.body.innerHTML}::${host.outerHTML}::${host.shadowRoot.innerHTML}`;
        button.click();
        await new Promise(r => setTimeout(r, 50));
        const afterState = `${document.body.innerHTML}::${host.outerHTML}::${host.shadowRoot.innerHTML}`;
        return beforeState !== afterState;
      });
      expect(toggled).toBe(true);
    });

    test('Interactive control listener is attached once so moving element in DOM causes exactly one state change per click', async ({ page }) => {
      const stateChanges = await page.evaluate(async () => {
        const host = Array.from(document.querySelectorAll('*')).find(el => el.tagName.includes('-'));
        if (!host || !host.shadowRoot) return -1;
        const button = host.shadowRoot.querySelector('button, [id="toggle"]') as HTMLButtonElement | null;
        if (!button) return -1;

        const parent = host.parentElement;
        if (!parent) return -1;
        for (let i = 0; i < 3; i++) {
          host.remove();
          parent.appendChild(host);
        }

        let mutations = 0;
        const observer = new MutationObserver(records => {
          mutations += records.length;
        });
        observer.observe(host, { attributes: true, attributeFilter: ['open', 'favorited'] });

        const beforeExpanded = button.getAttribute('aria-expanded');
        const bagCountEl = document.querySelector('#bag-count');
        const beforeBagCount = bagCountEl ? Number(bagCountEl.textContent) : null;
        button.click();
        await new Promise(r => setTimeout(r, 50));
        observer.disconnect();

        if (mutations === 0 && button.getAttribute('aria-expanded') !== beforeExpanded) {
          return 1;
        }
        if (mutations === 0 && bagCountEl && beforeBagCount !== null) {
          return Number(bagCountEl.textContent) - beforeBagCount;
        }
        return mutations;
      });
      expect(stateChanges).toBe(1);
    });

  });
});
