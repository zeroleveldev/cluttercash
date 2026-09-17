import {validatePrice,createStripeAdapter} from './stripe-billing.js';
const hex=/^[a-f0-9]{64}$/;
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}_[A-Za-z0-9]{1,128}$`).test(v);
const check=v=>{if(!v)throw Error('Billing unavailable');};
const random=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const ref=v=>typeof v==='string'?v:v?.id;
export function hostedCheckoutUrl(value){const u=new URL(value);check(u.protocol==='https:'&&u.hostname==='checkout.stripe.com'&&!u.username&&!u.password&&!u.port);return value;}
async function command(env,path,body){const stub=env.BETA_USAGE_LIMITER.get(env.BETA_USAGE_LIMITER.idFromName('global'));const r=await stub.fetch(new Request('https://usage.internal/'+path,{method:'POST',body:JSON.stringify(body)}));check(r.ok);return r.json();}
// Complete authoritative inventory, bounded to ten pages / 1000 entries. Never
// accept inventory or cursors from the browser; malformed/repeated pages fail shut.
async function canceledInventory(api,customerId){
 const ids=[];let after;
 for(let page=0;page<10;page++){
  const list=await api.subscriptions(customerId,after);
  check(list?.object==='list'&&typeof list.has_more==='boolean'&&Array.isArray(list.data)&&list.data.length<=100);
  for(const sub of list.data){check(id(sub.id,'sub')&&sub.object==='subscription'&&sub.livemode===false&&ref(sub.customer)===customerId&&sub.status==='canceled'&&!ids.includes(sub.id));ids.push(sub.id);}
  if(!list.has_more)return ids;
  check(list.data.length>0);after=ids.at(-1);
 }
 throw Error('Billing reconciliation required');
}
export async function handleCheckout(request,env,{now=Date.now,adapterFactory=createStripeAdapter}={}){
 const origin=request.headers.get('Origin'),url=new URL(request.url);const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Vary':'Origin'};
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 if(!origin||origin!==env.SUBSCRIBER_APP_ORIGIN)return reply({error:'Origin is not allowed.'},403);
 headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';
 if(url.search)return reply({error:'Invalid request.'},400);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 try {
 check(env.STRIPE_BILLING_MODE==='test'&&/^sk_test_[A-Za-z0-9_]+$/.test(env.STRIPE_SECRET_KEY||'')&&id(env.STRIPE_PRICE_ID,'price')&&id(env.STRIPE_PRODUCT_ID,'prod')&&new URL(origin).protocol==='https:'&&new URL(origin).origin===origin);
 const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return reply({error:'Sign-in invalid or expired.'},401);
 const timestamp=now(),auth=await command(env,'subscriber/session',{sessionHash:await digest(token),timestamp});if(!auth.valid)return reply({error:'Sign-in invalid or expired.'},401);
 // Empty JSON only, bounded while streaming, never accept customer/email/price.
 try {check(request.headers.get('Content-Type')?.startsWith('application/json'));const reader=request.body?.getReader();check(reader);let text='',size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128){await reader.cancel();throw Error();}text+=new TextDecoder().decode(value);}}finally{reader.releaseLock();}const b=JSON.parse(text);check(b&&typeof b==='object'&&!Array.isArray(b)&&!Object.keys(b).length);}catch{return reply({error:'Invalid request.'},400);}
 const principal=auth.principal;check(hex.test(principal));
 if(url.pathname==='/v1/billing/status'){const result=await command(env,'checkout/status',{principal,timestamp});return reply(result);}
 if(url.pathname==='/v1/billing/portal'){
  check(id(env.STRIPE_PORTAL_CONFIGURATION_ID,'bpc'));
  const binding=await command(env,'checkout/portal',{principal});
  if(!binding.bound)return reply({error:'No confirmed subscription.'},409);
  const session=await adapterFactory(env).createPortal({customer:binding.customerId,configuration:env.STRIPE_PORTAL_CONFIGURATION_ID,return_url:origin+'/#billing_return',flow_data:{type:'subscription_cancel',subscription_cancel:{subscription:binding.subscriptionId},after_completion:{type:'redirect',redirect:{return_url:origin+'/#billing_return'}}}});
  check(session.object==='billing_portal.session'&&session.livemode===false&&session.customer===binding.customerId);
  const hosted=new URL(session.url);check(hosted.protocol==='https:'&&hosted.hostname==='billing.stripe.com'&&!hosted.username&&!hosted.password&&!hosted.port);
  return reply({url:session.url});
 }
 if(url.pathname!=='/v1/billing/checkout')return reply({error:'Not found.'},404);
 let record=await command(env,'checkout/begin',{principal,timestamp,attempt:random()});
 if(record.subscriptionId){
  const api=adapterFactory(env),sub=await api.subscription(record.subscriptionId);
  check(sub.id===record.subscriptionId&&sub.object==='subscription'&&sub.livemode===false&&ref(sub.customer)===record.customerId);
  if(sub.status!=='canceled')return reply({error:'Billing reconciliation required.'},409);
  const session=await api.checkout(record.sessionId);
  check(session.id===record.sessionId&&session.object==='checkout.session'&&session.livemode===false&&session.mode==='subscription'&&session.status==='complete'&&ref(session.customer)===record.customerId&&ref(session.subscription)===record.subscriptionId&&session.metadata?.cluttercash_attempt===record.attempt);
  const inventory=await canceledInventory(api,record.customerId);check(inventory.includes(sub.id));
  validatePrice(await api.price(env.STRIPE_PRICE_ID),env);
  record=await command(env,'checkout/replace-canceled',{principal,attempt:record.attempt,sessionId:record.sessionId,customerId:record.customerId,subscriptionId:record.subscriptionId,inventory,nextAttempt:random(),timestamp});
 }
 // A tracked resource can be retrieved safely after idempotency retention; an
 // untracked/ambiguous creation must never acquire a fresh key after 23 hours.
 if(!record.sessionId&&timestamp-record.createdAt>=23*3600000)return reply({error:'Billing reconciliation required.'},409);
 const api=adapterFactory(env);validatePrice(await api.price(env.STRIPE_PRICE_ID),env);
 if(record.sessionId){
  const session=await api.checkout(record.sessionId);
  check(session.id===record.sessionId&&session.object==='checkout.session'&&session.mode==='subscription'&&session.livemode===false&&ref(session.customer)===record.customerId&&session.metadata?.cluttercash_attempt===record.attempt);
  if(session.status==='open')return reply({url:hostedCheckoutUrl(session.url)});
  if(session.status!=='expired')return reply({error:'Billing confirmation pending.'},409);
  check(session.subscription===null);
  const inventory=await canceledInventory(api,record.customerId);
  record=await command(env,'checkout/replace-expired',{principal,attempt:record.attempt,sessionId:record.sessionId,customerId:record.customerId,inventory,nextAttempt:random(),timestamp});
 }
 if(!record.customerId){const customer=await api.createCustomer({metadata:{cluttercash_attempt:record.attempt}},{idempotencyKey:'cc-customer-'+record.attempt});check(id(customer.id,'cus')&&customer.object==='customer'&&customer.livemode===false);record=await command(env,'checkout/customer',{principal,attempt:record.attempt,customerId:customer.id});}
 const session=await api.createCheckout({mode:'subscription',ui_mode:'hosted_page',customer:record.customerId,line_items:[{price:env.STRIPE_PRICE_ID,quantity:1}],currency:'usd',allow_promotion_codes:false,automatic_tax:{enabled:false},adaptive_pricing:{enabled:false},payment_method_types:['card'],success_url:origin+'/#billing_return',cancel_url:origin+'/#billing_return',metadata:{cluttercash_attempt:record.attempt},subscription_data:{metadata:{cluttercash_attempt:record.attempt}}},{idempotencyKey:'cc-checkout-'+record.attempt});
 check(id(session.id,'cs_test')&&session.object==='checkout.session'&&session.livemode===false&&session.mode==='subscription'&&ref(session.customer)===record.customerId);const hosted=hostedCheckoutUrl(session.url);
 await command(env,'checkout/save',{principal,attempt:record.attempt,sessionId:session.id});return reply({url:hosted});
 }catch{return reply({error:'Billing unavailable.'},503);}
}
// Internal protocol. Durable attempt never automatically rotates: after Stripe's
// idempotency retention window an ambiguous request requires reconciliation.
export async function checkoutCommand(storage,env,path,input){
 check(env.STRIPE_BILLING_MODE==='test');
 return storage.transaction(async tx=>{
 if(path==='/checkout/bind'){
 const {sessionId,customerId,subscriptionId,attempt}=input;check(id(sessionId,'cs_test')&&id(customerId,'cus')&&id(subscriptionId,'sub')&&hex.test(attempt));
 const principal=await tx.get('checkout-session:'+sessionId);check(hex.test(principal));const key='checkout-principal:'+principal,r=await tx.get(key);
 check(r?.sessionId===sessionId&&r.customerId===customerId&&r.attempt===attempt&&(!r.subscriptionId||r.subscriptionId===subscriptionId));
 const prior=await tx.get('paid-binding:'+customerId);check(!prior||(prior.principal===principal&&(prior.subscriptionId===subscriptionId||(prior.retired===true&&await tx.get('paid-block:'+prior.subscriptionId)))));
 check(!await tx.get('paid-retired:'+subscriptionId));
 await tx.put('paid-binding:'+customerId,{principal,subscriptionId});await tx.put(key,{...r,subscriptionId});return {bound:true};
 }
 const {principal}=input;check(hex.test(principal));const key='checkout-principal:'+principal;let r=await tx.get(key);
 if(path==='/checkout/portal'){
  if(!r?.subscriptionId)return {bound:false};
  check(id(r.customerId,'cus')&&id(r.subscriptionId,'sub'));
  const binding=await tx.get('paid-binding:'+r.customerId);
  check(binding?.principal===principal&&binding.subscriptionId===r.subscriptionId);
  return {bound:true,customerId:r.customerId,subscriptionId:r.subscriptionId};
 }
 if(path==='/checkout/status'){
 check(Number.isSafeInteger(input.timestamp)&&input.timestamp>0);
 const stored=await tx.get('paid-credit:'+principal),bound=!!r?.subscriptionId;
 const credit=bound&&stored?.subscriptionId===r.subscriptionId?stored:null;
 const blocked=bound?!!await tx.get('paid-block:'+r.subscriptionId):false;
 const current=!!credit&&Number.isSafeInteger(credit.remaining)&&credit.remaining>=0&&credit.remaining<=10&&Number.isSafeInteger(credit.periodStart)&&Number.isSafeInteger(credit.periodEnd)&&input.timestamp>=credit.periodStart&&input.timestamp<credit.periodEnd;
 const remaining=!blocked&&current?credit.remaining:0;
 const state=blocked?'blocked':!bound?(r?'checkout_pending':'not_subscribed'):!credit?'awaiting_payment':input.timestamp>=credit.periodEnd?'expired':input.timestamp<credit.periodStart?'awaiting_period':remaining>0?'active':'exhausted';
 // Local paid period is evidence of allowance, not a promise of future renewal.
 return {bound,subscribed:bound,pending:!!r&&!bound,entitled:!blocked&&current&&remaining>0,state,blocked,remaining,monthlyAllowance:10,periodStart:credit?.periodStart??null,periodEnd:credit?.periodEnd??null,renewalStatus:'not_confirmed'};
 }
 if(path==='/checkout/begin'){check(hex.test(input.attempt)&&Number.isSafeInteger(input.timestamp));if(!r){r={attempt:input.attempt,createdAt:input.timestamp};await tx.put(key,r);}return r;}
 check(r&&r.attempt===input.attempt);
 if(path==='/checkout/replace-canceled'||path==='/checkout/replace-expired'){
  // Only the mounted server builds this bounded list. Recheck every historical
  // owner inside the SAME generation CAS transaction; never delete history.
  const inventory=input.inventory??(path==='/checkout/replace-canceled'?[r.subscriptionId]:[]);
  check(Array.isArray(inventory)&&inventory.length<=1000&&new Set(inventory).size===inventory.length);
  if(path==='/checkout/replace-canceled')check(inventory.includes(r.subscriptionId));
  for(const subscriptionId of inventory){
   check(id(subscriptionId,'sub'));
   if(path==='/checkout/replace-canceled'&&subscriptionId===r.subscriptionId)continue;
   const retired=await tx.get('paid-retired:'+subscriptionId);
   check(retired?.principal===principal&&retired.customerId===r.customerId&&await tx.get('paid-block:'+subscriptionId));
  }
 }
 if(path==='/checkout/replace-canceled'){
  check(id(r.subscriptionId,'sub')&&r.subscriptionId===input.subscriptionId&&r.sessionId===input.sessionId&&r.customerId===input.customerId&&hex.test(input.nextAttempt)&&input.nextAttempt!==r.attempt&&Number.isSafeInteger(input.timestamp)&&input.timestamp>=r.createdAt);
  const binding=await tx.get('paid-binding:'+r.customerId);
  check(binding?.principal===principal&&binding.subscriptionId===r.subscriptionId&&!binding.retired&&await tx.get('checkout-customer:'+r.customerId)===principal&&await tx.get('checkout-session:'+r.sessionId)===principal);
  await tx.put({['paid-retired:'+r.subscriptionId]:{principal,customerId:r.customerId},['paid-block:'+r.subscriptionId]:true,['paid-binding:'+r.customerId]:{...binding,retired:true}});
  r={attempt:input.nextAttempt,createdAt:input.timestamp,customerId:r.customerId};
 }
 else if(path==='/checkout/replace-expired'){
  check(!r.subscriptionId&&r.sessionId===input.sessionId&&r.customerId===input.customerId&&id(r.sessionId,'cs_test')&&id(r.customerId,'cus')&&hex.test(input.nextAttempt)&&input.nextAttempt!==r.attempt&&Number.isSafeInteger(input.timestamp)&&input.timestamp>=r.createdAt);
  const prior=await tx.get('paid-binding:'+r.customerId);
  const retired=prior&&await tx.get('paid-retired:'+prior.subscriptionId);
  check(!prior||(prior.retired===true&&prior.principal===principal&&retired?.principal===principal&&retired.customerId===r.customerId&&await tx.get('paid-block:'+prior.subscriptionId)));
  check(await tx.get('checkout-customer:'+r.customerId)===principal&&await tx.get('checkout-session:'+r.sessionId)===principal);
  // Keep old reverse ownership. Stale saves/completions fail the current attempt
  // comparison; concurrent replacement losers fail closed and can retry normally.
  r={attempt:input.nextAttempt,createdAt:input.timestamp,customerId:r.customerId};
 }
 else if(path==='/checkout/customer'){check(id(input.customerId,'cus')&&(!r.customerId||r.customerId===input.customerId));const owner=await tx.get('checkout-customer:'+input.customerId);check(!owner||owner===principal);await tx.put('checkout-customer:'+input.customerId,principal);r={...r,customerId:input.customerId};}
 else if(path==='/checkout/save'){check(id(input.sessionId,'cs_test')&&r.customerId&&(!r.sessionId||r.sessionId===input.sessionId));const owner=await tx.get('checkout-session:'+input.sessionId);check(!owner||owner===principal);r={...r,sessionId:input.sessionId};await tx.put('checkout-session:'+input.sessionId,principal);}
 else throw Error('Invalid command');await tx.put(key,r);return r;
 });
}
export async function bindCompletedCheckout(api,env,sessionId){
 check(id(sessionId,'cs_test'));const session=await api.checkout(sessionId);check(session.id===sessionId&&session.object==='checkout.session'&&session.livemode===false&&session.status==='complete'&&session.mode==='subscription');
 const customerId=ref(session.customer),subscriptionId=ref(session.subscription);check(id(customerId,'cus')&&id(subscriptionId,'sub'));
 const sub=await api.subscription(subscriptionId);check(sub.id===subscriptionId&&sub.object==='subscription'&&sub.livemode===false&&ref(sub.customer)===customerId&&sub.currency==='usd');
 validatePrice(await api.price(env.STRIPE_PRICE_ID),env);check(sub.items?.has_more===false&&sub.items.data?.length===1&&ref(sub.items.data[0].price)===env.STRIPE_PRICE_ID&&sub.items.data[0].quantity===1);
 await command(env,'checkout/bind',{sessionId,customerId,subscriptionId,attempt:session.metadata?.cluttercash_attempt});
}
