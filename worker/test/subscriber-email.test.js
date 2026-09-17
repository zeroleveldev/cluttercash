import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as adapter from '../src/subscriber-email.js';
const env={STRIPE_BILLING_MODE:'test',SUBSCRIBER_EMAIL_ENABLED:'true',SUBSCRIBER_EMAIL_PROVIDER:'resend',RESEND_API_KEY:'re_synthetic_only',SUBSCRIBER_EMAIL_FROM:'signin@auth.example.com',SUBSCRIBER_EMAIL_TRACKING_DISABLED:'true',SUBSCRIBER_APP_ORIGIN:'https://app.example'};
const message={email:'payer@example.com',url:'https://app.example/#subscriber_verify='+ 'a'.repeat(64),expiresInSeconds:600};
const ok=()=>Response.json({id:'49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'});
test('explicit complete configuration only; fixed provider and minimal fragment message',async()=>{
 let calls=[]; const fetcher=async(...args)=>{calls.push(args);return ok();};
 assert.equal(typeof adapter.createSubscriberEmailSender,'function');
 for(const key of Object.keys(env)){assert.equal(adapter.createSubscriberEmailSender({...env,[key]:undefined},{fetcher}),undefined);}
 for(const changes of [{STRIPE_BILLING_MODE:'live'},{SUBSCRIBER_EMAIL_FROM:'Help <help@gmail.com>'},{SUBSCRIBER_EMAIL_FROM:'a@b.com\r\nBcc:x@y.com'},{SUBSCRIBER_APP_ORIGIN:'https://app.example/path'},{SUBSCRIBER_EMAIL_TRACKING_DISABLED:'false'}])assert.equal(adapter.createSubscriberEmailSender({...env,...changes},{fetcher}),undefined);
 const send=adapter.createSubscriberEmailSender(env,{fetcher});assert.equal(await send(message),true);assert.equal(calls.length,1);
 const [url,options]=calls[0];assert.equal(url,'https://api.resend.com/emails');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer re_synthetic_only');
 const payload=JSON.parse(options.body);assert.deepEqual(Object.keys(payload).sort(),['from','subject','text','to']);assert.equal(payload.from,env.SUBSCRIBER_EMAIL_FROM);assert.deepEqual(payload.to,[message.email]);assert.ok(payload.text.includes(message.url));assert.ok(!payload.subject.includes(message.email));
 for(const url of ['https://evil.example/#subscriber_verify='+ 'a'.repeat(64),'https://app.example/subscriber/verify#'+ 'a'.repeat(64),message.url+'&next=evil',message.url.replace('/#','/?token=secret#')])assert.equal(await send({...message,url}),false);
 assert.equal(await send({...message,email:'a@b.com,other@b.com'}),false);assert.equal(calls.length,1);
});
test('provider rejection, malformed/oversized response and exceptions are false without retries or logging',async()=>{
 assert.equal(typeof adapter.createSubscriberEmailSender,'function');
 for(const fetcher of [async()=>new Response('private token email',{status:429}),async()=>Response.json({}),async()=>new Response('x'.repeat(4097)),async()=>{throw Error('private token email');},async()=>Response.json({id:'bad'})]){
 let calls=0;const send=adapter.createSubscriberEmailSender(env,{fetcher:async(...args)=>{calls++;return fetcher(...args);}});assert.equal(await send(message),false);assert.equal(calls,1);
 }
});
for(const phase of ['headers','body'])test('one deadline bounds stalled '+phase+' even if fetch ignores abort',async()=>{
 assert.equal(typeof adapter.createSubscriberEmailSender,'function');let signal,calls=0,cancelled=false;
 const fetcher=async(u,o)=>{signal=o.signal;calls++;return phase==='headers'?new Promise(()=>{}):new Response(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}}));};
 const send=adapter.createSubscriberEmailSender(env,{fetcher,timeoutMs:20});const before=Date.now();assert.equal(await send(message),false);assert.ok(Date.now()-before<1000);assert.equal(signal.aborted,true);assert.equal(calls,1);if(phase==='body')assert.equal(cancelled,true);
});
