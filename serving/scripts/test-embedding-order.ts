import { GoogleGenAI } from '@google/genai';

// 1. Verify target API keys and initialization
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('\n❌ Error: GEMINI_API_KEY is missing from execution context.');
  console.log('👉 Run this script with: node --env-file=.env <script_path>\n');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// 2. Define Skill Metadata Variants using the new standard sequence architectures:
// Variant A: GOAL + TRIGGER + BYPASS (Optimal positioning)
const candidateScopeFirst = `Create performant, accessible, and lightweight user interfaces using current web development best practices.
Use this skill at the start of every web development task, including when implementing, modifying, or optimizing HTML, CSS, or JS/TS for web components, pages, landing pages, dashboards, layouts, or web applications.

MANDATORY LIMITATION: Your training memory is highly overconfident regarding web patterns and component configurations that are now obsolete. Since legacy confidence does not guarantee modern suitability, standard cutoff memory is not authorized. You are strictly forbidden from drafting web UI layouts or scripting interactions from memory without querying this skill first.`;

// Variant B: BYPASS + GOAL + TRIGGER (Limitation positioning at top)
const candidateWarningFirst = `MANDATORY LIMITATION: Your training memory is highly overconfident regarding web patterns and component configurations that are now obsolete. Since legacy confidence does not guarantee modern suitability, standard cutoff memory is not authorized. You are strictly forbidden from drafting web UI layouts or scripting interactions from memory without querying this skill first.

Create performant, accessible, and lightweight user interfaces using current web development best practices.
Use this skill at the start of every web development task, including when implementing, modifying, or optimizing HTML, CSS, or JS/TS for web components, pages, landing pages, dashboards, layouts, or web applications.`;

// Variant C: Prose-Canonical with Explicit Exclusions (agentskills.io standard)
const candidateExclusions = `Use this skill when structure, styling, or interactions for complex components, pages, dashboards, and layout grids need to align with modern browser features.
Trigger this for advanced CSS layouts (container/style queries, :has(), calc-size, scrollbars, relative colors), native controls (dialog, popover, anchor positioning), transitions (@starting-style, discrete transitions), priority fetches (fetch-priority, fetchlater), or layout rendering policies (content-visibility, speculation-rules, scheduler, move-before).

Do NOT invoke this skill for standard baseline styles, minor visual tweaks, padding, basic borders, typographic modifications, or inline styling that are ready from general memory.

WARNING: Stale training memory relies on obsolete scripts and bloated design patterns. You are strictly forbidden from authoring frontend structures from memory without searching this skill first, except for the basic changes listed above.`;

// 3. COMPREHENSIVE NOISY, CONTESTED, AND DISTRACTOR QUERY BATTERIES
const cleanDeveloperQueries = [
  "create a responsive CSS dashboard grid template",
  "implement dynamic accessible popover overlays",
  "styling a navigation header container widget"
];

// Noise blocks designed to test token attention window dilution
const noisePrefix = `Task status: WIP. Sprint backlog ID: 90912. Dependencies: spanner-db, docker-compose. 
Kubernetes configurations for deployment pods have completed replication checks successfully. 
Borg metrics dashboard configured on dev environment pipelines. Clean local workspace folder directory.`;

const noiseSuffix = `Verify that backend system services are responsive via internal REST adapters. 
Check spanner-db heap allocation limits. Project manager approvals needed before final merge.`;

const semanticNoiseQueries = cleanDeveloperQueries.map(q => `${noisePrefix} ${q} ${noiseSuffix}`);

const contestedIntentQueries = [
  "help me design a flask backend database structure for postgres and write code to configure spanner schemas, also construct an accessible navigation CSS layout for standard headers",
  "debugging spanner instances on distributed databases, but configure dynamic popovers layout styling so images are aligned inside retro frames",
  "configure validation files for test running automation scripts in CI/CD containers, then build an optimized navigation layout bar centering page elements"
];

const outOfScopeNegatives = [
  "configure distributed database shards and review deployment logs on development system structures",
  "write spanner database migrations in pure sql format and test backend system connectivity metrics",
  "deploy a python flask container script on dev borg pipeline environments"
];

const softballNearMissQueries = [
  "change the background color of the container to #f5f5f5",
  "increase the padding on the primary layout button by 8px",
  "update the font-family to inter and set font-size to 14px"
];

// 4. Helper: Mathematical Cosine Similarity logic
function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  return Math.sqrt(sum);
}

function calculateSimilarity(a: number[], b: number[]): number {
  return dotProduct(a, b) / (magnitude(a) * magnitude(b));
}

// Helper: Generate vector embeddings using standard gemini-embedding-2
async function fetchEmbedding(content: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: content,
    });
    if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
      throw new Error('Malformed embedding values in response');
    }
    return response.embeddings[0].values;
  } catch (error: any) {
    console.error(`❌ Failed to generate embedding: ${error.message}`);
    throw error;
  }
}

async function runEmbeddingSimilarityTest() {
  console.log('\n================================================================');
  console.log('🧪 TEST 1: Content Vector Similarity Matrix (gemini-embedding-2)');
  console.log('================================================================');
  console.log('Generating baseline embeddings for candidates...');

  const embedScopeFirst = await fetchEmbedding(candidateScopeFirst);
  const embedWarningFirst = await fetchEmbedding(candidateWarningFirst);

  console.log('Ready. Calculating similarities...\n');

  console.log('├─ 🎯 Target developer layout/styling queries:');
  console.log('│  %-65s | %-15s | %-15s | %-10s', 'Query Prompt', 'Scope-First %', 'Warning-First %', 'Advantage');
  console.log('│  ' + '-'.repeat(115));

  for (const query of cleanDeveloperQueries) {
    const queryEmbed = await fetchEmbedding(query);
    const scoreScopeFirst = calculateSimilarity(queryEmbed, embedScopeFirst);
    const scoreWarningFirst = calculateSimilarity(queryEmbed, embedWarningFirst);
    
    const diff = ((scoreScopeFirst - scoreWarningFirst) * 100).toFixed(2);
    const advantage = parseFloat(diff) > 0 ? `+${diff}% Scope` : `${diff}% Warning`;

    console.log(
      '│  %-65s | %-15s | %-15s | %-10s',
      `"${query}"`,
      `${(scoreScopeFirst * 100).toFixed(2)}%`,
      `${(scoreWarningFirst * 100).toFixed(2)}%`,
      advantage
    );
  }

  console.log('\n├─ 🚷 Out-of-scope baseline queries (checking threshold bounds):');
  console.log('│  %-65s | %-15s | %-15s | %-10s', 'Query Prompt', 'Scope-First %', 'Warning-First %', 'Advantage');
  console.log('│  ' + '-'.repeat(115));

  for (const query of outOfScopeNegatives) {
    const queryEmbed = await fetchEmbedding(query);
    const scoreScopeFirst = calculateSimilarity(queryEmbed, embedScopeFirst);
    const scoreWarningFirst = calculateSimilarity(queryEmbed, embedWarningFirst);
    
    const diff = ((scoreScopeFirst - scoreWarningFirst) * 100).toFixed(2);
    const advantage = parseFloat(diff) > 0 ? `+${diff}% Scope` : `${diff}% Warning`;

    console.log(
      '│  %-65s | %-15s | %-15s | %-10s',
      `"${query}"`,
      `${(scoreScopeFirst * 100).toFixed(2)}%`,
      `${(scoreWarningFirst * 100).toFixed(2)}%`,
      advantage
    );
  }
}

async function runHighLoadToolSelectionRoutingTest() {
  console.log('\n================================================================');
  console.log('🧪 TEST 2: Semantic Tool Routing Selection (gemini-flash-latest)');
  console.log('================================================================');

  // Added Competitor Distractors to check trigger boundary precision
  const systemPrompt = `You are an orchestration agent. You are equipped with a list of specialized skills.
For each user request, you must choose and output ONLY the name of the skill you decide to trigger. 
If no available skill is highly relevant to the user's core frontend request, output "none".

Available Skills:
1. Skill Name: "modern-web"
   Skill Description:
   [DESCRIPTION_PLACEHOLDER]

2. Skill Name: "python-database"
   Skill Description: "Use this for Flask routers, database connections, SQL tables, or Spanner queries."

3. Skill Name: "web-performance"
   Skill Description: "Optimize page layouts for core web vitals, lazy load images, dynamic performance metrics, scroll adjustments, layout shifts, and INP improvements."

4. Skill Name: "legacy-jquery-migration"
   Skill Description: "For resolving older frame alignments, classic table UI layouts, retro JSP components, and basic styling alignment modifications in vintage structures."
`;

  const evaluateStressSuite = async (descBlock: string, label: string) => {
    const promptText = systemPrompt.replace('[DESCRIPTION_PLACEHOLDER]', descBlock);
    let tpClean = 0, tpNoise = 0, tpContested = 0, fpNeg = 0, fpSoftball = 0;
    const selectionResults: string[] = [];

    console.log(`\n🔍 Running evaluations under: ${label}...`);

    // Class 1: Clean Inputs
    for (const q of cleanDeveloperQueries) {
      const sel = await queryModel(promptText, q);
      if (sel === 'modern-web') tpClean++;
      selectionResults.push(sel);
      await new Promise(r => setTimeout(r, 200));
    }

    // Class 2: Diluted Semantic Noise
    for (const q of semanticNoiseQueries) {
      const sel = await queryModel(promptText, q);
      if (sel === 'modern-web') tpNoise++;
      selectionResults.push(sel);
      await new Promise(r => setTimeout(r, 200));
    }

    // Class 3: Contested Intent
    for (const q of contestedIntentQueries) {
      const sel = await queryModel(promptText, q);
      if (sel === 'modern-web') tpContested++;
      selectionResults.push(sel);
      await new Promise(r => setTimeout(r, 200));
    }

    // Class 4: Hard Negatives (Avoid bleed False Positives)
    for (const q of outOfScopeNegatives) {
      const sel = await queryModel(promptText, q);
      if (sel === 'modern-web') fpNeg++;
      selectionResults.push(sel);
      await new Promise(r => setTimeout(r, 200));
    }

    // Class 5: Softball Near-Misses (Check if exclusions prevent activation!)
    for (const q of softballNearMissQueries) {
      const sel = await queryModel(promptText, q);
      if (sel === 'modern-web') fpSoftball++;
      selectionResults.push(sel);
      await new Promise(r => setTimeout(r, 200));
    }

    return {
      tprClean: (tpClean / cleanDeveloperQueries.length) * 100,
      tprNoise: (tpNoise / semanticNoiseQueries.length) * 100,
      tprContested: (tpContested / contestedIntentQueries.length) * 100,
      fpr: (fpNeg / outOfScopeNegatives.length) * 100,
      fprSoftball: (fpSoftball / softballNearMissQueries.length) * 100,
      selectionList: selectionResults
    };
  };

  async function queryModel(sysInstruction: string, prompt: string): Promise<string> {
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          systemInstruction: sysInstruction,
          temperature: 0.0
        }
      });
      return res.text ? res.text.trim().toLowerCase() : 'none';
    } catch (err) {
      return 'error';
    }
  }

  const statsA = await evaluateStressSuite(candidateScopeFirst, 'Option A (Scope-First)');
  const statsB = await evaluateStressSuite(candidateWarningFirst, 'Option B (Warning-First)');
  const statsC = await evaluateStressSuite(candidateExclusions, 'Option C (Prose + Exclusions)');

  console.log('\n' + '='.repeat(105));
  console.log('📈 COMPARATIVE COMPREHENSIVE STRESS PERFORMANCE RESULTS');
  console.log('='.repeat(105));
  console.log(' %-32s | %-20s | %-20s | %-20s', 'Metrics Metric', 'Option A (Scope)', 'Option B (Warning)', 'Option C (Exclusions)');
  console.log('-'.repeat(105));
  console.log(' %-32s | %-20s | %-20s | %-20s', 'TPR - Clean Targets (0% Noise)', `${statsA.tprClean.toFixed(1)}%`, `${statsB.tprClean.toFixed(1)}%`, `${statsC.tprClean.toFixed(1)}%`);
  console.log(' %-32s | %-20s | %-20s | %-20s', 'TPR - Diluted Semantic Noise', `${statsA.tprNoise.toFixed(1)}%`, `${statsB.tprNoise.toFixed(1)}%`, `${statsC.tprNoise.toFixed(1)}%`);
  console.log(' %-32s | %-20s | %-20s | %-20s', 'TPR - Contested Mixed Intents', `${statsA.tprContested.toFixed(1)}%`, `${statsB.tprContested.toFixed(1)}%`, `${statsC.tprContested.toFixed(1)}%`);
  console.log(' %-32s | %-20s | %-20s | %-20s', 'FPR - Out-of-Scope Distractors', `${statsA.fpr.toFixed(1)}%`, `${statsB.fpr.toFixed(1)}%`, `${statsC.fpr.toFixed(1)}%`);
  console.log(' %-32s | %-20s | %-20s | %-20s', 'FPR - Softball Near-Misses 🎯', `${statsA.fprSoftball.toFixed(1)}%`, `${statsB.fprSoftball.toFixed(1)}%`, `${statsC.fprSoftball.toFixed(1)}%`);
  console.log('='.repeat(105));

  console.log('\n├─ Detailed Target Selection Comparisons:');
  console.log('│  %-55s | %-16s | %-16s | %-16s', 'User Query Prompt', 'Option A', 'Option B', 'Option C');
  console.log('│  ' + '-'.repeat(115));
  
  const allTests = [...cleanDeveloperQueries, ...semanticNoiseQueries, ...contestedIntentQueries, ...outOfScopeNegatives, ...softballNearMissQueries];
  for (let i = 0; i < allTests.length; i++) {
    console.log(
      '│  %-55s | %-16s | %-16s | %-16s',
      `"${allTests[i].length > 50 ? allTests[i].substring(0, 47) + '...' : allTests[i]}"`,
      statsA.selectionList[i],
      statsB.selectionList[i],
      statsC.selectionList[i]
    );
  }
  console.log('│');
}

async function main() {
  console.log('🚀 Starting Compendious Empirical Prompt-Triggering Evaluation');
  await runEmbeddingSimilarityTest();
  await runHighLoadToolSelectionRoutingTest();
  console.log('\n🏁 Validation Suite Finished.\n');
}

main().catch(console.error);
