import Stripe from 'stripe';
import {bindCompletedCheckout} from './stripe-checkout.js';
import {verifyTestStripeEvent} from './stripe-webhook.js';
export const STRIPE_API_VERSION='2026-08-26.dahlia';
const validId=(v,p)=>typeof v==='string' && new RegExp(`^${p}_[A-Za-z0-9]{1,128}$`).test(v);
const ref=v=>typeof v==='string'?v:v?.id;
const requireThat=v=>{if(!v)throw new InvalidBilling();};
class InvalidBilling extends Error {}
const response=(status)=>Response.json(status===200?{received:true}:{error:status===503?'Billing unavailable.':'Stripe webhook rejected.'},{status,headers:{'Cache-Control':'no-store'}});
export function createStripeAdapter(env){
 const stripe=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION,httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:0,timeout:10000});
 return {subscriptions:(customer,startingAfter)=>stripe.subscriptions.list({customer,status:'all',limit:100,...(startingAfter?{starting_after:startingAfter}:{})}),invoice:id=>stripe.invoices.retrieve(id),subscription:id=>stripe.subscriptions.retrieve(id),price:id=>stripe.prices.retrieve(id),checkout:id=>stripe.checkout.sessions.retrieve(id),createCustomer:(p,o)=>stripe.customers.create(p,o),createCheckout:(p,o)=>stripe.checkout.sessions.create(p,o),createPortal:p=>stripe.billingPortal.sessions.create(p)};
}
function configured(env){return env.STRIPE_BILLING_MODE==='test' && /^sk_test_[A-Za-z0-9_]+$/.test(env.STRIPE_SECRET_KEY||'') && /^whsec_.+$/.test(env.STRIPE_WEBHOOK_SECRET||'') && validId(env.STRIPE_PRICE_ID,'price') && validId(env.STRIPE_PRODUCT_ID,'prod') && env.BETA_USAGE_LIMITER?.get && env.BETA_USAGE_LIMITER?.idFromName;}
async function rawBody(request){
 if(Number(request.headers.get('Content-Length'))>262144)throw new RangeError();
 const reader=request.body?.getReader();if(!reader)throw new InvalidBilling();
 const chunks=[];let length=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>262144)throw new RangeError();chunks.push(value);}}
 catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new InvalidBilling();}
}
function resource(value,id,object){requireThat(value?.id===id && value.object===object && value.livemode===false);}
function single(list){requireThat(list?.has_more===false && Array.isArray(list.data) && list.data.length===1);return list.data[0];}
export function validatePrice(price,env){
 resource(price,env.STRIPE_PRICE_ID,'price');requireThat(price.active===true && price.currency==='usd' && price.unit_amount===199 && price.type==='recurring' && price.billing_scheme==='per_unit' && ref(price.product)===env.STRIPE_PRODUCT_ID && price.recurring?.interval==='month' && price.recurring.interval_count===1 && price.recurring.usage_type==='licensed' && !price.transform_quantity && !price.custom_unit_amount);
}
async function command(env,path,body){
 const stub=env.BETA_USAGE_LIMITER.get(env.BETA_USAGE_LIMITER.idFromName('global'));
 const result=await stub.fetch(new Request(`https://usage.internal/billing/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
 if(result.status===400)throw new InvalidBilling();if(!result.ok)throw Error('Ledger unavailable');
}
export async function handleStripeWebhook(request,env,{now=()=>Date.now(),adapterFactory=createStripeAdapter}={}){
 if(request.method!=='POST')return response(405);
 if(!configured(env))return response(503);
 try{
 const raw=await rawBody(request);let event;
 try{event=await verifyTestStripeEvent({rawBody:raw,signature:request.headers.get('Stripe-Signature'),env,nowMs:now()});}catch{throw new InvalidBilling();}
 requireThat(validId(event.id,'evt') && event.api_version===STRIPE_API_VERSION && !event.account);
 if(event.type==='checkout.session.completed'){await bindCompletedCheckout(adapterFactory(env),env,event.data.object.id);return response(200);}
 if(!['invoice.paid','invoice.payment_failed','customer.subscription.deleted'].includes(event.type))return response(200);
 const api=adapterFactory(env);let invoice,subscriptionId;
 if(event.type==='customer.subscription.deleted'){subscriptionId=event.data.object.id;requireThat(validId(subscriptionId,'sub'));}
 else{
 const invoiceId=event.data.object.id;requireThat(validId(invoiceId,'in'));
 invoice=await api.invoice(invoiceId);resource(invoice,invoiceId,'invoice');
 requireThat(invoice.parent?.type==='subscription_details');subscriptionId=ref(invoice.parent.subscription_details?.subscription);requireThat(validId(subscriptionId,'sub'));
 }
 const subscription=await api.subscription(subscriptionId);resource(subscription,subscriptionId,'subscription');
 const customerId=ref(subscription.customer);requireThat(validId(customerId,'cus'));
 const binding={customerId,subscriptionId};
 if(event.type==='customer.subscription.deleted'){
 // Stripe canceled subscriptions are terminal; only this terminal state latches.
 requireThat(subscription.status==='canceled');await command(env,'block',binding);return response(200);
 }
 requireThat(ref(invoice.customer)===customerId);
 if(event.type==='invoice.payment_failed'){
 // No new credits. Existing paid periods expire naturally. In particular a late
 // failed notification must never undo recovered payment or permanently latch.
 requireThat(['open','paid','uncollectible','void'].includes(invoice.status));
 await command(env,'check',binding);return response(200);
 }
 const price=await api.price(env.STRIPE_PRICE_ID);validatePrice(price,env);
 requireThat(invoice.status==='paid' && invoice.currency==='usd' && invoice.amount_paid===199 && invoice.amount_due===199 && invoice.amount_remaining===0 && ['subscription_create','subscription_cycle'].includes(invoice.billing_reason));
 requireThat(subscription.status==='active' && subscription.currency==='usd' && !subscription.pause_collection);
 const item=single(subscription.items),line=single(invoice.lines);
 requireThat(ref(item.price)===price.id && item.quantity===1 && ref(item.subscription)===subscriptionId && validId(item.id,'si'));
 const parent=line.parent?.subscription_item_details;
 requireThat(line.object==='line_item' && line.livemode===false && line.currency==='usd' && line.amount===199 && line.quantity===1 && (line.quantity_decimal===undefined || /^1(?:\.0+)?$/.test(line.quantity_decimal)) && line.parent?.type==='subscription_item_details' && parent?.proration===false && ref(parent.subscription)===subscriptionId && ref(parent.subscription_item)===item.id && line.pricing?.type==='price_details' && ref(line.pricing.price_details?.price)===price.id && ref(line.pricing.price_details?.product)===env.STRIPE_PRODUCT_ID);
 const start=item.current_period_start,end=item.current_period_end;
 requireThat(Number.isSafeInteger(start) && start>0 && Number.isSafeInteger(end) && end>start && Number.isSafeInteger(end*1000) && line.period?.start===start && line.period.end===end);
 await command(env,'grant',{...binding,eventId:event.id,invoiceId:invoice.id,priceId:price.id,livemode:false,periodStart:start*1000,periodEnd:end*1000});
 return response(200);
 }catch(e){return response(e instanceof RangeError?413:e instanceof InvalidBilling?400:503);}
}
