import fs from 'node:fs';
import {
  AWAITING_CLA_LABEL,
  INTAKE_CLA_MARKER,
  INTAKE_CLOSE_MARKER,
  evaluatePrIntake,
  formatAutoCloseComment,
  formatClaHoldComment,
  hasLabel,
  hasNoAtlTriageDirective,
  type PrIntakeDecision
} from './pr-intake.ts';
import {
  extractNoreplyLogin,
  loadAtlConfig,
  parsePrimaryBlameAuthor,
  planIssueTriage,
  planPrRouting,
  upsertDemoPreviewInBody,
  type AtlConfig
} from './reviewer-routing.ts';
import { githubApi, isBotLogin, type IssueTimelineSummary } from './github-client.ts';

function isEnvDryRun(): boolean {
  return process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
}

function runMutation(isDryRun: boolean, actionDesc: string, fn: () => void): void {
  if (isDryRun) {
    console.log(`[DRY RUN] Would ${actionDesc}`);
    return;
  }
  try {
    fn();
  } catch (err) {
    console.error(`Failed to ${actionDesc}:`, err);
  }
}

export interface HandleIssueOptions {
  dryRun?: boolean;
  guidesRootDir?: string;
  currentAssignees?: string[];
}

export function handleIssue(
  issueNumber: number,
  labels: string[],
  issueDescription: string,
  atlConfig: AtlConfig,
  options?: HandleIssueOptions
): string[] {
  const isDryRun = options?.dryRun ?? isEnvDryRun();
  console.log(`Triaging issue #${issueNumber} with labels: ${labels.join(', ')}`);

  if (hasNoAtlTriageDirective(issueDescription)) {
    console.log(`Issue #${issueNumber} contains <!-- no-atl-triage --> directive. Skipping ATL triage.`);
    return [];
  }

  let currentAssignees = options?.currentAssignees;
  if (!currentAssignees) {
    try {
      currentAssignees = githubApi.getIssueSnapshot(issueNumber).assignees;
    } catch (err) {
      console.warn(`Failed to fetch current assignees for issue #${issueNumber}:`, err);
      currentAssignees = [];
    }
  }

  let timeline: IssueTimelineSummary | undefined;
  try {
    timeline = githubApi.getIssueTimelineSummary(issueNumber);
  } catch (err) {
    console.warn(`Failed to fetch event history for issue #${issueNumber}:`, err);
  }

  const plan = planIssueTriage({
    labels,
    description: issueDescription,
    atlConfig,
    guidesRootDir: options?.guidesRootDir,
    currentAssignees,
    unassignedLoginsLower: timeline?.unassignedLower,
    unlabeledLower: timeline?.unlabeledLower
  });

  if (plan.labelsToAdd.length > 0 || plan.labelsToRemove.length > 0 || plan.assigneesToAdd.length > 0) {
    const parts: string[] = [];
    if (plan.labelsToAdd.length > 0) parts.push(`add label(s) [${plan.labelsToAdd.join(', ')}]`);
    if (plan.labelsToRemove.length > 0) parts.push(`remove label(s) [${plan.labelsToRemove.join(', ')}]`);
    if (plan.assigneesToAdd.length > 0) parts.push(`assign [${plan.assigneesToAdd.join(', ')}]`);
    runMutation(isDryRun, `update issue #${issueNumber}: ${parts.join('; ')}`, () =>
      githubApi.editItem('issue', issueNumber, {
        addLabels: plan.labelsToAdd,
        removeLabels: plan.labelsToRemove,
        addAssignees: plan.assigneesToAdd
      })
    );
  }

  return plan.assigneesToAdd;
}

export interface TriagePullRequestOptions {
  dryRun?: boolean;
  headRef?: string;
  guidesRootDir?: string;
}

export interface TriagePullRequestResult {
  decision: PrIntakeDecision | null;
  reviewers: string[];
}

export function triagePullRequest(
  prNumber: number,
  atlConfig: AtlConfig,
  options?: TriagePullRequestOptions
): TriagePullRequestResult {
  const isDryRun = options?.dryRun ?? isEnvDryRun();
  const meta = githubApi.getPrIntakeMetadata(prNumber);

  if (meta.state.toUpperCase() !== 'OPEN') {
    console.log(`PR #${prNumber} is ${meta.state}. Skipping triage.`);
    return { decision: null, reviewers: [] };
  }
  if (meta.isDraft) {
    console.log(`PR #${prNumber} is in draft mode. Skipping triage until marked ready for review.`);
    return { decision: null, reviewers: [] };
  }

  const writeAccessCache = new Map<string, boolean>();
  const checkWriteAccess = (login: string): boolean => {
    const key = login.trim().toLowerCase();
    if (!key) return false;
    const cached = writeAccessCache.get(key);
    if (cached !== undefined) return cached;
    const allowed = githubApi.hasUserWriteAccess(login);
    writeAccessCache.set(key, allowed);
    return allowed;
  };

  const authorHasWriteAccess = meta.authorIsBot ? true : meta.isSameRepo || checkWriteAccess(meta.author);
  const hasMaintainerEngagement =
    !authorHasWriteAccess && meta.participantLogins.some(checkWriteAccess);

  const decision = evaluatePrIntake({
    prAuthor: meta.author,
    authorIsBot: meta.authorIsBot,
    authorHasWriteAccess,
    hasMaintainerEngagement,
    prLabels: meta.labels,
    title: meta.title,
    body: meta.body,
    files: meta.files,
    additions: meta.additions,
    deletions: meta.deletions,
    claState: meta.claState,
    resolveIssue: githubApi.getLinkedIssueInfo
  });

  let cachedTimeline: IssueTimelineSummary | null | undefined;
  const getTimeline = (): IssueTimelineSummary | null => {
    if (cachedTimeline !== undefined) return cachedTimeline;
    try {
      cachedTimeline = githubApi.getIssueTimelineSummary(prNumber);
    } catch (err) {
      console.warn(`Failed to fetch timeline events for PR #${prNumber}:`, err);
      cachedTimeline = null;
    }
    return cachedTimeline;
  };

  const findStaleBotReviewers = (keepResolvedLower: ReadonlySet<string>): string[] => {
    const stale = meta.reviewRequests.filter(r => !keepResolvedLower.has(r.toLowerCase()));
    if (stale.length === 0) return [];
    const botRequested = getTimeline()?.botRequestedLower ?? new Set<string>();
    return stale.filter(c => botRequested.has(c.toLowerCase()));
  };

  switch (decision.kind) {
    case 'close': {
      const toRemove = findStaleBotReviewers(new Set());
      if (toRemove.length > 0) {
        runMutation(isDryRun, `remove premature bot reviewer(s) from PR #${prNumber}: ${toRemove.join(',')}`, () =>
          githubApi.editItem('pr', prNumber, { removeReviewers: toRemove })
        );
      }
      const alreadyCommented = meta.comments.some(c => c.body.includes(INTAKE_CLOSE_MARKER));
      const closeComment = formatAutoCloseComment(meta.author, decision.referencedIssues);
      if (isDryRun) {
        console.log(
          `[DRY RUN] Intake CLOSE (${decision.reason}, refs=${decision.referencedIssues.join(',') || 'none'}): would comment and close PR #${prNumber}.`
        );
      } else {
        if (!alreadyCommented) githubApi.addPrComment(prNumber, closeComment);
        githubApi.closePr(prNumber);
        console.log(`Closed unapproved external PR #${prNumber} (${decision.reason}).`);
      }
      return { decision, reviewers: [] };
    }

    case 'hold-cla': {
      const toRemove = findStaleBotReviewers(new Set());
      const needLabel = !hasLabel(meta.labels, AWAITING_CLA_LABEL);
      const alreadyCommented = meta.comments.some(c => c.body.includes(INTAKE_CLA_MARKER));
      if (isDryRun) {
        if (toRemove.length > 0) {
          console.log(`[DRY RUN] Would remove premature bot reviewer(s) from PR #${prNumber}: ${toRemove.join(',')}`);
        }
        console.log(
          `[DRY RUN] Intake HOLD-CLA (cla=${decision.claState}, via=${decision.via}): would ensure '${AWAITING_CLA_LABEL}' label and withhold reviewers on PR #${prNumber}.`
        );
      } else {
        if (needLabel || toRemove.length > 0) {
          runMutation(false, `hold PR #${prNumber} on CLA`, () =>
            githubApi.editItem('pr', prNumber, {
              addLabels: needLabel ? [AWAITING_CLA_LABEL] : undefined,
              removeReviewers: toRemove
            })
          );
        }
        if (decision.claState === 'failure' && !alreadyCommented) {
          githubApi.addPrComment(prNumber, formatClaHoldComment(meta.author));
        }
      }
      return { decision, reviewers: [] };
    }

    case 'allow': {
      console.log(`Triaging PR #${prNumber} by author: @${meta.author} (${meta.files.length} file(s))`);

      if (hasNoAtlTriageDirective(meta.body)) {
        if (hasLabel(meta.labels, AWAITING_CLA_LABEL)) {
          runMutation(isDryRun, `remove '${AWAITING_CLA_LABEL}' from PR #${prNumber}`, () =>
            githubApi.editItem('pr', prNumber, { removeLabels: [AWAITING_CLA_LABEL] })
          );
        }
        console.log(`PR #${prNumber} contains <!-- no-atl-triage --> directive. Skipping ATL triage.`);
        return { decision, reviewers: [] };
      }

      const headRef =
        options?.headRef ?? ((meta.isSameRepo && meta.headRefName) || meta.headRefOid || 'main');
      const nextBody = upsertDemoPreviewInBody(headRef, meta.body, meta.files);
      if (nextBody !== meta.body) {
        runMutation(isDryRun, `update demo preview links in PR #${prNumber} description`, () =>
          githubApi.updatePrBody(prNumber, nextBody)
        );
      }

      const timeline = getTimeline();
      const emailLoginCache = new Map<string, string | null>();
      let cachedOpenCounts: ReadonlyMap<string, number> | undefined;

      const readGuidePrimaryAuthor = (guideAbsPath: string): string | null => {
        let guideMarkdown: string;
        try {
          guideMarkdown = fs.readFileSync(guideAbsPath, 'utf8');
        } catch {
          return null;
        }
        const porcelain = githubApi.getGuideBlamePorcelain(guideAbsPath);
        if (!porcelain) return null;
        const primary = parsePrimaryBlameAuthor(guideMarkdown, porcelain);
        if (!primary) return null;

        let login = emailLoginCache.get(primary.email);
        if (login === undefined) {
          login = githubApi.getCommitAuthorLogin(primary.sha) ?? extractNoreplyLogin(primary.email);
          emailLoginCache.set(primary.email, login);
        }
        if (!login || isBotLogin(login)) return null;
        return checkWriteAccess(login) ? login : null;
      };

      const plan = planPrRouting({
        prNumber,
        author: meta.author,
        labels: meta.labels,
        files: meta.files,
        atlConfig,
        guidesRootDir: options?.guidesRootDir,
        reviewRequests: meta.reviewRequests,
        reviews: meta.reviews,
        removedReviewers: timeline?.removedReviewersLower,
        unlabeledLabels: timeline?.unlabeledLower,
        openReviewCounts: () => (cachedOpenCounts ??= githubApi.getOpenPrReviewCounts()),
        readPrGuideContent: relPath => githubApi.getPrFileContent(prNumber, relPath),
        readGuidePrimaryAuthor
      });

      for (const choice of plan.leadChoices) {
        console.log(`${choice.target} -> Lead reviewer: @${choice.lead}`);
      }

      const resolvedLower = new Set(plan.allResolvedReviewers.map(r => r.toLowerCase()));
      const reviewersToRemove = findStaleBotReviewers(resolvedLower);

      const hasEdits =
        plan.labelsToAdd.length > 0 ||
        plan.labelsToRemove.length > 0 ||
        reviewersToRemove.length > 0 ||
        plan.reviewersToRequest.length > 0;

      if (hasEdits) {
        const summary: string[] = [];
        if (plan.labelsToAdd.length) summary.push(`+labels [${plan.labelsToAdd.join(', ')}]`);
        if (plan.labelsToRemove.length) summary.push(`-labels [${plan.labelsToRemove.join(', ')}]`);
        if (reviewersToRemove.length) summary.push(`-reviewers [${reviewersToRemove.join(', ')}]`);
        if (plan.reviewersToRequest.length) summary.push(`+reviewers [${plan.reviewersToRequest.join(', ')}]`);
        runMutation(isDryRun, `edit PR #${prNumber}: ${summary.join('; ')}`, () =>
          githubApi.editItem('pr', prNumber, {
            addLabels: plan.labelsToAdd,
            removeLabels: plan.labelsToRemove,
            removeReviewers: reviewersToRemove,
            addReviewers: plan.reviewersToRequest
          })
        );
      } else {
        console.log('No label or reviewer changes needed for this PR.');
      }

      return { decision, reviewers: plan.reviewersToRequest };
    }

    default: {
      const _exhaustive: never = decision;
      throw new Error(`Unhandled intake decision: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function main(): void {
  const atlConfig = loadAtlConfig();
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const isDryRun = process.argv.includes('--dry-run') || isEnvDryRun();

  if (eventPath && fs.existsSync(eventPath)) {
    console.log(`Processing GitHub Actions event from ${eventPath}`);
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

    if (event.issue) {
      const labels = (event.issue.labels || []).map((l: { name: string }) => l.name);
      handleIssue(event.issue.number, labels, event.issue.body || '', atlConfig, { dryRun: isDryRun });
    } else if (event.pull_request) {
      triagePullRequest(event.pull_request.number, atlConfig, { dryRun: isDryRun });
    } else if (event.check_run) {
      const checkName: string = event.check_run.name ?? '';
      const conclusion = String(event.check_run.conclusion ?? '').toLowerCase();
      const headSha: string = event.check_run.head_sha ?? '';
      if (checkName === 'cla/google' && conclusion === 'success' && headSha) {
        const waitingPrs = githubApi.findOpenAwaitingClaPrsForSha(headSha);
        console.log(`cla/google succeeded for ${headSha}; waking ${waitingPrs.length} awaiting-cla PR(s).`);
        for (const prNumber of waitingPrs) {
          triagePullRequest(prNumber, atlConfig, { dryRun: isDryRun });
        }
      }
    } else {
      console.log('Event is not a supported issue, pull_request, or check_run event. Skipping.');
    }
    return;
  }

  const args = process.argv.slice(2).filter(arg => arg !== '--dry-run');
  const type = args[0];
  const number = Number.parseInt(args[1] ?? '', 10);

  if (args.length < 2 || Number.isNaN(number) || (type !== 'issue' && type !== 'pr')) {
    console.log('Usage for manual testing:');
    console.log('  node src/ci/atl-triage.ts issue <number> [label1] [label2] ... [--dry-run]');
    console.log('  node src/ci/atl-triage.ts pr <number> [--dry-run]');
    process.exit(1);
  }

  if (type === 'issue') {
    const cliLabels = args.slice(2);
    const snap = githubApi.getIssueSnapshot(number);
    handleIssue(number, cliLabels.length > 0 ? cliLabels : snap.labels, snap.body, atlConfig, {
      dryRun: isDryRun,
      currentAssignees: snap.assignees
    });
  } else {
    triagePullRequest(number, atlConfig, { dryRun: isDryRun });
  }
}

if (process.argv[1] === import.meta.filename) {
  main();
}
