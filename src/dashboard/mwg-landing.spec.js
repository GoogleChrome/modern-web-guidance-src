import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
/** Latest-nightly summaries (with Spotlight slices) for the three agent families, built from real October 27–28 nightlies. */
const SHOWCASE_SUITES_FIXTURE = JSON.parse(readFileSync(new URL('./mock-results/showcase-suites.json', import.meta.url), 'utf8'));
/** @param {import('@playwright/test').Page} page */
function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
/**
 * Opens the breakdowns drawer, then parks the pointer: left over the drawer's summary it can end up
 * on another interestfor trigger once layout settles, which opens that tooltip instead of the one under test.
 * @param {import('@playwright/test').Page} page */
async function openBreakdowns(page) {
  await page.locator('#breakdowns > summary').click();
  await page.mouse.move(2, 2);
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
    // Present (even when empty) on summaries from the current extractor, so the hero doesn't re-hydrate from evals.json.
    showcase: {},
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
    await openBreakdowns(page);
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
  test('expand chevron does not animate under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const manyGuides = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`guide-${i}`, { guidedPassed: 5, guidedTotal: 5, guidedRate: 100, unguidedPassed: 2, unguidedTotal: 5, unguidedRate: 40, uplift: 60 }]));
    await page.route('**/api/suites*', route => route.fulfill({ json: { suites: A11Y_SUITES_FIXTURE.suites.map(s => ({ ...s, guides: manyGuides })) } }));
    await page.goto('/');
    await openBreakdowns(page);
    const duration = await page.locator('.insights-expand-chevron').first().evaluate(el => getComputedStyle(el).transitionDuration);
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
  test('regressed barbell connectors are dashed, not color-only; no Spotlight data renders placeholders in place', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#ab-spotlight')).toBeVisible();
    await expect(page.locator('#ab-spotlight')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#ab-prompt-text')).toHaveText('Numbers appear once results are loaded.');
    await expect(page.locator('#ab-checks-content')).toContainText('No data loaded');
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
  test('inline run filter search and By Model breakdown surface non-scheduled Pi/Mistral/Qwen runs alongside nightly runs', async ({ page }) => {
    const mixedFixture = {
      suites: [
        ...A11Y_SUITES_FIXTURE.suites,
        {
          testId: 'pi-mistral-medium-3-5-skills-fix-2026-10-01_12-39-52',
          timestamp: '2026-10-01T12:39:52.000Z',
          agent: 'pi',
          serving: 'skills_cli',
          model: 'openrouter/mistralai/mistral-medium-3.1',
          taskCount: 10,
          maxRuns: 1,
          guidedStats: { passed: 8, total: 10 },
          unguidedStats: { passed: 5, total: 10 },
          showcase: {},
          guides: {
            'content-vis': { guidedPassed: 4, guidedTotal: 5, guidedRate: 80, unguidedPassed: 2, unguidedTotal: 5, unguidedRate: 40, uplift: 40 }
          }
        }
      ]
    };
    await page.route('**/api/suites*', route => route.fulfill({ json: mixedFixture }));
    await page.goto('/');
    const search = page.locator('#filter-search');
    const scheduledCheck = page.locator('#scheduled-only-check');
    await expect(scheduledCheck).toBeChecked();
    await expect(search).toHaveAttribute('list', 'runs-filter-datalist');
    await expect(page.locator('#runs-filter-datalist option[value="openrouter/mistralai/mistral-medium-3.1"]')).toHaveAttribute('label', '1 run');
    await expect(page.locator('#runs-filter-datalist option[value="pi"]')).toHaveAttribute('label', 'Pi CLI · 1 run');
    // Default table view shows the 2 scheduled nightly runs, hiding the ad-hoc pi run.
    await expect(page.locator('.suite-table-row')).toHaveCount(2);
    // Opening Breakdowns shows Mistral in By Model even while Scheduled runs only is checked.
    await openBreakdowns(page);
    await expect(page.locator('.insights-panel[data-panel="model"] .pivot-filter-btn', { hasText: 'openrouter/mistralai/mistral-medium-3.1' })).toBeVisible();
    // Typing "mistral" in the inline search box surfaces the pi-mistral run immediately.
    await search.fill('mistral');
    await expect(page.locator('.suite-table-row')).toHaveCount(1);
    await expect(page.locator('.suite-table-row').first()).toHaveAttribute('data-test-id', 'pi-mistral-medium-3-5-skills-fix-2026-10-01_12-39-52');
    await expect(page.locator('.suite-table-row .agent-cell').first()).toContainText('Pi CLI');
  });
  test('breakdown explanations use interestfor hint popovers instead of title attributes', async ({ page }) => {
    await page.goto('/');
    await openBreakdowns(page);
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
    await page.route('**/api/suites*', route => route.fulfill({ json: SHOWCASE_SUITES_FIXTURE }));
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
    await page.route('**/api/suites*', route => route.fulfill({ json: SHOWCASE_SUITES_FIXTURE }));
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
    await openBreakdowns(page);
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
test.describe('Search quality page MWG compliance', () => {
  test('links from landing header and renders interactive search benchmarks without third-party requests or console errors', async ({ page }) => {
    const errors = collectErrors(page);
    /** @type {string[]} */
    const thirdParty = [];
    page.on('request', r => { if (/unpkg\.com|jsdelivr|cdn\.|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(r.url())) thirdParty.push(r.url()); });

    await page.goto('/');
    const searchLink = page.locator('.header-links a[href="search/"]');
    await expect(searchLink).toHaveText('Search Quality');
    await searchLink.click();
    await expect(page).toHaveURL(/\/search\/$/);

    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin-when-cross-origin');
    await expect(page.locator('meta[name="text-scale"]')).toHaveAttribute('content', 'scale');
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light dark');
    await expect(page.locator('h1')).toContainText('MWG CLI: Search quality over time');
    await expect(page.locator('.cadence-note')).toContainText('updates when changes land in the search pipeline');

    // Section 1: sparkline metric switching and query/axis controls
    const svgA = page.locator('#svg-a');
    await expect(svgA).toHaveAttribute('aria-label', /Right guide shown, Wild-v2 test:.*#3089 95\.4%/);
    await page.locator('.spark[data-metric="ndcg"]').click();
    await expect(page.locator('.spark[data-metric="ndcg"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(svgA).toHaveAttribute('aria-label', /Leaf nDCG@K, Wild-v2 test:.*#3089 75%/);
    await expect(page.locator('#a [data-metric-note="ndcg"]')).toBeVisible();

    await page.locator('#a-view input[value="nightly"]').check({ force: true });
    await expect(svgA).toHaveAttribute('aria-label', /Leaf nDCG@K, Agent test:.*#3089 91\.3%/);

    await page.locator('#a-x input[value="time"]').check({ force: true });
    await expect(svgA.locator('text.a-row-label', { hasText: '2026' })).toBeVisible();

    await page.locator('#svg-a .a-pt').first().hover();
    await expect(page.locator('#tip')).toBeVisible();

    // Section 2: milestones table
    await expect(page.locator('#m-table tbody tr')).toHaveCount(15);

    // Section 3: K-horizon metric toggle
    const svgK = page.locator('#svg-k');
    await expect(svgK).toHaveAttribute('aria-label', /^Signal-to-noise by K\./);
    await page.locator('#k-metric input[value="hit"]').check({ force: true });
    await expect(svgK).toHaveAttribute('aria-label', /^Right guide shown by K\./);

    // Mobile viewport check: no document-level horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);

    expect(thirdParty).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('analytics bootstrap scrubs non-allowlisted query params/hashes and renders the themed cookie notification bar when required', async ({ page }) => {
    const errors = collectErrors(page);

    for (const path of ['/', '/dashboard.html?testId=example-result', '/guide.html?guide=content-vis', '/search/', '/demos/']) {
      await page.goto(`${path}${path.includes('?') ? '&' : '?'}email=user@example.com&token=secret#oauth_fragment`);
      await expect(page.locator('.site-legal-footer a[href="https://policies.google.com/privacy"]')).toBeVisible();
      await expect(page.locator('.site-legal-footer a[href="https://policies.google.com/terms"]')).toBeVisible();
      const configCall = await page.evaluate(() => {
        const dl = /** @type {any[]} */ (/** @type {any} */ (window).dataLayer || []);
        const entry = dl.find(item => item?.[0] === 'config');
        return entry ? { id: entry[1], opts: entry[2] } : null;
      });
      expect(configCall?.id).toBe('G-V48MZB1JQE');
      expect(configCall?.opts?.allow_google_signals).toBe(false);
      expect(configCall?.opts?.allow_ad_personalization_signals).toBe(false);
      expect(configCall?.opts?.page_location).not.toContain('user@example.com');
      expect(configCall?.opts?.page_location).not.toContain('secret');
      expect(configCall?.opts?.page_location).not.toContain('oauth_fragment');
      if (path.includes('testId=example-result')) {
        expect(configCall?.opts?.page_location).toContain('testId=example-result');
      }
      if (path.includes('guide=content-vis')) {
        expect(configCall?.opts?.page_location).toContain('guide=content-vis');
      }
    }

    await page.goto('/?previewCookieBar=1');
    const cnbScript = page.locator('script[src*="cookienotificationbar.min.js"]');
    await expect(cnbScript).toHaveAttribute('data-glue-cookie-notification-bar-category', '2B');
    await expect(cnbScript).toHaveAttribute(
      'data-glue-cookie-notification-bar-site-id',
      'Modern Web Guidance Eval Dashboard',
    );
    await expect(page.locator('.glue-cookie-notification-bar')).toBeVisible();
    const isFirstElement = await page.evaluate(
      () => document.body.firstElementChild?.classList.contains('glue-cookie-notification-bar') ?? false,
    );
    expect(isFirstElement).toBe(true);

    for (const colorScheme of /** @type {const} */ (['light', 'dark'])) {
      await page.emulateMedia({ colorScheme });
      const acceptBtn = page.locator('.glue-cookie-notification-bar__accept');
      await acceptBtn.focus();
      const styles = await acceptBtn.evaluate(el => {
        const cs = getComputedStyle(el);
        const barEl = document.querySelector('.glue-cookie-notification-bar');
        if (!barEl) throw new Error('Missing cookie notification bar');
        const barCs = getComputedStyle(barEl);
        const cv = document.createElement('canvas');
        cv.width = 1;
        cv.height = 1;
        const ctx = cv.getContext('2d');
        if (!ctx) throw new Error('Missing 2d canvas context');
        ctx.fillStyle = barCs.backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return { bg: cs.backgroundColor, color: cs.color, barBg: barCs.backgroundColor, barRgb: [r, g, b] };
      });
      expect(styles.color).toBe('rgb(255, 255, 255)');
      expect(styles.bg).not.toBe('rgb(255, 255, 255)');
      expect(styles.barBg).toContain('oklab(');
      if (colorScheme === 'dark') {
        expect(styles.barRgb[2]).toBeGreaterThan(styles.barRgb[0]);
      }
    }

    expect(errors).toEqual([]);
  });
});
