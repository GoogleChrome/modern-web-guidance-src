import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseEnv } from 'node:util';
import { PI_AGENT_PATH_PATTERN } from '../../cli/telemetry/detect-agent.ts';
import { rootDir as defaultRootDir } from '../../core/paths.ts';

export interface SecretPattern {
  readonly name: string;
  readonly re: RegExp;
}

/**
 * High-confidence credential patterns safe for both text redaction and binary
 * fail-closed scans. Generic `AIzaSy...` and `sk-...` are omitted from binary
 * scans because public DevSite docs and prose in `.db` files contain client keys.
 */
export const PRIVATE_SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: 'anthropic key', re: /(?<![A-Za-z0-9_+/])sk-ant-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/g },
  { name: 'openrouter key', re: /(?<![A-Za-z0-9_+/])sk-or-v1-[0-9a-f]{48,}(?![0-9a-f])/gi },
  { name: 'openai project key', re: /(?<![A-Za-z0-9_+/])sk-proj-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/g },
  { name: 'openai service key', re: /(?<![A-Za-z0-9_+/])sk-svcacct-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/g },
  { name: 'oauth token', re: /(?<![A-Za-z0-9_+/])ya29\.(?=[0-9A-Za-z_.-]{20,})[0-9A-Za-z_-]+(?:\.[0-9A-Za-z_-]+)*(?![A-Za-z0-9_+/])/g },
  { name: 'google oauth refresh token', re: /(?<![A-Za-z0-9_+/])1\/\/0[0-9A-Za-z_-]{30,}(?![A-Za-z0-9_+/])/g },
  { name: 'github token', re: /(?<![A-Za-z0-9_+/])(?:gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{30,})(?![A-Za-z0-9_+/])/g },
  { name: 'npm token', re: /(?<![A-Za-z0-9_+/])npm_[A-Za-z0-9]{36}(?![A-Za-z0-9_+/])/g },
  { name: 'aws access key', re: /(?<![A-Za-z0-9_+/])(?!AKIAIOSFODNN7EXAMPLE)(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9_+/])/g },
  {
    name: 'private key',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:\r?\n\+?|\\r\\n|\\n)[A-Za-z0-9+/]{32,}[A-Za-z0-9+/=]*(?:(?:\r?\n\+?|\\r\\n|\\n)[A-Za-z0-9+/=]+)*(?:(?:\r?\n\+?|\\r\\n|\\n)[ \t]*-----END [A-Z ]*PRIVATE KEY-----)?/g,
  },
];

/**
 * Pattern set shared with `src/harness/public/scrub.ts` and text redaction.
 * `secret key` avoids hyphens/underscores after `sk-` so kebab-case CSS classes
 * (e.g. SpinKit `sk-placeholder-shimmer`) do not false-positive.
 */
export const PUBLIC_SECRET_PATTERNS: readonly SecretPattern[] = [
  ...PRIVATE_SECRET_PATTERNS,
  { name: 'google api key', re: /(?<![A-Za-z0-9_+/])AIzaSy[0-9A-Za-z_-]{33}(?![A-Za-z0-9_+/])/g },
  { name: 'secret key', re: /(?<![A-Za-z0-9_+/])sk-[A-Za-z0-9]{20,}(?![A-Za-z0-9_+/-])/g },
];

const CREDENTIAL_ENV_KEY_FRAGMENT =
  '(?:[A-Za-z0-9_]*_(?:API_KEY|SECRET_KEY|ACCESS_KEY|SECRET_ACCESS_KEY|SECRET|AUTH_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|ID_TOKEN|PRIVATE_KEY|PASSWORD|PASSWD|PASSPHRASE)' +
  '|(?:GITHUB|GH|NPM|HF|OPENROUTER|GEMINI|GOOGLE|ANTHROPIC|OPENAI|GD_GCS|SLACK|STRIPE|GITLAB|VERCEL|NETLIFY)_[A-Z0-9_]*(?:TOKEN|KEY|SECRET))';

const SECRET_ENV_KEY_RE = new RegExp(`^(?:${CREDENTIAL_ENV_KEY_FRAGMENT})$`, 'i');

const STRUCTURED_SECRET_RULES = [
  { name: 'google api key log', re: /(Overriding API key [A-Z0-9_]+ with value )AIzaSy[0-9A-Za-z_-]{33}\b/g, replace: '$1[REDACTED]' },
  { name: 'npmrc auth credential', re: /(:(?:_authToken|_auth|_password)\s*=\s*['"]?)(?!\[REDACTED\])[^\s'"\\]{8,}/g, replace: '$1[REDACTED]' },
  { name: 'secret env assignment', re: new RegExp(`((?:^|[^A-Za-z0-9_])${CREDENTIAL_ENV_KEY_FRAGMENT}['"]?\\s*[:=]\\s*['"]?)(?!\\[REDACTED\\])[A-Za-z0-9_/.+-]{16,}`, 'g'), replace: '$1[REDACTED]' },
] as const;

// Kept text-only because captured tutorial code in `.db` payloads often contains sample Bearer headers.
const TEXT_REDACTION_RULES = [
  ...STRUCTURED_SECRET_RULES,
  { name: 'bearer auth header', re: /(Authorization\s*[:=]\s*(?:Bearer|Basic)\s+)(?!\[REDACTED\])[A-Za-z0-9_/.+-]{20,}/gi, replace: '$1[REDACTED]' },
] as const;

const BINARY_TEST_PATTERNS: readonly SecretPattern[] = [...PRIVATE_SECRET_PATTERNS, ...STRUCTURED_SECRET_RULES]
  .map(({ name, re }) => ({ name, re: new RegExp(re.source, re.flags.replace('g', '')) }));

export const BASE64_TRAJECTORY_SCRIPT_RE = /<script\b[^>]*\btype=["']application\/base64["'][^>]*>([\s\S]*?)<\/script>/gi;

const CORE_OS_ENV_KEYS = [
  'PATH', 'HOME', 'ZDOTDIR', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'COLORTERM',
  'TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'LANG', 'LANGUAGE', 'TZ', 'TMPDIR', 'TMP',
  'TEMP', 'SHLVL', 'PWD', 'DISPLAY', 'WAYLAND_DISPLAY', 'DBUS_SESSION_BUS_ADDRESS',
  'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME',
  'GPG_AGENT_INFO', 'CI', 'NO_COLOR', 'FORCE_COLOR', 'COLOR', 'NODE_TEST_CONTEXT',
  'DISABLE_TELEMETRY', 'NODE_OPTIONS', 'NODE_ENV', 'NODE_COMPILE_CACHE', 'NODE_V8_COVERAGE',
  'CHROME_PATH', 'PNPM_HOME', 'COREPACK_HOME', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
  'ALL_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'all_proxy', 'SSL_CERT_FILE',
  'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS', 'CURL_CA_BUNDLE', 'REQUESTS_CA_BUNDLE',
  'SYSTEMROOT', 'COMSPEC', 'WINDIR', 'OS', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA',
  'PROGRAMFILES', 'PROGRAMFILES(X86)', 'COMMONPROGRAMFILES', 'USERPROFILE', 'HOMEDRIVE',
  'HOMEPATH', 'PROCESSOR_ARCHITECTURE',
] as const;

export const ALLOWED_ENV_PREFIXES: readonly string[] = ['LC_', 'PLAYWRIGHT_', 'PW_'];

export const ALLOWED_CHILD_ENV_KEYS: ReadonlySet<string> = new Set([
  ...CORE_OS_ENV_KEYS,
  'IS_SANDBOX', 'AGY_ADC_AUTH', 'GOOGLE_CLOUD_PROJECT',
  'CLAUDE_CODE_USE_VERTEX', 'ANTHROPIC_VERTEX_PROJECT_ID', 'CLOUD_ML_REGION', 'ANTHROPIC_MODEL',
  'ANTIGRAVITY_GCP_PROJECT', 'ANTIGRAVITY_MODEL', 'JETSKI_MODEL', 'JETSKI_DIR', 'CODEX_MODEL',
  'PI_MODEL', 'PROMPT_MODEL', 'GD_UNSAFE_NO_SANDBOX', 'PWTEST_CACHE_DIR',
]);

export const ALLOWED_WRAPPER_ENV_KEYS: ReadonlySet<string> = new Set([
  ...ALLOWED_CHILD_ENV_KEYS,
  'GD_SUITE_CONFIG', 'GD_ISOLATED_HOME', 'BASELINE_TARGET', 'PI_NO_SESSION', 'PI_BIN',
  'PI_WORKERS', 'PI_SUITE_NAME', 'CODEX_CLI_BIN', 'CLAUDE_CODE_CLI_BIN',
  'ANTIGRAVITY_CLI_BIN', 'JETSKI_CLI_BIN', 'GOOGLE_APPLICATION_CREDENTIALS',
  'ENABLE_FILE_LOGGING', 'MODERN_WEB_LOG_DIR', 'SMOKE_AGENT', 'FULL',
  'NPM_CONFIG_USERCONFIG', 'npm_config_userconfig',
]);

export const ALLOWED_GRADER_ENV_KEYS: ReadonlySet<string> = new Set([
  ...CORE_OS_ENV_KEYS,
  'PATCH_FILE', 'BASELINE_TARGET', 'TARGET_FILE', 'TARGET_URL', 'PAGE_LOAD_OUTPUT',
  'SERVER_PIDS_FILE', 'PORT', 'GD_PREBUILT_TARGET_URL', 'GD_PREBUILT_TARGET_ERROR',
  'PWTEST_CACHE_DIR',
]);

/** Non-secret config keys accepted from `.env` so `.env` never injects credentials into `process.env`. */
export const ALLOWED_DOTENV_KEYS: ReadonlySet<string> = new Set([
  'PI_MODEL', 'PROMPT_MODEL', 'PI_WORKERS', 'PI_SUITE_NAME', 'PI_BIN', 'PI_NO_SESSION',
  'CLAUDE_CODE_CLI_BIN', 'ANTHROPIC_MODEL',
  'CLAUDE_CODE_USE_VERTEX', 'ANTHROPIC_VERTEX_PROJECT_ID', 'CLOUD_ML_REGION',
  'CODEX_CLI_BIN', 'CODEX_MODEL', 'ANTIGRAVITY_CLI_BIN', 'ANTIGRAVITY_GCP_PROJECT',
  'ANTIGRAVITY_MODEL', 'JETSKI_CLI_BIN', 'JETSKI_MODEL',
  'SMOKE_AGENT', 'DISABLE_TELEMETRY', 'ENABLE_FILE_LOGGING',
  'MODERN_WEB_LOG_DIR', 'DEBUG_MWG_TELEMETRY', 'GD_UNSAFE_NO_SANDBOX',
]);

const warnedEnvFiles = new Set<string>();

function readUtf8IfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Returns true if a `.env` key is allowed non-secret configuration. */
export function isAllowedDotenvKey(key: string): boolean {
  if (SECRET_ENV_KEY_RE.test(key)) return false;
  return ALLOWED_DOTENV_KEYS.has(key) || /_(?:MODEL|EFFORT)$/i.test(key);
}

export function loadAllowedEnvFile(
  envPath: string,
  targetEnv: NodeJS.ProcessEnv = process.env,
  options: { warn?: boolean } = {},
): { loaded: string[]; ignored: string[] } {
  const content = readUtf8IfExists(envPath);
  if (content === null) return { loaded: [], ignored: [] };

  const loaded: string[] = [];
  const ignored: string[] = [];
  for (const [key, value] of Object.entries(parseEnv(content))) {
    if (isAllowedDotenvKey(key)) {
      if (targetEnv[key] === undefined) targetEnv[key] = value;
      loaded.push(key);
    } else {
      ignored.push(key);
    }
  }

  if (options.warn && ignored.length > 0 && !process.env.NODE_TEST_CONTEXT) {
    const warnKey = `${envPath}:${ignored.join(',')}`;
    if (!warnedEnvFiles.has(warnKey)) {
      warnedEnvFiles.add(warnKey);
      console.warn(`⚠️ Ignored non-allowlisted .env keys (${ignored.join(', ')}); agent runs use isolated credentials instead.`);
    }
  }
  return { loaded, ignored };
}

export function filterAllowedEnv(
  sourceEnv: NodeJS.ProcessEnv,
  allowedKeys: ReadonlySet<string>,
  allowedPrefixes: readonly string[] = ALLOWED_ENV_PREFIXES,
  overrides?: NodeJS.ProcessEnv,
  options: { filterKiroTerm?: boolean } = {},
): NodeJS.ProcessEnv {
  const upperAllowed = process.platform === 'win32' ? new Set([...allowedKeys].map(k => k.toUpperCase())) : null;
  const sanitized: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue;
    if (options.filterKiroTerm && key === 'TERM_PROGRAM' && /kiro/i.test(value)) continue;
    if (key.toUpperCase() === 'PATH') {
      const cleaned = value.split(path.delimiter).filter(e => e && !PI_AGENT_PATH_PATTERN.test(e)).join(path.delimiter);
      sanitized.PATH = sanitized.PATH && cleaned ? `${sanitized.PATH}${path.delimiter}${cleaned}` : (sanitized.PATH || cleaned);
      continue;
    }
    if (allowedKeys.has(key) || upperAllowed?.has(key.toUpperCase()) || allowedPrefixes.some(p => key.startsWith(p))) {
      sanitized[key] = value;
    }
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      const targetKey = key.toUpperCase() === 'PATH' ? 'PATH' : key;
      if (value === undefined) delete sanitized[targetKey];
      else sanitized[targetKey] = value;
    }
  }
  return sanitized;
}

const normalizeRegistryScope = (raw: string): string =>
  raw.trim().replace(/^['"]|['"]$/g, '').replace(/^https?:\/\//i, '').replace(/^\/\//, '').replace(/\/+$/, '').toLowerCase();

const isSameOrSubpath = (a: string, b: string): boolean => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

function processNpmrc(content: string): { sanitized: string; secrets: string[] } {
  const secrets: string[] = [];
  const strippedScopes = new Set<string>();
  let hasUnscopedAuth = false;
  const entries: { scope: string | null; line: string }[] = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const eqIndex = trimmed.indexOf('=');
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';') || eqIndex <= 0) {
      entries.push({ scope: null, line });
      continue;
    }

    const rawKey = trimmed.slice(0, eqIndex).trim();
    const rawVal = trimmed.slice(eqIndex + 1).trim();
    const authMatch = rawKey.match(/^(?:(\/\/[^:\s]+):)?(_authToken|_auth|_password|username)$/i);
    if (authMatch || /^always-auth$/i.test(rawKey)) {
      const scope = authMatch?.[1] ? normalizeRegistryScope(authMatch[1]) : null;
      const unquoted = rawVal.replace(/^['"]|['"]$/g, '');
      const isSecret = Boolean(authMatch && !/^username$/i.test(authMatch[2]) && unquoted.length >= 8 && !/^\$\{[^}]+\}$/.test(unquoted));
      if (isSecret) secrets.push(unquoted);
      if (scope) strippedScopes.add(scope);
      else if (isSecret) hasUnscopedAuth = true;
      continue;
    }

    const scopedMatch = rawKey.match(/^(\/\/[^:\s]+):/);
    const scope = scopedMatch
      ? normalizeRegistryScope(scopedMatch[1])
      : (/^(?:@[^:\s]+:)?registry$/i.test(rawKey) ? normalizeRegistryScope(rawVal) : null);
    entries.push({ scope, line });
  }

  const kept = entries
    .filter(({ scope }) => !scope || (!hasUnscopedAuth && ![...strippedScopes].some(s => isSameOrSubpath(scope, s))))
    .map(({ line }) => sanitizeTextSecrets(line, []))
    .join('\n')
    .trim();
  return { sanitized: kept ? `${kept}\n` : '', secrets };
}

export const sanitizeNpmrc = (content: string): string => processNpmrc(content).sanitized;

export function copySanitizedNpmrc(srcPath: string, destPath: string): void {
  const raw = readUtf8IfExists(srcPath);
  if (raw === null) return;
  const { sanitized } = processNpmrc(raw);
  if (!sanitized) return;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, sanitized, { encoding: 'utf8', mode: 0o600 });
}

export function collectHostSecrets(options: {
  rootDir?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
} = {}): string[] {
  const secrets = new Set<string>();
  const maybeAdd = (raw: string | undefined) => {
    const val = raw?.trim();
    if (val && val.length >= 16 && !val.startsWith('/') && !/^https?:\/\/localhost(?::|\/|$)/i.test(val)) {
      secrets.add(val);
    }
  };

  for (const [key, value] of Object.entries(options.env ?? process.env)) {
    if (key !== 'GOOGLE_APPLICATION_CREDENTIALS' && key !== 'PUBLIC_EVALS_FORBIDDEN_TOKENS' && SECRET_ENV_KEY_RE.test(key)) {
      maybeAdd(value);
    }
  }

  const envRaw = readUtf8IfExists(path.join(options.rootDir ?? defaultRootDir, '.env'));
  if (envRaw !== null) {
    try {
      for (const [key, value] of Object.entries(parseEnv(envRaw))) {
        if (key !== 'GOOGLE_APPLICATION_CREDENTIALS' && !isAllowedDotenvKey(key)) {
          maybeAdd(value);
        }
      }
    } catch {
      // Ignore malformed .env when collecting literal needles
    }
  }

  let defaultHome: string;
  try {
    defaultHome = os.userInfo().homedir;
  } catch {
    defaultHome = os.homedir();
  }
  const npmrcRaw = readUtf8IfExists(path.join(options.homeDir ?? defaultHome, '.npmrc'));
  if (npmrcRaw !== null) {
    for (const secret of processNpmrc(npmrcRaw).secrets) secrets.add(secret);
  }

  const envSource = options.env ?? process.env;
  const userConfig = envSource.NPM_CONFIG_USERCONFIG || envSource.npm_config_userconfig;
  if (userConfig) {
    const userConfigRaw = readUtf8IfExists(userConfig);
    if (userConfigRaw !== null) {
      for (const secret of processNpmrc(userConfigRaw).secrets) secrets.add(secret);
    }
  }

  return [...secrets].sort((a, b) => b.length - a.length);
}

let cachedHostSecrets: readonly string[] | null = null;
export function getHostSecrets(): readonly string[] {
  return (cachedHostSecrets ??= collectHostSecrets());
}

export function sanitizeTextSecrets(
  text: string,
  extraSecrets: readonly string[] = getHostSecrets(),
  options: { preserveBase64Scripts?: boolean } = {},
): string {
  const redact = (input: string): string => {
    let out = input;
    for (const secret of extraSecrets) {
      if (secret.length >= 8 && out.includes(secret)) out = out.replaceAll(secret, '[REDACTED]');
    }
    for (const rule of TEXT_REDACTION_RULES) out = out.replace(rule.re, rule.replace);
    for (const { re } of PUBLIC_SECRET_PATTERNS) out = out.replace(re, '[REDACTED]');
    return out;
  };

  if (!options.preserveBase64Scripts) return redact(text);

  const preserved: string[] = [];
  const placeholderText = text.replace(BASE64_TRAJECTORY_SCRIPT_RE, (match) => {
    preserved.push(match);
    return `__MWG_PRESERVED_BASE64_BLOCK_${preserved.length - 1}__`;
  });
  let redacted = redact(placeholderText);
  for (let i = 0; i < preserved.length; i++) {
    redacted = redacted.replace(`__MWG_PRESERVED_BASE64_BLOCK_${i}__`, () => preserved[i]);
  }
  return redacted;
}

export function extractBase64TrajectoryPayloads(html: string): Buffer[] {
  const payloads: Buffer[] = [];
  for (const match of html.matchAll(BASE64_TRAJECTORY_SCRIPT_RE)) {
    const body = match[1].trim();
    if (body) payloads.push(Buffer.from(body, 'base64'));
  }
  return payloads;
}

export function findSecretLeaks(
  input: string | Buffer,
  extraSecrets: readonly string[] = getHostSecrets(),
  options: { scanPatterns?: boolean } = {},
): string[] {
  const hits = new Set<string>();
  const isBuffer = Buffer.isBuffer(input);

  for (const secret of extraSecrets) {
    if (secret.length >= 8 && (isBuffer ? input.includes(secret, 0, 'utf8') : input.includes(secret))) {
      hits.add('host secret');
    }
  }

  if (options.scanPatterns !== false) {
    const text = isBuffer ? input.toString('utf8') : input;
    for (const { name, re } of BINARY_TEST_PATTERNS) {
      if (re.test(text)) hits.add(name);
    }
  }

  return [...hits];
}
