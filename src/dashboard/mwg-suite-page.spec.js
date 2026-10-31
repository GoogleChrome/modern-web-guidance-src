import { test, expect } from '@playwright/test';
/** @param {import('@playwright/test').Page} page
 * @param {string} selector */
async function labelContrast(page, selector) {
  const clip = await page.evaluate(sel => {
    const range = document.createRange();
    range.selectNodeContents(/** @type {Element} */ (document.querySelector(sel)));
    const r = range.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, selector);
  const png = await page.screenshot({ clip });
  return page.evaluate(async b64 => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const lums = [];
    const hist = Array.from({ length: 256 }, () => 0);
    for (let i = 0; i < data.length; i += 4) { const l = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]); lums.push(l); hist[l]++; }
    const mode = hist.indexOf(Math.max(...hist));
    return lums.filter(l => Math.abs(l - mode) > 60).length / lums.length;
  }, png.toString('base64'));
}
test.describe('Suite page MWG compliance', () => {
  test('suite chart tooltip is an interest-triggered hint popover anchored to its row', async ({ page }) => {
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/dashboard.html?testId=example-result');
    const tip = page.locator('#dumbbell-tooltip');
    await expect(tip).toHaveAttribute('popover', 'hint');
    const hitArea = page.locator('#dumbbell-chart a.dc-hit').first();
    await expect(hitArea).toHaveAttribute('interestfor', 'dumbbell-tooltip');
    await expect(hitArea).toHaveAttribute('href', /[?&]task=.*#guide-/);
    await hitArea.hover();
    await expect(tip).toBeVisible();
    expect(await tip.evaluate(el => el.matches(':popover-open'))).toBe(true);
    const placement = await tip.evaluate(el => {
      const cs = getComputedStyle(el);
      const anchor = document.querySelector('.dc-anchor');
      const a = anchor?.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      return {
        positionAnchor: cs.getPropertyValue('position-anchor'),
        positionArea: cs.getPropertyValue('position-area'),
        inline: el.style.top || el.style.left,
        anchorName: anchor ? getComputedStyle(anchor).getPropertyValue('anchor-name') : null,
        gap: a ? Math.min(Math.abs(t.top - a.bottom), Math.abs(a.top - t.bottom)) : Infinity,
      };
    });
    expect(placement).toMatchObject({ positionAnchor: '--dumbbell-row', positionArea: 'none', inline: '', anchorName: '--dumbbell-row' });
    expect(placement.gap).toBeLessThanOrEqual(8);
    await tip.hover();
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await hitArea.focus();
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await hitArea.click();
    await expect(page.locator('.task-accordion.open')).toHaveCount(1);
    expect(page.url()).not.toContain('#guide-');
    expect(errors).toEqual([]);
  });
  test('a touch tap on a chart row shows its tooltip first; a second tap opens the task', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto('/dashboard.html?testId=example-result');
    const hitArea = page.locator('#dumbbell-chart a.dc-hit').first();
    await hitArea.scrollIntoViewIfNeeded();
    const box = await hitArea.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      const tip = page.locator('#dumbbell-tooltip');
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await expect(tip).toBeVisible();
      const tipBox = await tip.boundingBox();
      expect(tipBox && tipBox.x >= 0 && tipBox.x + tipBox.width <= 390).toBe(true);
      await expect(page.locator('.task-accordion.open')).toHaveCount(0);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.locator('.task-accordion.open')).toHaveCount(1);
    }
    await ctx.close();
  });
  test('tabbing through a long suite chart keeps the focused row and its tooltip on screen', async ({ page }) => {
    await page.route('**/example-result/evals.json*', async route => {
      const data = await (await route.fetch()).json();
      for (const section of ['results', 'stats']) {
        for (const key of Object.keys(data[section])) {
          const [task, guide, mode] = key.split(' - ');
          for (let x = 1; x <= 17; x++) data[section][`${task} - ${guide}-x${x} - ${mode}`] = data[section][key];
        }
      }
      await route.fulfill({ json: data });
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/dashboard.html?testId=example-result');
    const hits = page.locator('#dumbbell-chart a.dc-hit');
    await expect(hits).toHaveCount(36);
    const heights = await hits.evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(24);
    const tip = page.locator('#dumbbell-tooltip');
    const inViewport = (/** @type {{ x: number, y: number, width: number, height: number } | null} */ b) =>
      !!b && b.y >= -1 && b.y + b.height <= 721 && b.x >= -1 && b.x + b.width <= 1281;
    await hits.first().focus();
    let visited = 0;
    for (let presses = 0; presses < 40 && visited < 27; presses++) {
      await page.keyboard.press('Tab');
      const onRow = await page.evaluate(() => !!document.activeElement?.matches('#dumbbell-chart a.dc-hit'));
      if (!onRow) continue;
      visited++;
      const focused = page.locator('#dumbbell-chart a.dc-hit:focus');
      await expect.poll(async () => inViewport(await focused.locator('rect').boundingBox()), { message: `row ${visited} in view` }).toBe(true);
      await expect(tip).toBeVisible();
      const label = await focused.getAttribute('aria-label');
      await expect(tip.locator('.dumbbell-tooltip-title')).toHaveText(String(label?.replace(/: open task.*$/, '')));
      await expect.poll(async () => inViewport(await tip.boundingBox()), { message: `tooltip ${visited} in view` }).toBe(true);
    }
    expect(visited).toBeGreaterThanOrEqual(25);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
  test('a sort change during the first render still deep-links to the #guide- accordion', async ({ page }) => {
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/dashboard.html?testId=example-result&task=task#guide-preload-prerender');
    await page.locator('#guide-grid .eval-col-sort-btn[data-sort="uplift"]').click();
    const target = page.locator('.task-accordion[data-guide="preload-prerender"]');
    await expect(target).toHaveClass(/open/);
    await expect(page.locator('#guide-grid')).not.toHaveAttribute('aria-busy', /./);
    expect(errors).toEqual([]);
  });
  test('collapsed task panels are findable, render assertions eagerly, and paint no empty band', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');
    const accordion = page.locator('.task-accordion').first();
    await expect(accordion.locator('h3.task-accordion-heading > button.task-toggle')).toHaveCount(1);
    const content = accordion.locator('.task-accordion-content');
    await expect(content).toHaveAttribute('hidden', 'until-found');
    expect(await content.locator('table.truth-matrix tbody tr').count()).toBeGreaterThan(0);
    const box = await content.evaluate(el => {
      const cs = getComputedStyle(el);
      return { padding: cs.paddingTop, border: cs.borderTopWidth, height: el.getBoundingClientRect().height };
    });
    expect(box).toEqual({ padding: '0px', border: '0px', height: 0 });
    expect(await accordion.evaluate(el => getComputedStyle(el).contentVisibility)).toBe('auto');
    await content.evaluate(el => {
      el.removeAttribute('hidden');
      el.dispatchEvent(new Event('beforematch', { bubbles: true }));
    });
    await expect(accordion).toHaveClass(/open/);
    await expect(accordion.locator('.task-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(accordion.locator('.tfoot-action-btn').first()).toBeVisible();
    expect(await accordion.locator('table.truth-matrix').count()).toBe(1);
  });
  test('badges explain themselves through interest-invoking buttons, not title attributes', async ({ page }) => {
    const longReason = 'Build failed: ' + 'missing module ./widget.js; '.repeat(60);
    await page.route('**/evals.json*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      const key = Object.keys(json.results).find(k => json.results[k]?.[0]?.results?.length);
      if (key) json.results[key][0].results[0].failureReason = longReason;
      await route.fulfill({ response, json });
    });
    await page.goto('/dashboard.html?testId=example-result');
    await expect(page.locator('.task-accordion').first()).toBeVisible();
    expect(await page.locator('.task-accordion [title], #test-header [title]').count()).toBe(0);
    expect(await page.locator('#dumbbell-chart title').count()).toBe(0);
    const triggers = page.locator('.hint-trigger');
    const count = await triggers.count();
    expect(count).toBeGreaterThan(0);
    const pairs = await triggers.evaluateAll(els => els.map(el => {
      const id = el.getAttribute('interestfor') || '';
      const pop = document.getElementById(id);
      return {
        tag: el.tagName,
        id,
        popover: pop?.getAttribute('popover'),
        anchor: /** @type {HTMLElement} */ (el).style.getPropertyValue('anchor-name'),
        positionAnchor: pop?.style.getPropertyValue('position-anchor'),
      };
    }));
    for (const pair of pairs) {
      expect(pair.tag).toBe('BUTTON');
      expect(pair.popover).toBe('hint');
      expect(pair.anchor).toBe(`--${pair.id}`);
      expect(pair.positionAnchor).toBe(pair.anchor);
    }
    expect(new Set(pairs.map(p => p.id)).size).toBe(pairs.length);
    const accordion = page.locator('.task-accordion').filter({ has: page.locator('.hint-trigger', { hasText: 'Build Failed' }) }).first();
    const badge = accordion.locator('.hint-trigger', { hasText: 'Build Failed' });
    const hintId = await badge.getAttribute('interestfor');
    const hint = page.locator(`#${hintId}`);
    await badge.focus();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('broken app or build');
    const [badgeBox, hintBox] = [await badge.boundingBox(), await hint.boundingBox()];
    expect(badgeBox && hintBox).toBeTruthy();
    if (badgeBox && hintBox) {
      const nearBelow = Math.abs(hintBox.y - (badgeBox.y + badgeBox.height)) < 16;
      const nearAbove = Math.abs(hintBox.y + hintBox.height - badgeBox.y) < 16;
      expect(nearBelow || nearAbove).toBe(true);
      expect(Math.abs(hintBox.x - badgeBox.x)).toBeLessThan(hintBox.width);
    }
    await page.keyboard.press('Escape');
    await expect(hint).toBeHidden();
    await badge.click();
    await expect(accordion).not.toHaveClass(/open/);
    const hitTest = await badge.evaluate(el => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      return { height: r.height, above: el.contains(document.elementFromPoint(x, y - 11.5)), below: el.contains(document.elementFromPoint(x, y + 11.5)) };
    });
    expect(hitTest).toMatchObject({ above: true, below: true });
    await accordion.locator('.task-toggle').click();
    const details = accordion.locator('.tfoot-chip-details').first();
    await expect(details).toBeVisible();
    const msg = details.locator('.tfoot-chip-msg');
    await expect(msg).not.toHaveAttribute('tabindex', /./);
    await details.locator('summary').click();
    await expect(msg).toHaveAttribute('tabindex', '0');
    await expect(msg).toHaveAttribute('role', 'region');
    await expect(msg).toHaveAttribute('aria-label', 'Build Failed message');
  });
  test('hint popovers keep a minimum width so they flip instead of squeezing at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard.html?testId=example-result');
    const btn = page.locator('.anchor-dash-tokens');
    await btn.focus();
    const hint = page.locator('#dash-tooltip-tokens');
    await expect(hint).toBeVisible();
    const box = await hint.boundingBox();
    expect(box).toBeTruthy();
    if (box) { expect(box.width).toBeGreaterThanOrEqual(255); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390); }
  });
  test('trajectory and same-origin app previews render in an opaque-origin sandboxed iframe', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');
    await page.locator('.task-accordion-header').first().click();
    const appBtn = page.locator('.tfoot-action-btn[data-action="app"]').first();
    await expect(appBtn).toBeVisible();
    const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
    await appBtn.click();
    const frame = page.locator('#modal iframe.artifact-frame');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-forms');
    expect(await popupPromise).toBeNull();
    const childFrame = page.frames().find(f => f !== page.mainFrame());
    expect(childFrame).toBeTruthy();
    if (childFrame) {
      await childFrame.waitForLoadState();
      const probe = await childFrame.evaluate(() => {
        let storage = 'readable';
        try { void window.localStorage.length; } catch { storage = 'blocked'; }
        return { origin: window.origin, storage };
      });
      expect(probe).toEqual({ origin: 'null', storage: 'blocked' });
    }
    await page.locator('#modal .close-modal').click();
    await expect(page.locator('#modal')).toBeHidden();
    await expect(frame).toHaveCount(0);
    await page.route('**/session-mwg-test.html*', route => route.fulfill({
      contentType: 'text/html',
      body: '<p id="t">trajectory</p><script>let s; try { s = localStorage.getItem("gcs_access_token"); } catch { s = "blocked"; } document.getElementById("t").textContent = origin + " " + s;</script>',
    }));
    await page.evaluate(async () => {
      // @ts-expect-error exposed for onclick handlers
      await window.openTrajectory('example-result', 'session-mwg-test.html');
    });
    const trajFrame = page.locator('#modal iframe.artifact-frame');
    await expect(trajFrame).toHaveAttribute('sandbox', 'allow-scripts');
    expect(await trajFrame.evaluate(el => /** @type {HTMLIFrameElement} */ (el).hasAttribute('srcdoc'))).toBe(true);
    await expect(page.frameLocator('#modal iframe.artifact-frame').locator('#t')).toHaveText('null blocked');
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();
  });
  test('Esc closes the dialog from inside a sandboxed trajectory, and late loads are dropped', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');
    await expect(page.locator('.task-accordion').first()).toBeVisible();
    await page.route('**/session-esc.html*', route => route.fulfill({
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><body><button id="inner">inner</button><p id="mode"></p><script>document.getElementById("mode").textContent = document.compatMode;</script></body></html>',
    }));
    await page.evaluate(async () => {
      // @ts-expect-error exposed for onclick handlers
      await window.openTrajectory('example-result', 'session-esc.html');
    });
    const frame = page.frameLocator('#modal iframe.artifact-frame');
    await expect(frame.locator('#mode')).toHaveText('CSS1Compat');
    await page.evaluate(() => window.postMessage({ type: 'mwg-dashboard:close-modal' }, '*'));
    await page.waitForTimeout(200);
    await expect(page.locator('#modal')).toBeVisible();
    await frame.locator('#inner').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();
    await expect(page.locator('#modal iframe.artifact-frame')).toHaveCount(0);
    /** @type {() => void} */
    let release = () => {};
    const gate = new Promise(resolve => { release = () => resolve(undefined); });
    await page.route('**/session-slow.html*', async route => {
      await gate;
      await route.fulfill({ contentType: 'text/html', body: '<p>late</p>' });
    });
    const pending = page.evaluate(() => {
      // @ts-expect-error exposed for onclick handlers
      return window.openTrajectory('example-result', 'session-slow.html');
    });
    await expect(page.locator('#modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();
    release();
    await pending;
    await expect(page.locator('#modal iframe.artifact-frame')).toHaveCount(0);
  });
  test('the Esc bridge also skips comments before the doctype, keeping standards mode', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');
    await expect(page.locator('.task-accordion').first()).toBeVisible();
    await page.route('**/session-comment.html*', route => route.fulfill({
      contentType: 'text/html',
      body: '<!-- generated --> \n<!-- by the agent -->\n<!doctype html><html><body><p id="mode"></p><script>document.getElementById("mode").textContent = document.compatMode;</script></body></html>',
    }));
    await page.evaluate(async () => {
      // @ts-expect-error exposed for onclick handlers
      await window.openTrajectory('example-result', 'session-comment.html');
    });
    await expect(page.frameLocator('#modal iframe.artifact-frame').locator('#mode')).toHaveText('CSS1Compat');
    await page.keyboard.press('Escape');
  });
  test('app previews explain how to leave the frame with the keyboard', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');
    await page.locator('.task-accordion-header').first().click();
    await page.locator('.tfoot-action-btn[data-action="app"]').first().click();
    await expect(page.locator('#modal .frame-esc-hint')).toBeVisible();
    await expect(page.locator('#modal .frame-esc-hint')).toContainText('Shift+Tab');
    await page.locator('#modal .close-modal').click();
  });
  test('loading reserves the chart and header space, so the guide list does not shift', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test-only global
      window.__cls = 0;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          // @ts-expect-error LayoutShift fields
          if (!entry.hadRecentInput) window.__cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    /** @type {() => void} */
    let release = () => {};
    const gate = new Promise(resolve => { release = () => resolve(undefined); });
    await page.route('**/evals.json*', async route => { await gate; await route.continue(); });
    await page.goto('/dashboard.html?testId=example-result');
    const section = page.locator('#chart-section');
    await expect(section).toHaveAttribute('aria-busy', 'true');
    await expect(section).toBeVisible();
    expect((await page.locator('#summary-side-panel').boundingBox())?.height).toBeGreaterThan(300);
    release();
    await expect(page.locator('.task-accordion').first()).toBeVisible();
    await expect(section).not.toHaveAttribute('aria-busy', /./);
    await expect(page.locator('#test-header')).not.toHaveAttribute('aria-busy', /./);
    await expect(page.locator('#guide-grid')).not.toHaveAttribute('aria-busy', /./);
    await page.waitForTimeout(300);
    // @ts-expect-error test-only global
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.05);
  });
  test('forced colors: chart marks and the pressed mode use system colors on every page', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    /** @param {string} name */
    const systemColor = name => page.evaluate(n => {
      const probe = document.createElement('div');
      probe.style.color = n;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    }, name);
    await page.goto('/dashboard.html?testId=example-result');
    await expect(page.locator('.task-accordion').first()).toBeVisible();
    const [highlight, highlightText, canvasText, grayText] = [await systemColor('Highlight'), await systemColor('HighlightText'), await systemColor('CanvasText'), await systemColor('GrayText')];
    const pressed = page.locator('.mode-toggle-btn:has(> input[type="radio"]:checked)');
    expect(await pressed.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color, getComputedStyle(el).forcedColorAdjust])).toEqual([highlight, highlightText, 'none']);
    expect(await labelContrast(page, '.mode-toggle-btn:has(> input[type="radio"]:checked)')).toBeGreaterThan(0.05);
    expect(await page.locator('.legend-line.regressed').evaluate(el => [getComputedStyle(el).borderTopStyle, getComputedStyle(el).borderTopColor])).toEqual(['dashed', canvasText]);
    expect(await page.locator('#dumbbell-chart .dc-gtick').first().evaluate(el => getComputedStyle(el).stroke)).toBe(highlight);
    expect(await page.locator('#dumbbell-chart text').evaluateAll(els => [...new Set(els.map(el => getComputedStyle(el).fill))])).toEqual([canvasText]);
    await page.goto('/');
    await expect(page.locator('#hero')).toHaveAttribute('aria-busy', 'false');
    const marks = await page.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = ` <div class="suite-dumbbell-track"><div class="connector regressed"></div><div class="dot guided"></div><div class="dot unguided"></div></div> <div class="takeaway-dumbbell"><div class="suite-dumbbell-track takeaway-track"><div class="connector regressed"></div><div class="dot guided"></div></div></div> <span class="guide-legend-swatch guided"><span class="guide-legend-tick"></span></span> <div class="insight-dumbbell-track"><span class="variance-band guided has-err"></span></div>`;
      document.body.append(host);
      /** @param {string} sel */
      const cs = sel => getComputedStyle(/** @type {Element} */ (host.querySelector(sel)));
      const result = {
        guided: cs('.suite-dumbbell-track .dot.guided').backgroundColor,
        unguided: cs('.suite-dumbbell-track .dot.unguided').backgroundColor,
        regressed: [cs('.suite-dumbbell-track .connector.regressed').borderTopStyle, cs('.suite-dumbbell-track .connector.regressed').borderTopColor],
        heroRegressed: [cs('.takeaway-track .connector.regressed').borderTopStyle, cs('.takeaway-track .connector.regressed').backgroundImage],
        legendTick: cs('.guide-legend-tick').backgroundColor,
        band: cs('.variance-band').backgroundColor,
        adjust: cs('.suite-dumbbell-track .dot.guided').forcedColorAdjust,
      };
      host.remove();
      return result;
    });
    expect(marks).toEqual({
      guided: highlight,
      unguided: canvasText,
      regressed: ['dashed', canvasText],
      heroRegressed: ['dashed', 'none'],
      legendTick: highlight,
      band: grayText,
      adjust: 'auto',
    });
    await page.evaluate(() => {
      const btn = document.querySelector('.metric-mode-btn:has(> input[type="radio"]:checked)');
      for (let el = btn?.closest('details'); el; el = el.parentElement?.closest('details')) el.open = true;
      btn?.scrollIntoView({ block: 'center' });
    });
    const breakdownsPressed = page.locator('.metric-mode-btn:has(> input[type="radio"]:checked)').first();
    await expect(breakdownsPressed).toBeVisible();
    expect(await labelContrast(page, '.metric-mode-btn:has(> input[type="radio"]:checked)')).toBeGreaterThan(0.05);
    await page.goto('/guide.html?guide=content-vis');
    await expect(page.locator('.timeline-point').first()).toBeVisible();
    const timeline = await page.locator('.guide-chart-wrapper').first().evaluate(w => ({
      text: [...new Set([...w.querySelectorAll('text')].map(el => getComputedStyle(el).fill))],
      guided: [...new Set([...w.querySelectorAll('.timeline-marker :is(circle:not([stroke]), polygon)')].map(el => getComputedStyle(el).fill))],
    }));
    expect(timeline.text).toEqual([canvasText]);
    expect(timeline.guided).toEqual([highlight]);
  });
  test('header date comes from the testId run time, and the legend explains non-color cues', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');
    await expect(page.locator('#test-header')).toContainText('Action Date');
    await expect(page.locator('.suite-legend')).toContainText('Regressed (dashed)');
    await expect(page.locator('.suite-legend .legend-glyph')).toHaveText('⚠');
    expect(await page.locator('.legend-line.regressed').evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('dashed');
    await expect(page.locator('meta[name="text-scale"]')).toHaveAttribute('content', 'scale');
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin-when-cross-origin');
    await expect(page.locator('script[src="features-mapping.gen.js"]')).toHaveAttribute('defer', '');
    const borders = await page.locator('#eval-filter').evaluate(el => {
      const probe = document.createElement('div');
      probe.style.borderTop = '1px solid var(--color-outline)';
      document.body.append(probe);
      const outline = getComputedStyle(probe).borderTopColor;
      probe.remove();
      return { select: getComputedStyle(el).borderTopColor, outline };
    });
    expect(borders.select).toBe(borders.outline);
  });
});
