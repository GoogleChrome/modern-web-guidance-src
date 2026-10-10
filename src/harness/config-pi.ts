/**
 * Pi Agent Configuration
 * 
 * Usage: gd eval --config src/harness/config-pi.ts <task-name>
 * 
 * This configuration runs the evaluation suite with the Pi coding agent
 * instead of the default Antigravity CLI.
 */

import { mergeSuiteConfig, Agents } from './config.ts';

export default mergeSuiteConfig({
  name: 'pi-eval',
  agent: Agents.PI,
  numRuns: 1,  // Single run for faster feedback
  tasks: [],   // Empty = run all tasks, or specify: ['forms/light-dismiss-dialog/task']
  skillsToEnable: ['modern-web-guidance'],
  includeTrace: false,
});
