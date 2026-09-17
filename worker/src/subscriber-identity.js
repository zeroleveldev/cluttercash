// Test-only subscriber authentication. Does not grant credits or bind Stripe customers.
import {createSubscriberEmailSender,SUBSCRIBER_LINK_PATH,SUBSCRIBER_LINK_FRAGMENT} from './subscriber-email.js';
const HEX = /^[a-f0-9]{64}$/;
const HOUR = 3600000;
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const bytes = value => new TextEncoder().encode(value);
const hex = value => [...new Uint8Array(value)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest = async value => hex(await crypto.subtle.digest('SHA-256',bytes(value)));
async function identityHash(secret,value) {
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,bytes(value)));
}
function configured(env) {
 try { const u=new URL(env.SUBSCRIBER_APP_ORIGIN);return env.STRIPE_BILLING_MODE==='test' && env.SUBSCRIBER_EMAIL_ENABLED==='true' && typeof env.SUBSCRIBER_IDENTITY_SECRET==='string' && env.SUBSCRIBER_IDENTITY_SECRET.length>=32 && u.protocol==='https:' && u.origin===env.SUBSCRIBER_APP_ORIGIN && !!env.BETA_USAGE_LIMITER; } catch {return false;}
}
async function boundedBody(request) {
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('body');
 const reader=request.body?.getReader();if(!reader)throw Error('body');let size=0;const chunks=[];
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw Error('body');}chunks.push(value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}
 const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));if(!value||Array.isArray(value)||typeof value!=='object')throw Error('body');return value;
}
async function command(env,path,input) {
 const stub=env.BETA_USAGE_LIMITER.get(env.BETA_USAGE_LIMITER.idFromName('global'));
 const r=await stub.fetch('https://usage.internal/subscriber/'+path,{method:'POST',body:JSON.stringify(input)});
 if(!r.ok)throw Error('storage');return r.json();
}
export async function handleSubscriberIdentity(request,env,{now=Date.now,emailSender}={}) {
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Vary':'Origin','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin!==env.SUBSCRIBER_APP_ORIGIN)return reply({error:'Origin is not allowed.'},403);
 headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type, Authorization';
 if(url.search)return reply({error:'Invalid request.'},400);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 if(!configured(env))return reply({error:'Subscriber sign-in unavailable.'},503);
 let body;try {body=await boundedBody(request);}catch{return reply({error:'Invalid request.'},400);}
 const action=url.pathname.slice('/v1/subscriber/'.length),timestamp=now();
 try {
  if(action==='challenge') {
   emailSender ??= createSubscriberEmailSender(env);
   if(typeof emailSender!=='function')return reply({error:'Subscriber sign-in unavailable.'},503);
   if(Object.keys(body).some(k=>!['email','browserToken'].includes(k))||typeof body.email!=='string'||body.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||!HEX.test(body.browserToken))return reply({error:'Invalid request.'},400);
   const email=body.email.toLowerCase();
   const principal=await identityHash(env.SUBSCRIBER_IDENTITY_SECRET,'email:'+email);
   const network=await identityHash(env.SUBSCRIBER_IDENTITY_SECRET,'ip:'+(request.headers.get('CF-Connecting-IP')||'unknown'));
   const token=randomToken(),tokenHash=await digest(token),browserHash=await digest(body.browserToken);
   const result=await command(env,'start',{principal,network,tokenHash,browserHash,timestamp});
   if(result.accepted) {
    let delivered=false;
    try {delivered=await emailSender?.({email,url:env.SUBSCRIBER_APP_ORIGIN+SUBSCRIBER_LINK_PATH+'#'+SUBSCRIBER_LINK_FRAGMENT+token,expiresInSeconds:600},env)===true;} catch {/* Never expose provider errors or contact values. */}
    if(delivered)await command(env,'activate',{tokenHash,timestamp:now()});
    else await command(env,'discard',{tokenHash,timestamp});
   }
   return reply({accepted:true},202);
  }
  if(action==='verify') {
   if(Object.keys(body).some(k=>!['token','browserToken'].includes(k))||!HEX.test(body.token)||!HEX.test(body.browserToken))return reply({error:'Sign-in invalid or expired.'},401);
   const sessionToken=randomToken();const result=await command(env,'verify',{tokenHash:await digest(body.token),browserHash:await digest(body.browserToken),sessionHash:await digest(sessionToken),timestamp});
   return result.valid?reply({sessionToken,expiresAt:result.expiresAt}):reply({error:'Sign-in invalid or expired.'},401);
  }
  if(action==='session'||action==='logout') {
   if(Object.keys(body).length)return reply({error:'Invalid request.'},400);
   const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
   if(!token)return reply({error:'Sign-in invalid or expired.'},401);
   const result=await command(env,action,{sessionHash:await digest(token),timestamp});
   return result.valid?reply(action==='logout'?{revoked:true}:{principal:result.principal,expiresAt:result.expiresAt}):reply({error:'Sign-in invalid or expired.'},401);
  }
  return reply({error:'Not found.'},404);
 }catch{return reply({error:'Subscriber sign-in unavailable.'},503);}
}
// Only reachable through the DO binding, never the public HTTP router.
export async function subscriberIdentityCommand(storage,path,input) {
 const action=path.slice('/subscriber/'.length),t=input?.timestamp;
 if(!Number.isSafeInteger(t)||t<=0)throw Error('invalid command');
 return storage.transaction(async tx=>{
  if(action==='start') {
   if(![input.principal,input.network,input.tokenHash,input.browserHash].every(x=>typeof x==='string'&&HEX.test(x)))throw Error('invalid command');
   const buckets=[['global',100],['email:'+input.principal,3],['network:'+input.network,10]];
   const records=[];
   for(const [id,limit]of buckets){const key='subscriber:rate:'+id;let record=await tx.get(key);if(!record||record.expiresAt<=t)record={count:0,expiresAt:t+HOUR};if(record.count>=limit)return {accepted:false};records.push([key,record]);}
   for(const [key,r]of records)await tx.put(key,{...r,count:r.count+1});
   await tx.put('subscriber:challenge:'+input.tokenHash,{principal:input.principal,browserHash:input.browserHash,expiresAt:t+600000,delivered:false});
   return {accepted:true};
  }
  if(action==='activate'){
   if(!HEX.test(input.tokenHash))throw Error('invalid');
   const key='subscriber:challenge:'+input.tokenHash,record=await tx.get(key);
   if(!record||record.expiresAt<=t)return {activated:false};
   await tx.put(key,{...record,delivered:true});return {activated:true};
  }
  if(action==='discard'){if(!HEX.test(input.tokenHash))throw Error('invalid');await tx.delete('subscriber:challenge:'+input.tokenHash);return {discarded:true};}
  if(action==='verify') {
   if(![input.tokenHash,input.browserHash,input.sessionHash].every(x=>typeof x==='string'&&HEX.test(x)))return {valid:false};
   const key='subscriber:challenge:'+input.tokenHash,record=await tx.get(key);
   if(!record||record.delivered!==true||record.expiresAt<=t||record.browserHash!==input.browserHash)return {valid:false};
   const expiresAt=t+24*HOUR;await tx.put('subscriber:session:'+input.sessionHash,{principal:record.principal,expiresAt});await tx.delete(key);return {valid:true,expiresAt};
  }
  if(action==='session'||action==='logout') {
   if(!HEX.test(input.sessionHash))return {valid:false};const key='subscriber:session:'+input.sessionHash,record=await tx.get(key);
   if(!record||record.expiresAt<=t)return {valid:false};
   if(action==='logout')await tx.delete(key);
   return {valid:true,principal:record.principal,expiresAt:record.expiresAt};
  }
  throw Error('invalid command');
 });
}
