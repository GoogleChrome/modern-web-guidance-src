import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** @type {{ suites: Array<Record<string, any>> }} */
const SHOWCASE_SUITES_FIXTURE = JSON.parse(
  readFileSync(new URL('./mock-results/showcase-suites.json', import.meta.url), 'utf8')
);

/**
 * Adds a legacy suite entry that omits `reasoningEffort` altogether so tests cover both
 * explicit `{ source: 'agent-default' }` and pre-feature suites without the field.
 */
const SUITES_WITH_LEGACY = {
  suites: [
    ...SHOWCASE_SUITES_FIXTURE.suites,
    {
      testId: 'adhoc-2026-10-25_09-00-00-legacy',
      timestamp: '2026-10-25T09:30:00.000Z',
      agent: 'gemini_cli',
      serving: 'skills_cli',
      model: 'gemini-3.8-flash',
      taskCount: 20,
      maxRuns: 1,
      guidedStats: { passed: 16, total: 20 },
      unguidedStats: { passed: 10, total: 20 },
      a11yStats: {
        guidedPassed: 4,
        guidedTotal: 5,
        guidedRate: 80,
        unguidedPassed: 2,
        unguidedTotal: 5,
        unguidedRate: 40,
        uplift: 40,
        guideCount: 3,
        bySubCategory: {},
      },
      earlyFailureRate: 0,
      guides: {
        'content-vis': {
          guidedPassed: 6,
          guidedTotal: 7,
          guidedRate: 86,
          unguidedPassed: 3,
          unguidedTotal: 7,
          unguidedRate: 43,
          uplift: 43,
          taskName: 'content-vis-task',
        },
      },
      showcase: {},
    },
  ],
};

/** @param {import('@playwright/test').Page} page */
function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test.describe('Reasoning effort chips, filters, and insights sub-grouping', () => {
  test('renders effort chips and provenance tooltips across spotlight and suite rows, including missing reasoningEffort fallback', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/suites*', route => route.fulfill({ json: SUITES_WITH_LEGACY }));
    await page.goto('/');

    const effortTooltip = page.locator('#effort-tooltip');
    await expect(effortTooltip).toHaveAttribute('popover', 'hint');

    // A/B Spotlight provenance bar shows model + effort chip
    const provChip = page.locator('#ab-run-provenance button.effort-chip');
    await expect(provChip).toHaveText('high');
    await provChip.focus();
    await expect(effortTooltip).toBeVisible();
    await expect(effortTooltip).toHaveText('Reasoning effort: high (configured by harness)');
    await page.keyboard.press('Escape');
    await expect(effortTooltip).toBeHidden();

    // Show all runs (including ad-hoc) to inspect all 4 sources + legacy omitted field
    await page.locator('#scheduled-only-check').uncheck();
    await page.mouse.move(2, 2);
    await expect(page.locator('#suites-list .suite-table-row')).toHaveCount(7);

    /** @type {Array<[string, string, string, RegExp]>} */
    const expectedRows = [
      ['nightly-2026-10-27_23-00-02-antigravity_cli', 'high', 'Reasoning effort: high (observed from agent logs)', /effort-chip--explicit/],
      ['weekly-2026-10-27_18-00-00-antigravity_cli', 'medium', 'Reasoning effort: medium (configured by harness)', /effort-chip--explicit/],
      ['adhoc-2026-10-27_12-00-00-pi', 'low', 'Reasoning effort: low (from model ID)', /effort-chip--explicit/],
      ['adhoc-2026-10-26_15-00-00-opencode', 'default', 'Reasoning effort: default (CLI built-in default; not explicitly configured or logged)', /effort-chip--default/],
      ['adhoc-2026-10-25_09-00-00-legacy', 'default', 'Reasoning effort: default (CLI built-in default; not explicitly configured or logged)', /effort-chip--default/],
    ];

    for (const [testId, level, tooltipText, clsPattern] of expectedRows) {
      const row = page.locator(`.suite-table-row[data-test-id="${testId}"]`);
      const chip = row.locator('.model-cell button.effort-chip');
      await expect(chip).toHaveText(level);
      await expect(chip).toHaveClass(clsPattern);
      await chip.scrollIntoViewIfNeeded();
      await chip.focus();
      await expect(effortTooltip).toBeVisible();
      await expect(effortTooltip).toHaveText(tooltipText);
      await page.keyboard.press('Escape');
      await expect(effortTooltip).toBeHidden();
    }

    // Mathematical vertical centering between model text and effort chip
    const alignment = await page.locator('.suite-table-row[data-test-id="nightly-2026-10-27_23-00-02-antigravity_cli"] .model-cell-inner').evaluate(el => {
      const textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
      const range = document.createRange();
      if (textNode) range.selectNodeContents(textNode);
      const textRect = range.getBoundingClientRect();
      const chipRect = el.querySelector('.effort-chip')?.getBoundingClientRect();
      if (!chipRect) return Infinity;
      const textCenter = textRect.top + textRect.height / 2;
      const chipCenter = chipRect.top + chipRect.height / 2;
      return Math.abs(textCenter - chipCenter);
    });
    expect(alignment).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  test('populates #runs-filter-datalist with effort:<level> options and filters runs case-insensitively and composably', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/suites*', route => route.fulfill({ json: SUITES_WITH_LEGACY }));
    await page.goto('/?q=effort%3Alow');

    const filterInput = page.locator('#filter-search');
    const suiteRows = page.locator('#suites-list .suite-table-row');

    // Initial URL ?q=effort:low filters immediately (even ad-hoc suites)
    await expect(filterInput).toHaveValue('effort:low');
    await expect(suiteRows).toHaveCount(1);
    await expect(suiteRows.first()).toHaveAttribute('data-test-id', 'adhoc-2026-10-27_12-00-00-pi');

    // Verify datalist suggestions include effort:<level> with counts and labels
    const datalistOptions = await page.locator('#runs-filter-datalist option[value^="effort:"]').evaluateAll(opts =>
      opts.map(o => ({ value: o.getAttribute('value'), label: o.getAttribute('label') }))
    );
    expect(datalistOptions).toEqual([
      { value: 'effort:default', label: 'Reasoning effort: default (CLI built-in default) · 2 runs' },
      { value: 'effort:high', label: 'Reasoning effort: high · 2 runs' },
      { value: 'effort:low', label: 'Reasoning effort: low · 1 run' },
      { value: 'effort:medium', label: 'Reasoning effort: medium · 2 runs' },
    ]);

    // Case-insensitive EFFORT:MEDIUM
    await filterInput.fill('EFFORT:MEDIUM');
    await expect(suiteRows).toHaveCount(2);

    // Composable model + effort:<level>
    await filterInput.fill('gemini-4-argon effort:medium');
    await expect(suiteRows).toHaveCount(1);
    await expect(suiteRows.first()).toHaveAttribute('data-test-id', 'weekly-2026-10-27_18-00-00-antigravity_cli');
    expect(new URL(page.url()).searchParams.get('q')).toBe('gemini-4-argon effort:medium');

    // effort:default matches both { source: 'agent-default' } and omitted reasoningEffort
    await filterInput.fill('effort:default');
    await expect(suiteRows).toHaveCount(2);
    const defaultIds = await suiteRows.evaluateAll(rows => rows.map(r => r.getAttribute('data-test-id')).sort());
    expect(defaultIds).toEqual([
      'adhoc-2026-10-25_09-00-00-legacy',
      'adhoc-2026-10-26_15-00-00-opencode',
    ]);

    expect(errors).toEqual([]);
  });

  test('toggles By effort in the Model insights panel to compare gemini-4-argon efforts side-by-side and syncs effort:<level> filter', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    const suitesWithAdhocArgonLow = {
      suites: [
        ...SHOWCASE_SUITES_FIXTURE.suites,
        {
          ...SHOWCASE_SUITES_FIXTURE.suites[0],
          testId: 'adhoc-2026-10-20_10-00-00-antigravity_cli',
          timestamp: '2026-10-20T10:00:00.000Z',
          agent: 'antigravity_cli',
          model: 'gemini-4-argon',
          reasoningEffort: { level: 'low', source: 'configured' },
          guidedStats: { passed: 1200, total: 1646 },
          unguidedStats: { passed: 800, total: 1646 },
        },
      ],
    };
    await page.route('**/api/suites*', route => route.fulfill({ json: suitesWithAdhocArgonLow }));
    await page.goto('/');

    await page.locator('#breakdowns > summary').click();
    await page.mouse.move(2, 2);

    const modelPanel = page.locator('.insights-panel[data-panel="model"]');
    const splitBtn = modelPanel.locator('.insights-effort-split-btn[data-model-effort-split]');
    await expect(splitBtn).toBeVisible();
    await expect(splitBtn).toHaveAttribute('aria-pressed', 'false');

    // Default un-split view preserves 1 row per model (5 models in fixture)
    await expect(modelPanel.locator('.pivot-row')).toHaveCount(5);
    const unsplitArgon = modelPanel.locator('.pivot-filter-btn[data-filter-value="gemini-4-argon"]');
    await expect(unsplitArgon).toHaveCount(1);
    await expect(unsplitArgon.locator('.effort-chip')).toHaveCount(0);

    // Toggle By effort ON -> groups per (model, effort) bucket in getModelInsightKeys() so
    // ad-hoc gemini-4-argon (low) is not erased by scheduled gemini-4-argon (high/medium) runs
    await splitBtn.click();
    await expect(splitBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(modelPanel.locator('.pivot-row')).toHaveCount(7);

    const splitArgonBtns = modelPanel.locator('.pivot-filter-btn[data-filter-value="gemini-4-argon"]');
    await expect(splitArgonBtns).toHaveCount(3);
    // Pure model ID is preserved on data-filter-value; canonical effort ordering puts low -> medium -> high
    await expect(splitArgonBtns.nth(0)).toHaveAttribute('data-filter-effort', 'low');
    await expect(splitArgonBtns.nth(0).locator('.effort-chip')).toHaveText('low');
    await expect(splitArgonBtns.nth(1)).toHaveAttribute('data-filter-effort', 'medium');
    await expect(splitArgonBtns.nth(1).locator('.effort-chip')).toHaveText('medium');
    await expect(splitArgonBtns.nth(2)).toHaveAttribute('data-filter-effort', 'high');
    await expect(splitArgonBtns.nth(2).locator('.effort-chip')).toHaveText('high');

    // Sorting by uplift (high to low) places gemini-4-argon [high] (+35 pp) above [medium] (+31 pp) above [low] (+24 pp)
    await modelPanel.locator('.insights-uplift-sort-btn[data-panel-uplift-sort="model"]').click();
    const sortedArgonEfforts = await modelPanel
      .locator('.pivot-filter-btn[data-filter-value="gemini-4-argon"]')
      .evaluateAll(btns => btns.map(b => b.getAttribute('data-filter-effort')));
    expect(sortedArgonEfforts).toEqual(['high', 'medium', 'low']);

    // Clicking the medium split row filters #suites-list and reflects effort:medium in #filter-search and URL ?q=
    const mediumBtn = modelPanel.locator('.pivot-filter-btn[data-filter-value="gemini-4-argon"][data-filter-effort="medium"]');
    await mediumBtn.click();
    await expect(mediumBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#filter-model')).toHaveValue('gemini-4-argon');
    await expect(page.locator('#filter-search')).toHaveValue('effort:medium');
    expect(new URL(page.url()).searchParams.get('q')).toBe('effort:medium');
    const visibleSuites = page.locator('#suites-list .suite-table-row');
    await expect(visibleSuites).toHaveCount(1);
    await expect(visibleSuites.first()).toHaveAttribute('data-test-id', 'weekly-2026-10-27_18-00-00-antigravity_cli');

    // Turning By effort OFF resets the split effort filter in #filter-search and URL while keeping model filter
    await modelPanel.locator('.insights-effort-split-btn[data-model-effort-split]').click();
    await expect(modelPanel.locator('.insights-effort-split-btn[data-model-effort-split]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#filter-search')).toHaveValue('');
    expect(new URL(page.url()).searchParams.get('q')).toBeNull();
    await expect(visibleSuites).toHaveCount(2);

    expect(errors).toEqual([]);
  });

  test('renders effort chips and tooltips on suite header, trajectory viewer modal, and legacy suite fallback', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard.html?testId=example-result');

    const effortTooltip = page.locator('#effort-tooltip');
    await expect(effortTooltip).toHaveAttribute('popover', 'hint');

    const headerChip = page.locator('#test-header .meta-value-model button.effort-chip');
    await expect(headerChip).toBeVisible();
    await expect(headerChip).toHaveText('high');
    await headerChip.focus();
    await expect(effortTooltip).toBeVisible();
    await expect(effortTooltip).toHaveText('Reasoning effort: high (observed from agent logs)');
    await page.keyboard.press('Escape');
    await expect(effortTooltip).toBeHidden();

    // Open content-vis task accordion and launch the guided Trajectory modal
    const contentVisAccordion = page.locator('.task-accordion[data-guide="content-vis"]');
    await contentVisAccordion.locator('.task-toggle').click();
    const trajBtn = contentVisAccordion.locator('.tfoot-action-btn[data-action="trajectory"]');
    await expect(trajBtn).toBeVisible();
    await trajBtn.click();

    const modalPill = page.locator('#modal .trajectory-meta-pill');
    await expect(modalPill).toBeVisible();
    await expect(modalPill.locator('.trajectory-meta-model')).toHaveText('gemini-4-argon');
    const trajChip = modalPill.locator('button.effort-chip');
    await expect(trajChip).toHaveText('high');
    await trajChip.focus();
    await expect(effortTooltip).toBeVisible();
    await expect(effortTooltip).toHaveText('Reasoning effort: high (observed from agent logs)');
    await page.keyboard.press('Escape');
    await expect(effortTooltip).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();

    // Legacy suite without reasoningEffort renders subtle default chip
    await page.route('**/example-result/evals.json*', async route => {
      const json = await (await route.fetch()).json();
      delete json.reasoningEffort;
      await route.fulfill({ json });
    });
    await page.reload();
    const fallbackChip = page.locator('#test-header .meta-value-model button.effort-chip');
    await expect(fallbackChip).toHaveText('default');
    await expect(fallbackChip).toHaveClass(/effort-chip--default/);
    await fallbackChip.focus();
    await expect(effortTooltip).toHaveText(
      'Reasoning effort: default (CLI built-in default; not explicitly configured or logged)'
    );

    expect(errors).toEqual([]);
  });

  test('splits guide timeline cards by effort only when (agent, model) has >= 2 distinct explicit effort levels', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    const suitesForGuideView = {
      suites: [
        ...SUITES_WITH_LEGACY.suites,
        // New run of gemini_cli on gemini-3.8-flash with explicit 'high' effort alongside
        // the legacy 'default' run of gemini_cli on gemini-3.8-flash in SUITES_WITH_LEGACY:
        // because (gemini_cli, gemini-3.8-flash) has only 1 explicit effort level ('high'),
        // both runs must remain unified on a single 2-trial timeline card!
        {
          testId: 'nightly-2026-10-28_09-00-00-gemini_cli',
          timestamp: '2026-10-28T09:30:00.000Z',
          agent: 'gemini_cli',
          serving: 'skills_cli',
          model: 'gemini-3.8-flash',
          reasoningEffort: { level: 'high', source: 'observed' },
          taskCount: 20,
          maxRuns: 1,
          guidedStats: { passed: 18, total: 20 },
          unguidedStats: { passed: 10, total: 20 },
          earlyFailureRate: 0,
          guides: {
            'content-vis': {
              guidedPassed: 7,
              guidedTotal: 7,
              guidedRate: 100,
              unguidedPassed: 3,
              unguidedTotal: 7,
              unguidedRate: 43,
              uplift: 57,
              taskName: 'content-vis-task',
            },
          },
        },
      ],
    };
    await page.route('**/api/suites*', route => route.fulfill({ json: suitesForGuideView }));
    await page.goto('/guide.html?guide=content-vis');

    const cards = page.locator('#graphs-grid .guide-stat-card');
    await expect(cards).toHaveCount(4);

    // gemini-4-argon has 2 explicit efforts (high + medium) -> splits into 2 separate cards
    const highCard = page.locator('.guide-stat-card[data-model="gemini-4-argon"][data-effort="high"]');
    const mediumCard = page.locator('.guide-stat-card[data-model="gemini-4-argon"][data-effort="medium"]');
    // gemini-3.8-flash has 1 explicit effort ('high') + 1 legacy ('default') run -> stays unified in 1 card with 2 trials
    const unifiedFlashCard = page.locator('.guide-stat-card[data-model="gemini-3.8-flash"]');
    await expect(highCard).toBeVisible();
    await expect(mediumCard).toBeVisible();
    await expect(unifiedFlashCard).toHaveCount(1);
    await expect(unifiedFlashCard).toHaveAttribute('data-effort', 'high');
    await expect(unifiedFlashCard.locator('.guide-card-subtitle')).toContainText('2 chronological trials');

    const effortTooltip = page.locator('#effort-tooltip');
    const highChip = highCard.locator('.guide-card-title button.effort-chip');
    await expect(highChip).toHaveText('high');
    await highChip.focus();
    await expect(effortTooltip).toBeVisible();
    await expect(effortTooltip).toHaveText('Reasoning effort: high (observed from agent logs)');
    await page.keyboard.press('Escape');
    await expect(effortTooltip).toBeHidden();

    // Timeline point tooltip displays Reasoning Effort row
    const point = mediumCard.locator('.timeline-point').first();
    await point.focus();
    const pointTooltip = page.locator('#tooltip-container');
    await expect(pointTooltip).toBeVisible();
    await expect(pointTooltip.locator('#tooltip-content')).toContainText('Reasoning Effort:');
    await expect(pointTooltip.locator('#tooltip-content .effort-chip')).toHaveText('medium');

    expect(errors).toEqual([]);
  });
});
