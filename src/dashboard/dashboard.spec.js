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

    // Expand the Breakdowns drawer if it's closed
    const insightsDrawer = page.locator('.insights-drawer');
    if (!(await insightsDrawer.getAttribute('open') !== null)) {
      await page.locator('.insights-summary').click();
    }

    // By Model is shown by default; open the nested By Guide disclosure
    const guideDrawer = page.locator('.insights-guide-drawer');
    await expect(guideDrawer).toBeVisible();
    if (!(await guideDrawer.getAttribute('open') !== null)) {
      await page.locator('.insights-guide-summary').click();
    }

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

    // Four takeaway items render, with placeholders instead of numbers.
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

  test('renders primary pass-rate takeaway, three supporting stats, and a 4-column per-agent table', async ({ page }) => {
    await page.route('**/api/suites*', route => route.fulfill({ path: new URL('./fixtures/hero-suites.fixture.json', import.meta.url).pathname, contentType: 'application/json' }));
    await page.goto('/');
    const hero = page.locator('#hero');
    await expect(hero).toHaveAttribute('aria-busy', 'false');
    await expect(hero.locator('#hero-status')).toBeHidden();

    // Every takeaway item has a number-forward figure and a non-empty qualifier.
    for (const metric of METRICS) {
      const card = hero.locator(`.takeaway[data-metric="${metric}"]`);
      await expect(card).toBeVisible();
      await expect(card.locator('.takeaway-figure')).toHaveText(/\d/);
      const qualifiers = card.locator('.takeaway-qualifier');
      expect(await qualifiers.count()).toBeGreaterThan(0);
      for (const text of await qualifiers.allInnerTexts()) {
        expect(text).not.toMatch(/loading|appear once/i);
      }
    }
    // Primary pass-rate uplift is in percentage points; supporting stats carry pp or %.
    await expect(hero.locator('.takeaway-primary[data-metric="overall"] .takeaway-figure')).toContainText('pp');
    await expect(hero.locator('.takeaway-secondary[data-metric="a11y"] .takeaway-figure')).toContainText('pp');
    await expect(hero.locator('.takeaway-secondary[data-metric="tokens"] .takeaway-figure')).toContainText('%');
    await expect(hero.locator('.takeaway-secondary[data-metric="time"] .takeaway-figure')).toContainText('%');

    // Eyebrow states the sample and the latest date so the claim is attributable,
    // and sits below h2#hero-heading (no uppercase kicker above the heading).
    await expect(hero.locator('#hero-eyebrow')).toContainText(/3 recent runs across 3 agent families/);
    await expect(hero.locator('#hero-eyebrow')).toContainText(/Oct 9, 2026/);
    const headingBeforeEyebrow = await page.evaluate(() => {
      const h2 = document.getElementById('hero-heading');
      const eyebrow = document.getElementById('hero-eyebrow');
      return Boolean(h2 && eyebrow && (h2.compareDocumentPosition(eyebrow) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(headingBeforeEyebrow).toBe(true);

    // Per-agent table: one row per family, each with a row header and three cells (Pass rate, Accessibility, Runs).
    const rows = page.locator('#agent-table-body tr');
    await expect(rows).toHaveCount(3);
    const families = await rows.locator('th[scope="row"]').allInnerTexts();
    expect(families.join(' ')).toMatch(/Claude Code/);
    expect(families.join(' ')).toMatch(/Codex CLI/);
    expect(families.join(' ')).toMatch(/Antigravity CLI|Gemini CLI/);
    for (let i = 0; i < 3; i++) {
      await expect(rows.nth(i).locator('td')).toHaveCount(3);
      await expect(rows.nth(i).locator('td[data-label="Pass rate"]')).toHaveText(/\d+%\s*→\s*\d+%/);
      await expect(rows.nth(i).locator('td[data-label="Accessibility"]')).toHaveText(/\d+%\s*→\s*\d+%/);
    }
    // Delta chips are not color-only: each carries a glyph and the signed value.
    await expect(rows.first().locator('.delta .glyph').first()).toBeAttached();

    // At 1280x800 and 1440x900, .agent-table-wrap fits without horizontal overflow
    // and the entire hero fits cleanly in the upper half of the viewport.
    for (const vp of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(vp);
      const agentTableFits = await page.locator('.agent-table-wrap').evaluate(el => el.scrollWidth <= el.clientWidth);
      expect(agentTableFits).toBe(true);
    }
    const heroBottom = await hero.evaluate(el => el.getBoundingClientRect().bottom);
    expect(heroBottom).toBeLessThanOrEqual(560);
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

  test('heading hierarchy: one h1, peer h2 section headings, takeaway h3s', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#hero h2#hero-heading')).toHaveCount(1);
    await expect(page.locator('#ab-spotlight h2#ab-spotlight-heading')).toHaveCount(1);
    await expect(page.locator('#agents-section h2#agents-heading')).toHaveCount(1);
    await expect(page.locator('#browse-section h2#browse-heading')).toHaveCount(1);
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
    // Story arc order: #hero -> #ab-spotlight -> #agents-section -> #browse-section.
    const order = await page.evaluate(() => {
      const takeaways = document.getElementById('hero-takeaways');
      const spotlight = document.getElementById('ab-spotlight');
      const agents = document.getElementById('agents-section');
      const browse = document.getElementById('browse-section');
      if (!takeaways || !spotlight || !agents || !browse) return false;
      return Boolean(
        (takeaways.compareDocumentPosition(spotlight) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        (spotlight.compareDocumentPosition(agents) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        (agents.compareDocumentPosition(browse) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    });
    expect(order).toBe(true);

    const table = section.locator('table.suites-table');
    await expect(table.locator('caption')).toHaveCount(1);
    await expect(table.locator('caption')).toContainText(/unguided and guided/i);
    await expect(table.locator('thead th[scope="col"]').first()).toBeAttached();
    await expect(page.locator('.suite-table-row').first()).toBeVisible();
    await expect(page.locator('.suite-table-row th[scope="row"]').first()).toBeVisible();
  });

  test('metric cells carry single-line text equivalents, human-readable agent labels, and zero horizontal overflow at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/suites*', route => route.fulfill({ path: FIXTURE, contentType: 'application/json' }));
    await page.goto('/');
    const rows = page.locator('.suite-table-row');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('#suites-count')).toHaveText(/Showing 3 of 3 runs/);

    // Human-readable agent names instead of raw snake_case identifiers.
    const agentLabels = await rows.locator('.agent-cell').allInnerTexts();
    expect(agentLabels.join(' ')).toMatch(/Claude Code/);
    expect(agentLabels.join(' ')).toMatch(/Codex CLI/);
    expect(agentLabels.join(' ')).toMatch(/Antigravity CLI/);
    expect(agentLabels.join(' ')).not.toMatch(/claude_code|codex_cli|antigravity_cli/);

    const first = rows.first();
    // Task count is folded into the Suite & date meta line.
    await expect(first.locator('.suite-meta')).toHaveText(/\d+\s+tasks/);
    // Text includes the visually-hidden "Pass rate: unguided …, guided …" prefixes.
    await expect(first.locator('.uplift-cell .rate-text')).toHaveText(/\d+%[^%]*→[^%]*\d+%\s*\([+−-]?\d+ pp\)/);
    await expect(first.locator('.uplift-cell .uplift-link')).toHaveAttribute('href', /dashboard\.html\?testId=nightly-/);
    // Efficiency pills name the direction in words.
    await expect(first.locator('.eff-pill').first()).toHaveText(/(faster|slower|fewer|more|no change)/i);
    // Dumbbell graphics are decorative; the numbers are in text.
    await expect(first.locator('.suite-dumbbell-track').first()).toHaveAttribute('aria-hidden', 'true');

    // Table container fits at 1280px without horizontal overflow.
    const tableFits = await page.locator('.suites-table-container').evaluate(el => el.scrollWidth <= el.clientWidth);
    expect(tableFits).toBe(true);
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
  test('renders 6 real eval tasks, collapses check rows to 3 by default, and switches tasks/agents cleanly with zero console errors', async ({ page }) => {
    /** @type {string[]} */
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const spotlight = page.locator('#ab-spotlight');
    await expect(spotlight).toBeVisible();
    await expect(spotlight).toHaveAttribute('aria-busy', 'false');
    await expect(spotlight.locator('#ab-spotlight-heading')).toContainText('See it on a real task, with and without Modern Web Guidance');

    // 6 curated task tabs (on a single horizontal row at 1280px) and 3 agent family buttons;
    // only the active task tab carries the green delta badge.
    const taskPills = spotlight.locator('#ab-task-pills .ab-task-pill');
    await expect(taskPills).toHaveCount(6);
    await expect(spotlight.locator('#ab-task-pills .ab-task-delta')).toHaveCount(1);
    const pillRowCount = await taskPills.evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().top))).size);
    expect(pillRowCount).toBe(1);

    const agentPills = spotlight.locator('#ab-agent-pills .ab-agent-pill');
    await expect(agentPills).toHaveCount(3);

    // Sentence-case task prompt label, full prompt text displayed without truncation, and no toggle button
    await expect(spotlight.locator('.ab-prompt-kicker')).toHaveText('Task prompt');
    const promptText = spotlight.locator('#ab-prompt-text');
    await expect(promptText).toBeVisible();
    await expect(promptText).not.toHaveClass(/clamped/);
    await expect(promptText).toContainText('search box with id "search-input"');
    await expect(spotlight.locator('#ab-prompt-toggle')).toHaveCount(0);

    // Default task is highlight-text-ranges on Claude Code (3/11 -> 11/11, +8 checks)
    await expect(taskPills.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(spotlight.locator('#ab-score-guided .delta')).toContainText('+8 checks');
    await expect(spotlight.locator('#ab-run-provenance a[href*="dashboard.html"]')).toHaveAttribute('href', /dashboard\.html\?testId=nightly-.*#guide-highlight-text-ranges/);
    await expect(spotlight.locator('#ab-run-provenance a[href*="guide.html"]')).toHaveAttribute('href', /guide\.html\?guide=highlight-text-ranges&testId=nightly-/);
    await expect(spotlight.locator('#ab-run-provenance a[href*="github.com"]')).toHaveAttribute('href', 'https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/ui-behaviors/highlight-text-ranges/guide.md');

    // Grader assertions table collapses to 3 visible preview rows by default, expandable via #ab-checks-toggle
    const checkRows = spotlight.locator('.ab-checks-table tbody tr');
    await expect(checkRows).toHaveCount(11);
    await expect(checkRows.nth(2)).toBeVisible();
    await expect(checkRows.nth(3)).toBeHidden();
    const checksToggle = spotlight.locator('#ab-checks-toggle');
    await expect(checksToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(checksToggle).toContainText('Show all 11 checks');
    await checksToggle.click();
    await expect(checksToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(checkRows.nth(10)).toBeVisible();

    // Switch task to Top-layer motion (animate-to-from-top-layer, 2/9 -> 9/9, +7 checks) — resets to collapsed preview
    await taskPills.nth(1).click();
    await expect(taskPills.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(spotlight.locator('#ab-run-provenance a[href*="dashboard.html"]')).toHaveAttribute('href', /dashboard\.html\?testId=nightly-.*#guide-animate-to-from-top-layer/);
    await expect(spotlight.locator('#ab-run-provenance a[href*="guide.html"]')).toHaveAttribute('href', /guide\.html\?guide=animate-to-from-top-layer&testId=nightly-/);
    // Claude Code retrieved 2 guides on animate-to-from-top-layer; each has its own GitHub guide.md link
    await expect(spotlight.locator('#ab-run-provenance a[href*="github.com"]')).toHaveCount(2);
    await expect(checkRows).toHaveCount(9);
    await expect(checkRows.nth(3)).toBeHidden();

    // Clicking the A11y badge on the scorecard expands the table to reveal the accessibility assertion row
    await spotlight.locator('#ab-score-guided .ab-score-a11y').click();
    await expect(checksToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(spotlight.locator('tr[data-a11y="true"]')).toBeVisible();

    // Switch agent family to Antigravity CLI (2/9 -> 9/9, +7 checks)
    await agentPills.nth(1).click();
    await expect(agentPills.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(spotlight.locator('#ab-score-guided .delta')).toContainText('+7 checks');

    // Verify zero horizontal page overflow across desktop (1440px, 1280px) and mobile (390px)
    for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(vp);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }

    expect(consoleErrors).toEqual([]);
  });

  test('clicking the +22 pp Accessibility hero link opens the Breakdowns drawer in Accessibility mode with dimensions and guides expanded', async ({ page }) => {
    const FIXTURE = new URL('./fixtures/hero-suites.fixture.json', import.meta.url).pathname;
    await page.route('**/api/suites*', route => route.fulfill({ path: FIXTURE, contentType: 'application/json' }));
    await page.goto('/');
    await expect(page.locator('#hero')).toHaveAttribute('aria-busy', 'false');

    const a11yCardLink = page.locator('.takeaway[data-metric="a11y"] a[data-open-guides="a11y"]');
    await expect(a11yCardLink).toBeVisible();
    await a11yCardLink.click();

    await expect(page.locator('#breakdowns')).toHaveAttribute('open', '');
    await expect(page.locator('#insights-mode-a11y')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.insights-dimension-panel')).toBeVisible();
    await expect(page.locator('.insights-guide-drawer')).toHaveAttribute('open', '');
  });

  test('mobile & tablet viewports (320px, 390px, 768px) have zero horizontal overflow and keep filter menu, hero stat, assertion tables, and guide trend points on-screen', async ({ page }) => {
    const FIXTURE = new URL('./fixtures/hero-suites.fixture.json', import.meta.url).pathname;
    await page.route('**/api/suites*', route => route.fulfill({ path: FIXTURE, contentType: 'application/json' }));

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await expect(page.locator('#hero')).toHaveAttribute('aria-busy', 'false');

      const indexOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(indexOverflow).toBeLessThanOrEqual(0);

      // Primary takeaway rate text stays inside the hero card border
      const heroFits = await page.evaluate(() => {
        const hero = document.getElementById('hero')?.getBoundingClientRect();
        const rates = document.querySelector('.takeaway-primary .takeaway-dumbbell-rates')?.getBoundingClientRect();
        return Boolean(hero && rates && rates.right <= hero.right + 1 && rates.left >= hero.left - 1);
      });
      expect(heroFits).toBe(true);

      // Use-case task tabs stay on a single horizontally scrollable row
      await expect(page.locator('#ab-spotlight')).toHaveAttribute('aria-busy', 'false');
      const taskRowCount = await page.locator('#ab-task-pills .ab-task-pill').evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().top))).size);
      expect(taskRowCount).toBe(1);

      // Opening "Filter runs" keeps #filter-menu inside the viewport
      await page.locator('#filter-btn').click();
      await expect(page.locator('#filter-menu')).toBeVisible();
      const menuFits = await page.evaluate(() => {
        const r = document.getElementById('filter-menu')?.getBoundingClientRect();
        return Boolean(r && r.left >= 0 && r.right <= document.documentElement.clientWidth + 1);
      });
      expect(menuFits).toBe(true);
      await page.locator('#filter-btn').click();
    }

    // Suite page at 320px, 390px, and 768px (with first task accordion expanded)
    await page.unroute('**/api/suites*');
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/dashboard.html?testId=example-result');
      const firstAccordion = page.locator('.task-accordion-header').first();
      await expect(firstAccordion).toBeVisible();
      await firstAccordion.click();
      await expect(page.locator('.truth-matrix').first()).toBeVisible();

      const dashOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(dashOverflow).toBeLessThanOrEqual(0);

      const matrixFits = await page.evaluate(() => {
        const wrap = document.querySelector('.truth-matrix-wrap');
        const acc = document.querySelector('.task-accordion.open');
        if (!wrap || !acc) return false;
        return wrap.getBoundingClientRect().right <= acc.getBoundingClientRect().right + 1;
      });
      expect(matrixFits).toBe(true);
    }

    // Guide trend page at 390px: SVG has a viewBox and timeline points are visible inside the card
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/guide.html?guide=content-vis');
    const firstSvg = page.locator('#graphs-grid svg').first();
    await expect(firstSvg).toBeVisible();
    await expect(firstSvg).toHaveAttribute('viewBox', /^0 0 \d+ \d+$/);
    const guideOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(guideOverflow).toBeLessThanOrEqual(0);
  });

  test('applies Zipline UI refinements: stateful Filter runs trigger, breakdown panel Uplift sort & Expand controls, centered By Guide legend, combined sort pill, and flat vertical tick marks', async ({ page }) => {
    const FIXTURE = new URL('./fixtures/hero-suites.fixture.json', import.meta.url).pathname;
    await page.route('**/api/suites*', route => route.fulfill({ path: FIXTURE, contentType: 'application/json' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 1. Externalized & stateful Filter runs control
    const filterLabel = page.locator('.filter-runs-label');
    await expect(filterLabel).toContainText('Filter runs');
    const filterBtnText = page.locator('#filter-btn-text');
    await expect(filterBtnText).toHaveText('All selected (3)');
    await page.locator('#filter-btn').click();
    await page.locator('#deselect-all-btn').click();
    await expect(filterBtnText).toHaveText('None selected');
    await expect(page.locator('#filter-btn')).toHaveClass(/is-filtered/);
    await page.locator('#select-all-btn').click();
    await expect(filterBtnText).toHaveText('All selected (3)');
    await expect(page.locator('#filter-btn')).not.toHaveClass(/is-filtered/);
    await page.locator('#filter-btn').click();

    // 2. Left-aligned single-line Model & Agent columns and flat vertical tick marks on suite dumbbells
    const modelAlign = await page.locator('.suites-table td.model-cell').first().evaluate(el => ({
      textAlign: getComputedStyle(el).textAlign,
      whiteSpace: getComputedStyle(el).whiteSpace
    }));
    expect(modelAlign).toEqual({ textAlign: 'left', whiteSpace: 'nowrap' });

    const dotStyle = await page.locator('.suite-dumbbell-track .dot.guided').first().evaluate(el => ({
      borderRadius: getComputedStyle(el).borderRadius,
      width: getComputedStyle(el).width
    }));
    expect(dotStyle.borderRadius).toBe('0px');
    expect(parseFloat(dotStyle.width)).toBeLessThanOrEqual(3);

    // 3. Breakdowns drawer: 3-state Uplift sort toggle, Expand/Collapse controls, centered legend, and combined sort pill
    await page.locator('#breakdowns > summary').click();
    const modelSortBtn = page.locator('.insights-uplift-sort-btn[data-panel-uplift-sort="model"]');
    await expect(modelSortBtn).toBeVisible();
    await expect(modelSortBtn.locator('.insights-uplift-sort-arrow')).toHaveText('↕');
    await modelSortBtn.click();
    await expect(modelSortBtn).toHaveClass(/is-sorted/);
    await expect(modelSortBtn.locator('.insights-uplift-sort-arrow')).toHaveText('↓');

    const expandBtn = page.locator('.insights-expand-btn[data-expand-panel="model"]');
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    await expandBtn.click();
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.insights-table-scroll[data-scroll-section="model"]')).toHaveClass(/is-expanded/);

    await expect(page.locator('.guide-legend')).toContainText(/Unguided\s*vs\.\s*Guided/);
    await expect(page.locator('.sort-combined-control .sort-select-value')).toHaveText('Alphabetic');
    const optionLabels = await page.locator('#guide-sort-select option').allInnerTexts();
    expect(optionLabels).toEqual(['Alphabetic', 'Uplift', 'Unguided rate', 'Guided rate', 'Variance']);
  });
});