import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createHandler } from '../src/worker.js';

const invite = 'test-invite';
const baseEnv = {
  BETA_INVITE_CODE_HASHES: JSON.stringify([createHash('sha256').update(invite).digest('hex')]),
  BETA_OWNER_INVITE_CODE_HASHES: '[]',
  BETA_WEEKLY_REQUEST_LIMIT: '3',
  BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD: '393216',
  BETA_ANONYMOUS_NETWORK_DAILY_LIMIT: '6',
  BETA_DAILY_BUDGET_MICRO_USD: '500000',
  OPENAI_API_KEY: 'synthetic-openai-key',
  OPENAI_MODEL: 'gpt-5-nano',
  OPENAI_MAX_REQUEST_COST_MICRO_USD: '131072',
  EBAY_CLIENT_ID: 'synthetic-ebay-id',
  EBAY_CLIENT_SECRET: 'synthetic-ebay-secret',
  EBAY_MARKETPLACE_ID: 'EBAY_US',
  BETA_USAGE_LIMITER: {
    idFromName: name => name,
    get: () => ({ fetch: async () => Response.json({ allowed: true }) }),
  },
};

function scanRequest() {
  const body = new FormData();
  body.set('image', new Blob([new Uint8Array([255, 216, 255])], {type: 'image/jpeg'}), 'photo.jpg');
  body.set('betaConsent', 'true');
  return new Request('https://api.example/v1/scans', {
    method: 'POST',
    headers: {'X-ClutterCash-Invite': invite},
    body,
  });
}

function openAIResponse(items) {
  const value = {sceneSummary: 'Shelf', items};
  return Response.json({
    id: 'resp_ebay_test', status: 'completed',
    output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify(value)}]}],
    usage: {input_tokens: 1, output_tokens: 1, total_tokens: 2},
  });
}

function item(index, overrides = {}) {
  return {
    id: `item-${index}`, name: `Canon AE-1 camera ${index}`, category: 'Cameras',
    lowValue: 50, typicalValue: 75, highValue: 100, confidence: 'high', effort: 'medium',
    route: 'sell', reason: 'Collectible camera.', searchQuery: 'Canon AE-1 camera',
    marketplace: 'ebay', marketplaceReason: 'Broad buyer pool.',
    box: {left: 0, top: 0, width: 1, height: 1}, ...overrides,
  };
}

function tokenResponse() {
  return Response.json({access_token: 'synthetic-access-token', expires_in: 7200, token_type: 'Application Access Token'});
}

function browseResponse(itemSummaries) {
  return Response.json({total: itemSummaries.length, itemSummaries});
}

function listing(title, value, overrides = {}) {
  return {
    title, price: {value: String(value), currency: 'USD'}, buyingOptions: ['FIXED_PRICE'],
    itemWebUrl: 'https://www.ebay.com/itm/PRIVATE-RAW-LISTING',
    ...overrides,
  };
}

test('EBAY-01 enriches a scan with aggregate active fixed-price USD quartiles only', async () => {
  const calls = [];
  async function fetcher(url, init = {}) {
    assert.equal(this, undefined, 'production fetch must be called without a synthetic receiver');
    calls.push({url: String(url), init});
    if (String(url).includes('openai.com')) return openAIResponse([item(1)]);
    if (String(url).includes('/identity/v1/oauth2/token')) return tokenResponse();
    return browseResponse([
      listing('Canon AE-1 camera body', 10), listing('Canon AE-1 camera tested', 20),
      listing('Canon AE-1 camera vintage', 30), listing('Canon AE-1 camera clean', 40),
      listing('Nikon unrelated camera', 999),
      listing('Canon AE-1 camera auction', 5, {buyingOptions: ['AUCTION']}),
      listing('Canon AE-1 camera CAD', 6, {price: {value: '6', currency: 'CAD'}}),
    ]);
  };
  const response = await createHandler({fetcher, providerMetricSender: async () => {}})(scanRequest(), baseEnv);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.items[0], {
    ...item(1), lowValue: 17.5, typicalValue: 25, highValue: 32.5,
    priceSource: 'ebay_active', ebayComparableCount: 4,
  });
  assert.equal(JSON.stringify(body).includes('PRIVATE-RAW-LISTING'), false);
  const tokenCall = calls.find(call => call.url.includes('/identity/v1/oauth2/token'));
  assert.equal(tokenCall.init.method, 'POST');
  assert.equal(tokenCall.init.headers.Authorization, `Basic ${Buffer.from('synthetic-ebay-id:synthetic-ebay-secret').toString('base64')}`);
  assert.equal(tokenCall.init.body, 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope');
  const browseCall = calls.find(call => call.url.includes('/buy/browse/v1/item_summary/search'));
  const browseUrl = new URL(browseCall.url);
  assert.equal(browseUrl.searchParams.get('q'), 'Canon AE-1 camera');
  assert.match(browseUrl.searchParams.get('filter'), /buyingOptions:\{FIXED_PRICE\}/);
  assert.match(browseUrl.searchParams.get('filter'), /priceCurrency:USD/);
  assert.match(browseUrl.searchParams.get('filter'), /conditions:\{USED\}/);
  assert.equal(browseCall.init.headers.Authorization, 'Bearer synthetic-access-token');
  assert.equal(browseCall.init.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_US');
});

test('EBAY-02 fewer than three strong comparables preserves AI estimates', async () => {
  const fetcher = async url => String(url).includes('openai.com') ? openAIResponse([item(1)])
    : String(url).includes('/identity/') ? tokenResponse()
      : browseResponse([listing('Canon AE-1 camera body', 10), listing('Canon camera weak match', 20)]);
  const response = await createHandler({fetcher, providerMetricSender: async () => {}})(scanRequest(), baseEnv);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.items[0], {...item(1), priceSource: 'ai_estimate', ebayComparableCount: 0});
});

test('EBAY-02a ignores filler words while rejecting parts, sets, and accessory-only listings', async () => {
  const focusedItem = item(1, {searchQuery: 'rattan wicker table lamp with shade'});
  const fetcher = async url => String(url).includes('openai.com') ? openAIResponse([focusedItem])
    : String(url).includes('/identity/') ? tokenResponse()
      : browseResponse([
        listing('Rattan table lamp with beige shade', 30),
        listing('Wicker table lamp with beige shade', 40),
        listing('Vintage wicker rattan table lamp', 50),
        listing('Wicker lamp replacement shade only', 5),
        listing('4PCS Rattan table lamps with shades', 90),
        listing('Wicker table lamp broken for parts', 10),
      ]);
  const response = await createHandler({fetcher, providerMetricSender: async () => {}})(scanRequest(), baseEnv);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.items[0], {
    ...focusedItem, lowValue: 35, typicalValue: 40, highValue: 45,
    priceSource: 'ebay_active', ebayComparableCount: 3,
  });
});

test('EBAY-02b skips donate and non-eBay marketplace items', async () => {
  let marketplaceCalls = 0;
  const donated = item(1, {name:'Baby swing chair',route:'donate',marketplace:'donate',searchQuery:'used baby swing chair'});
  const local = item(2, {name:'Bookshelf',route:'sell',marketplace:'localPickup',searchQuery:'wood bookshelf'});
  const fetcher = async url => {
    if (String(url).includes('openai.com')) return openAIResponse([donated,local]);
    marketplaceCalls++;
    return tokenResponse();
  };
  const response = await createHandler({fetcher, providerMetricSender: async () => {}})(scanRequest(), baseEnv);
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(marketplaceCalls,0);
  assert.deepEqual(result.items.map(value=>[value.priceSource,value.ebayComparableCount]),[['ai_estimate',0],['ai_estimate',0]]);
  assert.deepEqual([result.items[0].lowValue,result.items[0].typicalValue,result.items[0].highValue],[0,0,0]);
});

test('EBAY-02c generic unidentified television is not enriched', async () => {
  let marketplaceCalls=0;
  const television=item(1,{name:'Older flat-screen television',category:'Electronics',confidence:'low',searchQuery:'old flat screen TV'});
  const fetcher=async url=>{
    if(String(url).includes('openai.com')) return openAIResponse([television]);
    marketplaceCalls++;
    return String(url).includes('/identity/')?tokenResponse():browseResponse([
      listing('Samsung 55 inch smart TV',300),listing('LG 4K smart TV',400),listing('Sony OLED TV',500),
    ]);
  };
  const response=await createHandler({fetcher,providerMetricSender:async()=>{}})(scanRequest(),baseEnv);
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(marketplaceCalls,0);
  assert.deepEqual(result.items[0],{...television,priceSource:'ai_estimate',ebayComparableCount:0});
});

test('EBAY-02d exact-model television remains eligible', async () => {
  const television=item(1,{name:'Samsung UN55NU6900 television',category:'Electronics',searchQuery:'Samsung UN55NU6900 55 inch TV'});
  const fetcher=async url=>String(url).includes('openai.com')?openAIResponse([television])
    :String(url).includes('/identity/')?tokenResponse():browseResponse([
      listing('Samsung UN55NU6900 55 inch TV',80),listing('Samsung UN55NU6900 55 inch television',100),listing('Samsung UN55NU6900 55 TV tested',120),
    ]);
  const response=await createHandler({fetcher,providerMetricSender:async()=>{}})(scanRequest(),baseEnv);
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.items[0].priceSource,'ebay_active');
  assert.equal(result.items[0].ebayComparableCount,3);
  assert.deepEqual([result.items[0].lowValue,result.items[0].typicalValue,result.items[0].highValue],[90,100,110]);
});

test('EBAY-02e rejects wrong-size and accessory-only electronics listings', async () => {
  const television=item(1,{name:'Samsung UN55NU6900 television',category:'Electronics',searchQuery:'Samsung UN55NU6900 55 inch TV'});
  const fetcher=async url=>String(url).includes('openai.com')?openAIResponse([television])
    :String(url).includes('/identity/')?tokenResponse():browseResponse([
      listing('Samsung UN55NU6900 55 inch TV',80),listing('Samsung UN55NU6900 55 inch television tested',100),
      listing('Samsung UN55NU6900 65 inch TV',200),listing('Samsung UN55NU6900 remote only',15),
      listing('Samsung UN55NU6900 stand only',20),listing('Samsung UN55NU6900 power board',25),
    ]);
  const response=await createHandler({fetcher,providerMetricSender:async()=>{}})(scanRequest(),baseEnv);
  const result=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(result.items[0],{...television,priceSource:'ai_estimate',ebayComparableCount:0});
});

test('EBAY-03 enriches at most ten items with bounded concurrency and one cached OAuth token', async () => {
  let tokenCalls = 0; let activeBrowse = 0; let maxActiveBrowse = 0; let browseCalls = 0;
  const fetcher = async url => {
    if (String(url).includes('openai.com')) return openAIResponse(Array.from({length: 11}, (_, index) => item(index)));
    if (String(url).includes('/identity/')) { tokenCalls++; return tokenResponse(); }
    browseCalls++; activeBrowse++; maxActiveBrowse = Math.max(maxActiveBrowse, activeBrowse);
    await new Promise(resolve => setTimeout(resolve, 5));
    activeBrowse--;
    return browseResponse([listing('Canon AE-1 camera one', 10), listing('Canon AE-1 camera two', 20), listing('Canon AE-1 camera three', 30)]);
  };
  const response = await createHandler({fetcher, providerMetricSender: async () => {}})(scanRequest(), baseEnv);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.items.length, 10);
  assert.equal(browseCalls, 10);
  assert.equal(tokenCalls, 1);
  assert.ok(maxActiveBrowse > 1 && maxActiveBrowse <= 3, `max concurrency was ${maxActiveBrowse}`);
  assert.ok(result.items.every(value => value.priceSource === 'ebay_active' && value.ebayComparableCount === 3));
});

test('EBAY-04 OAuth or Browse failure silently falls back to AI metadata without raw-listing logs', async () => {
  const logs = []; const originalError = console.error; const originalInfo = console.info;
  console.error = (...args) => logs.push(args); console.info = (...args) => logs.push(args);
  try {
    for (const failure of ['oauth', 'browse']) {
      const fetcher = async url => {
        if (String(url).includes('openai.com')) return openAIResponse([item(1)]);
        if (String(url).includes('/identity/')) return failure === 'oauth' ? new Response('PRIVATE oauth', {status: 503}) : tokenResponse();
        return new Response('PRIVATE raw listing', {status: 503});
      };
      const response = await createHandler({fetcher, providerMetricSender: async () => {}})(scanRequest(), baseEnv);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).items[0], {...item(1), priceSource: 'ai_estimate', ebayComparableCount: 0});
    }
    assert.equal(JSON.stringify(logs).includes('PRIVATE'), false);
  } finally { console.error = originalError; console.info = originalInfo; }
});

test('EBAY-05 deletion challenge hashes the exact configured endpoint and verification token', async () => {
  const endpoint = 'https://cluttercash-api.zeroleveldev.workers.dev/v1/ebay/account-deletion';
  const token = 'synthetic-verification-token-123456';
  const challenge = 'syntheticChallenge123';
  const env = {EBAY_DELETION_ENDPOINT_URL: endpoint, EBAY_DELETION_VERIFICATION_TOKEN: token};
  const response = await createHandler()(new Request(`${endpoint}?challenge_code=${challenge}`), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Type'), /^application\/json/);
  assert.deepEqual(await response.json(), {
    challengeResponse: createHash('sha256').update(challenge + token + endpoint).digest('hex'),
  });
});

test('EBAY-06 deletion challenge fails closed for invalid input or incomplete configuration', async () => {
  const endpoint = 'https://cluttercash-api.zeroleveldev.workers.dev/v1/ebay/account-deletion';
  const configured = {EBAY_DELETION_ENDPOINT_URL: endpoint, EBAY_DELETION_VERIFICATION_TOKEN: 'synthetic-verification-token-123456'};
  for (const [url, env] of [
    [endpoint, configured], [`${endpoint}?challenge_code=${'x'.repeat(129)}`, configured],
    [`${endpoint}?challenge_code=validChallenge`, {...configured, EBAY_DELETION_VERIFICATION_TOKEN: undefined}],
    [`${endpoint}?challenge_code=validChallenge`, {...configured, EBAY_DELETION_ENDPOINT_URL: endpoint + '/wrong'}],
  ]) {
    const response = await createHandler()(new Request(url), env);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('EBAY-07 bounded deletion notification topic is acknowledged with no persistence', async () => {
  const endpoint = 'https://cluttercash-api.zeroleveldev.workers.dev/v1/ebay/account-deletion';
  const env = {EBAY_DELETION_ENDPOINT_URL: endpoint, EBAY_DELETION_VERIFICATION_TOKEN: 'synthetic-verification-token-123456'};
  const valid = JSON.stringify({metadata: {topic: 'MARKETPLACE_ACCOUNT_DELETION'}, notification: {notificationId: 'abc'}});
  const response = await createHandler()(new Request(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: valid}), env);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  for (const request of [
    new Request(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({metadata: {topic: 'OTHER'}})}),
    new Request(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: 'x'.repeat(16 * 1024 + 1)}),
  ]) assert.ok([400, 413].includes((await createHandler()(request, env)).status));
});
