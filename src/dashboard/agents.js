/**
 * Single source of truth for coding-agent display names, badges, and headline families.
 * Add or rename agents here so the hero, A/B spotlight, and suite tables stay in sync.
 */

/** @typedef {'gemini' | 'openai' | 'claude' | 'pi'} AgentBadgeKind */
/** @typedef {Object} AgentDef
 * @property {string} label
 * @property {AgentBadgeKind} [badge] */
/** @typedef {Object} AgentFamilyDef
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string[]} agents */

/** @type {Record<string, AgentDef>} */
export const AGENTS = {
    claude_code: { label: 'Claude Code', badge: 'claude' },
    claude: { label: 'Claude Code', badge: 'claude' },
    codex_cli: { label: 'Codex CLI', badge: 'openai' },
    codex: { label: 'Codex CLI', badge: 'openai' },
    antigravity_cli: { label: 'Antigravity CLI', badge: 'gemini' },
    jetski_cli: { label: 'Jetski CLI', badge: 'gemini' },
    pi: { label: 'Pi CLI', badge: 'pi' },
};

/**
 * Agent families pooled into the headline numbers, in display order. Only agents on the
 * nightly schedule belong here.
 * @type {AgentFamilyDef[]}
 */
export const AGENT_FAMILIES = [
    { id: 'claude_code', label: 'Claude Code', description: 'claude_code', agents: ['claude_code', 'claude'] },
    { id: 'codex_cli', label: 'Codex CLI', description: 'codex_cli', agents: ['codex_cli', 'codex'] },
    {
        id: 'antigravity_cli',
        label: 'Antigravity CLI',
        description: 'antigravity_cli (succeeded jetski_cli)',
        agents: ['antigravity_cli', 'jetski_cli']
    }
];

/** @type {Record<string, string>} */
export const AGENT_DISPLAY_NAMES = Object.fromEntries(Object.entries(AGENTS).map(([id, def]) => [id, def.label]));

/** @type {Record<AgentBadgeKind, string>} */
const BADGE_GLYPHS = { gemini: '✦', openai: '❂', claude: '✱', pi: 'π' };

/**
 * Falls back to substring matching for agent ids that aren't registered (e.g. ad hoc
 * suites that report a model vendor rather than a CLI id).
 * @param {string} name
 * @returns {AgentBadgeKind | undefined} */
function inferBadgeKind(name) {
    if (name.includes('gemini') || name.includes('jetski') || name.includes('antigravity')) return 'gemini';
    if (name.includes('codex') || name.includes('openai')) return 'openai';
    if (name.includes('claude')) return 'claude';
    if (/(?:^|[_-])pi(?:$|[_-])/.test(name)) return 'pi';
    return undefined;
}

/** @param {string} agentName
 * @returns {string} */
export function getAgentBadge(agentName) {
    const name = (agentName || '').toLowerCase();
    const kind = AGENTS[name]?.badge ?? inferBadgeKind(name);
    return kind ? `<span class="agent-badge ${kind}" aria-hidden="true">${BADGE_GLYPHS[kind]}</span>` : '';
}

export const REASONING_EFFORT_SOURCES = /** @type {const} */ ([
    'observed',
    'configured',
    'model-id',
    'agent-default',
]);

const VALID_EFFORT_TOKEN_RE = /^[a-z0-9_-]+$/;

/** @type {Record<import('./evals.d.ts').ReasoningEffortSource, number>} */
const EFFORT_SOURCE_PRECEDENCE = {
    observed: 4,
    configured: 3,
    'model-id': 2,
    'agent-default': 1,
};

/** @type {Record<string, number>} */
const EFFORT_TIER_ORDER = {
    off: 0,
    none: 1,
    minimal: 2,
    low: 3,
    medium: 4,
    high: 5,
    xhigh: 6,
    max: 7,
    default: 99,
};

/**
 * Validates an untrusted `reasoningEffort` value and returns a clean copy with
 * only allowlisted keys, or `undefined` when absent or malformed.
 * @param {unknown} raw
 * @returns {import('./evals.d.ts').ReasoningEffort | undefined}
 */
export function sanitizeReasoningEffort(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const record = /** @type {Record<string, unknown>} */ (raw);
    const { source, level } = record;
    if (source !== 'observed' && source !== 'configured' && source !== 'model-id' && source !== 'agent-default') {
        return undefined;
    }
    if (level === undefined || level === null) {
        return source === 'agent-default' ? { source } : undefined;
    }
    if (typeof level !== 'string' || !VALID_EFFORT_TOKEN_RE.test(level)) {
        return undefined;
    }
    return { level, source };
}

/**
 * Normalizes a missing or untrusted `reasoningEffort` for UI readers so legacy suites
 * without `reasoningEffort` behave identically to `{ source: 'agent-default' }`.
 * @param {unknown} raw
 * @returns {import('./evals.d.ts').ReasoningEffort}
 */
export function normalizeReasoningEffort(raw) {
    return sanitizeReasoningEffort(raw) ?? { source: 'agent-default' };
}

/**
 * Returns the normalized effort level token for display and filtering (`'default'` when unset).
 * @param {unknown} raw
 * @returns {string}
 */
export function getEffortLevel(raw) {
    const norm = normalizeReasoningEffort(raw);
    return norm.level || 'default';
}

/**
 * True when `reasoningEffort` is missing or resolved to `agent-default`.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isDefaultEffort(raw) {
    const norm = normalizeReasoningEffort(raw);
    return norm.source === 'agent-default' || !norm.level;
}

/**
 * Formats the human-readable provenance tooltip / accessible label for a `ReasoningEffort`.
 * @param {unknown} raw
 * @returns {string}
 */
export function getEffortTooltip(raw) {
    const norm = normalizeReasoningEffort(raw);
    const level = norm.level || 'default';
    if (norm.source === 'agent-default' || !norm.level) {
        return 'Reasoning effort: default (CLI built-in default; not explicitly configured or logged)';
    }
    if (norm.source === 'observed') {
        return `Reasoning effort: ${level} (observed from agent logs)`;
    }
    if (norm.source === 'configured') {
        return `Reasoning effort: ${level} (configured by harness)`;
    }
    return `Reasoning effort: ${level} (from model ID)`;
}

/**
 * Compares two effort level tokens in logical tier order (low -> medium -> high -> ... -> default).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareEffortLevels(a, b) {
    if (a === b) return 0;
    const rankA = EFFORT_TIER_ORDER[a] ?? 50;
    const rankB = EFFORT_TIER_ORDER[b] ?? 50;
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
}

/**
 * Picks whichever `ReasoningEffort` has strictly higher source precedence
 * (`observed > configured > model-id > agent-default`), keeping `current` on ties.
 * @param {import('./evals.d.ts').ReasoningEffort | undefined} current
 * @param {import('./evals.d.ts').ReasoningEffort | undefined} candidate
 * @returns {import('./evals.d.ts').ReasoningEffort | undefined}
 */
export function pickHigherPrecedenceEffort(current, candidate) {
    if (!candidate) return current;
    if (!current) return candidate;
    const rankCandidate = candidate.source !== 'agent-default' && !candidate.level
        ? 0
        : (EFFORT_SOURCE_PRECEDENCE[candidate.source] ?? 0);
    const rankCurrent = current.source !== 'agent-default' && !current.level
        ? 0
        : (EFFORT_SOURCE_PRECEDENCE[current.source] ?? 0);
    return rankCandidate > rankCurrent ? candidate : current;
}
