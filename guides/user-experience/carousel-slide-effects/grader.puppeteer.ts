import test, { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer-core';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

function getChromePath() {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (process.platform === 'win32') {
    return 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe';
  }
  return 'google-chrome';
}

describe(`Carousel Item Effects Expectations: ${demoName}`, () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await puppeteer.launch({
      executablePath: getChromePath(),
      headless: true,
    });
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      try {
        const url = request.url();
        if (url.startsWith('http://localhost/')) {
          const requestPath = new URL(url).pathname;
          const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

          if (fs.existsSync(localFilePath)) {
            let contentType = 'text/html';
            if (localFilePath.endsWith('.css')) {
              contentType = 'text/css';
            } else if (localFilePath.endsWith('.js')) {
              contentType = 'application/javascript';
            }
            const body = fs.readFileSync(localFilePath);
            await request.respond({
              status: 200,
              contentType,
              body,
            });
          } else {
            await request.continue();
          }
        } else {
          await request.continue();
        }
      } catch (err) {
        console.error('Interception error:', err);
        try {
          await request.abort();
        } catch (abortErr) {
          console.error('Failed to abort request:', abortErr);
        }
      }
    });

    await page.goto(demoUrl);
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  it(`MANDATORY: The agent has defined an @keyframes block that defines states for start, center, and end.`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasKeyframes = /@keyframes\s+[\w-]+\s*\{[\s\S]*?(0%|from)[\s\S]*?50%[\s\S]*?(100%|to)[\s\S]*?\}/i.test(html);
    assert.strictEqual(hasKeyframes, true, 'Should define @keyframes with start, center, and end states');
  });

  it(`MANDATORY: The agent has applied the animation to the carousel items using animation-timeline: view() or view(inline).`, async () => {
    const animationTimeline = await page.evaluate(() => {
      const scroller = document.querySelector('.scroller');
      if (!scroller) return 'none';
      const descendants = scroller.querySelectorAll('*');
      for (const el of descendants) {
        const timeline = (window.getComputedStyle(el) as any).animationTimeline;
        if (timeline && timeline.includes('view')) return timeline;
      }
      return 'none';
    });
    assert.match(animationTimeline, /view/, 'Animation timeline should contain "view"');
  });

  it(`MANDATORY: The agent has used scroll-snap-type on the scroller and scroll-snap-align on the items.`, async () => {
    const snapData = await page.evaluate(() => {
      const scroller = document.querySelector('.scroller');
      if (!scroller) return { type: 'none', align: 'none' };
      const type = window.getComputedStyle(scroller).scrollSnapType;

      let align = 'none';
      const descendants = scroller.querySelectorAll('*');
      for (const el of descendants) {
        const a = window.getComputedStyle(el).scrollSnapAlign;
        if (a && a !== 'none') {
          align = a;
          break;
        }
      }
      return { type, align };
    });
    assert.notStrictEqual(snapData.type, 'none', 'scroll-snap-type should not be none');
    assert.notStrictEqual(snapData.align, 'none', 'scroll-snap-align should not be none');
  });

  it(`MANDATORY: The implementation includes feature detection using @supports for scroll-driven animations.`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    assert.ok(html.includes('@supports'), 'HTML should contain @supports');
  });

  it(`MANDATORY: The implementation respects user preferences for reduced motion using @media (prefers-reduced-motion: no-preference).`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    assert.ok(html.includes('prefers-reduced-motion'), 'HTML should contain prefers-reduced-motion');
  });

});
