import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';
import {
  GEMINI_API_BASE,
  LLM_VERIFIER_MODEL,
  buildGenerateContentUrl,
  buildVerifierRequestBody,
  formatVerifierPrompt,
  getGeminiApiKey,
  parseVerifierResponse,
  resolveGeminiApiBase,
  runLlmVerifier,
  type VerifierOptions,
} from './llm-verifier.ts';

const mockRule: AnalyzerRule = {
  id: 'test-rule',
  guideId: 'animate-element-entry-exit',
  guideHash: '1234567890ab',
  summary: 'Detects old-pattern widgets and suggests modern HTML equivalents.',
  matcher: {
    kind: 'js',
    fastTokens: ['fadeIn'],
    matchFile: () => [],
  },
  verifierRubric: {
    keepWhen: [
      'Imperative widget manipulation on standard DOM nodes.',
      'Custom event listeners used to simulate declarative behaviors.',
    ],
    dropWhen: [
      'Canvas, WebGL, or non-DOM drawing contexts.',
      'Code already guarded by modern feature checks.',
    ],
  },
};

const mockFindings: AnalyzerFinding[] = [
  {
    cardId: 'card-1',
    ruleId: 'test-rule',
    guideId: 'animate-element-entry-exit',
    guideHash: '1234567890ab',
    repo: 'test-repo',
    commit: 'c0ffee1',
    file: 'src/components/modal.js',
    line: 42,
    message: 'Legacy imperative modal handling',
    codeSnippet: '42 | $(modal).fadeIn();',
    contextSlice: '40 | function showModal(modal) {\n41 |   // show it\n42 |   $(modal).fadeIn();\n43 | }',
  },
  {
    cardId: 'card-2',
    ruleId: 'test-rule',
    guideId: 'animate-element-entry-exit',
    guideHash: '1234567890ab',
    repo: 'test-repo',
    commit: 'c0ffee1',
    file: 'src/graphics/engine.js',
    line: 88,
    message: 'Canvas camera fade',
    codeSnippet: '88 | camera.fadeIn();',
    contextSlice: '87 | function renderScene(camera) {\n88 |   camera.fadeIn();\n89 | }',
  },
];

describe('LLM verifier', () => {
  test('exports canonical verifier configuration', () => {
    assert.equal(LLM_VERIFIER_MODEL, 'gemini-3.8-flash');
    assert.ok(typeof buildVerifierRequestBody === 'function');
    assert.ok(typeof parseVerifierResponse === 'function');
  });

  test('formats prompt with rule summary, rubrics, and AST slice', () => {
    const prompt = formatVerifierPrompt(mockFindings[0], mockRule, '# Test Guide Markdown');
    assert.match(prompt, /Rule: test-rule/);
    assert.match(prompt, /Summary: Detects old-pattern/);
    assert.match(prompt, /Keep When:/);
    assert.match(prompt, /Imperative widget manipulation/);
    assert.match(prompt, /Drop When:/);
    assert.match(prompt, /Canvas, WebGL/);
    assert.match(prompt, /src\/components\/modal\.js/);
    assert.match(prompt, /\$\(modal\)\.fadeIn\(\);/);
  });

  test('builds Gemini request body with temperature 0 and thinkingBudget 1024', () => {
    const body = buildVerifierRequestBody(
      mockFindings[0],
      mockRule,
      '# Test Guide Markdown',
    ) as {
      generationConfig: {
        temperature: number;
        thinkingConfig: { thinkingBudget: number };
        responseMimeType: string;
      };
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    assert.equal(body.generationConfig.temperature, 0.0);
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 1024);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.match(body.contents[0].parts[0].text, /Test Guide Markdown/);
  });

  test('parseVerifierResponse parses valid JSON and throws on malformed output', () => {
    const validJson = JSON.stringify({
      keep: true,
      reason: 'Standard DOM jQuery visibility manipulation',
      confidence: 'high',
    });
    const parsed = parseVerifierResponse(validJson, 'card-1');
    assert.equal(parsed.cardId, 'card-1');
    assert.equal(parsed.keep, true);
    assert.equal(parsed.confidence, 'high');

    // Throws on missing fields (fail fast)
    assert.throws(() => parseVerifierResponse('not json', 'card-1'), /JSON parse error/);
    assert.throws(
      () => parseVerifierResponse(JSON.stringify({ reason: 'no keep' }), 'card-1'),
      /missing boolean 'keep'/,
    );
    assert.throws(
      () => parseVerifierResponse(JSON.stringify({ keep: true }), 'card-1'),
      /missing string 'reason'/,
    );
    assert.throws(
      () =>
        parseVerifierResponse(
          JSON.stringify({ keep: true, reason: 'ok', confidence: 'invalid' }),
          'card-1',
        ),
      /invalid confidence/,
    );
  });

  test('runLlmVerifier returns kept findings and verdicts via mock fetch', async () => {
    const rulesById = new Map<string, AnalyzerRule>([['test-rule', mockRule]]);

    const mockFetch: typeof fetch = async (_url, options) => {
      const body = JSON.parse(options?.body as string) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
      };
      const promptText = body.contents[0].parts[0].text;

      let keep = false;
      let reason = 'Non-DOM context';
      if (promptText.includes('modal.js')) {
        keep = true;
        reason = 'Genuine DOM jQuery animation';
      }

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      keep,
                      reason,
                      confidence: 'high',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const options: VerifierOptions = {
      apiKey: 'test-key',
      fetchFn: mockFetch,
      concurrency: 2,
    };

    const result = await runLlmVerifier(mockFindings, rulesById, options);
    assert.equal(result.verdicts.length, 2);
    assert.equal(result.results.length, 2);
    assert.equal(result.verdicts[0].keep, true);
    assert.equal(result.verdicts[1].keep, false);
    assert.equal(result.keptFindings.length, 1);
    assert.equal(result.keptFindings[0].cardId, 'card-1');
  });

  test('runLlmVerifier handles empty findings array without network requests', async () => {
    let called = false;
    const mockFetch: typeof fetch = async () => {
      called = true;
      return new Response('', { status: 200 });
    };

    const result = await runLlmVerifier([], new Map(), {
      apiKey: 'test-key',
      fetchFn: mockFetch,
    });
    assert.equal(called, false);
    assert.equal(result.verdicts.length, 0);
    assert.equal(result.keptFindings.length, 0);
  });

  test('runLlmVerifier retries on transient 429 and succeeds', async () => {
    const rulesById = new Map<string, AnalyzerRule>([['test-rule', mockRule]]);
    let attempts = 0;

    const mockFetch: typeof fetch = async () => {
      attempts++;
      if (attempts === 1) {
        return new Response('Rate limited', { status: 429 });
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      keep: true,
                      reason: 'Recovered after retry',
                      confidence: 'high',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    };

    const result = await runLlmVerifier([mockFindings[0]], rulesById, {
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 2,
    });
    assert.equal(attempts, 2);
    assert.equal(result.verdicts[0].keep, true);
    assert.equal(result.keptFindings.length, 1);
  });

  test('runLlmVerifier fails fast and throws when error persists', async () => {
    const rulesById = new Map<string, AnalyzerRule>([['test-rule', mockRule]]);

    const mockFetch: typeof fetch = async () => {
      return new Response('Internal Server Error', { status: 500 });
    };

    await assert.rejects(
      async () => {
        await runLlmVerifier([mockFindings[0]], rulesById, {
          apiKey: 'test-key',
          fetchFn: mockFetch,
          maxRetries: 1,
        });
      },
      /Gemini generateContent failed for card card-1 with HTTP 500/,
    );
  });

  test('runLlmVerifier throws explicit error if rule is not found', async () => {
    await assert.rejects(
      async () => {
        await runLlmVerifier([mockFindings[0]], new Map(), { apiKey: 'test-key' });
      },
      /Rule not found for finding with ruleId='test-rule'/,
    );
  });

  test('resolveGeminiApiBase and buildGenerateContentUrl support custom proxy base URLs without API keys', async () => {
    const origBase = process.env.GEMINI_API_BASE;
    const origGoogleBase = process.env.GOOGLE_GEMINI_BASE_URL;
    const origKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_BASE;
      delete process.env.GOOGLE_GEMINI_BASE_URL;
      delete process.env.GEMINI_API_KEY;

      assert.equal(resolveGeminiApiBase(), GEMINI_API_BASE);
      assert.equal(
        buildGenerateContentUrl('gemini-3.8-flash', { apiKey: 'abc' }),
        `${GEMINI_API_BASE}/models/gemini-3.8-flash:generateContent?key=abc`,
      );

      // GOOGLE_GEMINI_BASE_URL without /v1beta gets /v1beta appended and omits ?key= when no key is set
      process.env.GOOGLE_GEMINI_BASE_URL = 'http://127.0.0.1:41234/';
      assert.equal(resolveGeminiApiBase(), 'http://127.0.0.1:41234/v1beta');
      assert.equal(getGeminiApiKey(), '');
      assert.equal(
        buildGenerateContentUrl('gemini-3.8-flash'),
        'http://127.0.0.1:41234/v1beta/models/gemini-3.8-flash:generateContent',
      );

      // GEMINI_API_BASE with explicit /v1beta is preserved without duplicating /v1beta
      process.env.GEMINI_API_BASE = 'http://localhost:8000/v1beta';
      assert.equal(resolveGeminiApiBase(), 'http://localhost:8000/v1beta');

      // Invalid URL protocols fail fast
      assert.throws(
        () => resolveGeminiApiBase({ baseUrl: 'ftp://localhost:8000' }),
        /Invalid Gemini API base URL protocol/,
      );

      // runLlmVerifier works against a custom baseUrl without requiring GEMINI_API_KEY
      delete process.env.GEMINI_API_BASE;
      delete process.env.GOOGLE_GEMINI_BASE_URL;
      const rulesById = new Map<string, AnalyzerRule>([['test-rule', mockRule]]);
      let requestedUrl = '';
      const result = await runLlmVerifier([mockFindings[0]], rulesById, {
        baseUrl: 'http://127.0.0.1:41234',
        fetchFn: async (input) => {
          requestedUrl = String(input);
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          keep: true,
                          reason: 'Proxy verified',
                          confidence: 'high',
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200 },
          );
        },
      });
      assert.equal(
        requestedUrl,
        'http://127.0.0.1:41234/v1beta/models/gemini-3.8-flash:generateContent',
      );
      assert.equal(result.keptFindings.length, 1);
    } finally {
      if (origBase === undefined) delete process.env.GEMINI_API_BASE;
      else process.env.GEMINI_API_BASE = origBase;
      if (origGoogleBase === undefined) delete process.env.GOOGLE_GEMINI_BASE_URL;
      else process.env.GOOGLE_GEMINI_BASE_URL = origGoogleBase;
      if (origKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = origKey;
    }
  });
});
