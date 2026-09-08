const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_SCANS_PER_WINDOW = 10;

const prompt = `Analyze this staged, non-sensitive household clutter photo for decluttering triage. Identify up to 12 clearly visible objects that may be sold, bundled, donated, recycled, or kept. Be conservative. Resale values are broad US-dollar hypotheses, not live marketplace data or appraisals. Never infer a luxury brand, authenticity, exact model, material, dimensions, condition, or included accessories unless visible. High-value or uncertain objects must tell the user what label/model/condition photo to add. Recommend donate or bundle where sale effort likely exceeds value. For each item, create: (1) a concise searchQuery for finding truly comparable listings, excluding facts that are not visible; (2) an editable listingTitle no longer than 80 characters; (3) a short listingDescription that says what is visible and explicitly tells the seller to confirm unknown condition, model, damage, measurements, and accessories rather than inventing them; (4) a marketplace recommendation chosen from ebay, facebookMarketplace, mercari, localPickup, consignment, or donate with a reason; and (5) missingDetails the seller must confirm before posting. Do not claim that any live listings or completed sales were researched. Bounding boxes use normalized 0..1 coordinates. Return only the requested JSON schema.`;

const responseSchema = {
  type: 'object',
  required: ['sceneSummary', 'items'],
  properties: {
    sceneSummary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'category', 'lowValue', 'typicalValue', 'highValue', 'confidence', 'effort', 'route', 'reason', 'listingTitle', 'listingDescription', 'searchQuery', 'marketplace', 'marketplaceReason', 'missingDetails', 'box'],
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
          listingTitle: { type: 'string' },
          listingDescription: { type: 'string' },
          searchQuery: { type: 'string' },
          marketplace: { type: 'string', enum: ['ebay', 'facebookMarketplace', 'mercari', 'localPickup', 'consignment', 'donate'] },
          marketplaceReason: { type: 'string' },
          missingDetails: { type: 'array', items: { type: 'string' } },
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

const identityPrompt = `Read this close-up product label for an already identified household item. Use only visible manufacturer and model information to refine the identity. Model numbers and part numbers are useful. A serial number is a unique identifier: never return the serial number or copy it into the name, search query, listing, reason, or missing details. Return only serialDetected=true when one is visible. Do not claim to have searched the web or verified authenticity, ownership, warranty, recall status, or market prices. Create an exactName, focused marketplace searchQuery, editable listing title and description, marketplace recommendation, and remaining details to confirm. Unknown values must be empty strings or explicit checklist items, never guesses. Return only the requested JSON schema.`;

const identitySchema = {
  type: 'object',
  required: ['exactName', 'manufacturer', 'model', 'confidence', 'serialDetected', 'searchQuery', 'listingTitle', 'listingDescription', 'marketplace', 'marketplaceReason', 'missingDetails'],
  properties: {
    exactName: { type: 'string' },
    manufacturer: { type: 'string' },
    model: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    serialDetected: { type: 'boolean' },
    searchQuery: { type: 'string' },
    listingTitle: { type: 'string' },
    listingDescription: { type: 'string' },
    marketplace: { type: 'string', enum: ['ebay', 'facebookMarketplace', 'mercari', 'localPickup', 'consignment', 'donate'] },
    marketplaceReason: { type: 'string' },
    missingDetails: { type: 'array', items: { type: 'string' } },
  },
};

export function createHandler({ fetcher = fetch, now = () => Date.now() } = {}) {
  const usage = new Map();

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
    if (!isScan && !isIdentity) {
      return json({ error: 'Not found.' }, 404, cors);
    }
    if (!env.GEMINI_API_KEY) return json({ error: 'Live analysis is not configured.' }, 503, cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!allowRequest(usage, ip, now())) {
      return json({ error: 'Free beta scan limit reached. Try again later.' }, 429, cors);
    }

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
      if (!providerResponse.ok) throw new Error(`Gemini returned ${providerResponse.status}`);
      const providerBody = await providerResponse.json();
      const text = providerBody?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned no structured content');
      return json(validate(JSON.parse(text)), 200, cors);
    } catch (error) {
      console.error(isIdentity ? 'identity_failed' : 'scan_failed', error instanceof Error ? error.message : 'unknown');
      return json({ error: isIdentity
        ? 'The label could not be analyzed. Please try another close photo.'
        : 'The scan could not be completed. Please try again.' }, 502, cors);
    }
  };
}

function allowRequest(usage, ip, timestamp) {
  const current = usage.get(ip);
  if (!current || timestamp - current.startedAt >= WINDOW_MS) {
    usage.set(ip, { startedAt: timestamp, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_SCANS_PER_WINDOW;
}

function corsHeaders(origin, allowedOrigin) {
  if (!origin) return {};
  const allowed = new Set([allowedOrigin, 'http://localhost:4173', 'http://127.0.0.1:4173'].filter(Boolean));
  if (!allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
      listingTitle: String(item.listingTitle || `${item.name} — details to confirm`).slice(0, 80),
      listingDescription: String(item.listingDescription || `${item.name}. Confirm the exact model, condition, damage, and included accessories before posting.`).slice(0, 700),
      searchQuery: String(item.searchQuery || item.name).slice(0, 120),
      marketplace: marketplaces.has(item.marketplace) ? item.marketplace : 'localPickup',
      marketplaceReason: String(item.marketplaceReason || '').slice(0, 240),
      missingDetails: Array.isArray(item.missingDetails)
        ? item.missingDetails.map((detail) => String(detail).slice(0, 80)).filter(Boolean).slice(0, 6)
        : [],
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
    listingTitle: String(value.listingTitle || `${value.exactName} — details to confirm`).slice(0, 80),
    listingDescription: String(value.listingDescription || `${value.exactName}. Confirm condition, damage, and included accessories before posting.`).slice(0, 700),
    marketplace: marketplaces.has(value.marketplace) ? value.marketplace : 'localPickup',
    marketplaceReason: String(value.marketplaceReason || '').slice(0, 240),
    missingDetails: Array.isArray(value.missingDetails)
      ? value.missingDetails.map((detail) => String(detail).slice(0, 80)).filter(Boolean).slice(0, 6)
      : [],
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
