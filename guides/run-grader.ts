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

export function findGrader(startDir: string): string | null {
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

export interface PlaywrightOptions {
  targetFileAbs: string;
  graderPath: string;
  reporters: string[];
  htmlOutputDir?: string;
  jsonOutputName?: string;
  stdio?: 'inherit' | 'ignore' | 'pipe';
}

export function executePlaywright(opts: PlaywrightOptions) {
  const playwrightConfig = path.join(__dirname, 'playwright.config.ts');
  const reporterArgs = opts.reporters.length > 0 ? ['--reporter=' + opts.reporters.join(',')] : [];
  
  return spawn('pnpm', ['--silent', '--filter', 'guides', 'exec', 'playwright', 'test', '-c', playwrightConfig, opts.graderPath, ...reporterArgs], {
    stdio: opts.stdio || 'inherit',
    env: {
      ...process.env,
      TARGET_FILE: opts.targetFileAbs,
      ...(opts.htmlOutputDir ? { PLAYWRIGHT_HTML_OUTPUT_DIR: opts.htmlOutputDir } : {}),
      ...(opts.jsonOutputName ? { PLAYWRIGHT_JSON_OUTPUT_NAME: opts.jsonOutputName } : {})
    }
  });
}

async function gradeFile(targetFileAbs: string) {
  const graderPath = findGrader(path.dirname(targetFileAbs));
  if (!graderPath) {
    console.error('Error: Could not find grader.ts in any parent directory.');
    process.exit(1);
  }

  console.log(`Target File: ${targetFileAbs}`);
  console.log(`Grader: ${graderPath}`);

  // Output the HTML report to a grade-report folder inside the target file's directory
  const outputDirPath = path.join(path.dirname(targetFileAbs), 'grade-report');

  const child = executePlaywright({
    targetFileAbs,
    graderPath,
    reporters: ['html'],
    htmlOutputDir: outputDirPath,
    stdio: 'inherit'
  });

  return new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      // Automatically show the report if tests completed or failed
      console.log(`\nTests finished with code ${code}. Opening HTML report...`);
      const showReportChild = spawn('pnpm', ['--filter', 'guides', 'exec', 'playwright', 'show-report', outputDirPath], {
        stdio: 'inherit'
      });

      showReportChild.on('close', () => {
        process.exit(code || 0); // Keep original exit code
      });
    });
  });
}

async function runPlaywright(targetFileAbs: string, graderPath: string, htmlOutputDir: string, stdio: 'inherit' | 'ignore' = 'inherit'): Promise<any> {
  const tmpJson = path.join(os.tmpdir(), `pw-results-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
  
  return new Promise((resolve, reject) => {
    const child = executePlaywright({
      targetFileAbs,
      graderPath,
      reporters: ['json', 'html'],
      htmlOutputDir,
      jsonOutputName: tmpJson,
      stdio
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

export async function testGrader(targetDirAbs: string) {
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
  console.log(cYellow(`\nRunning against demo.html... (Expecting 100% pass)`));
  try {
    const demoResults = await runPlaywright(demoParams.file, graderPath, demoParams.outDir, 'inherit');
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

  if (hasError) {
    console.log(cYellow(`Skipping negative-demo.html run due to failures in demo.html`));
  } else {
    // 2. Test against negative-demo.html
    console.log(cYellow(`Running against negative-demo.html... (Expecting 100% fail)`));
    try {
      const negativeResults = await runPlaywright(negativeParams.file, graderPath, negativeParams.outDir, 'ignore');
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
    process.exit(0);
  }
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: pnpm grade <path-to-html-file-or-guide-directory>');
    process.exit(1);
  }

  const targetPathRel = args[0];
  const targetPathAbs = path.resolve(process.cwd(), targetPathRel);

  if (!fs.existsSync(targetPathAbs)) {
    console.error(`Error: Path not found: ${targetPathAbs}`);
    process.exit(1);
  }

  const stat = fs.statSync(targetPathAbs);
  if (stat.isDirectory()) {
    console.log(cCyan(`🧪 Directory detected. Running calibration suite on the grader (demo.html & negative-demo.html)...`));
    await testGrader(targetPathAbs);
  } else if (targetPathAbs.endsWith('.html')) {
    console.log(cCyan(`📄 HTML file detected. Grading artifact and opening visual report...`));
    await gradeFile(targetPathAbs);
  } else {
    console.error(`Error: Expected a directory or an .html file.`);
    process.exit(1);
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
