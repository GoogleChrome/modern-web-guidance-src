import { Agents } from '../config.ts';
import {
  pickHigherPrecedenceEffort,
  REASONING_EFFORT_SOURCES,
  sanitizeReasoningEffort,
} from '../../dashboard/agents.js';

export { pickHigherPrecedenceEffort, REASONING_EFFORT_SOURCES, sanitizeReasoningEffort };

export type ReasoningEffortSource = (typeof REASONING_EFFORT_SOURCES)[number];

export interface ReasoningEffort {
  /** Normalized lowercase token, e.g. 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'off'. Free-form; not an enum. */
  level?: string;
  /** How we learned it. Precedence: observed > configured > model-id > agent-default */
  source: ReasoningEffortSource;
}

export interface EffortAdapter {
  /** Env var read by the harness, e.g. 'CODEX_EFFORT'. Omit if the agent has no CLI effort flag. */
  envVar?: string;
  /** Map a normalized level to CLI flags. */
  toCliArgs?(level: string): string[];
  /** Extract a baked-in level from a model ID. Defaults to `defaultLevelFromModelId`. */
  levelFromModelId?(modelId: string): string | undefined;
}

const MODEL_ID_LEVEL_SUFFIX_RE =
  /(?:[-:](low|medium|high|xhigh|max|minimal|none|off)|\s+\((low|medium|high|xhigh|max|minimal|none|off)\))$/i;

/**
 * Extracts a trailing `-<level>`, `:<level>`, or balanced ` (<level>)` reasoning/thinking
 * tier suffix from a model identifier (case-insensitively), returning the normalized lowercase
 * token or `undefined` when the model ID does not end in a known effort tier.
 */
export function defaultLevelFromModelId(modelId: string): string | undefined {
  const trimmed = modelId.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return undefined;
  }
  const match = MODEL_ID_LEVEL_SUFFIX_RE.exec(trimmed);
  if (!match || match.index === 0) {
    return undefined;
  }
  return (match[1] ?? match[2]).toLowerCase();
}

export const EFFORT_ADAPTERS: Record<Agents, EffortAdapter> = {
  [Agents.ANTIGRAVITY_CLI]: {
    envVar: 'ANTIGRAVITY_EFFORT',
    toCliArgs: (level) => ['--effort', level],
  },
  [Agents.JETSKI_CLI]: {
    envVar: 'JETSKI_EFFORT',
    toCliArgs: (level) => ['--effort', level],
  },
  [Agents.CLAUDE_CODE]: {
    envVar: 'CLAUDE_EFFORT',
    toCliArgs: (level) => ['--effort', level],
  },
  [Agents.CODEX_CLI]: {
    envVar: 'CODEX_EFFORT',
    toCliArgs: (level) => ['-c', `model_reasoning_effort=${level}`],
  },
  [Agents.PI]: {
    // Pi configures thinking level via PI_MODEL's `:<thinking>` suffix (model-id / observed).
  },
};

function resolveKnownAgent(rawAgent?: string): Agents | undefined {
  if (!rawAgent) return undefined;
  const normalized = rawAgent.trim().toLowerCase().replace(/-/g, '_');
  return (Object.values(Agents) as string[]).includes(normalized)
    ? (normalized as Agents)
    : undefined;
}

/**
 * Resolves CLI arguments for an agent's configured `<AGENT>_EFFORT` environment variable.
 * Throws if `<AGENT>_EFFORT` is set alongside a model ID that already bakes in a level suffix.
 */
export function resolveEffortCliArgs(
  agent: Agents,
  modelId?: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const adapter = EFFORT_ADAPTERS[agent];
  if (!adapter?.envVar) {
    return [];
  }

  const raw = env[adapter.envVar];
  if (!raw || !raw.trim()) {
    return [];
  }

  const trimmedRaw = raw.trim();
  const level = trimmedRaw.toLowerCase();

  const trimmedModel = modelId?.trim();
  if (trimmedModel) {
    const extractLevel = adapter.levelFromModelId ?? defaultLevelFromModelId;
    const bakedLevel = extractLevel(trimmedModel);
    if (bakedLevel) {
      throw new Error(
        `${adapter.envVar}=${trimmedRaw} conflicts with model '${trimmedModel}' which already bakes in reasoning effort '${bakedLevel}'.`,
      );
    }
  }

  return adapter.toCliArgs ? adapter.toCliArgs(level) : [];
}

export interface ResolveReasoningEffortOptions {
  agent?: string;
  model?: string;
  observed?: string | ReasoningEffort;
  /**
   * Pre-existing effort (e.g. from an earlier `trajectory_summary.json` during offline
   * re-normalization when the original run's `<AGENT>_EFFORT` or `PI_MODEL` env vars
   * are no longer present in `process.env`).
   */
  fallback?: ReasoningEffort;
  env?: NodeJS.ProcessEnv;
}

function normalizeToken(raw?: string): string | undefined {
  const trimmed = raw?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function resolveLiveReasoningEffort(options: ResolveReasoningEffortOptions): ReasoningEffort {
  const env = options.env ?? process.env;
  const knownAgent = resolveKnownAgent(options.agent);
  const adapter = knownAgent ? EFFORT_ADAPTERS[knownAgent] : undefined;
  const extractLevel = adapter?.levelFromModelId ?? defaultLevelFromModelId;

  // 1. Observed from agent logs (highest trust; silently wins over configured).
  const observedToken =
    typeof options.observed === 'string'
      ? normalizeToken(options.observed)
      : options.observed?.source === 'observed'
        ? normalizeToken(options.observed.level)
        : undefined;
  if (observedToken) {
    return { level: observedToken, source: 'observed' };
  }

  // 2. Configured via `<AGENT>_EFFORT` env var.
  if (adapter?.envVar) {
    const configuredToken = normalizeToken(env[adapter.envVar]);
    if (configuredToken) {
      return { level: configuredToken, source: 'configured' };
    }
  }

  // 3. Baked into the model ID (`-<level>`, `:<level>`, or ` (<level>)`).
  if (options.model) {
    const modelLevel = extractLevel(options.model);
    if (modelLevel) {
      return { level: modelLevel, source: 'model-id' };
    }
  }

  // Pi strips `:<thinking>` from model IDs written into message logs; inspect live PI_MODEL / PROMPT_MODEL
  // when the logged model is unknown or matches the base model of PI_MODEL / PROMPT_MODEL.
  if (knownAgent === Agents.PI) {
    const rawPiModel = (env.PI_MODEL || env.PROMPT_MODEL)?.trim();
    if (rawPiModel) {
      const piLevel = extractLevel(rawPiModel);
      if (piLevel) {
        const piBase = rawPiModel.replace(MODEL_ID_LEVEL_SUFFIX_RE, '').toLowerCase();
        const logged = options.model?.trim().toLowerCase();
        if (!logged || logged === 'unknown' || logged === piBase || piBase.endsWith(`/${logged}`)) {
          return { level: piLevel, source: 'model-id' };
        }
      }
    }
  }

  // 4. Unknown / CLI built-in default.
  return { source: 'agent-default' };
}

/**
 * Resolves a run or suite's `ReasoningEffort` using strict precedence:
 * `observed > configured > model-id > agent-default`.
 *
 * When both `observed` and `configured` exist and disagree, `observed` wins silently.
 */
export function resolveReasoningEffort(options: ResolveReasoningEffortOptions): ReasoningEffort {
  const liveResolved = resolveLiveReasoningEffort(options);
  const normalizedFallback = sanitizeReasoningEffort(
    options.fallback?.level !== undefined
      ? { ...options.fallback, level: normalizeToken(options.fallback.level) }
      : options.fallback,
  );
  return pickHigherPrecedenceEffort(liveResolved, normalizedFallback) ?? liveResolved;
}
