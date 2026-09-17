// Optional Resend REST adapter. No logs, retries, tracking payloads or client configuration.
const MAILBOX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
export const SUBSCRIBER_LINK_PATH = '/';
export const SUBSCRIBER_LINK_FRAGMENT = 'subscriber_verify=';
export function createSubscriberEmailSender(env,{fetcher=globalThis.fetch,timeoutMs=5000}={}) {
 try {
  const origin=new URL(env.SUBSCRIBER_APP_ORIGIN);
  if(env.STRIPE_BILLING_MODE!=='test'||env.SUBSCRIBER_EMAIL_ENABLED!=='true'||env.SUBSCRIBER_EMAIL_PROVIDER!=='resend'||env.SUBSCRIBER_EMAIL_TRACKING_DISABLED!=='true'||!/^re_[A-Za-z0-9_-]{8,200}$/.test(env.RESEND_API_KEY)||typeof env.SUBSCRIBER_EMAIL_FROM!=='string'||env.SUBSCRIBER_EMAIL_FROM.length>254||!MAILBOX.test(env.SUBSCRIBER_EMAIL_FROM)||origin.protocol!=='https:'||origin.origin!==env.SUBSCRIBER_APP_ORIGIN)return undefined;
 }catch{return undefined;}
 return async message=>{
  let timer,reader;const controller=new AbortController();
  const cancel=()=>{controller.abort();if(reader)void reader.cancel().catch(()=>{});};
  try {
   const prefix=env.SUBSCRIBER_APP_ORIGIN+SUBSCRIBER_LINK_PATH+'#'+SUBSCRIBER_LINK_FRAGMENT;
   if(typeof message?.email!=='string'||message.email.length>254||!MAILBOX.test(message.email)||typeof message.url!=='string'||!message.url.startsWith(prefix)||!/^[a-f0-9]{64}$/.test(message.url.slice(prefix.length))||message.expiresInSeconds!==600)return false;
   const operation=(async()=>{
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:controller.signal,headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.SUBSCRIBER_EMAIL_FROM,to:[message.email],subject:'Confirm your ClutterCash sign-in',text:'Open this link in the browser where you requested sign-in, then confirm. It expires in 10 minutes. If you did not request this, ignore this email.\n\n'+message.url})});
    if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});return false;}
    reader=response.body?.getReader();if(!reader)return false;
    if(response.status!==200)return false;
    let size=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)return false;chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));return typeof result?.id==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(result.id);
   })();
   return await Promise.race([operation,new Promise(resolve=>{timer=setTimeout(()=>{cancel();resolve(false);},Math.min(5000,Math.max(1,timeoutMs)));})]);
  }catch{return false;}finally{clearTimeout(timer);cancel();}
 };
}
