import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
test('real subscriber DO: concurrent single use, restart session and logout',async()=>{
 const bundle=await build({stdin:{contents:`import {BetaUsageLimiter as Base} from './src/worker.js';
 export class IdentityTest extends Base {async fetch(request){if(new URL(request.url).pathname==='/inspect')return Response.json([...await this.storage.list({prefix:'subscriber:'})]);return super.fetch(request);}}
 export default {fetch(request,env){return env.IDENTITY.get(env.IDENTITY.idFromName('global')).fetch(request);}};`,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',platform:'browser'});
 const directory=await mkdtemp(join(tmpdir(),'cluttercash-identity-'));
 const options={modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',durableObjects:{IDENTITY:{className:'IdentityTest',useSQLite:true}},bindings:{STRIPE_BILLING_MODE:'test'}};
 const create=()=>new Miniflare({...convertV4MiniflareOptions(options),resourcePersistencePath:directory});let mf=create();
 const timestamp=Date.now(),principal='a'.repeat(64),browserHash='b'.repeat(64),tokenHash='c'.repeat(64),sessionHash='d'.repeat(64);
 const call=async(path,body={})=>{const r=await mf.dispatchFetch('http://localhost'+path,{method:'POST',body:JSON.stringify({timestamp,...body})});assert.equal(r.status,200);return r.json();};
 try{
 assert.equal((await call('/subscriber/start',{principal,browserHash,tokenHash,network:'e'.repeat(64)})).accepted,true);
 assert.equal((await call('/subscriber/verify',{tokenHash,browserHash,sessionHash})).valid,false);
 assert.equal((await call('/subscriber/activate',{tokenHash})).activated,true);
 const results=await Promise.all(Array.from({length:12},()=>call('/subscriber/verify',{tokenHash,browserHash,sessionHash})));
 assert.equal(results.filter(r=>r.valid).length,1);
 await mf.dispose();mf=create();assert.equal((await call('/subscriber/session',{sessionHash})).principal,principal);
 assert.equal((await call('/subscriber/verify',{tokenHash,browserHash,sessionHash})).valid,false);
 assert.equal((await call('/subscriber/logout',{sessionHash})).valid,true);
 assert.equal((await call('/subscriber/session',{sessionHash})).valid,false);
 assert.equal((await call('/inspect')).some(([k])=>k.startsWith('subscriber:challenge:')||k.startsWith('subscriber:session:')),false);
 }finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
