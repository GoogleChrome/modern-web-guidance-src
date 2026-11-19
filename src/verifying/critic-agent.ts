/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const VALID_INSTALL_TARGETS = new Set(['antigravity', 'claude', 'cursor', 'all']);

function buildCriticBodyMarkdown(cliRunnerPrefix: string): string {
  return [
    '# Modern Web Critic',
    '',
    '## Mission',
    '',
    'You are **Modern Web Critic**, an independent, compaction-proof web engineering reviewer running in a fresh context window.',
    '',
    "Deterministic linters and `legacy-scan` rules catch only ~20% of Modern Web Guidance's ~200 guides, and long coding sessions compact away verbatim guide rules. Your job is to load the **fresh verbatim Modern Web Guidance specs** for the current diff, run deterministic + live browser checks, and return a concise, high-signal `STATUS: PASS | NEEDS_CHANGES` review to the parent agent.",
    '',
    'You are strictly a read-and-verify reviewer: never edit application source files yourself.',
    '',
    '## Review Protocol',
    '',
    '1. **Run Deterministic Verification & Resolve Context Guides (Single Pass)**:',
    '   In the target web workspace directory, run:',
    `   - \`${cliRunnerPrefix} verify --json\` (add \`--perf\` if interactive performance, animations, large lists, or layout stability were touched; pass \`--pack commerce|media|saas\` if applicable).`,
    `   - \`${cliRunnerPrefix} context-guides --include-content\` (maps \`git diff\` + touched tokens to the top verified MWG guide IDs, surfaces bespoke-glue maintainability candidates, and prints local verbatim \`.md\` guides).`,
    '2. **Fetch Any Remaining Verbatim MWG Guides Fresh**:',
    '   If `context-guides` emitted a `Retrieve verbatim specs:` command for guides not already inlined locally, run:',
    '   `npx -y modern-web-guidance@latest retrieve "<comma-separated-guide-ids>"`',
    '   Never rely on training-weight recall for modern Web APIs (`<dialog closedby="any">`, `commandfor`/`command`, `interestfor` + `popover="hint"`, CSS Anchor Positioning, `@starting-style`, `:user-invalid`, `field-sizing: content`, `@container scroll-state(...)`, View Transitions, `AbortController` listener cleanup).',
    '3. **Inspect `git diff` & Touched Components Across 3 Axes**:',
    '   - **Semantic MWG Compliance**: Verify the implementation follows the exact attributes, CSS rules, progressive enhancement / `@supports` fallbacks, and accessibility contracts required by the retrieved `.md` guides—without forcing unrequested product features.',
    '   - **UX & Vertical Polish**: Check keyboard focus order/restoration, hydration determinism, responsive overflow, form autofill/validation timing, and layout stability (no unreserved async slots or occluding sticky bars).',
    '   - **Code Maintainability (Delete Bespoke Glue)**: Flag multi-hundred-line imperative JS state machines (`getBoundingClientRect` + scroll/resize listeners, manual Tab focus-trap loops, outside-click `mousedown` + `Escape` listeners, `scrollHeight` auto-growers, duplicate global listeners without `AbortController`) that native Baseline HTML/CSS replaces in a few declarative lines.',
    '',
    '## Output Format',
    '',
    'Return a concise report (under 350 words) structured as:',
    '',
    '- **`STATUS: PASS | NEEDS_CHANGES`**',
    '- **Deterministic Gate Summary**: One line summarizing `modern-web-guidance verify` status, route coverage, active pack, and `--perf` telemetry (if run).',
    '- **Findings (Ordered by Severity)**: Each item must cite `file:line`, the verified MWG guide ID (`` `<guide-id>` ``), a 1-sentence statement of the semantic/UX/maintainability defect, and the concrete replacement pattern.',
    '- **Maintainability Reductions**: Highlight any bespoke JS glue that can be deleted in favor of native web platform primitives.',
    '',
  ].join('\n');
}

function buildAntigravityCriticMarkdown(cliRunnerPrefix: string): string {
  return [
    '---',
    'name: modern-web-critic',
    'description: >-',
    '  Compaction-proof Modern Web Critic subagent. Runs in a fresh, uncompacted',
    '  context window to execute `modern-web-guidance verify --json`, map the git',
    '  diff to relevant Modern Web Guidance (MWG) IDs via `context-guides`, fetch',
    '  verbatim `.md` guides fresh, and audit semantic compliance, UX polish, and',
    '  code maintainability.',
    'tools:',
    '  - view_file',
    '  - list_dir',
    '  - code_search',
    '  - grep_search',
    '  - find_by_name',
    '  - run_command',
    '  - send_message',
    'mainAgent: false',
    'subagent: true',
    'commandExecutionPolicy: auto',
    '---',
    '',
    buildCriticBodyMarkdown(cliRunnerPrefix).trimEnd(),
    '',
  ].join('\n');
}

function buildClaudeCriticMarkdown(cliRunnerPrefix: string): string {
  return [
    '---',
    'name: modern-web-critic',
    'description: Compaction-proof Modern Web Critic subagent. Proactively invoke after multi-file web UI work to run modern-web-guidance verify, fetch fresh verbatim Modern Web Guidance (.md) specs, and audit semantic compliance, UX polish, and bespoke JS glue maintainability.',
    'tools: Read, Grep, Glob, Bash',
    '---',
    '',
    buildCriticBodyMarkdown(cliRunnerPrefix).trimEnd(),
    '',
  ].join('\n');
}

function buildCursorCriticMarkdown(cliRunnerPrefix: string): string {
  return [
    '---',
    'name: modern-web-critic',
    'description: Compaction-proof Modern Web Critic subagent running in a fresh context window to verify live DOM/hydration, fetch verbatim Modern Web Guidance specs, and flag bespoke JS glue replaceable by native Baseline HTML/CSS.',
    'readonly: true',
    '---',
    '',
    buildCriticBodyMarkdown(cliRunnerPrefix).trimEnd(),
    '',
  ].join('\n');
}

function readJsonObjectIfExists(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isModernWebStopHookCmd(cmd: unknown): boolean {
  if (typeof cmd !== 'string') return false;
  return (
    cmd.includes('stop_hook.mjs') ||
    (cmd.includes('stop-hook') &&
      (cmd.includes('verify.mjs') ||
        cmd.includes('modern-web') ||
        cmd.includes('verifying/cli.ts')))
  );
}

export function installPluginConfigs(
  target = 'all',
  projectDir = process.cwd(),
  cliScriptPath?: string,
): string[] {
  const normalizedTarget = String(target || 'all').trim().toLowerCase();
  if (!VALID_INSTALL_TARGETS.has(normalizedTarget)) {
    throw new Error(
      `Invalid --target "${target}". Expected one of: antigravity, claude, cursor, all.`,
    );
  }

  const cliRunnerPrefix = cliScriptPath
    ? `node "${cliScriptPath}"`
    : 'npx -y modern-web-guidance@latest';
  const hookCmd = `${cliRunnerPrefix} stop-hook`;
  const written: string[] = [];

  if (normalizedTarget === 'antigravity' || normalizedTarget === 'all') {
    const hooksPath = path.join(projectDir, '.agents', 'hooks.json');
    mkdirSync(path.dirname(hooksPath), { recursive: true });
    const existing = readJsonObjectIfExists(hooksPath);

    const legacySection =
      existing['modern-web-verify'] &&
      typeof existing['modern-web-verify'] === 'object' &&
      !Array.isArray(existing['modern-web-verify'])
        ? (existing['modern-web-verify'] as Record<string, unknown>)
        : null;
    const prevModernWeb =
      existing['modern-web'] &&
      typeof existing['modern-web'] === 'object' &&
      !Array.isArray(existing['modern-web'])
        ? (existing['modern-web'] as Record<string, unknown>)
        : null;
    const prevMwgSection =
      existing['modern-web-guidance'] &&
      typeof existing['modern-web-guidance'] === 'object' &&
      !Array.isArray(existing['modern-web-guidance'])
        ? (existing['modern-web-guidance'] as Record<string, unknown>)
        : {};

    const combinedPrevStop = [
      ...(Array.isArray(legacySection?.Stop) ? legacySection.Stop : []),
      ...(Array.isArray(prevModernWeb?.Stop) ? prevModernWeb.Stop : []),
      ...(Array.isArray(prevMwgSection.Stop) ? prevMwgSection.Stop : []),
    ].filter((entry) => {
      const cmd =
        entry && typeof entry === 'object' && 'command' in entry
          ? (entry as { command?: unknown }).command
          : undefined;
      return !isModernWebStopHookCmd(cmd);
    });

    const nextHooks: Record<string, unknown> = { ...existing };
    delete nextHooks['modern-web-verify'];
    delete nextHooks['modern-web'];
    nextHooks['modern-web-guidance'] = {
      ...prevMwgSection,
      Stop: [...combinedPrevStop, { type: 'command', command: hookCmd, timeout: 15 }],
    };
    writeFileSync(hooksPath, JSON.stringify(nextHooks, null, 2) + '\n');
    written.push(hooksPath);

    const antigravityAgentOut = path.join(
      projectDir,
      '.agents',
      'agents',
      'modern_web_critic',
      'agent.md',
    );
    mkdirSync(path.dirname(antigravityAgentOut), { recursive: true });
    writeFileSync(antigravityAgentOut, buildAntigravityCriticMarkdown(cliRunnerPrefix));
    written.push(antigravityAgentOut);
  }

  if (normalizedTarget === 'claude' || normalizedTarget === 'all') {
    const claudeSettings = path.join(projectDir, '.claude', 'settings.json');
    mkdirSync(path.dirname(claudeSettings), { recursive: true });
    const existing = readJsonObjectIfExists(claudeSettings);
    const prevHooks =
      existing.hooks && typeof existing.hooks === 'object' && !Array.isArray(existing.hooks)
        ? (existing.hooks as Record<string, unknown>)
        : {};
    const rawStopGroups = Array.isArray(prevHooks.Stop) ? prevHooks.Stop : [];
    const prevStopGroups = rawStopGroups.filter((group) => {
      if (!group || typeof group !== 'object' || !('hooks' in group)) return true;
      const g = group as { hooks?: unknown };
      if (!Array.isArray(g.hooks)) return true;
      const kept = g.hooks.filter((h) => {
        const cmd =
          h && typeof h === 'object' && 'command' in h
            ? (h as { command?: unknown }).command
            : undefined;
        return !isModernWebStopHookCmd(cmd);
      });
      g.hooks = kept;
      return kept.length > 0;
    });

    const merged = {
      ...existing,
      hooks: {
        ...prevHooks,
        Stop: [
          ...prevStopGroups,
          {
            hooks: [{ type: 'command', command: hookCmd, timeout: 15 }],
          },
        ],
      },
    };
    writeFileSync(claudeSettings, JSON.stringify(merged, null, 2) + '\n');
    written.push(claudeSettings);

    const claudeCriticPath = path.join(projectDir, '.claude', 'agents', 'modern-web-critic.md');
    mkdirSync(path.dirname(claudeCriticPath), { recursive: true });
    writeFileSync(claudeCriticPath, buildClaudeCriticMarkdown(cliRunnerPrefix));
    written.push(claudeCriticPath);
  }

  if (normalizedTarget === 'cursor' || normalizedTarget === 'all') {
    const cursorHooks = path.join(projectDir, '.cursor', 'hooks.json');
    mkdirSync(path.dirname(cursorHooks), { recursive: true });
    const existing = readJsonObjectIfExists(cursorHooks);
    const prevHooks =
      existing.hooks && typeof existing.hooks === 'object' && !Array.isArray(existing.hooks)
        ? (existing.hooks as Record<string, unknown>)
        : {};
    const prevStop = Array.isArray(prevHooks.stop)
      ? prevHooks.stop.filter((entry) => {
          const cmd =
            entry && typeof entry === 'object' && 'command' in entry
              ? (entry as { command?: unknown }).command
              : undefined;
          return !isModernWebStopHookCmd(cmd);
        })
      : [];

    const merged = {
      ...existing,
      version: existing.version ?? 1,
      hooks: {
        ...prevHooks,
        stop: [...prevStop, { command: hookCmd }],
      },
    };
    writeFileSync(cursorHooks, JSON.stringify(merged, null, 2) + '\n');
    written.push(cursorHooks);

    const cursorCriticPath = path.join(projectDir, '.cursor', 'agents', 'modern-web-critic.md');
    mkdirSync(path.dirname(cursorCriticPath), { recursive: true });
    writeFileSync(cursorCriticPath, buildCursorCriticMarkdown(cliRunnerPrefix));
    written.push(cursorCriticPath);
  }

  return written;
}
