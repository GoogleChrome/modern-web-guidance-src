import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GATE0_MODEL,
  GATE0_PROMPT_VERSION,
  GATE0_RESPONSE_SCHEMA,
  GATE0_SYSTEM_PROMPT,
  buildGate0RequestBody,
  classifyGuideGate0,
  formatGate0Prompt,
  parseGate0Response,
} from './gate0.ts';

void test('gate0: prompt formatting and request body construction', async (t) => {
  await t.test('formatGate0Prompt includes guideId, category, and full markdown', () => {
    const prompt = formatGate0Prompt({
      guideId: 'temporal-now',
      category: 'javascript',
      guideHash: '1234567890ab',
      markdownContent: '# Temporal Guide\n\nReplaces moment timezone.',
    });

    assert.ok(prompt.includes('## Guide: temporal-now (Category: javascript)'));
    assert.ok(prompt.includes('Replaces moment timezone.'));
  });

  await t.test('buildGate0RequestBody creates temperature 0 request with schema', () => {
    const body = buildGate0RequestBody({
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
        responseSchema: typeof GATE0_RESPONSE_SCHEMA;
      };
    };

    assert.equal(body.systemInstruction.parts[0]?.text, GATE0_SYSTEM_PROMPT);
    assert.equal(body.generationConfig.temperature, 0);
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 2048);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseSchema, GATE0_RESPONSE_SCHEMA);
  });

  await t.test('buildGate0RequestBody supports enableSearchGrounding option', () => {
    const body = buildGate0RequestBody(
      {
        guideId: 'temporal-now',
        category: 'javascript',
        guideHash: '1234567890ab',
        markdownContent: '# Temporal Guide',
      },
      { enableSearchGrounding: true },
    ) as { tools?: Array<{ googleSearch: Record<string, unknown> }> };

    assert.ok(body.tools, 'tools array should be defined when grounding enabled');
    assert.deepEqual(body.tools[0], { googleSearch: {} });
  });
});

void test('gate0: parseGate0Response validation', async (t) => {
  await t.test('parses valid Gate 0 JSON successfully', () => {
    const raw = JSON.stringify({
      classification: 'detectable',
      candidateTechniques: ['moment-timezone', 'date-fns-tz'],
      borderline: false,
      brownfieldTarget: 'moment-timezone / date-fns-tz library usage',
      evidenceFromGuide: 'Before: const date = moment.tz(str, "America/New_York");',
      reason: 'Replaces legacy timezone libraries with native Temporal API.',
    });

    const parsed = parseGate0Response(raw, 'temporal-now');
    assert.equal(parsed.classification, 'detectable');
    assert.deepEqual(parsed.candidateTechniques, ['moment-timezone', 'date-fns-tz']);
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
      () => parseGate0Response('{ invalid json', 'test-guide'),
      /Gate 0 response JSON parse error for guide test-guide/,
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
      () => parseGate0Response(raw, 'test-guide'),
      /Gate 0 response invalid classification 'invalid-bucket' for guide test-guide/,
    );
  });

  await t.test('throws on missing required fields', () => {
    const raw = JSON.stringify({
      classification: 'detectable',
      brownfieldTarget: '',
      evidenceFromGuide: 'evidence',
      reason: 'reason',
    });
    assert.throws(
      () => parseGate0Response(raw, 'test-guide'),
      /Gate 0 response missing string 'brownfieldTarget' for guide test-guide/,
    );
  });
});

void test('gate0: classifyGuideGate0 with mock fetch', async (t) => {
  await t.test('classifies a guide end-to-end and returns Gate0Entry', async () => {
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
                    brownfieldTarget: 'manual wheel event listeners',
                    evidenceFromGuide: 'Replaces window.addEventListener("wheel", ...)',
                    reason: 'Concrete legacy scroll listener replaced by scrollend.',
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

    const entry = await classifyGuideGate0(
      {
        guideId: 'scrollend-event',
        category: 'javascript',
        guideHash: 'abcdef123456',
        markdownContent: '# Scrollend\nReplaces debounce wheel listeners.',
      },
      {
        apiKey: 'test-api-key',
        fetchFn: mockFetch,
        maxRetries: 1,
      },
    );

    assert.ok(capturedUrl.includes(`models/${GATE0_MODEL}:generateContent?key=test-api-key`));
    assert.ok(capturedBody.includes('scrollend-event'));
    assert.equal(entry.guideId, 'scrollend-event');
    assert.equal(entry.guideHash, 'abcdef123456');
    assert.equal(entry.classification, 'detectable');
    assert.equal(entry.brownfieldTarget, 'manual wheel event listeners');
    assert.equal(entry.evidenceFromGuide, 'Replaces window.addEventListener("wheel", ...)');
    assert.equal(entry.gate0PromptVersion, GATE0_PROMPT_VERSION);
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

    const entry = await classifyGuideGate0(
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
        classifyGuideGate0(
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
      /Gate 0 classifyGuide failed for failing-guide with HTTP 502/,
    );
  });
});
