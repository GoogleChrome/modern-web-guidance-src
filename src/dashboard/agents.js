/**
 * Single source of truth for coding-agent display names, badges, and headline families.
 * Add or rename agents here so the hero, A/B spotlight, and suite tables stay in sync.
 */

/** @typedef {'gemini' | 'openai' | 'claude'} AgentBadgeKind */
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
    gemini_cli: { label: 'Gemini CLI', badge: 'gemini' },
};

/**
 * Agent families pooled into the headline numbers, in display order. Only agents on the
 * nightly schedule belong here; `gemini_cli` is intentionally excluded because it only
 * appears in ad hoc runs, which would skew the "latest nightly per agent" comparison.
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
const BADGE_GLYPHS = { gemini: '✦', openai: '❂', claude: '✱' };

/**
 * Falls back to substring matching for agent ids that aren't registered (e.g. ad hoc
 * suites that report a model vendor rather than a CLI id).
 * @param {string} name
 * @returns {AgentBadgeKind | undefined} */
function inferBadgeKind(name) {
    if (name.includes('gemini') || name.includes('jetski') || name.includes('antigravity')) return 'gemini';
    if (name.includes('codex') || name.includes('openai')) return 'openai';
    if (name.includes('claude')) return 'claude';
    return undefined;
}

/** @param {string} agentName
 * @returns {string} */
export function getAgentBadge(agentName) {
    const name = (agentName || '').toLowerCase();
    const kind = AGENTS[name]?.badge ?? inferBadgeKind(name);
    return kind ? `<span class="agent-badge ${kind}" aria-hidden="true">${BADGE_GLYPHS[kind]}</span>` : '';
}
