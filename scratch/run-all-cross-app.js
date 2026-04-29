import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const GUIDES_DIR = '/Users/paulirish/code/guidance/.worktrees/pipelinev2/guides';
const GD_BIN = 'bin/gd.ts';
const ROOT_DIR = '/Users/paulirish/code/guidance/.worktrees/pipelinev2';

function findGraderDirs(dir, results = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      findGraderDirs(fullPath, results);
    } else if (file.name === 'grader.ts') {
      results.push(dir);
    }
  }
  return results;
}

const useCaseDirs = [...new Set(findGraderDirs(GUIDES_DIR))];
console.log(`Found ${useCaseDirs.length} use cases with grader.ts`);

const failures = [];
const passes = [];

for (const useCaseDir of useCaseDirs) {
  const relativePath = path.relative(ROOT_DIR, useCaseDir);
  console.log(`\n--- Running cross-app for: ${relativePath} ---`);
  
  try {
    // GEMINI_CLI_TRUST_WORKSPACE=true node bin/gd.ts dev <path> --test-grader --cross-app
    const cmd = `GEMINI_CLI_TRUST_WORKSPACE=true node ${GD_BIN} dev ${relativePath} --test-grader --cross-app`;
    console.log(`Running: ${cmd}`);
    
    // We use stdio: 'inherit' to see progress, but we might want to capture output to detect "spurious passes"
    // Actually, if it fails, execSync will throw. 
    // The user said "log which use cases failed the cross-app check (had spurious passes)".
    // Usually, --cross-app will exit with non-zero if it finds spurious passes.
    
    execSync(cmd, { 
      cwd: ROOT_DIR, 
      stdio: 'inherit',
      env: { ...process.env, GEMINI_CLI_TRUST_WORKSPACE: 'true' }
    });
    
    passes.push(relativePath);
  } catch (error) {
    console.error(`\nFAILED: ${relativePath}`);
    failures.push(relativePath);
  }
}

console.log('\n\n=================================');
console.log('SUMMARY');
console.log(`Total: ${useCaseDirs.length}`);
console.log(`Passes: ${passes.length}`);
console.log(`Failures (Spurious Passes): ${failures.length}`);

if (failures.length > 0) {
  console.log('\nFailed Use Cases:');
  failures.forEach(f => console.log(` - ${f}`));
} else {
  console.log('\nAll use cases passed cross-app check!');
}
