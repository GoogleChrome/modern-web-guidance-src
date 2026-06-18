import fs from 'fs';
import path from 'path';
import { scanAllGuides, scanDisciplineSkills } from '../lib/guide-validation.ts';
import { cRed, cGreen, cCyan, cBold, cDim } from '../lib/colors.ts';
import { google } from '@ai-sdk/google';
import { generateText, stepCountIs, hasToolCall } from 'ai';
import { chromium } from 'playwright';

// Map workspace API key for Vercel AI SDK Google provider compatibility
process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

function createSchema(schema: any) {
  return {
    [Symbol.for('vercel.ai.schema')]: true,
    jsonSchema: schema,
    validate: (value: any) => ({ success: true, value })
  };
}

export interface AuditOptions {
  guide?: string;
  json?: boolean;
  verbose?: boolean;
}

interface AuditResult {
  guide: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'N/A';
  errors: string[];
}

async function parallelLimit<T>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) {
        await fn(item);
      }
    }
  });
  await Promise.all(workers);
}

export async function runWebsiteAudit(targetUrl: string, options: AuditOptions = {}): Promise<void> {
  console.log(`\n${cBold(cCyan('⚡ Modern Web Guidance Website Auditor (Agentic)'))}`);
  console.log(`${cDim('Target URL:')} ${cBold(targetUrl)}`);
  if (options.guide) {
    console.log(`${cDim('Target Guide:')} ${options.guide}`);
  }
  console.log('--------------------------------------------------\n');

  // Discover guides
  const allItems = [...scanAllGuides(), ...scanDisciplineSkills()];
  let targets = allItems.filter(item => item.hasGrader);

  if (options.guide) {
    const guideName = options.guide;
    const matching = targets.filter(t => 
      t.name === guideName || 
      `${t.category}/${t.name}` === guideName ||
      t.dir.endsWith(guideName)
    );
    if (matching.length === 0) {
      console.error(cRed(`Error: Guide "${guideName}" not found.`));
      process.exit(1);
    }
    targets = matching;
  }

  const browser = await chromium.launch({ headless: true });
  console.log(`Launching LLM Auditor (gemini-3.5-flash) against ${targetUrl}...`);

  const results: AuditResult[] = [];

  const runTargetAudit = async (target: any) => {
    if (options.verbose) {
      console.log(`\nAuditing: ${target.category}/${target.name}...`);
    }

    const guideMdPath = path.join(target.dir, 'guide.md');
    let guideContent = '';
    if (fs.existsSync(guideMdPath)) {
      guideContent = fs.readFileSync(guideMdPath, 'utf-8');
    } else {
      console.warn(`Warning: No guide.md found for ${target.name}. Skipping.`);
      return;
    }

    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(targetUrl);
      await page.waitForLoadState('networkidle');

      const response = await generateText({
        model: google('gemini-3.5-flash'),
        system: `You are an expert modern web developer auditing a live website for compliance with a modern web platform best practices guide.
Your goal is to inspect, interact with, and verify if the website implements the best practices described in the guide.
You are equipped with tools to navigate, click, fill inputs, and evaluate arbitrary JS code inside the browser.

Be thorough. If the site does not implement the feature or component at all, report "N/A" (Not Applicable).
If the site implements the feature but violates the guidelines (e.g. bad fallbacks, incorrect CSS classes/attributes, bad behavior), report "FAIL" with reasons.
If it complies with the guidelines, report "PASS".`,
        prompt: `Audit the website at ${targetUrl} against the following guide:

--- GUIDE ---
${guideContent}
--- END GUIDE ---

Browse the page, interact with it, evaluate JS, and check compliance. Focus on:
1. Requirements & Core Implementation
2. Accessibility
3. Fallback Strategies (e.g. check how the page behaves when APIs are missing by evaluating JS to remove the APIs and reloading, or by clicking any fallback toggle elements on the page).

IMPORTANT: Once you have checked all relevant aspects, immediately call the returnResult tool to report your final verdict (PASS, FAIL, or N/A) and reasons. Do not loop infinitely or repeat the same tests after obtaining the results.`,
        tools: {
          navigate: {
            description: 'Navigate the browser to a URL',
            inputSchema: createSchema({
              type: 'object',
              properties: {
                url: { type: 'string', description: 'The absolute URL to navigate to' }
              },
              required: ['url']
            }),
            execute: async ({ url }: { url: string }) => {
              try {
                if (!url) throw new Error('url parameter is required');
                await page.goto(url);
                await page.waitForLoadState('networkidle');
                return { success: true, currentUrl: page.url() };
              } catch (e: any) {
                return { success: false, error: e.message };
              }
            }
          },
          getDOMState: {
            description: 'Get the current HTML content of the page',
            inputSchema: createSchema({
              type: 'object',
              properties: {}
            }),
            execute: async () => {
              try {
                const content = await page.content();
                return { content: content.substring(0, 50000) };
              } catch (e: any) {
                return { success: false, error: e.message };
              }
            }
          },
          click: {
            description: 'Click an element matching the CSS selector',
            inputSchema: createSchema({
              type: 'object',
              properties: {
                selector: { type: 'string', description: 'CSS selector of the element to click' }
              },
              required: ['selector']
            }),
            execute: async ({ selector }: { selector: string }) => {
              try {
                await page.click(selector, { timeout: 3000 });
                return { success: true };
              } catch (e: any) {
                return { success: false, error: e.message };
              }
            }
          },
          fill: {
            description: 'Fill a text input matching the CSS selector',
            inputSchema: createSchema({
              type: 'object',
              properties: {
                selector: { type: 'string', description: 'CSS selector of the input element' },
                value: { type: 'string', description: 'The text value to enter' }
              },
              required: ['selector', 'value']
            }),
            execute: async ({ selector, value }: { selector: string; value: string }) => {
              try {
                await page.fill(selector, value, { timeout: 3000 });
                return { success: true };
              } catch (e: any) {
                return { success: false, error: e.message };
              }
            }
          },
          evaluateJS: {
            description: 'Evaluate arbitrary JavaScript code inside the browser page context',
            inputSchema: createSchema({
              type: 'object',
              properties: {
                code: { type: 'string', description: 'The JS code string to evaluate' }
              },
              required: ['code']
            }),
            execute: async ({ code }: { code: string }) => {
              try {
                const result = await page.evaluate(code);
                return { success: true, result };
              } catch (e: any) {
                return { success: false, error: e.message };
              }
            }
          },
          waitForTimeout: {
            description: 'Wait for a specified number of milliseconds',
            inputSchema: createSchema({
              type: 'object',
              properties: {
                ms: { type: 'number', description: 'Milliseconds to wait' }
              },
              required: ['ms']
            }),
            execute: async ({ ms }: { ms: number }) => {
              try {
                await page.waitForTimeout(ms);
                return { success: true };
              } catch (e: any) {
                return { success: false, error: e.message };
              }
            }
          },
          returnResult: {
            description: 'Report the final audit verdict for the guide',
            inputSchema: createSchema({
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['PASS', 'FAIL', 'N/A'], description: 'The audit status' },
                reasons: { type: 'array', items: { type: 'string' }, description: 'Detailed reasons or list of violations if FAIL' }
              },
              required: ['status', 'reasons']
            }),
            execute: async ({ status, reasons }: { status: 'PASS' | 'FAIL' | 'N/A'; reasons: string[] }) => {
              return { status, reasons };
            }
          }
        } as any,
        stopWhen: [stepCountIs(40), hasToolCall('returnResult')]
      } as any);

      if (options.verbose) {
        console.log('\n[DEBUG] Steps taken by the agent:');
        console.log(JSON.stringify(response.steps, null, 2));
      }

      // Search for returnResult tool call across all steps
      let resultCall: any = null;
      for (const step of response.steps) {
        const found = step.toolCalls?.find((tc: any) => tc.toolName === 'returnResult');
        if (found) {
          resultCall = found;
          break;
        }
      }

      if (resultCall) {
        if (options.verbose) {
          console.log('[DEBUG] resultCall object:', JSON.stringify(resultCall, null, 2));
        }
        const args = resultCall.args || resultCall.input || {};
        const { status, reasons } = args;
        results.push({
          guide: target.name,
          category: target.category || 'General',
          status: status as 'PASS' | 'FAIL' | 'N/A',
          errors: reasons || []
        });
      } else {
        results.push({
          guide: target.name,
          category: target.category || 'General',
          status: 'FAIL',
          errors: ['Agent did not conclude inspection']
        });
      }
    } catch (err: any) {
      results.push({
        guide: target.name,
        category: target.category || 'General',
        status: 'FAIL',
        errors: [`Agent execution failed: ${err.message}`]
      });
    } finally {
      await context.close();
    }
  };

  // Run audits concurrently with concurrency limit of 5
  await parallelLimit(5, targets, runTargetAudit);
  await browser.close();

  // Aggregate stats
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const na = results.filter(r => r.status === 'N/A').length;
  const applicable = passed + failed;
  const score = applicable > 0 ? Math.round((passed / applicable) * 100) : 100;

  // Print results
  if (options.json) {
    const report = {
      targetUrl,
      timestamp: new Date().toISOString(),
      score,
      stats: { passed, failed, na },
      results: results.map(r => ({
        guide: `${r.category}/${r.guide}`,
        status: r.status,
        errors: r.errors
      }))
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Group results by category
    const byCategory: Record<string, AuditResult[]> = {};
    for (const res of results) {
      if (!byCategory[res.category]) {
        byCategory[res.category] = [];
      }
      byCategory[res.category].push(res);
    }

    for (const [cat, catResults] of Object.entries(byCategory)) {
      const catPassed = catResults.filter(r => r.status === 'PASS').length;
      const catFailed = catResults.filter(r => r.status === 'FAIL').length;
      const catApplicable = catPassed + catFailed;
      const catScore = catApplicable > 0 ? Math.round((catPassed / catApplicable) * 100) : null;
      const scoreStr = catScore !== null ? `[ ${catScore}% ]` : '[ N/A ]';

      console.log(`\n${cBold(cat.toUpperCase().replace('-', ' '))} ${cDim(scoreStr)}`);
      console.log('='.repeat(40));

      for (const res of catResults) {
        if (res.status === 'PASS') {
          console.log(`  ${cGreen('✅')} ${res.guide}`);
        } else if (res.status === 'FAIL') {
          console.log(`  ${cRed('❌')} ${res.guide}`);
          if (options.verbose || targets.length === 1) {
            for (const err of res.errors) {
              console.log(`     ${cDim('-')} ${err}`);
            }
          }
        } else {
          console.log(`  ${cDim('➖')} ${res.guide} ${cDim('(N/A: Not detected)')}`);
        }
      }
    }

    console.log('\n==================================================');
    console.log(`${cBold('Summary:')}`);
    console.log(`  Passed:         ${cGreen(String(passed))}`);
    console.log(`  Failed:         ${cRed(String(failed))}`);
    console.log(`  Not Detected:   ${cDim(String(na))}`);
    console.log(`  Overall Score:  ${cBold(score + '%')} ${cDim('(Passed / Detected Features)')}`);
    console.log('==================================================\n');
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}
