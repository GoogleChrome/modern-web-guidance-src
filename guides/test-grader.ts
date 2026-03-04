import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cRed = (str: string) => `\x1b[31m${str}\x1b[0m`;
const cGreen = (str: string) => `\x1b[32m${str}\x1b[0m`;
const cYellow = (str: string) => `\x1b[33m${str}\x1b[0m`;
const cCyan = (str: string) => `\x1b[36m${str}\x1b[0m`;
const cBold = (str: string) => `\x1b[1m${str}\x1b[0m`;

function findGrader(startDir: string): string | null {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) {
    const graderPath = path.join(currentDir, 'grader.ts');
    if (fs.existsSync(graderPath)) {
      return graderPath;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

async function runPlaywright(targetFileAbs: string, graderPath: string, htmlOutputDir: string): Promise<any> {
  const playwrightConfig = path.join(__dirname, 'playwright.config.ts');
  const tmpJson = path.join(os.tmpdir(), `pw-results-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
  
  return new Promise((resolve, reject) => {
    // Run playwright using both json and html reporters
    const child = spawn('pnpm', ['--filter', 'guides', 'exec', 'playwright', 'test', '-c', playwrightConfig, graderPath, '--reporter=json,html'], {
      stdio: 'ignore', // Ignore stdout to not mix playwright logs visually, we will parse the json
      env: {
        ...process.env,
        TARGET_FILE: targetFileAbs,
        PLAYWRIGHT_JSON_OUTPUT_NAME: tmpJson,
        PLAYWRIGHT_HTML_OUTPUT_DIR: htmlOutputDir
      }
    });

    child.on('close', () => {
      if (!fs.existsSync(tmpJson)) {
        reject(new Error(`Playwright did not produce a JSON report at ${tmpJson}`));
        return;
      }
      try {
        const json = JSON.parse(fs.readFileSync(tmpJson, 'utf-8'));
        fs.promises.unlink(tmpJson).catch(() => {}); // cleanup silently
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });

    child.on('error', reject);
  });
}

export async function testGrader(targetDirRel: string) {
  const targetDirAbs = path.resolve(process.cwd(), targetDirRel);
  if (!fs.existsSync(targetDirAbs)) {
    console.error(`Error: Directory not found: ${targetDirAbs}`);
    process.exit(1);
  }

  const demoPath = path.join(targetDirAbs, 'demo.html');
  const negativePath = path.join(targetDirAbs, 'negative-demo.html');
  const graderPath = findGrader(targetDirAbs);

  if (!graderPath) {
    console.error('Error: Could not find grader.ts in the directory or any parents.');
    process.exit(1);
  }
  if (!fs.existsSync(demoPath)) {
    console.error(`Error: Missing demo.html in ${targetDirAbs}`);
    process.exit(1);
  }
  if (!fs.existsSync(negativePath)) {
    console.error(`Error: Missing negative-demo.html in ${targetDirAbs}`);
    process.exit(1);
  }

  console.log(cCyan(`Testing grader against demo.html and negative-demo.html in:\n  ${targetDirAbs}\n`));

  let hasError = false;
  let demoFailed = false;
  let negativeFailed = false;

  const demoParams = {
    file: demoPath,
    outDir: path.join(targetDirAbs, 'grade-report', 'demo')
  };
  const negativeParams = {
    file: negativePath,
    outDir: path.join(targetDirAbs, 'grade-report', 'negative')
  };

  // 1. Test against demo.html
  console.log(cYellow(`Running against demo.html... (Expecting 100% pass)`));
  try {
    const demoResults = await runPlaywright(demoParams.file, graderPath, demoParams.outDir);
    const unexpected = demoResults.stats?.unexpected || 0;
    const expected = demoResults.stats?.expected || 0;
    
    if (expected === 0 && unexpected === 0) {
       console.log(cYellow(`⚠️  Warning: No tests were run for demo.html`));
       hasError = true;
       demoFailed = true;
    }
    
    if (unexpected > 0) {
      console.log(cRed(`❌ demo.html failed ${unexpected} tests!`));
      demoResults.suites?.forEach((suite: any) => printFailingSpecs(suite));
      hasError = true;
      demoFailed = true;
    } else if (expected > 0) {
      console.log(cGreen(`✅ demo.html passed all ${expected} tests.`));
    }
  } catch (err: any) {
    console.error(cRed(`Failed to test demo.html: ${err.message}`));
    hasError = true;
    demoFailed = true;
  }

  console.log('');

  // 2. Test against negative-demo.html
  console.log(cYellow(`Running against negative-demo.html... (Expecting 100% fail)`));
  try {
    const negativeResults = await runPlaywright(negativeParams.file, graderPath, negativeParams.outDir);
    const expected = negativeResults.stats?.expected || 0; // "expected" means tests passed in Playwright (bad for us)
    const unexpected = negativeResults.stats?.unexpected || 0; // "unexpected" means tests failed (good for us)
    
    if (expected > 0) {
      console.log(cRed(`❌ negative-demo.html incorrectly passed ${expected} tests!`));
      negativeResults.suites?.forEach((suite: any) => printPassingSpecs(suite));
      hasError = true;
      negativeFailed = true;
    } else if (unexpected > 0) {
      console.log(cGreen(`✅ negative-demo.html failed all ${unexpected} tests correctly.`));
    } else {
       console.log(cYellow(`⚠️  Warning: No tests were run for negative-demo.html`));
       hasError = true;
       negativeFailed = true;
    }
  } catch (err: any) {
    console.error(cRed(`Failed to test negative-demo.html: ${err.message}`));
    hasError = true;
    negativeFailed = true;
  }

  console.log('');
  if (hasError) {
    console.log(cBold(cRed(`Failed! The grader needs calibration.`)));
    if (demoFailed) {
        console.log(`\nView demo.html report:\n  pnpm --filter guides exec playwright show-report ${path.relative(process.cwd(), demoParams.outDir)}`);
    }
    if (negativeFailed) {
        console.log(`\nView negative-demo.html report:\n  pnpm --filter guides exec playwright show-report ${path.relative(process.cwd(), negativeParams.outDir)}`);
    }
    process.exit(1);
  } else {
    console.log(cBold(cGreen(`Success! The grader is perfectly calibrated.`)));
    // Optional: could still offer to view them if desired even when perfectly calibrated
    process.exit(0);
  }
}

function printFailingSpecs(suite: any, prefix = '') {
  if (suite.specs) {
    for (const spec of suite.specs) {
      if (!spec.ok) { // meaning it failed/was unexpected
        console.log(cRed(`  - Failed: ${prefix}${spec.title}`));
      }
    }
  }
  if (suite.suites) {
    for (const child of suite.suites) {
      printFailingSpecs(child, `${prefix}${child.title} > `);
    }
  }
}

function printPassingSpecs(suite: any, prefix = '') {
  if (suite.specs) {
    for (const spec of suite.specs) {
      if (spec.ok) {  // meaning it passed/was expected
        console.log(cRed(`  - Passed (should have failed): ${prefix}${spec.title}`));
      }
    }
  }
  if (suite.suites) {
    for (const child of suite.suites) {
      printPassingSpecs(child, `${prefix}${child.title} > `);
    }
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  testGrader(args[0] || process.cwd()).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
