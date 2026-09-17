import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createHandler,BetaUsageLimiter} from '../src/worker.js';
import {createStripeAdapter,STRIPE_API_VERSION} from '../src/stripe-billing.js';

test('official SDK adapter pins version on each retrieval without network',async(t)=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url:String(url),headers:new Headers(options.headers)});return new Response(JSON.stringify({id:'fixture'}),{status:200,headers:{'Content-Type':'application/json'}});});
 const api=createStripeAdapter({STRIPE_SECRET_KEY:'sk_test_synthetic'});
 await api.invoice('in_fixture');await api.subscription('sub_fixture');await api.price('price_fixture');
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/v1/invoices/in_fixture','/v1/subscriptions/sub_fixture','/v1/prices/price_fixture']);
 assert.ok(calls.every(c=>c.headers.get('Stripe-Version')===STRIPE_API_VERSION));
});
const now=1800000000000, version='2026-08-26.dahlia', principal='a'.repeat(64);
const config={STRIPE_BILLING_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:'whsec_synthetic',STRIPE_PRICE_ID:'price_fixture',STRIPE_PRODUCT_ID:'prod_fixture'};
function fixture(){
 const price={id:'price_fixture',object:'price',livemode:false,active:true,currency:'usd',unit_amount:199,type:'recurring',billing_scheme:'per_unit',product:'prod_fixture',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
 const item={id:'si_fixture',subscription:'sub_fixture',price,quantity:1,current_period_start:1800000000,current_period_end:1802678400};
 const subscription={id:'sub_fixture',object:'subscription',customer:'cus_fixture',livemode:false,status:'active',currency:'usd',items:{data:[item],has_more:false}};
 const line={object:'line_item',livemode:false,amount:199,currency:'usd',quantity:1,quantity_decimal:'1',period:{start:item.current_period_start,end:item.current_period_end},pricing:{type:'price_details',price_details:{price:price.id,product:price.product}},parent:{type:'subscription_item_details',subscription_item_details:{subscription:'sub_fixture',subscription_item:'si_fixture',proration:false}}};
 const invoice={id:'in_fixture',object:'invoice',livemode:false,customer:'cus_fixture',status:'paid',amount_paid:199,amount_due:199,amount_remaining:0,currency:'usd',billing_reason:'subscription_cycle',parent:{type:'subscription_details',subscription_details:{subscription:'sub_fixture'}},lines:{has_more:false,data:[line]}};
 return {price,subscription,invoice,line,item};
}
function setup({bound=true,envPatch={},change=()=>{},fail=false}={}){
 const f=fixture();change(f);const calls=[];const values=new Map(bound?[[`paid-binding:cus_fixture`,{principal,subscriptionId:'sub_fixture'}]]:[]);
 const storage={get:async k=>values.get(k),put:async(k,v)=>{if(typeof k==='object')for(const [a,b]of Object.entries(k))values.set(a,b);else values.set(k,v);},transaction:async cb=>cb(storage)};
 const env={...config,...envPatch};const limiter=new BetaUsageLimiter({storage},env);env.BETA_USAGE_LIMITER={idFromName:()=> 'global',get:()=>limiter};
 const adapter={};for(const name of ['invoice','subscription','price'])adapter[name]=async id=>{calls.push([name,id]);if(fail)throw Error('PRIVATE');return f[name];};
 const handler=createHandler({now:()=>now,stripeAdapterFactory:()=>adapter});
 const send=async(type='invoice.paid',patch={},options={})=>{
 const event={id:'evt_fixture',object:'event',type,api_version:version,livemode:false,data:{object:{id:type.startsWith('customer.')?'sub_fixture':'in_fixture',...patch}}};
 const body=JSON.stringify(event),sig=createHmac('sha256',config.STRIPE_WEBHOOK_SECRET).update(`${now/1000}.${body}`).digest('hex');
 return handler(new Request('https://test/v1/billing/webhook',{method:'POST',body,headers:{'Stripe-Signature':`t=${now/1000},v1=${sig}`,...options.headers}}),env);
 };return {send,values,calls,handler,env,f};
}
test('mounted webhook retrieves authoritative data, grants once and ignores payload money',async()=>{const s=setup();assert.equal((await s.send('invoice.paid',{amount_paid:0,customer:'cus_attacker'})).status,200);assert.equal(s.values.get(`paid-credit:${principal}`).remaining,10);s.values.get(`paid-credit:${principal}`).remaining=4;await s.send();assert.equal(s.values.get(`paid-credit:${principal}`).remaining,4);assert.deepEqual(s.calls.slice(0,3),[['invoice','in_fixture'],['subscription','sub_fixture'],['price','price_fixture']]);});
for(const [name,change] of [
 ['unpaid',f=>f.invoice.status='open'],['underpaid',f=>f.invoice.amount_paid=198],['currency',f=>f.price.currency='eur'],['amount',f=>f.price.unit_amount=299],['product',f=>f.price.product='prod_wrong'],['year',f=>f.price.recurring.interval='year'],['quantity',f=>f.item.quantity=2],['decimal quantity',f=>f.line.quantity_decimal='1.5'],['inactive',f=>f.subscription.status='past_due'],['live invoice',f=>f.invoice.livemode=true],['live price',f=>f.price.livemode=true],['live subscription',f=>f.subscription.livemode=true],['customer mismatch',f=>f.subscription.customer='cus_other'],['proration',f=>f.line.parent.subscription_item_details.proration=true],['incomplete lines',f=>f.invoice.lines.has_more=true],['incomplete items',f=>f.subscription.items.has_more=true],['period mismatch',f=>f.line.period.end++],['manual',f=>f.invoice.billing_reason='manual'],['wrong retrieved id',f=>f.invoice.id='in_other'],['missing resource',f=>f.invoice={}],
])test(`reject authoritative ${name} without grant`,async()=>{const s=setup({change});assert.equal((await s.send()).status,400);assert.equal(s.values.has(`paid-credit:${principal}`),false);});
test('unbound customer rejected and nothing stored',async()=>{const s=setup({bound:false});assert.equal((await s.send()).status,400);assert.equal(s.values.size,0);});
for(const key of Object.keys(config))test(`missing ${key} fails closed before API`,async()=>{const s=setup({envPatch:{[key]:undefined}});assert.equal((await s.send()).status,503);assert.equal(s.calls.length,0);});
test('invalid signature prevents API retrieval',async()=>{const s=setup();assert.equal((await s.send('invoice.paid',{}, {headers:{'Stripe-Signature':'invalid'}})).status,400);assert.equal(s.calls.length,0);});
test('oversized stream rejected before retrieval',async()=>{const s=setup();const r=await s.handler(new Request('https://test/v1/billing/webhook',{method:'POST',body:'x'.repeat(262145)}),s.env);assert.equal(r.status,413);assert.equal(s.calls.length,0);});
test('retrieval failure is sanitized and retriable',async()=>{const s=setup({fail:true});const r=await s.send();assert.equal(r.status,503);assert.equal((await r.text()).includes('PRIVATE'),false);});
test('failed payment never grants or latches; later paid retrieval recovers',async()=>{const s=setup();s.f.invoice.status='open';s.f.invoice.amount_paid=0;assert.equal((await s.send('invoice.payment_failed')).status,200);assert.equal(s.values.has('paid-block:sub_fixture'),false);assert.equal(s.values.has(`paid-credit:${principal}`),false);s.f.invoice.status='paid';s.f.invoice.amount_paid=199;assert.equal((await s.send()).status,200);assert.equal(s.values.get(`paid-credit:${principal}`).remaining,10);await s.send('invoice.payment_failed');assert.equal(s.values.get(`paid-credit:${principal}`).remaining,10);});
test('retrieved terminal cancellation blocks and late invoices cannot reopen',async()=>{const s=setup();await s.send();s.f.subscription.status='canceled';assert.equal((await s.send('customer.subscription.deleted')).status,200);assert.equal(s.values.get('paid-block:sub_fixture'),true);assert.equal((await s.send()).status,400);});
test('ledger failure is retriable and never acknowledged',async()=>{const s=setup();s.env.BETA_USAGE_LIMITER.get=()=>({fetch:async()=>{throw Error('PRIVATE_STORAGE');}});const r=await s.send();assert.equal(r.status,503);assert.equal((await r.text()).includes('PRIVATE_STORAGE'),false);assert.equal(s.values.has(`paid-credit:${principal}`),false);});
test('deleted notification with currently active resource cannot latch',async()=>{const s=setup();assert.equal((await s.send('customer.subscription.deleted')).status,400);assert.equal(s.values.has('paid-block:sub_fixture'),false);});
