/**
 * Pi Agent Configuration
 *
 * Usage (full suite):
 *   PI_MODEL="openrouter/deepseek/deepseek-v4.1-flash:low" gd eval --config src/harness/config-pi.ts
 *   PI_WORKERS=3 PI_MODEL="openrouter/qwen/qwen3.8-flash:off" gd eval --config src/harness/config-pi.ts
 *   PI_MODEL="openrouter/z-ai/glm-5.3:low" gd eval --config src/harness/config-pi.ts
 *   PI_WORKERS=2 PI_MODEL="openrouter/moonshotai/kimi-k3:low" gd eval --config src/harness/config-pi.ts
 *
 * Usage (single task):
 *   PI_MODEL="openrouter/qwen/qwen3.8-flash:off" gd eval --config src/harness/config-pi.ts <task-name>
 *
 * Environment overrides:
 *   PI_MODEL / PROMPT_MODEL - Model identifier passed to `pi --model` (supports optional `:<thinking>` suffix)
 *   PI_SUITE_NAME           - Custom suite directory name under results/suites/
 *   PI_WORKERS              - Concurrent worker count (defaults to 10)
 */

import { mergeSuiteConfig, Agents } from './config.ts';

function buildPiSuiteName(): string {
  if (process.env.PI_SUITE_NAME) {
    return process.env.PI_SUITE_NAME;
  }
  const timestamp = new Date()
    .toLocaleString('sv-SE', { timeZone: 'America/Los_Angeles' })
    .replace(' ', '_')
    .replace(/:/g, '-');
  const rawModel = process.env.PI_MODEL || process.env.PROMPT_MODEL;
  if (!rawModel) {
    return `pi-eval-${timestamp}`;
  }
  const baseModel = rawModel.split(':')[0] || rawModel;
  const modelSlug = (baseModel.split('/').pop() || baseModel)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `pi-${modelSlug}-${timestamp}`;
}

const parsedWorkers = process.env.PI_WORKERS ? Number.parseInt(process.env.PI_WORKERS, 10) : NaN;

export default mergeSuiteConfig({
  name: buildPiSuiteName(),
  agent: Agents.PI,
  numRuns: 1,
  tasks: [], // Empty = run all tasks, or pass task arguments to `gd eval`
  skillsToEnable: ['modern-web-guidance'],
  workerCount: Number.isFinite(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : 10,
});
