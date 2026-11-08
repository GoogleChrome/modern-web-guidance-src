import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { guidesDir as libGuidesDir, outDir, rootDir, suitesDir } from '../../../../src/core/paths.ts';

const BUCKET_NAME = 'guidance-evals';

// Resolve local directories
const repoRoot = rootDir;
const resultsDir = suitesDir;

function getSlug(taskName: string): string {
  return taskName.toLowerCase().replace(/[^a-z0-9_-]/g, '').replace(/\s+/g, '-');
}

function findGuideDirs(dir: string, result: Record<string, string> = {}): Record<string, string> {
  if (!fs.existsSync(dir)) return result;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory() && item.name !== 'node_modules') {
      const fullPath = path.join(dir, item.name);
      if (fs.existsSync(path.join(fullPath, 'guide.md'))) {
        result[item.name] = fullPath;
      } else {
        findGuideDirs(fullPath, result);
      }
    }
  }
  return result;
}

function stripBaselineTargetSuffix(targetName: string): string {
  return targetName.replace(/-(?:widely|newly|limited)$/, '');
}

function resolveTaskFilePath(guideDir: string, targetName: string): string {
  const baseTarget = stripBaselineTargetSuffix(targetName);
  const candidates = [
    path.join(guideDir, 'targets', targetName, 'task.md'),
    path.join(guideDir, 'targets', baseTarget, 'task.md'),
    path.join(guideDir, 'tasks', `${targetName}.md`),
    path.join(guideDir, 'tasks', 'task.md'),
    path.join(guideDir, 'targets', 'daily-grind', 'task.md'),
    path.join(guideDir, 'targets', 'devtools-times', 'task.md'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return targetName === 'task'
    ? path.join(guideDir, 'tasks', 'task.md')
    : path.join(guideDir, 'targets', baseTarget, 'task.md');
}

function resolveGraderFilePath(guideDir: string, targetName: string): string {
  const baseTarget = stripBaselineTargetSuffix(targetName);
  const candidates = [
    path.join(guideDir, 'targets', targetName, 'grader.ts'),
    path.join(guideDir, 'targets', baseTarget, 'grader.ts'),
    path.join(guideDir, 'grader.ts'),
    path.join(guideDir, 'targets', 'daily-grind', 'grader.ts'),
    path.join(guideDir, 'targets', 'devtools-times', 'grader.ts'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return targetName === 'task'
    ? path.join(guideDir, 'grader.ts')
    : path.join(guideDir, 'targets', baseTarget, 'grader.ts');
}

function extractTaskPrompt(guideDir: string, targetName: string): string {
  const taskPath = resolveTaskFilePath(guideDir, targetName);
  if (!fs.existsSync(taskPath)) return '';
  const content = fs.readFileSync(taskPath, 'utf8');
  const parts = content.split('---');
  if (parts.length >= 3) {
    return parts.slice(2).join('---').trim();
  }
  return content.trim();
}

function extractGuideDescription(guidePath: string): string {
  if (!fs.existsSync(guidePath)) return '';
  const content = fs.readFileSync(guidePath, 'utf8');
  const parts = content.split('---');
  if (parts.length >= 3) {
    const frontmatter = parts[1];
    const match = frontmatter.match(/^description:\s*(.+)$/m);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

function extractGraderTests(guideDir: string, targetName: string): string[] {
  const graderPath = resolveGraderFilePath(guideDir, targetName);
  if (!fs.existsSync(graderPath)) return [];
  const content = fs.readFileSync(graderPath, 'utf8');
  const lines = content.split('\n');
  const tests: string[] = [];
  const testRegex = /^(?:test|it|test\.only)\s*\(\s*(['"`])((?:[^\\]|\\.)*?)\1/;
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(testRegex);
    if (match) {
      tests.push(match[2]);
    }
  }
  return tests;
}

interface TaskDetails {
  targetName: string;
  guideName: string;
  missingExpectedGuideCount: number;
  tooManyGuidesCount: number;
  guidedPassRates: { [agent: string]: number };
  unguidedPassRates: { [agent: string]: number };
  guidesConsumed: { [agent: string]: string[] };
  expectedGuide: string;
}

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 100 });
  } catch (err: any) {
    console.error(`Failed to execute command: ${cmd}`);
    console.error(err.stderr || err.message);
    throw err;
  }
}

interface FailedAssertion {
  testId: string;
  message: string;
}

function getFailedAssertions(agentData: any, taskPrefix: string, mode: 'guided' | 'unguided'): FailedAssertion[] {
  const key = `${taskPrefix} - ${mode}`;
  const runs = agentData.results?.[key] || [];
  const failuresMap = new Map<string, string>();
  for (const run of runs) {
    if (run && Array.isArray(run.results)) {
      for (const res of run.results) {
        if (res.passed === false) {
          const checkId = res.id ?? res.testId ?? res.message ?? 'unknown-check';
          failuresMap.set(String(checkId), res.message || '');
        }
      }
    }
  }
  return Array.from(failuresMap.entries()).map(([testId, message]) => ({ testId, message }));
}

function getCommonFailures(taskPrefix: string, mode: 'guided' | 'unguided', parsedDataByAgent: Record<string, any>, activeAgents: string[]): FailedAssertion[] {
  if (activeAgents.length === 0) return [];
  
  const firstAgent = activeAgents[0];
  const firstFailures = getFailedAssertions(parsedDataByAgent[firstAgent], taskPrefix, mode);
  let commonTestIds = new Set(firstFailures.map(f => f.testId));
  
  const messageMap = new Map<string, string>();
  for (const f of firstFailures) {
    messageMap.set(f.testId, f.message);
  }
  
  for (let i = 1; i < activeAgents.length; i++) {
    const agent = activeAgents[i];
    const agentFailures = getFailedAssertions(parsedDataByAgent[agent], taskPrefix, mode);
    const agentTestIds = new Set(agentFailures.map(f => f.testId));
    
    const nextCommon = new Set<string>();
    for (const testId of commonTestIds) {
      if (agentTestIds.has(testId)) {
        nextCommon.add(testId);
      }
    }
    commonTestIds = nextCommon;
    
    for (const f of agentFailures) {
      messageMap.set(f.testId, f.message);
    }
  }
  
  return Array.from(commonTestIds).map(testId => ({
    testId,
    message: messageMap.get(testId) || ''
  }));
}

async function main() {
  console.log('🔍 Listing GCS bucket to locate the latest nightly runs...');
  let listOutput = '';
  try {
    listOutput = runCommand(`gcloud storage ls gs://${BUCKET_NAME}/`);
  } catch (e) {
    console.error('❌ Failed to list GCS bucket. Please make sure you are logged in with `gcloud auth login` and have access to gs://guidance-evals.');
    process.exit(1);
  }

  const lines = listOutput.split('\n');
  const nightlyRuns: { folderName: string; timestamp: string; agent: 'claude_code' | 'codex_cli' | 'jetski_cli' | null }[] = [];

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    // Expected formats:
    // gs://guidance-evals/nightly-YYYY-MM-DD_HH-MM-SS-agent/
    // gs://guidance-evals/nightly-YYYY-MM-DD_HH-MM-SS-agent-user/
    const match = cleanLine.match(/gs:\/\/guidance-evals\/(nightly-([0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2})-(jetski_cli|codex_cli|claude_code|antigravity_cli|agy|claude|codex|jetski)(?:-([a-zA-Z0-9_]+))?)\//);
    if (!match) continue;

    const [_, folderName, timestampStr, agentStr] = match;
    let agent: 'claude_code' | 'codex_cli' | 'jetski_cli' | null = null;

    const agentLower = agentStr.toLowerCase();
    if (agentLower.includes('claude')) {
      agent = 'claude_code';
    } else if (agentLower.includes('codex')) {
      agent = 'codex_cli';
    } else if (agentLower.includes('jetski') || agentLower.includes('agy') || agentLower.includes('antigravity')) {
      agent = 'jetski_cli';
    }

    if (agent) {
      nightlyRuns.push({ folderName, timestamp: timestampStr, agent });
    }
  }

  if (nightlyRuns.length === 0) {
    console.error('❌ No nightly runs found in GCS!');
    process.exit(1);
  }

  // Find the latest run for each distinct agent
  const latestByAgent: Record<'claude_code' | 'codex_cli' | 'jetski_cli', string | null> = {
    claude_code: null,
    codex_cli: null,
    jetski_cli: null,
  };

  const latestTimestampByAgent: Record<'claude_code' | 'codex_cli' | 'jetski_cli', string | null> = {
    claude_code: null,
    codex_cli: null,
    jetski_cli: null,
  };

  for (const run of nightlyRuns) {
    if (!run.agent) continue;
    const currentLatestTs = latestTimestampByAgent[run.agent];
    // Compare timestamps as strings (e.g. 2026-06-01_17-00-02 vs 2026-05-21_03-30-02)
    if (!currentLatestTs || run.timestamp > currentLatestTs) {
      latestTimestampByAgent[run.agent] = run.timestamp;
      latestByAgent[run.agent] = run.folderName;
    }
  }

  console.log('\nSelected runs to download and investigate:');
  for (const [agent, folderName] of Object.entries(latestByAgent)) {
    if (folderName) {
      console.log(`  - ${agent}: ${folderName}`);
    } else {
      console.warn(`  ⚠️ No run found for agent: ${agent}`);
    }
  }

  // Ensure results/suites directory exists
  fs.mkdirSync(resultsDir, { recursive: true });

  const activeAgents = Object.keys(latestByAgent).filter(agent => latestByAgent[agent as keyof typeof latestByAgent]) as ('claude_code' | 'codex_cli' | 'jetski_cli')[];

  // Sync results for each run (excluding heavy binary zip/png files to save bandwidth)
  for (const agent of activeAgents) {
    const folderName = latestByAgent[agent]!;
    const localSuiteDir = path.join(resultsDir, folderName);

    if (fs.existsSync(localSuiteDir)) {
      console.log(`\n✅ [${agent}] Folder already exists in results, skipping download: ${folderName}`);
    } else {
      fs.mkdirSync(localSuiteDir, { recursive: true });
      console.log(`\n📥 [${agent}] Syncing results for ${folderName} (excluding heavy binary zip/png files)...`);
      try {
        runCommand(`gcloud storage rsync gs://${BUCKET_NAME}/${folderName} ${localSuiteDir} --recursive --exclude ".*\\.zip$|.*\\.png$"`);
        console.log(`✅ Sync completed successfully.`);
      } catch (err) {
        console.error(`❌ Failed to sync results for ${folderName}`);
        process.exit(1);
      }
    }
  }

  // Parse each run's data
  const parsedDataByAgent: Record<string, any> = {};
  for (const agent of activeAgents) {
    const folderName = latestByAgent[agent]!;
    const localEvalsPath = path.join(resultsDir, folderName, 'evals.json');
    try {
      const content = fs.readFileSync(localEvalsPath, 'utf8');
      parsedDataByAgent[agent] = JSON.parse(content);
    } catch (err: any) {
      console.error(`❌ Error reading/parsing local evals.json for ${agent}: ${err.message}`);
      process.exit(1);
    }
  }

  // Collect all unique "<targetName> - <guideName>" task prefixes across all runs
  const allTasks = new Map<string, { targetName: string; guideName: string }>();
  for (const agent of activeAgents) {
    const data = parsedDataByAgent[agent];
    const results = data.results || {};
    for (const key of Object.keys(results)) {
      // Key is: "<targetName> - <guideName> - guided|unguided"
      const parts = key.split(' - ');
      if (parts.length >= 3) {
        const targetName = parts[0];
        const guideName = parts.slice(1, -1).join(' - ');
        const taskPrefix = `${targetName} - ${guideName}`;
        allTasks.set(taskPrefix, { targetName, guideName });
      }
    }
  }

  console.log(`\nAnalyzing ${allTasks.size} distinct tasks...`);

  const taskAnalysis: Record<string, TaskDetails> = {};

  for (const [taskPrefix, { targetName, guideName }] of allTasks.entries()) {
    taskAnalysis[taskPrefix] = {
      targetName,
      guideName,
      missingExpectedGuideCount: 0,
      tooManyGuidesCount: 0,
      guidedPassRates: {},
      unguidedPassRates: {},
      guidesConsumed: {},
      expectedGuide: guideName,
    };

    for (const agent of activeAgents) {
      const data = parsedDataByAgent[agent];
      const results = data.results || {};
      const stats = data.stats || {};

      // Guided info
      const guidedKey = `${taskPrefix} - guided`;
      const guidedRuns = results[guidedKey] || [];
      const guidedStats = stats[guidedKey] || {};

      // Pass rate (default to 0 if no guided stats or no runs)
      const guidedPassRate = typeof guidedStats.medianPassRate === 'number' ? guidedStats.medianPassRate : 0;
      taskAnalysis[taskPrefix].guidedPassRates[agent] = guidedPassRate;

      // Expected guide and consumed guides
      const guidesConsumed: string[] = [];
      if (guidedRuns.length > 0) {
        // For simple evaluation, look at the first run's guidesUsed
        const firstRun = guidedRuns[0];
        if (firstRun && Array.isArray(firstRun.guidesUsed)) {
          guidesConsumed.push(...firstRun.guidesUsed);
        }
      }
      taskAnalysis[taskPrefix].guidesConsumed[agent] = guidesConsumed;

      // Flag: Missing expected guide (expected guide is guideName)
      if (!guidesConsumed.includes(guideName)) {
        taskAnalysis[taskPrefix].missingExpectedGuideCount++;
      }

      // Flag: Too many guides consumed (3 or more)
      if (guidesConsumed.length >= 3) {
        taskAnalysis[taskPrefix].tooManyGuidesCount++;
      }

      // Unguided info
      const unguidedKey = `${taskPrefix} - unguided`;
      const unguidedStats = stats[unguidedKey] || {};
      const unguidedPassRate = typeof unguidedStats.medianPassRate === 'number' ? unguidedStats.medianPassRate : 0;
      taskAnalysis[taskPrefix].unguidedPassRates[agent] = unguidedPassRate;
    }
  }

  // Evaluate flags for each task
  const flaggedTasks: {
    taskName: string;
    flags: string[];
    details: string[];
    raw: TaskDetails;
  }[] = [];

  for (const [taskPrefix, details] of Object.entries(taskAnalysis)) {
    const flags: string[] = [];
    const flagDetailsList: string[] = [];

    // 1. Missing expected guide in at least 2 runs
    if (details.missingExpectedGuideCount >= 2) {
      flags.push('MISSING_EXPECTED_GUIDE');
      flagDetailsList.push(`Expected guide was missing in ${details.missingExpectedGuideCount} out of ${activeAgents.length} agent runs.`);
    }

    // 2. Too many guides consumed (3 or more) in at least 2 runs
    if (details.tooManyGuidesCount >= 2) {
      flags.push('TOO_MANY_GUIDES_CONSUMED');
      flagDetailsList.push(`Consumed 3 or more guides in ${details.tooManyGuidesCount} out of ${activeAgents.length} agent runs.`);
    }

    // 3. High unguided pass rate (80% or higher in all runs). Low guided pass rate is never flagged.
    const allUnguidedOver80 = activeAgents.every(agent => details.unguidedPassRates[agent] >= 80);
    if (allUnguidedOver80) {
      flags.push('HIGH_UNGUIDED_PASS_RATE');
      const rateStrings = activeAgents.map(agent => `${agent}: ${details.unguidedPassRates[agent]}%`).join(', ');
      flagDetailsList.push(`Unguided pass rate was 80% or higher in all nightly runs (${rateStrings}).`);
    }

    if (flags.length > 0) {
      flaggedTasks.push({
        taskName: taskPrefix,
        flags,
        details: flagDetailsList,
        raw: details,
      });
    }
  }

  console.log(`\nAnalysis completed. Flagged ${flaggedTasks.length} out of ${allTasks.size} tasks.`);

  // Generate reports
  const outputDir = path.join(outDir, 'nightly-investigation');
  fs.mkdirSync(outputDir, { recursive: true });

  const guideDirsMap = findGuideDirs(libGuidesDir);

  const markdownReportPath = path.join(outputDir, 'nightly_investigation_report.md');

  // 1. Build Markdown Report
  let md = `# Nightly Evaluation Investigation Report\n\n`;
  md += `**Generated:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**Suites Investigated:**\n`;
  for (const agent of activeAgents) {
    md += `- **${agent}**: \`${latestByAgent[agent]}\`\n`;
  }
  md += `\n---\n\n`;

  md += `## Summary of Flagged Tasks\n\n`;
  md += `- **Total distinct tasks analyzed:** ${allTasks.size}\n`;
  md += `- **Total flagged tasks:** ${flaggedTasks.length}\n\n`;

  if (flaggedTasks.length === 0) {
    md += `✅ **No flagged tasks! All nightly runs passed our health thresholds.**\n`;
  } else {
    md += `### Flagged Tasks Table\n\n`;
    md += `| Task / Guide | Flags | Details |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const item of flaggedTasks) {
      md += `| \`${item.taskName}\` | ${item.flags.map(f => `\`${f}\``).join(', ')} | ${item.details.join(' <br> ')} |\n`;
    }
    md += `\n\n## Flagged Tasks Details\n\n`;

    for (const item of flaggedTasks) {
      md += `<a name="${getSlug(item.taskName)}"></a>\n### \`${item.taskName}\`\n\n`;
      md += `#### Flags:\n`;
      for (let i = 0; i < item.flags.length; i++) {
        md += `- **\`${item.flags[i]}\`**: ${item.details[i]}\n`;
      }
      md += `\n#### Run Details:\n\n`;
      md += `| Agent | Guided Pass Rate | Unguided Pass Rate | Guides Consumed |\n`;
      md += `| :--- | :---: | :---: | :--- |\n`;
      for (const agent of activeAgents) {
        const guidedRate = `${item.raw.guidedPassRates[agent]}%`;
        const unguidedRate = `${item.raw.unguidedPassRates[agent]}%`;
        const consumed = item.raw.guidesConsumed[agent].length > 0 
          ? item.raw.guidesConsumed[agent].map(g => `\`${g}\``).join(', ')
          : '*None*';
        md += `| **${agent}** | ${guidedRate} | ${unguidedRate} | ${consumed} |\n`;
      }
      
      const commonGuided = getCommonFailures(item.taskName, 'guided', parsedDataByAgent, activeAgents);
      
      md += `\n#### Qualitative Diagnostic Summary:\n\n`;
      md += `- **Diagnostic Details**:\n`;
      
      if (commonGuided.length > 0) {
        md += `  - *Failed Assertions*:\n`;
        for (const f of commonGuided) {
          md += `    - "${f.message}" (Test ID: \`${f.testId}\`)\n`;
        }
      }
      
      for (const flag of item.flags) {
        md += `  - **${flag}**: TODO\n`;
      }

      const { targetName, guideName } = item.raw;
      const folderPath = guideDirsMap[guideName];
      const baseTarget = stripBaselineTargetSuffix(targetName);
      const relativeGuidePath = folderPath ? path.relative(repoRoot, folderPath) : `guides/.../${guideName}`;
      const promptPath = folderPath
        ? path.relative(repoRoot, resolveTaskFilePath(folderPath, targetName))
        : (targetName === 'task' ? `${relativeGuidePath}/tasks/task.md` : `${relativeGuidePath}/targets/${baseTarget}/task.md`);
      const guidePathRel = `${relativeGuidePath}/guide.md`;
      const graderPath = folderPath
        ? path.relative(repoRoot, resolveGraderFilePath(folderPath, targetName))
        : (targetName === 'task' ? `${relativeGuidePath}/grader.ts` : `${relativeGuidePath}/targets/${baseTarget}/grader.ts`);

      md += `- **Actionable Recommendations**:\n`;
      md += `  - [ ] **Prompt** (\`${promptPath}\`): TODO\n`;
      md += `  - [ ] **Guide** (\`${guidePathRel}\`): TODO\n`;
      md += `  - [ ] **Grader** (\`${graderPath}\`): TODO\n\n`;
      md += `---\n\n`;
    }
  }

  fs.writeFileSync(markdownReportPath, md);
  console.log(`💾 Saved Markdown report to: ${markdownReportPath}`);

  // 2. Build Flagged Tasks Context JSON
  if (flaggedTasks.length > 0) {
    console.log('📂 Gathering context details (task prompt, guide description, unit tests) for flagged tasks...');
    const contextMap: Record<string, {
      flags: string[];
      guidePath: string;
      prompt: string;
      guideDescription: string;
      testHeaders: string[];
    }> = {};

    for (const item of flaggedTasks) {
      const { targetName, guideName } = item.raw;
      const folderPath = guideDirsMap[guideName];
      if (!folderPath) {
        console.warn(`  ⚠️ Could not find guide folder for task: ${item.taskName}`);
        continue;
      }
      
      const relativeGuidePath = path.relative(repoRoot, folderPath);
      const guidePath = path.join(folderPath, 'guide.md');

      contextMap[item.taskName] = {
        flags: item.flags,
        guidePath: relativeGuidePath,
        prompt: extractTaskPrompt(folderPath, targetName),
        guideDescription: extractGuideDescription(guidePath),
        testHeaders: extractGraderTests(folderPath, targetName),
      };
    }

    const contextJsonPath = path.join(outputDir, 'flagged_tasks_context.json');
    fs.writeFileSync(contextJsonPath, JSON.stringify(contextMap, null, 2));
    console.log(`💾 Saved Flagged Tasks Context JSON to: ${contextJsonPath}`);
  }

  console.log('\n🎯 Investigation analysis finished successfully!');
}

main().catch(console.error);
