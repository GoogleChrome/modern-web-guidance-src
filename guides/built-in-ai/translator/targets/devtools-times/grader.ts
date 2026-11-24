import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type Project, type SourceFile } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAppSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter(sf => !sf.getFilePath().endsWith('global.d.ts'));
}

test.describe('devtools-times Translator Target Grader', () => {

  test('The Translator API should be available on window.Translator and not on window.ai.translator', () => {
    const project: Project = getJsProject(targetFiles);
    const allSourceFiles = project.getSourceFiles();

    expect(allSourceFiles.length).toBeGreaterThan(0);

    // 1. Verify that deprecated window.ai.translator / ai.translator is NOT accessed
    const hasLegacyAiTranslator = allSourceFiles.some(sf => {
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      return propAccesses.some(pa => {
        const text = pa.getText();
        return text === 'window.ai.translator' || text === 'ai.translator';
      });
    });

    // 2. Verify that Translator is accessed via global Translator or 'Translator' in window
    const hasTranslatorAccess = allSourceFiles.some(sf => {
      const hasId = sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText() === 'Translator');
      const hasStr = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(str => str.getLiteralValue() === 'Translator');
      return hasId || hasStr;
    });

    expect(hasTranslatorAccess && !hasLegacyAiTranslator).toBe(true);
  });

  test('The Translator.availability() function must be called with both sourceLanguage and targetLanguage options', () => {
    const project: Project = getJsProject(targetFiles);
    const appSourceFiles = getAppSourceFiles(project);

    expect(appSourceFiles.length).toBeGreaterThan(0);

    const hasAvailabilityCall = appSourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
        const exprText = call.getExpression().getText();
        return exprText.endsWith('.availability') || exprText === 'availability' || exprText === 'checkAvailability';
      });
      if (calls.length === 0) return false;

      const fileText = sf.getFullText();
      return /\bsourceLanguage\b/.test(fileText) && /\btargetLanguage\b/.test(fileText);
    });

    expect(hasAvailabilityCall).toBe(true);
  });

  test('The Translator.availability() function should return available or downloadable or downloading or unavailable', () => {
    const project: Project = getJsProject(targetFiles);
    const allSourceFiles = project.getSourceFiles();

    expect(allSourceFiles.length).toBeGreaterThan(0);

    const allText = allSourceFiles.map(sf => sf.getFullText()).join('\n');
    const validStatuses = ['available', 'downloadable', 'downloading', 'unavailable'];
    const handlesStatus = validStatuses.some(status => new RegExp(`\\b${status}\\b`).test(allText));

    expect(handlesStatus).toBe(true);
  });

  test('The same sourceLanguage and targetLanguage options should be passed to both Translator.availability() and Translator.create()', () => {
    const project: Project = getJsProject(targetFiles);
    const appSourceFiles = getAppSourceFiles(project);

    expect(appSourceFiles.length).toBeGreaterThan(0);

    const allCalls = appSourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasAvailabilityCall = allCalls.some(call => {
      const expr = call.getExpression().getText();
      return expr.endsWith('.availability') || expr === 'availability' || expr === 'checkAvailability';
    });

    const hasCreateCall = allCalls.some(call => {
      const expr = call.getExpression().getText();
      return expr.endsWith('.create') || expr === 'create' || expr === 'createTranslator';
    });

    const hasLanguageOptions = appSourceFiles.some(sf => {
      const text = sf.getFullText();
      return /\bsourceLanguage\b/.test(text) && /\btargetLanguage\b/.test(text);
    });

    expect(hasAvailabilityCall && hasCreateCall && hasLanguageOptions).toBe(true);
  });

  test("The Translator instance's translate() or translateStreaming() method should be used to generate a translation", () => {
    const project: Project = getJsProject(targetFiles);
    const appSourceFiles = getAppSourceFiles(project);

    expect(appSourceFiles.length).toBeGreaterThan(0);

    const calls = appSourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasTranslateCall = calls.some(call => {
      const exprText = call.getExpression().getText();
      return exprText.endsWith('.translate') || exprText.endsWith('.translateStreaming');
    });

    expect(hasTranslateCall).toBe(true);
  });

  test('A monitor for download progress should be implemented using the downloadprogress event', () => {
    const project: Project = getJsProject(targetFiles);
    const appSourceFiles = getAppSourceFiles(project);

    expect(appSourceFiles.length).toBeGreaterThan(0);

    const hasDownloadProgressMonitor = appSourceFiles.some(sf => {
      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const hasEventLiteral = stringLiterals.some(sl => sl.getLiteralText() === 'downloadprogress');
      const text = sf.getFullText();
      const hasMonitor = /\bmonitor\b/.test(text) || /\baddEventListener\b/.test(text);

      return hasEventLiteral && hasMonitor;
    });

    expect(hasDownloadProgressMonitor).toBe(true);
  });

  test.describe('Browser tests', () => {
    test('The translated text must be wrapped inside an element that contains the lang attribute matching the target BCP 47 language code', async ({
      page,
      TARGET_URL,
    }) => {
      test.setTimeout(15_000);
      await page.addInitScript(() => {
        (window as any).Translator = {
          availability: async () => 'available',
          create: async (opts: { sourceLanguage?: string; targetLanguage?: string }) => {
            const target = opts?.targetLanguage ?? 'es';
            return {
              translate: async (text: string) => `[${target}] ${text}`,
              translateStreaming: (text: string) =>
                new ReadableStream({
                  start(c) {
                    c.enqueue(`[${target}] ${text}`);
                    c.close();
                  },
                }),
            };
          },
        };
      });

      await page.goto(TARGET_URL);

      const findAndTagTargetSelect = async (): Promise<boolean> => {
        return page.evaluate(() => {
          document
            .querySelectorAll('[data-grader-target-select]')
            .forEach((el) => el.removeAttribute('data-grader-target-select'));

          const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select')).filter(
            (s) => {
              if (s.disabled) return false;
              const style = window.getComputedStyle(s);
              const rect = s.getBoundingClientRect();
              if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                rect.width === 0 ||
                rect.height === 0
              ) {
                return false;
              }
              return Array.from(s.options).some((o) => /^(es|fr|de)$/i.test(o.value));
            },
          );
          if (selects.length === 0) return false;

          const getLabelText = (s: HTMLSelectElement): string => {
            const labelEl = s.id ? document.querySelector(`label[for="${CSS.escape(s.id)}"]`) : null;
            const wrappingLabel = s.closest('label');
            return [
              s.id,
              s.name,
              s.getAttribute('aria-label') ?? '',
              labelEl?.textContent ?? '',
              wrappingLabel?.textContent ?? '',
            ]
              .join(' ')
              .toLowerCase();
          };

          const nonSource = selects.filter((s) => {
            const meta = getLabelText(s);
            return !/\bsource\b|\bfrom\b/.test(meta) || /\btarget\b|\btranslate\s+to\b/.test(meta);
          });

          const chosen =
            nonSource.find((s) => /\btarget\b|\btranslate\s+to\b/.test(getLabelText(s))) ??
            nonSource[0] ??
            selects[selects.length - 1];

          chosen.setAttribute('data-grader-target-select', 'true');
          return true;
        });
      };

      const hasVisibleHomeSelect = await findAndTagTargetSelect();

      if (!hasVisibleHomeSelect) {
        const articleLink = page.locator('a[href*="/articles/"]').first();
        await expect(articleLink).toBeVisible();
        await articleLink.click();
        await page.waitForURL(/\/articles\//);
        const anyLangSelect = page
          .locator('select')
          .filter({
            has: page.locator('option[value="es" i], option[value="fr" i], option[value="de" i]'),
          })
          .first();
        if ((await anyLangSelect.count()) > 0) {
          await anyLangSelect.scrollIntoViewIfNeeded().catch(() => {});
        }
        await expect.poll(() => findAndTagTargetSelect()).toBe(true);
      }

      const targetSelect = page.locator('select[data-grader-target-select="true"]').first();
      await expect(targetSelect).toBeVisible({ timeout: 5000 });

      const chosenLang = await targetSelect.evaluate((sel: HTMLSelectElement) => {
        const enabledOpts = Array.from(sel.options).filter((o) => !o.disabled);
        const matched =
          enabledOpts.find((o) => o.value.toLowerCase() === 'es') ??
          enabledOpts.find((o) => /^(es|fr|de)$/i.test(o.value));
        return matched?.value ?? null;
      });
      expect(chosenLang).toBeTruthy();
      if (!chosenLang) throw new Error('Expected a target language option');
      await targetSelect.selectOption(chosenLang);

      const scopedBtn = targetSelect
        .locator(
          'xpath=ancestor::*[.//button[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "translate")]][1]',
        )
        .locator('button', { hasText: /translate/i })
        .first();
      const translateBtn =
        (await scopedBtn.count()) > 0
          ? scopedBtn
          : page.locator('button', { hasText: /translate/i }).first();
      if ((await translateBtn.count()) > 0) {
        await expect(translateBtn).toBeEnabled();
        await translateBtn.click();
      }

      const marker = `[${chosenLang}]`;
      await expect
        .poll(() =>
          page.evaluate((m) => (document.body.innerText ?? '').includes(m), marker),
        )
        .toBe(true);

      const langMatches = await page.evaluate(
        ({ m, expectedLang }) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const matches: Array<{ text: string; lang: string | null }> = [];
          let node: Node | null;
          while ((node = walker.nextNode())) {
            const val = node.nodeValue ?? '';
            if (val.includes(m)) {
              const parentEl = node.parentElement;
              const langEl = parentEl?.closest('[lang]');
              matches.push({
                text: val.trim().slice(0, 40),
                lang: langEl?.getAttribute('lang') ?? null,
              });
            }
          }
          return (
            matches.length > 0 &&
            matches.every(
              (entry) => entry.lang !== null && entry.lang.toLowerCase() === expectedLang.toLowerCase(),
            )
          );
        },
        { m: marker, expectedLang: chosenLang },
      );

      expect(langMatches).toBe(true);
    });
  });
});
