import 'dotenv/config';
import { createApp } from './app.js';
import { createOpenAiAnalyzer } from './openai-analyzer.js';

// This legacy unmetered analyzer is not a deployable alternate backend.
// Refuse release mode and every non-loopback bind request, even with a key.
const host = process.env.HOST || '127.0.0.1';
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', '::1'].includes(host)) {
  console.error('Legacy API is local development only; use the protected Worker for deployment.');
  process.exit(1);
}
const port = Number(process.env.PORT || 8787);
const analyzer = createOpenAiAnalyzer({ apiKey: process.env.OPENAI_API_KEY });
const app = createApp({ analyzer });
app.listen(port, host, () => {
  console.log(`ClutterCash API listening on http://${host === '::1' ? '[::1]' : host}:${port}`);
  console.log(analyzer ? 'Live image analysis is ready.' : 'OPENAI_API_KEY is absent; health works but scans return 503.');
});
