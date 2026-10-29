import { test, expect } from '@playwright/test';

test.describe('Eval View Dashboard', () => {
  test('should load the dashboard and show expected content', async ({ page }) => {
    await page.goto('/');

    // Check title and header navigation links
    await expect(page.locator('.landing-title')).toContainText('Modern Web Guidance Evals');
    await expect(page.locator('.header-links a', { hasText: 'Docs' })).toHaveAttribute('href', 'https://developer.chrome.com/docs/modern-web-guidance');
    await expect(page.locator('.header-links a', { hasText: 'GitHub' })).toHaveAttribute('href', 'https://github.com/GoogleChrome/modern-web-guidance-src');

    // Check suites content
    await expect(page.locator('.suite-table-row').first()).toBeVisible();
    // await page.screenshot({ path: '/tmp/dashboard-landing.png' });
  });

  test('should load suites from API', async ({ page }) => {
    // Attempt to fetch /api/suites through the server
    const response = await page.request.get('/api/suites');
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty('suites');
  });
  
  test('should show barbell summary hover card on rate-cell hover', async ({ page }) => {
    await page.goto('/');

    const firstUpliftCell = page.locator('.uplift-cell').first();
    await expect(firstUpliftCell).toBeVisible();
    await firstUpliftCell.hover();

    const tooltip = page.locator('#barbell-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Without MWG');
    await expect(tooltip).toContainText('With MWG');
    await expect(tooltip).toContainText('Pass-rate lift');
    await expect(tooltip).toContainText('Vertical ticks mark checks passed');

    // WCAG 1.4.13 Hoverable & Dismissible: remains visible when hovered, dismisses on Escape
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
  });


  test('should load specific test dashboard', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');

    // Check title
    await expect(page).toHaveTitle('Suite Results');

    // Check header info
    await expect(page.locator('#test-header')).toContainText('example-result');

    // Check grid exists and has content
    await expect(page.locator('#guide-grid')).toBeVisible();
    
    // Wait for actual accordions to be rendered by JS
    const firstAccordion = page.locator('.task-accordion-header').first();
    await expect(firstAccordion).toBeVisible();
    
    const count = await page.locator('.task-accordion-header').count();
    expect(count).toBeGreaterThan(0);

    // Hover over a dumbbell chart row hit area and verify the tooltip renders its inner content
    const hitArea = page.locator('#dumbbell-chart rect[role="button"]').first();
    await expect(hitArea).toBeVisible();
    await hitArea.hover();

    const dumbbellTooltip = page.locator('#dumbbell-tooltip');
    await expect(dumbbellTooltip).toBeVisible();
    await expect(dumbbellTooltip.locator('.dumbbell-tooltip')).toBeVisible();
    await expect(dumbbellTooltip.locator('.dumbbell-tooltip-title')).not.toBeEmpty();
    await expect(dumbbellTooltip.locator('.dumbbell-tooltip-uplift')).toContainText('pp');

    // WCAG 1.4.13 Hoverable & Dismissible: moving onto the tooltip keeps it open; Escape dismisses it
    await dumbbellTooltip.hover();
    await expect(dumbbellTooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dumbbellTooltip).toBeHidden();

    // Verify both ? hint popovers open anchored near their trigger buttons and stay inside the viewport
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    const a11yHintBtn = page.locator('.anchor-dash-a11y');
    const a11yPopover = page.locator('#dash-tooltip-a11y');
    await a11yHintBtn.focus();
    await expect(a11yPopover).toBeVisible();
    const a11yBtnBox = await a11yHintBtn.boundingBox();
    const a11yPopBox = await a11yPopover.boundingBox();
    expect(a11yBtnBox).not.toBeNull();
    expect(a11yPopBox).not.toBeNull();
    if (a11yBtnBox && a11yPopBox) {
      expect(a11yPopBox.x).toBeGreaterThanOrEqual(0);
      expect(a11yPopBox.x + a11yPopBox.width).toBeLessThanOrEqual(viewport.width);
      expect(Math.abs(a11yPopBox.x - a11yBtnBox.x)).toBeLessThan(20);
    }

    const tokensHintBtn = page.locator('.anchor-dash-tokens');
    const tokensPopover = page.locator('#dash-tooltip-tokens');
    await tokensHintBtn.focus();
    await expect(tokensPopover).toBeVisible();
    const tokensBtnBox = await tokensHintBtn.boundingBox();
    const tokensPopBox = await tokensPopover.boundingBox();
    expect(tokensBtnBox).not.toBeNull();
    expect(tokensPopBox).not.toBeNull();
    if (tokensBtnBox && tokensPopBox) {
      expect(tokensPopBox.x).toBeGreaterThanOrEqual(0);
      expect(tokensPopBox.x + tokensPopBox.width).toBeLessThanOrEqual(viewport.width);
      expect(Math.abs((tokensPopBox.x + tokensPopBox.width) - (tokensBtnBox.x + tokensBtnBox.width))).toBeLessThan(20);
    }

    // Verify the 4 summary cards render in a 2x2 grid on desktop
    const narrativeCards = page.locator('#summary-side-panel article.narrative-card');
    await expect(narrativeCards).toHaveCount(4);
    const c0 = await narrativeCards.nth(0).boundingBox();
    const c1 = await narrativeCards.nth(1).boundingBox();
    const c2 = await narrativeCards.nth(2).boundingBox();
    const c3 = await narrativeCards.nth(3).boundingBox();
    if (c0 && c1 && c2 && c3) {
      expect(Math.abs(c0.y - c1.y)).toBeLessThan(2);
      expect(Math.abs(c2.y - c3.y)).toBeLessThan(2);
      expect(c2.y).toBeGreaterThan(c0.y + 40);
    }
    // await page.screenshot({ path: '/tmp/dashboard-suite.png' });
  });

  test('should show details and toggle diff view', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');

    // Wait for accordions and click the first one
    const firstAccordion = page.locator('.task-accordion-header').first();
    await firstAccordion.click();

    // Verify Diff button exists and click it to open modal
    const diffButton = page.locator('.tfoot-action-btn', { hasText: 'Diff' }).first();
    await expect(diffButton).toBeVisible();
    await diffButton.click();

    // Verify modal is shown
    const modal = page.locator('#modal');
    await expect(modal).toBeVisible();

    // Verify diff content is displayed
    // The title displays the filename (e.g. "index.html")
    await expect(page.locator('#modal-title')).toHaveText('index.html');
    
    // Check for diff-container and some expected diff classes
    const diffContainer = page.locator('.diff-container');
    await expect(diffContainer).toBeVisible();
    
    // Since we're using real data (example-result test), we should see some diff parts
    // We expect either added or unchanged lines
    const diffParts = page.locator('.diff-added, .diff-removed, .diff-unchanged');
    const partsCount = await diffParts.count();
    expect(partsCount).toBeGreaterThan(0);
    // await page.screenshot({ path: '/tmp/dashboard-diff-modal.png' });
  });

  test('should show By Guide panel and navigate to guide.html on click', async ({ page }) => {
    await page.goto('/');

    // Expand the Breakdowns drawer if it's closed
    const insightsDrawer = page.locator('.insights-drawer');
    if (!(await insightsDrawer.getAttribute('open') !== null)) {
      await page.locator('.insights-summary').click();
    }

    // By Guide panel is visible inside the Breakdowns drawer
    const guideDrawer = page.locator('.insights-guide-drawer');
    await expect(guideDrawer).toBeVisible();

    // Verify guides are listed under By Guide
    const contentVisRow = guideDrawer.locator('tr', { hasText: 'content-vis' });
    await expect(contentVisRow).toBeVisible();

    // Click the row to navigate to guide.html
    await contentVisRow.click();
    
    // Check navigation
    await expect(page).toHaveURL(/.*guide.html\?guide=content-vis/);

    // Verify guide.html loads and header has the guide name
    await expect(page.locator('#guide-name-header')).toContainText('content-vis');

    // Verify timeline charts are visible
    const graphsGrid = page.locator('#graphs-grid');
    await expect(graphsGrid).toBeVisible();
    await expect(page.locator('.timeline-point').first()).toBeVisible();

    // Hover over a timeline point to verify tooltip behavior
    await page.locator('.timeline-point').first().hover();
    const tooltip = page.locator('#tooltip-container');
    await expect(tooltip).toBeVisible();
    await expect(page.locator('#tooltip-content')).toBeVisible();

    // WCAG 1.4.13 Hoverable & Dismissible: remains visible when hovered, dismisses on Escape
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    // await page.screenshot({ path: '/tmp/dashboard-guide-timeline.png' });
  });

  test('should support autocomplete search and prev/next guide navigation', async ({ page }) => {
    await page.goto('/guide.html?guide=content-vis');

    // Test search autocomplete list
    const searchInput = page.locator('#guide-search');
    await searchInput.fill('pre');
    
    const autocompleteList = page.locator('#autocomplete-list');
    await expect(autocompleteList).toBeVisible();

    const option = autocompleteList.locator('.autocomplete-item', { hasText: 'preload-prerender' });
    await expect(option).toBeVisible();
    
    // Choose preload-prerender option
    await option.click();
    
    // Check it immediately navigates
    await expect(page).toHaveURL(/.*guide.html\?guide=preload-prerender/);
    await expect(page.locator('#guide-name-header')).toContainText('preload-prerender');

    // Test next/prev navigation buttons
    const nextBtn = page.locator('#next-guide-btn');
    await nextBtn.click();
    
    // Check it navigated to another guide
    await expect(page).toHaveURL(/.*guide.html\?guide=.+/);
  });

  test('should scope the guide trend to a single target when task is supplied', async ({ page }) => {
    await page.goto('/guide.html?guide=content-vis&task=content-vis-task');
    await expect(page.locator('#guide-name-header')).toContainText('content-vis-task');
    await expect(page.locator('.timeline-point').first()).toBeVisible();

    // A target absent from the data charts nothing rather than falling back to combined totals.
    await page.goto('/guide.html?guide=content-vis&task=not-a-real-target');
    await expect(page.locator('#empty-state')).toBeVisible();
  });

  test('should block access to hidden files', async ({ page }) => {
    const response = await page.request.get('/.gitignore');
    expect(response.status()).toBe(403);
  });

  test('should block directory traversal attempts', async () => {
    // Try to access a file that is definitely outside the project root
    const res = await fetch(`http://localhost:11432/../../../../../../../../../../etc/passwd`);
    // Both 403, 404, and 400 (if it hits remote fallbacks) are acceptable as they block access to the host system
    expect([400, 403, 404]).toContain(res.status);
  });
});

const NIGHTLY_FIXTURE = {
  suites: /** @type {[string, string, string, number, number, number, number, number, number, number, number, number, number, number, number, number, number][]} */ ([
    ['antigravity_cli', 'gemini-3.8-flash', '2026-10-09T11:11:04.176Z', 952, 1062, 693, 1059, 96, 99, 76, 103, 487114, 915536, -47, 309324, 450451, -31],
    ['claude_code', 'claude-sonnet-5', '2026-10-09T11:21:00.000Z', 980, 1062, 710, 1062, 95, 99, 74, 103, 390000, 620000, -37, 280000, 400000, -30],
    ['codex_cli', 'gpt-6-astra', '2026-10-09T11:27:01.190Z', 940, 1062, 680, 1062, 92, 99, 72, 103, 410000, 650000, -37, 290000, 420000, -31],
  ]).map(([agent, model, timestamp, gPass, gTot, uPass, uTot, aGPass, aGTot, aUPass, aUTot, gMs, uMs, rtPct, gTok, uTok, tokPct]) => ({
    testId: `nightly-2026-10-09_07-00-02-${agent}`,
    timestamp,
    agent,
    serving: 'skills_cli',
    model,
    taskCount: 153,
    maxRuns: 1,
    guidedStats: { passed: gPass, total: gTot },
    unguidedStats: { passed: uPass, total: uTot },
    a11yStats: {
      guidedPassed: aGPass, guidedTotal: aGTot, guidedRate: Math.round((aGPass / aGTot) * 100),
      unguidedPassed: aUPass, unguidedTotal: aUTot, unguidedRate: Math.round((aUPass / aUTot) * 100),
      uplift: Math.round((aGPass / aGTot - aUPass / aUTot) * 100), guideCount: 49,
      bySubCategory: { focus_inert: { guidedPassed: 14, guidedTotal: 14, guidedRate: 100, unguidedPassed: 9, unguidedTotal: 15, unguidedRate: 60, uplift: 40 } }
    },
    efficiencyStats: {
      runtime: { guidedMedianMs: gMs, unguidedMedianMs: uMs, guidedMeanMs: gMs, unguidedMeanMs: uMs, medianDeltaPct: rtPct, fasterTaskPct: 58, fasterTasksCount: 89, pairedTaskCount: 153, guidedTimeouts: 0, unguidedTimeouts: 2 },
      tokens: { guidedUncachedMedian: gTok, unguidedUncachedMedian: uTok, uncachedMedianDeltaPct: tokPct, guidedTotalMedian: gTok, unguidedTotalMedian: uTok, guidedUncachedTotal: gTok * 100, unguidedUncachedTotal: uTok * 100, suiteUncachedDeltaPct: tokPct, guidedTotal: gTok * 120, unguidedTotal: uTok * 120, guidedCachedSharePct: 17, fewerUncachedTokensTaskPct: 61, fewerUncachedTasksCount: 94, pairedTaskCount: 153 }
    },
    guides: {
      'content-vis': { guidedPassed: 5, guidedTotal: 5, guidedRate: 100, unguidedPassed: 2, unguidedTotal: 5, unguidedRate: 40, uplift: 60, a11y: { guidedPassed: 2, guidedTotal: 2, guidedRate: 100, unguidedPassed: 1, unguidedTotal: 2, unguidedRate: 50, uplift: 50 } }
    }
  }))
};

test.describe('Hero, Spotlight, and Browse all runs', () => {
  test('renders empty hero state when no nightly suites exist and preserves heading hierarchy', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('#hero');
    await expect(hero).toHaveAttribute('aria-busy', 'false');
    await expect(hero.locator('#hero-takeaways .takeaway')).toHaveCount(2);
    await expect(hero.locator('.takeaway-figure').first()).toContainText('—');
    await expect(hero.locator('#hero-status')).toContainText(/no nightly evaluation runs/i);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.suite-table-row')).toHaveCount(1);
  });

  test('renders populated hero, agent table, sortable suites table, filter menu, and breakdowns drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/suites*', route => route.fulfill({ json: NIGHTLY_FIXTURE }));
    await page.goto('/');

    const hero = page.locator('#hero');
    await expect(hero).toHaveAttribute('aria-busy', 'false');
    await expect(hero.locator('#hero-heading')).toHaveText('Measurably better web code with Modern Web Guidance');
    await expect(hero.locator('.takeaway-primary[data-metric="overall"] .takeaway-label')).toContainText('across 153 tasks over 3 runs and 3 agents');
    await expect(hero.locator('.takeaway-primary[data-metric="overall"] .takeaway-figure')).toContainText('pp');
    await expect(hero.locator('.takeaway-secondary[data-metric="a11y"] .takeaway-figure')).toContainText('pp');
    await expect(hero.locator('#hero-eyebrow')).toContainText(/3 recent runs across 3 agent families/);

    // Keyboard-operable "How we measure" disclosure
    const details = page.locator('#hero-method');
    await details.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');

    // Per-agent table
    const agentRows = page.locator('#agent-table-body tr');
    await expect(agentRows).toHaveCount(3);
    await expect(agentRows.first().locator('td[data-label="Pass rate"]')).toHaveText(/\d+%\s*→\s*\d+%/);

    // Suites table & sorting
    const suiteRows = page.locator('.suite-table-row');
    await expect(suiteRows).toHaveCount(3);
    const barbellTooltip = page.locator('#barbell-tooltip');
    await suiteRows.first().locator('.uplift-cell').hover();
    await expect(barbellTooltip).toBeVisible();
    await expect(barbellTooltip).toContainText('Pass-rate lift');
    await expect(barbellTooltip).toContainText('checks)');
    await suiteRows.first().locator('.a11y-cell').hover();
    await expect(barbellTooltip).toBeVisible();
    await expect(barbellTooltip).toContainText('Accessibility lift');
    await page.keyboard.press('Escape');
    await expect(barbellTooltip).toBeHidden();
    const dateHeader = page.locator('.suites-table th:has(.sort-btn[data-sort="date"])');
    await expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    await page.locator('.sort-btn[data-sort="date"]').click();
    await expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');

    // Stateful Filter runs control
    const filterBtnText = page.locator('#filter-btn-text');
    await expect(filterBtnText).toHaveText('All selected (3)');
    await page.locator('#filter-btn').click();
    await page.locator('#deselect-all-btn').click();
    await expect(filterBtnText).toHaveText('None selected');
    await page.locator('#select-all-btn').click();
    await page.locator('#filter-btn').click();

    // Clicking the Accessibility hero link opens the Breakdowns drawer in Accessibility mode
    await page.locator('.takeaway[data-metric="a11y"] a[data-open-guides="a11y"]').click();
    await expect(page.locator('#breakdowns')).toHaveAttribute('open', '');
    await expect(page.locator('#insights-limit-input')).toHaveValue('5');
    await expect(page.locator('#insights-mode-a11y')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.insights-dimension-panel')).toBeVisible();
    await expect(page.locator('.insights-guide-drawer')).toBeVisible();

    // Hovering a Breakdowns barbell cell shows the explanatory barbell tooltip; Escape dismisses it
    const firstBarbellCell = page.locator('.insights-guide-drawer .insight-dumbbell-cell').first();
    await firstBarbellCell.hover();
    await expect(barbellTooltip).toBeVisible();
    await expect(barbellTooltip).toContainText('Vertical ticks mark the median');
    await page.keyboard.press('Escape');
    await expect(barbellTooltip).toBeHidden();

    // Breakdown panel Uplift sort & Expand controls
    const modelSortBtn = page.locator('.insights-uplift-sort-btn[data-panel-uplift-sort="model"]');
    await modelSortBtn.click();
    await expect(modelSortBtn).toHaveClass(/is-sorted/);
    const expandBtn = page.locator('.insights-expand-btn[data-expand-panel="model"]');
    await expandBtn.click();
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('renders A/B Task Spotlight, switches tasks/agents, and keeps mobile viewports overflow-free', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const spotlight = page.locator('#ab-spotlight');
    await expect(spotlight).toHaveAttribute('aria-busy', 'false');
    await expect(spotlight.locator('.ab-spotlight-sub')).not.toContainText('—');
    const taskPills = spotlight.locator('#ab-task-pills .ab-task-pill');
    await expect(taskPills).toHaveCount(6);
    await expect(spotlight.locator('#ab-score-guided .delta')).toContainText('+8 checks');

    // Grader assertions collapse to 3 visible rows by default and expand on toggle
    const checkRows = spotlight.locator('.ab-checks-table tbody tr');
    await expect(checkRows.nth(2)).toBeVisible();
    await expect(checkRows.nth(3)).toBeHidden();
    await spotlight.locator('#ab-checks-toggle').click();
    await expect(checkRows.nth(10)).toBeVisible();

    // Switch task and agent family
    await taskPills.nth(1).click();
    await expect(checkRows.nth(3)).toBeHidden();
    await spotlight.locator('#ab-score-guided .ab-score-a11y').click();
    await expect(spotlight.locator('tr[data-a11y="true"]')).toBeVisible();
    await spotlight.locator('#ab-agent-pills .ab-agent-pill').nth(1).click();
    await expect(spotlight.locator('#ab-score-guided .delta')).toContainText('+1 check');

    // Mobile viewport (390px) overflow check on landing and suite pages
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    await page.goto('/dashboard.html?testId=example-result');
    await expect(page.locator('#summary-side-panel .narrative-card')).toHaveCount(4);
    await page.locator('.task-accordion-header').first().click();
    await expect(page.locator('.truth-matrix').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('supports keyboard-triggered barbell tooltips, mobile tooltip bounds, mode switching, and combobox Enter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/suites*', route => route.fulfill({ json: NIGHTLY_FIXTURE }));
    await page.goto('/');

    // Keyboard focus on a suite uplift link shows #barbell-tooltip and wires aria-describedby
    const upliftLink = page.locator('.uplift-link').first();
    await expect(upliftLink).toBeVisible();
    await upliftLink.focus();
    const barbellTooltip = page.locator('#barbell-tooltip');
    await expect(barbellTooltip).toBeVisible();
    await expect(upliftLink).toHaveAttribute('aria-describedby', 'barbell-tooltip');
    await page.keyboard.press('Escape');
    await expect(barbellTooltip).toBeHidden();

    // Breakdowns: non-guide rows (e.g. By Accessibility Dimension) are keyboard-focusable for tooltips
    await page.locator('.takeaway[data-metric="a11y"] a[data-open-guides="a11y"]').click();
    const dimBarbell = page.locator('.insights-dimension-panel .insight-dumbbell-cell[tabindex="0"]').first();
    await dimBarbell.focus();
    await expect(barbellTooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(barbellTooltip).toBeHidden();

    // Mobile 390px: dumbbell tooltip stays inside viewport and clears on metric mode switch
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard.html?testId=example-result');
    const hitArea = page.locator('#dumbbell-chart rect[role="button"]').first();
    await expect(hitArea).toBeVisible();
    await hitArea.focus();
    const dumbbellTooltip = page.locator('#dumbbell-tooltip');
    await expect(dumbbellTooltip).toBeVisible();
    const tipBox = await dumbbellTooltip.boundingBox();
    expect(tipBox).not.toBeNull();
    if (tipBox) {
      expect(tipBox.x).toBeGreaterThanOrEqual(0);
      expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(390);
    }
    await page.locator('#dash-mode-a11y-btn').click();
    await expect(dumbbellTooltip).toBeHidden();
    await expect(page.locator('#dumbbell-chart')).toContainText('No accessibility checks recorded');

    // Guide combobox: ArrowDown -> Escape -> Enter submits typed text cleanly
    await page.unroute('**/api/suites*');
    await page.goto('/guide.html?guide=content-vis');
    await expect(page.locator('.timeline-point').first()).toBeVisible();
    const searchInput = page.locator('#guide-search');
    await searchInput.fill('preload-prerender');
    await expect(page.locator('#autocomplete-list')).toBeVisible();
    await searchInput.press('ArrowDown');
    await searchInput.press('Escape');
    await expect(page.locator('#autocomplete-list')).toBeHidden();
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/guide=preload-prerender/);
  });
});
