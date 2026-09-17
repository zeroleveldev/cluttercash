import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// Synthetic, injected Stripe resources; no Stripe/AI network access.
test('mounted webhook in workerd persists concurrent replay, renewal and terminal cancellation',async()=>{
 const principal='a'.repeat(64),now=1800000000000,secret='whsec_runtime_synthetic';
 const bundle=await build({stdin:{resolveDir:resolve('.'),contents:`
 import {createHandler,BetaUsageLimiter as Base} from './src/worker.js';
 export class RuntimeLedger extends Base {
 async fetch(request){const path=new URL(request.url).pathname;
 if(path==='/seed'){await this.storage.put('paid-binding:cus_fixture',{principal:'${principal}',subscriptionId:'sub_fixture'});return Response.json({ok:true});}
 if(path==='/inspect')return Response.json({credit:await this.storage.get('paid-credit:${principal}'),blocked:await this.storage.get('paid-block:sub_fixture')||false});
 return super.fetch(request);}}
 const price={id:'price_fixture',object:'price',livemode:false,active:true,currency:'usd',unit_amount:199,type:'recurring',billing_scheme:'per_unit',product:'prod_fixture',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
 export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(['/seed','/inspect','/reserve'].includes(path))return env.BETA_USAGE_LIMITER.get(env.BETA_USAGE_LIMITER.idFromName('global')).fetch(request);
 // Injection control lives ONLY in this runtime test bundle, never production.
 const renewal=request.headers.get('test-renewal')==='yes',canceled=request.headers.get('test-canceled')==='yes';
 const start=renewal?1802678400:1800000000,end=renewal?1805270400:1802678400;
 const item={id:'si_fixture',subscription:'sub_fixture',price,quantity:1,current_period_start:start,current_period_end:end};
 const subscription={id:'sub_fixture',object:'subscription',livemode:false,customer:'cus_fixture',status:canceled?'canceled':'active',currency:'usd',items:{has_more:false,data:[item]}};
 const line={object:'line_item',livemode:false,currency:'usd',amount:199,quantity:1,period:{start,end},parent:{type:'subscription_item_details',subscription_item_details:{subscription:'sub_fixture',subscription_item:'si_fixture',proration:false}},pricing:{type:'price_details',price_details:{price:price.id,product:price.product}}};
 const adapter={price:async()=>price,subscription:async()=>subscription,invoice:async(id)=>({id,object:'invoice',livemode:false,customer:'cus_fixture',status:'paid',currency:'usd',amount_paid:199,amount_due:199,amount_remaining:0,billing_reason:'subscription_cycle',parent:{type:'subscription_details',subscription_details:{subscription:'sub_fixture'}},lines:{has_more:false,data:[line]}})};
 return createHandler({now:()=>${now},stripeAdapterFactory:()=>adapter})(request,env);
 }};`},bundle:true,write:false,format:'esm',platform:'browser'});
 const directory=await mkdtemp(join(tmpdir(),'cluttercash-webhook-'));
 const options={...convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',durableObjects:{BETA_USAGE_LIMITER:{className:'RuntimeLedger',useSQLite:true}},bindings:{STRIPE_BILLING_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:secret,STRIPE_PRICE_ID:'price_fixture',STRIPE_PRODUCT_ID:'prod_fixture'}}),resourcePersistencePath:directory};
 let mf=new Miniflare(options);
 const inspect=async()=> (await mf.dispatchFetch('http://localhost/inspect')).json();
 const send=async({id='evt_fixture',invoice='in_fixture',renewal=false,canceled=false,type='invoice.paid'}={})=>{
 const body=JSON.stringify({id,object:'event',api_version:'2026-08-26.dahlia',livemode:false,type,data:{object:{id:type==='customer.subscription.deleted'?'sub_fixture':invoice}}});
 const signature=createHmac('sha256',secret).update(`${now/1000}.${body}`).digest('hex');
 return mf.dispatchFetch('http://localhost/v1/billing/webhook',{method:'POST',body,headers:{'Stripe-Signature':`t=${now/1000},v1=${signature}`,'test-renewal':renewal?'yes':'no','test-canceled':canceled?'yes':'no'}});
 };
 try{
 assert.equal((await mf.dispatchFetch('http://localhost/seed')).status,200);
 const deliveries=await Promise.all(Array.from({length:12},()=>send()));
 assert.ok(deliveries.every(r=>r.status===200));assert.equal((await inspect()).credit.remaining,10);
 const reserve={day:'2027-01-15',timestamp:now+1000,inviteHash:`paid:${principal}`,inviteLimit:3,inviteWindowMs:604800000,budgetMicroUsd:100,requestCostMicroUsd:1};
 const r=await mf.dispatchFetch('http://localhost/reserve',{method:'POST',body:JSON.stringify(reserve)});assert.equal((await r.json()).allowed,true);
 await mf.dispose();mf=new Miniflare(options);
 assert.equal((await send({id:'evt_replay'})).status,200);assert.equal((await inspect()).credit.remaining,9);
 assert.equal((await send({id:'evt_renew',invoice:'in_renew',renewal:true})).status,200);assert.equal((await inspect()).credit.remaining,10);
 assert.equal((await send({id:'evt_old',invoice:'in_old'})).status,200);assert.equal((await inspect()).credit.periodStart,1802678400000);
 assert.equal((await send({id:'evt_cancel',type:'customer.subscription.deleted',canceled:true})).status,200);
 assert.equal((await inspect()).blocked,true);
 // Even a stale active retrieval racing after terminal cancellation cannot grant.
 assert.equal((await send({id:'evt_race',invoice:'in_race',renewal:true})).status,503);
 assert.equal((await inspect()).blocked,true);
 }finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
