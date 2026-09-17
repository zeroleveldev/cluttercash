import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createStripeAdapter,STRIPE_API_VERSION} from '../src/stripe-billing.js';
import {createHandler,BetaUsageLimiter} from '../src/worker.js';
const principal='a'.repeat(64),token='b'.repeat(64),timestamp=1800000000000;
function setup(){
 const values=new Map([['subscriber:session:'+createHash('sha256').update(token).digest('hex'),{principal,expiresAt:timestamp+86400000}]]);let queue=Promise.resolve();
 const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>{if(typeof k==='object')for(const [a,b]of Object.entries(k))values.set(a,structuredClone(b));else values.set(k,structuredClone(v));},transaction(cb){const run=queue.then(()=>cb(storage));queue=run.catch(()=>{});return run;},getAlarm:async()=>null,setAlarm:async()=>{}};
 const env={STRIPE_BILLING_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:'whsec_synthetic',STRIPE_PRICE_ID:'price_fixture',STRIPE_PRODUCT_ID:'prod_fixture',SUBSCRIBER_APP_ORIGIN:'https://app.example'};
 const limiter=new BetaUsageLimiter({storage},env);env.BETA_USAGE_LIMITER={idFromName:n=>n,get:()=>({fetch:(u,o)=>limiter.fetch(new Request(u,o))})};
 const price={id:'price_fixture',object:'price',livemode:false,active:true,currency:'usd',unit_amount:199,type:'recurring',billing_scheme:'per_unit',product:'prod_fixture',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
 const session={id:'cs_test_fixture',object:'checkout.session',livemode:false,mode:'subscription',status:'open',customer:'cus_fixture',url:'https://checkout.stripe.com/c/pay/fixture'};const calls=[];
 const api={price:async()=>price,createCustomer:async(p,o)=>{calls.push(['customer',p,o]);return {id:'cus_fixture',object:'customer',livemode:false};},createCheckout:async(p,o)=>{calls.push(['checkout',p,o]);session.metadata=p.metadata;return session;},checkout:async()=>session,subscription:async()=>({id:'sub_fixture',object:'subscription',livemode:false,customer:'cus_fixture',currency:'usd',status:'active',items:{has_more:false,data:[{price,quantity:1}]}})};
 const handler=createHandler({now:()=>timestamp,stripeAdapterFactory:()=>api});
 const call=(path='checkout',body={},headers={})=>handler(new Request('https://api.example/v1/billing/'+path,{method:'POST',headers:{Origin:env.SUBSCRIBER_APP_ORIGIN,'Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify(body)}),env);
 const webhook=()=>{const body=JSON.stringify({id:'evt_checkout',object:'event',api_version:'2026-08-26.dahlia',livemode:false,type:'checkout.session.completed',data:{object:{id:session.id,customer:'cus_attacker'}}});const signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(`${timestamp/1000}.${body}`).digest('hex');return handler(new Request('https://api.example/v1/billing/webhook',{method:'POST',body,headers:{'Stripe-Signature':`t=${timestamp/1000},v1=${signature}`}}),env);};
 return {values,env,api,price,session,calls,call,webhook};
}
test('checkout requires verified session, strict origin and empty body before Stripe',async()=>{const s=setup();assert.equal((await s.call('checkout',{}, {Authorization:''})).status,401);assert.equal((await s.call('checkout',{}, {Origin:'https://evil.example'})).status,403);for(const body of [{customerId:'cus_attack'},{email:'x@example.com'},{price:'price_other'},{quantity:2}])assert.equal((await s.call('checkout',body)).status,400);assert.equal(s.calls.length,0);});
test('fixed test checkout reuses durable attempt and creates no credits',async()=>{const s=setup();assert.equal((await s.call()).status,200);assert.equal((await s.call()).status,200);assert.equal(s.calls.filter(c=>c[0]==='checkout').length,1);const [,p,o]=s.calls.find(c=>c[0]==='checkout');assert.equal(p.mode,'subscription');assert.equal(p.ui_mode,'hosted_page');assert.deepEqual(p.line_items,[{price:'price_fixture',quantity:1}]);assert.equal(p.customer,'cus_fixture');assert.equal(p.customer_email,undefined);assert.equal(p.allow_promotion_codes,false);assert.equal(p.success_url,'https://app.example/#billing_return');assert.equal(p.cancel_url,'https://app.example/#billing_return');assert.ok(o.idempotencyKey);assert.equal(s.values.has('paid-credit:'+principal),false);});
test('concurrent checkout requests use same server idempotency keys',async()=>{const s=setup();const results=await Promise.all(Array.from({length:12},()=>s.call()));assert.ok(results.every(r=>r.status===200));for(const type of ['customer','checkout'])assert.equal(new Set(s.calls.filter(c=>c[0]===type).map(c=>c[2].idempotencyKey)).size,1);});
test('live mode and incorrect price and hostile hosted URLs fail closed',async()=>{const s=setup();s.env.STRIPE_BILLING_MODE='live';assert.equal((await s.call()).status,503);s.env.STRIPE_BILLING_MODE='test';s.price.unit_amount=200;assert.equal((await s.call()).status,503);s.price.unit_amount=199;s.session.url='https://checkout.stripe.com.evil.example/pay';assert.equal((await s.call()).status,503);assert.equal(s.values.has('paid-binding:cus_fixture'),false);});
test('authoritative completed session binds only tracked checkout, never grants; duplicates blocked',async()=>{const s=setup();await s.call();s.session.status='complete';s.session.subscription='sub_fixture';assert.equal((await s.webhook()).status,200);assert.deepEqual(s.values.get('paid-binding:cus_fixture'),{principal,subscriptionId:'sub_fixture'});assert.equal(s.values.has('paid-credit:'+principal),false);assert.equal((await s.webhook()).status,200);assert.equal((await s.call()).status,409);const status=await s.call('status');assert.equal(status.status,200);assert.equal((await status.json()).subscribed,true);});
test('untracked and mismatched retrieved checkout cannot bind',async()=>{const s=setup();s.session.status='complete';s.session.subscription='sub_fixture';assert.equal((await s.webhook()).status,503);assert.equal(s.values.has('paid-binding:cus_fixture'),false);await s.call();s.session.metadata={attempt:'forged'};assert.equal((await s.webhook()).status,503);assert.equal(s.values.has('paid-binding:cus_fixture'),false);});
test('invoice before completed binding remains retriable and unmarked',async()=>{const s=setup();await s.call();const r=await s.env.BETA_USAGE_LIMITER.get().fetch('https://usage.internal/billing/check',{method:'POST',body:JSON.stringify({customerId:'cus_fixture',subscriptionId:'sub_fixture'})});assert.equal(r.status,503);assert.equal(s.values.has('paid-binding:cus_fixture'),false);});
test('expired sessions, query tokens and oversized payloads fail closed',async()=>{const s=setup();assert.equal((await s.call('checkout?token=secret')).status,400);assert.equal((await s.call('checkout',{blob:'x'.repeat(200)})).status,400);s.values.clear();assert.equal((await s.call()).status,401);assert.equal(s.calls.length,0);});
for(const url of ['http://checkout.stripe.com/pay','https://user@checkout.stripe.com/pay','https://checkout.stripe.com:444/pay','https://evil.example/pay'])test('reject hosted URL '+url,async()=>{const s=setup();s.session.url=url;assert.equal((await s.call()).status,503);});
test('official SDK checkout operations send pinned version and idempotency',async(t)=>{const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url:String(url),headers:new Headers(options.headers),body:options.body});return Response.json({id:'fixture'});});const api=createStripeAdapter({STRIPE_SECRET_KEY:'sk_test_synthetic'});await api.createCustomer({metadata:{cluttercash_attempt:'fixture'}},{idempotencyKey:'cc-customer-fixture'});await api.createCheckout({mode:'subscription',ui_mode:'hosted_page'},{idempotencyKey:'cc-checkout-fixture'});await api.checkout('cs_test_fixture');assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/v1/customers','/v1/checkout/sessions','/v1/checkout/sessions/cs_test_fixture']);assert.ok(calls.every(c=>c.headers.get('Stripe-Version')===STRIPE_API_VERSION));assert.equal(calls[0].headers.get('Idempotency-Key'),'cc-customer-fixture');assert.equal(calls[1].headers.get('Idempotency-Key'),'cc-checkout-fixture');});
test('portal authenticates and uses durable binding with fixed cancellation flow',async()=>{
 const s=setup();s.env.STRIPE_PORTAL_CONFIGURATION_ID='bpc_fixture';let params;
 s.api.createPortal=async p=>{params=p;return {object:'billing_portal.session',livemode:false,customer:'cus_fixture',url:'https://billing.stripe.com/p/session/test_fixture'};};
 assert.equal((await s.call('portal')).status,409);
 await s.call();s.session.status='complete';s.session.subscription='sub_fixture';await s.webhook();
 assert.equal((await s.call('portal',{}, {Authorization:''})).status,401);
 assert.equal((await s.call('portal',{customer:'cus_attacker'})).status,400);
 const r=await s.call('portal');assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');
 assert.deepEqual(params,{customer:'cus_fixture',configuration:'bpc_fixture',return_url:'https://app.example/#billing_return',flow_data:{type:'subscription_cancel',subscription_cancel:{subscription:'sub_fixture'},after_completion:{type:'redirect',redirect:{return_url:'https://app.example/#billing_return'}}}});
 assert.equal(s.values.has('paid-credit:'+principal),false);
 for(const url of ['http://billing.stripe.com/p','https://billing.stripe.com.evil.example/p','https://user@billing.stripe.com/p','https://billing.stripe.com:444/p']){s.api.createPortal=async()=>({object:'billing_portal.session',livemode:false,customer:'cus_fixture',url});assert.equal((await s.call('portal')).status,503);}
 s.api.createPortal=async()=>{throw Error('sensitive provider detail');};assert.deepEqual(await (await s.call('portal')).json(),{error:'Billing unavailable.'});
 delete s.env.STRIPE_PORTAL_CONFIGURATION_ID;assert.equal((await s.call('portal')).status,503);
});
test('official SDK portal sends pinned version',async(t)=>{
 let captured;t.mock.method(globalThis,'fetch',async(url,options)=>{captured={url:String(url),headers:new Headers(options.headers)};return Response.json({id:'bps_fixture'});});
 const api=createStripeAdapter({STRIPE_SECRET_KEY:'sk_test_synthetic'});await api.createPortal({customer:'cus_fixture',configuration:'bpc_fixture',flow_data:{type:'subscription_cancel',subscription_cancel:{subscription:'sub_fixture'}}});
 assert.equal(new URL(captured.url).pathname,'/v1/billing_portal/sessions');assert.equal(captured.headers.get('Stripe-Version'),STRIPE_API_VERSION);
});
test('expired tracked checkout recovers with a new attempt but no new customer',async()=>{
 const s=setup();await s.call();const old={...s.values.get('checkout-principal:'+principal)};
 s.values.set('checkout-principal:'+principal,{...old,createdAt:timestamp-86400000});
 s.session.status='expired';s.session.subscription=null;s.api.subscriptions=async()=>({object:'list',has_more:false,data:[]});
 s.api.createCheckout=async(p,o)=>{s.calls.push(['checkout',p,o]);return {...s.session,id:'cs_test_recovered',status:'open',metadata:p.metadata};};
 assert.equal((await s.call()).status,200);
 const current=s.values.get('checkout-principal:'+principal);assert.notEqual(current.attempt,old.attempt);assert.equal(current.customerId,old.customerId);assert.equal(current.sessionId,'cs_test_recovered');
 assert.equal(s.calls.filter(c=>c[0]==='customer').length,1);assert.notEqual(s.calls.filter(c=>c[0]==='checkout')[1][2].idempotencyKey,'cc-checkout-'+old.attempt);
 s.session.status='complete';s.session.subscription='sub_fixture';assert.equal((await s.webhook()).status,503);assert.equal(s.values.has('paid-binding:cus_fixture'),false);
});
test('expired checkout cannot rotate with active or ambiguous customer subscriptions',async()=>{
 for(const list of [{object:'list',has_more:false,data:[{id:'sub_other',object:'subscription',livemode:false,customer:'cus_fixture',status:'active'}]},{object:'list',has_more:true,data:[]},{object:'list',has_more:false,data:[{id:'sub_other',object:'subscription',livemode:false,customer:'cus_other',status:'canceled'}]}]){
 const s=setup();await s.call();const before=structuredClone(s.values.get('checkout-principal:'+principal));s.session.status='expired';s.session.subscription=null;s.api.subscriptions=async()=>list;
 assert.equal((await s.call()).status,503);assert.deepEqual(s.values.get('checkout-principal:'+principal),before);assert.equal(s.calls.filter(c=>c[0]==='checkout').length,1);
 }
});
test('ambiguous creation retries exact idempotency within safety window, never after',async()=>{
 const s=setup();const create=s.api.createCheckout;let key;
 s.api.createCheckout=async(p,o)=>{key=o.idempotencyKey;throw Error('timeout after provider accepted');};assert.equal((await s.call()).status,503);
 s.api.createCheckout=async(p,o)=>{assert.equal(o.idempotencyKey,key);return create(p,o);};assert.equal((await s.call()).status,200);
 const s2=setup();s2.values.set('checkout-principal:'+principal,{attempt:'c'.repeat(64),customerId:'cus_fixture',createdAt:timestamp-23*3600000});assert.equal((await s2.call()).status,409);assert.equal(s2.calls.length,0);
});
test('tracked open checkout remains recoverable beyond creation retry window',async()=>{
 const s=setup();await s.call();const r=s.values.get('checkout-principal:'+principal);s.values.set('checkout-principal:'+principal,{...r,createdAt:timestamp-86400000});assert.equal((await s.call()).status,200);assert.equal(s.calls.filter(c=>c[0]==='checkout').length,1);
});
test('official SDK recovery query is bounded, customer-scoped and all-status',async(t)=>{
 let captured;t.mock.method(globalThis,'fetch',async(url,options)=>{captured={url:new URL(String(url)),headers:new Headers(options.headers)};return Response.json({object:'list',has_more:false,data:[]});});
 const api=createStripeAdapter({STRIPE_SECRET_KEY:'sk_test_synthetic'});await api.subscriptions('cus_fixture');
 assert.equal(captured.url.pathname,'/v1/subscriptions');assert.equal(captured.url.searchParams.get('customer'),'cus_fixture');assert.equal(captured.url.searchParams.get('status'),'all');assert.equal(captured.url.searchParams.get('limit'),'100');assert.equal(captured.headers.get('Stripe-Version'),STRIPE_API_VERSION);
});
test('expired recovery rejects ownership mismatch, subscription reference and retrieval failure',async()=>{
 for(const mutate of [s=>{s.session.customer='cus_other';},s=>{s.session.metadata.cluttercash_attempt='d'.repeat(64);},s=>{s.session.subscription='sub_existing';},s=>{s.session.livemode=true;},s=>{s.api.subscriptions=async()=>{throw Error('unavailable');};},s=>{s.values.set('paid-binding:cus_fixture',{principal,subscriptionId:'sub_existing'});}]){
 const s=setup();await s.call();const before=structuredClone(s.values.get('checkout-principal:'+principal));s.session.status='expired';s.session.subscription=null;s.api.subscriptions=async()=>({object:'list',has_more:false,data:[]});mutate(s);
 assert.equal((await s.call()).status,503);assert.deepEqual(s.values.get('checkout-principal:'+principal),before);assert.equal(s.calls.filter(c=>c[0]==='checkout').length,1);
 }
});
test('terminal canceled subscription can repurchase without old credit or events crossing bindings',async()=>{
 const s=setup();await s.call();s.session.status='complete';s.session.subscription='sub_fixture';await s.webhook();
 const old=structuredClone(s.values.get('checkout-principal:'+principal));
 s.values.set('paid-credit:'+principal,{subscriptionId:'sub_fixture',periodStart:timestamp-1000,periodEnd:timestamp+86400000,remaining:7});
 const canceled={...(await s.api.subscription()),status:'canceled'};s.api.subscription=async()=>canceled;s.api.subscriptions=async()=>({object:'list',has_more:false,data:[canceled]});
 s.api.createCheckout=async(p,o)=>{s.calls.push(['checkout',p,o]);Object.assign(s.session,{id:'cs_test_resub',status:'open',subscription:null,metadata:p.metadata});return s.session;};
 assert.equal((await s.call()).status,200);assert.notEqual(s.values.get('checkout-principal:'+principal).attempt,old.attempt);
 assert.equal((await (await s.call('status')).json()).entitled,false);assert.equal(s.values.get('paid-block:sub_fixture'),true);
 s.session.status='complete';s.session.subscription='sub_new';s.api.subscription=async()=>({...canceled,id:'sub_new',status:'active'});assert.equal((await s.webhook()).status,200);
 const internal=async(path,body)=>s.env.BETA_USAGE_LIMITER.get().fetch('https://usage.internal/billing/'+path,{method:'POST',body:JSON.stringify(body)});
 const grant={customerId:'cus_fixture',subscriptionId:'sub_new',eventId:'evt_new',invoiceId:'in_new',priceId:'price_fixture',livemode:false,periodStart:timestamp,periodEnd:timestamp+86400000};
 assert.equal((await (await internal('grant',grant)).json()).granted,true);
 const before=structuredClone(s.values.get('paid-credit:'+principal));
 assert.equal((await internal('block',{customerId:'cus_fixture',subscriptionId:'sub_fixture'})).status,200);
 assert.equal((await (await internal('grant',{...grant,subscriptionId:'sub_fixture',eventId:'evt_old',invoiceId:'in_old'})).json()).granted,false);
 assert.deepEqual(s.values.get('paid-credit:'+principal),before);assert.equal(s.values.has('paid-block:sub_new'),false);
 // Exercise the mounted signed terminal event too, not just normalized commands.
 s.api.subscription=async()=>canceled;
 const body=JSON.stringify({id:'evt_oldcancel',object:'event',api_version:STRIPE_API_VERSION,livemode:false,type:'customer.subscription.deleted',data:{object:{id:'sub_fixture'}}});
 const signature=createHmac('sha256',s.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp/1000}.${body}`).digest('hex');
 const handler=createHandler({now:()=>timestamp,stripeAdapterFactory:()=>s.api});
 assert.equal((await handler(new Request('https://api.example/v1/billing/webhook',{method:'POST',body,headers:{'Stripe-Signature':`t=${timestamp/1000},v1=${signature}`}}),s.env)).status,200);
 assert.deepEqual(s.values.get('paid-credit:'+principal),before);assert.equal((await (await s.call('status')).json()).entitled,true);
});
test('resubscription refuses nonterminal, wrong-owner, incomplete or duplicate inventory',async()=>{
 for(const mutate of [sub=>sub.status='active',sub=>sub.customer='cus_other',sub=>sub.livemode=true,'pagination','duplicate']){
 const s=setup();await s.call();s.session.status='complete';s.session.subscription='sub_fixture';await s.webhook();const before=structuredClone(s.values.get('checkout-principal:'+principal));
 const sub={...(await s.api.subscription()),status:'canceled'};if(typeof mutate==='function')mutate(sub);s.api.subscription=async()=>sub;s.api.subscriptions=async()=>({object:'list',has_more:mutate==='pagination',data:mutate==='duplicate'?[sub,{...sub,id:'sub_other',status:'active'}]:[sub]});
 assert.notEqual((await s.call()).status,200);assert.deepEqual(s.values.get('checkout-principal:'+principal),before);assert.equal(s.calls.filter(c=>c[0]==='checkout').length,1);
 }
});

test('repeated repurchases and expired replacement retain all retired ownership',async()=>{
 const s=setup();const history=[];let serial=0;
 s.api.subscription=async id=>history.find(x=>x.id===id);
 s.api.subscriptions=async(customer,after)=>{const start=after?history.findIndex(x=>x.id===after)+1:0;return {object:'list',has_more:start+1<history.length,data:history.slice(start,start+1)};};
 s.api.createCheckout=async(p,o)=>{s.calls.push(['checkout',p,o]);Object.assign(s.session,{id:'cs_test_cycle'+(++serial),status:'open',subscription:null,metadata:p.metadata});return s.session;};
 for(let cycle=0;cycle<3;cycle++){
  assert.equal((await s.call()).status,200,'purchase cycle '+cycle);
  if(cycle){s.session.status='expired';assert.equal((await s.call()).status,200,'expired replacement '+cycle);}
  const sub={id:'sub_cycle'+cycle,object:'subscription',livemode:false,customer:'cus_fixture',currency:'usd',status:'active',items:{has_more:false,data:[{price:s.price,quantity:1}]}};history.push(sub);
  s.session.status='complete';s.session.subscription=sub.id;assert.equal((await s.webhook()).status,200);
  assert.equal((await s.call()).status,409,'active duplicate blocked');sub.status='canceled';
 }
 assert.equal((await s.call()).status,200);
 for(const sub of history)assert.deepEqual(s.values.get('paid-retired:'+sub.id),{principal,customerId:'cus_fixture'});
 assert.equal(s.calls.filter(x=>x[0]==='customer').length,1);
});


test('history reconciliation rejects unowned canceled history and malformed or over-budget pages',async()=>{
 for(const mode of ['unowned','repeat','empty','oversize','budget','wrong-owner']){
  const s=setup();await s.call();s.session.status='complete';s.session.subscription='sub_fixture';await s.webhook();
  const sub={...(await s.api.subscription()),status:'canceled'};s.api.subscription=async()=>sub;
  const before=structuredClone(s.values.get('checkout-principal:'+principal));let page=0;
  s.api.subscriptions=async()=>{page++;if(mode==='empty')return {object:'list',has_more:true,data:[]};
   if(mode==='oversize')return {object:'list',has_more:false,data:Array.from({length:101},(_,i)=>({...sub,id:'sub_x'+i}))};
   if(mode==='budget')return {object:'list',has_more:true,data:[{...sub,id:'sub_page'+page}]};
   return {object:'list',has_more:mode==='repeat',data:mode==='unowned'?[sub,{...sub,id:'sub_unowned'}]:mode==='wrong-owner'?[{...sub,customer:'cus_other'}]:[sub]};};
  assert.equal((await s.call()).status,503,mode);assert.deepEqual(s.values.get('checkout-principal:'+principal),before);assert.ok(page<=10);
 }
});
test('official SDK carries server pagination cursor with all-status customer scope',async(t)=>{
 let url;t.mock.method(globalThis,'fetch',async(u)=>{url=new URL(String(u));return Response.json({object:'list',has_more:false,data:[]});});
 const api=createStripeAdapter({STRIPE_SECRET_KEY:'sk_test_synthetic'});await api.subscriptions('cus_fixture','sub_previous');
 assert.equal(url.searchParams.get('starting_after'),'sub_previous');assert.equal(url.searchParams.get('customer'),'cus_fixture');assert.equal(url.searchParams.get('status'),'all');assert.equal(url.searchParams.get('limit'),'100');
});

test('ambiguous expired idempotency window fails closed instead of recreating purchases',async()=>{const s=setup();s.values.set('checkout-principal:'+principal,{attempt:'c'.repeat(64),createdAt:timestamp-86400000});assert.equal((await s.call()).status,409);assert.equal(s.calls.length,0);});
