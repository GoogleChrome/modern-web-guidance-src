import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GUIDE_TRIAGE_MODEL,
  GUIDE_TRIAGE_PROMPT_VERSION,
  GUIDE_TRIAGE_RESPONSE_SCHEMA,
  GUIDE_TRIAGE_SYSTEM_PROMPT,
  buildGuideTriageRequestBody,
  loadExplainerContextMap,
  parseGuideTriageResponse,
  triageGuide,
} from './guide-triage.ts';

void test('guide-triage: request body construction', async (t) => {
  const sampleGuide = {
    guideId: 'temporal-now',
    category: 'javascript',
    guideHash: '1234567890ab',
    markdownContent: '# Temporal Guide',
  };

  await t.test('creates temperature 0 request with schema and default search grounding', () => {
    const body = buildGuideTriageRequestBody(sampleGuide) as {
      systemInstruction: { parts: [{ text: string }] };
      generationConfig: {
        temperature: number;
        thinkingConfig: { thinkingBudget: number };
        responseMimeType: string;
        responseSchema: typeof GUIDE_TRIAGE_RESPONSE_SCHEMA;
      };
      tools?: Array<{ googleSearch: Record<string, unknown> }>;
    };

    assert.equal(body.systemInstruction.parts[0]?.text, GUIDE_TRIAGE_SYSTEM_PROMPT);
    assert.equal(body.generationConfig.temperature, 0);
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 2048);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseSchema, GUIDE_TRIAGE_RESPONSE_SCHEMA);
    assert.deepEqual(body.tools, [{ googleSearch: {} }]);
  });

  await t.test('omits tools when enableSearchGrounding is false', () => {
    const body = buildGuideTriageRequestBody(sampleGuide, { enableSearchGrounding: false }) as {
      tools?: unknown;
    };
    assert.equal(body.tools, undefined);
  });
});

void test('guide-triage: parseGuideTriageResponse validation', async (t) => {
  await t.test('parses valid Guide Triage JSON', () => {
    const raw = JSON.stringify({
      classification: 'detectable',
      candidateTechniques: ['moment-timezone', 'date-fns-tz'],
      replaces: ['moment-timezone', 'date-fns-tz'],
      doesNotReplace: ['luxon datetime formatting'],
      borderline: false,
      brownfieldTarget: 'moment-timezone / date-fns-tz library usage',
      evidenceFromGuide: 'Before: const date = moment.tz(str, "America/New_York");',
      reason: 'Replaces legacy timezone libraries with native Temporal API.',
    });

    assert.deepEqual(parseGuideTriageResponse(raw, 'temporal-now'), {
      classification: 'detectable',
      candidateTechniques: ['moment-timezone', 'date-fns-tz'],
      replaces: ['moment-timezone', 'date-fns-tz'],
      doesNotReplace: ['luxon datetime formatting'],
      borderline: false,
      brownfieldTarget: 'moment-timezone / date-fns-tz library usage',
      evidenceFromGuide: 'Before: const date = moment.tz(str, "America/New_York");',
      reason: 'Replaces legacy timezone libraries with native Temporal API.',
    });
  });

  await t.test('throws on malformed JSON, invalid classification, or missing required fields', () => {
    assert.throws(
      () => parseGuideTriageResponse('{ invalid json', 'test-guide'),
      /Guide Triage response JSON parse error for guide test-guide/,
    );
    assert.throws(
      () =>
        parseGuideTriageResponse(
          JSON.stringify({
            classification: 'invalid-bucket',
            brownfieldTarget: 'something',
            evidenceFromGuide: 'some evidence',
            reason: 'some reason',
          }),
          'test-guide',
        ),
      /Guide Triage response invalid classification 'invalid-bucket' for guide test-guide/,
    );
    assert.throws(
      () =>
        parseGuideTriageResponse(
          JSON.stringify({
            classification: 'detectable',
            candidateTechniques: ['technique'],
            borderline: false,
            brownfieldTarget: '',
            evidenceFromGuide: 'evidence',
            reason: 'reason',
          }),
          'test-guide',
        ),
      /Guide Triage response missing string 'brownfieldTarget' for guide test-guide/,
    );
  });
});

void test('guide-triage: triageGuide with mock fetch', async (t) => {
  await t.test('classifies a guide end-to-end with grounding sources and evidenceSource', async () => {
    let capturedUrl = '';
    let capturedBody = '';

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedBody = String(init?.body);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      classification: 'detectable',
                      candidateTechniques: ['manual wheel listeners'],
                      borderline: false,
                      brownfieldTarget: 'manual wheel event listeners',
                      evidenceFromGuide: 'Replaces window.addEventListener("wheel", ...)',
                      reason: 'Concrete legacy scroll listener replaced by scrollend.',
                      evidenceSource: 'explainer',
                    }),
                  },
                ],
              },
              groundingMetadata: {
                webSearchQueries: ['legacy scrollend replacement'],
                groundingChunks: [
                  { web: { uri: 'https://chromestatus.com/feature/5195248554278912', title: 'scrollend' } },
                  { web: { uri: 'https://github.com/w3c/csswg-drafts/issues/1234' } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const entry = await triageGuide(
      {
        guideId: 'scrollend-event',
        category: 'javascript',
        guideHash: 'abcdef123456',
        markdownContent: '# Scrollend\nReplaces debounce wheel listeners.',
        explainerContext: 'CSSWG scrollend explainer: developers used debounce wheel listeners.',
      },
      { apiKey: 'test-api-key', fetchFn: mockFetch, maxRetries: 1 },
    );

    assert.ok(capturedUrl.includes(`models/${GUIDE_TRIAGE_MODEL}:generateContent?key=test-api-key`));
    assert.ok(capturedBody.includes('scrollend-event'));
    assert.ok(capturedBody.includes('CSSWG scrollend explainer'));
    assert.equal(entry.guideId, 'scrollend-event');
    assert.equal(entry.guideHash, 'abcdef123456');
    assert.equal(entry.classification, 'detectable');
    assert.equal(entry.brownfieldTarget, 'manual wheel event listeners');
    assert.equal(entry.evidenceFromGuide, 'Replaces window.addEventListener("wheel", ...)');
    assert.equal(entry.gate0PromptVersion, GUIDE_TRIAGE_PROMPT_VERSION);
    assert.equal(entry.evidenceSource, 'explainer');
    assert.ok(entry.explainerContextHash);
    assert.deepEqual(entry.webSearchQueries, ['legacy scrollend replacement']);
    assert.deepEqual(entry.groundingSources, [
      'https://chromestatus.com/feature/5195248554278912',
      'https://github.com/w3c/csswg-drafts/issues/1234',
    ]);
  });

  await t.test('retries on 429 and fails loudly when API error persists', async () => {
    let callCount = 0;
    const retryFetch: typeof fetch = async () => {
      callCount++;
      if (callCount === 1) return new Response('Rate limited', { status: 429 });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      classification: 'skip-no-old-way',
                      candidateTechniques: [],
                      borderline: false,
                      brownfieldTarget: 'none (greenfield capability)',
                      evidenceFromGuide: 'No previous browser API existed for WebGPU shaders.',
                      reason: 'Net-new hardware capability without brownfield workaround.',
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

    const entry = await triageGuide(
      { guideId: 'webgpu-compute', category: 'graphics', guideHash: '112233445566', markdownContent: '# WebGPU Compute' },
      { apiKey: 'test-api-key', fetchFn: retryFetch, maxRetries: 2 },
    );
    assert.equal(callCount, 2);
    assert.equal(entry.classification, 'skip-no-old-way');

    await assert.rejects(
      () =>
        triageGuide(
          { guideId: 'failing-guide', category: 'css', guideHash: 'aabbccddeeff', markdownContent: '# Failing Guide' },
          { apiKey: 'test-api-key', fetchFn: async () => new Response('Bad Gateway', { status: 502 }), maxRetries: 1 },
        ),
      /Guide Triage failed for failing-guide with HTTP 502/,
    );
  });
});

void test('guide-triage: loadExplainerContextMap fail fast', async (t) => {
  await t.test('fails fast when ANALYZER_EVAL_DATA_DIR is unset or file is missing', async () => {
    const orig = process.env.ANALYZER_EVAL_DATA_DIR;
    delete process.env.ANALYZER_EVAL_DATA_DIR;
    try {
      await assert.rejects(
        () => loadExplainerContextMap(),
        /ANALYZER_EVAL_DATA_DIR environment variable is not set/,
      );
    } finally {
      if (orig) process.env.ANALYZER_EVAL_DATA_DIR = orig;
    }

    await assert.rejects(
      () => loadExplainerContextMap('nonexistent-explainers-file-12345.json'),
      { code: 'ENOENT' },
    );
  });
});
