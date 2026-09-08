import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

async function listen(app) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('health reveals readiness without leaking credentials', async () => {
  const app = createApp({ analyzer: null });
  const running = await listen(app);
  try {
    const response = await fetch(`${running.base}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, analysisReady: false });
    assert.equal(JSON.stringify(body).includes('key'), false);
  } finally {
    await running.close();
  }
});

test('scan rejects missing image before analyzer invocation', async () => {
  let calls = 0;
  const app = createApp({ analyzer: { analyze: async () => { calls += 1; } } });
  const running = await listen(app);
  try {
    const response = await fetch(`${running.base}/v1/scans`, { method: 'POST' });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    await running.close();
  }
});

test('scan returns the strict item contract from an injected analyzer', async () => {
  const expected = {
    sceneSummary: 'Garage shelf',
    items: [{
      id: 'camera', name: 'Film camera', category: 'Cameras', lowValue: 80,
      typicalValue: 110, highValue: 150, confidence: 'medium', effort: 'medium',
      route: 'sell', reason: 'Check the model number', box: { left: .1, top: .1, width: .3, height: .3 },
    }],
  };
  const analyzer = { analyze: async ({ bytes, mimeType }) => {
    assert.equal(bytes.toString(), 'fake-jpeg');
    assert.equal(mimeType, 'image/jpeg');
    return expected;
  }};
  const app = createApp({ analyzer });
  const running = await listen(app);
  try {
    const form = new FormData();
    form.append('image', new Blob(['fake-jpeg'], { type: 'image/jpeg' }), 'room.jpg');
    const response = await fetch(`${running.base}/v1/scans`, { method: 'POST', body: form });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
  } finally {
    await running.close();
  }
});
