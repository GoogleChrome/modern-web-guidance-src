import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GUIDE_TRIAGE_MODEL,
  GUIDE_TRIAGE_PROMPT_VERSION,
  GUIDE_TRIAGE_RESPONSE_SCHEMA,
  GUIDE_TRIAGE_SYSTEM_PROMPT,
  buildGuideTriageRequestBody,
  formatGuideTriagePrompt,
  parseGuideTriageResponse,
  triageGuide,
} from './guide-triage.ts';

void test('guide-triage: canonical symbol definitions', async (t) => {
  await t.test('exports GUIDE_TRIAGE_MODEL and core functions', () => {
    assert.equal(GUIDE_TRIAGE_MODEL, 'gemini-3.8-flash');
    assert.equal(typeof buildGuideTriageRequestBody, 'function');
    assert.equal(typeof parseGuideTriageResponse, 'function');
    assert.equal(typeof triageGuide, 'function');
  });
});

void test('guide-triage: prompt formatting and request body construction', async (t) => {
  await t.test('formatGuideTriagePrompt includes guideId, category, and full markdown', () => {
    const prompt = formatGuideTriagePrompt({
      guideId: 'temporal-now',
      category: 'javascript',
      guideHash: '1234567890ab',
      markdownContent: '# Temporal Guide\n\nReplaces moment timezone.',
    });

    assert.ok(prompt.includes('## Guide: temporal-now (Category: javascript)'));
    assert.ok(prompt.includes('Replaces moment timezone.'));
  });

  await t.test('formatGuideTriagePrompt appends explainer context when supplied', () => {
    const prompt = formatGuideTriagePrompt({
      guideId: 'temporal-now',
      category: 'javascript',
      guideHash: '1234567890ab',
      markdownContent: '# Temporal Guide',
      explainerContext: 'TC39 proposal motivation: developers currently rely on moment-timezone.',
    });

    assert.ok(prompt.includes('### Upstream W3C / TC39 / ChromeStatus Explainer & Motivation Context:'));
    assert.ok(prompt.includes('developers currently rely on moment-timezone.'));
  });

  await t.test('buildGuideTriageRequestBody creates temperature 0 request with schema and default search grounding', () => {
    const body = buildGuideTriageRequestBody({
      guideId: 'temporal-now',
      category: 'javascript',
      guideHash: '1234567890ab',
      markdownContent: '# Temporal Guide',
    }) as {
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
    assert.ok(body.tools, 'tools array should be defined by default');
    assert.deepEqual(body.tools[0], { googleSearch: {} });
  });

  await t.test('buildGuideTriageRequestBody supports enableSearchGrounding: false to disable', () => {
    const body = buildGuideTriageRequestBody(
      {
        guideId: 'temporal-now',
        category: 'javascript',
        guideHash: '1234567890ab',
        markdownContent: '# Temporal Guide',
      },
      { enableSearchGrounding: false },
    ) as { tools?: Array<{ googleSearch: Record<string, unknown> }> };

    assert.equal(body.tools, undefined, 'tools array should be undefined when grounding disabled');
  });
});

void test('guide-triage: parseGuideTriageResponse validation', async (t) => {
  await t.test('parses valid Guide Triage JSON successfully', () => {
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

    const parsed = parseGuideTriageResponse(raw, 'temporal-now');
    assert.equal(parsed.classification, 'detectable');
    assert.deepEqual(parsed.candidateTechniques, ['moment-timezone', 'date-fns-tz']);
    assert.deepEqual(parsed.replaces, ['moment-timezone', 'date-fns-tz']);
    assert.deepEqual(parsed.doesNotReplace, ['luxon datetime formatting']);
    assert.equal(parsed.borderline, false);
    assert.equal(parsed.brownfieldTarget, 'moment-timezone / date-fns-tz library usage');
    assert.equal(
      parsed.evidenceFromGuide,
      'Before: const date = moment.tz(str, "America/New_York");',
    );
    assert.equal(
      parsed.reason,
      'Replaces legacy timezone libraries with native Temporal API.',
    );
  });

  await t.test('throws on malformed JSON', () => {
    assert.throws(
      () => parseGuideTriageResponse('{ invalid json', 'test-guide'),
      /Guide Triage response JSON parse error for guide test-guide/,
    );
  });

  await t.test('throws on invalid classification literal', () => {
    const raw = JSON.stringify({
      classification: 'invalid-bucket',
      brownfieldTarget: 'something',
      evidenceFromGuide: 'some evidence',
      reason: 'some reason',
    });
    assert.throws(
      () => parseGuideTriageResponse(raw, 'test-guide'),
      /Guide Triage response invalid classification 'invalid-bucket' for guide test-guide/,
    );
  });

  await t.test('throws on missing required fields', () => {
    const raw = JSON.stringify({
      classification: 'detectable',
      candidateTechniques: ['technique'],
      borderline: false,
      brownfieldTarget: '',
      evidenceFromGuide: 'evidence',
      reason: 'reason',
    });
    assert.throws(
      () => parseGuideTriageResponse(raw, 'test-guide'),
      /Guide Triage response missing string 'brownfieldTarget' for guide test-guide/,
    );
  });
});

void test('guide-triage: triageGuide with mock fetch', async (t) => {
  await t.test('classifies a guide end-to-end and returns GuideTriageEntry with grounding sources and evidenceSource', async () => {
    let capturedUrl = '';
    let capturedBody = '';

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedBody = String(init?.body);

      const fakeResponse = {
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
      };

      return new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const entry = await triageGuide(
      {
        guideId: 'scrollend-event',
        category: 'javascript',
        guideHash: 'abcdef123456',
        markdownContent: '# Scrollend\nReplaces debounce wheel listeners.',
        explainerContext: 'CSSWG scrollend explainer: developers used debounce wheel listeners.',
      },
      {
        apiKey: 'test-api-key',
        fetchFn: mockFetch,
        maxRetries: 1,
      },
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
    assert.ok(typeof entry.explainerContextHash === 'string' && entry.explainerContextHash.length > 0);
    assert.deepEqual(entry.webSearchQueries, ['legacy scrollend replacement']);
    assert.deepEqual(entry.groundingSources, [
      'https://chromestatus.com/feature/5195248554278912',
      'https://github.com/w3c/csswg-drafts/issues/1234',
    ]);
  });

  await t.test('retries on 429 and eventually succeeds', async () => {
    let callCount = 0;

    const mockFetch: typeof fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('Rate limited', { status: 429 });
      }

      const fakeResponse = {
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
      };

      return new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const entry = await triageGuide(
      {
        guideId: 'webgpu-compute',
        category: 'graphics',
        guideHash: '112233445566',
        markdownContent: '# WebGPU Compute',
      },
      {
        apiKey: 'test-api-key',
        fetchFn: mockFetch,
        maxRetries: 2,
      },
    );

    assert.equal(callCount, 2);
    assert.equal(entry.classification, 'skip-no-old-way');
  });

  await t.test('fails loudly when API error persists', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response('Bad Gateway', { status: 502 });
    };

    await assert.rejects(
      async () =>
        triageGuide(
          {
            guideId: 'failing-guide',
            category: 'css',
            guideHash: 'aabbccddeeff',
            markdownContent: '# Failing Guide',
          },
          {
            apiKey: 'test-api-key',
            fetchFn: mockFetch,
            maxRetries: 1,
          },
        ),
      /Guide Triage failed for failing-guide with HTTP 502/,
    );
  });
});
