const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const INVITE_HEADER = 'X-ClutterCash-Invite';
const DEVICE_HEADER = 'X-ClutterCash-Device';
const REQUEST_HEADER = 'X-ClutterCash-Request';
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
  idGenerator = () => crypto.randomUUID(),
  tokenGenerator = generateInviteCode,
  approvalTokenGenerator = generateApprovalToken,
  requestTokenGenerator = generateApprovalToken,
} = {}) {
  return async function handle(request, env = {}) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const isSameOriginApproval = /^\/v1\/access-requests\/[A-Za-z0-9_-]{1,100}\/approve$/.test(url.pathname)
      && origin === url.origin;
    const cors = isSameOriginApproval ? {} : corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (origin && !cors) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors || {} });

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, analysisReady: Boolean(env.GEMINI_API_KEY), provider: 'gemini' }, 200, cors);
    }
    const statusMatch = url.pathname.match(/^\/v1\/access-requests\/([A-Za-z0-9_-]{1,100})\/status$/);
    if (statusMatch && request.method === 'GET') {
      const requestToken = request.headers.get(REQUEST_HEADER)?.trim() || '';
      if (!/^[a-f0-9]{64}$/.test(requestToken)) {
        return json({ error: 'Request status not found.' }, 404, cors);
      }
      const result = await pendingAccessRequestStatus(env, {
        requestId: statusMatch[1],
        requestTokenHash: await sha256Hex(requestToken),
        timestamp: now(),
      });
      if (!result.available) return json({ error: 'Request status not found.' }, 404, cors);
      return json({ status: result.status }, 200, cors);
    }

    const approvalMatch = url.pathname.match(/^\/v1\/access-requests\/([A-Za-z0-9_-]{1,100})\/approve$/);
    if (approvalMatch && (request.method === 'GET' || request.method === 'POST')) {
      const requestId = approvalMatch[1];
      const approvalToken = url.searchParams.get('token') || '';
      if (approvalToken.length < 32 || approvalToken.length > 160) {
        return approvalPage('Approval link invalid', 'This approval link is invalid or incomplete.', 400);
      }
      const tokenHash = await sha256Hex(approvalToken);
      if (request.method === 'GET') {
        const pending = await checkPendingAccessRequest(env, { requestId, tokenHash, timestamp: now() });
        if (!pending.available) {
          return approvalPage('Approval unavailable', 'This request was already handled or the link expired.', 410);
        }
        return approvalConfirmationPage(request.url);
      }

      const claimed = await claimPendingAccessRequest(env, { requestId, tokenHash, timestamp: now() });
      if (!claimed.available) {
        return approvalPage('Approval unavailable', 'This request was already handled or the link expired.', 409);
      }
      const registered = await registerInvite(env, {
        inviteHash: claimed.deviceHash,
        email: '',
        createdAt: now(),
      });
      if (!registered) {
        await releasePendingAccessRequest(env, { requestId, tokenHash });
        return approvalPage('Could not approve', 'Access could not be activated. Please try again.', 503);
      }
      const completed = await completePendingAccessRequest(env, {
        requestId,
        tokenHash,
        timestamp: now(),
      });
      if (!completed) {
        return approvalPage('Could not approve', 'Access was registered, but status could not be updated. The requester may retry in the app.', 503);
      }
      return approvalPage('Access activated', 'Continued beta access is now active in the requesting browser. You can close this page.', 200);
    }
    if (url.pathname === '/v1/access-requests' && request.method === 'POST') {
      const accessRequest = await parseAccessRequest(request);
      if (!accessRequest) return json({ error: 'Enter a valid email address.' }, 400, cors);
      const deviceToken = request.headers.get(DEVICE_HEADER)?.trim().toLowerCase() || '';
      if (!/^[a-f0-9]{64}$/.test(deviceToken)) {
        return json({ error: 'This browser could not be linked to the access request. Refresh and try again.' }, 400, cors);
      }
      const timestamp = now();
      const reserved = await reserveAccessRequest(env, accessRequest.email, request.headers.get('CF-Connecting-IP'), timestamp);
      if (!reserved.available) {
        return json({ error: reserved.status === 429
          ? 'A request was already received recently. Please wait before trying again.'
          : 'Access requests are temporarily unavailable. Email cluttercash.help@gmail.com instead.' }, reserved.status, cors);
      }
      const requestId = idGenerator();
      const approvalToken = approvalTokenGenerator();
      const requestToken = requestTokenGenerator();
      const tokenHash = await sha256Hex(approvalToken);
      const requestTokenHash = await sha256Hex(requestToken);
      const deviceHash = await sha256Hex(deviceToken);
      const stored = await storePendingAccessRequest(env, {
        requestId,
        tokenHash,
        requestTokenHash,
        deviceHash,
        createdAt: timestamp,
        expiresAt: timestamp + 7 * 24 * 60 * 60 * 1000,
      });
      if (!stored) {
        return json({ error: 'Access requests are temporarily unavailable. Email cluttercash.help@gmail.com instead.' }, 503, cors);
      }
      const approvalUrl = `${url.origin}/v1/access-requests/${encodeURIComponent(requestId)}/approve?token=${encodeURIComponent(approvalToken)}`;
      const delivered = await alertSender({
        event: 'beta_access_requested', requestId, approvalUrl, ...accessRequest,
      }, env);
      if (delivered !== true) {
        await deletePendingAccessRequest(env, { requestId, tokenHash });
        return json({ error: 'The request could not be delivered. Email cluttercash.help@gmail.com instead.' }, 503, cors);
      }
      return json({ accepted: true, requestId, requestToken }, 202, cors);
    }
    if (url.pathname === '/v1/admin/invites' && request.method === 'POST') {
      if (!await authorizedAdmin(request, env)) return json({ error: 'Owner authorization is required.' }, 401, cors);
      const input = await parseAdminInviteRequest(request);
      if (!input) return json({ error: 'Enter a valid tester email address.' }, 400, cors);
      const inviteCode = tokenGenerator();
      const inviteHash = await sha256Hex(inviteCode);
      const registered = await registerInvite(env, {
        inviteHash,
        email: input.email,
        createdAt: now(),
      });
      if (!registered) return json({ error: 'The invite could not be registered.' }, 503, cors);
      return json({ inviteCode, email: input.email }, 201, cors);
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
    if (!inviteHash) return json({ error: 'Free-use access could not be verified.' }, 401, cors);

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

    const quota = await reserveProviderBudget(
      env,
      inviteHash,
      now(),
      ownerInviteAllowed(env, inviteHash),
    );
    if (!quota.available) {
      if (quota.shouldAlert) {
        await alertSender({ event: 'daily_budget_reached' }, env);
      }
      return json({ error: quota.reason === 'anonymous_limit'
        ? 'You have used all 3 free analyses on this browser. Request continued beta access.'
        : quota.reason === 'invite_limit'
          ? 'You have used all 3 analyses in your current beta allowance. Each analysis becomes available again 7 days after it was used.'
          : 'Live analysis is temporarily unavailable. Please try again later.' }, quota.status, cors);
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

function ownerInviteAllowed(env, inviteHash) {
  try {
    const hashes = JSON.parse(env.BETA_OWNER_INVITE_CODE_HASHES || '[]');
    return Array.isArray(hashes)
      && hashes.every((hash) => /^[a-f0-9]{64}$/i.test(hash))
      && hashes.some((hash) => hash.toLowerCase() === inviteHash.toLowerCase());
  } catch {
    return false;
  }
}

async function authorizedInviteHash(request, env) {
  const inviteCode = request.headers.get(INVITE_HEADER)?.trim() || '';
  if (inviteCode && inviteCode.length <= 128) {
    const inviteHash = await sha256Hex(inviteCode);
    let allowed = [];
    try {
      const configured = JSON.parse(env.BETA_INVITE_CODE_HASHES || '[]');
      if (Array.isArray(configured)) allowed = configured.map((hash) => String(hash).toLowerCase());
    } catch {
      allowed = [];
    }
    if (allowed.includes(inviteHash)) return inviteHash;
    if (await registeredInviteAllowed(env, inviteHash)) return inviteHash;
    return null;
  }

  const deviceToken = request.headers.get(DEVICE_HEADER)?.trim() || '';
  if (deviceToken.length < 32 || deviceToken.length > 128 || !/^[A-Za-z0-9_-]+$/.test(deviceToken)) {
    return null;
  }
  const deviceHash = await sha256Hex(deviceToken);
  if (await registeredInviteAllowed(env, deviceHash)) return deviceHash;
  return `device:${deviceHash}`;
}

async function parseAccessRequest(request) {
  try {
    const text = await request.text();
    if (!text || text.length > 1024) return null;
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    if (Object.keys(value).some((key) => !['email', 'name', 'device'].includes(key))) return null;
    const email = normalizeEmail(value.email);
    if (!email) return null;
    return {
      email,
      name: safeContactText(value.name, 60),
      device: safeContactText(value.device, 80),
    };
  } catch {
    return null;
  }
}

async function parseAdminInviteRequest(request) {
  try {
    const text = await request.text();
    if (!text || text.length > 512) return null;
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    if (Object.keys(value).some((key) => key !== 'email')) return null;
    const email = normalizeEmail(value.email);
    return email ? { email } : null;
  } catch {
    return null;
  }
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,63}$/.test(email)
    ? email
    : '';
}

function safeContactText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\r\n\t`*_~|<>@]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

async function authorizedAdmin(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const expected = typeof env.ADMIN_API_KEY === 'string' ? env.ADMIN_API_KEY.trim() : '';
  if (provided.length < 32 || expected.length < 32) return false;
  return await sha256Hex(provided) === await sha256Hex(expected);
}

function generateInviteCode() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `CC-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function generateApprovalToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function durableStub(env) {
  if (!env.BETA_USAGE_LIMITER?.idFromName || !env.BETA_USAGE_LIMITER?.get) return null;
  const id = env.BETA_USAGE_LIMITER.idFromName('global');
  return env.BETA_USAGE_LIMITER.get(id);
}

async function registeredInviteAllowed(env, inviteHash) {
  try {
    const stub = durableStub(env);
    if (!stub) return false;
    const response = await stub.fetch(new Request('https://usage.internal/invites/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteHash }),
    }));
    return response.ok && (await response.json())?.allowed === true;
  } catch {
    return false;
  }
}

async function registerInvite(env, input) {
  try {
    const stub = durableStub(env);
    if (!stub) return false;
    const response = await stub.fetch(new Request('https://usage.internal/invites/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }));
    return response.ok && (await response.json())?.registered === true;
  } catch {
    return false;
  }
}

async function pendingAccessRequestCall(env, path, input) {
  try {
    const stub = durableStub(env);
    if (!stub) return null;
    const response = await stub.fetch(new Request(`https://usage.internal${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }));
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function storePendingAccessRequest(env, input) {
  return (await pendingAccessRequestCall(env, '/access-requests/store', input))?.stored === true;
}

async function checkPendingAccessRequest(env, input) {
  const result = await pendingAccessRequestCall(env, '/access-requests/check', input);
  return { available: result?.available === true };
}

async function pendingAccessRequestStatus(env, input) {
  const result = await pendingAccessRequestCall(env, '/access-requests/status', input);
  return {
    available: result?.available === true,
    status: result?.status === 'approved' ? 'approved' : 'pending',
  };
}

async function claimPendingAccessRequest(env, input) {
  const result = await pendingAccessRequestCall(env, '/access-requests/claim', input);
  return {
    available: result?.available === true,
    deviceHash: typeof result?.deviceHash === 'string' ? result.deviceHash : '',
  };
}

async function releasePendingAccessRequest(env, input) {
  return (await pendingAccessRequestCall(env, '/access-requests/release', input))?.released === true;
}

async function completePendingAccessRequest(env, input) {
  return (await pendingAccessRequestCall(env, '/access-requests/complete', input))?.completed === true;
}

async function deletePendingAccessRequest(env, input) {
  return (await pendingAccessRequestCall(env, '/access-requests/delete', input))?.deleted === true;
}

async function reserveAccessRequest(env, email, ip, timestamp) {
  try {
    const stub = durableStub(env);
    if (!stub) return { available: false, status: 503 };
    const response = await stub.fetch(new Request('https://usage.internal/access-requests/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailHash: await sha256Hex(email),
        ipHash: await sha256Hex(typeof ip === 'string' && ip ? ip : 'unknown'),
        timestamp,
      }),
    }));
    if (!response.ok) return { available: false, status: 503 };
    const result = await response.json();
    return { available: result?.allowed === true, status: result?.allowed === true ? 202 : 429 };
  } catch {
    return { available: false, status: 503 };
  }
}

async function reserveProviderBudget(env, inviteHash, timestamp, unlimited = false) {
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
        anonymous: inviteHash.startsWith('device:'),
        ...(unlimited ? { unlimited: true } : {}),
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
      reason: typeof result?.reason === 'string' ? result.reason : '',
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

  async scheduleCleanup(timestamp) {
    if (typeof this.storage.getAlarm !== 'function' || typeof this.storage.setAlarm !== 'function') return;
    const scheduled = await this.storage.getAlarm();
    if (scheduled === null || timestamp < scheduled) await this.storage.setAlarm(timestamp);
  }

  async alarm() {
    if (typeof this.storage.list !== 'function') return;
    const timestamp = Date.now();
    const records = await this.storage.list({ prefix: 'pending-access:' });
    let nextExpiry = null;
    for (const [key, record] of records) {
      const expiresAt = record?.status === 'approved' ? record.statusExpiresAt : record?.expiresAt;
      if (!Number.isSafeInteger(expiresAt) || expiresAt <= timestamp) {
        await this.storage.delete(key);
      } else if (nextExpiry === null || expiresAt < nextExpiry) {
        nextExpiry = expiresAt;
      }
    }
    if (nextExpiry !== null && typeof this.storage.setAlarm === 'function') {
      await this.storage.setAlarm(nextExpiry);
    }
  }

  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (request.method !== 'POST') return json({ error: 'Not found.' }, 404);
    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: 'Invalid request.' }, 400);
    }

    if (pathname === '/invites/register') {
      const inviteHash = typeof input?.inviteHash === 'string' ? input.inviteHash.toLowerCase() : '';
      const createdAt = Number.isSafeInteger(input?.createdAt) && input.createdAt > 0 ? input.createdAt : 0;
      if (!/^[a-f0-9]{64}$/.test(inviteHash) || !createdAt) {
        return json({ error: 'Invalid invite registration.' }, 400);
      }
      await this.storage.put(`allowed-invite:${inviteHash}`, { createdAt });
      return json({ registered: true }, 201);
    }

    if (pathname === '/invites/check') {
      const inviteHash = typeof input?.inviteHash === 'string' ? input.inviteHash.toLowerCase() : '';
      if (!/^[a-f0-9]{64}$/.test(inviteHash)) return json({ allowed: false });
      return json({ allowed: Boolean(await this.storage.get(`allowed-invite:${inviteHash}`)) });
    }

    if (pathname.startsWith('/access-requests/') && pathname !== '/access-requests/reserve') {
      const requestId = typeof input?.requestId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(input.requestId)
        ? input.requestId
        : '';
      const tokenHash = typeof input?.tokenHash === 'string' ? input.tokenHash.toLowerCase() : '';
      const requiresApprovalToken = pathname !== '/access-requests/status';
      if (!requestId || (requiresApprovalToken && !/^[a-f0-9]{64}$/.test(tokenHash))) {
        return json({ error: 'Invalid pending request operation.' }, 400);
      }
      const key = `pending-access:${requestId}`;

      if (pathname === '/access-requests/store') {
        const requestTokenHash = typeof input?.requestTokenHash === 'string'
          ? input.requestTokenHash.toLowerCase()
          : '';
        const deviceHash = typeof input?.deviceHash === 'string' ? input.deviceHash.toLowerCase() : '';
        const createdAt = Number.isSafeInteger(input?.createdAt) && input.createdAt > 0 ? input.createdAt : 0;
        const expiresAt = Number.isSafeInteger(input?.expiresAt) && input.expiresAt > createdAt
          ? input.expiresAt
          : 0;
        if (!/^[a-f0-9]{64}$/.test(requestTokenHash)
            || !/^[a-f0-9]{64}$/.test(deviceHash) || !createdAt || !expiresAt
            || expiresAt - createdAt > 7 * 24 * 60 * 60 * 1000) {
          return json({ error: 'Invalid pending request.' }, 400);
        }
        await this.storage.put(key, {
          requestId, tokenHash, requestTokenHash, deviceHash,
          createdAt, expiresAt, status: 'pending',
        });
        await this.scheduleCleanup(expiresAt);
        return json({ stored: true }, 201);
      }

      if (pathname === '/access-requests/status') {
        const timestamp = Number.isSafeInteger(input?.timestamp) && input.timestamp > 0 ? input.timestamp : 0;
        const requestTokenHash = typeof input?.requestTokenHash === 'string'
          ? input.requestTokenHash.toLowerCase()
          : '';
        const record = await this.storage.get(key);
        const statusExpiry = record?.status === 'approved' ? record.statusExpiresAt : record?.expiresAt;
        const available = Boolean(
          timestamp && /^[a-f0-9]{64}$/.test(requestTokenHash) && record
          && record.requestTokenHash === requestTokenHash
          && (record.status === 'pending' || record.status === 'approved')
          && statusExpiry > timestamp,
        );
        return json({ available, ...(available ? { status: record.status } : {}) });
      }

      if (pathname === '/access-requests/check') {
        const timestamp = Number.isSafeInteger(input?.timestamp) && input.timestamp > 0 ? input.timestamp : 0;
        const record = await this.storage.get(key);
        const available = Boolean(
          timestamp && record && record.tokenHash === tokenHash
          && record.status === 'pending' && record.expiresAt > timestamp,
        );
        return json({ available });
      }

      if (pathname === '/access-requests/claim') {
        const timestamp = Number.isSafeInteger(input?.timestamp) && input.timestamp > 0 ? input.timestamp : 0;
        const result = await this.storage.transaction(async (transaction) => {
          const record = await transaction.get(key);
          if (!timestamp || !record || record.tokenHash !== tokenHash
              || record.status !== 'pending' || record.expiresAt <= timestamp) {
            return { available: false };
          }
          await transaction.put(key, { ...record, status: 'processing' });
          return { available: true, deviceHash: record.deviceHash };
        });
        return json(result);
      }

      if (pathname === '/access-requests/release') {
        const released = await this.storage.transaction(async (transaction) => {
          const record = await transaction.get(key);
          if (!record || record.tokenHash !== tokenHash || record.status !== 'processing') return false;
          await transaction.put(key, { ...record, status: 'pending' });
          return true;
        });
        return json({ released });
      }

      if (pathname === '/access-requests/complete') {
        const timestamp = Number.isSafeInteger(input?.timestamp) && input.timestamp > 0 ? input.timestamp : 0;
        const statusExpiresAt = timestamp + 30 * 24 * 60 * 60 * 1000;
        const completed = await this.storage.transaction(async (transaction) => {
          const record = await transaction.get(key);
          if (!timestamp || !record || record.tokenHash !== tokenHash || record.status !== 'processing') {
            return false;
          }
          await transaction.put(key, {
            requestId,
            requestTokenHash: record.requestTokenHash,
            deviceHash: record.deviceHash,
            status: 'approved',
            statusExpiresAt,
          });
          return true;
        });
        if (completed) await this.scheduleCleanup(statusExpiresAt);
        return json({ completed });
      }

      if (pathname === '/access-requests/delete') {
        const record = await this.storage.get(key);
        if (!record || record.tokenHash !== tokenHash) return json({ deleted: false });
        await this.storage.delete(key);
        return json({ deleted: true });
      }
    }

    if (pathname === '/access-requests/reserve') {
      const emailHash = typeof input?.emailHash === 'string' ? input.emailHash.toLowerCase() : '';
      const ipHash = typeof input?.ipHash === 'string' ? input.ipHash.toLowerCase() : '';
      const timestamp = Number.isSafeInteger(input?.timestamp) && input.timestamp > 0 ? input.timestamp : 0;
      if (!/^[a-f0-9]{64}$/.test(emailHash) || !/^[a-f0-9]{64}$/.test(ipHash) || !timestamp) {
        return json({ error: 'Invalid access request reservation.' }, 400);
      }
      const windowStart = timestamp - 24 * 60 * 60 * 1000;
      const result = await this.storage.transaction(async (transaction) => {
        const emailKey = `access-email:${emailHash}`;
        const ipKey = `access-ip:${ipHash}`;
        const emailUses = (await transaction.get(emailKey) || []).filter((usedAt) => usedAt > windowStart);
        const ipUses = (await transaction.get(ipKey) || []).filter((usedAt) => usedAt > windowStart);
        if (emailUses.length >= 1 || ipUses.length >= 5) return { allowed: false };
        await transaction.put({
          [emailKey]: [...emailUses, timestamp],
          [ipKey]: [...ipUses, timestamp],
        });
        return { allowed: true };
      });
      return json(result);
    }

    if (pathname !== '/reserve') return json({ error: 'Not found.' }, 404);
    const day = typeof input?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : '';
    const timestamp = Number.isSafeInteger(input?.timestamp) && input.timestamp > 0 ? input.timestamp : 0;
    const inviteHash = typeof input?.inviteHash === 'string' ? input.inviteHash.trim().slice(0, 128) : '';
    const inviteLimit = positiveInteger(input?.inviteLimit);
    const inviteWindowMs = positiveInteger(input?.inviteWindowMs);
    const anonymous = input?.anonymous === true;
    const unlimited = input?.unlimited === true && !anonymous;
    const budgetMicroUsd = positiveInteger(input?.budgetMicroUsd);
    const requestCostMicroUsd = positiveInteger(input?.requestCostMicroUsd);
    if (!day || !timestamp || !inviteHash || !inviteLimit || !inviteWindowMs || !budgetMicroUsd || !requestCostMicroUsd) {
      return json({ error: 'Invalid reservation.' }, 400);
    }

    const result = await this.storage.transaction(async (transaction) => {
      const inviteKey = `invite:${inviteHash}`;
      const anonymousKey = `anonymous:${inviteHash}`;
      const budgetKey = `${day}:budget`;
      const alertKey = `${day}:budget-alerted`;
      const recent = anonymous || unlimited
        ? []
        : (await transaction.get(inviteKey) || [])
            .filter((usedAt) => Number.isSafeInteger(usedAt) && usedAt > timestamp - inviteWindowMs);
      const anonymousUsed = anonymous ? Number(await transaction.get(anonymousKey)) || 0 : 0;
      const budgetUsed = Number(await transaction.get(budgetKey)) || 0;
      if (anonymous && anonymousUsed >= inviteLimit) {
        return { allowed: false, reason: 'anonymous_limit', shouldAlert: false };
      }
      if (!anonymous && !unlimited && recent.length >= inviteLimit) {
        return { allowed: false, reason: 'invite_limit', shouldAlert: false };
      }
      if (budgetUsed + requestCostMicroUsd > budgetMicroUsd) {
        const alreadyAlerted = await transaction.get(alertKey) === true;
        if (!alreadyAlerted) await transaction.put({ [alertKey]: true });
        return { allowed: false, reason: 'daily_budget', shouldAlert: !alreadyAlerted };
      }
      await transaction.put({
        ...(anonymous
          ? { [anonymousKey]: anonymousUsed + 1 }
          : unlimited
            ? {}
            : { [inviteKey]: [...recent, timestamp] }),
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

function approvalConfirmationPage(requestUrl) {
  const action = escapeHtml(requestUrl);
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Approve ClutterCash access</title></head><body><main><h1>Approve beta access?</h1><p>This will activate continued access in the browser that submitted the request.</p><form method="post" action="${action}"><button type="submit">Activate access</button></form><p><small>No access code or private token will be posted to Discord.</small></p></main></body></html>`, 200);
}

function approvalPage(title, message, status) {
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`, status);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function sendOperationalAlert(event, env) {
  if (!env.ALERT_WEBHOOK_URL) return false;
  let url;
  try {
    url = new URL(env.ALERT_WEBHOOK_URL);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const content = event.event === 'beta_access_requested'
    ? [
        '📬 **ClutterCash beta access request**',
        `Request ID: ${event.requestId}`,
        `Email: ${event.email}`,
        event.name ? `Name: ${event.name}` : null,
        event.device ? `Device: ${event.device}` : null,
        `Approve from your phone: ${event.approvalUrl}`,
        'The link opens a confirmation page; approval is not automatic on first tap.',
      ].filter(Boolean).join('\n')
    : `ClutterCash Worker alert: ${event.event}${Number.isInteger(event.status) ? ` (status ${event.status})` : ''}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function corsHeaders(origin, allowedOrigin) {
  if (!origin) return {};
  const allowed = new Set([allowedOrigin, 'http://localhost:4173', 'http://127.0.0.1:4173'].filter(Boolean));
  if (!allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, ${INVITE_HEADER}, ${DEVICE_HEADER}, ${REQUEST_HEADER}`,
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
