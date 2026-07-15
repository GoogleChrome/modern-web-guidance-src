import fs from 'fs';
import path from 'path';
import config from '../config.ts';
import { cGreen, cRed, cCyan, cBold } from '../../lib/colors.ts';
import { downloadRunFromGcsIfMissing } from './gcs-downloader.ts';
import { rootDir, baseAppsDir } from '../../lib/paths.ts';

/**
 * Dynamically fetches all active models from the Gemini API and returns them sorted by version and capability.
 */
async function getSortedModelsList(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const fallbackList = ['models/gemini-1.5-pro', 'models/gemini-1.5-flash'];
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Compare Agent] Warning: Failed to fetch active models (HTTP ${response.status}). Using fallback list.`);
      return fallbackList;
    }

    const data = await response.json() as any;
    if (!data.models || !Array.isArray(data.models)) {
      return fallbackList;
    }

    const geminiModels = data.models
      .filter((m: any) => {
        const isGemini = m.name.startsWith('models/gemini-');
        const supportsText = m.supportedGenerationMethods?.includes('generateContent');
        if (!isGemini || !supportsText) return false;

        const nameLower = m.name.toLowerCase();
        if (nameLower.includes('image') || nameLower.includes('tts')) {
          return false;
        }
        return true;
      })
      .map((m: any) => {
        const match = m.name.match(/gemini-(\d+(?:\.\d+)?)-(pro|flash)/i);
        const versionStr = match ? match[1] : '0.0';
        const tier = match ? match[2].toLowerCase() : 'flash';

        const parts = versionStr.split('.');
        const major = parseInt(parts[0], 10) || 0;
        const minor = parts[1] ? parseFloat('0.' + parts[1]) : 0.0;

        return {
          name: m.name,
          major,
          minor,
          tier
        };
      });

    if (geminiModels.length === 0) {
      return fallbackList;
    }

    geminiModels.sort((a: any, b: any) => {
      if (b.major !== a.major) return b.major - a.major;
      const tierScore = (t: string) => t === 'pro' ? 2 : 1;
      const scoreB = tierScore(b.tier);
      const scoreA = tierScore(a.tier);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.minor - a.minor;
    });

    const sortedNames = geminiModels.map((m: any) => m.name);
    console.log(`[Compare Agent] Available models sorted by priority:`, sortedNames);
    return sortedNames;
  } catch (err: any) {
    console.warn(`[Compare Agent] Warning: Failed to resolve model list: ${err.message}. Using fallback.`);
    return fallbackList;
  }
}

/**
 * Attempts to generate content with a specific model using both systemInstruction and prompt.
 */
async function attemptGenerateContent(apiKey: string, model: string, systemInstruction: string, prompt: string, label: string = 'Compare Agent'): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedError = errText;
    try {
      const json = JSON.parse(errText);
      parsedError = json.error?.message || errText;
    } catch {}
    throw new Error(`HTTP ${response.status}: ${parsedError}`);
  }

  const data = await response.json() as any;
  
  try {
    const debugDir = path.resolve('./results/compare_work');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    fs.writeFileSync(path.join(debugDir, `response_debug_${slug}.json`), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}

  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    throw new Error('Failed to parse content from response: ' + JSON.stringify(data));
  }

  const nonThoughtParts = parts.filter((part: any) => !part.thought);
  
  if (nonThoughtParts.length === 0) {
    const fallbackText = parts[0]?.text;
    if (!fallbackText) {
      throw new Error('No text content found in response parts: ' + JSON.stringify(data));
    }
    return fallbackText;
  }

  const text = nonThoughtParts.map((part: any) => part.text).filter(Boolean).join('');
  if (!text) {
    throw new Error('No valid text content found in final response parts: ' + JSON.stringify(data));
  }

  return text;
}

/**
 * Direct call to the Gemini Developer API using fetch with automatic model failover.
 */
async function callGeminiApiDirectly(systemInstruction: string, prompt: string, label: string = 'Compare Agent'): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please add GEMINI_API_KEY="your_api_key_here" to a .env file at the project root.');
  }

  let models: string[] = [];
  if (process.env.GEMINI_MODEL) {
    models = [process.env.GEMINI_MODEL];
  } else {
    models = await getSortedModelsList(apiKey);
  }

  const errors: string[] = [];
  
  for (let i = 0; i < models.length; i++) {
    let model = models[i];
    if (!model.startsWith('models/')) {
      model = `models/${model}`;
    }

    console.log(`[${label}] Attempting call with model: ${model}...`);
    try {
      const result = await attemptGenerateContent(apiKey, model, systemInstruction, prompt, label);
      console.log(`[${label}] ✅ Successful call using model: ${model}`);
      return result;
    } catch (err: any) {
      console.warn(`[${label}] ⚠️ Model ${model} failed or overloaded: ${err.message}`);
      errors.push(`${model}: ${err.message}`);
      
      if (i < models.length - 1) {
        console.log(`[${label}] Retrying with next best model in list...`);
      }
    }
  }

  throw new Error(`All available Gemini models failed or were overloaded:\n${errors.map(e => `  - ${e}`).join('\n')}`);
}

interface TaggedStep {
  stepNumber: number;
  category: 'skill_search' | 'guide_retrieval' | 'mandatory_rule_thought' | 'code_mutation' | 'incidental_noise';
  thought?: string;
  actionName?: string;
  actionDetails?: string;
  isError?: boolean;
  raw: any;
}

interface PreprocessedTrajectory {
  taggedSteps: TaggedStep[];
  searchQueries: string[];
  retrievedGuideIds: string[];
  mandatoryRulesAdopted: string[];
  codeMutationCount: number;
  noiseCount: number;
  errorLoopCount: number;
}

interface GuideContext {
  guideName: string;
  taskName: string;
  guideContent: string;
  expectationsContent: string;
  taskPrompt: string;
  graderContent: string;
  baseAppContent: string;
}

interface RunContext {
  dir: string;
  runNumber: number;
  score: number;
  resultsJson: any;
  trajectorySummary: any;
  chatLog: string;
  codeOutput: string;
  codePath: string;
  preprocessed: PreprocessedTrajectory;
}

/**
 * Helper to find guide.md, expectations.md, task.md, grader.ts, and base app content for a given guide/task name.
 */
function findGuideContext(guideName: string, taskName: string): GuideContext {
  const guidesBaseDir = path.join(rootDir, 'guides');
  let guideContent = '';
  let expectationsContent = '';
  let taskPrompt = '';
  let graderContent = '';
  let baseAppContent = '';
  let guideDir = '';

  if (fs.existsSync(guidesBaseDir)) {
    // 1. Search for guide directory
    const items = fs.readdirSync(guidesBaseDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const direct = path.join(guidesBaseDir, guideName);
        if (fs.existsSync(direct)) {
          guideDir = direct;
          break;
        }
        const nested = path.join(guidesBaseDir, item.name, guideName);
        if (fs.existsSync(nested)) {
          guideDir = nested;
          break;
        }
      }
    }

    if (guideDir) {
      const guidePath = path.join(guideDir, 'guide.md');
      if (fs.existsSync(guidePath)) {
        guideContent = fs.readFileSync(guidePath, 'utf8');
      }

      // Expectations
      const expPath = path.join(guideDir, 'expectations.md');
      if (fs.existsSync(expPath)) {
        expectationsContent = fs.readFileSync(expPath, 'utf8');
      }

      // Grader
      const graderPath = path.join(guideDir, 'grader.ts');
      if (fs.existsSync(graderPath)) {
        graderContent = fs.readFileSync(graderPath, 'utf8');
      }

      // Task prompt
      const taskPath1 = path.join(guideDir, 'tasks', `${taskName}.md`);
      const taskPath2 = path.join(guideDir, 'tasks', 'task.md');
      const taskPath3 = path.join(guideDir, 'task.md');
      let foundTaskPath = '';
      if (fs.existsSync(taskPath1)) {
        foundTaskPath = taskPath1;
      } else if (fs.existsSync(taskPath2)) {
        foundTaskPath = taskPath2;
      } else if (fs.existsSync(taskPath3)) {
        foundTaskPath = taskPath3;
      }

      if (foundTaskPath) {
        taskPrompt = fs.readFileSync(foundTaskPath, 'utf8');
        const baseAppMatch = taskPrompt.match(/base_app:\s*([^\s\r\n]+)/i);
        if (baseAppMatch) {
          const baseAppName = baseAppMatch[1].trim();
          const baseAppDir = path.join(baseAppsDir, baseAppName);
          if (fs.existsSync(baseAppDir)) {
            const baseCode = findCodeOutput(baseAppDir);
            baseAppContent = baseCode.content;
          }
        }
      }
    }
  }

  return {
    guideName,
    taskName,
    guideContent: guideContent || 'No guide.md content found.',
    expectationsContent: expectationsContent || 'No expectations.md content found.',
    taskPrompt: taskPrompt || 'No task.md prompt found.',
    graderContent: graderContent || 'No grader.ts content found.',
    baseAppContent: baseAppContent || 'No base app content found.'
  };
}

/**
 * Helper to find the main generated code file in a run directory.
 */
function findCodeOutput(dir: string): { path: string; content: string } {
  const candidates = [
    'dist/index.html',
    'src/App.jsx',
    'src/App.js',
    'src/main.jsx',
    'src/main.js',
    'src/index.jsx',
    'src/index.js',
    'index.html'
  ];

  for (const c of candidates) {
    const fullPath = path.join(dir, c);
    if (fs.existsSync(fullPath)) {
      return {
        path: c,
        content: fs.readFileSync(fullPath, 'utf8')
      };
    }
  }
  return { path: 'unknown', content: '' };
}

/**
 * Recursively parses Playwright's JSON report and extracts assertions with detailed error traces and locations.
 */
function parsePlaywrightResults(report: any): { message: string; passed: boolean; errors?: string[]; location?: { file?: string; line?: number; column?: number } }[] {
  const assertions: { message: string; passed: boolean; errors?: string[]; location?: { file?: string; line?: number; column?: number } }[] = [];
  if (!report || !Array.isArray(report.suites)) {
    return assertions;
  }
  
  function collectSpecs(suite: any) {
    if (Array.isArray(suite.specs)) {
      suite.specs.forEach((spec: any) => {
        const passed = !!spec.ok;
        const errors: string[] = [];
        let location: { file?: string; line?: number; column?: number } | undefined;

        if (!passed && Array.isArray(spec.tests)) {
          for (const test of spec.tests) {
            if (Array.isArray(test.results)) {
              for (const res of test.results) {
                if (res.error?.message) {
                  const cleanMsg = res.error.message.replace(/\u001b\[[0-9;]*m/g, '');
                  if (!errors.includes(cleanMsg)) errors.push(cleanMsg);
                }
                if (Array.isArray(res.errors)) {
                  for (const err of res.errors) {
                    if (err.message) {
                      const cleanMsg = err.message.replace(/\u001b\[[0-9;]*m/g, '');
                      if (!errors.includes(cleanMsg)) errors.push(cleanMsg);
                    }
                    if (err.location && !location) {
                      location = err.location;
                    }
                  }
                }
              }
            }
          }
        }

        assertions.push({
          message: spec.title,
          passed,
          errors: errors.length > 0 ? errors : undefined,
          location
        });
      });
    }
    if (Array.isArray(suite.suites)) {
      suite.suites.forEach(collectSpecs);
    }
  }

  report.suites.forEach(collectSpecs);
  return assertions;
}

/**
 * Phase 1 Pre-Processor: Categorizes trajectory steps into 5 milestone/noise types and computes metrics.
 */
function preprocessTrajectory(trajectorySummary: any, chatLog: string): PreprocessedTrajectory {
  const steps = trajectorySummary?.steps || [];
  const taggedSteps: TaggedStep[] = [];
  const searchQueries: string[] = [];
  const retrievedGuideIds: string[] = [];
  const mandatoryRulesAdopted: string[] = [];
  let codeMutationCount = 0;
  let noiseCount = 0;
  let errorLoopCount = 0;
  let consecutiveErrors = 0;

  for (let i = 0; i < steps.length; i++) {
    const rawStep = steps[i];
    const stepNumber = rawStep.stepNumber || i + 1;
    const thought = rawStep.thought || '';
    const actionName = (rawStep.action?.name || rawStep.action?.type || '').toLowerCase();
    const actionParamsStr = JSON.stringify(rawStep.action?.params || rawStep.action || {}).toLowerCase();
    const isErr = rawStep.outcome?.status === 'error';

    if (isErr) {
      consecutiveErrors++;
      if (consecutiveErrors >= 2) {
        errorLoopCount++;
      }
    } else {
      consecutiveErrors = 0;
    }

    let category: TaggedStep['category'] = 'incidental_noise';

    // 1. Guide Retrieval
    if (actionName.includes('retrieve') || (actionName.includes('get_best_practices') && actionParamsStr.includes('retrieve')) || actionParamsStr.includes('retrieve')) {
      category = 'guide_retrieval';
      const paramsObj = rawStep.action?.params || rawStep.action || {};
      let guideId = paramsObj.id || paramsObj.guideId;
      if (!guideId && typeof paramsObj.command === 'string' && paramsObj.command.includes('retrieve')) {
        guideId = paramsObj.query;
      }
      if (!guideId && typeof paramsObj.query === 'string' && actionParamsStr.includes('retrieve')) {
        guideId = paramsObj.query;
      }
      if (!guideId && typeof paramsObj.command === 'string') {
        const match = paramsObj.command.match(/retrieve\s+\\?["']([^"'\\]+)/i) || paramsObj.command.match(/retrieve\s+([^"'\s]+)/i);
        if (match) guideId = match[1];
      }
      if (!guideId) {
        const match = actionParamsStr.match(/id["\s:]+\\?["']?([^"'\\}]+)/i) || actionParamsStr.match(/retrieve\s+\\?["']([^"'\\]+)/i) || actionParamsStr.match(/retrieve\s+([^"'\s\}]+)/i);
        if (match) guideId = match[1];
      }
      if (guideId) {
        retrievedGuideIds.push(String(guideId).trim());
      }
    }
    // 2. Skill Search
    else if (actionName.includes('search') || actionParamsStr.includes('search')) {
      category = 'skill_search';
      const paramsObj = rawStep.action?.params || rawStep.action || {};
      let query = paramsObj.query;
      if (!query && typeof paramsObj.command === 'string') {
        const match = paramsObj.command.match(/search\s+\\?["']([^"'\\]+)/i) || paramsObj.command.match(/search\s+([^"'\s]+)/i);
        if (match) query = match[1];
      }
      if (!query) {
        const match = actionParamsStr.match(/query["\s:]+\\?["']?([^"'\\}]+)/i) || actionParamsStr.match(/search\s+\\?["']([^"'\\]+)/i);
        if (match) query = match[1];
      }
      if (query) {
        searchQueries.push(String(query).trim());
      }
    }
    // 3. Code Mutation
    else if (
      actionName.includes('write') || actionName.includes('replace') || actionName.includes('touch') ||
      actionParamsStr.includes('write_to_file') || actionParamsStr.includes('replace_file_content') ||
      actionParamsStr.includes('index.html') || actionParamsStr.includes('app.jsx') || actionParamsStr.includes('style.css')
    ) {
      category = 'code_mutation';
      codeMutationCount++;
    }
    // 4. Mandatory Rule Thought / Adoption
    else if (
      thought.toLowerCase().includes('mandatory') || thought.toLowerCase().includes('fallback') ||
      thought.toLowerCase().includes('css') || thought.toLowerCase().includes('baseline') ||
      thought.toLowerCase().includes('guidance')
    ) {
      category = 'mandatory_rule_thought';
      mandatoryRulesAdopted.push(thought.slice(0, 120));
    }
    // 5. Incidental Noise (view_file, ls, list_dir, grep)
    else {
      category = 'incidental_noise';
      noiseCount++;
    }

    taggedSteps.push({
      stepNumber,
      category,
      thought,
      actionName: rawStep.action?.name,
      actionDetails: actionParamsStr.slice(0, 200),
      isError: isErr,
      raw: rawStep
    });
  }

  return {
    taggedSteps,
    searchQueries: Array.from(new Set(searchQueries)),
    retrievedGuideIds: Array.from(new Set(retrievedGuideIds)),
    mandatoryRulesAdopted,
    codeMutationCount,
    noiseCount,
    errorLoopCount
  };
}

/**
 * Loads all relevant context for a single run including preprocessed trajectory.
 */
function loadRunContext(runDir: string): RunContext {
  const absoluteDir = path.resolve(runDir);
  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Run directory not found: ${absoluteDir}`);
  }

  const pathSegments = absoluteDir.split(/[/\\]/);
  const runNumberMatch = absoluteDir.match(/[/\\](\d+)[/\\]/);
  const runNumber = runNumberMatch ? parseInt(runNumberMatch[1]) : 0;
  const guideName = pathSegments[pathSegments.length - 3] || '';

  const resultsPath = path.join(absoluteDir, `${guideName}_results.json`);
  let resultsJson: any = null;
  let score = 0;
  if (fs.existsSync(resultsPath)) {
    try {
      const rawReport = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      resultsJson = parsePlaywrightResults(rawReport);
      const passed = resultsJson.filter((c: any) => c.passed).length;
      score = resultsJson.length > 0 ? Math.round((passed / resultsJson.length) * 100) : 0;
    } catch (e) {
      console.warn(`Warning: Failed to parse results JSON in ${absoluteDir}`);
    }
  }

  let trajectorySummary: any = null;
  const trajPath = path.join(absoluteDir, 'trajectory_summary.json');
  if (fs.existsSync(trajPath)) {
    try {
      trajectorySummary = JSON.parse(fs.readFileSync(trajPath, 'utf8'));
    } catch (e) {
      console.warn(`Warning: Failed to parse trajectory summary in ${absoluteDir}`);
    }
  }

  let chatLog = '';
  const chatLogPath = path.join(absoluteDir, 'chat_log.txt');
  if (fs.existsSync(chatLogPath)) {
    chatLog = fs.readFileSync(chatLogPath, 'utf8');
  }

  const code = findCodeOutput(absoluteDir);
  const preprocessed = preprocessTrajectory(trajectorySummary, chatLog);

  return {
    dir: absoluteDir,
    runNumber,
    score,
    resultsJson,
    trajectorySummary,
    chatLog,
    codeOutput: code.content,
    codePath: code.path,
    preprocessed
  };
}

/**
 * Generates an aligned LCS unified diff of two strings for accurate LLM context.
 */
function generateUnifiedDiff(oldText: string, newText: string, oldLabel = 'Old', newLabel = 'New', contextLines = 3): string {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  const m = oldLines.length;
  const n = newLines.length;
  
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  interface EditOp {
    type: 'equal' | 'add' | 'remove';
    oldIndex?: number;
    newIndex?: number;
    line: string;
  }
  const ops: EditOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'equal', oldIndex: i, newIndex: j, line: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'add', newIndex: j, line: newLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      ops.push({ type: 'remove', oldIndex: i, line: oldLines[i - 1] });
      i--;
    }
  }
  ops.reverse();

  if (ops.every(op => op.type === 'equal')) {
    return 'No differences detected.';
  }

  const hunks: {
    oldStart: number;
    oldLinesCount: number;
    newStart: number;
    newLinesCount: number;
    lines: string[];
  }[] = [];

  let opIndex = 0;
  while (opIndex < ops.length) {
    while (opIndex < ops.length && ops[opIndex].type === 'equal') {
      opIndex++;
    }
    if (opIndex >= ops.length) break;

    const hunkStart = Math.max(0, opIndex - contextLines);
    let hunkEnd = opIndex;

    while (hunkEnd < ops.length) {
      if (ops[hunkEnd].type !== 'equal') {
        hunkEnd++;
      } else {
        let nextChange = hunkEnd;
        while (nextChange < ops.length && ops[nextChange].type === 'equal' && (nextChange - hunkEnd) < 2 * contextLines) {
          nextChange++;
        }
        if (nextChange < ops.length && ops[nextChange].type !== 'equal') {
          hunkEnd = nextChange;
        } else {
          break;
        }
      }
    }

    const actualEnd = Math.min(ops.length - 1, hunkEnd + contextLines - 1);
    const hunkOps = ops.slice(hunkStart, actualEnd + 1);
    const oldStarts = hunkOps.filter(op => op.oldIndex !== undefined).map(op => op.oldIndex!);
    const newStarts = hunkOps.filter(op => op.newIndex !== undefined).map(op => op.newIndex!);
    
    const oldStart = oldStarts.length > 0 ? oldStarts[0] : (hunkStart > 0 && ops[hunkStart - 1].oldIndex ? ops[hunkStart - 1].oldIndex! + 1 : 1);
    const newStart = newStarts.length > 0 ? newStarts[0] : (hunkStart > 0 && ops[hunkStart - 1].newIndex ? ops[hunkStart - 1].newIndex! + 1 : 1);
    const oldLinesCount = hunkOps.filter(op => op.type === 'equal' || op.type === 'remove').length;
    const newLinesCount = hunkOps.filter(op => op.type === 'equal' || op.type === 'add').length;

    const lines = hunkOps.map(op => {
      if (op.type === 'equal') return `  ${op.line}`;
      if (op.type === 'remove') return `- ${op.line}`;
      return `+ ${op.line}`;
    });

    hunks.push({ oldStart, oldLinesCount, newStart, newLinesCount, lines });
    opIndex = actualEnd + 1;
  }

  let result = `--- ${oldLabel}\n+++ ${newLabel}\n`;
  for (const hunk of hunks) {
    result += `@@ -${hunk.oldStart},${hunk.oldLinesCount} +${hunk.newStart},${hunk.newLinesCount} @@\n`;
    result += hunk.lines.join('\n') + '\n';
  }
  return result.trim();
}

/**
 * Phase 2: Sub-agent 1 - Guide Compliance & Requirement Auditor.
 */
async function runSubAgent1_GuideCompliance(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  statusA: string,
  statusB: string
): Promise<string> {
  const systemInstruction = `You are a specialized Web Guidance Compliance Auditor. Your task is to evaluate whether two agent runs (Run A vs Run B) successfully discovered, retrieved, and adhered to the MANDATORY requirements in guide.md and expectations.md.

Specifically analyze:
1. **Skill Discovery & Search**: Compare search queries used by Run A vs Run B. Did the search query accurately surface the guide, or did it miss due to vague/generic phrasing?
2. **Guide Retrieval & Reading**: Did the agent actually retrieve guide.md?
3. **Mandatory Rule Adoption**: Compare agent thinking/reasoning steps against MANDATORY guide requirements. Did an agent explicitly ignore, bypass, or misunderstand a mandatory rule (e.g. opting for JS instead of CSS, omitting fallback, missing required HTML attributes)?
4. **Compliance Discrepancy**: Explain how guide compliance directly accounts for the difference in score between Run A (${ctxA.score}%) and Run B (${ctxB.score}%).`;

  const prompt = `### Task Prompt
"""
${guideCtx.taskPrompt}
"""

### Reference Guidance (guide.md)
"""
${guideCtx.guideContent.slice(0, 4000)}
"""

### Expected Outcomes (expectations.md)
"""
${guideCtx.expectationsContent.slice(0, 3000)}
"""

### Run A (${statusA} - Score: ${ctxA.score}%)
- Search Queries: ${JSON.stringify(ctxA.preprocessed.searchQueries)}
- Retrieved Guide IDs: ${JSON.stringify(ctxA.preprocessed.retrievedGuideIds)}
- Key Adopted Thoughts / Rules:
${JSON.stringify(ctxA.preprocessed.mandatoryRulesAdopted, null, 2)}

### Run B (${statusB} - Score: ${ctxB.score}%)
- Search Queries: ${JSON.stringify(ctxB.preprocessed.searchQueries)}
- Retrieved Guide IDs: ${JSON.stringify(ctxB.preprocessed.retrievedGuideIds)}
- Key Adopted Thoughts / Rules:
${JSON.stringify(ctxB.preprocessed.mandatoryRulesAdopted, null, 2)}
`;

  return callGeminiApiDirectly(systemInstruction, prompt, 'Sub-Agent 1 (Guide Compliance)');
}

/**
 * Phase 2: Sub-agent 2 - Code-to-Trajectory Backtracking & Friction Diagnostic.
 */
async function runSubAgent2_CodeAndFriction(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  diffBaseVsA: string,
  diffBaseVsB: string,
  diffAvsB: string,
  statusA: string,
  statusB: string
): Promise<string> {
  const systemInstruction = `You are a Code & Execution Diagnostic Sub-Agent. Your task is to identify the precise technical reason why Run A failed Playwright tests that Run B passed (or vice versa), using factual evidence from grader code, error traces, and exact code diffs.

Mandatory Audit Steps:
1. **Grader & Error Trace Check**: Inspect \`grader.ts\` and the exact Playwright error logs. Did the test fail due to a strict locator mismatch (e.g. querying \`button\` when the agent created \`<a>\`), timing issues, missing required CSS rules, or missing functionality? State the exact line of \`grader.ts\` and the failure message.
2. **Base App Diff Audit**: Compare what Run A and Run B modified relative to the Base App. Do NOT attribute missing/extra styles in Run A to "corrupted code" or "botched search/replace" unless Run A actually deleted existing lines that were present in the Base App. Distinguish carefully between code deleted by Run A vs new code added exclusively by Run B.
3. **Execution vs. Trajectory Status**: Check whether the file modification tool calls (\`write_file\`, \`multi_replace_file_content\`, etc.) succeeded or returned errors in the trajectory. Do not claim the agent hallucinated or botched an edit if the tool reported \`status: success\` and produced valid HTML/CSS/JS.
4. **Friction Assessment**: Only cite context noise or retries as a contributing factor if trajectory logs explicitly show the model losing track of instructions, entering error recovery loops, or making blind retries. If the agent completed its edits cleanly on the first try but chose an incompatible HTML element (like \`<a>\` instead of \`<button>\`), state clearly that this was a locator alignment/implementation choice rather than context loss.`;

  const failedTracesA = (ctxA.resultsJson || []).filter((c: any) => !c.passed).map((c: any) => ({
    assertion: c.message,
    location: c.location ? `Line ${c.location.line}` : 'Unknown',
    errors: c.errors || ['Unknown error']
  }));

  const failedTracesB = (ctxB.resultsJson || []).filter((c: any) => !c.passed).map((c: any) => ({
    assertion: c.message,
    location: c.location ? `Line ${c.location.line}` : 'Unknown',
    errors: c.errors || ['Unknown error']
  }));

  const prompt = `### Validation Logic (grader.ts)
"""
${guideCtx.graderContent.slice(0, 15000)}
"""

### Run A (${statusA} - Score: ${ctxA.score}%)
- Dir: ${ctxA.dir}
- Passed Assertions: ${JSON.stringify((ctxA.resultsJson || []).filter((c: any) => c.passed).map((c: any) => c.message))}
- Failed Test Traces:
${JSON.stringify(failedTracesA, null, 2)}
- Trajectory Tagged Steps Summary:
  - Code Mutations: ${ctxA.preprocessed.codeMutationCount}
  - Context Noise Steps: ${ctxA.preprocessed.noiseCount}
  - Error/Retry Loops: ${ctxA.preprocessed.errorLoopCount}

### Run B (${statusB} - Score: ${ctxB.score}%)
- Dir: ${ctxB.dir}
- Passed Assertions: ${JSON.stringify((ctxB.resultsJson || []).filter((c: any) => c.passed).map((c: any) => c.message))}
- Failed Test Traces:
${JSON.stringify(failedTracesB, null, 2)}
- Trajectory Tagged Steps Summary:
  - Code Mutations: ${ctxB.preprocessed.codeMutationCount}
  - Context Noise Steps: ${ctxB.preprocessed.noiseCount}
  - Error/Retry Loops: ${ctxB.preprocessed.errorLoopCount}

### Code Diffs (Unified Diff Format)

#### Diff 1: Base App vs Run A Output
"""
${diffBaseVsA.slice(0, 30000)}
"""

#### Diff 2: Base App vs Run B Output
"""
${diffBaseVsB.slice(0, 30000)}
"""

#### Diff 3: Run A Output vs Run B Output
"""
${diffAvsB.slice(0, 30000)}
"""

### Tagged Trajectory Steps Overview
#### Run A:
${JSON.stringify(ctxA.preprocessed.taggedSteps.map(s => ({ step: s.stepNumber, cat: s.category, action: s.actionName, isErr: s.isError, thought: s.thought?.slice(0, 100) })), null, 2)}

#### Run B:
${JSON.stringify(ctxB.preprocessed.taggedSteps.map(s => ({ step: s.stepNumber, cat: s.category, action: s.actionName, isErr: s.isError, thought: s.thought?.slice(0, 100) })), null, 2)}
`;

  return callGeminiApiDirectly(systemInstruction, prompt, 'Sub-Agent 2 (Code & Friction)');
}

/**
 * Phase 3: Synthesizer - Combines sub-agent outputs into the 4-section diagnostic report.
 */
async function synthesizeDiagnosis(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  complianceAnalysis: string,
  codeAndFrictionAnalysis: string,
  statusA: string,
  statusB: string
): Promise<string> {
  const systemInstruction = `You are an expert Lead Diagnostic Engineer synthesizing a variance diagnosis between two AI agent evaluation runs.

You MUST structure your report into exactly the following four sections in Markdown format. Do not alter section titles:

### 1. First Meaningful Divergence
- **Step Number**: Step X (Specify exact step number where the first MEANINGFUL divergence occurred, e.g. Step 8 where code mutation was executed, or earlier if skill/guide discovery diverged)
- **Event Type**: [Skill Search | Guide Retrieval | Mandatory Rule Adoption | Code Implementation | Error Recovery]
- **Divergence Summary**: Direct, objective explanation of why this specific step represents the root divergence point based on factual tool outputs and code choices.

### 2. Guide Compliance & Milestone Matrix
Provide a Markdown table summarizing key milestones:
| Milestone / Metric | Run A (Score: ${ctxA.score}%) | Run B (Score: ${ctxB.score}%) | Status |
| :--- | :--- | :--- | :---: |
| **Skill Search Query** | ... | ... | ... |
| **Guide Retrieval** | ... | ... | ... |
| **Mandatory Rule Adoption** | ... | ... | ... |
| **Context Noise / Retries** | ... | ... | ... |

### 3. Root Cause & Friction Analysis
Provide an objective, strictly fact-grounded technical breakdown:
- State the exact locator, API, or DOM mismatch that triggered the Playwright failure, referencing specific lines in \`grader.ts\` and error logs.
- Explicitly distinguish between structural test harness mismatches (e.g. grader expecting a specific element tag like \`<button>\` when the agent used \`<a>\`) versus genuine agent capability failures (e.g. failing to implement the required web platform API or missing required functionality).
- Do NOT fabricate narrative claims about context loss, memory decay, or botched edits unless trajectory logs show explicit tool failures, blind retries, or error loops.

### 4. Actionable Fix Recommendation
Provide clear, concrete recommendations on whether to update:
- **Guide (guide.md)**: (e.g. add MANDATORY keyword, clarify code example)
- **Prompt (tasks/task.md)**: (e.g. add declarative constraint, clarify trigger element type)
- **Grader (grader.ts)**: (e.g. relax rigid locator like \`button:visible\` to \`button:visible, a:visible, [role="button"]:visible\` to avoid false negatives)
- **Agent/Model Non-Determinism**: (if guide & prompt are clear but the model chose an incompatible element or pattern due to non-determinism)`;

  const prompt = `### Guide & Task Context
- Guide Name: ${guideCtx.guideName}
- Task Name: ${guideCtx.taskName}

### Run A (${statusA} - Score: ${ctxA.score}%, Dir: ${ctxA.dir})
### Run B (${statusB} - Score: ${ctxB.score}%, Dir: ${ctxB.dir})

### Sub-Agent 1: Guide Compliance Analysis
"""
${complianceAnalysis}
"""

### Sub-Agent 2: Code-to-Trajectory & Friction Analysis
"""
${codeAndFrictionAnalysis}
"""`;

  return callGeminiApiDirectly(systemInstruction, prompt, 'Synthesizer Sub-Agent');
}

/**
 * Runs the diagnostic agent comparison using Gemini API sub-agents.
 */
export async function runComparison(runDirA: string, runDirB: string): Promise<string> {
  console.log(cCyan(`\n=== Starting Run Comparison (Guide-Grounded 3-Phase Pipeline) ===`));
  console.log(`Run A: ${runDirA}`);
  console.log(`Run B: ${runDirB}\n`);

  await downloadRunFromGcsIfMissing(runDirA);
  await downloadRunFromGcsIfMissing(runDirB);

  const ctxA = loadRunContext(runDirA);
  const ctxB = loadRunContext(runDirB);

  const isAProblem = ctxA.score < ctxB.score;
  const successCtx = isAProblem ? ctxB : ctxA;

  console.log(`Comparing Run A (Score: ${ctxA.score}%) vs Run B (Score: ${ctxB.score}%)...`);

  const pathSegments = successCtx.dir.split(/[/\\]/);
  const runType = pathSegments.pop() || 'guided';
  const taskName = pathSegments.pop() || 'task';
  const guideName = pathSegments.pop() || 'guide';

  const guideCtx = findGuideContext(guideName, taskName);
  const diffBaseVsA = generateUnifiedDiff(guideCtx.baseAppContent || '', ctxA.codeOutput || '', 'Base App', 'Run A Output');
  const diffBaseVsB = generateUnifiedDiff(guideCtx.baseAppContent || '', ctxB.codeOutput || '', 'Base App', 'Run B Output');
  const diffAvsB = generateUnifiedDiff(ctxA.codeOutput || '', ctxB.codeOutput || '', 'Run A Output', 'Run B Output');

  const statusA = ctxA.score > ctxB.score ? 'SUCCESSFUL' : ctxA.score < ctxB.score ? 'FAILED/POORER' : 'COMPARED RUN';
  const statusB = ctxB.score > ctxA.score ? 'SUCCESSFUL' : ctxB.score < ctxA.score ? 'FAILED/POORER' : 'COMPARED RUN';

  const suiteMatch = successCtx.dir.match(/(.*[/\\]results[/\\][^/\\]+)/);
  const suiteDir = suiteMatch ? suiteMatch[1] : successCtx.dir;
  const workDir = path.join(suiteDir, 'compare_work');
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  try {
    console.log(cBold(`[Compare Agent] Phase 1: Pre-processed trajectories into tagged milestones.`));
    console.log(`  Run A: ${ctxA.preprocessed.taggedSteps.length} steps (${ctxA.preprocessed.noiseCount} noise, ${ctxA.preprocessed.errorLoopCount} retries)`);
    console.log(`  Run B: ${ctxB.preprocessed.taggedSteps.length} steps (${ctxB.preprocessed.noiseCount} noise, ${ctxB.preprocessed.errorLoopCount} retries)`);

    console.log(cBold(`[Compare Agent] Phase 2: Dispatching parallel sub-agents (Guide Compliance & Code/Friction)...`));
    const [complianceAnalysis, codeAndFrictionAnalysis] = await Promise.all([
      runSubAgent1_GuideCompliance(guideCtx, ctxA, ctxB, statusA, statusB),
      runSubAgent2_CodeAndFriction(guideCtx, ctxA, ctxB, diffBaseVsA, diffBaseVsB, diffAvsB, statusA, statusB)
    ]);

    console.log(cBold(`[Compare Agent] Phase 3: Synthesizing final 4-section diagnostic report...`));
    const markdownReport = await synthesizeDiagnosis(
      guideCtx,
      ctxA,
      ctxB,
      complianceAnalysis,
      codeAndFrictionAnalysis,
      statusA,
      statusB
    );

    let savedPath = '';
    if (suiteMatch) {
      const diagnosesDir = path.join(suiteDir, 'variance_diagnoses');
      if (!fs.existsSync(diagnosesDir)) {
        fs.mkdirSync(diagnosesDir, { recursive: true });
      }
      
      const fileName = `${guideName}-${taskName}-${runType}.md`;
      savedPath = path.join(diagnosesDir, fileName);
      fs.writeFileSync(savedPath, markdownReport, 'utf8');
      console.log(cGreen(`\n✅ Saved diagnostic report to: ${savedPath}`));
    }

    const localSavedPath = path.resolve('./variance_diagnosis.md');
    fs.writeFileSync(localSavedPath, markdownReport, 'utf8');
    console.log(cGreen(`✅ Saved local copy to: ${localSavedPath}\n`));

    console.log(cBold(cCyan('--- DIAGNOSTIC REPORT ---')));
    console.log(markdownReport);
    console.log(cCyan('-------------------------'));

    return markdownReport;
  } catch (err: any) {
    console.error(cRed(`❌ Diagnosis failed: ${err.message}`));
    throw err;
  }
}
