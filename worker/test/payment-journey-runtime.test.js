import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// All fixture routes/adapters exist only in this test bundle. No entitlement seeds.
test('mounted identity/payment/scan journey: three purchases, expired retries, renewal, old events and restart',async()=>{
 const secret='whsec_journey_fixture',origin='https://app.example';let clock=1800000000000;
 const price={id:'price_fixture',object:'price',livemode:false,active:true,currency:'usd',unit_amount:199,type:'recurring',billing_scheme:'per_unit',product:'prod_fixture',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
 const resources={price,sessions:{},subs:{},invoices:{}};
 const bundle=await build({stdin:{resolveDir:resolve('.'),contents:`
 import {createHandler,BetaUsageLimiter as Base} from './src/worker.js';
 export class Journey extends Base {async fetch(r){if(new URL(r.url).pathname==='/inspect')return Response.json(Object.fromEntries(await this.storage.list()));return super.fetch(r);}}
 let mail;
 export default {async fetch(r,e){const path=new URL(r.url).pathname;
 if(path==='/inspect')return e.BETA_USAGE_LIMITER.get(e.BETA_USAGE_LIMITER.idFromName('global')).fetch(r);
 if(path==='/mail')return Response.json(mail);
 const f=JSON.parse(r.headers.get('test-resources')||'{}');
 const api={price:async()=>f.price,subscription:async id=>f.subs[id],invoice:async id=>f.invoices[id],checkout:async id=>f.sessions[id],
 subscriptions:async(customer,after)=>{const all=Object.values(f.subs);const start=after?all.findIndex(s=>s.id===after)+1:0;return {object:'list',has_more:start+1<all.length,data:all.slice(start,start+1)};},
 createCustomer:async()=>({id:'cus_fixture',object:'customer',livemode:false}),
 createCheckout:async p=>({id:'cs_test_'+p.metadata.cluttercash_attempt,object:'checkout.session',livemode:false,mode:'subscription',customer:p.customer,url:'https://checkout.stripe.com/c/pay/fixture'})};
 return createHandler({now:()=>Number(r.headers.get('test-clock')),stripeAdapterFactory:()=>api,subscriberEmailSender:async m=>{mail=m;return true;},alertSender:async()=>true,providerMetricSender:async()=>{},fetcher:async()=>Response.json({id:'resp_fixture',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({sceneSummary:'Shelf',items:[]})}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}})})(r,e);
 }};`},bundle:true,write:false,format:'esm',platform:'browser'});
 const directory=await mkdtemp(join(tmpdir(),'cc-journey-'));
 const options={...convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',durableObjects:{BETA_USAGE_LIMITER:{className:'Journey',useSQLite:true}},bindings:{STRIPE_BILLING_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:secret,STRIPE_PRICE_ID:price.id,STRIPE_PRODUCT_ID:price.product,SUBSCRIBER_APP_ORIGIN:origin,ALLOWED_ORIGIN:origin,SUBSCRIBER_EMAIL_ENABLED:'true',SUBSCRIBER_IDENTITY_SECRET:'synthetic-secret-'.repeat(4),OPENAI_API_KEY:'synthetic',OPENAI_MODEL:'gpt-5-nano',OPENAI_MAX_REQUEST_COST_MICRO_USD:'500000',BETA_DAILY_BUDGET_MICRO_USD:'100000000',BETA_WEEKLY_REQUEST_LIMIT:'3',BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD:'5000000',BETA_ANONYMOUS_NETWORK_DAILY_LIMIT:'10'}}),resourcePersistencePath:directory};
 let mf=new Miniflare(options),token;
 const headers=()=>({Origin:origin,'test-clock':String(clock),'test-resources':JSON.stringify(resources),'CF-Connecting-IP':'192.0.2.1',...(token?{Authorization:'Bearer '+token}:{})});
 const call=(path,body={})=>mf.dispatchFetch('http://localhost'+path,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify(body)});
 const inspect=async()=> (await call('/inspect')).json();
 const status=async()=> (await call('/v1/billing/status')).json();
 const scan=async()=>{const body=new FormData();body.set('image',new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'}),'photo.jpg');body.set('betaConsent','true');const req=new Request('http://localhost',{method:'POST',body});return mf.dispatchFetch('http://localhost/v1/scans',{method:'POST',headers:{...headers(),'Content-Type':req.headers.get('Content-Type')},body:await req.arrayBuffer()});};
 let event=0;
 const send=async(type,id)=>{const body=JSON.stringify({id:'evt_journey'+(++event),object:'event',api_version:'2026-08-26.dahlia',livemode:false,type,data:{object:{id}}});const signature=createHmac('sha256',secret).update(`${clock/1000}.${body}`).digest('hex');return mf.dispatchFetch('http://localhost/v1/billing/webhook',{method:'POST',body,headers:{...headers(),'Stripe-Signature':`t=${clock/1000},v1=${signature}`}});};
 const invoice=(sub,id)=>{const item=sub.items.data[0];resources.invoices[id]={id,object:'invoice',livemode:false,customer:sub.customer,status:'paid',currency:'usd',amount_paid:199,amount_due:199,amount_remaining:0,billing_reason:'subscription_cycle',parent:{type:'subscription_details',subscription_details:{subscription:sub.id}},lines:{has_more:false,data:[{object:'line_item',livemode:false,currency:'usd',amount:199,quantity:1,period:{start:item.current_period_start,end:item.current_period_end},parent:{type:'subscription_item_details',subscription_item_details:{subscription:sub.id,subscription_item:item.id,proration:false}},pricing:{type:'price_details',price_details:{price:price.id,product:price.product}}}]}};};
 let principal;
 const track=async()=>{const r=(await inspect())['checkout-principal:'+principal];resources.sessions[r.sessionId]={id:r.sessionId,object:'checkout.session',livemode:false,mode:'subscription',customer:r.customerId,status:'open',subscription:null,metadata:{cluttercash_attempt:r.attempt},url:'https://checkout.stripe.com/c/pay/fixture'};return resources.sessions[r.sessionId];};
 try{
 assert.equal((await call('/v1/billing/checkout')).status,401);
 const browserToken='a'.repeat(64);assert.equal((await call('/v1/subscriber/challenge',{email:'payer@example.com',browserToken})).status,202);
 const mail=await (await call('/mail')).json(),cap=new URL(mail.url).hash.split('=').at(-1);
 assert.equal((await call('/v1/subscriber/verify',{token:cap,browserToken:'b'.repeat(64)})).status,401);
 const verified=await call('/v1/subscriber/verify',{token:cap,browserToken});assert.equal(verified.status,200);token=(await verified.json()).sessionToken;
 assert.equal((await call('/v1/subscriber/verify',{token:cap,browserToken})).status,401);
 principal=(await (await call('/v1/subscriber/session')).json()).principal;
 for(let cycle=0;cycle<3;cycle++){
 assert.equal((await call('/v1/billing/checkout',{customerId:'cus_forged'})).status,400);
 const attempts=await Promise.all(Array.from({length:6},()=>call('/v1/billing/checkout')));assert.ok(attempts.some(r=>r.status===200));
 let session=await track();
 if(cycle){session.status='expired';const before=session;
 const retries=await Promise.all(Array.from({length:6},()=>call('/v1/billing/checkout')));assert.equal(retries.filter(r=>r.status===200).length,1);session=await track();assert.notEqual(session.id,before.id);
 before.status='complete';before.subscription='sub_cycle0';assert.equal((await send('checkout.session.completed',before.id)).status,503);
 }
 assert.equal((await status()).entitled,false);assert.equal((await scan()).status,429);
 const sub={id:'sub_cycle'+cycle,object:'subscription',livemode:false,customer:'cus_fixture',currency:'usd',status:'active',items:{has_more:false,data:[{id:'si_cycle'+cycle,subscription:'sub_cycle'+cycle,price,quantity:1,current_period_start:clock/1000,current_period_end:clock/1000+3600}]}};resources.subs[sub.id]=sub;
 session.status='complete';session.subscription=sub.id;invoice(sub,'in_cycle'+cycle);
 assert.equal((await send('invoice.paid','in_cycle'+cycle)).status,503,'invoice before binding retriable');
 assert.equal((await send('checkout.session.completed',session.id)).status,200);assert.equal((await status()).entitled,false);
 assert.equal((await send('invoice.paid','in_cycle'+cycle)).status,200);
 assert.equal((await call('/v1/billing/checkout')).status,409);
 const scans=await Promise.all(Array.from({length:12},()=>scan()));assert.equal(scans.filter(r=>r.status===200).length,10);assert.equal(scans.filter(r=>r.status===429).length,2);
 await mf.dispose();mf=new Miniflare(options);assert.equal((await status()).remaining,0);
 assert.equal((await send('invoice.paid','in_cycle'+cycle)).status,200);assert.equal((await status()).remaining,0);
 clock+=3600000;sub.items.data[0].current_period_start=clock/1000;sub.items.data[0].current_period_end=clock/1000+3600;invoice(sub,'in_renew'+cycle);
 assert.equal((await send('invoice.paid','in_renew'+cycle)).status,200);assert.equal((await scan()).status,200);assert.equal((await status()).remaining,9);
 for(let old=0;old<cycle;old++){
 const prior=resources.subs['sub_cycle'+old];assert.equal((await send('customer.subscription.deleted',prior.id)).status,200);assert.equal((await send('invoice.payment_failed','in_renew'+old)).status,200);
 prior.status='active';assert.equal((await send('invoice.paid','in_renew'+old)).status,200);prior.status='canceled';
 const oldSession=Object.values(resources.sessions).find(s=>s.subscription===prior.id);assert.equal((await send('checkout.session.completed',oldSession.id)).status,503);
 }
 assert.equal((await status()).remaining,9);assert.equal((await status()).blocked,false);
 sub.status='canceled';assert.equal((await send('customer.subscription.deleted',sub.id)).status,200);assert.equal((await scan()).status,429);
 }
 const records=await inspect();assert.ok(records['paid-retired:sub_cycle0']);assert.ok(records['paid-retired:sub_cycle1']);assert.ok(records['paid-invoice:in_cycle0']);assert.ok(records['paid-invoice:in_cycle1']);
 }finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
