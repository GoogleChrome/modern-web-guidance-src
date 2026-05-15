import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { testGrader } from '../guides/run-grader.ts';

const TEST_GUIDES = [
  {
    name: 'animate-element-entry-exit',
    dir: 'guides/user-experience/animate-element-entry-exit',
    playwrightGrader: 'guides/user-experience/animate-element-entry-exit/grader.ts',
    puppeteerGrader: 'guides/user-experience/animate-element-entry-exit/grader.puppeteer.ts',
    demo: 'guides/user-experience/animate-element-entry-exit/demo.html',
    negativeDemo: 'guides/user-experience/animate-element-entry-exit/negative-demo.html'
  },
  {
    name: 'select-menu-interaction',
    dir: 'guides/forms/select-menu-interaction',
    playwrightGrader: 'guides/forms/select-menu-interaction/grader.ts',
    puppeteerGrader: 'guides/forms/select-menu-interaction/grader.puppeteer.ts',
    demo: 'guides/forms/select-menu-interaction/demo.html',
    negativeDemo: 'guides/forms/select-menu-interaction/negative-demo.html'
  },
  {
    name: 'animate-to-from-top-layer',
    dir: 'guides/user-experience/animate-to-from-top-layer',
    playwrightGrader: 'guides/user-experience/animate-to-from-top-layer/grader.ts',
    puppeteerGrader: 'guides/user-experience/animate-to-from-top-layer/grader.puppeteer.ts',
    demo: 'guides/user-experience/animate-to-from-top-layer/demo.html',
    negativeDemo: 'guides/user-experience/animate-to-from-top-layer/negative-demo.html'
  },
  {
    name: 'accessible-error-announcement',
    dir: 'guides/accessibility/accessible-error-announcement',
    playwrightGrader: 'guides/accessibility/accessible-error-announcement/grader.ts',
    puppeteerGrader: 'guides/accessibility/accessible-error-announcement/grader.puppeteer.ts',
    demo: 'guides/accessibility/accessible-error-announcement/demo.html',
    negativeDemo: 'guides/accessibility/accessible-error-announcement/negative-demo.html'
  },
  {
    name: 'autofill-address-form',
    dir: 'guides/forms/autofill-address-form',
    playwrightGrader: 'guides/forms/autofill-address-form/grader.ts',
    puppeteerGrader: 'guides/forms/autofill-address-form/grader.puppeteer.ts',
    demo: 'guides/forms/autofill-address-form/demo.html',
    negativeDemo: 'guides/forms/autofill-address-form/negative-demo.html'
  },
  {
    name: 'carousel-slide-effects',
    dir: 'guides/user-experience/carousel-slide-effects',
    playwrightGrader: 'guides/user-experience/carousel-slide-effects/grader.ts',
    puppeteerGrader: 'guides/user-experience/carousel-slide-effects/grader.puppeteer.ts',
    demo: 'guides/user-experience/carousel-slide-effects/demo.html',
    negativeDemo: 'guides/user-experience/carousel-slide-effects/negative-demo.html'
  },
  {
    name: 'anchor-positioning-tab-underline',
    dir: 'guides/user-experience/anchor-positioning-tab-underline',
    playwrightGrader: 'guides/user-experience/anchor-positioning-tab-underline/grader.ts',
    puppeteerGrader: 'guides/user-experience/anchor-positioning-tab-underline/grader.puppeteer.ts',
    demo: 'guides/user-experience/anchor-positioning-tab-underline/demo.html',
    negativeDemo: 'guides/user-experience/anchor-positioning-tab-underline/negative-demo.html'
  },
  {
    name: 'declarative-button-actions',
    dir: 'guides/user-experience/declarative-button-actions',
    playwrightGrader: 'guides/user-experience/declarative-button-actions/grader.ts',
    puppeteerGrader: 'guides/user-experience/declarative-button-actions/grader.puppeteer.ts',
    demo: 'guides/user-experience/declarative-button-actions/demo.html',
    negativeDemo: 'guides/user-experience/declarative-button-actions/negative-demo.html'
  }
];

const ITERATIONS = 20;
const CONCURRENCY = 8; // We have 8 guides, so concurrency 8 runs all of them in parallel

function getChromePath() {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  return 'google-chrome';
}

async function runPuppeteerProcess(graderPath: string, targetFile: string): Promise<boolean> {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      TARGET_FILE: targetFile,
      PUPPETEER_EXECUTABLE_PATH: getChromePath()
    };
    const child = spawn('node', ['--experimental-strip-types', graderPath], { env, stdio: 'ignore' });
    child.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function runPuppeteerCalibration(graderPath: string, demoPath: string, negativeDemoPath: string): Promise<{ success: boolean; duration: number; error: string | null }> {
  const start = Date.now();
  try {
    const demoPass = await runPuppeteerProcess(graderPath, demoPath);
    if (!demoPass) {
      return { success: false, duration: Date.now() - start, error: 'demo.html failed' };
    }
    
    const negPass = await runPuppeteerProcess(graderPath, negativeDemoPath);
    if (negPass) {
      return { success: false, duration: Date.now() - start, error: 'negative-demo.html passed (should fail)' };
    }
    
    return { success: true, duration: Date.now() - start, error: null };
  } catch (err: any) {
    return { success: false, duration: Date.now() - start, error: err.message };
  }
}

async function limitConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  const running: Promise<void>[] = [];
  
  for (const task of tasks) {
    const p = (async () => {
      const res = await task();
      results.push(res);
    })();
    running.push(p);
    p.then(() => {
      running.splice(running.indexOf(p), 1);
    });
    if (running.length >= limit) {
      await Promise.race(running);
    }
  }
  await Promise.all(running);
  return results;
}

interface BenchmarkStats {
  total: number;
  passes: number;
  fails: number;
  durations: number[];
}

function initStats(): BenchmarkStats {
  return { total: 0, passes: 0, fails: 0, durations: [] };
}

async function runSuite(type: 'playwright' | 'puppeteer') {
  console.log(`\n==================================================`);
  console.log(`Starting Stress Test Suite: ${type.toUpperCase()}`);
  console.log(`Iterations: ${ITERATIONS}, Concurrency: ${CONCURRENCY}`);
  console.log(`==================================================`);

  const statsMap = new Map<string, BenchmarkStats>();
  for (const g of TEST_GUIDES) {
    statsMap.set(g.name, initStats());
  }

  for (let iter = 1; iter <= ITERATIONS; iter++) {
    process.stdout.write(`\rIteration ${iter}/${ITERATIONS}...`);
    
    const tasks = TEST_GUIDES.map(guide => async () => {
      const stats = statsMap.get(guide.name)!;
      stats.total++;
      
      let success = false;
      let duration = 0;
      let error = null;

      if (type === 'playwright') {
        const start = Date.now();
        try {
          const result = await testGrader(guide.dir, true);
          success = result.success;
          duration = Date.now() - start;
        } catch (err: any) {
          success = false;
          duration = Date.now() - start;
          error = err.message;
        }
      } else {
        const result = await runPuppeteerCalibration(guide.puppeteerGrader, guide.demo, guide.negativeDemo);
        success = result.success;
        duration = result.duration;
        error = result.error;
      }

      stats.durations.push(duration);
      if (success) {
        stats.passes++;
      } else {
        stats.fails++;
        // Print failure immediately if verbose or just track it
      }
    });

    await limitConcurrency(tasks, CONCURRENCY);
  }

  console.log('\n\n--- Final Report ---');
  for (const [name, stats] of statsMap) {
    const passRate = (stats.passes / stats.total) * 100;
    const sortedDurations = stats.durations.sort((a, b) => a - b);
    const avg = stats.durations.reduce((s, d) => s + d, 0) / stats.total;
    const median = sortedDurations[Math.floor(stats.total * 0.5)];
    const p95 = sortedDurations[Math.floor(stats.total * 0.95)];

    console.log(`Guide: ${name}`);
    console.log(`  Pass Rate: ${passRate.toFixed(2)}% (${stats.passes}/${stats.total})`);
    console.log(`  Avg Time:  ${(avg / 1000).toFixed(2)}s`);
    console.log(`  Median:    ${(median / 1000).toFixed(2)}s`);
    console.log(`  p95:       ${(p95 / 1000).toFixed(2)}s`);
    console.log('--------------------');
  }
}

async function main() {
  // Run Playwright suite
  await runSuite('playwright');
  
  // Run Puppeteer suite
  await runSuite('puppeteer');
}

main().catch(console.error);
