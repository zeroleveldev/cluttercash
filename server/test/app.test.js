import assert from 'node:assert/strict';
import { test } from 'node:test';

for (const ids of [['same', 'same'], ['item-2', undefined], ['x'.repeat(129), 'ok'], ['', 'ok']]) {
  test(`CC-05 rejects invalid or colliding IDs ${JSON.stringify(ids)}`, async () => {
    const scan = {sceneSummary:'Shelf',items:ids.map(id=>({id,name:'Lamp',lowValue:10,typicalValue:10,highValue:10}))};
    const running = await listen(createApp({analyzer:{analyze:async()=>scan}}));
    try {
      const form = new FormData();
      form.append('image',new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'}),'room.jpg');
      const response = await fetch(`${running.base}/v1/scans`,{method:'POST',body:form});
      assert.equal(response.status,502);
    } finally { await running.close(); }
  });
}

import { createApp } from '../src/app.js';
test('CC-12 valid empty scene succeeds',async()=>{
 const expected={sceneSummary:'Empty shelf',items:[]};let calls=0;
 const running=await listen(createApp({analyzer:{analyze:async()=>{calls++;return expected;}}}));
 try {const form=new FormData();form.set('image',new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'}),'room.jpg');
 const response=await fetch(`${running.base}/v1/scans`,{method:'POST',body:form});assert.equal(response.status,200);assert.deepEqual(await response.json(),expected);assert.equal(calls,1);
 }finally{await running.close();}
});
for(const [mime,bytes,valid] of [['image/jpeg',[255,216,255],true],['image/png',[137,80,78,71,13,10,26,10],true],['image/webp',[82,73,70,70,0,0,0,0,87,69,66,80],true],['image/jpeg',[65],false],['image/jpeg',[255,216],false],['image/png',[137,80,78,71],false],['image/webp',[82,73,70,70],false],['image/png',[255,216,255],false],['image/jpeg',[137,80,78,71,13,10,26,10],false],['image/webp',[255,216,255],false]]) test(`CC-19 local ${mime} ${bytes} valid=${valid}`,async()=>{
 let calls=0;const running=await listen(createApp({analyzer:{analyze:async input=>{calls++;assert.deepEqual(input,{bytes:Buffer.from(bytes),mimeType:mime});return {sceneSummary:'Shelf',items:[{name:'Lamp',lowValue:1,typicalValue:1,highValue:1}]};}}}));
 try {const form=new FormData();form.set('image',new Blob([new Uint8Array(bytes)],{type:mime}),'../../private.jpg');const response=await fetch(`${running.base}/v1/scans`,{method:'POST',body:form});assert.equal(response.status,valid?200:400);assert.equal(calls,valid?1:0);}finally{await running.close();}
});

import { createOpenAiAnalyzer } from '../src/openai-analyzer.js';
for (const phase of ['headers', 'body']) test(`CC-11 legacy aborts stalled ${phase} without retry`, async () => {
  let signal; let calls = 0;
  const analyzer = createOpenAiAnalyzer({apiKey:'synthetic', providerTimeoutMs:20, fetcher:async (_url, init)=>{
    calls++; signal=init.signal;
    if(phase==='headers') return new Promise(()=>{});
    return new Response(new ReadableStream({start(c){signal?.addEventListener('abort',()=>c.error(new Error('aborted')),{once:true});}}));
  }});
  const result=await Promise.race([
    analyzer.analyze({bytes:Buffer.from('x'),mimeType:'image/jpeg'}).then(()=> 'success',()=> 'rejected'),
    new Promise(resolve=>setTimeout(()=>resolve('hung'),150)),
  ]);
  assert.equal(result,'rejected'); assert.equal(signal.aborted,true); assert.equal(calls,1);
});

import http from 'node:http';

for (const failure of ['model', 'body', 'transport']) {
  test(`CC-08 ${failure} never logs or returns private exception content`, async () => {
    const privateText = 'PRIVATE-SYNTHETIC-photo-address';
    const logs = []; const original = console.error;
    console.error = (...args) => logs.push(args);
    const analyzer = createOpenAiAnalyzer({apiKey:'synthetic', fetcher:async () => {
      if (failure === 'transport') throw new Error(privateText);
      if (failure === 'body') return new Response(privateText);
      return Response.json({choices:[{message:{content:privateText}}]});
    }});
    const running = await listen(createApp({analyzer}));
    try {
      const form = new FormData();
      form.append('image', new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'}), 'room.jpg');
      const response = await fetch(`${running.base}/v1/scans`,{method:'POST',body:form});
      assert.equal(response.status,502);
      assert.equal(JSON.stringify([logs, await response.text()]).includes('PRIVATE'),false);
      assert.deepEqual(logs,[['scan_error']]);
    } finally { console.error = original; await running.close(); }
  });
}

test('CC-09 rejects foreign browser origins and nonlocal Host before analyzer', async () => {
  let calls = 0;
  const running = await listen(createApp({analyzer:{analyze:async()=>{calls++;}}}));
  try {
    for (const headers of [{Origin:'https://attacker.invalid'}, {Host:'attacker.invalid'}]) {
      // Node fetch drops custom Host; raw HTTP proves the actual wire boundary.
      const response = await new Promise((resolve, reject) => {
        const request = http.request(`${running.base}/v1/scans`, {method:'POST', headers}, resolve);
        request.on('error', reject);
        request.end();
      });
      response.resume();
      assert.equal(response.statusCode,403);
      assert.equal(response.headers['access-control-allow-origin'],undefined);
    }
    assert.equal(calls,0);
  } finally { await running.close(); }
});



for (const value of [1e308, 1000001, -1, NaN, Infinity, null, '10']) {
  test(`CC-03 rejects unsupported analyzer price ${value}`, async () => {
    const running = await listen(createApp({analyzer:{analyze:async()=>({sceneSummary:'Shelf',items:[{name:'Lamp',lowValue:value,typicalValue:value,highValue:value}]})}}));
    try {
      const form = new FormData();
      form.append('image',new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'}),'room.jpg');
      const response = await fetch(`${running.base}/v1/scans`,{method:'POST',body:form});
      assert.equal(response.status,502);
    } finally { await running.close(); }
  });
}

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
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
    assert.deepEqual(bytes, Buffer.from([255,216,255]));
    assert.equal(mimeType, 'image/jpeg');
    return expected;
  }};
  const app = createApp({ analyzer });
  const running = await listen(app);
  try {
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array([255,216,255])], { type: 'image/jpeg' }), 'room.jpg');
    const response = await fetch(`${running.base}/v1/scans`, { method: 'POST', body: form });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
  } finally {
    await running.close();
  }
});
