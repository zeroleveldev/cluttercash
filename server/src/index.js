import 'dotenv/config';
import { createApp } from './app.js';
import { createOpenAiAnalyzer } from './openai-analyzer.js';

const port = Number(process.env.PORT || 8787);
const analyzer = createOpenAiAnalyzer({ apiKey: process.env.OPENAI_API_KEY });
const app = createApp({ analyzer });
app.listen(port, '0.0.0.0', () => {
  console.log(`ClutterCash API listening on http://0.0.0.0:${port}`);
  console.log(analyzer ? 'Live image analysis is ready.' : 'OPENAI_API_KEY is absent; health works but scans return 503.');
});
