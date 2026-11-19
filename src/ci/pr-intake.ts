const MAX_TYPO_LINES = 5;
const MAX_ISSUE_NUMBER = 999_999;
const MAX_LINKED_ISSUE_LOOKUPS = 10;

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

export type AllowVia =
  | 'write-access'
  | 'bot'
  | 'maintainer-engaged'
  | 'pr-welcome-label'
  | 'approved-issue'
  | 'prose-typo-fix';

export type HoldClaVia = Exclude<AllowVia, 'write-access' | 'bot'>;

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
  resolveIssue: (issueNumber: number) => LinkedIssueInfo | null;
}

export type PrIntakeDecision =
  | { kind: 'allow'; via: AllowVia; approvedIssue?: number }
  | { kind: 'hold-cla'; claState: Exclude<ClaState, 'success'>; via: HoldClaVia; approvedIssue?: number }
  | { kind: 'close'; reason: 'no-approved-issue'; referencedIssues: number[] };

export function hasLabel(labels: readonly string[], target: string): boolean {
  const lower = target.toLowerCase();
  return labels.some(l => l.trim().toLowerCase() === lower);
}

/**
 * Strips fenced code blocks (``` or ~~~) and inline code spans (`...`) first so
 * HTML comments or `#123` tokens inside code examples are ignored.
 */
export function stripMarkdownCode(markdown: string): string {
  return markdown
    .replace(/^(?:`{3,}|~{3,})[\s\S]*?^(?:`{3,}|~{3,})/gm, ' ')
    .replace(/`+[^`]*`+/g, ' ');
}

function stripCodeAndComments(markdown: string): string {
  return stripMarkdownCode(markdown).replace(/<!--[\s\S]*?-->/g, ' ');
}

export function hasNoAtlTriageDirective(body?: string | null): boolean {
  if (!body) return false;
  return /<!--\s*no-atl-triage\s*-->/i.test(stripMarkdownCode(body));
}

const ISSUE_REF = String.raw`(?:#(\d+)|https?:\/\/github\.com\/GoogleChrome\/modern-web-guidance-src\/issues\/(\d+))(?![\w-])`;
const MD_ISSUE_LINK = String.raw`\[[^\]]*\]\(https?:\/\/github\.com\/GoogleChrome\/modern-web-guidance-src\/issues\/(\d+)\)`;
const BODY_ISSUE_TOKEN = String.raw`(?:${MD_ISSUE_LINK}|${ISSUE_REF})`;
const TITLE_REF_RE = new RegExp(String.raw`(?:^|[\s([\],:;])${ISSUE_REF}`, 'gi');
const ISSUE_REF_RE = new RegExp(BODY_ISSUE_TOKEN, 'gi');
const BODY_CLAUSE_RE = new RegExp(
  String.raw`\b(?:fix(?:es|ed)?|clos(?:e|es|ed)|resolv(?:e|es|ed)|address(?:es|ed)?|issues?|refs?|part\s+of|for)\b[\s:]*(${BODY_ISSUE_TOKEN}(?:\s*(?:,\s*(?:and|&)|,|and|&)\s*${BODY_ISSUE_TOKEN})*)`,
  'gi'
);

export function extractIssueNumbers(title: string, body: string): number[] {
  const found = new Set<number>();
  const collect = (text: string, re: RegExp): void => {
    for (const match of text.matchAll(re)) {
      const num = Number(match[1] ?? match[2] ?? match[3]);
      if (num > 0 && num <= MAX_ISSUE_NUMBER) found.add(num);
    }
  };

  collect(stripCodeAndComments(title), TITLE_REF_RE);
  for (const clause of stripCodeAndComments(body).matchAll(BODY_CLAUSE_RE)) {
    collect(clause[1], ISSUE_REF_RE);
  }
  return Array.from(found);
}

const PROSE_DOC_ALLOWLIST = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'guides/README.md',
  'guides/CONTRIBUTING.md'
]);

export function isSmallProseTypoFix(input: {
  files: readonly string[];
  additions: number;
  deletions: number;
}): boolean {
  const { files, additions, deletions } = input;
  if (files.length !== 1) return false;
  if (additions > MAX_TYPO_LINES || deletions > MAX_TYPO_LINES) return false;
  if (additions === 0 && deletions === 0) return false;

  const file = files[0].replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = file.split('/');
  if (!file.endsWith('.md') || parts.includes('..')) return false;

  if (PROSE_DOC_ALLOWLIST.has(file) || /^docs\/[^/]+\.md$/.test(file)) return true;
  if (parts.length === 4 && parts[0] === 'guides' && parts[3] === 'guide.md') {
    const cat = parts[1].toLowerCase();
    return cat !== 'lib' && cat !== 'node_modules' && cat !== 'modern-web-guidance';
  }
  return false;
}

export function evaluatePrIntake(input: PrIntakeInput): PrIntakeDecision {
  if (input.authorIsBot) return { kind: 'allow', via: 'bot' };
  if (input.authorHasWriteAccess) return { kind: 'allow', via: 'write-access' };

  const finalize = (via: HoldClaVia, approvedIssue?: number): PrIntakeDecision =>
    input.claState === 'success'
      ? { kind: 'allow', via, approvedIssue }
      : { kind: 'hold-cla', claState: input.claState, via, approvedIssue };

  if (input.hasMaintainerEngagement) return finalize('maintainer-engaged');
  if (hasLabel(input.prLabels, PR_WELCOME_LABEL)) return finalize('pr-welcome-label');

  const authorLower = input.prAuthor.toLowerCase();
  const referencedIssues: number[] = [];
  for (const num of extractIssueNumbers(input.title, input.body).slice(0, MAX_LINKED_ISSUE_LOOKUPS)) {
    const iss = input.resolveIssue(num);
    if (!iss) continue;
    referencedIssues.push(iss.number);
    const isApproved =
      iss.state === 'open' &&
      (hasLabel(iss.labels, PR_WELCOME_LABEL) ||
        iss.assignees.some(a => a.toLowerCase() === authorLower));
    if (isApproved) return finalize('approved-issue', iss.number);
  }

  if (isSmallProseTypoFix(input)) return finalize('prose-typo-fix');
  return { kind: 'close', reason: 'no-approved-issue', referencedIssues };
}

export function formatAutoCloseComment(prAuthor: string, referencedIssues: readonly number[]): string {
  const issueNote =
    referencedIssues.length > 0
      ? `The linked issue (${referencedIssues.map(n => `#${n}`).join(', ')}) isn't marked \`${PR_WELCOME_LABEL}\` or assigned to you yet (open issues here are often internal maintainer tasks or still being scoped).`
      : `We didn't find a linked issue marked \`${PR_WELCOME_LABEL}\` (or assigned to you) for this change.`;

  return [
    INTAKE_CLOSE_MARKER,
    `Hi @${prAuthor}, thanks for your interest in Modern Web Guidance!`,
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
    `Hi @${prAuthor}, holding reviewer assignment until the \`cla/google\` check passes:`,
    `1. Sign the [Google CLA](https://cla.developers.google.com/) using the **exact email address** in your commit (\`git log -1 --format='%ae'\`; GitHub \`@users.noreply.github.com\` emails fail unless registered on your CLA).`,
    `2. Strip any AI \`Co-Authored-By:\` trailers from your commits and force-push if needed.`,
    '',
    `Reviewers will be requested automatically once \`cla/google\` turns green.`
  ].join('\n');
}
