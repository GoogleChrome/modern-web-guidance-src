import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: pnpm grade <path-to-target-file>');
    process.exit(1);
  }

  const targetFileRel = args[0];
  const targetFileAbs = path.resolve(process.cwd(), targetFileRel);

  if (!fs.existsSync(targetFileAbs)) {
    console.error(`Error: File not found: ${targetFileAbs}`);
    process.exit(1);
  }

  const graderPath = findGrader(path.dirname(targetFileAbs));
  if (!graderPath) {
    console.error('Error: Could not find grader.ts in any parent directory.');
    process.exit(1);
  }

  console.log(`Target File: ${targetFileAbs}`);
  console.log(`Grader: ${graderPath}`);

  const playwrightConfig = path.join(__dirname, 'playwright.config.ts');

  // Output the HTML report to a grade-report folder inside the target file's directory
  const outputDirPath = path.join(path.dirname(targetFileAbs), 'grade-report');

  const child = spawn('npx', ['playwright', 'test', '-c', playwrightConfig, graderPath, '--reporter=html'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TARGET_FILE: targetFileAbs,
      PLAYWRIGHT_HTML_OUTPUT_DIR: outputDirPath
    }
  });

  child.on('close', (code) => {
    // Automatically show the report if tests completed or failed
    console.log(`\nTests finished with code ${code}. Opening HTML report...`);
    const showReportChild = spawn('npx', ['playwright', 'show-report', outputDirPath], {
      stdio: 'inherit'
    });

    showReportChild.on('close', () => {
      process.exit(code || 0); // Keep original exit code
    });
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
