import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { cGreen, cCyan, cRed, cDim } from '../../lib/colors.ts';
import { REPORT_FILE, TEST_APP_RESULTS_DIR } from '../../lib/guide-validation.ts';

export type DevPrLabel = 'gd-dev-content' | 'gd-dev-eval';
export const ALL_DEV_PR_LABELS: readonly DevPrLabel[] = ['gd-dev-content', 'gd-dev-eval'];

export const devPrCli = {
  getCurrentBranch(): string {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  },
  commitChanges(guideDir: string, guideName: string): void {
    const status = execSync(`git status --porcelain "${guideDir}"`, { encoding: 'utf-8' }).trim();
    if (status) {
      console.log(cCyan(`Committing uncommitted changes for ${guideName}...`));
      execSync(`git add "${guideDir}"`, { stdio: 'inherit' });
      execSync(`git commit -m "feat(guide): update ${guideName} artifacts and evaluations"`, { stdio: 'inherit' });
    }
  },
  pushBranch(branch: string): void {
    console.log(cCyan(`Pushing branch '${branch}' to origin...`));
    execSync(`git push -u origin "${branch}"`, { stdio: 'inherit' });
  },
  createAndCheckoutBranch(branchName: string): void {
    console.log(cCyan(`Switching to new branch '${branchName}'...`));
    try {
      execSync(`git checkout -b "${branchName}"`, { stdio: 'inherit' });
    } catch {
      try {
        execSync(`git checkout "${branchName}"`, { stdio: 'inherit' });
      } catch {
        const uniqueBranch = `${branchName}-${Date.now()}`;
        execSync(`git checkout -b "${uniqueBranch}"`, { stdio: 'inherit' });
      }
    }
  },
  viewPr(branch: string): { number: number; url: string; state: string; labels: { name: string }[] } | null {
    try {
      const output = execSync(`gh pr view "${branch}" --json number,url,state,labels`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return output ? JSON.parse(output) : null;
    } catch {
      return null;
    }
  },
  createPr(title: string, bodyPath: string, labels: DevPrLabel[]): string {
    const labelFlags = labels.map(l => `--label "${l}"`).join(' ');
    return execSync(`gh pr create --draft --title "${title}" --body-file "${bodyPath}" ${labelFlags}`.trim(), {
      encoding: 'utf-8',
    }).trim();
  },
  editPr(prNumber: number, bodyPath: string, addLabels: DevPrLabel[], removeLabels: DevPrLabel[]): void {
    const flags: string[] = [`--body-file "${bodyPath}"`];
    if (addLabels.length > 0) flags.push(`--add-label "${addLabels.join(',')}"`);
    if (removeLabels.length > 0) flags.push(`--remove-label "${removeLabels.join(',')}"`);
    execSync(`gh pr edit ${prNumber} ${flags.join(' ')}`.trim(), { stdio: 'inherit' });
  },
};

/**
 * Computes which gd-dev labels to add or remove based on new recommendations vs existing PR labels.
 */
export function computeLabelDiff(
  newLabels: DevPrLabel[],
  existingLabels: { name: string }[] = []
): { addLabels: DevPrLabel[]; removeLabels: DevPrLabel[] } {
  const current = new Set((existingLabels || []).map(l => l.name));
  const next = new Set(newLabels);
  return {
    addLabels: newLabels.filter(l => !current.has(l)),
    removeLabels: ALL_DEV_PR_LABELS.filter(l => current.has(l) && !next.has(l)),
  };
}

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
    const recsMatch = section.match(/#### Actionable Recommendations:\s*\n([\s\S]*?)(?=\n---|$)/);
    if (!recsMatch) continue;

    const lines = recsMatch[1].trim().split('\n');
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
 * Orchestrates branch push, label determination, and GitHub PR creation or update.
 */
export async function runDevPr(guideDir: string): Promise<boolean> {
  const resolvedGuideDir = path.resolve(guideDir);
  const reportPath = path.join(resolvedGuideDir, TEST_APP_RESULTS_DIR, REPORT_FILE);

  if (!fs.existsSync(reportPath)) {
    console.error(cRed(`❌ No evaluation report found at ${path.relative(process.cwd(), reportPath)}.`));
    console.log(cDim(`Please run 'gd dev ${guideDir}' first to generate the evaluation report.`));
    return false;
  }

  // 1. Verify and resolve git branch (auto-create branch if currently on main)
  const guideName = path.basename(resolvedGuideDir);
  let currentBranch = '';
  try {
    currentBranch = devPrCli.getCurrentBranch();
  } catch {
    console.error(cRed('❌ Failed to determine current git branch.'));
    return false;
  }

  if (currentBranch === 'main') {
    const targetBranch = `gd-dev/${guideName}`;
    console.log(cCyan(`Currently on 'main'. Automatically creating and switching to branch '${targetBranch}'...`));
    try {
      devPrCli.createAndCheckoutBranch(targetBranch);
      currentBranch = devPrCli.getCurrentBranch();
    } catch (err) {
      console.error(cRed(`❌ Failed to create branch '${targetBranch}': ${(err as Error).message || String(err)}`));
      return false;
    }
  }

  // 2. Commit uncommitted changes if present and push to origin
  try {
    devPrCli.commitChanges(resolvedGuideDir, guideName);
    devPrCli.pushBranch(currentBranch);
  } catch (err) {
    console.error(cRed(`❌ Failed to push branch: ${(err as Error).message || String(err)}`));
    return false;
  }

  // 3. Parse report.md for PR labels
  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  const labels = determinePrLabels(reportContent);

  // 4. Create or update Pull Request
  const existingPr = devPrCli.viewPr(currentBranch);

  if (existingPr) {
    if (existingPr.state !== 'OPEN') {
      console.error(cRed(`❌ A ${existingPr.state.toLowerCase()} Pull Request (#${existingPr.number}) already exists for branch '${currentBranch}'.`));
      console.log(cDim(`Please switch to a new branch if you want to open a new PR.`));
      return false;
    }

    const { addLabels, removeLabels } = computeLabelDiff(labels, existingPr.labels ?? []);
    console.log(cCyan(`Updating existing Pull Request #${existingPr.number}...`));
    try {
      devPrCli.editPr(existingPr.number, reportPath, addLabels, removeLabels);
      console.log(`\n${cGreen('📄 Updated Pull Request:')} ${existingPr.url}`);
      return true;
    } catch (err) {
      console.error(cRed(`❌ Failed to update Pull Request #${existingPr.number} via gh CLI: ${(err as Error).message || String(err)}`));
      return false;
    }
  } else {
    const prTitle = `gd dev output for ${guideName}`;
    try {
      const prUrl = devPrCli.createPr(prTitle, reportPath, labels);
      console.log(`\n${cGreen('📄 Pull Request:')} ${prUrl}`);
      return true;
    } catch (err) {
      console.error(cRed(`❌ Failed to create Pull Request via gh CLI: ${(err as Error).message || String(err)}`));
      return false;
    }
  }
}
