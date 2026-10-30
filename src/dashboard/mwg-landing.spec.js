import { test, expect } from '@playwright/test';
/** @param {import('@playwright/test').Page} page */
function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const A11Y_SUITES_FIXTURE = {
  suites: ['antigravity_cli', 'claude_code'].map((agent, i) => ({
    testId: `nightly-2026-10-09_07-00-0${i}-${agent}`,
    timestamp: `2026-10-09T11:1${i}:00.000Z`,
    agent,
    serving: 'skills_cli',
    model: `model-${i}`,
    taskCount: 10,
    maxRuns: 1,
    guidedStats: { passed: 9, total: 10 },
    unguidedStats: { passed: 6, total: 10 },
    a11yStats: {
      guidedPassed: 9, guidedTotal: 10, guidedRate: 90, unguidedPassed: 5, unguidedTotal: 10, unguidedRate: 50, uplift: 40, guideCount: 2,
      bySubCategory: { focus_inert: { guidedPassed: 4, guidedTotal: 4, guidedRate: 100, unguidedPassed: 2, unguidedTotal: 4, unguidedRate: 50, uplift: 50 } }
    },
    guides: {
      'content-vis': { guidedPassed: 5, guidedTotal: 5, guidedRate: 100, unguidedPassed: 2, unguidedTotal: 5, unguidedRate: 40, uplift: 60, a11y: { guidedPassed: 2, guidedTotal: 2, guidedRate: 100, unguidedPassed: 1, unguidedTotal: 2, unguidedRate: 50, uplift: 50 } }
    }
  }))
};
test.describe('Landing page MWG compliance', () => {
  test('loads only vendored polyfills and sets the referrer, text-scale, and preconnect hints', async ({ page, request }) => {
    const errors = collectErrors(page);
    /** @type {string[]} */
    const thirdParty = [];
    page.on('request', r => { if (/unpkg\.com|jsdelivr|cdn\./.test(r.url())) thirdParty.push(r.url()); });
    await page.goto('/');
    await expect(page.locator('.suite-table-row').first()).toBeVisible();
    const html = await (await request.get('/')).text();
    expect(html).not.toContain('unpkg.com');
    for (const file of ['popover-polyfill.js', 'css-anchor-positioning.js', 'interestfor.js']) {
      expect(html).toContain(`./vendor/${file}`);
      const res = await request.get(`/vendor/${file}`);
      expect(res.ok()).toBe(true);
      expect(res.headers()['content-type']).toContain('javascript');
      expect(await res.text()).not.toMatch(/import\s*\(?\s*["']https?:/);
    }
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin-when-cross-origin');
    await expect(page.locator('meta[name="text-scale"]')).toHaveAttribute('content', 'scale');
    await expect(page.locator('link[rel="preconnect"][href="https://storage.googleapis.com"]')).toHaveAttribute('crossorigin', '');
    expect(thirdParty).toEqual([]);
    expect(errors).toEqual([]);
  });
/** @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} track */
async function expectNextToBarbell(page, track) {
  await expect(track).toHaveCSS('anchor-name', '--barbell-anchor');
  expect(await page.locator('[style*="anchor-name"]').count()).toBe(1);
  const t = await track.boundingBox();
  const b = await page.locator('#barbell-tooltip').boundingBox();
  expect(t && b).toBeTruthy();
  if (!t || !b) return;
  const below = b.y - (t.y + t.height);
  const above = t.y - (b.y + b.height);
  expect((below >= 0 && below <= 10) || (above >= 0 && above <= 10), `gap below ${below}, above ${above}`).toBe(true);
  const cx = t.x + t.width / 2;
  expect(b.x <= cx && b.x + b.width >= cx, `track center ${cx} outside tooltip ${b.x}..${b.x + b.width}`).toBe(true);
}
  test('barbell tooltip is a popover="hint" opened by interestfor triggers and anchored to their barbell', async ({ page }) => {
    await page.goto('/');
    const tooltip = page.locator('#barbell-tooltip');
    await expect(tooltip).toHaveAttribute('popover', 'hint');
    await expect(tooltip).toBeHidden();
    const link = page.locator('.uplift-link').first();
    await expect(link).toHaveAttribute('interestfor', 'barbell-tooltip');
    await link.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Pass-rate lift');
    expect(await tooltip.evaluate(el => el.matches(':popover-open'))).toBe(true);
    expect(await tooltip.evaluate(el => getComputedStyle(el).zIndex)).toBe('auto');
    const track = link.locator('.suite-dumbbell-track');
    await expectNextToBarbell(page, track);
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await link.focus();
    await expect(tooltip).toBeVisible();
    const box = await tooltip.boundingBox();
    const vp = page.viewportSize();
    expect(box && vp && box.x >= 0 && box.x + box.width <= vp.width && box.y >= 0 && box.y + box.height <= vp.height).toBe(true);
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await expect(track).not.toHaveCSS('anchor-name', '--barbell-anchor');
    await page.route('**/api/suites*', route => route.fulfill({ json: A11Y_SUITES_FIXTURE }));
    await page.reload();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const a11yLink = page.locator('.a11y-link').first();
      await a11yLink.focus();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText('Accessibility lift');
      await expectNextToBarbell(page, a11yLink.locator('.suite-dumbbell-track'));
      await page.keyboard.press('Escape');
      await expect(tooltip).toBeHidden();
    }
  });
  test('breakdown barbells: dimension cells are named buttons; guide/model rows keep rates in the accessibility tree and preview via the row-header trigger', async ({ page }) => {
    await page.route('**/api/suites*', route => route.fulfill({ json: A11Y_SUITES_FIXTURE }));
    await page.goto('/');
    await page.locator('#breakdowns > summary').click();
    const tooltip = page.locator('#barbell-tooltip');
    await expect(page.locator('.insights-table [aria-hidden="true"]:is(button, a, [tabindex])')).toHaveCount(0);
    await expect(page.locator('.insights-table button[tabindex="-1"]')).toHaveCount(0);
    const guideRow = page.locator('.insights-guide-drawer .pivot-row').first();
    const guideLink = guideRow.locator('.pivot-link');
    await expect(guideLink).toHaveAttribute('interestfor', 'barbell-tooltip');
    await expect(guideRow.locator('.pivot-barbell-btn')).toHaveCount(0);
    const snapshot = await guideRow.ariaSnapshot();
    expect(snapshot).toMatch(/cell "?Median unguided \d+% , guided \d+% \([+-]?\d+ pp\)|cell[^\n]*Median unguided \d+%/);
    await guideLink.focus();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Vertical ticks mark the median');
    await expectNextToBarbell(page, guideRow.locator('.insight-dumbbell-track'));
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await page.evaluate(() => /** @type {HTMLElement | null} */ (document.activeElement)?.blur());
    await page.mouse.move(2, 2);
    const track = guideRow.locator('.insight-dumbbell-track');
    await track.scrollIntoViewIfNeeded();
    const trackBox = await track.boundingBox();
    expect(trackBox).not.toBeNull();
    if (trackBox) await page.mouse.move(trackBox.x + trackBox.width / 2, trackBox.y + trackBox.height / 2);
    await expect(tooltip).toBeVisible();
    await page.mouse.move(2, 2);
    await expect(tooltip).toBeHidden();
    const modelRow = page.locator('.insights-panel[data-panel="model"] .pivot-row').first();
    const modelBtn = modelRow.locator('.pivot-filter-btn');
    await expect(modelBtn).toHaveAttribute('interestfor', 'barbell-tooltip');
    await modelBtn.focus();
    await expect(tooltip).toBeVisible();
    await expectNextToBarbell(page, modelRow.locator('.insight-dumbbell-track'));
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await page.evaluate(() => /** @type {HTMLElement | null} */ (document.activeElement)?.blur());
    await modelRow.locator('.insight-dumbbell-track').scrollIntoViewIfNeeded();
    const modelTrack = await modelRow.locator('.insight-dumbbell-track').boundingBox();
    expect(modelTrack).not.toBeNull();
    if (modelTrack) await page.mouse.click(modelTrack.x + modelTrack.width / 2, modelTrack.y + modelTrack.height / 2);
    await expect(page.locator('.insights-panel[data-panel="model"] .pivot-filter-btn').first()).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[aria-hidden="true"]'))).toBe(false);
    await page.locator('.insights-panel[data-panel="model"] .pivot-filter-btn').first().click();
    await expect(page.locator('.insights-panel[data-panel="model"] .pivot-filter-btn').first()).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#insights-mode-a11y').click();
    const dimBtn = page.locator('.insights-dimension-panel .insight-dumbbell-cell button[interestfor="barbell-tooltip"]').first();
    await expect(dimBtn).not.toHaveAttribute('tabindex', /.*/);
    await expect(dimBtn).not.toHaveAttribute('aria-hidden', /.*/);
    await expect(dimBtn).toHaveAccessibleName(/median unguided \d+%, guided \d+%/);
    await expect(page.locator('.insight-dumbbell-cell[tabindex]')).toHaveCount(0);
    await dimBtn.focus();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('for this dimension');
    await expectNextToBarbell(page, dimBtn.locator('.insight-dumbbell-track'));
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await expect(page.locator('.insights-uplift-sort-btn').first()).not.toHaveAttribute('aria-label', /.*/);
  });
  test('tooltips are placed with anchor() insets, not position-area (S2)', async ({ page }) => {
    for (const path of ['/', '/guide.html?guide=content-vis']) {
      await page.goto(path);
      const css = await page.evaluate(() => {
        /** @param {CSSRuleList} rules @returns {string} */
        const collect = rules => Array.from(rules).map(r => ('cssRules' in r && r.cssRules ? collect(/** @type {CSSGroupingRule} */ (r).cssRules) : '') + r.cssText).join('\n');
        return Array.from(document.styleSheets).map(s => { try { return collect(s.cssRules); } catch { return ''; } }).join('\n');
      });
      expect(css).not.toMatch(/position-area\s*:/);
    }
    await page.goto('/');
    const css = await page.locator('#barbell-tooltip').evaluate(el => {
      const s = getComputedStyle(el);
      return { anchor: s.getPropertyValue('position-anchor'), fallbacks: s.getPropertyValue('position-try-fallbacks') };
    });
    expect(css.anchor).toBe('--barbell-anchor');
    expect(css.fallbacks).toBe('flip-block');
  });
  test('filter menu chevron does not animate under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const duration = await page.locator('.filter-runs-chevron').evaluate(el => getComputedStyle(el).transitionDuration);
    expect(duration.split(',').every(d => parseFloat(d) === 0)).toBe(true);
  });
  test('barbell tooltip still works through the vendored interestfor polyfill', async ({ page }) => {
    await page.addInitScript(() => {
      delete (/** @type {any} */ (HTMLButtonElement.prototype)).interestForElement;
    });
    const polyfill = page.waitForRequest(r => r.url().endsWith('/vendor/interestfor.js'));
    await page.goto('/');
    await polyfill;
    const tooltip = page.locator('#barbell-tooltip');
    await page.locator('.uplift-link').first().focus();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Pass-rate lift');
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
  });
  test('regressed barbell connectors are dashed, not color-only; empty spotlight data hides the section', async ({ page }) => {
    await page.route('**/showcase-runs.json', route => route.fulfill({ json: { tasks: [] } }));
    await page.goto('/');
    await expect(page.locator('#ab-spotlight')).toBeHidden();
    await expect(page.locator('#ab-spotlight')).toHaveAttribute('aria-busy', 'false');
    const bg = await page.evaluate(() => {
      const track = document.createElement('div');
      track.className = 'insight-dumbbell-track';
      track.innerHTML = '<div class="connector regressed"></div>';
      const hero = document.createElement('div');
      hero.className = 'takeaway-dumbbell';
      hero.innerHTML = '<div class="takeaway-track"><div class="connector regressed"></div></div>';
      document.body.append(track, hero);
      return [track, hero].map(el => getComputedStyle(/** @type {Element} */ (el.querySelector('.connector'))).backgroundImage);
    });
    for (const image of bg) expect(image).toContain('repeating-linear-gradient');
  });
  test('filter menu relies on native popover behavior and keeps aria-expanded in sync', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#filter-btn');
    const menu = page.locator('#filter-menu');
    await btn.click();
    await expect(menu).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#filter-search')).toBeFocused();
    expect(await menu.evaluate(el => getComputedStyle(el).zIndex)).toBe('auto');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(btn).toBeFocused();
    await btn.click();
    await expect(menu).toBeVisible();
    await page.locator('.landing-title').click();
    await expect(menu).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
  test('breakdown explanations use interestfor hint popovers instead of title attributes', async ({ page }) => {
    await page.goto('/');
    await page.locator('#breakdowns > summary').click();
    const titleBtn = page.locator('.insights-panel[data-panel="model"] .insights-panel-title-btn');
    await expect(titleBtn).toBeVisible();
    await expect(titleBtn).not.toHaveAttribute('title', /.*/);
    await expect(page.locator('.insights-uplift-sort-btn').first()).not.toHaveAttribute('title', /.*/);
    await expect(page.locator('.guide-legend')).not.toHaveAttribute('title', /.*/);
    await expect(titleBtn).toHaveAttribute('interestfor', 'hint-sort-alpha-model');
    const hint = page.locator('#hint-sort-alpha-model');
    await expect(hint).toHaveAttribute('popover', 'hint');
    await titleBtn.focus();
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText('Sort models alphabetically');
    const legendBtn = page.locator('.guide-legend .info-hint-btn');
    await legendBtn.focus();
    const legendHint = page.locator('#hint-guide-legend');
    await expect(legendHint).toBeVisible();
    await expect(legendHint).toContainText('standard deviation');
    await page.keyboard.press('Escape');
    await expect(legendHint).toBeHidden();
  });
  test('agent table scroll wrapper is a labeled, focusable region; spotlight meter has no title tooltips', async ({ page }) => {
    await page.goto('/');
    const wrap = page.locator('.agent-table-wrap');
    await expect(wrap).toHaveAttribute('role', 'region');
    await expect(wrap).toHaveAttribute('tabindex', '0');
    await expect(wrap).toHaveAttribute('aria-labelledby', 'agent-table-caption');
    await expect(page.locator('#agent-table-caption')).toHaveCount(1);
    await expect(page.locator('#ab-spotlight')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.ab-meter-seg').first()).toBeAttached();
    expect(await page.locator('.ab-meter-seg[title]').count()).toBe(0);
  });
  test('switcher groups (#ab-agent-pills, #ab-task-pills, .metric-mode-toggle) use native fieldset/legend and pill-styled radio inputs with arrow-key selection', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.locator('#ab-spotlight')).toHaveAttribute('aria-busy', 'false');
    const agentGroup = page.locator('#ab-agent-pills');
    const taskGroup = page.locator('#ab-task-pills');
    await expect(page.getByRole('group', { name: 'Select coding agent' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Select evaluation task' })).toBeVisible();
    await expect(agentGroup).toHaveAttribute('aria-controls', 'ab-comparison-frame');
    await expect(taskGroup).toHaveAttribute('aria-controls', 'ab-comparison-frame');
    const agentRadios = agentGroup.locator('input[type="radio"]');
    await expect(agentRadios).toHaveCount(3);
    await expect(agentRadios.nth(0)).toBeChecked();
    await expect(agentRadios.nth(1)).not.toBeChecked();
    await expect(agentRadios.nth(2)).not.toBeChecked();
    await expect(page.locator('#ab-run-provenance')).toContainText('claude-fable-5-1');
    await agentRadios.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(agentRadios.nth(1)).toBeFocused();
    await expect(agentRadios.nth(1)).toBeChecked();
    await expect(agentRadios.nth(0)).not.toBeChecked();
    // Pill order follows AGENT_FAMILIES (Claude Code, Codex CLI, Antigravity CLI).
    await expect(page.locator('#ab-run-provenance')).toContainText('gpt-6.1-sol');
    const pillOutline = await agentRadios.nth(1).evaluate(el => getComputedStyle(/** @type {Element} */ (el.closest('.ab-agent-pill'))).outlineStyle);
    expect(pillOutline).toBe('solid');
    await page.keyboard.press('ArrowRight');
    await expect(agentRadios.nth(2)).toBeFocused();
    await expect(agentRadios.nth(2)).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(agentRadios.nth(0)).toBeFocused();
    await expect(agentRadios.nth(0)).toBeChecked();
    await page.keyboard.press('ArrowLeft');
    await expect(agentRadios.nth(2)).toBeFocused();
    await expect(agentRadios.nth(2)).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(agentRadios.nth(0)).toBeFocused();
    await expect(agentRadios.nth(0)).toBeChecked();
    const taskRadios = taskGroup.locator('input[type="radio"]');
    await page.keyboard.press('Tab');
    await expect(taskRadios.nth(0)).toBeFocused();
    await expect(taskRadios.nth(0)).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(taskRadios.nth(1)).toBeFocused();
    await expect(taskRadios.nth(1)).toBeChecked();
    await expect(taskRadios.nth(0)).not.toBeChecked();
    await page.keyboard.press('Shift+Tab');
    await expect(agentRadios.nth(0)).toBeFocused();
    await page.locator('#breakdowns > summary').click();
    await expect(page.getByRole('group', { name: 'Comparison check scope' })).toBeVisible();
    const modeAllRadio = page.locator('#insights-mode-all input[type="radio"]');
    const modeA11yRadio = page.locator('#insights-mode-a11y input[type="radio"]');
    await expect(modeAllRadio).toBeChecked();
    await expect(modeA11yRadio).not.toBeChecked();
    await modeAllRadio.focus();
    await page.keyboard.press('ArrowRight');
    await expect(modeA11yRadio).toBeFocused();
    await expect(modeA11yRadio).toBeChecked();
    await expect(modeAllRadio).not.toBeChecked();
    await expect(page.locator('.sort-select-pill .sort-select-value')).toHaveCount(0);
    await expect(page.locator('#guide-sort-select')).toHaveCSS('opacity', '1');
    const upliftSortBtn = page.locator('.insights-uplift-sort-btn[data-panel-uplift-sort="model"]');
    await expect(upliftSortBtn).toContainText('Uplift');
    await expect(upliftSortBtn.locator('.visually-hidden')).toHaveText('');
    await expect(page.locator('#hint-sort-uplift-model')).toHaveText('Sort models by uplift (high to low)');
    await upliftSortBtn.click();
    await expect(page.locator('.insights-uplift-sort-btn[data-panel-uplift-sort="model"] .visually-hidden')).toHaveText(' (sorted high to low)');
    await expect(page.locator('#hint-sort-uplift-model')).toHaveText('Sorted by uplift (high to low) — click to sort low to high');
    await page.locator('.insights-uplift-sort-btn[data-panel-uplift-sort="model"]').click();
    await expect(page.locator('.insights-uplift-sort-btn[data-panel-uplift-sort="model"] .visually-hidden')).toHaveText(' (sorted low to high)');
    await expect(page.locator('#hint-sort-uplift-model')).toHaveText('Sorted by uplift (low to high) — click to reset to alphabetical sort');
    expect(errors).toEqual([]);
  });
});
test.describe('Guide trend page MWG compliance', () => {
  test('autocomplete is an anchored popover listbox with light dismiss synced to the combobox', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/guide.html?guide=content-vis');
    await expect(page.locator('.timeline-point').first()).toBeVisible();
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin-when-cross-origin');
    await expect(page.locator('meta[name="text-scale"]')).toHaveAttribute('content', 'scale');
    await expect(page.locator('script[src="features-mapping.gen.js"]')).toHaveAttribute('defer', '');
    const input = page.locator('#guide-search');
    const list = page.locator('#autocomplete-list');
    const status = page.locator('#autocomplete-status');
    await expect(input).toHaveAttribute('type', 'text');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(list).toHaveAttribute('popover', 'auto');
    await input.fill('pre');
    await expect(list).toBeVisible();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(status).toContainText('option');
    expect(await list.evaluate(el => el.matches(':popover-open'))).toBe(true);
    const inBox = await input.boundingBox();
    const listBox = await list.boundingBox();
    expect(inBox && listBox && Math.abs(listBox.y - (inBox.y + inBox.height)) <= 2 && Math.abs(listBox.x - inBox.x) <= 2).toBe(true);
    await input.click();
    await expect(list).toBeVisible();
    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'autocomplete-option-0');
    await page.mouse.click(5, (page.viewportSize()?.height ?? 720) - 5);
    await expect(list).toBeHidden();
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toHaveAttribute('aria-activedescendant', /.*/);
    await expect(status).toHaveText('');
    expect(errors).toEqual([]);
  });
  test('timeline points are SVG links with interestfor that open an anchored popover="hint"', async ({ page }) => {
    await page.goto('/guide.html?guide=content-vis');
    const point = page.locator('.timeline-point').first();
    await expect(point).toBeVisible();
    const tooltip = page.locator('#tooltip-container');
    await expect(tooltip).toHaveAttribute('popover', 'hint');
    expect(await point.evaluate(el => el instanceof SVGAElement)).toBe(true);
    await expect(point).toHaveAttribute('href', /^dashboard\.html\?testId=.+#guide-content-vis$/);
    await expect(point).toHaveAttribute('interestfor', 'tooltip-container');
    await expect(point).not.toHaveAttribute('role', /.*/);
    await expect(point).toHaveAttribute('aria-label', /^[^%]+: open run$/);
    await point.locator('.timeline-marker').hover();
    await expect(tooltip).toBeVisible();
    expect(await tooltip.evaluate(el => el.matches(':popover-open'))).toBe(true);
    await expect(page.locator('#tooltip-content .guide-tooltip-date')).not.toBeEmpty();
    const marker = await point.locator('.timeline-marker').boundingBox();
    const tip = await tooltip.boundingBox();
    expect(marker && tip && Math.min(Math.abs(tip.x - (marker.x + marker.width)), Math.abs(tip.x + tip.width - marker.x)) <= 14).toBe(true);
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await point.focus();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/dashboard\.html\?testId=/);
  });
});
