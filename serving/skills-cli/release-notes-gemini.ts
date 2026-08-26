import { parseMarkdownBullets } from './release-notes-markdown.ts';

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Shared transport helper to invoke Gemini for markdown bullets with runtime validation and retries.
 */
async function callGeminiForBullets(opts: {
  prompt: string;
  apiKey: string;
  model: string;
  validate: (bullets: string[]) => boolean;
  validationErrorMsg?: (count: number) => string;
  expectedItems?: string[];
  maxRetries?: number;
}): Promise<string[] | null> {
  const { prompt, apiKey, model, validate, validationErrorMsg, expectedItems, maxRetries = 2 } = opts;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(
          `Gemini API error (${response.status}) on attempt ${attempt}/${maxRetries + 1}: ${errorText}`
        );
        if (attempt <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return null;
      }

      const data = (await response.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) {
        console.warn(`Empty response from Gemini API on attempt ${attempt}/${maxRetries + 1}.`);
        if (attempt <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return null;
      }

      const cleanedText = text
        .replace(/^```(?:markdown|md)?\r?\n/, '')
        .replace(/\r?\n```$/, '')
        .trim();

      const bullets = parseMarkdownBullets(cleanedText);

      if (!validate(bullets)) {
        const msg = validationErrorMsg
          ? validationErrorMsg(bullets.length)
          : `Gemini bullet validation failed with ${bullets.length} bullets.`;
        console.warn(`⚠️ ${msg} (Attempt ${attempt}/${maxRetries + 1})`);
        if (expectedItems && expectedItems.length > 0) {
          console.warn(`Expected items (${expectedItems.length}):\n${expectedItems.map(item => `  - ${item}`).join('\n')}`);
        }
        if (bullets.length > 0) {
          console.warn(`Received bullets (${bullets.length}):\n${bullets.map(b => `  ${b}`).join('\n')}`);
        } else if (cleanedText) {
          console.warn(`Raw response:\n${cleanedText}`);
        }
        if (attempt <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return null;
      }

      return bullets;
    } catch (err) {
      console.warn(
        `Error generating summaries with Gemini on attempt ${attempt}/${maxRetries + 1}:`,
        err
      );
      if (attempt <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Uses Gemini to generate bullet summaries for newly added guides.
 */
export async function generateNewGuideSummariesWithGemini(opts: {
  guideDiff: string;
  guideNames: string[];
  apiKey: string;
  model: string;
}): Promise<string[] | null> {
  const { guideDiff, guideNames, apiKey, model } = opts;
  if (!guideDiff.trim() || guideNames.length === 0) {
    return [];
  }

  const prompt = `You are writing concise release note bullet points for newly introduced guides in GoogleChrome/modern-web-guidance.

### New Guides to Summarize (${guideNames.length} total):
${guideNames.map(g => `- ${g}`).join('\n')}

### Content / Diff:
${guideDiff}

### Core Formatting Rules:
1. Output exactly ${guideNames.length} Markdown bullet points (starting with '* ' or '- '), one for each new guide listed above.
2. Each bullet must describe what the new guide introduces and what use case or problem it solves in a single concise sentence or short paragraph.
3. Keep each bullet point on a single line without manual line breaks.
4. Bold the title or subject of the guide in each bullet (e.g., "* Introduced a new guide for **State-Aware Sticky Headers** detailing how to build UI headers that react to scroll changes.").
5. NEVER use nested sub-bullets or multiple bullet points for a single guide.
6. Do NOT mention Baseline status or browser compatibility updates (these are tracked separately in the Browser Support section). Focus on substantive developer guidance and use cases.
7. Do NOT include headings, sections, benchmark tables, code blocks, or preamble. Output ONLY the ${guideNames.length} bullet points.`;

  return callGeminiForBullets({
    prompt,
    apiKey,
    model,
    expectedItems: guideNames,
    validate: (bullets) => bullets.length === guideNames.length,
    validationErrorMsg: (count) =>
      `Gemini new guide summary validation failed: expected ${guideNames.length} bullets, received ${count}.`,
  });
}

/**
 * Uses Gemini to generate bullet summaries for updated / modified guides.
 */
export async function generateUpdatedGuideSummariesWithGemini(opts: {
  guideDiff: string;
  guideNames: string[];
  apiKey: string;
  model: string;
}): Promise<string[] | null> {
  const { guideDiff, guideNames, apiKey, model } = opts;
  if (!guideDiff.trim() || guideNames.length === 0) {
    return [];
  }

  const prompt = `You are writing concise release note bullet points for updated guidance in GoogleChrome/modern-web-guidance.

### Updated Guides to Summarize (${guideNames.length} total):
${guideNames.map(g => `- ${g}`).join('\n')}

### Content Diff:
${guideDiff}

### Core Formatting Rules:
1. Output exactly ${guideNames.length} Markdown bullet points (starting with '* ' or '- '), one for each updated guide listed above.
2. Each bullet must describe key improvements, best practices, or platform evolutions added to the guide in a single concise sentence or short paragraph.
3. Keep each bullet point on a single line without manual line breaks.
4. Bold the title or subject of the guide in each bullet (e.g., "* Updated the **Prompt API** guide to include best practices for session cloning and model pre-warming.").
5. NEVER use nested sub-bullets or multiple bullet points for a single guide.
6. Do NOT mention Baseline status or browser compatibility updates (these are tracked separately in the Browser Support section). Focus on substantive developer guidance and API patterns.
7. Do NOT include headings, sections, benchmark tables, code blocks, or preamble. Output ONLY the ${guideNames.length} bullet points.`;

  return callGeminiForBullets({
    prompt,
    apiKey,
    model,
    expectedItems: guideNames,
    validate: (bullets) => bullets.length === guideNames.length,
    validationErrorMsg: (count) =>
      `Gemini updated guide summary validation failed: expected ${guideNames.length} bullets, received ${count}.`,
  });
}

/**
 * Uses Gemini to generate bullet summaries for changed guides.
 */
export async function generateGuideSummariesWithGemini(opts: {
  guideDiff: string;
  guideNames?: string[];
  expectedGuideCount: number;
  apiKey: string;
  model: string;
}): Promise<string[] | null> {
  const { guideDiff, guideNames = [], expectedGuideCount, apiKey, model } = opts;
  if (!guideDiff.trim() || expectedGuideCount === 0) {
    return [];
  }

  const guidesListSection =
    guideNames.length > 0
      ? `\n### Changed Guides to Summarize (${expectedGuideCount} total):\n${guideNames.map(g => `- ${g}`).join('\n')}\n`
      : '';

  const prompt = `You are writing concise release note bullet points for guidance changes in GoogleChrome/modern-web-guidance.
${guidesListSection}
### Consumer-facing Guide Changes / Diff:
${guideDiff}

### Core Formatting Rules:
1. Output exactly ${expectedGuideCount} Markdown bullet points (starting with '* ' or '- ')${guideNames.length > 0 ? ', one for each changed guide listed above' : ''}.
2. Each bullet must describe one modified or new guide in a single concise sentence or short paragraph explaining the use case or key platform evolution.
3. Keep each bullet point on a single line without manual line breaks.
4. Bold the title or subject of the guide in each bullet (e.g., "* Updated the **Dynamic Sibling Styling** guide to ...").
5. NEVER use nested sub-bullets or multiple bullet points for a single guide.
6. Do NOT mention Baseline status or browser compatibility updates (these are tracked separately in the Browser Support section).
7. Do NOT include headings, sections, benchmark tables, code blocks, or preamble. Output ONLY the ${expectedGuideCount} bullet points.`;

  return callGeminiForBullets({
    prompt,
    apiKey,
    model,
    expectedItems: guideNames,
    validate: (bullets) => bullets.length === expectedGuideCount,
    validationErrorMsg: (count) =>
      `Gemini guide summary validation failed: expected ${expectedGuideCount} bullets, received ${count}.`,
  });
}

/**
 * Uses Gemini to generate bullet summaries for agent ecosystem / plugin changes.
 */
export async function generateEcosystemSummariesWithGemini(opts: {
  pluginDiff: string;
  pluginFiles: string[];
  apiKey: string;
  model: string;
}): Promise<string[] | null> {
  const { pluginDiff, pluginFiles, apiKey, model } = opts;
  if (!pluginDiff.trim() || pluginFiles.length === 0) {
    return [];
  }

  const prompt = `You are writing concise release note bullet points for agent ecosystem and plugin marketplace changes in GoogleChrome/modern-web-guidance.

### Changed Plugin Files:
${pluginFiles.map(p => `- ${p}`).join('\n')}

### Agent Plugin Diff / Changes:
${pluginDiff}

### Core Formatting Rules:
1. Output concise Markdown bullet points (starting with '* ' or '- ') describing what was added or updated across the affected agent platforms, IDEs, or marketplaces.
2. Bold the name of each agent platform, IDE, or marketplace (e.g., "* Added support for the **Grok** plugin marketplace.").
3. Output at least 1 and at most ${pluginFiles.length} bullet points.
4. Do NOT mention rote version bumps.
5. Keep each bullet point on a single line without manual line breaks.
6. Do NOT include headings, sections, or preamble. Output ONLY the bullet points.`;

  return callGeminiForBullets({
    prompt,
    apiKey,
    model,
    expectedItems: pluginFiles,
    validate: (bullets) => bullets.length > 0 && bullets.length <= pluginFiles.length,
    validationErrorMsg: (count) =>
      `Gemini ecosystem summary validation failed: received ${count} bullets for ${pluginFiles.length} plugin files.`,
  });
}
