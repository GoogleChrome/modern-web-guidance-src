import child_process from 'node:child_process';
import path from 'node:path';
import { gitExec } from '../core/git-utils.ts';
import { AWAITING_CLA_LABEL, type ClaState, type LinkedIssueInfo } from './pr-intake.ts';

const KNOWN_APP_LOGINS = new Set(['google-cla', 'dependabot', 'github-actions', 'chrome-devrel-infra']);

export function isBotLogin(login?: string | null, isBotFlag?: boolean): boolean {
  const lower = (login ?? '').trim().toLowerCase();
  if (!lower) return false;
  return (
    Boolean(isBotFlag) ||
    lower.endsWith('[bot]') ||
    lower.startsWith('app/') ||
    KNOWN_APP_LOGINS.has(lower)
  );
}

interface RawAuthor {
  login?: string;
  is_bot?: boolean;
}

export interface RawGhPrView {
  title?: string;
  body?: string | null;
  state?: string;
  isDraft?: boolean;
  isCrossRepository?: boolean;
  additions?: number;
  deletions?: number;
  headRefOid?: string;
  headRefName?: string;
  headRepository?: { name?: string; nameWithOwner?: string } | null;
  headRepositoryOwner?: { login?: string } | null;
  author?: RawAuthor | null;
  labels?: Array<{ name?: string }>;
  files?: Array<{ path?: string }>;
  reviewRequests?: Array<{ login?: string }>;
  reviews?: Array<{ author?: RawAuthor | null }>;
  comments?: Array<{ author?: RawAuthor | null; body?: string }>;
  statusCheckRollup?: Array<{
    context?: string;
    name?: string;
    conclusion?: string | null;
    state?: string | null;
    status?: string | null;
  }>;
}

export interface PrIntakeMetadata {
  title: string;
  body: string;
  state: string;
  isDraft: boolean;
  additions: number;
  deletions: number;
  headRefOid: string;
  headRefName: string;
  isSameRepo: boolean;
  author: string;
  authorIsBot: boolean;
  labels: string[];
  files: string[];
  reviewRequests: string[];
  reviews: string[];
  participantLogins: string[];
  comments: Array<{ author: string; isBot: boolean; body: string }>;
  claState: ClaState;
}

export function parsePrIntakeMetadata(data: RawGhPrView): PrIntakeMetadata {
  const author = data.author?.login ?? '';
  const authorLower = author.toLowerCase();
  const authorIsBot = isBotLogin(author, data.author?.is_bot);

  const participants = new Set<string>();
  const addParticipant = (actor?: RawAuthor | null): void => {
    const login = actor?.login;
    if (login && !isBotLogin(login, actor?.is_bot) && login.toLowerCase() !== authorLower) {
      participants.add(login);
    }
  };

  const reviews: string[] = [];
  for (const rev of data.reviews || []) {
    if (rev.author?.login) reviews.push(rev.author.login);
    addParticipant(rev.author);
  }

  const comments: Array<{ author: string; isBot: boolean; body: string }> = [];
  for (const com of data.comments || []) {
    const login = com.author?.login ?? '';
    const isBot = isBotLogin(login, com.author?.is_bot);
    comments.push({ author: login, isBot, body: com.body ?? '' });
    addParticipant(com.author);
  }

  const claCheck = (data.statusCheckRollup || []).find(
    c => (c.context || c.name) === 'cla/google'
  );
  let claState: ClaState = 'missing';
  if (claCheck) {
    const statusRaw = String(claCheck.conclusion || claCheck.state || claCheck.status || '').toLowerCase();
    if (statusRaw === 'success') claState = 'success';
    else if (statusRaw === 'failure' || statusRaw === 'error' || statusRaw === 'action_required') claState = 'failure';
    else claState = 'pending';
  }

  const nameWithOwner = String(data.headRepository?.nameWithOwner ?? '').toLowerCase();
  const ownerLogin = String(data.headRepositoryOwner?.login ?? '').toLowerCase();
  const repoName = String(data.headRepository?.name ?? '').toLowerCase();
  const isSameRepo =
    data.isCrossRepository === false &&
    (nameWithOwner === 'googlechrome/modern-web-guidance-src' ||
      (ownerLogin === 'googlechrome' && repoName === 'modern-web-guidance-src'));

  return {
    title: data.title ?? '',
    body: data.body ?? '',
    state: data.state ?? 'OPEN',
    isDraft: Boolean(data.isDraft),
    additions: Number(data.additions ?? 0),
    deletions: Number(data.deletions ?? 0),
    headRefOid: data.headRefOid ?? '',
    headRefName: data.headRefName ?? '',
    isSameRepo,
    author,
    authorIsBot,
    labels: (data.labels || []).map(l => l.name ?? '').filter(Boolean),
    files: (data.files || []).map(f => f.path ?? '').filter(Boolean),
    reviewRequests: (data.reviewRequests || []).map(r => r.login ?? '').filter(Boolean),
    reviews,
    participantLogins: Array.from(participants),
    comments,
    claState
  };
}

export interface CompactTimelineEvent {
  event?: string | null;
  actorLogin?: string | null;
  actorType?: string | null;
  label?: string | null;
  assignee?: string | null;
  reviewer?: string | null;
}

export interface IssueTimelineSummary {
  unlabeledLower: Set<string>;
  unassignedLower: Set<string>;
  removedReviewersLower: Set<string>;
  botRequestedLower: Set<string>;
}

export function parseIssueTimelineEvents(events: readonly CompactTimelineEvent[]): IssueTimelineSummary {
  const unlabeledLower = new Set<string>();
  const unassignedLower = new Set<string>();
  const removedReviewersLower = new Set<string>();
  const botRequestedLower = new Set<string>();

  for (const ev of events) {
    const actorIsBot = isBotLogin(ev.actorLogin, ev.actorType === 'Bot');
    if (ev.event === 'review_requested' && ev.reviewer) {
      const reviewerLower = ev.reviewer.toLowerCase();
      if (actorIsBot) botRequestedLower.add(reviewerLower);
      else botRequestedLower.delete(reviewerLower);
    } else if (!actorIsBot) {
      if (ev.event === 'unlabeled' && ev.label) {
        unlabeledLower.add(ev.label.toLowerCase());
      } else if (ev.event === 'unassigned' && ev.assignee) {
        unassignedLower.add(ev.assignee.toLowerCase());
      } else if (ev.event === 'review_request_removed' && ev.reviewer) {
        removedReviewersLower.add(ev.reviewer.toLowerCase());
      }
    }
  }

  return { unlabeledLower, unassignedLower, removedReviewersLower, botRequestedLower };
}

export interface IssueSnapshot {
  body: string;
  labels: string[];
  assignees: string[];
}

export interface GhEditSpec {
  addLabels?: readonly string[];
  removeLabels?: readonly string[];
  addAssignees?: readonly string[];
  addReviewers?: readonly string[];
  removeReviewers?: readonly string[];
}

function isHttpStatus(err: unknown, codes: readonly number[]): boolean {
  const stderr = String((err as { stderr?: unknown }).stderr ?? '');
  return codes.some(code => stderr.includes(`HTTP ${code}`));
}

export const githubApi = {
  getIssueSnapshot(issueNumber: number): IssueSnapshot {
    const raw = child_process.execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--json', 'body,labels,assignees'],
      { encoding: 'utf8' }
    );
    const data: {
      body?: string | null;
      labels?: Array<{ name?: string }>;
      assignees?: Array<{ login?: string }>;
    } = JSON.parse(raw);
    return {
      body: (data.body ?? '').trim(),
      labels: (data.labels || []).map(l => l.name ?? '').filter(Boolean),
      assignees: (data.assignees || []).map(a => a.login ?? '').filter(Boolean)
    };
  },

  getIssueTimelineSummary(issueOrPrNumber: number): IssueTimelineSummary {
    const jqExpr =
      '.[] | {event, actorLogin: .actor.login, actorType: .actor.type, label: .label.name, assignee: .assignee.login, reviewer: .requested_reviewer.login} | tojson';
    const raw = child_process.execFileSync(
      'gh',
      ['api', `repos/{owner}/{repo}/issues/${issueOrPrNumber}/events`, '--paginate', '--jq', jqExpr],
      { encoding: 'utf8' }
    );
    const events: CompactTimelineEvent[] = raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => JSON.parse(l) as CompactTimelineEvent);
    return parseIssueTimelineEvents(events);
  },

  editItem(kind: 'issue' | 'pr', number: number, edits: GhEditSpec): void {
    const base = [kind, 'edit', String(number)];
    const args = [...base];
    if (edits.addLabels?.length) args.push('--add-label', edits.addLabels.join(','));
    if (edits.removeLabels?.length) args.push('--remove-label', edits.removeLabels.join(','));
    if (edits.addAssignees?.length) args.push('--add-assignee', edits.addAssignees.join(','));
    if (edits.removeReviewers?.length) args.push('--remove-reviewer', edits.removeReviewers.join(','));
    if (edits.addReviewers?.length && !edits.removeReviewers?.length) {
      args.push('--add-reviewer', edits.addReviewers.join(','));
    }
    if (args.length > 3) {
      child_process.execFileSync('gh', args, { stdio: 'inherit' });
    }
    if (edits.addReviewers?.length && edits.removeReviewers?.length) {
      child_process.execFileSync('gh', [...base, '--add-reviewer', edits.addReviewers.join(',')], {
        stdio: 'inherit'
      });
    }
  },

  getPrFileContent(prNumber: number, filePath: string): string | null {
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (normalizedPath.includes('..') || !normalizedPath.startsWith('guides/')) return null;
    const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
    try {
      return child_process.execFileSync(
        'gh',
        [
          'api',
          `repos/{owner}/{repo}/contents/${encodedPath}?ref=refs/pull/${prNumber}/head`,
          '-H',
          'Accept: application/vnd.github.raw+json'
        ],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (err) {
      if (isHttpStatus(err, [404])) return null;
      throw err;
    }
  },

  updatePrBody(prNumber: number, body: string): void {
    child_process.execFileSync('gh', ['pr', 'edit', String(prNumber), '--body-file', '-'], {
      input: body,
      stdio: ['pipe', 'ignore', 'inherit']
    });
  },

  hasUserWriteAccess(username: string): boolean {
    const trimmed = username.trim();
    if (!trimmed) return false;
    try {
      const out = child_process
        .execFileSync(
          'gh',
          ['api', `repos/{owner}/{repo}/collaborators/${encodeURIComponent(trimmed)}/permission`, '--jq', '.user.permissions.push // false'],
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        )
        .trim();
      return out === 'true';
    } catch (err) {
      const stderr = String((err as { stderr?: unknown }).stderr ?? '');
      if (isHttpStatus(err, [404]) || stderr.includes('is not a user')) return false;
      throw err;
    }
  },

  getPrIntakeMetadata(prNumber: number): PrIntakeMetadata {
    const raw = child_process.execFileSync(
      'gh',
      [
        'pr',
        'view',
        String(prNumber),
        '--json',
        'title,body,state,isDraft,isCrossRepository,additions,deletions,headRefOid,headRefName,headRepository,headRepositoryOwner,author,labels,files,reviewRequests,reviews,comments,statusCheckRollup'
      ],
      { encoding: 'utf8' }
    );
    return parsePrIntakeMetadata(JSON.parse(raw) as RawGhPrView);
  },

  getLinkedIssueInfo(issueNumber: number): LinkedIssueInfo | null {
    try {
      const raw = child_process.execFileSync(
        'gh',
        ['api', `repos/{owner}/{repo}/issues/${issueNumber}`],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const iss: {
        number?: number;
        state?: string;
        pull_request?: unknown;
        user?: { login?: string } | null;
        labels?: Array<{ name?: string }>;
        assignees?: Array<{ login?: string }>;
      } = JSON.parse(raw);
      if (iss.pull_request) return null;
      return {
        number: Number(iss.number),
        state: String(iss.state).toLowerCase() === 'open' ? 'open' : 'closed',
        author: iss.user?.login ?? '',
        labels: (iss.labels || []).map(l => l.name ?? '').filter(Boolean),
        assignees: (iss.assignees || []).map(a => a.login ?? '').filter(Boolean)
      };
    } catch (err) {
      if (isHttpStatus(err, [404, 410])) return null;
      throw err;
    }
  },

  addPrComment(prNumber: number, body: string): void {
    child_process.execFileSync('gh', ['pr', 'comment', String(prNumber), '--body-file', '-'], {
      input: body,
      stdio: ['pipe', 'ignore', 'inherit']
    });
  },

  closePr(prNumber: number): void {
    child_process.execFileSync('gh', ['pr', 'close', String(prNumber)], { stdio: 'inherit' });
  },

  findOpenAwaitingClaPrsForSha(headSha: string): number[] {
    if (!headSha) return [];
    const raw = child_process.execFileSync(
      'gh',
      ['pr', 'list', '--state', 'open', '--label', AWAITING_CLA_LABEL, '--limit', '200', '--json', 'number,headRefOid'],
      { encoding: 'utf8' }
    );
    const items: Array<{ number: number; headRefOid?: string }> = JSON.parse(raw);
    return items.filter(i => i.headRefOid === headSha).map(i => i.number);
  },

  getGuideBlamePorcelain(guideAbsPath: string): string | null {
    try {
      return gitExec(
        ['-C', path.dirname(guideAbsPath), 'blame', '-w', '-M', '--line-porcelain', '--', path.basename(guideAbsPath)],
        { stdio: ['pipe', 'pipe', 'ignore'] }
      );
    } catch {
      return null;
    }
  },

  getCommitAuthorLogin(sha: string): string | null {
    try {
      const out = child_process
        .execFileSync(
          'gh',
          ['api', `repos/{owner}/{repo}/commits/${encodeURIComponent(sha)}`, '--jq', '.author.login // ""'],
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        )
        .trim();
      return out || null;
    } catch (err) {
      if (isHttpStatus(err, [404, 422])) return null;
      throw err;
    }
  },

  getOpenPrReviewCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    try {
      const raw = child_process.execFileSync(
        'gh',
        ['pr', 'list', '--state', 'open', '--limit', '500', '--json', 'reviewRequests'],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      const prs: Array<{ reviewRequests?: Array<{ login?: string }> }> = JSON.parse(raw);
      for (const pr of prs) {
        for (const req of pr.reviewRequests || []) {
          const login = req.login?.toLowerCase();
          if (login) counts.set(login, (counts.get(login) ?? 0) + 1);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch open PR review counts:', err);
    }
    return counts;
  }
};
