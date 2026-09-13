import cors from 'cors';
import express from 'express';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, done) => done(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && !url.username && !url.password;
  } catch { return false; }
}

export function createApp({ analyzer } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Local development only; do not trust forwarded headers or expose via proxy.
  app.use((request, response, next) => {
    if (!isLocalUrl(`http://${request.headers.host}`)
      || (request.headers.origin && !isLocalUrl(request.headers.origin))) {
      return response.status(403).json({ error: 'Local development only.' });
    }
    next();
  });
  app.use(cors({ origin: true }));
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/health', (_request, response) => {
    response.json({ ok: true, analysisReady: Boolean(analyzer) });
  });

  app.post('/v1/scans', upload.single('image'), async (request, response, next) => {
    try {
      if (!request.file) return response.status(400).json({ error: 'A JPEG, PNG, or WebP image is required.' });
      if (imageMime(request.file.buffer) !== request.file.mimetype) return response.status(400).json({ error: 'Image bytes must match JPEG, PNG, or WebP format.' });
      if (!analyzer) return response.status(503).json({ error: 'Live analysis is not configured.' });
      const result = await analyzer.analyze({ bytes: request.file.buffer, mimeType: request.file.mimetype });
      response.json(validateScan(result));
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error: 'Image must be 8 MB or smaller.' });
    console.error('scan_error');
    return response.status(502).json({ error: 'The scan could not be completed. Try another photo.' });
  });
  return app;
}

// Header identification only, not a full decoder or safety guarantee.
function imageMime(bytes) {
  const starts = signature => bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  if (starts([255, 216, 255])) return 'image/jpeg';
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (bytes.length >= 12 && starts([82, 73, 70, 70])
    && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)) return 'image/webp';
  return null;
}

function validateScan(value) {
  if (!value || typeof value.sceneSummary !== 'string' || !Array.isArray(value.items)) throw new Error('Invalid analyzer response');
  const routes = new Set(['sell', 'bundle', 'donate', 'recycle', 'keep']);
  const levels = new Set(['low', 'medium', 'high']);
  const ids = new Set();
  const items = value.items.slice(0, 20).map((item, index) => {
    if (!item || typeof item.name !== 'string') throw new Error('Invalid analyzer item');
    const id = item.id ?? `item-${index + 1}`;
    if (typeof id !== 'string' || !id.trim() || id.length > 128 || ids.has(id)) {
      throw new Error('Invalid or duplicate item ID');
    }
    ids.add(id);
    const low = price(item.lowValue);
    const typical = price(item.typicalValue);
    const high = price(item.highValue);
    if (low > typical || typical > high) throw new Error('Invalid potential value range');
    return {
      id,
      name: item.name.slice(0, 100),
      category: String(item.category || 'Other').slice(0, 40),
      lowValue: Math.min(low, typical, high),
      typicalValue: typical,
      highValue: Math.max(low, typical, high),
      confidence: levels.has(item.confidence) ? item.confidence : 'low',
      effort: levels.has(item.effort) ? item.effort : 'medium',
      route: routes.has(item.route) ? item.route : 'keep',
      reason: String(item.reason || '').slice(0, 240),
      box: {
        left: clamp(item.box?.left), top: clamp(item.box?.top),
        width: clamp(item.box?.width), height: clamp(item.box?.height),
      },
    };
  });
  return { sceneSummary: value.sceneSummary.slice(0, 160), items };
}

function price(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000) {
    throw new Error('Unsupported potential value');
  }
  return value;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}
function clamp(value) { return Math.max(0, Math.min(1, finite(value))); }
