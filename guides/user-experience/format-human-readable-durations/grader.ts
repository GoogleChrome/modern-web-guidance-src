import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Temporal Duration Balancing Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Inject tracking and mocking script before anything else loads
    await page.addInitScript(() => {
      (window as any).__temporalCalls = {
        from: 0,
        round: 0,
        constructorCalled: 0,
        roundOptions: []
      };

      // Mock Temporal if it doesn't exist, or wrap it if it does
      const createMockDuration = (props: any) => ({
        hours: props.hours || 0,
        minutes: props.minutes || 0,
        seconds: props.seconds || 0,
        round: (options: any) => {
          (window as any).__temporalCalls.round++;
          (window as any).__temporalCalls.roundOptions.push(options);
          
          let h = props.hours || 0;
          let m = props.minutes || 0;
          let s = props.seconds || 0;
          
          if (options.largestUnit === 'hours') {
            m += Math.floor(s / 60);
            s %= 60;
            h += Math.floor(m / 60);
            m %= 60;
          } else if (options.largestUnit === 'minutes') {
            m += Math.floor(s / 60);
            s %= 60;
          }
          
          return {
            hours: h, minutes: m, seconds: s,
            toString: () => `PT${h}H${m}M${s}S`
          };
        },
        toString: () => `PT${props.hours || 0}H${props.minutes || 0}M${props.seconds || 0}S`
      });

      const TemporalMock = {
        Duration: function() {
          (window as any).__temporalCalls.constructorCalled++;
          return createMockDuration({});
        }
      } as any;
      
      TemporalMock.Duration.from = (props: any) => {
        (window as any).__temporalCalls.from++;
        return createMockDuration(props);
      };

      if (typeof (window as any).Temporal === 'undefined') {
        (window as any).Temporal = TemporalMock;
      } else {
        // If it exists, wrap it
        const originalFrom = (window as any).Temporal.Duration.from;
        (window as any).Temporal.Duration.from = function(props: any) {
          (window as any).__temporalCalls.from++;
          return originalFrom.apply(this, [props]);
        };
        const originalRound = (window as any).Temporal.Duration.prototype.round;
        (window as any).Temporal.Duration.prototype.round = function(options: any) {
          (window as any).__temporalCalls.round++;
          (window as any).__temporalCalls.roundOptions.push(options);
          return originalRound.apply(this, [options]);
        };
      }
    });

    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('Implementation MUST feature-detect Temporal API using typeof', async ({ page }) => {
    const content = fs.readFileSync(filePath, 'utf8');
    // We check if the source code contains the mandatory feature detection string
    expect(content).toContain("typeof Temporal === 'undefined'");
  });

  test('Implementation MUST use Temporal.Duration.from() instead of constructor', async ({ page }) => {
    // Interact to trigger calculation
    const minutesInput = page.locator('#minutesInput');
    if (await minutesInput.isVisible()) {
      await minutesInput.fill('150');
      const calcBtn = page.locator('#calcBtn');
      if (await calcBtn.isVisible()) await calcBtn.click();
    }
    
    const calls = await page.evaluate(() => (window as any).__temporalCalls);
    expect(calls.from).toBeGreaterThan(0);
    expect(calls.constructorCalled).toBe(0);
  });

  test('Implementation MUST use .round() with largestUnit for balancing', async ({ page }) => {
    // Interact to trigger calculation with balancing
    const minutesInput = page.locator('#minutesInput');
    if (await minutesInput.isVisible()) {
      await minutesInput.fill('150');
      
      // For demo.html, we might need to select "Hours" as largest unit
      const hoursRadio = page.locator('input[value="hours"]');
      if (await hoursRadio.isVisible()) {
        await hoursRadio.check();
      }
      
      const calcBtn = page.locator('#calcBtn');
      if (await calcBtn.isVisible()) await calcBtn.click();
    }

    const calls = await page.evaluate(() => (window as any).__temporalCalls);
    expect(calls.round).toBeGreaterThan(0);
    expect(calls.roundOptions[0]).toHaveProperty('largestUnit');
  });

  test('Implementation MUST NOT use legacy manual calculations for balancing', async ({ page }) => {
    // If output is balanced but round() was not called, it's legacy math
    const minutesInput = page.locator('#minutesInput');
    if (await minutesInput.isVisible()) {
      await minutesInput.fill('150');
      const calcBtn = page.locator('#calcBtn');
      if (await calcBtn.isVisible()) await calcBtn.click();
    }

    // Wait for any output to appear
    await page.waitForTimeout(100); 
    
    const calls = await page.evaluate(() => (window as any).__temporalCalls);
    const outputText = await page.evaluate(() => {
        const body = document.body.innerText;
        return body;
    });

    // If the text contains balanced units ("2 hour" or "2 hr"), ensure round() was called
    if (outputText.includes('2 hour') || outputText.includes('2 hr')) {
        expect(calls.round).toBeGreaterThan(0);
    } else {
        // If it's not balanced yet, it might be because the user didn't select balancing
        // But for negative-demo, it IS balanced manually.
        // So we check if it's balanced.
        if (outputText.match(/2\s*hour/i)) {
             expect(calls.round).toBeGreaterThan(0);
        }
    }
  });

  test('Implementation MUST NOT rely on toString() for user-facing text', async ({ page }) => {
    const minutesInput = page.locator('#minutesInput');
    if (await minutesInput.isVisible()) {
      await minutesInput.fill('90');
      const calcBtn = page.locator('#calcBtn');
      if (await calcBtn.isVisible()) await calcBtn.click();
    }

    const outputText = await page.evaluate(() => {
        // Get the main output area text
        const humanValue = document.getElementById('humanValue')?.innerText;
        const output = document.getElementById('output')?.innerText;
        return humanValue || output || "";
    });

    // ISO 8601 strings look like PT...
    expect(outputText).not.toMatch(/PT\d+H/);
  });

  test('Implementation MUST NOT attempt to modify Temporal.Duration instances directly', async ({ page }) => {
    const content = fs.readFileSync(filePath, 'utf8');
    // Check for assignment to duration properties which should be read-only
    // Brittle but the negative demo does exactly this: dur.hours = h;
    const assignmentRegex = /\.hours\s*=/;
    expect(content).not.toMatch(assignmentRegex);
  });

});
