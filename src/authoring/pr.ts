import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { cGreen, cCyan, cRed, cDim } from '../core/colors.ts';
import { REPORT_FILE } from '../core/guide-validation.ts';
import { resolveGuideResultsDir, type GuideResultsInventory } from '../core/paths.ts';

export type DevPrLabel = 'gd-dev-content' | 'gd-dev-eval';
export type DevPrRerunLabel = 'needs-eval-gen' | 'needs-eval-run';

const MANAGED_PR_LABELS: readonly string[] = [
  'gd-dev-content',
  'gd-dev-eval',
  'needs-eval-gen',
  'needs-eval-run',
];

interface OpenDevPr {
  number: number;
  url: string;
  labels: { name: string }[];
}

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
  /**
   * The open PR for a branch, if any. Merged and closed PRs are ignored, so a
   * branch name can be reused once its earlier PR is done.
   */
  viewOpenPr(branch: string): OpenDevPr | null {
    try {
      const output = execSync(`gh pr list --head "${branch}" --state open --limit 1 --json number,url,labels`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return (JSON.parse(output || '[]') as OpenDevPr[])[0] ?? null;
    } catch {
      return null;
    }
  },
  /**
   * A merged or closed PR from this branch whose head commit is in HEAD's
   * history, i.e. the current branch continues a finished PR. A fresh branch
   * off main reusing the name doesn't match (merges are squashed).
   */
  findFinishedPrInHistory(branch: string): { number: number; state: string } | null {
    let prs: { number: number; state: string; headRefOid: string }[];
    try {
      const output = execSync(`gh pr list --head "${branch}" --state all --limit 20 --json number,state,headRefOid`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      prs = JSON.parse(output || '[]');
    } catch {
      return null;
    }
    const inHistory = (commit: string): boolean => {
      try {
        execSync(`git merge-base --is-ancestor ${commit} HEAD`, { stdio: 'ignore' });
        return true;
      } catch {
        return false; // Not an ancestor, or the commit isn't available locally.
      }
    };
    return prs.find(pr => pr.state !== 'OPEN' && inHistory(pr.headRefOid)) ?? null;
  },
  createPr(title: string, bodyPath: string, labels: DevPrLabel[]): string {
    const labelFlags = labels.map(l => `--label "${l}"`).join(' ');
    return execSync(`gh pr create --title "${title}" --body-file "${bodyPath}" ${labelFlags}`.trim(), {
      encoding: 'utf-8',
    }).trim();
  },
  editPr(prNumber: number, bodyPath: string, addLabels: DevPrLabel[], removeLabels: string[]): void {
    execSync(`gh api repos/{owner}/{repo}/pulls/${prNumber} --method PATCH -F body=@"${bodyPath}"`, { stdio: 'ignore' });
    for (const label of removeLabels) {
      try {
        execSync(`gh api repos/{owner}/{repo}/issues/${prNumber}/labels/${encodeURIComponent(label)} --method DELETE`, { stdio: 'ignore' });
      } catch {}
    }
    if (addLabels.length > 0) {
      execSync(`gh api repos/{owner}/{repo}/issues/${prNumber}/labels -f labels[]="${addLabels.join('" -f labels[]="')}"`, { stdio: 'ignore' });
    }
  },
};

/**
 * Computes which gd-dev labels to add or remove based on new recommendations vs existing PR labels.
 * Also removes any trigger rerun labels (`needs-eval-gen`, `needs-eval-run`).
 */
export function computeLabelDiff(
  newLabels: DevPrLabel[],
  existingLabels: { name: string }[] = []
): { addLabels: DevPrLabel[]; removeLabels: string[] } {
  const current = new Set((existingLabels || []).map(l => l.name));
  const next = new Set<string>(newLabels);
  return {
    addLabels: newLabels.filter(l => !current.has(l)),
    removeLabels: MANAGED_PR_LABELS.filter(l => current.has(l) && !next.has(l)),
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

/** Branch `gd pr` creates when run from `main`. */
export function devPrBranch(guideName: string): string {
  return `gd-dev/${guideName}`;
}

/** Title `gd pr` gives a new PR. */
export function devPrTitle(guideName: string): string {
  return `grader updates: ${guideName}`;
}

/**
 * Orchestrates branch push, label determination, and GitHub PR creation or update.
 * Returns the PR URL, or null on failure.
 */
export async function runDevPr(guideDir: string, guideInfo?: Partial<GuideResultsInventory>): Promise<string | null> {
  const resolvedGuideDir = path.resolve(guideDir);
  const guideResultsDir = resolveGuideResultsDir(resolvedGuideDir, guideInfo);
  const reportPath = path.join(guideResultsDir, REPORT_FILE);

  if (!fs.existsSync(reportPath)) {
    console.error(cRed(`❌ No evaluation report found at ${path.relative(process.cwd(), reportPath)}.`));
    console.log(cDim(`Please run 'gd dev ${guideDir}' first to generate the evaluation report.`));
    return null;
  }

  // 1. Verify and resolve git branch (auto-create branch if currently on main)
  const guideName = path.basename(resolvedGuideDir);
  let currentBranch = '';
  try {
    currentBranch = devPrCli.getCurrentBranch();
  } catch {
    console.error(cRed('❌ Failed to determine current git branch.'));
    return null;
  }

  if (currentBranch === 'main') {
    const targetBranch = devPrBranch(guideName);
    console.log(cCyan(`Currently on 'main'. Automatically creating and switching to branch '${targetBranch}'...`));
    try {
      devPrCli.createAndCheckoutBranch(targetBranch);
      currentBranch = devPrCli.getCurrentBranch();
    } catch (err) {
      console.error(cRed(`❌ Failed to create branch '${targetBranch}': ${(err as Error).message || String(err)}`));
      return null;
    }
  }

  // 2. Without an open PR, refuse to continue a branch whose earlier PR is
  //    already merged or closed; a new PR would repeat that work.
  const existingPr = devPrCli.viewOpenPr(currentBranch);
  const finishedPr = existingPr ? null : devPrCli.findFinishedPrInHistory(currentBranch);
  if (finishedPr) {
    console.error(cRed(`❌ Branch '${currentBranch}' already contains ${finishedPr.state.toLowerCase()} Pull Request #${finishedPr.number}.`));
    console.log(cDim(`Please switch to a new branch off main if you want to open a new PR.`));
    return null;
  }

  // 3. Commit uncommitted changes if present and push to origin
  try {
    devPrCli.commitChanges(resolvedGuideDir, guideName);
    devPrCli.pushBranch(currentBranch);
  } catch (err) {
    console.error(cRed(`❌ Failed to push branch: ${(err as Error).message || String(err)}`));
    return null;
  }

  // 4. Parse report.md for PR labels
  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  const labels = determinePrLabels(reportContent);

  // 5. Update the branch's open PR, or create one
  if (existingPr) {
    const { addLabels, removeLabels } = computeLabelDiff(labels, existingPr.labels ?? []);
    console.log(cCyan(`Updating existing Pull Request #${existingPr.number}...`));
    try {
      devPrCli.editPr(existingPr.number, reportPath, addLabels, removeLabels);
      console.log(`\n${cGreen('📄 Updated Pull Request:')} ${existingPr.url}`);
      return existingPr.url;
    } catch (err) {
      console.error(cRed(`❌ Failed to update Pull Request #${existingPr.number} via gh CLI: ${(err as Error).message || String(err)}`));
      return null;
    }
  } else {
    const prTitle = devPrTitle(guideName);
    try {
      const prUrl = devPrCli.createPr(prTitle, reportPath, labels);
      console.log(`\n${cGreen('📄 Pull Request:')} ${prUrl}`);
      return prUrl;
    } catch (err) {
      console.error(cRed(`❌ Failed to create Pull Request via gh CLI: ${(err as Error).message || String(err)}`));
      return null;
    }
  }
}
