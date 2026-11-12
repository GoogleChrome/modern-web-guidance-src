/**
 * Stage 3 Target Grader: The Daily Grind — Modern JS Discipline
 *
 * Expectations coverage against guides/js/js/expectations.md (20 bullets):
 * - Exp 1:  TESTED  — structuredClone() for deep-cloning nested draft order snapshots (Date + nested options) without JSON.parse(JSON.stringify(...)).
 * - Exp 2:  TESTED  — Array.prototype.toSorted() for non-mutating sorting without [...arr].sort() / arr.slice().sort().
 * - Exp 3:  TESTED  — Array.prototype.toReversed() for non-mutating order reversal without [...arr].reverse() / arr.slice().reverse().
 * - Exp 4:  SKIPPED — toSpliced() is unnecessary for this menu filter/order UI; immutable .filter() / reset handles filtering and clearing.
 * - Exp 5:  SKIPPED — Array.prototype.with() is unnecessary since no indexed item replacement is part of this menu/order UI.
 * - Exp 6:  SKIPPED — findLast() / findLastIndex() is unnecessary since no reverse lookup is needed in this menu/order UI.
 * - Exp 7:  TESTED  — Object.groupBy() / Map.groupBy() for category grouping without .reduce() bucket accumulation.
 * - Exp 8:  TESTED  — Safe grouped key lookup (Object.hasOwn / ?? [] / Map.groupBy) when filtered categories have zero matches, without .hasOwnProperty().
 * - Exp 9:  SKIPPED — Promise.withResolvers() is inapplicable to this static client-only statikk page without deferred external callbacks.
 * - Exp 10: SKIPPED — AbortSignal.timeout() is inapplicable because daily-grind makes no fetch() requests or network timeouts.
 * - Exp 11: SKIPPED — AbortSignal.any() is inapplicable because daily-grind has no concurrent cancellable async operations.
 * - Exp 12: SKIPPED — TimeoutError / AbortError handling is inapplicable without AbortSignal or fetch() requests.
 * - Exp 13: SKIPPED — new Error(..., { cause }) chaining is inapplicable because daily-grind has no wrapped low-level I/O failures.
 * - Exp 14: TESTED  — URLSearchParams / URL.searchParams for URL query state sync without manual .split('&') / .split('=').
 * - Exp 15: SKIPPED — TextDecoder is inapplicable because no Uint8Array / ArrayBuffer UTF-8 decoding occurs in this UI.
 * - Exp 16: SKIPPED — TextEncoder is inapplicable because no UTF-8 byte encoding occurs in this UI.
 * - Exp 17: TESTED  — element.replaceChildren() (0 args) for clearing DOM containers without innerHTML = '' or removeChild loops.
 * - Exp 18: TESTED  — element.replaceChildren(...nodes) (with args) for atomic DOM child replacement without appendChild loops.
 * - Exp 19: SKIPPED — Plain new Event() is superseded here by Exp 20 because daily-grind:filter-change carries structured state in detail.
 * - Exp 20: TESTED  — new CustomEvent('daily-grind:filter-change', { detail, bubbles: true }) without document.createEvent / initCustomEvent.
 */

import {
  Node as TsNode,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type Project,
} from 'ts-morph';
import {
  expect,
  getJsProject,
  getTargetFiles,
  test,
} from '../../../../../src/grading/test-fixture.ts';

type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];
type Locator = ReturnType<Page['locator']>;

interface CapturedFilterEvent {
  type: string;
  bubbles: boolean;
  detail: Record<string, unknown> | null;
}

interface DailyGrindSpies {
  structuredCloneCalls: number;
  toSortedCalls: number;
  arraySortCalls: number;
  toReversedCalls: number;
  arrayReverseCalls: number;
  groupByCalls: number;
  zeroArgReplaceChildrenCalls: number;
  withArgsReplaceChildrenCalls: number;
  removeChildCalls: number;
  emptyInnerHtmlCalls: number;
  appendChildCalls: number;
  newCustomEventCalls: number;
  createEventCalls: number;
  capturedFilterEvents: CapturedFilterEvent[];
}

declare global {
  interface Window {
    __dailyGrindSpies?: DailyGrindSpies;
  }
}

function getAstProject(): Project {
  return getJsProject(getTargetFiles(import.meta.url));
}

function normalizedCallee(node: CallExpression | NewExpression): string {
  return node.getExpression().getText().replace(/\s+/g, '');
}

function getCalls(project: Project): CallExpression[] {
  return project
    .getSourceFiles()
    .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
}

function getNews(project: Project): NewExpression[] {
  return project
    .getSourceFiles()
    .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.NewExpression));
}

function getMethodName(call: CallExpression): string | null {
  const expr = call.getExpression();
  return TsNode.isPropertyAccessExpression(expr) ? expr.getName() : null;
}

function isInsideIteration(node: TsNode): boolean {
  let parent = node.getParent();
  while (parent) {
    if (
      TsNode.isForStatement(parent) ||
      TsNode.isForOfStatement(parent) ||
      TsNode.isForInStatement(parent) ||
      TsNode.isWhileStatement(parent) ||
      TsNode.isDoStatement(parent)
    ) {
      return true;
    }
    if (TsNode.isCallExpression(parent)) {
      const name = getMethodName(parent);
      if (name === 'forEach') {
        return true;
      }
    }
    parent = parent.getParent();
  }
  return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const RUNTIME_SPIES_INIT_SCRIPT = `(() => {
  const spies = {
    structuredCloneCalls: 0,
    toSortedCalls: 0,
    arraySortCalls: 0,
    toReversedCalls: 0,
    arrayReverseCalls: 0,
    groupByCalls: 0,
    zeroArgReplaceChildrenCalls: 0,
    withArgsReplaceChildrenCalls: 0,
    removeChildCalls: 0,
    emptyInnerHtmlCalls: 0,
    appendChildCalls: 0,
    newCustomEventCalls: 0,
    createEventCalls: 0,
    capturedFilterEvents: [],
  };
  window.__dailyGrindSpies = spies;

  function isFromApp() {
    const stack = new Error().stack || '';
    return stack.includes(window.location.origin);
  }

  const origStructuredClone = window.structuredClone;
  if (typeof origStructuredClone === 'function') {
    window.structuredClone = function structuredCloneSpy(value, options) {
      if (isFromApp()) spies.structuredCloneCalls += 1;
      return origStructuredClone.call(this, value, options);
    };
  }

  const origToSorted = Array.prototype.toSorted;
  if (typeof origToSorted === 'function') {
    Array.prototype.toSorted = function toSortedSpy(compareFn) {
      if (isFromApp()) spies.toSortedCalls += 1;
      return origToSorted.call(this, compareFn);
    };
  }

  const origSort = Array.prototype.sort;
  Array.prototype.sort = function sortSpy(compareFn) {
    if (isFromApp()) spies.arraySortCalls += 1;
    return origSort.call(this, compareFn);
  };

  const origToReversed = Array.prototype.toReversed;
  if (typeof origToReversed === 'function') {
    Array.prototype.toReversed = function toReversedSpy() {
      if (isFromApp()) spies.toReversedCalls += 1;
      return origToReversed.call(this);
    };
  }

  const origReverse = Array.prototype.reverse;
  Array.prototype.reverse = function reverseSpy() {
    if (isFromApp()) spies.arrayReverseCalls += 1;
    return origReverse.call(this);
  };

  const origObjectGroupBy = Object.groupBy;
  if (typeof origObjectGroupBy === 'function') {
    Object.groupBy = function objectGroupBySpy(items, keySelector) {
      if (isFromApp()) spies.groupByCalls += 1;
      return origObjectGroupBy.call(Object, items, keySelector);
    };
  }

  const origMapGroupBy = Map.groupBy;
  if (typeof origMapGroupBy === 'function') {
    Map.groupBy = function mapGroupBySpy(items, keySelector) {
      if (isFromApp()) spies.groupByCalls += 1;
      return origMapGroupBy.call(Map, items, keySelector);
    };
  }

  const origReplaceChildren = Element.prototype.replaceChildren;
  if (typeof origReplaceChildren === 'function') {
    Element.prototype.replaceChildren = function replaceChildrenSpy(...nodes) {
      if (isFromApp()) {
        if (nodes.length === 0) {
          spies.zeroArgReplaceChildrenCalls += 1;
        } else {
          spies.withArgsReplaceChildrenCalls += 1;
        }
      }
      return origReplaceChildren.apply(this, nodes);
    };
  }

  const origRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChildSpy(child) {
    if (isFromApp()) spies.removeChildCalls += 1;
    return origRemoveChild.call(this, child);
  };

  const origAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function appendChildSpy(child) {
    if (isFromApp()) spies.appendChildCalls += 1;
    return origAppendChild.call(this, child);
  };

  const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (innerHtmlDescriptor && innerHtmlDescriptor.set) {
    const origSet = innerHtmlDescriptor.set;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...innerHtmlDescriptor,
      set(value) {
        if (value === '' && isFromApp()) {
          spies.emptyInnerHtmlCalls += 1;
        }
        origSet.call(this, value);
      },
    });
  }

  const OrigCustomEvent = window.CustomEvent;
  window.CustomEvent = new Proxy(OrigCustomEvent, {
    construct(target, args, newTarget) {
      if (isFromApp()) spies.newCustomEventCalls += 1;
      return Reflect.construct(target, args, newTarget);
    },
  });

  const origCreateEvent = Document.prototype.createEvent;
  Document.prototype.createEvent = function createEventSpy(eventInterface) {
    if (isFromApp()) spies.createEventCalls += 1;
    return origCreateEvent.call(this, eventInterface);
  };

  document.addEventListener('daily-grind:filter-change', (ev) => {
    const rawDetail = ev instanceof CustomEvent ? ev.detail : null;
    const detail =
      typeof rawDetail === 'object' && rawDetail !== null && !Array.isArray(rawDetail)
        ? { ...rawDetail }
        : null;
    spies.capturedFilterEvents.push({
      type: ev.type,
      bubbles: ev.bubbles,
      detail,
    });
  });
})();`;

async function installRuntimeSpies(page: Page): Promise<void> {
  await page.addInitScript(RUNTIME_SPIES_INIT_SCRIPT);
}

async function readSpies(page: Page): Promise<DailyGrindSpies> {
  const result = await page.evaluate(() => window.__dailyGrindSpies ?? null);
  if (!result) {
    throw new Error('DailyGrind runtime spies were not initialized.');
  }
  return result;
}

async function resetRenderSpies(page: Page): Promise<void> {
  await page.evaluate(() => {
    const spies = window.__dailyGrindSpies;
    if (!spies) return;
    spies.zeroArgReplaceChildrenCalls = 0;
    spies.withArgsReplaceChildrenCalls = 0;
    spies.removeChildCalls = 0;
    spies.emptyInnerHtmlCalls = 0;
    spies.appendChildCalls = 0;
  });
}

function getMenuControls(page: Page) {
  const controls = page.locator('#menu-controls');
  return {
    controls,
    categorySelect: controls.getByRole('combobox', { name: /category/i }),
    sortSelect: controls.getByRole('combobox', { name: /sort/i }),
    reverseToggle: controls
      .getByRole('button', { name: /reverse/i })
      .or(controls.getByRole('checkbox', { name: /reverse/i })),
    groupToggle: controls
      .getByRole('button', { name: /group/i })
      .or(controls.getByRole('checkbox', { name: /group/i })),
  };
}

function getDraftControls(page: Page) {
  const draft = page.locator('#draft-order');
  return {
    draft,
    milkSelect: draft.getByLabel(/milk/i),
    noteInput: draft.locator('input[type="text"]').first(),
    saveBtn: draft.getByRole('button', { name: /save/i }),
    restoreBtn: draft.getByRole('button', { name: /restore/i }),
    clearBtn: draft.getByRole('button', { name: /clear/i }),
    items: draft.locator('ul li'),
  };
}

async function isToggleActive(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      return el.checked;
    }
    return el.getAttribute('aria-pressed') === 'true';
  });
}

async function selectSortByLabelPattern(sortSelect: Locator, pattern: RegExp): Promise<void> {
  const value = await sortSelect.evaluate((el, patternSource) => {
    if (!(el instanceof HTMLSelectElement)) {
      throw new Error('Expected a <select> element for sort control.');
    }
    const regex = new RegExp(patternSource, 'i');
    const match = Array.from(el.options).find((opt) => regex.test(opt.textContent ?? ''));
    if (!match) {
      throw new Error(`No sort <option> matched /${patternSource}/i.`);
    }
    return match.value;
  }, pattern.source);
  await sortSelect.selectOption(value);
}

async function getSelectedSortLabel(sortSelect: Locator): Promise<string> {
  return sortSelect.evaluate((el) => {
    if (!(el instanceof HTMLSelectElement)) {
      throw new Error('Expected a <select> element for sort control.');
    }
    return el.selectedOptions[0]?.textContent?.trim() ?? '';
  });
}

async function getCardSnapshot(page: Page): Promise<{ titles: string[]; prices: number[] }> {
  return page.locator('main .card').evaluateAll((cards) => {
    const titles: string[] = [];
    const prices: number[] = [];
    for (const card of cards) {
      const heading = card.querySelector('h3');
      titles.push(heading?.textContent?.trim() ?? '');
      const priceMatch = (card.textContent ?? '').match(/\$(\d+(?:\.\d{2})?)/);
      prices.push(priceMatch ? Number(priceMatch[1]) : Number.NaN);
    }
    return { titles, prices };
  });
}

// =========================================================================
// Exp 1: structuredClone() for deep draft order snapshots
// =========================================================================
test('Exp 1: uses structuredClone() for deep draft order snapshots without JSON round-trip', async ({
  page,
  TARGET_URL,
}) => {
  const project = getAstProject();
  const calls = getCalls(project);

  const structuredCloneAstCalls = calls.filter((c) => {
    const name = normalizedCallee(c);
    return (
      name === 'structuredClone' ||
      name === 'window.structuredClone' ||
      name === 'globalThis.structuredClone'
    );
  });
  const jsonRoundTripAstCalls = calls.filter((c) => {
    if (normalizedCallee(c) !== 'JSON.parse') return false;
    const firstArg = c.getArguments()[0];
    if (!firstArg) return false;
    return firstArg
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((inner) => normalizedCallee(inner) === 'JSON.stringify');
  });

  expect(structuredCloneAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(jsonRoundTripAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'load' });

  const { milkSelect, noteInput, saveBtn, restoreBtn, items } = getDraftControls(page);
  const firstAddBtn = page.locator('main .card button').first();

  await milkSelect.selectOption('Whole');
  await noteInput.fill('Extra hot snapshot');
  await firstAddBtn.click();

  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Whole');
  await expect(items.first()).toContainText('Extra hot snapshot');

  await saveBtn.click();
  const spiesAfterSave = await readSpies(page);
  expect(spiesAfterSave.structuredCloneCalls).toBeGreaterThanOrEqual(1);

  // Mutate active order after saving snapshot.
  await milkSelect.selectOption('Oat');
  await noteInput.fill('After snapshot edit');
  await page.locator('main .card button').nth(1).click();
  await expect(items).toHaveCount(2);

  // Restore snapshot and confirm post-save mutations did not affect it and Date stays intact.
  await restoreBtn.click();
  await expect(items).toHaveCount(1);
  const restoredText = (await items.first().textContent()) ?? '';
  expect(restoredText).toContain('Whole');
  expect(restoredText).toContain('Extra hot snapshot');
  expect(/\d{4}-\d{2}-\d{2}T/.test(restoredText)).toBe(false);

  // Mutating after restore must also leave the saved snapshot intact.
  await page.locator('main .card button').nth(2).click();
  await expect(items).toHaveCount(2);
  await restoreBtn.click();
  await expect(items).toHaveCount(1);
});

// =========================================================================
// Exp 2: toSorted() for non-mutating menu sorting
// =========================================================================
test('Exp 2: uses toSorted() without mutating source menu array or calling .sort()', async ({
  page,
  TARGET_URL,
}) => {
  const project = getAstProject();
  const calls = getCalls(project);

  const toSortedAstCalls = calls.filter((c) => getMethodName(c) === 'toSorted');
  const legacySortAstCalls = calls.filter((c) => getMethodName(c) === 'sort');

  expect(toSortedAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(legacySortAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'load' });

  const initial = await getCardSnapshot(page);
  expect(initial.titles.length).toBeGreaterThanOrEqual(6);

  const { sortSelect } = getMenuControls(page);
  await selectSortByLabelPattern(sortSelect, /low.*high/i);

  const sorted = await getCardSnapshot(page);
  expect(sorted.prices.length).toBe(initial.titles.length);
  const isAscending = sorted.prices.every(
    (price, idx) => Number.isFinite(price) && (idx === 0 || sorted.prices[idx - 1] <= price),
  );
  expect(isAscending).toBe(true);

  // Resetting sort back to first/default option restores the unmutated original order.
  const firstSortVal = await sortSelect.locator('option').first().getAttribute('value');
  expect(firstSortVal).toBeTruthy();
  await sortSelect.selectOption(firstSortVal ?? '');
  const reset = await getCardSnapshot(page);
  expect(reset.titles).toEqual(initial.titles);

  const spies = await readSpies(page);
  expect(spies.toSortedCalls).toBeGreaterThanOrEqual(1);
  expect(spies.arraySortCalls).toBe(0);
});

// =========================================================================
// Exp 3: toReversed() for non-mutating order reversal
// =========================================================================
test('Exp 3: uses toReversed() without calling .reverse()', async ({ page, TARGET_URL }) => {
  const project = getAstProject();
  const calls = getCalls(project);

  const toReversedAstCalls = calls.filter((c) => getMethodName(c) === 'toReversed');
  const legacyReverseAstCalls = calls.filter((c) => getMethodName(c) === 'reverse');

  expect(toReversedAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(legacyReverseAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'load' });

  const initial = await getCardSnapshot(page);
  expect(initial.titles.length).toBeGreaterThanOrEqual(6);

  const { reverseToggle } = getMenuControls(page);
  await reverseToggle.click();
  expect(await isToggleActive(reverseToggle)).toBe(true);

  const reversed = await getCardSnapshot(page);
  expect(reversed.titles).toEqual([...initial.titles].reverse());

  await reverseToggle.click();
  expect(await isToggleActive(reverseToggle)).toBe(false);
  const restored = await getCardSnapshot(page);
  expect(restored.titles).toEqual(initial.titles);

  const spies = await readSpies(page);
  expect(spies.toReversedCalls).toBeGreaterThanOrEqual(1);
  expect(spies.arrayReverseCalls).toBe(0);
});

// =========================================================================
// Exp 7: Object.groupBy() / Map.groupBy() for category grouping
// =========================================================================
test('Exp 7: uses Object.groupBy() or Map.groupBy() instead of .reduce() object accumulators', async ({
  page,
  TARGET_URL,
}) => {
  const project = getAstProject();
  const calls = getCalls(project);

  const groupByAstCalls = calls.filter((c) => {
    const callee = normalizedCallee(c);
    return callee === 'Object.groupBy' || callee === 'Map.groupBy';
  });
  const reduceBucketAstCalls = calls.filter((c) => {
    if (getMethodName(c) !== 'reduce') return false;
    const initArg = c.getArguments()[1];
    if (!initArg) return false;
    const text = initArg.getText().replace(/\s+/g, '');
    return (
      text === '{}' ||
      text === 'Object.create(null)' ||
      text === 'newMap()' ||
      TsNode.isObjectLiteralExpression(initArg)
    );
  });

  expect(groupByAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(reduceBucketAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'load' });

  const initialSpies = await readSpies(page);
  expect(initialSpies.groupByCalls).toBeGreaterThanOrEqual(1);

  const { groupToggle } = getMenuControls(page);
  await groupToggle.click();
  expect(await isToggleActive(groupToggle)).toBe(true);

  const afterToggleSpies = await readSpies(page);
  expect(afterToggleSpies.groupByCalls).toBeGreaterThanOrEqual(2);

  const groupHeadingsCount = await page
    .locator('main h3:not(.card h3), main h4:not(.card h4)')
    .filter({ hasText: /seasonal|espresso|cold brew/i })
    .count();
  expect(groupHeadingsCount).toBeGreaterThanOrEqual(3);
  expect(await page.locator('main .card').count()).toBeGreaterThanOrEqual(6);
});

// =========================================================================
// Exp 8: Safe grouped key lookup without .hasOwnProperty()
// =========================================================================
test('Exp 8: handles empty filtered groups safely with Object.hasOwn, nullish fallback, or Map.groupBy', async ({
  page,
  TARGET_URL,
}) => {
  const project = getAstProject();
  const calls = getCalls(project);
  const sourceFiles = project.getSourceFiles();

  const hasOwnPropertyAstCalls = calls.filter((c) => {
    const callee = normalizedCallee(c);
    return (
      getMethodName(c) === 'hasOwnProperty' ||
      callee.includes('Object.prototype.hasOwnProperty')
    );
  });
  const usesMapGroupBy = calls.some((c) => normalizedCallee(c) === 'Map.groupBy');
  const usesObjectGroupBy = calls.some((c) => normalizedCallee(c) === 'Object.groupBy');
  const usesObjectHasOwn = calls.some((c) => normalizedCallee(c) === 'Object.hasOwn');
  const usesNullishEmptyArray = sourceFiles.some((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
      if (bin.getOperatorToken().getKind() !== SyntaxKind.QuestionQuestionToken) {
        return false;
      }
      return bin.getRight().getText().trim() === '[]';
    }),
  );

  expect(hasOwnPropertyAstCalls).toEqual([]);
  expect(usesMapGroupBy || (usesObjectGroupBy && (usesObjectHasOwn || usesNullishEmptyArray))).toBe(
    true,
  );

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'load' });

  const initialCount = await page.locator('main .card').count();
  const { categorySelect, groupToggle } = getMenuControls(page);

  await groupToggle.click();
  await categorySelect.selectOption('espresso');

  const filteredCount = await page.locator('main .card').count();
  expect(filteredCount).toBeGreaterThanOrEqual(1);
  expect(filteredCount).toBeLessThan(initialCount);

  const mainText = (await page.locator('main').textContent()) ?? '';
  expect(/seasonal\D*0/i.test(mainText)).toBe(true);
  expect(/cold\s*brew\D*0/i.test(mainText)).toBe(true);
  expect(pageErrors).toEqual([]);
});

// =========================================================================
// Exp 14: URLSearchParams / URL.searchParams for URL query state sync
// =========================================================================
test('Exp 14: syncs and restores filter state using URLSearchParams without manual string splitting', async ({
  page,
  TARGET_URL,
}) => {
  const project = getAstProject();
  const calls = getCalls(project);
  const news = getNews(project);
  const sourceFiles = project.getSourceFiles();

  const usesUrlSearchParamsCtor = news.some((n) => normalizedCallee(n) === 'URLSearchParams');
  const usesUrlSearchParamsProp = sourceFiles.some((sf) =>
    sf
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((prop) => prop.getName() === 'searchParams'),
  );
  const manualSplitAstCalls = calls.filter((c) => {
    if (getMethodName(c) !== 'split') return false;
    const argText = c.getArguments()[0]?.getText().trim() ?? '';
    return argText === `'&'` || argText === '"&"' || argText === `'='` || argText === '"="';
  });

  expect(usesUrlSearchParamsCtor || usesUrlSearchParamsProp).toBe(true);
  expect(manualSplitAstCalls).toEqual([]);

  await page.goto(TARGET_URL, { waitUntil: 'load' });
  const { categorySelect, sortSelect, reverseToggle } = getMenuControls(page);

  await categorySelect.selectOption('espresso');
  await selectSortByLabelPattern(sortSelect, /high.*low/i);
  await reverseToggle.click();

  const syncedUrl = page.url();
  expect(new URL(syncedUrl).search.length).toBeGreaterThan(1);

  const syncedCards = await getCardSnapshot(page);

  // Navigate cleanly to the synced URL to verify initial load restoration.
  await page.goto(syncedUrl, { waitUntil: 'load' });
  const reloadedControls = getMenuControls(page);
  await expect(reloadedControls.categorySelect).toHaveValue('espresso');
  expect(await getSelectedSortLabel(reloadedControls.sortSelect)).toMatch(/high.*low/i);
  expect(await isToggleActive(reloadedControls.reverseToggle)).toBe(true);

  const reloadedCards = await getCardSnapshot(page);
  expect(reloadedCards.titles).toEqual(syncedCards.titles);
});

// =========================================================================
// Exp 17: element.replaceChildren() (0 args) to clear DOM containers
// =========================================================================
test('Exp 17: clears active draft order items via replaceChildren() without innerHTML = "" or removeChild loops', async ({
  page,
  TARGET_URL,
}) => {
  const project = getAstProject();
  const calls = getCalls(project);
  const sourceFiles = project.getSourceFiles();

  const zeroArgReplaceChildrenAstCalls = calls.filter(
    (c) => getMethodName(c) === 'replaceChildren' && c.getArguments().length === 0,
  );
  const emptyInnerHtmlAstAssignments = sourceFiles.some((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
      if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) return false;
      const left = bin.getLeft();
      if (!TsNode.isPropertyAccessExpression(left) || left.getName() !== 'innerHTML') {
        return false;
      }
      const rightText = bin.getRight().getText().trim();
      return rightText === `''` || rightText === '""' || rightText === '``';
    }),
  );
  const removeChildAstCalls = calls.filter((c) => getMethodName(c) === 'removeChild');

  expect(zeroArgReplaceChildrenAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(emptyInnerHtmlAstAssignments).toBe(false);
  expect(removeChildAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'load' });

  const { clearBtn, items } = getDraftControls(page);
  await page.locator('main .card button').first().click();
  await expect(items).toHaveCount(1);

  await resetRenderSpies(page);
  await clearBtn.click();

  await expect(items).toHaveCount(0);
  const spies = await readSpies(page);
  expect(spies.zeroArgReplaceChildrenCalls).toBeGreaterThanOrEqual(1);
  expect(spies.removeChildCalls).toBe(0);
  expect(spies.emptyInnerHtmlCalls).toBe(0);
});

// =========================================================================
// Exp 18: element.replaceChildren(...nodes) for atomic list updates
// =========================================================================
test('Exp 18: replaces rendered DOM nodes atomically via replaceChildren(...nodes) without appendChild loops', async ({
  page,
  TARGET_URL,
}) => {
  const project = getAstProject();
  const calls = getCalls(project);

  const withArgsReplaceChildrenAstCalls = calls.filter(
    (c) => getMethodName(c) === 'replaceChildren' && c.getArguments().length >= 1,
  );
  const appendChildInLoopAstCalls = calls.filter(
    (c) => getMethodName(c) === 'appendChild' && isInsideIteration(c),
  );

  expect(withArgsReplaceChildrenAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(appendChildInLoopAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'load' });

  const initialCount = await page.locator('main .card').count();
  expect(initialCount).toBeGreaterThanOrEqual(6);

  await resetRenderSpies(page);
  const { categorySelect } = getMenuControls(page);
  await categorySelect.selectOption('cold-brew');

  const filteredCount = await page.locator('main .card').count();
  expect(filteredCount).toBeGreaterThanOrEqual(1);
  expect(filteredCount).toBeLessThan(initialCount);

  await categorySelect.selectOption('all');
  expect(await page.locator('main .card').count()).toBe(initialCount);

  const spies = await readSpies(page);
  expect(spies.withArgsReplaceChildrenCalls).toBeGreaterThanOrEqual(2);
  expect(spies.appendChildCalls).toBe(0);
});

// =========================================================================
// Exp 20: new CustomEvent() for structured bubbling filter events
// =========================================================================
test('Exp 20: dispatches bubbling daily-grind:filter-change via new CustomEvent() without document.createEvent()', async ({
  page,
  TARGET_URL,
}) => {
  const project = getAstProject();
  const calls = getCalls(project);
  const news = getNews(project);

  const newCustomEventAstNodes = news.filter((n) => {
    const callee = normalizedCallee(n);
    return callee === 'CustomEvent' || callee === 'window.CustomEvent';
  });
  const legacyCreateEventAstCalls = calls.filter((c) => {
    const callee = normalizedCallee(c);
    return callee === 'document.createEvent' || getMethodName(c) === 'initCustomEvent';
  });

  expect(newCustomEventAstNodes.length).toBeGreaterThanOrEqual(1);
  expect(legacyCreateEventAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'load' });

  const { categorySelect } = getMenuControls(page);
  await categorySelect.selectOption('seasonal');

  const spies = await readSpies(page);
  expect(spies.newCustomEventCalls).toBeGreaterThanOrEqual(1);
  expect(spies.createEventCalls).toBe(0);
  expect(spies.capturedFilterEvents.length).toBeGreaterThanOrEqual(1);

  const latestEvent = spies.capturedFilterEvents.at(-1);
  expect(latestEvent?.type).toBe('daily-grind:filter-change');
  expect(latestEvent?.bubbles).toBe(true);
  expect(isPlainRecord(latestEvent?.detail)).toBe(true);
  const detailValues = isPlainRecord(latestEvent?.detail)
    ? Object.values(latestEvent.detail)
    : [];
  expect(detailValues).toContain('seasonal');
});
