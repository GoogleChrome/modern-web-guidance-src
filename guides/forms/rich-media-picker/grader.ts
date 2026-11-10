import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Rich Media Picker Expectations: ${demoName}`, () => {

  test('The `<select>` element has `appearance: base-select` applied.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/select.*\{[^}]*appearance:\s*base-select/);
  });

  test('The `::picker(select)` pseudo-element has `appearance: base-select` applied.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/::picker\(select\)[^{]*{[^}]*appearance:\s*base-select/);
  });

  test('The `<select>` element contains a `<button>` element.', async ({ page }) => {
    await expect(page.locator('select > button')).toHaveCount(1);
    await expect(page.locator('select > button selectedcontent')).toHaveCount(1);
  });

  test('The `<button>` element contains a `<selectedcontent>` element to mirror selections.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/<selectedcontent>/);
  });

  test('The `<button>` element does not contain the legacy `<selectedoption>` element.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/appearance:\s*base-select/);
    expect(html).not.toMatch(/<selectedoption>/);
  });

  test('The `<option>` elements contain rich HTML formatting (such as `<svg>`, `<div>`, or `<span>`) instead of plaintext only.', async ({ page }) => {
    const hasRichFormatting = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('select option'));
      return options.some(opt => opt.children.length > 0);
    });
    expect(hasRichFormatting).toBe(true);
  });

  test('The `::picker(select)` popup uses anchor positioning (such as `width: anchor-size(width)`) to align itself with the button trigger.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/(?:(?:min-|max-)?(?:width|inline-size|height|block-size)\s*:[^;]*anchor-size\(|(?:top|bottom|left|right|inset[a-z-]*)\s*:[^;]*anchor\(|position-area\s*:|position-anchor\s*:|position-try)/i);
  });

  test('The implementation does not rely on custom JavaScript to replicate keyboard focus.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/appearance:\s*base-select/);
    expect(html).not.toMatch(/addEventListener\(['"]keydown['"]/);
  });

  test('Inline decorative SVG icons inside `<option>` elements define `aria-hidden="true"`.', async ({ page }) => {
    const isValid = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('select option'));
      if (!options.some((opt) => opt.children.length > 0)) return false;
      const svgs = options.flatMap((opt) => Array.from(opt.querySelectorAll('svg')));
      return svgs.every(
        (svg) =>
          svg.getAttribute('aria-hidden') === 'true' ||
          svg.getAttribute('role') === 'presentation' ||
          svg.getAttribute('role') === 'none',
      );
    });
    expect(isValid).toBe(true);
  });

  test('The `<option>` tags do not contain interactive or heading elements.', async ({ page }) => {
    const res = await page.evaluate(() => {
      const richOptions = Array.from(document.querySelectorAll('select option')).filter(
        opt => opt.children.length > 0
      );
      const hasDisallowed = richOptions.some(opt =>
        Boolean(opt.querySelector('button, a[href], input, select, textarea, h1, h2, h3, h4, h5, h6, [role="heading"], [role="button"], [role="link"]'))
      );
      return { richCount: richOptions.length, hasDisallowed };
    });
    expect(res.richCount).toBeGreaterThan(0);
    expect(res.hasDisallowed).toBe(false);
  });

  test('The checked state of an option incorporates multiple visual indicators.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const checkedBodies = [...html.matchAll(/option:checked[^{]*\{([^}]*)\}/gi)].map(m => m[1]).join(';');
    const cues = [/font-weight/i, /\bborder/i, /\boutline/i, /box-shadow/i, /background/i, /\bcontent\s*:/i, /text-decoration/i, /(?:^|[;{\s])color\s*:/i]
      .filter(re => re.test(checkedBodies));
    expect(cues.length).toBeGreaterThanOrEqual(2);
  });

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
    await page.goto(demoUrl, { waitUntil: 'domcontentloaded' });
  });

  test('The `<select>` element has a `name` attribute.', async ({ page }) => {
    await expect(page.locator('select').first()).toHaveAttribute('name', /.+/);
  });

  test('The `<select>` element has an associated `<label>`.', async ({ page }) => {
    const hasLabel = await page.evaluate(() => {
      const select = document.querySelector('select');
      return select && select.labels && select.labels.length > 0;
    });
    expect(hasLabel).toBe(true);
  });

  test('The selected `<option>` element must visibly convey its state (e.g. using a custom icon, sufficiently contrasting outline, or sufficiently contrasting background color)', async ({ page }) => {
    const select = page.locator('select').first();
    const hasVisibleSelect = (await select.count()) > 0 && (await select.isVisible());
    expect(hasVisibleSelect).toBe(true);
    await page.mouse.move(0, 0);
    await select.click();
    await page.mouse.move(0, 0);

    const stateCheck = await page.evaluate(() => {
      const selectEl = document.querySelector('select') as HTMLSelectElement | null;
      const options = selectEl ? (Array.from(selectEl.querySelectorAll('option')) as HTMLOptionElement[]) : [];
      const checkedInitial = options.find(o => o.matches(':checked')) || null;
      const target = options.find(o => !o.matches(':checked')) || null;
      if (!selectEl || !checkedInitial || !target) {
        return { error: 'Missing select or checked/unchecked options' };
      }

      const noTransitionStyle = document.createElement('style');
      noTransitionStyle.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.appendChild(noTransitionStyle);

      const originalIndex = selectEl.selectedIndex;
      try {
        if (target.matches(':focus')) {
          checkedInitial.focus();
        }

        const isPseudoVisible = (el: Element, pseudo: string) => {
          const ps = window.getComputedStyle(el, pseudo);
          if (ps.display === 'none' || ps.visibility === 'hidden' || parseFloat(ps.opacity) === 0) {
            return false;
          }
          if (!ps.content || ps.content === 'none' || ps.content === '""' || ps.content === "''") {
            return false;
          }
          return true;
        };

        const snapshot = (el: HTMLOptionElement) => {
          const s = window.getComputedStyle(el);
          return {
            bg: s.backgroundColor,
            bgImage: s.backgroundImage,
            color: s.color,
            fontWeight: s.fontWeight,
            outlineStyle: s.outlineStyle,
            outlineWidth: s.outlineWidth,
            outlineColor: s.outlineColor,
            borderColor: s.borderColor,
            borderWidth: s.borderWidth,
            borderStyle: s.borderStyle,
            boxShadow: s.boxShadow,
            checkmark: isPseudoVisible(el, '::checkmark'),
            before: isPseudoVisible(el, '::before'),
            after: isPseudoVisible(el, '::after'),
            descendants: Array.from(el.querySelectorAll('*')).map(ch => {
              const cs = window.getComputedStyle(ch);
              return {
                display: cs.display,
                visibility: cs.visibility,
                opacity: cs.opacity,
                color: cs.color,
                backgroundColor: cs.backgroundColor,
                fontWeight: cs.fontWeight,
                borderColor: cs.borderColor,
                outlineStyle: cs.outlineStyle,
                before: isPseudoVisible(ch, '::before'),
                after: isPseudoVisible(ch, '::after'),
              };
            }),
          };
        };

        const selectAppearance = window.getComputedStyle(selectEl).appearance;
        const uSnap = snapshot(target);

        selectEl.selectedIndex = options.indexOf(target);
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        checkedInitial.focus();

        const cSnap = snapshot(target);

        const hasDistinctBg = cSnap.bg !== uSnap.bg;
        const hasDistinctBgImage = cSnap.bgImage !== uSnap.bgImage;
        const hasDistinctColor = cSnap.color !== uSnap.color;
        const hasDistinctWeight = cSnap.fontWeight !== uSnap.fontWeight;
        const hasDistinctOutline =
          cSnap.outlineStyle !== 'none' &&
          parseFloat(cSnap.outlineWidth) > 0 &&
          cSnap.outlineColor !== 'rgba(0, 0, 0, 0)' &&
          (cSnap.outlineStyle !== uSnap.outlineStyle ||
            cSnap.outlineWidth !== uSnap.outlineWidth ||
            cSnap.outlineColor !== uSnap.outlineColor);
        const hasDistinctBorder =
          cSnap.borderColor !== uSnap.borderColor ||
          cSnap.borderWidth !== uSnap.borderWidth ||
          cSnap.borderStyle !== uSnap.borderStyle;
        const hasDistinctShadow = cSnap.boxShadow !== 'none' && cSnap.boxShadow !== uSnap.boxShadow;
        const hasVisibleCheckmark =
          selectAppearance === 'base-select' && cSnap.checkmark && !uSnap.checkmark;
        const hasDistinctPseudo =
          (cSnap.before && !uSnap.before) || (cSnap.after && !uSnap.after);
        const hasDistinctChild =
          cSnap.descendants.length !== uSnap.descendants.length ||
          cSnap.descendants.some((cd, i) => {
            const ud = uSnap.descendants[i];
            if (!ud) return true;
            return (
              cd.display !== ud.display ||
              cd.visibility !== ud.visibility ||
              cd.opacity !== ud.opacity ||
              cd.color !== ud.color ||
              cd.backgroundColor !== ud.backgroundColor ||
              cd.fontWeight !== ud.fontWeight ||
              cd.borderColor !== ud.borderColor ||
              cd.outlineStyle !== ud.outlineStyle ||
              cd.before !== ud.before ||
              cd.after !== ud.after
            );
          });

        return {
          selectAppearance,
          hasVisibleCue:
            hasDistinctBg ||
            hasDistinctBgImage ||
            hasDistinctColor ||
            hasDistinctWeight ||
            hasDistinctOutline ||
            hasDistinctBorder ||
            hasDistinctShadow ||
            hasVisibleCheckmark ||
            hasDistinctPseudo ||
            hasDistinctChild,
          cBg: cSnap.bg,
          uBg: uSnap.bg,
        };
      } finally {
        selectEl.selectedIndex = originalIndex;
        noTransitionStyle.remove();
      }
    });

    expect(stateCheck).not.toHaveProperty('error');
    expect(stateCheck.hasVisibleCue).toBe(true);
  });
});
