import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const ITERATIONS = 30;
const CONCURRENCY = 5;
const TIMEOUT_MS = 45000; // 45 seconds hard timeout per run

interface RunResult {
  success: boolean;
  duration: number;
  hung: boolean;
  error?: string;
}

interface BenchmarkSuite {
  name: string;
  type: 'playwright' | 'puppeteer';
  graderPath: string;
  targetFile: string;
}

function getChromePath() {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  return 'google-chrome';
}

async function runSingleTest(suite: BenchmarkSuite): Promise<RunResult> {
  const startTime = performance.now();
  return new Promise((resolve) => {
    let cmd: string;
    let args: string[];
    const env = {
      ...process.env,
      TARGET_FILE: suite.targetFile,
      PUPPETEER_EXECUTABLE_PATH: getChromePath()
    };

    if (suite.type === 'playwright') {
      const playwrightBin = path.resolve('./guides/node_modules/.bin/playwright');
      const playwrightConfig = path.resolve('./guides/playwright.config.ts');
      cmd = playwrightBin;
      args = ['test', '-c', playwrightConfig, suite.graderPath];
    } else {
      cmd = 'node';
      args = ['--experimental-strip-types', suite.graderPath];
    }

    const child = spawn(cmd, args, { env, stdio: 'pipe' });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    const timeoutTimer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        success: false,
        duration: performance.now() - startTime,
        hung: true,
        error: `Timed out after ${TIMEOUT_MS}ms. Stdout:\n${stdout}\nStderr:\n${stderr}`
      });
    }, TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timeoutTimer);
      const duration = performance.now() - startTime;
      if (code === 0) {
        resolve({ success: true, duration, hung: false });
      } else {
        resolve({
          success: false,
          duration,
          hung: false,
          error: `Exit code ${code}.\nStdout:\n${stdout}\nStderr:\n${stderr}`
        });
      }
    });
  });
}

async function runBenchmark(suite: BenchmarkSuite) {
  console.log(`\n==================================================`);
  console.log(`Starting Benchmark: ${suite.name} (${suite.type.toUpperCase()})`);
  console.log(`Grader: ${suite.graderPath}`);
  console.log(`Target: ${suite.targetFile}`);
  console.log(`==================================================`);

  const results: RunResult[] = [];
  const queue = Array.from({ length: ITERATIONS }, (_, i) => i);
  let activeRuns = 0;
  let completed = 0;

  return new Promise<void>((resolve) => {
    async function next() {
      if (queue.length === 0 && activeRuns === 0) {
        printReport(suite.name, results);
        resolve();
        return;
      }

      while (queue.length > 0 && activeRuns < CONCURRENCY) {
        const index = queue.shift()!;
        activeRuns++;
        
        runSingleTest(suite).then((res) => {
          results.push(res);
          activeRuns--;
          completed++;
          process.stdout.write(`\rProgress: ${completed}/${ITERATIONS} (${res.success ? '✓' : res.hung ? '⌛' : '✗'})`);
          next();
        });
      }
    }
    next();
  });
}

function printReport(name: string, results: RunResult[]) {
  const total = results.length;
  const passes = results.filter(r => r.success).length;
  const fails = results.filter(r => !r.success && !r.hung).length;
  const hangs = results.filter(r => r.hung).length;

  const passRate = (passes / total) * 100;
  const hangRate = (hangs / total) * 100;
  const failRate = (fails / total) * 100;

  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const min = durations[0] || 0;
  const max = durations[durations.length - 1] || 0;
  const avg = total > 0 ? durations.reduce((s, d) => s + d, 0) / total : 0;
  const median = total > 0 ? durations[Math.floor(total * 0.5)] : 0;
  const p95 = total > 0 ? durations[Math.floor(total * 0.95)] : 0;

  console.log(`\n\n--- Report: ${name} ---`);
  console.log(`Total Runs:    ${total}`);
  console.log(`Pass Rate:     ${passRate.toFixed(2)}% (${passes}/${total})`);
  console.log(`Fail Rate:     ${failRate.toFixed(2)}% (${fails}/${total})`);
  console.log(`Hang Rate:     ${hangRate.toFixed(2)}% (${hangs}/${total})`);
  console.log(`Execution Time (ms):`);
  console.log(`  Min:         ${min.toFixed(1)}ms`);
  console.log(`  Max:         ${max.toFixed(1)}ms`);
  console.log(`  Avg:         ${avg.toFixed(1)}ms`);
  console.log(`  Median:      ${median.toFixed(1)}ms`);
  console.log(`  p95:         ${p95.toFixed(1)}ms`);
  console.log(`------------------------------------\n`);
}

async function main() {
  const suites: BenchmarkSuite[] = [
    // Grader 1 (Positive / Negative)
    {
      name: 'Animate Entry Exit (Playwright) - Positive',
      type: 'playwright',
      graderPath: 'guides/user-experience/animate-element-entry-exit/grader.ts',
      targetFile: 'guides/user-experience/animate-element-entry-exit/demo.html'
    },
    {
      name: 'Animate Entry Exit (Puppeteer) - Positive',
      type: 'puppeteer',
      graderPath: 'guides/user-experience/animate-element-entry-exit/grader.puppeteer.ts',
      targetFile: 'guides/user-experience/animate-element-entry-exit/demo.html'
    },
    {
      name: 'Animate Entry Exit (Playwright) - Negative',
      type: 'playwright',
      graderPath: 'guides/user-experience/animate-element-entry-exit/grader.ts',
      targetFile: 'guides/user-experience/animate-element-entry-exit/negative-demo.html'
    },
    {
      name: 'Animate Entry Exit (Puppeteer) - Negative',
      type: 'puppeteer',
      graderPath: 'guides/user-experience/animate-element-entry-exit/grader.puppeteer.ts',
      targetFile: 'guides/user-experience/animate-element-entry-exit/negative-demo.html'
    },
    // Grader 2 (Positive / Negative)
    {
      name: 'Select Menu (Playwright) - Positive',
      type: 'playwright',
      graderPath: 'guides/forms/select-menu-interaction/grader.ts',
      targetFile: 'guides/forms/select-menu-interaction/demo.html'
    },
    {
      name: 'Select Menu (Puppeteer) - Positive',
      type: 'puppeteer',
      graderPath: 'guides/forms/select-menu-interaction/grader.puppeteer.ts',
      targetFile: 'guides/forms/select-menu-interaction/demo.html'
    },
    {
      name: 'Select Menu (Playwright) - Negative',
      type: 'playwright',
      graderPath: 'guides/forms/select-menu-interaction/grader.ts',
      targetFile: 'guides/forms/select-menu-interaction/negative-demo.html'
    },
    {
      name: 'Select Menu (Puppeteer) - Negative',
      type: 'puppeteer',
      graderPath: 'guides/forms/select-menu-interaction/grader.puppeteer.ts',
      targetFile: 'guides/forms/select-menu-interaction/negative-demo.html'
    },
    // Grader 3 (Positive / Negative)
    {
      name: 'Animate Top Layer (Playwright) - Positive',
      type: 'playwright',
      graderPath: 'guides/user-experience/animate-to-from-top-layer/grader.ts',
      targetFile: 'guides/user-experience/animate-to-from-top-layer/demo.html'
    },
    {
      name: 'Animate Top Layer (Puppeteer) - Positive',
      type: 'puppeteer',
      graderPath: 'guides/user-experience/animate-to-from-top-layer/grader.puppeteer.ts',
      targetFile: 'guides/user-experience/animate-to-from-top-layer/demo.html'
    },
    {
      name: 'Animate Top Layer (Playwright) - Negative',
      type: 'playwright',
      graderPath: 'guides/user-experience/animate-to-from-top-layer/grader.ts',
      targetFile: 'guides/user-experience/animate-to-from-top-layer/negative-demo.html'
    },
    {
      name: 'Animate Top Layer (Puppeteer) - Negative',
      type: 'puppeteer',
      graderPath: 'guides/user-experience/animate-to-from-top-layer/grader.puppeteer.ts',
      targetFile: 'guides/user-experience/animate-to-from-top-layer/negative-demo.html'
    }
  ];

  for (const suite of suites) {
    await runBenchmark(suite);
  }
}

main().catch(console.error);
