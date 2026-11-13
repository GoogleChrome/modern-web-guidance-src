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
 * - Exp 8:  TESTED  — Safe grouped key lookup (Object.hasOwn / ?? [] / optional chaining / in / Map.groupBy) when filtered categories have zero matches, without .hasOwnProperty().
 * - Exp 9:  SKIPPED — Promise.withResolvers() is inapplicable to this static client-only page without deferred external callbacks.
 * - Exp 10: SKIPPED — AbortSignal.timeout() is inapplicable because daily-grind makes no fetch() requests or network timeouts.
 * - Exp 11: SKIPPED — AbortSignal.any() is inapplicable because daily-grind has no concurrent cancellable async operations.
 * - Exp 12: SKIPPED — TimeoutError / AbortError handling is inapplicable without AbortSignal or fetch() requests.
 * - Exp 13: SKIPPED — new Error(..., { cause }) chaining is inapplicable because daily-grind has no wrapped low-level I/O failures.
 * - Exp 14: TESTED  — URLSearchParams / URL.searchParams for URL query state sync without manual .split('&') / .split('=').
 * - Exp 15: SKIPPED — TextDecoder is inapplicable because no Uint8Array / ArrayBuffer UTF-8 decoding occurs in this UI.
 * - Exp 16: SKIPPED — TextEncoder is inapplicable because no UTF-8 byte encoding occurs in this UI.
 * - Exp 17: TESTED  — element.replaceChildren() for clearing DOM containers without innerHTML = '' or removeChild loops.
 * - Exp 18: TESTED  — element.replaceChildren(...nodes) (with args) for atomic DOM child replacement on connected containers.
 * - Exp 19: SKIPPED — Plain new Event() is superseded here by Exp 20 because daily-grind:filter-change carries structured state in detail.
 * - Exp 20: TESTED  — new CustomEvent('daily-grind:filter-change', { detail, bubbles: true }) without document.createEvent / initCustomEvent.
 */

import {
  Node as TsNode,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type Project,
  type SourceFile,
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
  jsonStringifyCalls: number;
  toSortedCalls: number;
  arraySortCalls: number;
  toReversedCalls: number;
  arrayReverseCalls: number;
  groupByCalls: number;
  urlSearchParamsCalls: number;
  zeroArgReplaceChildrenCalls: number;
  withArgsReplaceChildrenCalls: number;
  removeChildCalls: number;
  emptyInnerHtmlCalls: number;
  connectedAppendChildCalls: number;
  newCustomEventCalls: number;
  createEventCalls: number;
  capturedFilterEvents: CapturedFilterEvent[];
}

declare global {
  interface Window {
    __dailyGrindSpies?: DailyGrindSpies;
  }
}

interface AstCache {
  project: Project;
  sourceFiles: SourceFile[];
  calls: CallExpression[];
  news: NewExpression[];
}

let cachedAst: AstCache | null = null;

function getAstData(): AstCache {
  if (cachedAst) {
    return cachedAst;
  }
  const project = getJsProject(getTargetFiles(import.meta.url));
  const sourceFiles = project.getSourceFiles();
  const calls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
  const news = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.NewExpression));
  cachedAst = { project, sourceFiles, calls, news };
  return cachedAst;
}

function normalizedCallee(node: CallExpression | NewExpression): string {
  return node.getExpression().getText().replace(/\s+/g, '');
}

function getMethodName(call: CallExpression): string | null {
  const expr = call.getExpression();
  return TsNode.isPropertyAccessExpression(expr) ? expr.getName() : null;
}

function isGroupBucketReduceCall(call: CallExpression): boolean {
  if (getMethodName(call) !== 'reduce') return false;
  const callback = call.getArguments()[0];
  if (!callback) return false;
  const mutatesArrayBucket = callback
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((inner) => getMethodName(inner) === 'push');
  if (mutatesArrayBucket) return true;
  return callback.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
    if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) return false;
    return TsNode.isArrayLiteralExpression(bin.getRight());
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const RUNTIME_SPIES_INIT_SCRIPT = `(() => {
  const spies = {
    structuredCloneCalls: 0,
    jsonStringifyCalls: 0,
    toSortedCalls: 0,
    arraySortCalls: 0,
    toReversedCalls: 0,
    arrayReverseCalls: 0,
    groupByCalls: 0,
    urlSearchParamsCalls: 0,
    zeroArgReplaceChildrenCalls: 0,
    withArgsReplaceChildrenCalls: 0,
    removeChildCalls: 0,
    emptyInnerHtmlCalls: 0,
    connectedAppendChildCalls: 0,
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

  const origJsonStringify = JSON.stringify;
  JSON.stringify = function jsonStringifySpy(value, replacer, space) {
    if (isFromApp()) spies.jsonStringifyCalls += 1;
    return origJsonStringify.call(JSON, value, replacer, space);
  };

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

  const OrigURLSearchParams = window.URLSearchParams;
  window.URLSearchParams = new Proxy(OrigURLSearchParams, {
    construct(target, args, newTarget) {
      if (isFromApp()) spies.urlSearchParamsCalls += 1;
      return Reflect.construct(target, args, newTarget);
    },
  });

  const searchParamsDesc = Object.getOwnPropertyDescriptor(URL.prototype, 'searchParams');
  if (searchParamsDesc && searchParamsDesc.get) {
    const origSearchParamsGet = searchParamsDesc.get;
    Object.defineProperty(URL.prototype, 'searchParams', {
      ...searchParamsDesc,
      get() {
        if (isFromApp()) spies.urlSearchParamsCalls += 1;
        return origSearchParamsGet.call(this);
      },
    });
  }

  for (const proto of [Element.prototype, DocumentFragment.prototype, Document.prototype]) {
    const origReplaceChildren = proto.replaceChildren;
    if (typeof origReplaceChildren === 'function') {
      proto.replaceChildren = function replaceChildrenSpy(...nodes) {
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
  }

  const origRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChildSpy(child) {
    if (isFromApp()) spies.removeChildCalls += 1;
    return origRemoveChild.call(this, child);
  };

  const origAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function appendChildSpy(child) {
    if (isFromApp() && this && this.isConnected) {
      spies.connectedAppendChildCalls += 1;
    }
    return origAppendChild.call(this, child);
  };

  const origElementAppend = Element.prototype.append;
  if (typeof origElementAppend === 'function') {
    Element.prototype.append = function elementAppendSpy(...nodes) {
      if (isFromApp() && this && this.isConnected) {
        spies.connectedAppendChildCalls += 1;
      }
      return origElementAppend.apply(this, nodes);
    };
  }

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

async function resetSpyCounters(page: Page): Promise<void> {
  await page.evaluate(() => {
    const spies = window.__dailyGrindSpies;
    if (!spies) return;
    spies.structuredCloneCalls = 0;
    spies.jsonStringifyCalls = 0;
    spies.urlSearchParamsCalls = 0;
    spies.zeroArgReplaceChildrenCalls = 0;
    spies.withArgsReplaceChildrenCalls = 0;
    spies.removeChildCalls = 0;
    spies.emptyInnerHtmlCalls = 0;
    spies.connectedAppendChildCalls = 0;
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
    milkSelect: draft.getByRole('combobox').first(),
    noteInput: draft.locator('input:not([type]), input[type="text"], textarea').first(),
    saveBtn: draft.getByRole('button', { name: /save/i }),
    restoreBtn: draft.getByRole('button', { name: /restore/i }),
    clearBtn: draft.getByRole('button', { name: /clear/i }),
    items: draft
      .locator('ul li, ol li, [data-order-item], .order-item')
      .filter({ hasNotText: /\bempty\b|no drinks/i }),
  };
}

async function isToggleActive(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      return el.checked;
    }
    return (
      el.getAttribute('aria-pressed') === 'true' ||
      el.getAttribute('aria-checked') === 'true' ||
      el.classList.contains('active')
    );
  });
}

async function selectSortByPattern(sortSelect: Locator, pattern: RegExp): Promise<void> {
  const value = await sortSelect.evaluate((el, patternSource) => {
    if (!(el instanceof HTMLSelectElement)) {
      throw new Error('Expected a <select> element for sort control.');
    }
    const regex = new RegExp(patternSource, 'i');
    const match = Array.from(el.options).find(
      (opt) => regex.test(opt.textContent ?? '') || regex.test(opt.value),
    );
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
    const selected = el.selectedOptions[0];
    return `${selected?.textContent?.trim() ?? ''} ${selected?.value ?? ''}`;
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

const PRICE_ASC_PATTERN = /low.*high|price[-_ ]?(?:asc|low)|\basc(?:ending)?\b|lowest/i;
const PRICE_DESC_PATTERN = /high.*low|price[-_ ]?(?:desc|high)|\bdesc(?:ending)?\b|highest/i;

// =========================================================================
// Exp 1: structuredClone() for deep draft order snapshots
// =========================================================================
test('Exp 1: uses structuredClone() for deep draft order snapshots without JSON round-trip', async ({
  page,
  TARGET_URL,
}) => {
  const { calls } = getAstData();

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
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  const { milkSelect, noteInput, saveBtn, restoreBtn, items } = getDraftControls(page);
  const firstAddBtn = page.locator('main .card button').first();

  await milkSelect.selectOption('Whole');
  await noteInput.fill('Extra hot snapshot');
  await firstAddBtn.click();

  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Whole');
  await expect(items.first()).toContainText('Extra hot snapshot');

  await resetSpyCounters(page);
  await saveBtn.click();
  const spiesAfterSave = await readSpies(page);
  expect(spiesAfterSave.structuredCloneCalls).toBeGreaterThanOrEqual(1);
  expect(spiesAfterSave.jsonStringifyCalls).toBe(0);

  // Mutate active order after saving snapshot.
  await milkSelect.selectOption('Oat');
  await noteInput.fill('After snapshot edit');
  await page.locator('main .card button').nth(1).click();
  await expect(items).toHaveCount(2);

  // Restore snapshot and confirm post-save mutations did not affect it.
  await resetSpyCounters(page);
  await restoreBtn.click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Whole');
  await expect(items.first()).toContainText('Extra hot snapshot');

  const spiesAfterRestore = await readSpies(page);
  expect(spiesAfterRestore.structuredCloneCalls).toBeGreaterThanOrEqual(1);
  expect(spiesAfterRestore.jsonStringifyCalls).toBe(0);

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
  const { calls } = getAstData();

  const toSortedAstCalls = calls.filter((c) => getMethodName(c) === 'toSorted');
  const legacySortAstCalls = calls.filter((c) => getMethodName(c) === 'sort');

  expect(toSortedAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(legacySortAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  const initial = await getCardSnapshot(page);
  expect(initial.titles.length).toBeGreaterThanOrEqual(6);

  const { sortSelect } = getMenuControls(page);
  await selectSortByPattern(sortSelect, PRICE_ASC_PATTERN);

  const sorted = await getCardSnapshot(page);
  expect(sorted.prices.length).toBe(initial.titles.length);
  const isAscending = sorted.prices.every(
    (price, idx) => Number.isFinite(price) && (idx === 0 || sorted.prices[idx - 1] <= price),
  );
  expect(isAscending).toBe(true);

  // Resetting sort back to default option restores the unmutated original order.
  const firstOptionInfo = await sortSelect.evaluate((el) => {
    if (!(el instanceof HTMLSelectElement)) {
      throw new Error('Expected a <select> element for sort control.');
    }
    return {
      count: el.options.length,
      firstValue: el.options[0]?.value ?? '',
    };
  });
  expect(firstOptionInfo.count).toBeGreaterThanOrEqual(2);
  await sortSelect.selectOption(firstOptionInfo.firstValue);
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
  const { calls } = getAstData();

  const toReversedAstCalls = calls.filter((c) => getMethodName(c) === 'toReversed');
  const legacyReverseAstCalls = calls.filter((c) => getMethodName(c) === 'reverse');

  expect(toReversedAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(legacyReverseAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

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
test('Exp 7: uses Object.groupBy() or Map.groupBy() instead of .reduce() bucket accumulators', async ({
  page,
  TARGET_URL,
}) => {
  const { calls } = getAstData();

  const groupByAstCalls = calls.filter((c) => {
    const callee = normalizedCallee(c);
    return callee === 'Object.groupBy' || callee === 'Map.groupBy';
  });
  const reduceBucketAstCalls = calls.filter(isGroupBucketReduceCall);

  expect(groupByAstCalls.length).toBeGreaterThanOrEqual(1);
  expect(reduceBucketAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  const { groupToggle } = getMenuControls(page);
  await groupToggle.click();
  expect(await isToggleActive(groupToggle)).toBe(true);

  const afterToggleSpies = await readSpies(page);
  expect(afterToggleSpies.groupByCalls).toBeGreaterThanOrEqual(1);

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
test('Exp 8: handles empty filtered groups safely without .hasOwnProperty()', async ({
  page,
  TARGET_URL,
}) => {
  const { calls, sourceFiles } = getAstData();

  const hasOwnPropertyAstCalls = calls.filter((c) => {
    const callee = normalizedCallee(c);
    return (
      getMethodName(c) === 'hasOwnProperty' ||
      callee.includes('Object.prototype.hasOwnProperty')
    );
  });
  const unwrapParen = (node: TsNode): TsNode => {
    let cur = node;
    while (TsNode.isParenthesizedExpression(cur)) {
      cur = cur.getExpression();
    }
    return cur;
  };
  const exprKey = (node: TsNode): string => unwrapParen(node).getText().replace(/\s+/g, '');

  const isGroupByCall = (node: TsNode): boolean =>
    TsNode.isCallExpression(node) &&
    (normalizedCallee(node) === 'Object.groupBy' || normalizedCallee(node) === 'Map.groupBy');

  const groupByExprKeys = new Set<string>();
  const groupByHelperNames = new Set<string>();

  const isGroupByResultExpr = (node: TsNode): boolean => {
    const cur = unwrapParen(node);
    if (isGroupByCall(cur)) return true;
    if (TsNode.isCallExpression(cur)) {
      const callee = normalizedCallee(cur);
      const methodName = getMethodName(cur);
      if (groupByHelperNames.has(callee) || (methodName !== null && groupByHelperNames.has(methodName))) {
        return true;
      }
    }
    return (
      (TsNode.isIdentifier(cur) || TsNode.isPropertyAccessExpression(cur)) &&
      groupByExprKeys.has(exprKey(cur))
    );
  };

  const isDirectFunctionAncestor = (node: TsNode, fn: TsNode): boolean =>
    node.getFirstAncestor(
      (a) =>
        TsNode.isFunctionDeclaration(a) ||
        TsNode.isFunctionExpression(a) ||
        TsNode.isArrowFunction(a) ||
        TsNode.isMethodDeclaration(a),
    ) === fn;

  const varDecls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration));
  const assignments = sourceFiles
    .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.BinaryExpression))
    .filter((bin) => bin.getOperatorToken().getKind() === SyntaxKind.EqualsToken);
  const functionLikes = sourceFiles.flatMap((sf) => [
    ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
  ]);

  for (let pass = 0; pass < 5; pass += 1) {
    const prevCount = groupByExprKeys.size + groupByHelperNames.size;
    for (const decl of varDecls) {
      const init = decl.getInitializer();
      const nameNode = decl.getNameNode();
      if (init && TsNode.isIdentifier(nameNode) && isGroupByResultExpr(init)) {
        groupByExprKeys.add(exprKey(nameNode));
      }
    }
    for (const bin of assignments) {
      const lhs = unwrapParen(bin.getLeft());
      if (
        (TsNode.isIdentifier(lhs) || TsNode.isPropertyAccessExpression(lhs)) &&
        isGroupByResultExpr(bin.getRight())
      ) {
        groupByExprKeys.add(exprKey(lhs));
      }
    }
    for (const fn of functionLikes) {
      let returnsGroupBy = false;
      if (TsNode.isArrowFunction(fn) && !TsNode.isBlock(fn.getBody())) {
        returnsGroupBy = isGroupByResultExpr(fn.getBody());
      } else {
        returnsGroupBy = fn
          .getDescendantsOfKind(SyntaxKind.ReturnStatement)
          .some((ret) => {
            if (!isDirectFunctionAncestor(ret, fn)) return false;
            const expr = ret.getExpression();
            return expr !== undefined && isGroupByResultExpr(expr);
          });
      }
      if (!returnsGroupBy) continue;
      if (
        TsNode.isFunctionDeclaration(fn) ||
        TsNode.isFunctionExpression(fn) ||
        TsNode.isMethodDeclaration(fn)
      ) {
        const name = fn.getName();
        if (name) groupByHelperNames.add(name);
      }
      if (TsNode.isArrowFunction(fn) || TsNode.isFunctionExpression(fn)) {
        const parent = fn.getParent();
        if (TsNode.isVariableDeclaration(parent) && TsNode.isIdentifier(parent.getNameNode())) {
          groupByHelperNames.add(parent.getNameNode().getText());
        } else if (TsNode.isPropertyAssignment(parent)) {
          groupByHelperNames.add(parent.getName());
        } else if (
          TsNode.isBinaryExpression(parent) &&
          parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
          parent.getRight() === fn
        ) {
          const lhs = unwrapParen(parent.getLeft());
          if (TsNode.isIdentifier(lhs) || TsNode.isPropertyAccessExpression(lhs)) {
            groupByHelperNames.add(exprKey(lhs));
          }
        }
      }
    }
    if (groupByExprKeys.size + groupByHelperNames.size === prevCount) break;
  }

  const isGroupByOrBucketExpr = (node: TsNode): boolean => {
    const cur = unwrapParen(node);
    if (isGroupByResultExpr(cur)) return true;
    if (TsNode.isPropertyAccessExpression(cur) || TsNode.isElementAccessExpression(cur)) {
      return isGroupByResultExpr(cur.getExpression());
    }
    return false;
  };

  const usesMapGroupBy =
    calls.some((c) => normalizedCallee(c) === 'Map.groupBy') &&
    calls.some((c) => {
      const expr = c.getExpression();
      return (
        getMethodName(c) === 'get' &&
        TsNode.isPropertyAccessExpression(expr) &&
        isGroupByResultExpr(expr.getExpression())
      );
    });
  const usesObjectGroupBy = calls.some((c) => normalizedCallee(c) === 'Object.groupBy');
  const usesObjectHasOwn = calls.some((c) => normalizedCallee(c) === 'Object.hasOwn');
  const usesSafeBucketSyntax = sourceFiles.some((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
      const op = bin.getOperatorToken().getKind();
      if (op === SyntaxKind.InKeyword) {
        return isGroupByResultExpr(bin.getRight());
      }
      return (
        (op === SyntaxKind.QuestionQuestionToken || op === SyntaxKind.BarBarToken) &&
        bin.getRight().getText().trim() === '[]'
      );
    }) ||
    sf
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((acc) => acc.hasQuestionDotToken() && isGroupByOrBucketExpr(acc.getExpression())) ||
    sf
      .getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
      .some((acc) => acc.hasQuestionDotToken() && isGroupByOrBucketExpr(acc.getExpression())),
  );

  expect(hasOwnPropertyAstCalls).toEqual([]);
  expect(usesMapGroupBy || (usesObjectGroupBy && (usesObjectHasOwn || usesSafeBucketSyntax))).toBe(
    true,
  );

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  const initialCount = await page.locator('main .card').count();
  const { categorySelect, groupToggle } = getMenuControls(page);

  await groupToggle.click();
  await categorySelect.selectOption('espresso');

  const filteredCount = await page.locator('main .card').count();
  expect(filteredCount).toBeGreaterThanOrEqual(1);
  expect(filteredCount).toBeLessThan(initialCount);

  const mainText = (await page.locator('main').textContent()) ?? '';
  expect(/seasonal\D*0|0\D*seasonal/i.test(mainText)).toBe(true);
  expect(/cold[\s-]*brew\D*0|0\D*cold[\s-]*brew/i.test(mainText)).toBe(true);
  expect(pageErrors).toEqual([]);
});

// =========================================================================
// Exp 14: URLSearchParams / URL.searchParams for URL query state sync
// =========================================================================
test('Exp 14: syncs and restores filter state using URLSearchParams without manual string splitting', async ({
  page,
  TARGET_URL,
}) => {
  const { calls, news, sourceFiles } = getAstData();

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

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await resetSpyCounters(page);
  const { categorySelect, sortSelect, reverseToggle } = getMenuControls(page);

  await categorySelect.selectOption('espresso');
  await selectSortByPattern(sortSelect, PRICE_DESC_PATTERN);
  await reverseToggle.click();

  const spies = await readSpies(page);
  expect(spies.urlSearchParamsCalls).toBeGreaterThanOrEqual(1);

  const syncedUrl = page.url();
  expect(new URL(syncedUrl).search.length).toBeGreaterThan(1);

  const syncedCards = await getCardSnapshot(page);

  // Navigate cleanly to the synced URL to verify initial load restoration.
  await page.goto(syncedUrl, { waitUntil: 'domcontentloaded' });
  const reloadedControls = getMenuControls(page);
  await expect(reloadedControls.categorySelect).toHaveValue('espresso');
  expect(await getSelectedSortLabel(reloadedControls.sortSelect)).toMatch(PRICE_DESC_PATTERN);
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
  const { calls, sourceFiles } = getAstData();

  const zeroArgReplaceChildrenAstCalls = calls.filter(
    (c) =>
      getMethodName(c) === 'replaceChildren' &&
      (c.getArguments().length === 0 ||
        c.getArguments().some((arg) => TsNode.isSpreadElement(arg))),
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
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  const { clearBtn, items } = getDraftControls(page);
  await page.locator('main .card button').first().click();
  await expect(items).toHaveCount(1);

  await resetSpyCounters(page);
  await clearBtn.click();

  await expect(items).toHaveCount(0);
  const spies = await readSpies(page);
  expect(
    spies.zeroArgReplaceChildrenCalls + spies.withArgsReplaceChildrenCalls,
  ).toBeGreaterThanOrEqual(1);
  expect(spies.removeChildCalls).toBe(0);
  expect(spies.emptyInnerHtmlCalls).toBe(0);
});

// =========================================================================
// Exp 18: element.replaceChildren(...nodes) for atomic list updates
// =========================================================================
test('Exp 18: replaces connected DOM container nodes atomically via replaceChildren(...nodes)', async ({
  page,
  TARGET_URL,
}) => {
  const { calls } = getAstData();

  const withArgsReplaceChildrenAstCalls = calls.filter(
    (c) => getMethodName(c) === 'replaceChildren' && c.getArguments().length >= 1,
  );
  expect(withArgsReplaceChildrenAstCalls.length).toBeGreaterThanOrEqual(1);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  const initialCount = await page.locator('main .card').count();
  expect(initialCount).toBeGreaterThanOrEqual(6);

  await resetSpyCounters(page);
  const { categorySelect } = getMenuControls(page);
  await categorySelect.selectOption('cold-brew');

  const filteredCount = await page.locator('main .card').count();
  expect(filteredCount).toBeGreaterThanOrEqual(1);
  expect(filteredCount).toBeLessThan(initialCount);

  await categorySelect.selectOption('all');
  expect(await page.locator('main .card').count()).toBe(initialCount);

  const spies = await readSpies(page);
  expect(spies.withArgsReplaceChildrenCalls).toBeGreaterThanOrEqual(2);
  expect(spies.connectedAppendChildCalls).toBe(0);
});

// =========================================================================
// Exp 20: new CustomEvent() for structured bubbling filter events
// =========================================================================
test('Exp 20: dispatches bubbling daily-grind:filter-change via new CustomEvent() without document.createEvent()', async ({
  page,
  TARGET_URL,
}) => {
  const { calls, news } = getAstData();

  const newCustomEventAstNodes = news.filter((n) => {
    const callee = normalizedCallee(n);
    return (
      callee === 'CustomEvent' ||
      callee === 'window.CustomEvent' ||
      callee === 'globalThis.CustomEvent'
    );
  });
  const legacyCreateEventAstCalls = calls.filter((c) => {
    const callee = normalizedCallee(c);
    return callee === 'document.createEvent' || getMethodName(c) === 'initCustomEvent';
  });

  expect(newCustomEventAstNodes.length).toBeGreaterThanOrEqual(1);
  expect(legacyCreateEventAstCalls).toEqual([]);

  await installRuntimeSpies(page);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

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
  const serializedDetail = JSON.stringify(latestEvent?.detail ?? {}).toLowerCase();
  expect(serializedDetail.includes('seasonal')).toBe(true);
});
