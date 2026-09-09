import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BetaUsageLimiter, createHandler } from '../src/worker.js';

const env = {
  GEMINI_API_KEY: 'test-secret',
  GEMINI_MODEL: 'gemini-test',
  ALLOWED_ORIGIN: 'https://zeroleveldev.github.io',
  BETA_INVITE_CODE_HASHES: '["3ac96c6f1013fc0c2f5c5309d075f7785f1e3024609a64224bc6f406082af744"]',
  BETA_WEEKLY_REQUEST_LIMIT: '3',
  BETA_DAILY_BUDGET_MICRO_USD: '500000',
  GEMINI_MAX_REQUEST_COST_MICRO_USD: '10000',
  BETA_USAGE_LIMITER: {
    idFromName: (name) => name,
    get: () => ({ fetch: async () => Response.json({ allowed: true }) }),
  },
};

function imageRequest({ consent = true, origin = env.ALLOWED_ORIGIN } = {}) {
  const form = new FormData();
  form.append('image', new File(['fake-image'], 'room.jpg', { type: 'image/jpeg' }));
  if (consent) form.append('betaConsent', 'true');
  return new Request('https://api.example/v1/scans', {
    method: 'POST', body: form, headers: {
      Origin: origin,
      'CF-Connecting-IP': '203.0.113.10',
      'X-ClutterCash-Invite': 'test-invite',
    },
  });
}

function labelRequest({ consent = true, origin = env.ALLOWED_ORIGIN } = {}) {
  const form = new FormData();
  form.append('image', new File(['fake-label'], 'label.jpg', { type: 'image/jpeg' }));
  form.append('itemName', 'Vintage film camera');
  form.append('category', 'Cameras');
  if (consent) form.append('betaConsent', 'true');
  return new Request('https://api.example/v1/items/identify', {
    method: 'POST', body: form, headers: {
      Origin: origin,
      'CF-Connecting-IP': '203.0.113.11',
      'X-ClutterCash-Invite': 'test-invite',
    },
  });
}

function telemetryRequest(body, { invite = 'test-invite', origin = env.ALLOWED_ORIGIN } = {}) {
  return new Request('https://api.example/v1/telemetry', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'X-ClutterCash-Invite': invite,
    },
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

test('blocks live analysis until beta invite protection is configured', async () => {
  const response = await createHandler({ fetcher: async () => { throw new Error('provider must not be called'); } })(
    imageRequest(),
    { ...env, BETA_INVITE_CODE_HASHES: '' },
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /beta access/i);
});

test('rejects a missing or invalid invite code before consuming quota', async () => {
  let quotaCalls = 0;
  const protectedEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => { quotaCalls += 1; return Response.json({ allowed: true }); } }),
    },
  };
  const missing = imageRequest();
  missing.headers.delete('X-ClutterCash-Invite');
  const invalid = imageRequest();
  invalid.headers.set('X-ClutterCash-Invite', 'wrong-code');

  const handler = createHandler({ fetcher: async () => { throw new Error('provider must not be called'); } });
  assert.equal((await handler(missing, protectedEnv)).status, 401);
  assert.equal((await handler(invalid, protectedEnv)).status, 401);
  assert.equal(quotaCalls, 0);
});

test('accepts only allow-listed privacy-minimal beta telemetry without consuming provider quota', async () => {
  const events = [];
  let quotaCalls = 0;
  let providerCalls = 0;
  const telemetryEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => { quotaCalls += 1; return Response.json({ allowed: true }); } }),
    },
  };
  const handler = createHandler({
    fetcher: async () => { providerCalls += 1; },
    telemetrySender: async (event) => { events.push(event); },
  });

  const response = await handler(
    telemetryRequest({ event: 'scan_failed', failureCode: 'api' }),
    telemetryEnv,
  );

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.deepEqual(events, [{ event: 'scan_failed', failureCode: 'api' }]);
  assert.equal(quotaCalls, 0);
  assert.equal(providerCalls, 0);
});

test('telemetry rejects invalid invites, unknown events, and payload fields that could contain user data', async () => {
  const events = [];
  const handler = createHandler({ telemetrySender: async (event) => { events.push(event); } });

  assert.equal((await handler(
    telemetryRequest({ event: 'project_created' }, { invite: 'wrong-code' }),
    env,
  )).status, 401);
  assert.equal((await handler(
    telemetryRequest({ event: 'item_named_camera' }),
    env,
  )).status, 400);
  assert.equal((await handler(
    telemetryRequest({ event: 'item_corrected', itemName: 'Private item name' }),
    env,
  )).status, 400);
  assert.equal((await handler(
    telemetryRequest({ event: 'scan_failed', failureCode: 'raw exception text' }),
    env,
  )).status, 400);
  assert.deepEqual(events, []);
});

test('uses durable quota and alerts once when the daily budget is reached', async () => {
  let providerCalls = 0;
  let quotaRequest;
  const alerts = [];
  const limitedEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          quotaRequest = await request.json();
          return Response.json({ allowed: false, reason: 'daily_budget', shouldAlert: true });
        },
      }),
    },
  };

  const response = await createHandler({
    fetcher: async () => { providerCalls += 1; },
    now: () => Date.UTC(2026, 8, 8, 12),
    alertSender: async (event) => { alerts.push(event); },
  })(imageRequest(), limitedEnv);

  assert.equal(response.status, 429);
  assert.equal(providerCalls, 0);
  assert.deepEqual(alerts, [{ event: 'daily_budget_reached' }]);
  assert.deepEqual(quotaRequest, {
    day: '2026-09-08',
    timestamp: Date.UTC(2026, 8, 8, 12),
    inviteHash: '3ac96c6f1013fc0c2f5c5309d075f7785f1e3024609a64224bc6f406082af744',
    inviteLimit: 3,
    inviteWindowMs: 7 * 24 * 60 * 60 * 1000,
    budgetMicroUsd: 500000,
    requestCostMicroUsd: 10000,
  });
  assert.doesNotMatch(await response.text(), /budget|Gemini|500000/i);
});

test('fails closed when the durable quota binding is unavailable', async () => {
  const response = await createHandler({ fetcher: async () => { throw new Error('provider must not be called'); } })(
    imageRequest(),
    { ...env, BETA_USAGE_LIMITER: undefined },
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /temporarily unavailable/i);
});

test('durable limiter enforces three analyses in a rolling seven-day invite window', async () => {
  const values = new Map();
  const storage = {
    transaction: async (callback) => callback({
      get: async (key) => values.get(key),
      put: async (entries) => { for (const [key, value] of Object.entries(entries)) values.set(key, value); },
    }),
  };
  const limiter = new BetaUsageLimiter({ storage });
  const reserve = (body) => limiter.fetch(new Request('https://usage.internal/reserve', {
    method: 'POST', body: JSON.stringify(body),
  }));
  const base = {
    day: '2026-09-08', timestamp: Date.UTC(2026, 8, 8, 12),
    inviteHash: 'invite-a', inviteLimit: 3, inviteWindowMs: 7 * 24 * 60 * 60 * 1000,
    budgetMicroUsd: 100000, requestCostMicroUsd: 10000,
  };

  assert.equal((await (await reserve(base)).json()).allowed, true);
  assert.equal((await (await reserve({ ...base, timestamp: base.timestamp + 1 })).json()).allowed, true);
  assert.equal((await (await reserve({ ...base, timestamp: base.timestamp + 2 })).json()).allowed, true);
  const weeklyLimited = await (await reserve({ ...base, timestamp: base.timestamp + 3 })).json();
  assert.deepEqual(weeklyLimited, { allowed: false, reason: 'invite_limit', shouldAlert: false });

  const afterWindow = await (await reserve({
    ...base,
    timestamp: base.timestamp + (7 * 24 * 60 * 60 * 1000) + 1,
  })).json();
  assert.equal(afterWindow.allowed, true);
});

test('provider failures emit a sanitized operational alert', async () => {
  const alerts = [];
  const response = await createHandler({
    fetcher: async () => new Response('provider secret detail', { status: 500 }),
    alertSender: async (event) => { alerts.push(event); },
  })(imageRequest(), { ...env, ALERT_WEBHOOK_URL: 'https://alerts.example/hook' });

  assert.equal(response.status, 502);
  assert.deepEqual(alerts, [{ event: 'scan_failed', status: 500 }]);
  assert.doesNotMatch(JSON.stringify(alerts), /secret|test-invite|test-secret/);
});

test('sends the image to Gemini and returns a validated scan contract', async () => {
  let providerRequest;
  const fetcher = async (_url, options) => {
    providerRequest = JSON.parse(options.body);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      sceneSummary: 'Garage shelf',
      items: [{ id: 'camera', name: 'Film camera', category: 'Cameras', lowValue: 80,
        typicalValue: 110, highValue: 150, confidence: 'medium', effort: 'medium',
        route: 'sell', reason: 'Check model', listingTitle: 'Film camera — model unknown',
        listingDescription: 'Film camera. Confirm model and condition before posting.',
        searchQuery: 'film camera body', marketplace: 'ebay',
        marketplaceReason: 'eBay has a broad camera buyer pool.',
        missingDetails: ['Exact model', 'Working condition'],
        box: { left: .1, top: .2, width: .3, height: .4 } }],
    }) }] } }] });
  };
  const response = await createHandler({ fetcher })(imageRequest(), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.items[0].name, 'Film camera');
  assert.equal('listingTitle' in result.items[0], false);
  assert.equal('listingDescription' in result.items[0], false);
  assert.equal(result.items[0].marketplace, 'ebay');
  assert.equal('missingDetails' in result.items[0], false);
  assert.equal(providerRequest.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  assert.equal(providerRequest.generationConfig.responseMimeType, 'application/json');
  assert.equal('maxItems' in providerRequest.generationConfig.responseJsonSchema.properties.items, false);
});

test('uses a label photo to refine an item without returning its serial number', async () => {
  let providerRequest;
  const fetcher = async (_url, options) => {
    providerRequest = JSON.parse(options.body);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      exactName: 'Canon AE-1 35mm film camera', manufacturer: 'Canon', model: 'AE-1',
      confidence: 'high', serialDetected: true, serialNumber: 'REDACT-ME-123',
      searchQuery: 'Canon AE-1 35mm film camera body',
      listingTitle: 'Canon AE-1 35mm Film Camera Body — Condition to Confirm',
      listingDescription: 'Canon AE-1 35mm film camera body. Confirm operation, cosmetic wear, lens, battery, and accessories before posting.',
      marketplace: 'ebay', marketplaceReason: 'Collectors search by exact model on eBay.',
      missingDetails: ['Working condition', 'Included lens and accessories'],
    }) }] } }] });
  };

  const response = await createHandler({ fetcher })(labelRequest(), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.exactName, 'Canon AE-1 35mm film camera');
  assert.equal(result.model, 'AE-1');
  assert.equal(result.serialDetected, true);
  assert.equal('serialNumber' in result, false);
  assert.equal('listingTitle' in result, false);
  assert.equal('listingDescription' in result, false);
  assert.equal('missingDetails' in result, false);
  assert.equal(JSON.stringify(result).includes('REDACT-ME-123'), false);
  assert.match(providerRequest.contents[0].parts[0].text, /never return.*serial/i);
  assert.equal(providerRequest.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
});

test('does not echo provider errors or secrets to clients', async () => {
  const response = await createHandler({ fetcher: async () => new Response(`bad ${env.GEMINI_API_KEY}`, { status: 429 }) })(imageRequest(), env);
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.equal(text.includes(env.GEMINI_API_KEY), false);
  assert.match(text, /try again/i);
});
