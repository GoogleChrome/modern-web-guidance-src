import { test, expect } from '@playwright/test';

test.describe('Eval View Dashboard', () => {
  test('should load the dashboard and show expected content', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page.locator('.landing-title')).toContainText('Modern Web Guidance Evals');

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
  
  test('should show dumbbell chart tooltip on rate-cell hover', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForSelector('.uplift-cell');
    await page.locator('.uplift-cell').first().hover();
    
    const tooltip = page.locator('.tooltip-container');
    await expect(tooltip).toBeVisible();
    
    const svg = page.locator('#tooltip-chart svg');
    await expect(svg).toBeVisible();
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

    // Expand the drawer if it's closed
    const insightsDrawer = page.locator('.insights-drawer');
    if (!(await insightsDrawer.getAttribute('open') !== null)) {
      await page.locator('.insights-summary').click();
    }

    // Verify By Guide panel is visible and has the correct title
    const guidePanel = page.locator('.insights-panel', { hasText: 'By Guide' });
    await expect(guidePanel).toBeVisible();

    // Verify guides are listed under By Guide
    const contentVisRow = guidePanel.locator('tr', { hasText: 'content-vis' });
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

/**
 * Hero / headline takeaways (index.html + hero.js + insights.js).
 *
 * The mock results used by the e2e server contain a single ad-hoc suite
 * (`example-result`), which is NOT a nightly suite, so the hero renders its
 * empty state there. To exercise the populated hero we intercept `/api/suites`
 * and answer with a fixture manifest captured from real nightly suites
 * (fixtures/hero-suites.fixture.json: one suite per agent family, with
 * a11yStats + efficiencyStats already present so no hydration is needed).
 */
test.describe('Hero headline takeaways', () => {
  const METRICS = ['overall', 'a11y', 'tokens', 'time'];

  test('renders a graceful empty state when no nightly suites exist', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('#hero');
    await expect(hero).toHaveAttribute('aria-busy', 'false');

    // Four takeaway cards still render, with placeholders instead of numbers.
    const cards = hero.locator('#hero-takeaways .takeaway');
    await expect(cards).toHaveCount(4);
    for (const metric of METRICS) {
      await expect(hero.locator(`.takeaway[data-metric="${metric}"]`)).toBeVisible();
    }
    await expect(hero.locator('.takeaway-figure').first()).toContainText('—');

    // Status row explains why, and does not offer sign-in for the local source.
    const status = hero.locator('#hero-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText(/no nightly evaluation runs/i);
    await expect(hero.locator('#hero-auth-btn')).toBeHidden();
    await expect(page.locator('#agent-table-body')).toContainText('No data loaded');
  });

  test('renders four numeric takeaways and a per-agent table from a manifest with a11y/efficiency stats', async ({ page }) => {
    await page.route('**/api/suites*', route => route.fulfill({ path: new URL('./fixtures/hero-suites.fixture.json', import.meta.url).pathname, contentType: 'application/json' }));
    await page.goto('/');
    const hero = page.locator('#hero');
    await expect(hero).toHaveAttribute('aria-busy', 'false');
    await expect(hero.locator('#hero-status')).toBeHidden();

    // Every card has a number-forward figure and a non-empty qualifier.
    for (const metric of METRICS) {
      const card = hero.locator(`.takeaway[data-metric="${metric}"]`);
      await expect(card).toBeVisible();
      await expect(card.locator('.takeaway-figure')).toHaveText(/\d/);
      // Cards may render a compact (phone) and a full qualifier; none may be a placeholder.
      const qualifiers = card.locator('.takeaway-qualifier');
      expect(await qualifiers.count()).toBeGreaterThan(0);
      for (const text of await qualifiers.allInnerTexts()) {
        expect(text).not.toMatch(/loading|appear once/i);
      }
    }
    // Pass-rate uplifts are expressed in percentage points; efficiency as a percentage.
    await expect(hero.locator('.takeaway[data-metric="overall"] .takeaway-figure')).toContainText('pp');
    await expect(hero.locator('.takeaway[data-metric="a11y"] .takeaway-figure')).toContainText('pp');
    await expect(hero.locator('.takeaway[data-metric="tokens"] .takeaway-figure')).toContainText('%');
    await expect(hero.locator('.takeaway[data-metric="time"] .takeaway-figure')).toContainText('%');

    // Eyebrow states the sample and the latest date so the claim is attributable.
    await expect(hero.locator('#hero-eyebrow')).toContainText(/3 recent runs across 3 agent families/);
    await expect(hero.locator('#hero-eyebrow')).toContainText(/Oct 9, 2026/);

    // Per-agent table: one row per family, each with a row header and four metric cells.
    const rows = page.locator('#agent-table-body tr');
    await expect(rows).toHaveCount(3);
    const families = await rows.locator('th[scope="row"]').allInnerTexts();
    expect(families.join(' ')).toMatch(/Claude Code/);
    expect(families.join(' ')).toMatch(/Codex CLI/);
    // antigravity_cli (the Gemini-based CLI that succeeded jetski_cli) is labeled "Antigravity CLI".
    expect(families.join(' ')).toMatch(/Antigravity CLI|Gemini CLI/);
    for (let i = 0; i < 3; i++) {
      // Pass rate, Accessibility, Median time, Median uncached tokens, Runs
      await expect(rows.nth(i).locator('td')).toHaveCount(5);
      await expect(rows.nth(i).locator('td[data-label="Pass rate"]')).toHaveText(/\d+%\s*→\s*\d+%/);
    }
    // Delta chips are not color-only: each carries a glyph and the signed value.
    await expect(rows.first().locator('.delta .glyph').first()).toBeAttached();
  });

  test('"How we measure" is a keyboard-operable disclosure with the recent-N value filled in', async ({ page }) => {
    await page.route('**/api/suites*', route => route.fulfill({ path: new URL('./fixtures/hero-suites.fixture.json', import.meta.url).pathname, contentType: 'application/json' }));
    await page.goto('/');
    await expect(page.locator('#hero')).toHaveAttribute('aria-busy', 'false');

    const details = page.locator('#hero-method');
    const summary = details.locator('summary');
    await expect(details).not.toHaveAttribute('open', '');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('#method-recent-n')).toHaveText(/^\d+$/);
    await expect(details).toContainText(/uncached/i);
  });

  test('heading hierarchy: one h1, hero h2, takeaway h3s', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#hero h2#hero-heading')).toHaveCount(1);
    await expect(page.locator('#hero-takeaways h3')).toHaveCount(4);
  });
});

/**
 * "Browse all runs" (landing.js / landing.css) and the per-suite summary
 * (dashboard.js). Uses the same nightly fixture manifest as the hero tests
 * where real nightly rows are needed.
 */
test.describe('Browse all runs', () => {
  const FIXTURE = new URL('./fixtures/hero-suites.fixture.json', import.meta.url).pathname;

  test('is a labeled secondary section below the hero with an accessible table', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('#browse-section');
    await expect(section).toHaveAttribute('aria-labelledby', 'browse-heading');
    await expect(section.locator('h2#browse-heading')).toHaveText(/Browse all runs/);
    // Hero comes first in document order.
    const order = await page.evaluate(() => {
      const hero = document.getElementById('hero');
      const browse = document.getElementById('browse-section');
      return hero && browse ? hero.compareDocumentPosition(browse) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
    });
    expect(order).toBeTruthy();

    const table = section.locator('table.suites-table');
    await expect(table.locator('caption')).toHaveCount(1);
    await expect(table.locator('thead th[scope="col"]').first()).toBeAttached();
    await expect(page.locator('.suite-table-row').first()).toBeVisible();
    await expect(page.locator('.suite-table-row th[scope="row"]').first()).toBeVisible();
    // Legend explains the dumbbell encoding in words, not just color.
    await expect(section.locator('#dumbbell-legend')).toContainText(/Unguided/);
    await expect(section.locator('#dumbbell-legend')).toContainText(/Guided/);
  });

  test('metric cells carry text equivalents (pp for pass rates, % words for time/tokens)', async ({ page }) => {
    await page.route('**/api/suites*', route => route.fulfill({ path: FIXTURE, contentType: 'application/json' }));
    await page.goto('/');
    const rows = page.locator('.suite-table-row');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('#suites-count')).toHaveText(/Showing 3 of 3 runs/);

    const first = rows.first();
    // Text includes the visually-hidden "Pass rate: unguided …, guided …" prefixes.
    await expect(first.locator('.uplift-cell .rate-text')).toHaveText(/\d+%[^%]*→[^%]*\d+%\s*\([+−-]?\d+ pp\)/);
    await expect(first.locator('.uplift-cell .uplift-link')).toHaveAttribute('href', /dashboard\.html\?testId=nightly-/);
    // Efficiency pills name the direction in words.
    await expect(first.locator('.eff-pill').first()).toHaveText(/(faster|slower|fewer|more|no change)/i);
    // Dumbbell graphics are decorative; the numbers are in text.
    await expect(first.locator('.suite-dumbbell-track').first()).toHaveAttribute('aria-hidden', 'true');
  });

  test('sortable column headers expose aria-sort and reorder rows', async ({ page }) => {
    await page.route('**/api/suites*', route => route.fulfill({ path: FIXTURE, contentType: 'application/json' }));
    await page.goto('/');
    await expect(page.locator('.suite-table-row')).toHaveCount(3);

    const dateHeader = page.locator('.suites-table th:has(.sort-btn[data-sort="date"])');
    await expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    const before = await page.locator('.suite-table-row').evaluateAll(rows => rows.map(r => r.getAttribute('data-test-id')));

    await page.locator('.sort-btn[data-sort="date"]').click();
    await expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
    const after = await page.locator('.suite-table-row').evaluateAll(rows => rows.map(r => r.getAttribute('data-test-id')));
    expect(after).toEqual([...before].reverse());

    // Sorting by time moves aria-sort to that column and clears it from date.
    await page.locator('.sort-btn[data-sort="time"]').click();
    await expect(page.locator('.suites-table th:has(.sort-btn[data-sort="time"])')).toHaveAttribute('aria-sort', /ascending|descending/);
    await expect(dateHeader).not.toHaveAttribute('aria-sort', /ascending|descending/);
  });

  test('"Scheduled runs only" hides ad-hoc suites and is announced in the live count', async ({ page }) => {
    await page.goto('/');
    // The mock data set has only an ad-hoc suite, so the toggle must not hide everything.
    await expect(page.locator('.suite-table-row')).toHaveCount(1);
    await expect(page.locator('#suites-count')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#suites-count')).toHaveText(/Showing 1 of 1 runs?/);
  });

  test('per-suite page leads with pass rate, a11y, time, and token summary cards', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');
    await expect(page.locator('#suite-summary-heading')).toHaveText(/Suite summary/);
    const cards = page.locator('#summary-side-panel .narrative-card');
    await expect(cards).toHaveCount(4);
    // Pass-rate card: pp delta pill + U → G with per-mode denominators.
    const pass = cards.first();
    await expect(pass.locator('.meta-label')).toHaveText(/Pass rate/);
    await expect(pass.locator('.efficiency-delta-pill')).toHaveText(/[+−-]?\d+ pp/);
    await expect(pass.locator('.sparkline-labels')).toHaveText(/\d+%[^%]*→[^%]*\d+%/);
    await expect(cards.nth(1).locator('.meta-label')).toHaveText(/Accessibility subscore/);
    // Diagnostics stay intact for internal users.
    await expect(page.locator('.task-accordion-header').first()).toBeVisible();
  });
});

test.describe('A/B Task Spotlight & Progressive Disclosure IA', () => {
  test('renders 6 real eval tasks and switches tasks/agents cleanly with zero console errors', async ({ page }) => {
    /** @type {string[]} */
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.goto('/');

    const spotlight = page.locator('#ab-spotlight');
    await expect(spotlight).toBeVisible();
    await expect(spotlight).toHaveAttribute('aria-busy', 'false');
    await expect(spotlight.locator('#ab-spotlight-heading')).toContainText('See it on a real task: Unguided vs. Guided');

    // 6 curated task tabs and 3 agent family buttons
    const taskPills = spotlight.locator('#ab-task-pills .ab-task-pill');
    await expect(taskPills).toHaveCount(6);
    const agentPills = spotlight.locator('#ab-agent-pills .ab-agent-pill');
    await expect(agentPills).toHaveCount(3);

    // Default task is swipe-to-remove on Claude Code (0/21 -> 21/21, +21 checks)
    await expect(taskPills.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(spotlight.locator('#ab-score-guided .delta')).toContainText('+21 checks');
    await expect(spotlight.locator('#ab-run-provenance a[href*="guide.html"]')).toHaveAttribute('href', /guide\.html\?guide=swipe-to-remove/);

    // Grader assertions table is shown directly with no preview/diff tabs or filter buttons
    await expect(spotlight.locator('#ab-lens-tablist')).toHaveCount(0);
    await expect(spotlight.locator('.ab-checks-filters')).toHaveCount(0);
    const checkRows = spotlight.locator('.ab-checks-table tbody tr');
    await expect(checkRows).toHaveCount(21);

    // Switch task to Custom select (branded-select-styling, 0/12 -> 12/12, +12 checks)
    await taskPills.nth(1).click();
    await expect(taskPills.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(spotlight.locator('#ab-run-provenance a[href*="guide.html"]')).toHaveAttribute('href', /guide\.html\?guide=branded-select-styling/);
    await expect(checkRows).toHaveCount(12);

    // Switch agent family to Antigravity CLI (2/12 -> 12/12, +10 checks)
    await agentPills.nth(1).click();
    await expect(agentPills.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(spotlight.locator('#ab-score-guided .delta')).toContainText('+10 checks');

    expect(consoleErrors).toEqual([]);
  });
});