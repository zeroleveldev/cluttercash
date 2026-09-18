import assert from 'node:assert/strict';
import { test } from 'node:test';

function openAIResponse(value, overrides = {}) {
  return {
    id: 'resp_test_123',
    status: 'completed',
    output: [{type:'message', content:[{type:'output_text', text:JSON.stringify(value)}]}],
    usage: {
      input_tokens: 100,
      input_tokens_details: {cached_tokens: 20},
      output_tokens: 50,
      output_tokens_details: {reasoning_tokens: 10},
    },
    ...overrides,
  };
}

function providerResponse(value, overrides = {}) {
  return Response.json(openAIResponse(value, overrides));
}

function assertClosedSchema(value) {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'object') assert.equal(value.additionalProperties, false);
  for (const child of Object.values(value)) assertClosedSchema(child);
}

for (const ids of [['same', 'same'], ['item-2', undefined], ['x'.repeat(129), 'ok'], ['', 'ok']]) {
  test(`CC-05 rejects invalid or colliding IDs ${JSON.stringify(ids)}`, async () => {
    const scan = {sceneSummary:'Shelf',items:ids.map(id=>({id,name:'Lamp',lowValue:10,typicalValue:10,highValue:10}))};
    const fetcher = async () => providerResponse(scan);
    const response = await createHandler({fetcher})(imageRequest(), env);
    assert.equal(response.status,502);
  });
}

import { BetaUsageLimiter, createHandler } from '../src/worker.js';


test('CC-15 anonymous telemetry has a rotation-proof independent bounded minute pool',async()=>{
 const local=memoryDurableEnv();let timestamp=1800000000000;let events=0;
 const handler=createHandler({now:()=>timestamp,telemetrySender:async()=>{events++;}});
 const send=(i)=>{const req=telemetryRequest({event:'project_created'});req.headers.delete('X-ClutterCash-Invite');req.headers.set('X-ClutterCash-Device',String(i).padStart(64,'0'));return handler(req,local);};
 const results=await Promise.all(Array.from({length:130},(_,i)=>send(i)));
 assert.equal(results.filter(r=>r.status===202).length,120);
 assert.equal(results.filter(r=>r.status===429).length,10);assert.equal(events,120);
 assert.equal((await handler(telemetryRequest({event:'project_created'}),local)).status,202,'anonymous pool does not starve approved telemetry');
 timestamp+=60000;assert.equal((await send(0)).status,202);
 const analysis=createHandler({now:()=>timestamp,fetcher:quotaProvider});
 for(let i=0;i<3;i++) assert.equal((await analysis(anonymousRequest('0'.repeat(64)),local)).status,200,'telemetry consumes no free analyses');
 assert.equal((await analysis(anonymousRequest('0'.repeat(64)),local)).status,429);
});
test('CC-15 all telemetry is capped and storage contains no per-user telemetry identifiers',async()=>{
 const values=new Map();const storage={get:async k=>values.get(k),put:async obj=>{for(const [k,v] of Object.entries(obj))values.set(k,v);},transaction:async cb=>cb(storage)};
 const limiter=new BetaUsageLimiter({storage});
 const reserve=timestamp=>limiter.fetch(new Request('https://usage.internal/telemetry/reserve',{method:'POST',body:JSON.stringify({timestamp,anonymous:false})}));
 for(let i=0;i<600;i++) assert.equal((await (await reserve(1800000000000)).json()).allowed,true);
 assert.equal((await (await reserve(1800000000000)).json()).allowed,false);
 assert.equal((await (await reserve(1800000060000)).json()).allowed,true);
 assert.deepEqual([...values.keys()],['telemetry:minute']);
 assert.deepEqual(values.get('telemetry:minute'),{minute:30000001,total:1,anonymous:0});
});

function revokeRequest(inviteHash, key = env.ADMIN_API_KEY) {
  return new Request('https://api.example/v1/admin/invites/revoke', {method:'POST',
    headers:{'Content-Type':'application/json', Authorization:`Bearer ${key}`},
    body:JSON.stringify({inviteHash})});
}
for (const device of [false,true]) test(`CC-14 revoked registered ${device?'device':'invite'} stops all protected routes`,async()=>{
  const local=memoryDurableEnv();const token='b'.repeat(64);const hash=await testSha256Hex(token);
  const stub=local.BETA_USAGE_LIMITER.get('global');
  const register=()=>stub.fetch(new Request('https://usage.internal/invites/register',{method:'POST',body:JSON.stringify({inviteHash:hash,createdAt:Date.now()})}));
  assert.equal((await register()).status,201);
  const handler=createHandler({fetcher:quotaProvider,telemetrySender:async()=>{}});
  const request=(route)=>{const req=route==='scans'?imageRequest():route==='identity'?labelRequest():telemetryRequest({event:'project_created'});req.headers.delete('X-ClutterCash-Invite');req.headers.set(device?'X-ClutterCash-Device':'X-ClutterCash-Invite',token);return req;};
  assert.equal((await handler(request('telemetry'),local)).status,202);
  assert.equal((await handler(revokeRequest(hash,'wrong'),local)).status,401);
  assert.equal((await handler(request('telemetry'),local)).status,202);
  assert.equal((await handler(revokeRequest(hash),local)).status,200);
  for(const route of ['scans','identity','telemetry']) assert.equal((await handler(request(route),local)).status,401);
  assert.equal((await register()).status,409,'old approval must not restore revoked credential');
  assert.equal((await handler(revokeRequest(hash),local)).status,200,'idempotent');
  assert.equal((await handler(telemetryRequest({event:'project_created'}),local)).status,202,'other credentials survive');
});
test('CC-14 static and owner hashes require explicit removal before durable revocation',async()=>{
 const local=memoryDurableEnv(); const handler=createHandler();const hash=await testSha256Hex('test-invite');
 assert.equal((await handler(revokeRequest(hash),local)).status,409);
 const ownerHash='a'.repeat(64);
 assert.equal((await handler(revokeRequest(ownerHash),{...local,BETA_OWNER_INVITE_CODE_HASHES:JSON.stringify([ownerHash])})).status,409);
 for(const invalid of ['A'.repeat(64),' '+ownerHash,123,null]) assert.equal((await handler(revokeRequest(invalid),local)).status,400);
 assert.equal((await handler(revokeRequest(ownerHash),{...local,BETA_USAGE_LIMITER:undefined})).status,503);
});

test('CC-12 valid empty scene succeeds after one provider attempt', async () => {
  let calls=0;
  const expected={sceneSummary:'Empty shelf',items:[]};
  const response=await createHandler({fetcher:async()=>{calls++;return providerResponse(expected);}})(imageRequest(),env);
  assert.equal(response.status,200); assert.deepEqual(await response.json(),expected); assert.equal(calls,1);
});
for (const route of ['scans','items/identify']) for (const [mime,bytes,valid] of [
 ['image/jpeg',[255,216,255],true],['image/png',[137,80,78,71,13,10,26,10],true],
 ['image/webp',[82,73,70,70,0,0,0,0,87,69,66,80],true],
 ['image/jpeg',[65,66,67],false],['image/jpeg',[255,216],false],
 ['image/png',[137,80,78,71],false],['image/webp',[82,73,70,70,0,0,0,0,0,0,0,0],false],
 ['image/jpeg',[137,80,78,71,13,10,26,10],false],
 ['image/png',[255,216,255],false],['image/webp',[255,216,255],false],
]) test(`CC-19 ${route} ${mime} ${bytes} valid=${valid}`,async()=>{
 const original=route==='scans'?imageRequest():labelRequest(); const form=await original.formData();
 form.set('image',new Blob([new Uint8Array(bytes)],{type:mime}),'../../private.jpg');
 let calls=0;let quotas=0;
 const response=await createHandler({fetcher:async(_url,init)=>{calls++;const part=JSON.parse(init.body).input[0].content[1]; assert.equal(part.type,'input_image'); assert.match(part.image_url,new RegExp(`^data:${mime};base64,${Buffer.from(bytes).toString('base64')}$`)); return route==='scans'?quotaProvider():providerResponse({exactName:'Camera',confidence:'high'});}})(new Request(original.url,{method:'POST',headers: {'X-ClutterCash-Invite':'test-invite'},body:form}),{...env,BETA_USAGE_LIMITER:{idFromName:n=>n,get:()=>({fetch:async()=>{quotas++;return Response.json({allowed:true});}})}});
 assert.equal(response.status,valid?200:400);assert.equal(calls,valid?1:0);assert.equal(quotas,valid?1:0);
});

for (const route of ['scans', 'items/identify']) for (const phase of ['headers', 'body']) {
  test(`CC-11 ${route} aborts stalled ${phase} without retry`, async () => {
    let signal; let calls = 0;
    const fetcher = async (_url, init) => {
      calls++; signal = init.signal;
      if (phase === 'headers') return new Promise(() => {});
      return new Response(new ReadableStream({start(c) {
        signal?.addEventListener('abort', () => c.error(new Error('aborted')), {once:true});
      }}));
    };
    const result = await Promise.race([
      createHandler({fetcher, providerTimeoutMs:20, alertSender:async()=>{}})(route === 'scans' ? imageRequest() : labelRequest(), env),
      new Promise(resolve => setTimeout(() => resolve(null), 150)),
    ]);
    assert.ok(result, 'complete provider deadline must settle');
    assert.equal(result.status, 502);
    assert.equal(signal.aborted, true);
    assert.equal(calls, 1);
  });
}


for (const route of ['scans', 'items/identify']) test(`OPENAI-01 ${route} uses bounded GPT-5 nano Responses request`, async () => {
  let target; let headers; let payload;
  const result = route === 'scans'
    ? {sceneSummary:'Shelf',items:[]}
    : {exactName:'Canon AE-1',manufacturer:'Canon',model:'AE-1',confidence:'high',serialDetected:false,searchQuery:'Canon AE-1',marketplace:'ebay',marketplaceReason:'Exact-model buyers.'};
  const openAIEnv = {
    ...env,
    OPENAI_API_KEY: 'synthetic-openai-key',
    OPENAI_MODEL: 'gpt-5-nano',
    OPENAI_MAX_REQUEST_COST_MICRO_USD: '131072',
  };
  const response = await createHandler({fetcher:async(url, init)=>{
    target=url; headers=init.headers; payload=JSON.parse(init.body);
    return Response.json(openAIResponse(result));
  }})(route==='scans'?imageRequest():labelRequest(), openAIEnv);
  assert.equal(response.status,200);
  assert.equal(target,'https://api.openai.com/v1/responses');
  assert.equal(headers.Authorization,'Bearer synthetic-openai-key');
  assert.equal(payload.model,'gpt-5-nano');
  assert.equal(payload.store,false);
  assert.deepEqual(payload.reasoning,{effort:'low'});
  assert.equal(payload.max_output_tokens,4096);
  assert.deepEqual(payload.tools,[]);
  assert.equal(payload.input.length,1);
  assert.equal(payload.input[0].content[0].type,'input_text');
  assert.equal(payload.input[0].content[1].type,'input_image');
  assert.match(payload.input[0].content[1].image_url,/^data:image\/jpeg;base64,/);
  assert.equal(payload.text.format.type,'json_schema');
  assert.equal(payload.text.format.strict,true);
  assertClosedSchema(payload.text.format.schema);
  if (route === 'scans') assert.equal(payload.text.format.schema.properties.items.maxItems,10);
  assert.equal(payload.contents,undefined);
  assert.equal(payload.generationConfig,undefined);
});

test('OPENAI-02 emits one sanitized usage metric for a successful scan', async () => {
  const metrics=[];
  const openAIEnv={...env,OPENAI_API_KEY:'synthetic-openai-key',OPENAI_MODEL:'gpt-5-nano',OPENAI_MAX_REQUEST_COST_MICRO_USD:'131072'};
  const response=await createHandler({
    now:(()=>{let value=1000;return()=>value+=25;})(),
    providerMetricSender:async metric=>metrics.push(metric),
    fetcher:async()=>Response.json(openAIResponse({sceneSummary:'Shelf',items:[]})),
  })(imageRequest(),openAIEnv);
  assert.equal(response.status,200);
  assert.equal(metrics.length,1);
  assert.deepEqual(metrics[0],{
    event:'provider_analysis',route:'scan',provider:'openai',model:'gpt-5-nano',
    requestId:'resp_test_123',success:true,failureCategory:'none',inputTokens:100,
    cachedInputTokens:20,outputTokens:50,reasoningTokens:10,totalTokens:150,
    estimatedCostMicroUsd:25,latencyMs:25,
  });
  const serialized=JSON.stringify(metrics);
  for(const privateValue of ['synthetic-openai-key','Shelf','test-invite','data:image']) assert.equal(serialized.includes(privateValue),false);
});

test('OPENAI-03 incomplete response fails once and records a safe category', async () => {
  let calls=0;const metrics=[];
  const openAIEnv={...env,OPENAI_API_KEY:'synthetic-openai-key',OPENAI_MODEL:'gpt-5-nano',OPENAI_MAX_REQUEST_COST_MICRO_USD:'131072'};
  const response=await createHandler({alertSender:async()=>{},providerMetricSender:async metric=>metrics.push(metric),fetcher:async()=>{
    calls++;return Response.json(openAIResponse({}, {status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]}));
  }})(imageRequest(),openAIEnv);
  assert.equal(response.status,502);assert.equal(calls,1);assert.equal(metrics.length,1);
  assert.equal(metrics[0].success,false);assert.equal(metrics[0].failureCategory,'incomplete');
  assert.equal(metrics[0].requestId,'resp_test_123');
});

test('OPENAI-04 malformed structured output records a safe failure with request ID', async () => {
  const metrics=[];
  const response=await createHandler({alertSender:async()=>{},providerMetricSender:async metric=>metrics.push(metric),fetcher:async()=>providerResponse({}, {
    output:[{type:'message',content:[{type:'output_text',text:'{not-json'}]}],
  })})(imageRequest(),env);
  assert.equal(response.status,502);assert.equal(metrics.length,1);
  assert.equal(metrics[0].failureCategory,'malformed_response');
  assert.equal(metrics[0].requestId,'resp_test_123');
});

test('OPENAI-05 scan validator returns at most ten objects', async () => {
  const items=Array.from({length:11},(_,index)=>({id:`item-${index}`,name:`Item ${index}`,lowValue:1,typicalValue:2,highValue:3}));
  const response=await createHandler({fetcher:async()=>providerResponse({sceneSummary:'Shelf',items})})(imageRequest(),env);
  assert.equal(response.status,200);
  assert.equal((await response.json()).items.length,10);
});

for(const config of [{OPENAI_MODEL:undefined},{OPENAI_MAX_REQUEST_COST_MICRO_USD:'invalid'},{OPENAI_MAX_REQUEST_COST_MICRO_USD:'131072.5'},{OPENAI_MAX_REQUEST_COST_MICRO_USD:'9007199254740992'},{OPENAI_MODEL:'other-model'},{OPENAI_MAX_REQUEST_COST_MICRO_USD:'10000'},{OPENAI_MAX_REQUEST_COST_MICRO_USD:undefined},{OPENAI_MAX_REQUEST_COST_MICRO_USD:'71199'}]) test(`CC-01 unsafe cost configuration ${JSON.stringify(config)}`,async()=>{
  let calls=0; let quotas=0;
  const response=await createHandler({fetcher:async()=>{calls++;return quotaProvider();}})(imageRequest(),{...env,...config,
    BETA_USAGE_LIMITER:{idFromName:n=>n,get:()=>({fetch:async()=>{quotas++;return Response.json({allowed:true});}})},
  });
  assert.equal(response.status,503);assert.equal(calls,0);assert.equal(quotas,0);
});
test('CC-01 GPT-5 nano conservative reservation is accepted and forwarded exactly',async()=>{
  let reserved;
  const exact={...env,OPENAI_MAX_REQUEST_COST_MICRO_USD:'131072',BETA_USAGE_LIMITER:{idFromName:n=>n,get:()=>({fetch:async request=>{reserved=await request.json();return Response.json({allowed:true});}})}};
  assert.equal((await createHandler({fetcher:quotaProvider})(imageRequest(),exact)).status,200);
  assert.equal(reserved.requestCostMicroUsd,131072);
});

for (const declared of [undefined, '1', String(10 * 1024 * 1024)]) test(`CC-01 bounds streamed multipart before reservation declared=${declared}`, async () => {
  let calls = 0; let quotas = 0; let cancelled = false; let pulls = 0;
  const form = new FormData();
  form.set('image', new Blob(['small'], {type: 'image/jpeg'}), 'photo.jpg');
  form.set('betaConsent', 'true');
  form.set('extra', 'x'.repeat(9 * 1024 * 1024));
  // Serialize first: Node 24's Undici FormData producer independently throws
  // after cancellation. A controlled wire-byte stream tests Worker cancellation
  // without suppressing unhandled rejections or removing the production cancel.
  const encoded = new Response(form);
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  let offset = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls++;
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.slice(offset, offset + 65536));
      offset += 65536;
    },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://api.example/v1/scans', {
    method: 'POST', body, duplex: 'half', headers: {
      'X-ClutterCash-Invite': 'test-invite',
      'Content-Type': encoded.headers.get('Content-Type'),
      ...(declared === undefined ? {} : {'Content-Length': declared}),
    },
  });
  const response = await createHandler({fetcher: async () => { calls++; return quotaProvider(); }})(request, {
    ...env, BETA_USAGE_LIMITER: {idFromName: n => n, get: () => ({fetch: async () => {
      quotas++; return Response.json({allowed: true});
    }})},
  });
  assert.equal(response.status, 413); assert.equal(calls, 0); assert.equal(quotas, 0);
  if (declared !== String(10 * 1024 * 1024)) {
    assert.equal(cancelled, true);
    assert.ok(pulls < Math.ceil(bytes.length / 65536), 'must stop before consuming entire upload');
  }
});



for (const route of ['scans', 'items/identify']) {
  for (const failure of ['model', 'body', 'transport']) {
    test(`CC-08 ${route} ${failure} keeps private exceptions out of logs/client/alerts`, async () => {
      const privateText = 'PRIVATE-SYNTHETIC-photo-address';
      const logs = []; const alerts = [];
      const original = console.error;
      console.error = (...args) => logs.push(args);
      try {
        const fetcher = async () => {
          if (failure === 'transport') throw new Error(privateText);
          if (failure === 'body') return new Response(privateText);
          return providerResponse(privateText);
        };
        const response = await createHandler({fetcher, alertSender: async event => alerts.push(event)})(
          route === 'scans' ? imageRequest() : labelRequest(), env);
        assert.equal(response.status, 502);
        assert.equal(JSON.stringify([logs, alerts, await response.text()]).includes('PRIVATE'), false);
        assert.deepEqual(logs, [[route === 'scans' ? 'scan_failed' : 'identity_failed']]);
      } finally { console.error = original; }
    });
  }
}

for (const invalid of ['missingName', 'blankName', 'longName', 'fileName', 'longCategory', 'fileCategory', 'duplicateName', 'duplicateImage', 'duplicateConsent', 'unknown', 'scanName']) {
  test(`CC-13 rejects ${invalid} before quota/provider`, async () => {
    const scan = invalid === 'scanName';
    const form = await (scan ? imageRequest() : labelRequest()).formData();
    if (invalid === 'missingName') form.delete('itemName');
    if (invalid === 'blankName') form.set('itemName', '  ');
    if (invalid === 'longName') form.set('itemName', 'x'.repeat(101));
    if (invalid === 'fileName') form.set('itemName', new Blob(['private']));
    if (invalid === 'longCategory') form.set('category', 'x'.repeat(41));
    if (invalid === 'fileCategory') form.set('category', new Blob(['private']));
    if (invalid === 'duplicateName') form.append('itemName', 'extra');
    if (invalid === 'duplicateImage') form.append('image', new Blob(['extra'], {type:'image/jpeg'}));
    if (invalid === 'duplicateConsent') form.append('betaConsent', 'true');
    if (invalid === 'unknown') form.append('metadata', 'private');
    if (invalid === 'scanName') form.append('itemName', 'unexpected');
    let quotaCalls = 0; let providerCalls = 0;
    const guardedEnv = {...env, BETA_USAGE_LIMITER: {
      idFromName: name => name,
      get: () => ({fetch: async () => { quotaCalls++; return Response.json({allowed:true}); }}),
    }};
    const request = new Request(`https://api.example/v1/${scan ? 'scans' : 'items/identify'}`, {
      method:'POST', body:form, headers:{'X-ClutterCash-Invite':'test-invite'},
    });
    const response = await createHandler({fetcher: async () => { providerCalls++; throw new Error('unused'); }})(request, guardedEnv);
    assert.equal(quotaCalls, 0);
    assert.equal(providerCalls, 0);
    assert.equal(response.status, 400);
  });
}



for (const value of [1e308, 1000001, -1, null, 'NaN']) {
  test(`CC-03 rejects unsupported provider price ${value}`, async () => {
    const fetcher = async () => providerResponse({sceneSummary:'Shelf',items:[{name:'Lamp',lowValue:value,typicalValue:value,highValue:value}]});
    const response = await createHandler({fetcher})(imageRequest(), env);
    assert.equal(response.status,502);
  });
}

function anonymousRequest(token, ip = '203.0.113.10') {
  const request = imageRequest();
  request.headers.delete('X-ClutterCash-Invite');
  request.headers.set('X-ClutterCash-Device', token.padEnd(64, 'a'));
  if (ip) request.headers.set('CF-Connecting-IP', ip);
  else request.headers.delete('CF-Connecting-IP');
  return request;
}
const quotaProvider = async () => providerResponse({sceneSummary:'Shelf',items:[{name:'Lamp',lowValue:1,typicalValue:2,highValue:3}]});

test('CC-02 parallel rotated trials cannot consume invited capacity; owner stays globally capped', async () => {
  const limited = {...memoryDurableEnv(), BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD:String(6 * 131072), BETA_ANONYMOUS_NETWORK_DAILY_LIMIT:'6', BETA_DAILY_BUDGET_MICRO_USD:String(10 * 131072), BETA_OWNER_INVITE_CODE_HASHES:env.BETA_INVITE_CODE_HASHES};
  let calls = 0;
  const handler = createHandler({fetcher:async (...args) => {calls++; return quotaProvider(...args);}});
  const results = await Promise.all(Array.from({length:30}, (_,i) => handler(anonymousRequest(`token-${i}`, `203.0.113.${i+1}`),limited)));
  assert.equal(results.filter(r=>r.status===200).length,6);
  assert.equal(calls,6);
  const owners = await Promise.all(Array.from({length:10},()=>handler(imageRequest(),limited)));
  assert.equal(owners.filter(r=>r.status===200).length,4);
  assert.equal(calls,10);
});

test('CC-02 rotated IDs on one trusted network share six daily attempts', async () => {
  const limited = {...memoryDurableEnv(), BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD:'3500000', BETA_ANONYMOUS_NETWORK_DAILY_LIMIT:'6'};
  const handler = createHandler({fetcher:quotaProvider});
  const results = await Promise.all(Array.from({length:15},(_,i)=>handler(anonymousRequest(`rotation-${i}`),limited)));
  assert.equal(results.filter(r=>r.status===200).length,6);
});

test('CC-02 missing trusted IP fails closed; forwarded spoof is not accepted', async () => {
  const request = anonymousRequest('no-ip', null);
  request.headers.set('X-Forwarded-For','203.0.113.99');
  let calls=0;
  const response=await createHandler({fetcher:async()=>{calls++;return quotaProvider();}})(request, memoryDurableEnv());
  assert.equal(response.status,503);
  assert.equal(calls,0);
});

test('CC-02 anonymous reservation contains only day-scoped network hash', async () => {
  let reservation;
  const limited={...env,BETA_USAGE_LIMITER:{idFromName:n=>n,get:()=>({fetch:async request=>{
    if(new URL(request.url).pathname!=='/reserve') return Response.json({allowed:false});
    reservation=await request.json();return Response.json({allowed:true});
  }})}};
  assert.equal((await createHandler({fetcher:quotaProvider})(anonymousRequest('hash-check'),limited)).status,200);
  assert.match(reservation.networkHash,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(reservation).includes('203.0.113.10'),false);
});

test('CC-02 real handler preserves three free attempts without registration', async () => {
  const limited=memoryDurableEnv();
  const handler=createHandler({fetcher:quotaProvider});
  const statuses=[];
  for(let i=0;i<4;i++) statuses.push((await handler(anonymousRequest('same-browser'),limited)).status);
  assert.deepEqual(statuses,[200,200,200,429]);
});
for (const config of [
  {BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD:undefined},
  {BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD:'5000000'},
  {BETA_ANONYMOUS_NETWORK_DAILY_LIMIT:'0'},
  {BETA_ANONYMOUS_NETWORK_DAILY_LIMIT:'invalid'},
]) test(`CC-02 invalid trial configuration fails closed ${JSON.stringify(config)}`, async()=>{
  let calls=0;
  const response=await createHandler({fetcher:async()=>{calls++;return quotaProvider();}})(anonymousRequest('invalid-config'),{...memoryDurableEnv(),...config});
  assert.equal(response.status,503); assert.equal(calls,0);
});

const env = {
  OPENAI_API_KEY: 'test-secret',
  OPENAI_MODEL: 'gpt-5-nano',
  ALLOWED_ORIGIN: 'https://zeroleveldev.github.io',
  BETA_INVITE_CODE_HASHES: '["3ac96c6f1013fc0c2f5c5309d075f7785f1e3024609a64224bc6f406082af744"]',
  BETA_WEEKLY_REQUEST_LIMIT: '3',
  BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD: '3000000',
  BETA_ANONYMOUS_NETWORK_DAILY_LIMIT: '6',
  BETA_DAILY_BUDGET_MICRO_USD: '5000000',
  OPENAI_MAX_REQUEST_COST_MICRO_USD: '131072',
  ADMIN_API_KEY: 'test-admin-secret-at-least-32-bytes',
  BETA_USAGE_LIMITER: {
    idFromName: (name) => name,
    get: () => ({
      fetch: async (request) => new URL(request.url).pathname === '/invites/check'
        ? Response.json({ allowed: false })
        : Response.json({ allowed: true }),
    }),
  },
};

function memoryDurableEnv() {
  const values = new Map();
  let queue = Promise.resolve();
  const storage = {
    get: async (key) => values.get(key),
    put: async (keyOrValues, value) => {
      if (typeof keyOrValues === 'string') values.set(keyOrValues, value);
      else for (const [key, entry] of Object.entries(keyOrValues)) values.set(key, entry);
    },
    delete: async (key) => values.delete(key),
    transaction: (callback) => {
      const result = queue.then(() => callback(storage));
      queue = result.catch(() => {});
      return result;
    },
  };
  const limiter = new BetaUsageLimiter({ storage });
  return {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({ fetch: (request) => limiter.fetch(request) }),
    },
  };
}

function accessRequest(body = {}, { deviceToken = 'a'.repeat(64) } = {}) {
  return new Request('https://api.example/v1/access-requests', {
    method: 'POST',
    body: JSON.stringify({
      email: 'tester@example.com',
      name: 'Taylor',
      device: 'Android phone',
      ...body,
    }),
    headers: {
      'Content-Type': 'application/json',
      Origin: env.ALLOWED_ORIGIN,
      'CF-Connecting-IP': '203.0.113.20',
      'X-ClutterCash-Device': deviceToken,
    },
  });
}

async function testSha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function imageRequest({ consent = true, origin = env.ALLOWED_ORIGIN } = {}) {
  const form = new FormData();
  form.append('image', new File([new Uint8Array([255,216,255])], 'room.jpg', { type: 'image/jpeg' }));
  if (consent) form.append('betaConsent', 'true');
  return new Request('https://api.example/v1/scans', {
    method: 'POST', body: form, headers: {
      Origin: origin,
      'CF-Connecting-IP': '203.0.113.10',
      'X-ClutterCash-Invite': 'test-invite',
    },
  });
}

function labelRequest({ consent = true, origin = env.ALLOWED_ORIGIN } = {}) {
  const form = new FormData();
  form.append('image', new File([new Uint8Array([255,216,255])], 'label.jpg', { type: 'image/jpeg' }));
  form.append('itemName', 'Vintage film camera');
  form.append('category', 'Cameras');
  if (consent) form.append('betaConsent', 'true');
  return new Request('https://api.example/v1/items/identify', {
    method: 'POST', body: form, headers: {
      Origin: origin,
      'CF-Connecting-IP': '203.0.113.11',
      'X-ClutterCash-Invite': 'test-invite',
    },
  });
}

function telemetryRequest(body, { invite = 'test-invite', origin = env.ALLOWED_ORIGIN } = {}) {
  return new Request('https://api.example/v1/telemetry', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'X-ClutterCash-Invite': invite,
    },
  });
}

test('health is public and never exposes the OpenAI secret', async () => {
  const response = await createHandler({ fetcher: async () => { throw new Error('unused'); } })(
    new Request('https://api.example/health'), env,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { ok: true, analysisReady: true, provider: 'openai' });
  assert.equal(JSON.stringify(body).includes(env.OPENAI_API_KEY), false);
});

test('rejects real-photo analysis without explicit free-beta consent', async () => {
  let calls = 0;
  const response = await createHandler({ fetcher: async () => { calls += 1; } })(imageRequest({ consent: false }), env);
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  assert.match((await response.json()).error, /consent/i);
});

test('rejects unapproved browser origins', async () => {
  const response = await createHandler({ fetcher: async () => { throw new Error('unused'); } })(
    imageRequest({ origin: 'https://attacker.example' }), env,
  );
  assert.equal(response.status, 403);
});

test('blocks live analysis until beta invite protection is configured', async () => {
  const response = await createHandler({ fetcher: async () => { throw new Error('provider must not be called'); } })(
    imageRequest(),
    { ...env, BETA_INVITE_CODE_HASHES: '' },
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /beta access/i);
});

test('rejects a missing or invalid invite code before consuming quota', async () => {
  let quotaCalls = 0;
  const protectedEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          if (new URL(request.url).pathname === '/invites/check') {
            return Response.json({ allowed: false });
          }
          quotaCalls += 1;
          return Response.json({ allowed: true });
        },
      }),
    },
  };
  const missing = imageRequest();
  missing.headers.delete('X-ClutterCash-Invite');
  const invalid = imageRequest();
  invalid.headers.set('X-ClutterCash-Invite', 'wrong-code');

  const handler = createHandler({ fetcher: async () => { throw new Error('provider must not be called'); } });
  assert.equal((await handler(missing, protectedEnv)).status, 401);
  assert.equal((await handler(invalid, protectedEnv)).status, 401);
  assert.equal(quotaCalls, 0);
});

test('allows three no-registration analyses through a random browser token', async () => {
  let quotaRequest;
  const anonymousEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          const pathname = new URL(request.url).pathname;
          if (pathname === '/reserve') {
            quotaRequest = await request.json();
            return Response.json({ allowed: true });
          }
          return Response.json({ allowed: false });
        },
      }),
    },
  };
  const request = imageRequest();
  request.headers.delete('X-ClutterCash-Invite');
  request.headers.set(
    'X-ClutterCash-Device',
    'anonymous-browser-token-at-least-32-bytes',
  );
  const fetcher = async () => providerResponse({
      sceneSummary: 'Shelf',
      items: [{
        id: 'lamp', name: 'Lamp', category: 'Home', lowValue: 10,
        typicalValue: 15, highValue: 20, confidence: 'medium', effort: 'low',
        route: 'sell', reason: 'Visible lamp', searchQuery: 'lamp',
        marketplace: 'localPickup', marketplaceReason: 'Easy pickup.',
        box: { left: 0, top: 0, width: 1, height: 1 },
      }],
  });

  const response = await createHandler({ fetcher })(request, anonymousEnv);

  assert.equal(response.status, 200);
  assert.match(quotaRequest.inviteHash, /^device:[a-f0-9]{64}$/);
  assert.equal(quotaRequest.inviteLimit, 3);
  assert.equal(quotaRequest.anonymous, true);
});

test('accepts a valid beta access request and sends its contact details to the owner alert', async () => {
  const alerts = [];
  const response = await createHandler({
    idGenerator: () => 'request-123',
    approvalTokenGenerator: () => 'approval-token-at-least-thirty-two-bytes-abc',
    requestTokenGenerator: () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    alertSender: async (event) => {
      alerts.push(event);
      return true;
    },
  })(accessRequest(), memoryDurableEnv());

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    accepted: true,
    requestId: 'request-123',
    requestToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
  assert.deepEqual(alerts, [{
    event: 'beta_access_requested',
    requestId: 'request-123',
    approvalUrl: 'https://api.example/v1/access-requests/request-123/approve?token=approval-token-at-least-thirty-two-bytes-abc',
    email: 'tester@example.com',
    name: 'Taylor',
    device: 'Android phone',
  }]);
});

test('phone approval activates continued access for the requesting browser only', async () => {
  const pendingEnv = memoryDurableEnv();
  const alerts = [];
  const deviceToken = 'b'.repeat(64);
  const requestToken = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
  const handler = createHandler({
    idGenerator: () => 'request-phone-123',
    approvalTokenGenerator: () => 'approval-token-at-least-thirty-two-bytes-123',
    requestTokenGenerator: () => requestToken,
    alertSender: async (event) => {
      alerts.push(event);
      return true;
    },
  });

  const submitted = await handler(accessRequest({}, { deviceToken }), pendingEnv);
  assert.equal(submitted.status, 202);
  assert.deepEqual(await submitted.json(), {
    accepted: true,
    requestId: 'request-phone-123',
    requestToken,
  });
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].approvalUrl, /request-phone-123\/approve\?token=/);

  const pendingStatus = await handler(new Request(
    'https://api.example/v1/access-requests/request-phone-123/status',
    { headers: { 'X-ClutterCash-Request': requestToken, Origin: env.ALLOWED_ORIGIN } },
  ), pendingEnv);
  assert.deepEqual(await pendingStatus.json(), { status: 'pending' });

  const confirmation = await handler(new Request(alerts[0].approvalUrl), pendingEnv);
  assert.equal(confirmation.status, 200);
  assert.match(await confirmation.text(), /Activate access/i);

  const approved = await handler(new Request(alerts[0].approvalUrl, {
    method: 'POST',
    headers: { Origin: 'https://api.example' },
  }), pendingEnv);
  assert.equal(approved.status, 200);
  assert.match(await approved.text(), /Access activated/i);

  const deviceHash = await testSha256Hex(deviceToken);
  const registry = pendingEnv.BETA_USAGE_LIMITER.get();
  const registered = await registry.fetch(new Request('https://usage.internal/invites/check', {
    method: 'POST',
    body: JSON.stringify({ inviteHash: deviceHash }),
  }));
  assert.deepEqual(await registered.json(), { allowed: true });

  const approvedStatus = await handler(new Request(
    'https://api.example/v1/access-requests/request-phone-123/status',
    { headers: { 'X-ClutterCash-Request': requestToken, Origin: env.ALLOWED_ORIGIN } },
  ), pendingEnv);
  assert.deepEqual(await approvedStatus.json(), { status: 'approved' });

  const wrongBrowser = await handler(new Request(
    'https://api.example/v1/access-requests/request-phone-123/status',
    { headers: { 'X-ClutterCash-Request': 'wrong-private-request-token-at-least-32', Origin: env.ALLOWED_ORIGIN } },
  ), pendingEnv);
  assert.equal(wrongBrowser.status, 404);

  const replay = await handler(new Request(alerts[0].approvalUrl, { method: 'POST' }), pendingEnv);
  assert.equal(replay.status, 409);
});

test('approved browser uses rolling beta quota instead of exhausted free-use quota', async () => {
  let quotaRequest;
  const approvedEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          const pathname = new URL(request.url).pathname;
          if (pathname === '/invites/check') return Response.json({ allowed: true });
          if (pathname === '/reserve') {
            quotaRequest = await request.json();
            return Response.json({ allowed: true });
          }
          return Response.json({ allowed: false });
        },
      }),
    },
  };
  const request = imageRequest();
  request.headers.delete('X-ClutterCash-Invite');
  request.headers.set('X-ClutterCash-Device', 'approved-browser-token-at-least-32-bytes');
  const fetcher = async () => providerResponse({
      sceneSummary: 'Shelf',
      items: [{
        id: 'lamp', name: 'Lamp', category: 'Home', lowValue: 10,
        typicalValue: 15, highValue: 20, confidence: 'medium', effort: 'low',
        route: 'sell', reason: 'Visible lamp', searchQuery: 'lamp',
        marketplace: 'localPickup', marketplaceReason: 'Easy pickup.',
        box: { left: 0, top: 0, width: 1, height: 1 },
      }],
  });

  const response = await createHandler({ fetcher })(request, approvedEnv);
  assert.equal(response.status, 200);
  assert.match(quotaRequest.inviteHash, /^[a-f0-9]{64}$/);
  assert.equal(quotaRequest.anonymous, false);
});

test('access requests fail closed when the browser device token is missing', async () => {
  const alerts = [];
  const request = accessRequest();
  request.headers.delete('X-ClutterCash-Device');
  const response = await createHandler({
    alertSender: async (event) => {
      alerts.push(event);
      return true;
    },
  })(request, memoryDurableEnv());

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /browser/i);
  assert.deepEqual(alerts, []);
});

test('rejects invalid access-request contact data without alerting the owner', async () => {
  const alerts = [];
  const response = await createHandler({
    alertSender: async (event) => {
      alerts.push(event);
      return true;
    },
  })(accessRequest({ email: 'not-an-email', extra: 'private data' }), env);

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /valid email/i);
  assert.deepEqual(alerts, []);
});

test('rejects access-request email values that could become shell commands', async () => {
  const alerts = [];
  const response = await createHandler({
    alertSender: async (event) => {
      alerts.push(event);
      return true;
    },
  })(accessRequest({ email: 'tester@example.com;whoami' }), env);

  assert.equal(response.status, 400);
  assert.deepEqual(alerts, []);
});

test('owner-only endpoint creates and registers a new invite code', async () => {
  let registryRequest;
  const registryEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          registryRequest = {
            pathname: new URL(request.url).pathname,
            body: await request.json(),
          };
          return Response.json({ registered: true }, { status: 201 });
        },
      }),
    },
  };
  const request = new Request('https://api.example/v1/admin/invites', {
    method: 'POST',
    body: JSON.stringify({ email: 'tester@example.com' }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-admin-secret-at-least-32-bytes',
    },
  });
  const response = await createHandler({
    now: () => Date.UTC(2026, 8, 9, 20),
    tokenGenerator: () => 'CC-TEST-VALID-INVITE-CODE',
  })(request, registryEnv);

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    inviteCode: 'CC-TEST-VALID-INVITE-CODE',
    email: 'tester@example.com',
  });
  assert.equal(registryRequest.pathname, '/invites/register');
  assert.equal(registryRequest.body.email, 'tester@example.com');
  assert.equal(registryRequest.body.createdAt, Date.UTC(2026, 8, 9, 20));
  assert.match(registryRequest.body.inviteHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(registryRequest).includes('CC-TEST-VALID-INVITE-CODE'), false);
});

test('invite-generation endpoint rejects callers without the private owner key', async () => {
  let registryCalls = 0;
  const request = new Request('https://api.example/v1/admin/invites', {
    method: 'POST',
    body: JSON.stringify({ email: 'tester@example.com' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const response = await createHandler()(request, {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => { registryCalls += 1; } }),
    },
  });

  assert.equal(response.status, 401);
  assert.equal(registryCalls, 0);
  assert.equal((await response.text()).includes('test-admin-secret-at-least-32-bytes'), false);
});

test('durable invite registry accepts a generated invite hash without storing contact data', async () => {
  const values = new Map();
  const storage = {
    get: async (key) => values.get(key),
    put: async (key, value) => values.set(key, value),
    transaction: async (callback) => callback({
      get: async (key) => values.get(key),
      put: async (entries) => { for (const [key, value] of Object.entries(entries)) values.set(key, value); },
    }),
  };
  const limiter = new BetaUsageLimiter({ storage });
  const inviteHash = 'a'.repeat(64);

  const registered = await limiter.fetch(new Request('https://usage.internal/invites/register', {
    method: 'POST',
    body: JSON.stringify({ inviteHash, email: 'tester@example.com', createdAt: 123 }),
  }));
  assert.equal(registered.status, 201);

  const checked = await limiter.fetch(new Request('https://usage.internal/invites/check', {
    method: 'POST',
    body: JSON.stringify({ inviteHash }),
  }));
  assert.deepEqual(await checked.json(), { allowed: true });
  assert.equal(JSON.stringify([...values.entries()]).includes('tester@example.com'), false);
});

test('accepts only allow-listed privacy-minimal beta telemetry without consuming provider quota', async () => {
  const events = [];
  let quotaCalls = 0;
  let providerCalls = 0;
  const telemetryEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          if (new URL(request.url).pathname === '/invites/check') {
            return Response.json({ allowed: false });
          }
          if (new URL(request.url).pathname !== '/telemetry/reserve') quotaCalls += 1;
          return Response.json({ allowed: true });
        },
      }),
    },
  };
  const handler = createHandler({
    fetcher: async () => { providerCalls += 1; },
    telemetrySender: async (event) => { events.push(event); },
  });

  const response = await handler(
    telemetryRequest({ event: 'scan_failed', failureCode: 'api' }),
    telemetryEnv,
  );

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.deepEqual(events, [{ event: 'scan_failed', failureCode: 'api' }]);
  assert.equal(quotaCalls, 0);
  assert.equal(providerCalls, 0);
});

test('telemetry rejects invalid invites, unknown events, and payload fields that could contain user data', async () => {
  const events = [];
  const handler = createHandler({ telemetrySender: async (event) => { events.push(event); } });

  assert.equal((await handler(
    telemetryRequest({ event: 'project_created' }, { invite: 'wrong-code' }),
    env,
  )).status, 401);
  assert.equal((await handler(
    telemetryRequest({ event: 'item_named_camera' }),
    env,
  )).status, 400);
  assert.equal((await handler(
    telemetryRequest({ event: 'item_corrected', itemName: 'Private item name' }),
    env,
  )).status, 400);
  assert.equal((await handler(
    telemetryRequest({ event: 'scan_failed', failureCode: 'raw exception text' }),
    env,
  )).status, 400);
  assert.deepEqual(events, []);
});

test('configured owner invite bypasses the per-invite analysis allowance', async () => {
  let quotaRequest;
  const ownerEnv = {
    ...env,
    BETA_OWNER_INVITE_CODE_HASHES: env.BETA_INVITE_CODE_HASHES,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          quotaRequest = await request.json();
          return Response.json({ allowed: true });
        },
      }),
    },
  };
  const fetcher = async () => providerResponse({
      sceneSummary: 'Shelf',
      items: [{
        id: 'lamp', name: 'Lamp', category: 'Home', lowValue: 10,
        typicalValue: 15, highValue: 20, confidence: 'medium', effort: 'low',
        route: 'sell', reason: 'Visible lamp', searchQuery: 'lamp',
        marketplace: 'localPickup', marketplaceReason: 'Easy pickup.',
        box: { left: 0, top: 0, width: 1, height: 1 },
      }],
  });

  const response = await createHandler({ fetcher })(imageRequest(), ownerEnv);

  assert.equal(response.status, 200);
  assert.equal(quotaRequest.unlimited, true);
  assert.equal(quotaRequest.anonymous, false);
});

test('invite allowance exhaustion clearly explains the rolling reset', async () => {
  let providerCalls = 0;
  const limitedEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async () => Response.json({ allowed: false, reason: 'invite_limit' }),
      }),
    },
  };

  const response = await createHandler({
    fetcher: async () => { providerCalls += 1; },
  })(imageRequest(), limitedEnv);
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(providerCalls, 0);
  assert.match(body.error, /used all 3 analyses/i);
  assert.match(body.error, /available again 7 days after/i);
  assert.doesNotMatch(body.error, /temporarily unavailable/i);
});

test('uses durable quota and alerts once when the daily budget is reached', async () => {
  let providerCalls = 0;
  let quotaRequest;
  const alerts = [];
  const limitedEnv = {
    ...env,
    BETA_USAGE_LIMITER: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          quotaRequest = await request.json();
          return Response.json({ allowed: false, reason: 'daily_budget', shouldAlert: true });
        },
      }),
    },
  };

  const response = await createHandler({
    fetcher: async () => { providerCalls += 1; },
    now: () => Date.UTC(2026, 8, 8, 12),
    alertSender: async (event) => { alerts.push(event); },
  })(imageRequest(), limitedEnv);

  assert.equal(response.status, 429);
  assert.equal(providerCalls, 0);
  assert.deepEqual(alerts, [{ event: 'daily_budget_reached' }]);
  assert.deepEqual(quotaRequest, {
    day: '2026-09-08',
    timestamp: Date.UTC(2026, 8, 8, 12),
    inviteHash: '3ac96c6f1013fc0c2f5c5309d075f7785f1e3024609a64224bc6f406082af744',
    inviteLimit: 3,
    inviteWindowMs: 7 * 24 * 60 * 60 * 1000,
    anonymous: false,
    budgetMicroUsd: 5000000,
    requestCostMicroUsd: 131072,
  });
  assert.doesNotMatch(await response.text(), /budget|OpenAI|131072/i);
});

test('fails closed when the durable quota binding is unavailable', async () => {
  const response = await createHandler({ fetcher: async () => { throw new Error('provider must not be called'); } })(
    imageRequest(),
    { ...env, BETA_USAGE_LIMITER: undefined },
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /temporarily unavailable/i);
});

test('durable limiter enforces three analyses in a rolling seven-day invite window', async () => {
  const values = new Map();
  const storage = {
    transaction: async (callback) => callback({
      get: async (key) => values.get(key),
      put: async (entries) => { for (const [key, value] of Object.entries(entries)) values.set(key, value); },
    }),
  };
  const limiter = new BetaUsageLimiter({ storage });
  const reserve = (body) => limiter.fetch(new Request('https://usage.internal/reserve', {
    method: 'POST', body: JSON.stringify(body),
  }));
  const base = {
    day: '2026-09-08', timestamp: Date.UTC(2026, 8, 8, 12),
    inviteHash: 'invite-a', inviteLimit: 3, inviteWindowMs: 7 * 24 * 60 * 60 * 1000,
    budgetMicroUsd: 100000, requestCostMicroUsd: 10000,
  };

  assert.equal((await (await reserve(base)).json()).allowed, true);
  assert.equal((await (await reserve({ ...base, timestamp: base.timestamp + 1 })).json()).allowed, true);
  assert.equal((await (await reserve({ ...base, timestamp: base.timestamp + 2 })).json()).allowed, true);
  const weeklyLimited = await (await reserve({ ...base, timestamp: base.timestamp + 3 })).json();
  assert.deepEqual(weeklyLimited, { allowed: false, reason: 'invite_limit', shouldAlert: false });

  const afterWindow = await (await reserve({
    ...base,
    timestamp: base.timestamp + (7 * 24 * 60 * 60 * 1000) + 1,
  })).json();
  assert.equal(afterWindow.allowed, true);
});

test('durable limiter lets owner bypass invite allowance but not daily budget', async () => {
  const values = new Map();
  const storage = {
    transaction: async (callback) => callback({
      get: async (key) => values.get(key),
      put: async (entries) => { for (const [key, value] of Object.entries(entries)) values.set(key, value); },
    }),
  };
  const limiter = new BetaUsageLimiter({ storage });
  const reserve = (timestamp) => limiter.fetch(new Request('https://usage.internal/reserve', {
    method: 'POST',
    body: JSON.stringify({
      day: '2026-09-08', timestamp, inviteHash: 'owner-hash',
      inviteLimit: 3, inviteWindowMs: 7 * 24 * 60 * 60 * 1000,
      budgetMicroUsd: 100000, requestCostMicroUsd: 10000,
      unlimited: true,
    }),
  }));
  const first = Date.UTC(2026, 8, 8, 12);

  for (let index = 0; index < 10; index += 1) {
    assert.equal((await (await reserve(first + index)).json()).allowed, true);
  }
  assert.deepEqual(await (await reserve(first + 10)).json(), {
    allowed: false,
    reason: 'daily_budget',
    shouldAlert: true,
  });
});

test('durable limiter allows only three anonymous analyses even after seven days', async () => {
  const values = new Map();
  const storage = {
    transaction: async (callback) => callback({
      get: async (key) => values.get(key),
      put: async (entries) => { for (const [key, value] of Object.entries(entries)) values.set(key, value); },
    }),
  };
  const limiter = new BetaUsageLimiter({ storage });
  const reserve = (timestamp) => limiter.fetch(new Request('https://usage.internal/reserve', {
    method: 'POST',
    body: JSON.stringify({
      day: new Date(timestamp).toISOString().slice(0, 10),
      timestamp,
      inviteHash: `device:${'a'.repeat(64)}`,
      inviteLimit: 3,
      inviteWindowMs: 7 * 24 * 60 * 60 * 1000,
      budgetMicroUsd: 100000,
      requestCostMicroUsd: 10000,
      anonymous: true,
      trialBudgetMicroUsd: 60000, networkLimit: 6, networkHash: 'b'.repeat(64),
    }),
  }));
  const first = Date.UTC(2026, 8, 9);

  assert.equal((await (await reserve(first)).json()).allowed, true);
  assert.equal((await (await reserve(first + 1)).json()).allowed, true);
  assert.equal((await (await reserve(first + 2)).json()).allowed, true);
  const afterWindow = await (await reserve(first + 8 * 24 * 60 * 60 * 1000)).json();
  assert.deepEqual(afterWindow, {
    allowed: false,
    reason: 'anonymous_limit',
    shouldAlert: false,
  });
});

test('provider failures emit a sanitized operational alert', async () => {
  const alerts = [];
  const response = await createHandler({
    fetcher: async () => new Response('provider secret detail', { status: 500 }),
    alertSender: async (event) => { alerts.push(event); },
  })(imageRequest(), { ...env, ALERT_WEBHOOK_URL: 'https://alerts.example/hook' });

  assert.equal(response.status, 502);
  assert.deepEqual(alerts, [{ event: 'scan_failed', status: 500 }]);
  assert.doesNotMatch(JSON.stringify(alerts), /secret|test-invite|test-secret/);
});

test('sends the image to OpenAI and returns a validated scan contract', async () => {
  let providerRequest;
  const fetcher = async (_url, options) => {
    providerRequest = JSON.parse(options.body);
    return providerResponse({
      sceneSummary: 'Garage shelf',
      items: [{ id: 'camera', name: 'Film camera', category: 'Cameras', lowValue: 80,
        typicalValue: 110, highValue: 150, confidence: 'medium', effort: 'medium',
        route: 'sell', reason: 'Check model', listingTitle: 'Film camera — model unknown',
        listingDescription: 'Film camera. Confirm model and condition before posting.',
        searchQuery: 'film camera body', marketplace: 'ebay',
        marketplaceReason: 'eBay has a broad camera buyer pool.',
        missingDetails: ['Exact model', 'Working condition'],
        box: { left: .1, top: .2, width: .3, height: .4 } }],
    });
  };
  const response = await createHandler({ fetcher })(imageRequest(), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.items[0].name, 'Film camera');
  assert.equal('listingTitle' in result.items[0], false);
  assert.equal('listingDescription' in result.items[0], false);
  assert.equal(result.items[0].marketplace, 'ebay');
  assert.equal('missingDetails' in result.items[0], false);
  assert.match(providerRequest.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(providerRequest.text.format.type, 'json_schema');
  assert.equal(providerRequest.text.format.schema.properties.items.maxItems, 10);
});

for (const serial of ['PRIVATE-123', 'A.B[42]']) test(`CC-10 redacts explicitly identified serial ${serial} without losing model identity`, async () => {
  const identity = {exactName:`Canon AE-1 ${serial}`, manufacturer:`Canon ${serial}`, model:`AE-1 ${serial}`, searchQuery:`camera ${serial}`, marketplaceReason:`Compare ${serial}`, serialNumber:serial, serialDetected:true};
  const response = await createHandler({fetcher:async()=>providerResponse(identity)})(labelRequest(),env);
  assert.equal(response.status,200);
  const result = await response.json();
  assert.equal(JSON.stringify(result).includes(serial),false);
  assert.equal(result.exactName,'Canon AE-1');
  assert.equal(result.model,'AE-1');
  assert.equal(result.searchQuery,result.exactName,'minimize marketplace text to product identity');
  assert.equal('serialNumber' in result,false);
});

test('uses a label photo to refine an item without returning its serial number', async () => {
  let providerRequest;
  const fetcher = async (_url, options) => {
    providerRequest = JSON.parse(options.body);
    return providerResponse({
      exactName: 'Canon AE-1 35mm film camera', manufacturer: 'Canon', model: 'AE-1',
      confidence: 'high', serialDetected: true, serialNumber: 'REDACT-ME-123',
      searchQuery: 'Canon AE-1 35mm film camera body',
      listingTitle: 'Canon AE-1 35mm Film Camera Body — Condition to Confirm',
      listingDescription: 'Canon AE-1 35mm film camera body. Confirm operation, cosmetic wear, lens, battery, and accessories before posting.',
      marketplace: 'ebay', marketplaceReason: 'Collectors search by exact model on eBay.',
      missingDetails: ['Working condition', 'Included lens and accessories'],
    });
  };

  const response = await createHandler({ fetcher })(labelRequest(), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.exactName, 'Canon AE-1 35mm film camera');
  assert.equal(result.model, 'AE-1');
  assert.equal(result.serialDetected, true);
  assert.equal('serialNumber' in result, false);
  assert.equal('listingTitle' in result, false);
  assert.equal('listingDescription' in result, false);
  assert.equal('missingDetails' in result, false);
  assert.equal(JSON.stringify(result).includes('REDACT-ME-123'), false);
  assert.match(providerRequest.input[0].content[0].text, /never return.*serial/i);
  assert.match(providerRequest.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
});

test('does not echo provider errors or secrets to clients', async () => {
  const response = await createHandler({ fetcher: async () => new Response(`bad ${env.OPENAI_API_KEY}`, { status: 429 }) })(imageRequest(), env);
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.equal(text.includes(env.OPENAI_API_KEY), false);
  assert.match(text, /try again/i);
});
