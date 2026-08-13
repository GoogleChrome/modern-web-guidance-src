import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { cGreen, cCyan, cRed, cDim } from '../../lib/colors.ts';
import { REPORT_FILE, TEST_APP_RESULTS_DIR } from '../../lib/guide-validation.ts';

export type DevPrLabel = 'gd-dev-content' | 'gd-dev-eval';

/**
 * Determines PR labels from report.md content based on recommended files.
 * Strictly matches filenames ending with:
 * - guide.md / expectations.md -> gd-dev-content
 * - task.md / grader.ts -> gd-dev-eval
 */
export function determinePrLabels(reportContent: string): DevPrLabel[] {
  const labels = new Set<DevPrLabel>();
  const targetSections = reportContent.split(/(?=^## Target: )/gm);

  for (const section of targetSections) {
    const recsMatch = section.match(/#### Actionable Recommendations:\s*\n([\s\S]*?)(?=\n---|$$)/);
    if (!recsMatch) continue;

    const recsRaw = recsMatch[1].trim();
    const lines = recsRaw.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*-\s*`?([^`:]+)/);
      if (!match) continue;

      const file = match[1].trim().toLowerCase();
      if (file.endsWith('guide.md') || file.endsWith('expectations.md')) {
        labels.add('gd-dev-content');
      } else if (file.endsWith('task.md') || file.endsWith('grader.ts')) {
        labels.add('gd-dev-eval');
      }
    }
  }

  return Array.from(labels);
}

/**
 * Orchestrates branch push, label determination, and GitHub PR creation.
 */
export async function runDevPr(guideDir: string): Promise<void> {
  const resolvedGuideDir = path.resolve(guideDir);
  const reportPath = path.join(resolvedGuideDir, TEST_APP_RESULTS_DIR, REPORT_FILE);

  if (!fs.existsSync(reportPath)) {
    console.error(cRed(`❌ No evaluation report found at ${path.relative(process.cwd(), reportPath)}.`));
    console.log(cDim(`Please run 'gd dev ${guideDir}' first to generate the evaluation report.`));
    return;
  }

  // 1. Verify git branch
  let currentBranch = '';
  try {
    currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    console.error(cRed('❌ Failed to determine current git branch.'));
    return;
  }

  if (currentBranch === 'main') {
    console.error(cRed("❌ Cannot create a Pull Request directly from the 'main' branch."));
    console.log(cDim(`Please create or switch to a feature branch first:\n  git checkout -b <branch-name>\n  gd pr ${guideDir}`));
    return;
  }

  // 2. Commit uncommitted changes if present
  const guideName = path.basename(resolvedGuideDir);
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (status) {
      console.log(cCyan(`Committing uncommitted changes for ${guideName}...`));
      execSync('git add -A', { stdio: 'inherit' });
      execSync(`git commit -m "feat(guide): update ${guideName} artifacts and evaluations"`, { stdio: 'inherit' });
    }
  } catch (err: any) {
    console.error(cRed(`❌ Failed to commit changes: ${err.message}`));
    return;
  }

  // 3. Push branch to origin
  console.log(cCyan(`Pushing branch '${currentBranch}' to origin...`));
  try {
    execSync(`git push -u origin ${currentBranch}`, { stdio: 'inherit' });
  } catch (err: any) {
    console.error(cRed(`❌ Failed to push branch '${currentBranch}' to origin.`));
    return;
  }

  // 4. Parse report.md for PR labels
  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  const labels = determinePrLabels(reportContent);

  // 5. Create Pull Request
  const prTitle = `gd dev output for ${guideName}`;
  const labelFlags = labels.map(l => `--label "${l}"`).join(' ');
  const prCmd = `gh pr create --title "${prTitle}" --body-file "${reportPath}" ${labelFlags}`.trim();

  try {
    const prUrl = execSync(prCmd, { encoding: 'utf-8' }).trim();
    console.log(`\n${cGreen('📄 Pull Request:')} ${prUrl}`);
  } catch (err: any) {
    console.error(cRed(`❌ Failed to create Pull Request via gh CLI: ${err.message}`));
  }
}
