import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {resolve} from 'node:path';

test('public paid scan and status use verified sessions with atomic SQLite quota; no fallback or redirect grant',async()=>{
 const principal='a'.repeat(64),token='b'.repeat(64),timestamp=1800000000000;
 const sessionHash=createHash('sha256').update(token).digest('hex');
 const bundle=await build({stdin:{contents:`import {BetaUsageLimiter as Base,createHandler} from './src/worker.js';
 export class PaidTest extends Base {async fetch(r){const p=new URL(r.url).pathname;
 if(p==='/fixture'){const values=await r.json();await this.storage.put(values);return Response.json({ok:true});}
 if(p==='/inspect')return Response.json(Object.fromEntries(await this.storage.list()));return super.fetch(r);}}
 const handler=createHandler({now:()=>${timestamp},alertSender:async()=>true,fetcher:async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({sceneSummary:'Shelf',items:[],exactName:'Camera',confidence:'high'})}]}}]})});
 export default {fetch(r,e){if(['/fixture','/inspect'].includes(new URL(r.url).pathname))return e.BETA_USAGE_LIMITER.get(e.BETA_USAGE_LIMITER.idFromName('global')).fetch(r);return handler(r,e);}};`,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',durableObjects:{BETA_USAGE_LIMITER:{className:'PaidTest',useSQLite:true}},bindings:{STRIPE_BILLING_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_PRICE_ID:'price_fixture',STRIPE_PRODUCT_ID:'prod_fixture',SUBSCRIBER_APP_ORIGIN:'https://app.example',ALLOWED_ORIGIN:'https://app.example',GEMINI_API_KEY:'synthetic',GEMINI_MODEL:'gemini-2.5-flash-lite',GEMINI_MAX_REQUEST_COST_MICRO_USD:'500000',BETA_DAILY_BUDGET_MICRO_USD:'100000000',BETA_WEEKLY_REQUEST_LIMIT:'3',BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD:'5000000',BETA_ANONYMOUS_NETWORK_DAILY_LIMIT:'10',BETA_INVITE_CODE_HASHES:JSON.stringify([createHash('sha256').update('owner-fixture').digest('hex')]),BETA_OWNER_INVITE_CODE_HASHES:JSON.stringify([createHash('sha256').update('owner-fixture').digest('hex')])}}));
 const seed=async values=>assert.equal((await mf.dispatchFetch('http://localhost/fixture',{method:'POST',body:JSON.stringify(values)})).status,200);
 const inspect=async()=> (await mf.dispatchFetch('http://localhost/inspect',{method:'POST'})).json();
 const status=async()=>{const r=await mf.dispatchFetch('http://localhost/v1/billing/status',{method:'POST',headers:{Origin:'https://app.example',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');return r.json();};
 const scan=async(route='scans',auth='Bearer '+token,extra={})=>{const body=new FormData();body.set('image',new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'}),'photo.jpg');body.set('betaConsent','true');if(route==='items/identify')body.set('itemName','Camera');const serialized=new Request('http://localhost',{method:'POST',body});return mf.dispatchFetch('http://localhost/v1/'+route,{method:'POST',headers:{'Content-Type':serialized.headers.get('Content-Type'),'CF-Connecting-IP':'192.0.2.1',Origin:'https://app.example',...(auth===null?{}:{Authorization:auth}),...extra},body:await serialized.arrayBuffer()});};
 const credit={subscriptionId:'sub_fixture',periodStart:timestamp-1000,periodEnd:timestamp+100000,remaining:10};
 try {
 const preflight=await mf.dispatchFetch('http://localhost/v1/scans',{method:'OPTIONS',headers:{Origin:'https://app.example','Access-Control-Request-Headers':'authorization'}});assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Authorization/i);
 await seed({['subscriber:session:'+sessionHash]:{principal,expiresAt:timestamp+1000000},['checkout-principal:'+principal]:{subscriptionId:'sub_fixture',customerId:'cus_fixture'}});
 let s=await status();assert.equal(s.bound,true);assert.equal(s.entitled,false);assert.equal(s.state,'awaiting_payment');
 {const response=await scan();assert.equal(response.status,429,await response.text());}
 for(const route of ['scans','items/identify'])assert.equal((await scan(route,'Bearer invalid',{'X-ClutterCash-Invite':'owner-fixture','X-ClutterCash-Device':'c'.repeat(64)})).status,401);
 await seed({['paid-credit:'+principal]:credit});s=await status();assert.equal(s.entitled,true);assert.equal(s.periodStart,credit.periodStart);assert.equal(s.renewalStatus,'not_confirmed');
 assert.equal(JSON.stringify(s).includes('cus_fixture'),false);assert.equal(JSON.stringify(s).includes(principal),false);
 const responses=await Promise.all(Array.from({length:20},(_,i)=>scan(i%2?'scans':'items/identify')));assert.equal(responses.filter(r=>r.status===200).length,10);assert.equal(responses.filter(r=>r.status===429).length,10);
 s=await status();assert.equal(s.state,'exhausted');assert.equal(s.remaining,0);
 let records=await inspect();const budgetKey=new Date(timestamp).toISOString().slice(0,10)+':budget';assert.equal(records[budgetKey],5000000);
 await seed({['paid-credit:'+principal]:credit,[budgetKey]:100000000});assert.equal((await scan()).status,429);assert.equal((await inspect())['paid-credit:'+principal].remaining,10,'budget denial cannot debit');
 await seed({[budgetKey]:0,['paid-credit:'+principal]:{...credit,periodEnd:timestamp}});assert.equal((await scan()).status,429);assert.equal((await status()).state,'expired');
 await seed({['paid-credit:'+principal]:credit,'paid-block:sub_fixture':true});assert.equal((await scan()).status,429);assert.equal((await status()).state,'blocked');
 await seed({['subscriber:session:'+sessionHash]:{principal,expiresAt:timestamp}});assert.equal((await scan('scans','Bearer '+token,{'X-ClutterCash-Invite':'owner-fixture'})).status,401);
 for(let i=0;i<3;i++)assert.equal((await scan('scans',null,{'X-ClutterCash-Device':'c'.repeat(64)})).status,200);assert.equal((await scan('scans',null,{'X-ClutterCash-Device':'c'.repeat(64)})).status,429);
 assert.equal((await scan('scans',null,{'X-ClutterCash-Invite':'owner-fixture'})).status,200);
 }finally{await mf.dispose();}
});
