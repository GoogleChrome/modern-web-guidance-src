import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
  getRules,
  expectNever,
} from '../../../../../src/grading/test-fixture.ts';
import type { Document } from 'linkedom';
import {
  getCascadedStyle,
  parseSelectorAST,
  CSSStyleRule,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAccordionDetails(docs: Array<{ file: string; document: Document }>): any[] {
  for (const { document } of docs) {
    const faq = document.querySelector('#coffee-faq');
    if (faq) {
      const items = Array.from(faq.querySelectorAll('details'));
      if (items.length > 0) return items;
    }
    const items = Array.from(document.querySelectorAll('details'));
    if (items.length > 0) return items;
  }
  return [];
}

test.describe('Accordion Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The accordion items are sibling <details> elements inside a common container element', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const detailsList = getAccordionDetails(docs);
    expect(detailsList.length).toBeGreaterThanOrEqual(2);

    const commonParent = detailsList[0].parentElement;
    expect(commonParent).toBeTruthy();
    for (const details of detailsList) {
      expect(details.parentElement).toBe(commonParent);
    }
  });

  test('Each accordion item is a <details> element whose first element child is a <summary>', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const detailsList = getAccordionDetails(docs);
    expect(detailsList.length).toBeGreaterThan(0);

    for (const details of detailsList) {
      expect(details.tagName?.toLowerCase()).toBe('details');
      const firstChild = details.firstElementChild ?? details.children?.[0];
      expect(firstChild).toBeTruthy();
      expect(firstChild.tagName?.toLowerCase()).toBe('summary');
    }
  });

  test('If <details> elements have a name attribute, it is the same for all accordion items', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const detailsList = getAccordionDetails(docs);
    expect(detailsList.length).toBeGreaterThan(0);

    const names = detailsList.map((d: any) => d.getAttribute('name'));
    const hasAnyName = names.some((n: string | null) => n !== null && n.trim() !== '');
    if (hasAnyName) {
      const firstName = names[0];
      expect(firstName).toBeTruthy();
      for (const name of names) {
        expect(name).toBe(firstName);
      }
    }
  });

  test('No accordion <summary> or <details> has a tabindex attribute', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const detailsList = getAccordionDetails(docs);
    expect(detailsList.length).toBeGreaterThan(0);

    for (const details of detailsList) {
      expect(details.hasAttribute('tabindex')).toBe(false);
      const summaries = Array.from(details.querySelectorAll('summary')) as any[];
      expect(summaries.length).toBeGreaterThan(0);
      for (const summary of summaries) {
        expect(summary.hasAttribute('tabindex')).toBe(false);
      }
    }
  });

  test('The disclosure marker is styled via ::marker or hidden (via list-style-type: none or a display other than list-item) and replaced via a ::before or ::after', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const detailsList = getAccordionDetails(docs);
    expect(detailsList.length).toBeGreaterThan(0);

    const summaryEl = detailsList[0].querySelector('summary');
    expect(summaryEl).toBeTruthy();

    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getRules(stylesheet, CSSStyleRule);

    const hasMarkerRule = styleRules.some((rule) => {
      const ast = parseSelectorAST(rule);
      if (!ast) return false;
      return ast.selectors.some((sel) => {
        if (sel.type !== 'complex-selector') return false;
        return sel.items.some(
          (item) =>
            item.type === 'compound-selector' &&
            item.selectors.some(
              (s) => s.type === 'pseudo-element-selector' && s.name === 'marker',
            ),
        );
      });
    });

    const summaryCascaded = getCascadedStyle(summaryEl, stylesheet);
    const listStyle = summaryCascaded.getPropertyValue('list-style');
    const listStyleType = summaryCascaded.getPropertyValue('list-style-type');
    const display = summaryCascaded.getPropertyValue('display');

    const isDefaultMarkerHidden =
      /\bnone\b/.test(listStyle) ||
      listStyleType === 'none' ||
      (Boolean(display) && display !== 'list-item');

    const beforeCascaded = getCascadedStyle(summaryEl, stylesheet, '::before');
    const afterCascaded = getCascadedStyle(summaryEl, stylesheet, '::after');
    const beforeContent = beforeCascaded.getPropertyValue('content');
    const afterContent = afterCascaded.getPropertyValue('content');
    const hasReplacementPseudo =
      (Boolean(beforeContent) && beforeContent !== 'none' && beforeContent !== 'normal') ||
      (Boolean(afterContent) && afterContent !== 'none' && afterContent !== 'normal');

    expect(hasMarkerRule || (isDefaultMarkerHidden && hasReplacementPseudo)).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Clicking the <summary> of a closed item opens it, and clicking the <summary> of an open item closes it', async ({
      page,
    }) => {
      const items = page.locator('#coffee-faq details, main details');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);

      const firstDetails = items.first();
      const firstSummary = firstDetails.locator('> summary');

      await firstDetails.evaluate((el: HTMLDetailsElement) => {
        el.open = false;
      });
      await expect(firstDetails).not.toHaveJSProperty('open', true);

      await firstSummary.click();
      await expect(firstDetails).toHaveJSProperty('open', true);

      await firstSummary.click();
      await expect(firstDetails).toHaveJSProperty('open', false);
    });

    test('Every accordion <summary> is reachable by pressing Tab, in DOM order', async ({
      page,
    }) => {
      const summaries = page.locator('#coffee-faq details > summary, main details > summary');
      const count = await summaries.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Focus the first summary and verify pressing Tab moves through the rest in DOM order,
      // and check that the first summary itself is reachable via Tab from the preceding focusable element.
      const firstReachableViaTab = await page.evaluate(() => {
        const allSummaries = Array.from(
          document.querySelectorAll<HTMLElement>(
            '#coffee-faq details > summary, main details > summary',
          ),
        );
        if (allSummaries.length === 0) return false;
        const first = allSummaries[0];
        // Insert a temporary button right before the accordion container to Tab from
        const probe = document.createElement('button');
        probe.type = 'button';
        probe.textContent = 'probe';
        const container = first.closest('details')!;
        container.parentElement!.insertBefore(probe, container);
        probe.focus();
        return document.activeElement === probe;
      });
      expect(firstReachableViaTab).toBe(true);

      for (let i = 0; i < count; i++) {
        // Tab until we reach the next summary (in case links inside open details are visited, ensure all details start closed)
        if (i === 0) {
          await page.evaluate(() => {
            document
              .querySelectorAll<HTMLDetailsElement>('#coffee-faq details, main details')
              .forEach((d) => {
                d.open = false;
              });
          });
        }
        await page.keyboard.press('Tab');
        const matchesCurrentSummary = await summaries
          .nth(i)
          .evaluate((el) => document.activeElement === el);
        expect(matchesCurrentSummary).toBe(true);
      }
    });

    test('If the closed-state indicator has a computed rotation or transform, that value differs between right-to-left and left-to-right contexts', async ({
      page,
    }) => {
      const items = page.locator('#coffee-faq details, main details');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);

      const indicatorStyles = await page.evaluate(() => {
        const details = document.querySelector<HTMLDetailsElement>(
          '#coffee-faq details:not([open]), main details:not([open]), #coffee-faq details, main details',
        )!;
        details.open = false;
        const summary = details.querySelector('summary')!;

        const readIndicator = () => {
          for (const pseudo of ['::before', '::after', '::marker'] as const) {
            const cs = getComputedStyle(summary, pseudo);
            if (cs.content && cs.content !== 'none' && cs.content !== 'normal') {
              return { rotate: cs.rotate, transform: cs.transform };
            }
          }
          const child = summary.querySelector<HTMLElement>('svg, i, span, img');
          if (child) {
            const cs = getComputedStyle(child);
            return { rotate: cs.rotate, transform: cs.transform };
          }
          const cs = getComputedStyle(summary, '::before');
          return { rotate: cs.rotate, transform: cs.transform };
        };

        const prevDir = document.documentElement.getAttribute('dir');
        document.documentElement.setAttribute('dir', 'ltr');
        const ltr = readIndicator();

        document.documentElement.setAttribute('dir', 'rtl');
        const rtl = readIndicator();

        if (prevDir === null) {
          document.documentElement.removeAttribute('dir');
        } else {
          document.documentElement.setAttribute('dir', prevDir);
        }

        return { ltr, rtl };
      });

      const hasLtrRotationOrTransform =
        (indicatorStyles.ltr.rotate !== 'none' && indicatorStyles.ltr.rotate !== '0deg') ||
        (indicatorStyles.ltr.transform !== 'none' &&
          indicatorStyles.ltr.transform !== 'matrix(1, 0, 0, 1, 0, 0)');

      if (hasLtrRotationOrTransform) {
        const differs =
          indicatorStyles.ltr.rotate !== indicatorStyles.rtl.rotate ||
          indicatorStyles.ltr.transform !== indicatorStyles.rtl.transform;
        expect(differs).toBe(true);
      }
    });

    test('With prefers-reduced-motion: no-preference, the block-size of an item\'s ::details-content passes through an intermediate value between 0 and its final size while the item opens', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      const items = page.locator('#coffee-faq details, main details');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);

      const result = await page.evaluate(async () => {
        const details = document.querySelector<HTMLDetailsElement>(
          '#coffee-faq details, main details',
        )!;
        details.open = false;
        // Wait for any closing transition to settle
        await new Promise((r) => setTimeout(r, 400));

        const summary = details.querySelector<HTMLElement>('summary')!;
        const samples: number[] = [];

        summary.click();

        const start = performance.now();
        while (performance.now() - start < 500) {
          const bs = parseFloat(getComputedStyle(details, '::details-content').blockSize) || 0;
          samples.push(bs);
          await new Promise((r) => requestAnimationFrame(r));
        }

        const finalSize =
          parseFloat(getComputedStyle(details, '::details-content').blockSize) || 0;
        const hasIntermediate = samples.some((s) => s > 0.5 && s < finalSize - 0.5);
        return { finalSize, hasIntermediate, samples };
      });

      expect(result.finalSize).toBeGreaterThan(0);
      expect(result.hasIntermediate).toBe(true);
    });

    test('With prefers-reduced-motion: no-preference, an item\'s ::details-content still computes content-visibility: visible and a non-zero block-size partway through closing', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      const items = page.locator('#coffee-faq details, main details');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);

      const result = await page.evaluate(async () => {
        const details = document.querySelector<HTMLDetailsElement>(
          '#coffee-faq details, main details',
        )!;
        details.open = true;
        // Wait for opening transition to finish completely
        await new Promise((r) => setTimeout(r, 450));

        const openSize =
          parseFloat(getComputedStyle(details, '::details-content').blockSize) || 0;
        const summary = details.querySelector<HTMLElement>('summary')!;

        summary.click();

        let sawPartwayClosing = false;
        const start = performance.now();
        while (performance.now() - start < 450) {
          const cs = getComputedStyle(details, '::details-content');
          const bs = parseFloat(cs.blockSize) || 0;
          const cv = cs.contentVisibility;
          if (cv === 'visible' && bs > 0.5 && bs < openSize - 0.5) {
            sawPartwayClosing = true;
            break;
          }
          await new Promise((r) => requestAnimationFrame(r));
        }

        return { openSize, sawPartwayClosing };
      });

      expect(result.openSize).toBeGreaterThan(0);
      expect(result.sawPartwayClosing).toBe(true);
    });

    test('With prefers-reduced-motion: reduce, an item\'s ::details-content reaches its final block-size without passing through an intermediate value when the item opens', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });

      const items = page.locator('#coffee-faq details, main details');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);

      // First measure the final open block-size so we know what value to expect
      const finalOpenSize = await page.evaluate(() => {
        const details = document.querySelector<HTMLDetailsElement>(
          '#coffee-faq details, main details',
        )!;
        details.open = true;
        const size = parseFloat(getComputedStyle(details, '::details-content').blockSize) || 0;
        details.open = false;
        // Force style recalc while closed
        void getComputedStyle(details, '::details-content').blockSize;
        return size;
      });
      expect(finalOpenSize).toBeGreaterThan(0);

      await page.evaluate(() => {
        const details = document.querySelector<HTMLDetailsElement>(
          '#coffee-faq details, main details',
        )!;
        details.querySelector<HTMLElement>('summary')!.click();
      });

      await expectNever(
        page,
        (targetSize) => {
          const details = document.querySelector<HTMLDetailsElement>(
            '#coffee-faq details, main details',
          )!;
          const bs = parseFloat(getComputedStyle(details, '::details-content').blockSize) || 0;
          return bs < targetSize - 0.5;
        },
        {
          forMs: 350,
          arg: finalOpenSize,
          message:
            'Expected ::details-content to reach final block-size immediately without intermediate values under prefers-reduced-motion: reduce',
        },
      );
    });

    test('The ::details-content of a closed item does not compute display: none, so find-in-page can reveal its contents', async ({
      page,
    }) => {
      const items = page.locator('#coffee-faq details, main details');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);

      const display = await page.evaluate(() => {
        const details = document.querySelector<HTMLDetailsElement>(
          '#coffee-faq details, main details',
        )!;
        details.open = false;
        return getComputedStyle(details, '::details-content').display;
      });

      expect(display).not.toBe('none');
    });
  });
});
