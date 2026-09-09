const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const INVITE_HEADER = 'X-ClutterCash-Invite';
const INVITE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const TELEMETRY_EVENTS = new Set([
  'scan_started',
  'scan_succeeded',
  'scan_failed',
  'project_created',
  'project_reopened',
  'item_corrected',
  'item_status_updated',
  'app_crash',
]);
const TELEMETRY_FAILURE_CODES = new Set(['api', 'network', 'unknown', 'framework', 'async']);

const prompt = `Analyze this staged, non-sensitive household clutter photo for decluttering triage. Identify up to 12 clearly visible objects that may be sold, bundled, donated, recycled, or kept. Be conservative. Resale values are broad US-dollar hypotheses, not live marketplace data or appraisals. Never infer a luxury brand, authenticity, exact model, material, dimensions, condition, or included accessories unless visible. High-value or uncertain objects must tell the user what label, model, or condition photo to add. Recommend donate or bundle where sale effort likely exceeds value. For each item, create a concise searchQuery for finding truly comparable listings without adding facts that are not visible, plus a marketplace recommendation chosen from ebay, facebookMarketplace, mercari, localPickup, consignment, or donate with a reason. Do not create listing copy or claim that any live listings or completed sales were researched. Bounding boxes use normalized 0..1 coordinates. Return only the requested JSON schema.`;

const responseSchema = {
  type: 'object',
  required: ['sceneSummary', 'items'],
  properties: {
    sceneSummary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'category', 'lowValue', 'typicalValue', 'highValue', 'confidence', 'effort', 'route', 'reason', 'searchQuery', 'marketplace', 'marketplaceReason', 'box'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string' },
          lowValue: { type: 'number' },
          typicalValue: { type: 'number' },
          highValue: { type: 'number' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          effort: { type: 'string', enum: ['low', 'medium', 'high'] },
          route: { type: 'string', enum: ['sell', 'bundle', 'donate', 'recycle', 'keep'] },
          reason: { type: 'string' },

          searchQuery: { type: 'string' },
          marketplace: { type: 'string', enum: ['ebay', 'facebookMarketplace', 'mercari', 'localPickup', 'consignment', 'donate'] },
          marketplaceReason: { type: 'string' },

          box: {
            type: 'object',
            required: ['left', 'top', 'width', 'height'],
            properties: {
              left: { type: 'number' }, top: { type: 'number' },
              width: { type: 'number' }, height: { type: 'number' },
            },
          },
        },
      },
    },
  },
};

const identityPrompt = `Read this close-up product label for an already identified household item. Use only visible manufacturer and model information to refine the identity. Model numbers and part numbers are useful. A serial number is a unique identifier: never return the serial number or copy it into the name, search query, or marketplace reason. Return only serialDetected=true when one is visible. Do not claim to have searched the web or verified authenticity, ownership, warranty, recall status, or market prices. Create an exactName, focused marketplace searchQuery, and marketplace recommendation. Unknown values must be empty strings, never guesses. Do not create listing copy. Return only the requested JSON schema.`;

const identitySchema = {
  type: 'object',
  required: ['exactName', 'manufacturer', 'model', 'confidence', 'serialDetected', 'searchQuery', 'marketplace', 'marketplaceReason'],
  properties: {
    exactName: { type: 'string' },
    manufacturer: { type: 'string' },
    model: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    serialDetected: { type: 'boolean' },
    searchQuery: { type: 'string' },

    marketplace: { type: 'string', enum: ['ebay', 'facebookMarketplace', 'mercari', 'localPickup', 'consignment', 'donate'] },
    marketplaceReason: { type: 'string' },

  },
};

export function createHandler({
  fetcher = fetch,
  now = () => Date.now(),
  alertSender = sendOperationalAlert,
  telemetrySender = recordTelemetry,
} = {}) {
  return async function handle(request, env = {}) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (origin && !cors) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors || {} });

    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, analysisReady: Boolean(env.GEMINI_API_KEY), provider: 'gemini' }, 200, cors);
    }
    const isScan = url.pathname === '/v1/scans' && request.method === 'POST';
    const isIdentity = url.pathname === '/v1/items/identify' && request.method === 'POST';
    const isTelemetry = url.pathname === '/v1/telemetry' && request.method === 'POST';
    if (!isScan && !isIdentity && !isTelemetry) {
      return json({ error: 'Not found.' }, 404, cors);
    }
    if (!betaAccessConfigured(env)) {
      return json({ error: 'Free beta access is not configured.' }, 503, cors);
    }
    const inviteHash = await authorizedInviteHash(request, env);
    if (!inviteHash) return json({ error: 'A valid beta invite is required.' }, 401, cors);

    if (isTelemetry) {
      const event = await parseTelemetry(request);
      if (!event) return json({ error: 'Invalid telemetry event.' }, 400, cors);
      await telemetrySender(event, env);
      return json({ accepted: true }, 202, cors);
    }

    if (!env.GEMINI_API_KEY) return json({ error: 'Live analysis is not configured.' }, 503, cors);

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: 'A multipart image upload is required.' }, 400, cors);
    }
    if (form.get('betaConsent') !== 'true') {
      return json({ error: 'Free-beta privacy consent is required.' }, 400, cors);
    }
    const image = form.get('image');
    if (!(image instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      return json({ error: 'A JPEG, PNG, or WebP image is required.' }, 400, cors);
    }
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      return json({ error: 'Image must be between 1 byte and 8 MB.' }, 413, cors);
    }

    const quota = await reserveProviderBudget(env, inviteHash, now());
    if (!quota.available) {
      if (quota.shouldAlert) {
        await alertSender({ event: 'daily_budget_reached' }, env);
      }
      return json({ error: 'Live analysis is temporarily unavailable. Please try again later.' }, quota.status, cors);
    }

    let taskPrompt = prompt;
    let taskSchema = responseSchema;
    let validate = validateScan;
    if (isIdentity) {
      const itemName = textField(form.get('itemName'), 100);
      const category = textField(form.get('category'), 40) || 'Other';
      if (!itemName) return json({ error: 'The existing item name is required.' }, 400, cors);
      taskPrompt = `${identityPrompt}\nExisting broad identification (context only): ${JSON.stringify({ itemName, category })}`;
      taskSchema = identitySchema;
      validate = validateIdentity;
    }

    try {
      const bytes = new Uint8Array(await image.arrayBuffer());
      const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
      const providerResponse = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [
              { text: taskPrompt },
              { inlineData: { mimeType: image.type, data: toBase64(bytes) } },
            ] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              responseJsonSchema: taskSchema,
            },
          }),
        },
      );
      if (!providerResponse.ok) {
        const failure = new Error(`Gemini returned ${providerResponse.status}`);
        failure.status = providerResponse.status;
        throw failure;
      }
      const providerBody = await providerResponse.json();
      const text = providerBody?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned no structured content');
      return json(validate(JSON.parse(text)), 200, cors);
    } catch (error) {
      console.error(isIdentity ? 'identity_failed' : 'scan_failed', error instanceof Error ? error.message : 'unknown');
      await alertSender({
        event: isIdentity ? 'identity_failed' : 'scan_failed',
        status: Number.isInteger(error?.status) ? error.status : 0,
      }, env);
      return json({ error: isIdentity
        ? 'The label could not be analyzed. Please try another close photo.'
        : 'The scan could not be completed. Please try again.' }, 502, cors);
    }
  };
}

function betaAccessConfigured(env) {
  try {
    const codes = JSON.parse(env.BETA_INVITE_CODE_HASHES || '[]');
    return Array.isArray(codes) && codes.length > 0 && codes.every((code) => /^[a-f0-9]{64}$/i.test(code));
  } catch {
    return false;
  }
}

async function authorizedInviteHash(request, env) {
  const inviteCode = request.headers.get(INVITE_HEADER)?.trim();
  if (!inviteCode || inviteCode.length > 128) return null;
  const inviteHash = await sha256Hex(inviteCode);
  const allowed = JSON.parse(env.BETA_INVITE_CODE_HASHES).map((hash) => hash.toLowerCase());
  return allowed.includes(inviteHash) ? inviteHash : null;
}

async function reserveProviderBudget(env, inviteHash, timestamp) {
  if (!env.BETA_USAGE_LIMITER?.idFromName || !env.BETA_USAGE_LIMITER?.get) {
    return { available: false, status: 503 };
  }
  try {
    const id = env.BETA_USAGE_LIMITER.idFromName('global');
    const response = await env.BETA_USAGE_LIMITER.get(id).fetch(new Request('https://usage.internal/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day: new Date(timestamp).toISOString().slice(0, 10),
        timestamp,
        inviteHash,
        inviteLimit: positiveInteger(env.BETA_WEEKLY_REQUEST_LIMIT),
        inviteWindowMs: INVITE_WINDOW_MS,
        budgetMicroUsd: positiveInteger(env.BETA_DAILY_BUDGET_MICRO_USD),
        requestCostMicroUsd: positiveInteger(env.GEMINI_MAX_REQUEST_COST_MICRO_USD),
      }),
    }));
    if (!response.ok) return { available: false, status: 503 };
    const result = await response.json();
    return {
      available: result?.allowed === true,
      status: result?.allowed === true ? 200 : 429,
      shouldAlert: result?.shouldAlert === true,
    };
  } catch {
    return { available: false, status: 503 };
  }
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class BetaUsageLimiter {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/reserve') {
      return json({ error: 'Not found.' }, 404);
    }
    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: 'Invalid reservation.' }, 400);
    }
    const day = typeof input?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : '';
    const timestamp = Number.isSafeInteger(input?.timestamp) && input.timestamp > 0 ? input.timestamp : 0;
    const inviteHash = typeof input?.inviteHash === 'string' ? input.inviteHash.trim().slice(0, 128) : '';
    const inviteLimit = positiveInteger(input?.inviteLimit);
    const inviteWindowMs = positiveInteger(input?.inviteWindowMs);
    const budgetMicroUsd = positiveInteger(input?.budgetMicroUsd);
    const requestCostMicroUsd = positiveInteger(input?.requestCostMicroUsd);
    if (!day || !timestamp || !inviteHash || !inviteLimit || !inviteWindowMs || !budgetMicroUsd || !requestCostMicroUsd) {
      return json({ error: 'Invalid reservation.' }, 400);
    }

    const result = await this.storage.transaction(async (transaction) => {
      const inviteKey = `invite:${inviteHash}`;
      const budgetKey = `${day}:budget`;
      const alertKey = `${day}:budget-alerted`;
      const recent = (await transaction.get(inviteKey) || [])
        .filter((usedAt) => Number.isSafeInteger(usedAt) && usedAt > timestamp - inviteWindowMs);
      const budgetUsed = Number(await transaction.get(budgetKey)) || 0;
      if (recent.length >= inviteLimit) {
        return { allowed: false, reason: 'invite_limit', shouldAlert: false };
      }
      if (budgetUsed + requestCostMicroUsd > budgetMicroUsd) {
        const alreadyAlerted = await transaction.get(alertKey) === true;
        if (!alreadyAlerted) await transaction.put({ [alertKey]: true });
        return { allowed: false, reason: 'daily_budget', shouldAlert: !alreadyAlerted };
      }
      await transaction.put({
        [inviteKey]: [...recent, timestamp],
        [budgetKey]: budgetUsed + requestCostMicroUsd,
      });
      return { allowed: true };
    });
    return json(result);
  }
}

async function parseTelemetry(request) {
  try {
    const text = await request.text();
    if (!text || text.length > 256) return null;
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const keys = Object.keys(value);
    if (keys.some((key) => key !== 'event' && key !== 'failureCode')) return null;
    if (!TELEMETRY_EVENTS.has(value.event)) return null;
    if (value.failureCode !== undefined && !TELEMETRY_FAILURE_CODES.has(value.failureCode)) return null;
    const acceptsFailure = value.event === 'scan_failed' || value.event === 'app_crash';
    if (!acceptsFailure && value.failureCode !== undefined) return null;
    if (acceptsFailure && value.failureCode === undefined) return null;
    return value.failureCode === undefined
      ? { event: value.event }
      : { event: value.event, failureCode: value.failureCode };
  } catch {
    return null;
  }
}

async function recordTelemetry(event) {
  console.info(JSON.stringify({ source: 'cluttercash-beta', ...event }));
}

async function sendOperationalAlert(event, env) {
  if (!env.ALERT_WEBHOOK_URL) return;
  let url;
  try {
    url = new URL(env.ALERT_WEBHOOK_URL);
  } catch {
    return;
  }
  if (url.protocol !== 'https:') return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'cluttercash-worker', ...event }),
    });
  } catch {
    // Alert delivery must not expose details or replace the client response.
  }
}

function corsHeaders(origin, allowedOrigin) {
  if (!origin) return {};
  const allowed = new Set([allowedOrigin, 'http://localhost:4173', 'http://127.0.0.1:4173'].filter(Boolean));
  if (!allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, ${INVITE_HEADER}`,
    'Vary': 'Origin',
  };
}

function json(value, status = 200, cors = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(cors || {}),
    },
  });
}

function validateScan(value) {
  if (!value || typeof value.sceneSummary !== 'string' || !Array.isArray(value.items) || value.items.length === 0) {
    throw new Error('Invalid Gemini response');
  }
  const levels = new Set(['low', 'medium', 'high']);
  const routes = new Set(['sell', 'bundle', 'donate', 'recycle', 'keep']);
  const marketplaces = new Set(['ebay', 'facebookMarketplace', 'mercari', 'localPickup', 'consignment', 'donate']);
  const items = value.items.slice(0, 20).map((item, index) => {
    if (!item || typeof item.name !== 'string') throw new Error('Invalid Gemini item');
    const low = finite(item.lowValue);
    const typical = finite(item.typicalValue);
    const high = finite(item.highValue);
    return {
      id: String(item.id || `item-${index + 1}`),
      name: item.name.slice(0, 100),
      category: String(item.category || 'Other').slice(0, 40),
      lowValue: Math.min(low, typical, high),
      typicalValue: typical,
      highValue: Math.max(low, typical, high),
      confidence: levels.has(item.confidence) ? item.confidence : 'low',
      effort: levels.has(item.effort) ? item.effort : 'medium',
      route: routes.has(item.route) ? item.route : 'keep',
      reason: String(item.reason || '').slice(0, 240),

      searchQuery: String(item.searchQuery || item.name).slice(0, 120),
      marketplace: marketplaces.has(item.marketplace) ? item.marketplace : 'localPickup',
      marketplaceReason: String(item.marketplaceReason || '').slice(0, 240),

      box: {
        left: clamp(item.box?.left), top: clamp(item.box?.top),
        width: clamp(item.box?.width), height: clamp(item.box?.height),
      },
    };
  });
  return { sceneSummary: value.sceneSummary.slice(0, 160), items };
}

function validateIdentity(value) {
  if (!value || typeof value.exactName !== 'string') throw new Error('Invalid Gemini identity');
  const levels = new Set(['low', 'medium', 'high']);
  const marketplaces = new Set(['ebay', 'facebookMarketplace', 'mercari', 'localPickup', 'consignment', 'donate']);
  return {
    exactName: value.exactName.slice(0, 100),
    manufacturer: String(value.manufacturer || '').slice(0, 60),
    model: String(value.model || '').slice(0, 80),
    confidence: levels.has(value.confidence) ? value.confidence : 'low',
    serialDetected: value.serialDetected === true,
    searchQuery: String(value.searchQuery || value.exactName).slice(0, 120),

    marketplace: marketplaces.has(value.marketplace) ? value.marketplace : 'localPickup',
    marketplaceReason: String(value.marketplaceReason || '').slice(0, 240),

  };
}

function textField(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}
function clamp(value) { return Math.max(0, Math.min(1, finite(value))); }
function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

const handler = createHandler();
export default { fetch: (request, env) => handler(request, env) };
