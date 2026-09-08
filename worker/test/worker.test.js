import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from '../src/worker.js';

const env = {
  GEMINI_API_KEY: 'test-secret',
  GEMINI_MODEL: 'gemini-test',
  ALLOWED_ORIGIN: 'https://zeroleveldev.github.io',
};

function imageRequest({ consent = true, origin = env.ALLOWED_ORIGIN } = {}) {
  const form = new FormData();
  form.append('image', new File(['fake-image'], 'room.jpg', { type: 'image/jpeg' }));
  if (consent) form.append('betaConsent', 'true');
  return new Request('https://api.example/v1/scans', {
    method: 'POST', body: form, headers: { Origin: origin, 'CF-Connecting-IP': '203.0.113.10' },
  });
}

test('health is public and never exposes the Gemini secret', async () => {
  const response = await createHandler({ fetcher: async () => { throw new Error('unused'); } })(
    new Request('https://api.example/health'), env,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { ok: true, analysisReady: true, provider: 'gemini' });
  assert.equal(JSON.stringify(body).includes(env.GEMINI_API_KEY), false);
});

test('rejects real-photo analysis without explicit free-beta consent', async () => {
  let calls = 0;
  const response = await createHandler({ fetcher: async () => { calls += 1; } })(imageRequest({ consent: false }), env);
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  assert.match((await response.json()).error, /consent/i);
});

test('rejects unapproved browser origins', async () => {
  const response = await createHandler({ fetcher: async () => { throw new Error('unused'); } })(
    imageRequest({ origin: 'https://attacker.example' }), env,
  );
  assert.equal(response.status, 403);
});

test('sends the image to Gemini and returns a validated scan contract', async () => {
  let providerRequest;
  const fetcher = async (_url, options) => {
    providerRequest = JSON.parse(options.body);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      sceneSummary: 'Garage shelf',
      items: [{ id: 'camera', name: 'Film camera', category: 'Cameras', lowValue: 80,
        typicalValue: 110, highValue: 150, confidence: 'medium', effort: 'medium',
        route: 'sell', reason: 'Check model', box: { left: .1, top: .2, width: .3, height: .4 } }],
    }) }] } }] });
  };
  const response = await createHandler({ fetcher })(imageRequest(), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).items[0].name, 'Film camera');
  assert.equal(providerRequest.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  assert.equal(providerRequest.generationConfig.responseMimeType, 'application/json');
  assert.equal('maxItems' in providerRequest.generationConfig.responseJsonSchema.properties.items, false);
});

test('does not echo provider errors or secrets to clients', async () => {
  const response = await createHandler({ fetcher: async () => new Response(`bad ${env.GEMINI_API_KEY}`, { status: 429 }) })(imageRequest(), env);
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.equal(text.includes(env.GEMINI_API_KEY), false);
  assert.match(text, /try again/i);
});
