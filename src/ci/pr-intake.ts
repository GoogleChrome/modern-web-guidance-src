const MAX_TYPO_LINES = 5;
const MAX_ISSUE_NUMBER = 999_999;

export const INTAKE_CLOSE_MARKER = '<!-- mwg-intake-gate:close -->';
export const INTAKE_CLA_MARKER = '<!-- mwg-intake-gate:cla -->';
export const AWAITING_CLA_LABEL = 'awaiting-cla';
export const PR_WELCOME_LABEL = 'pr-welcome';

export type ClaState = 'success' | 'failure' | 'pending' | 'missing';

export interface LinkedIssueInfo {
  number: number;
  state: 'open' | 'closed';
  author: string;
  labels: readonly string[];
  assignees: readonly string[];
}

export interface PrIntakeInput {
  prAuthor: string;
  authorIsBot: boolean;
  authorHasWriteAccess: boolean;
  hasMaintainerEngagement: boolean;
  prLabels: readonly string[];
  title: string;
  body: string;
  files: readonly string[];
  additions: number;
  deletions: number;
  claState: ClaState;
  linkedIssues: ReadonlyMap<number, LinkedIssueInfo>;
}

export type AllowVia =
  | 'write-access'
  | 'bot'
  | 'maintainer-engaged'
  | 'pr-welcome-label'
  | 'approved-issue'
  | 'prose-typo-fix';

export type HoldClaVia = Exclude<AllowVia, 'write-access' | 'bot'>;

export type PrIntakeDecision =
  | { kind: 'allow'; via: AllowVia; approvedIssue?: number }
  | { kind: 'hold-cla'; claState: Exclude<ClaState, 'success'>; via: HoldClaVia; approvedIssue?: number }
  | { kind: 'close'; reason: 'no-approved-issue'; referencedIssues: number[] };

function stripCodeAndComments(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^(?:`{3,}|~{3,})[\s\S]*?^(?:`{3,}|~{3,})/gm, ' ')
    .replace(/`+[^`]*`+/g, ' ');
}

const ISSUE_URL_PATTERN = 'https?:\\/\\/github\\.com\\/GoogleChrome\\/modern-web-guidance-src\\/issues\\/(\\d+)\\b';

function addValidIssueNumber(found: Set<number>, raw: string | undefined): void {
  if (!raw) return;
  const num = Number(raw);
  if (num > 0 && num <= MAX_ISSUE_NUMBER) found.add(num);
}

export function extractIssueNumbers(title: string, body: string): number[] {
  const cleanTitle = stripCodeAndComments(title);
  const cleanBody = stripCodeAndComments(body);
  const found = new Set<number>();

  // 1. Any #NNN or issue URL in the PR title (e.g. "[#1216] rating guide" or "fix: ... (#2102)")
  for (const match of cleanTitle.matchAll(/(?:^|[\s([\],:;])#(\d+)(?=$|[\s)\],.:;])/g)) {
    addValidIssueNumber(found, match[1]);
  }
  for (const match of cleanTitle.matchAll(new RegExp(ISSUE_URL_PATTERN, 'gi'))) {
    addValidIssueNumber(found, match[1]);
  }

  // 2. Target/closing references in the PR body (e.g. "Fixes #123", "Closes #1, #2", "Issue: #42", or full issue URL)
  // Avoids matching casual prose asides like "(unrelated to #3618-adjacent)" or CSS hex colors like "#888".
  const targetClauseRegex =
    /\b(?:fix(?:es|ed)?|clos(?:e|es|ed)|resolv(?:e|es|ed)|address(?:es|ed)?|issues?|refs?|part\s+of|for)\b[\s:]*((?:#\d+\b|https?:\/\/github\.com\/GoogleChrome\/modern-web-guidance-src\/issues\/\d+\b)(?:\s*(?:,|and|&)\s*(?:#\d+\b|https?:\/\/github\.com\/GoogleChrome\/modern-web-guidance-src\/issues\/\d+\b))*)/gi;
  for (const clauseMatch of cleanBody.matchAll(targetClauseRegex)) {
    const listText = clauseMatch[1];
    for (const numMatch of listText.matchAll(/#(\d+)\b/g)) {
      addValidIssueNumber(found, numMatch[1]);
    }
    for (const urlMatch of listText.matchAll(new RegExp(ISSUE_URL_PATTERN, 'gi'))) {
      addValidIssueNumber(found, urlMatch[1]);
    }
  }

  return Array.from(found);
}

export function isSmallProseTypoFix(input: {
  files: readonly string[];
  additions: number;
  deletions: number;
}): boolean {
  const { files, additions, deletions } = input;
  if (files.length === 0) return false;
  if (additions > MAX_TYPO_LINES || deletions > MAX_TYPO_LINES) return false;
  if (additions === 0 && deletions === 0) return false;

  const guideDirs = new Set<string>();
  for (const rawFile of files) {
    const file = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!file.endsWith('.md')) return false;
    const base = file.split('/').pop() ?? '';
    if (base === 'expectations.md' || base === 'task.md') return false;
    if (file.startsWith('guides/')) {
      const parts = file.split('/');
      if (parts.length >= 4) {
        guideDirs.add(`${parts[0]}/${parts[1]}/${parts[2]}`);
      }
    }
  }

  return guideDirs.size <= 1;
}

function hasLabel(labels: readonly string[], target: string): boolean {
  const lower = target.toLowerCase();
  return labels.some(l => l.trim().toLowerCase() === lower);
}

export function evaluatePrIntake(input: PrIntakeInput): PrIntakeDecision {
  if (input.authorIsBot) {
    return { kind: 'allow', via: 'bot' };
  }
  if (input.authorHasWriteAccess) {
    return { kind: 'allow', via: 'write-access' };
  }

  const candidateRefs = extractIssueNumbers(input.title, input.body);
  const resolvedIssues: LinkedIssueInfo[] = [];
  for (const num of candidateRefs) {
    const info = input.linkedIssues.get(num);
    if (info) resolvedIssues.push(info);
  }

  const authorLower = input.prAuthor.toLowerCase();
  const approvedIssue = resolvedIssues.find(
    iss =>
      iss.state === 'open' &&
      (hasLabel(iss.labels, PR_WELCOME_LABEL) ||
        iss.assignees.some(a => a.toLowerCase() === authorLower))
  );

  let via: HoldClaVia | null = null;
  if (input.hasMaintainerEngagement) {
    via = 'maintainer-engaged';
  } else if (hasLabel(input.prLabels, PR_WELCOME_LABEL)) {
    via = 'pr-welcome-label';
  } else if (approvedIssue) {
    via = 'approved-issue';
  } else if (
    isSmallProseTypoFix({
      files: input.files,
      additions: input.additions,
      deletions: input.deletions
    })
  ) {
    via = 'prose-typo-fix';
  }

  if (!via) {
    return {
      kind: 'close',
      reason: 'no-approved-issue',
      referencedIssues: resolvedIssues.map(i => i.number)
    };
  }

  if (input.claState !== 'success') {
    return {
      kind: 'hold-cla',
      claState: input.claState,
      via,
      approvedIssue: approvedIssue?.number
    };
  }

  return {
    kind: 'allow',
    via,
    approvedIssue: approvedIssue?.number
  };
}

export const DEFAULT_INFRA_OWNERS = ['paulirish', 'micahjo7', 'lusayaa'] as const;
export const CONFIG_OWNERS = ['paulirish', 'rviscomi', 'micahjo7', 'lusayaa'] as const;
export const PUBLIC_HARNESS_OWNERS = ['paulirish', 'micahjo7', 'TravenReese'] as const;
export const EVAL_OWNERS = ['TravenReese', 'micahjo7', 'lusayaa'] as const;

const CONTENT_BASENAMES = new Set(['guide.md', 'demo.html', 'expectations.md', 'SKILL.md']);

function isOwnerlessContentPath(rawFile: string): boolean {
  const file = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = file.split('/');
  if (parts.includes('..')) return false;

  if (parts[0] === 'features' && parts.length === 2) return true;
  if (parts[0] === 'skills-src' && parts.length >= 2) return true;
  if (parts[0] === 'guides' && parts.length >= 3) {
    const base = parts[parts.length - 1];
    if (
      parts.includes('targets') ||
      parts.includes('tasks') ||
      base === 'grader.ts' ||
      base === 'negative-demo.html'
    ) {
      return false;
    }
    return CONTENT_BASENAMES.has(base);
  }
  return false;
}

function isEvalPath(rawFile: string): boolean {
  const file = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
  if (file.startsWith('src/grading/')) return true;
  if (/(?:^|\/)targets\//.test(file)) return true;
  if (/(?:^|\/)grader\.ts$/.test(file)) return true;
  if (/(?:^|\/)tasks\/task\.md$/.test(file)) return true;
  return false;
}

export function resolveInfraReviewers(files: readonly string[]): string[] {
  const owners = new Set<string>();
  for (const rawFile of files) {
    const file = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
    if (isOwnerlessContentPath(file)) continue;

    if (file === 'CODEOWNERS' || file === '.github/atls.json') {
      CONFIG_OWNERS.forEach(o => owners.add(o));
    } else if (file.startsWith('src/harness/public/')) {
      PUBLIC_HARNESS_OWNERS.forEach(o => owners.add(o));
    } else if (isEvalPath(file)) {
      EVAL_OWNERS.forEach(o => owners.add(o));
    } else {
      DEFAULT_INFRA_OWNERS.forEach(o => owners.add(o));
    }
  }
  return Array.from(owners);
}

export function formatAutoCloseComment(prAuthor: string, referencedIssues: readonly number[]): string {
  const issueNote =
    referencedIssues.length > 0
      ? `The linked issue (${referencedIssues.map(n => `#${n}`).join(', ')}) isn't marked \`${PR_WELCOME_LABEL}\` or assigned to you yet—open issues here are often internal maintainer tasks or still being scoped.`
      : `We didn't find a linked issue marked \`${PR_WELCOME_LABEL}\` (or assigned to you) for this change.`;

  return [
    INTAKE_CLOSE_MARKER,
    `Hi @${prAuthor} — thanks for your interest in Modern Web Guidance!`,
    '',
    `Because guidance here feeds coding agents and an automated evaluation suite, we align on the problem in an issue before reviewing pull requests (see [\`CONTRIBUTING.md\`](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/CONTRIBUTING.md#send-us-the-problem-not-the-patch)). ${issueNote}`,
    '',
    `Closing this PR for now so it doesn't sit unreviewed in the queue:`,
    `- If you're proposing a new fix or improvement, please open or comment on an issue first. Once a maintainer adds \`${PR_WELCOME_LABEL}\` (or assigns you), feel free to open a PR.`,
    `- *Maintainers:* to accept this PR directly, add the \`${PR_WELCOME_LABEL}\` label here and click **Reopen**.`
  ].join('\n');
}

export function formatClaHoldComment(prAuthor: string): string {
  return [
    INTAKE_CLA_MARKER,
    `Hi @${prAuthor} — holding reviewer assignment until the \`cla/google\` check passes:`,
    `1. Sign the [Google CLA](https://cla.developers.google.com/) using the **exact email address** in your commit (\`git log -1 --format='%ae'\` — GitHub \`@users.noreply.github.com\` emails fail unless registered on your CLA).`,
    `2. Strip any AI \`Co-Authored-By:\` trailers from your commits and force-push if needed.`,
    '',
    `Reviewers will be requested automatically once \`cla/google\` turns green.`
  ].join('\n');
}
