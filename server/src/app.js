import cors from 'cors';
import express from 'express';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, done) => done(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

export function createApp({ analyzer, allowedOrigin = process.env.ALLOWED_ORIGIN || true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: allowedOrigin }));
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
      if (!analyzer) return response.status(503).json({ error: 'Live analysis is not configured.' });
      const result = await analyzer.analyze({ bytes: request.file.buffer, mimeType: request.file.mimetype });
      response.json(validateScan(result));
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error: 'Image must be 8 MB or smaller.' });
    console.error('scan_error', error instanceof Error ? error.message : 'unknown');
    return response.status(502).json({ error: 'The scan could not be completed. Try another photo.' });
  });
  return app;
}

function validateScan(value) {
  if (!value || typeof value.sceneSummary !== 'string' || !Array.isArray(value.items)) throw new Error('Invalid analyzer response');
  const routes = new Set(['sell', 'bundle', 'donate', 'recycle', 'keep']);
  const levels = new Set(['low', 'medium', 'high']);
  const items = value.items.slice(0, 20).map((item, index) => {
    if (!item || typeof item.name !== 'string') throw new Error('Invalid analyzer item');
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
      box: {
        left: clamp(item.box?.left), top: clamp(item.box?.top),
        width: clamp(item.box?.width), height: clamp(item.box?.height),
      },
    };
  });
  if (items.length === 0) throw new Error('Analyzer returned no items');
  return { sceneSummary: value.sceneSummary.slice(0, 160), items };
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}
function clamp(value) { return Math.max(0, Math.min(1, finite(value))); }
