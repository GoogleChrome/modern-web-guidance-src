import fs from 'fs';
import path from 'path';
import config from '../config.ts';
import { cGreen, cRed, cCyan, cBold } from '../../lib/colors.ts';
import { downloadRunFromGcsIfMissing } from './gcs-downloader.ts';

/**
 * Dynamically fetches all active models from the Gemini API and returns them sorted by version and capability.
 * Sorts primarily by version number (e.g. 3.5 > 2.5) and secondarily by capability tier (pro > flash).
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

        // Rule 0: Exclude all models with "image" or "tts" in their names
        const nameLower = m.name.toLowerCase();
        if (nameLower.includes('image') || nameLower.includes('tts')) {
          return false;
        }
        return true;
      })
      .map((m: any) => {
        // Parse major version, minor version, and tier from name
        // e.g. "models/gemini-3.5-flash" -> version: 3.5, tier: "flash"
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

    // Sort hierarchy:
    // 1. Major version descending (3 > 2)
    // 2. Tier descending (pro > flash)
    // 3. Minor version descending (3.5 > 3.1)
    geminiModels.sort((a: any, b: any) => {
      // 1. Major version
      if (b.major !== a.major) {
        return b.major - a.major;
      }
      
      // 2. Tier (Pro > Flash)
      const tierScore = (t: string) => t === 'pro' ? 2 : 1;
      const scoreB = tierScore(b.tier);
      const scoreA = tierScore(a.tier);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      
      // 3. Minor version
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
 * Attempts to generate content with a specific model.
 */
/**
 * Attempts to generate content with a specific model using both systemInstruction and prompt.
 */
async function attemptGenerateContent(apiKey: string, model: string, systemInstruction: string, prompt: string): Promise<string> {
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
  
  // Write data to a debug file for precise JSON structure analysis
  try {
    const debugDir = path.resolve('./results/compare_work');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    fs.writeFileSync(path.join(debugDir, 'response_debug.json'), JSON.stringify(data, null, 2), 'utf8');
    console.log(`[Compare Agent] 🧪 Wrote API response debug log to results/compare_work/response_debug.json`);
  } catch (e) {}

  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    throw new Error('Failed to parse content from response: ' + JSON.stringify(data));
  }

  // Filter out thinking parts (where thought: true) and extract only the final answer text
  const nonThoughtParts = parts.filter((part: any) => !part.thought);
  
  if (nonThoughtParts.length === 0) {
    // Fallback to the first part if no non-thought parts are present
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
async function callGeminiApiDirectly(systemInstruction: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please add GEMINI_API_KEY="your_api_key_here" to a .env file at the project root.');
  }

  // Get candidate models: respect user override, or fetch sorted list
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

    console.log(`[Compare Agent] Attempting diagnosis with model: ${model}...`);
    try {
      const result = await attemptGenerateContent(apiKey, model, systemInstruction, prompt);
      console.log(`[Compare Agent] ✅ Successful diagnosis using model: ${model}`);
      return result;
    } catch (err: any) {
      console.warn(`[Compare Agent] ⚠️ Model ${model} failed or overloaded: ${err.message}`);
      errors.push(`${model}: ${err.message}`);
      
      if (i < models.length - 1) {
        console.log(`[Compare Agent] Retrying with next best model in list...`);
      }
    }
  }

  throw new Error(`All available Gemini models failed or were overloaded:\n${errors.map(e => `  - ${e}`).join('\n')}`);
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
}

/**
 * Helper to find the main generated code file in a run directory.
 * Looks for index.html, App.jsx, App.js, etc.
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
 * Recursively parses Playwright's JSON report and extracts a flat array of assertions.
 */
function parsePlaywrightResults(report: any): { message: string; passed: boolean }[] {
  const assertions: { message: string; passed: boolean }[] = [];
  if (!report || !Array.isArray(report.suites)) {
    return assertions;
  }
  
  function collectSpecs(suite: any) {
    if (Array.isArray(suite.specs)) {
      suite.specs.forEach((spec: any) => {
        assertions.push({
          message: spec.title,
          passed: !!spec.ok
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
 * Loads all relevant context for a single run.
 */
function loadRunContext(runDir: string): RunContext {
  const absoluteDir = path.resolve(runDir);
  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Run directory not found: ${absoluteDir}`);
  }

  // Parse run details from path
  const pathSegments = absoluteDir.split(/[/\\]/);
  const runNumberMatch = absoluteDir.match(/[/\\](\d+)[/\\]/);
  const runNumber = runNumberMatch ? parseInt(runNumberMatch[1]) : 0;

  // Extract guide name which is 3 levels up from the leaf run type folder
  // e.g. results/test_xxx/1/guideName/taskName/guided -> guideName is index length - 3
  const guideName = pathSegments[pathSegments.length - 3] || '';

  // 1. Load results JSON using the guide-specific filename
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

  // 2. Load trajectory summary
  let trajectorySummary: any = null;
  const trajPath = path.join(absoluteDir, 'trajectory_summary.json');
  if (fs.existsSync(trajPath)) {
    try {
      trajectorySummary = JSON.parse(fs.readFileSync(trajPath, 'utf8'));
    } catch (e) {
      console.warn(`Warning: Failed to parse trajectory summary in ${absoluteDir}`);
    }
  }

  // 3. Load chat log
  let chatLog = '';
  const chatLogPath = path.join(absoluteDir, 'chat_log.txt');
  if (fs.existsSync(chatLogPath)) {
    chatLog = fs.readFileSync(chatLogPath, 'utf8');
  }

  // 4. Load generated code
  const code = findCodeOutput(absoluteDir);

  return {
    dir: absoluteDir,
    runNumber,
    score,
    resultsJson,
    trajectorySummary,
    chatLog,
    codeOutput: code.content,
    codePath: code.path
  };
}

/**
 * Generates a simple line-by-line diff of two strings for LLM context.
 */
function simpleTextDiff(a: string, b: string): string {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  let diff = '';
  
  // Very basic diff: just list line counts and show them if short,
  // or do a simple side-by-side. To keep it clean, we'll output a simple unified diff representation.
  // Since we are in Node, we can just do a basic comparison.
  const maxLines = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLines; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];
    if (lineA !== lineB) {
      if (lineA !== undefined) diff += `- L${i+1}: ${lineA}\n`;
      if (lineB !== undefined) diff += `+ L${i+1}: ${lineB}\n`;
    }
  }
  return diff || 'No differences detected.';
}

/**
 * Runs the diagnostic agent comparison using Gemini CLI.
 */
export async function runComparison(runDirA: string, runDirB: string): Promise<string> {
  console.log(cCyan(`\n=== Starting Run Comparison ===`));
  console.log(`Run A: ${runDirA}`);
  console.log(`Run B: ${runDirB}\n`);

  // Lazily download from GCS if directories are missing locally
  await downloadRunFromGcsIfMissing(runDirA);
  await downloadRunFromGcsIfMissing(runDirB);

  const ctxA = loadRunContext(runDirA);
  const ctxB = loadRunContext(runDirB);

  // Identify which is successful and which is failed/poorer for diagnostic orientation
  const isAProblem = ctxA.score < ctxB.score;
  const successCtx = isAProblem ? ctxB : ctxA;
  const failCtx = isAProblem ? ctxA : ctxB;

  console.log(`Comparing Run A (Score: ${ctxA.score}%) vs Run B (Score: ${ctxB.score}%)...`);

  // Extract prompt from run.mjs if possible
  let taskPrompt = 'Unknown prompt';
  try {
    const runScriptPath = path.join(ctxA.dir, 'run.mjs');
    if (fs.existsSync(runScriptPath)) {
      const runScriptText = fs.readFileSync(runScriptPath, 'utf8');
      const match = runScriptText.match(/\.\.\.\[([\s\S]+?)\]/);
      if (match) {
        const arrayStr = `[${match[1]}]`;
        const arr = JSON.parse(arrayStr);
        taskPrompt = arr[1];
      }
    }
  } catch (e) {}

  // Generate code diff (A vs B)
  const codeDiff = simpleTextDiff(ctxA.codeOutput, ctxB.codeOutput);

  // Construct the LLM Prompt
  // Explicitly map Run A -> ctxA and Run B -> ctxB to prevent name inversions on the dashboard
  const statusA = ctxA.score > ctxB.score ? 'SUCCESSFUL' : ctxA.score < ctxB.score ? 'FAILED/POORER' : 'COMPARED RUN';
  const statusB = ctxB.score > ctxA.score ? 'SUCCESSFUL' : ctxB.score < ctxA.score ? 'FAILED/POORER' : 'COMPARED RUN';

  const systemInstruction = `You are an expert software engineering diagnostic agent. Your task is to compare two runs of an AI coding agent executing the same task, and write a highly technical, objective, and extremely precise diagnostic report in Markdown format.

Be extremely thorough, exhaustive, and detailed in your analysis. Under the Root Cause Explanation, write a comprehensive, step-by-step technical breakdown of any race conditions, event sequences, execution flows, or metric finalizations, ensuring no detail is omitted.

You MUST structure your report into exactly the following three sections. Do not summarize or truncate your explanations early; provide complete trace analyses and ensure all three sections are fully populated. Start directly with the section headings:

1. **Divergence Point**: Identify the exact step or moment in the trajectories where the two runs diverged in their approach or quality of execution.
2. **Root Cause Explanation**: Explain the technical reason why this divergence caused the difference in outcomes, referencing the code differences, failed assertions, or trajectory logs.
3. **Trajectory Contrast**: Provide a summary comparing the steps taken, highlighting the contrasting decisions made by the agents (using a markdown table where appropriate).`;

  const prompt = `### Task Prompt
"""
${taskPrompt}
"""

### Run A (${statusA} - Score: ${ctxA.score}%)
- Dir: ${ctxA.dir}
- Passed Assertions:
${ctxA.resultsJson ? JSON.stringify(ctxA.resultsJson.filter((c: any) => c.passed).map((c: any) => c.message), null, 2) : 'None'}
- Failed Assertions:
${ctxA.resultsJson ? JSON.stringify(ctxA.resultsJson.filter((c: any) => !c.passed).map((c: any) => c.message), null, 2) : 'None'}

### Run B (${statusB} - Score: ${ctxB.score}%)
- Dir: ${ctxB.dir}
- Passed Assertions:
${ctxB.resultsJson ? JSON.stringify(ctxB.resultsJson.filter((c: any) => c.passed).map((c: any) => c.message), null, 2) : 'None'}
- Failed Assertions:
${ctxB.resultsJson ? JSON.stringify(ctxB.resultsJson.filter((c: any) => !c.passed).map((c: any) => c.message), null, 2) : 'None'}

### Trajectory Comparison (Normalized Steps)
#### Run A Steps:
${ctxA.trajectorySummary ? JSON.stringify(ctxA.trajectorySummary.steps, null, 2) : 'No trajectory summary available.'}

#### Run B Steps:
${ctxB.trajectorySummary ? JSON.stringify(ctxB.trajectorySummary.steps, null, 2) : 'No trajectory summary available.'}

### Generated Code Differences (${ctxA.codePath || 'code output'})
- Run A Output Length: ${ctxA.codeOutput.length} chars
- Run B Output Length: ${ctxB.codeOutput.length} chars
- Line-by-line Diff (Run A vs Run B):
"""
${codeDiff.slice(0, 5000)}
"""`;

  // Create a temporary workspace inside the results directory for prompt logging
  const suiteMatch = successCtx.dir.match(/(.*[/\\]results[/\\][^/\\]+)/);
  const suiteDir = suiteMatch ? suiteMatch[1] : successCtx.dir;
  const workDir = path.join(suiteDir, 'compare_work');
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  const promptPath = path.join(workDir, 'compare_prompt.txt');
  fs.writeFileSync(promptPath, prompt, 'utf8');

  try {
    console.log(`Sending trajectories to Gemini API for variance diagnosis...`);
    const markdownReport = await callGeminiApiDirectly(systemInstruction, prompt);
    
    // Determine where to save the report
    let savedPath = '';
    if (suiteMatch) {
      const diagnosesDir = path.join(suiteDir, 'variance_diagnoses');
      if (!fs.existsSync(diagnosesDir)) {
        fs.mkdirSync(diagnosesDir, { recursive: true });
      }
      
      const pathSegments = successCtx.dir.split(/[/\\]/);
      const runType = pathSegments.pop(); // guided
      const taskName = pathSegments.pop(); // content-vis-task
      const guideName = pathSegments.pop(); // content-vis
      
      const fileName = `${guideName}-${taskName}-${runType}.md`;
      savedPath = path.join(diagnosesDir, fileName);
      fs.writeFileSync(savedPath, markdownReport, 'utf8');
      console.log(cGreen(`\n✅ Saved diagnostic report to: ${savedPath}`));
    }

    // Also write to current working directory as a convenience
    const localSavedPath = path.resolve('./variance_diagnosis.md');
    fs.writeFileSync(localSavedPath, markdownReport, 'utf8');
    console.log(cGreen(`✅ Saved local copy to: ${localSavedPath}\n`));

    // Print the report directly to console (this will be streamed in real-time to the dashboard!)
    console.log(cBold(cCyan('--- DIAGNOSTIC REPORT ---')));
    console.log(markdownReport);
    console.log(cCyan('-------------------------'));

    return markdownReport;

  } catch (err: any) {
    console.error(cRed(`❌ Diagnosis failed: ${err.message}`));
    throw err;
  } finally {
    try {
      if (fs.existsSync(promptPath)) {
        fs.unlinkSync(promptPath);
      }
    } catch {}
  }
}
