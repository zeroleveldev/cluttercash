const prompt = `Analyze this household clutter photo for decluttering triage. Identify up to 12 clearly visible, plausibly sellable objects. Be conservative. Values are approximate US resale ranges, never appraisals. Do not infer luxury brands, authenticity, model numbers, materials, dimensions, or condition you cannot see. Rank routes by expected net proceeds and effort. Recommend donate/recycle/bundle when sale effort likely exceeds value. Bounding boxes use normalized 0..1 coordinates. Return JSON only.`;

const schema = {
  name: 'clutter_scan', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['sceneSummary', 'items'],
    properties: {
      sceneSummary: { type: 'string' },
      items: { type: 'array', maxItems: 20, items: {
        type: 'object', additionalProperties: false,
        required: ['id','name','category','lowValue','typicalValue','highValue','confidence','effort','route','reason','box'],
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, category: { type: 'string' },
          lowValue: { type: 'number' }, typicalValue: { type: 'number' }, highValue: { type: 'number' },
          confidence: { type: 'string', enum: ['low','medium','high'] },
          effort: { type: 'string', enum: ['low','medium','high'] },
          route: { type: 'string', enum: ['sell','bundle','donate','recycle','keep'] },
          reason: { type: 'string' },
          box: { type: 'object', additionalProperties: false, required: ['left','top','width','height'], properties: {
            left: { type: 'number' }, top: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' },
          }},
        },
      }},
    },
  },
};

export function createOpenAiAnalyzer({
  apiKey,
  model = process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  fetcher = fetch,
} = {}) {
  if (!apiKey) return null;
  return {
    async analyze({ bytes, mimeType }) {
      const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_schema', json_schema: schema },
          messages: [{ role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${bytes.toString('base64')}`, detail: 'high' } },
          ]}],
        }),
      });
      if (!response.ok) throw new Error(`Provider returned ${response.status}`);
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Provider returned no content');
      return JSON.parse(content);
    },
  };
}
