import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('real SQLite Durable Object serializes paid reservations and persists replay protection across runtime restart',async()=>{
 const principal='a'.repeat(64);
 // TEST ONLY router/seed. Never part of production src or deployment entry.
 const bundle=await build({stdin:{contents:`import {BetaUsageLimiter as Base} from './src/worker.js';
 export class LedgerTest extends Base { async fetch(request) {
 const path=new URL(request.url).pathname;
 if(path==='/seed'){await this.storage.put('paid-binding:cus_fixture',{principal:'${principal}',subscriptionId:'sub_fixture'});return Response.json({ok:true});}
 if(path==='/inspect')return Response.json({credit:await this.storage.get('paid-credit:${principal}'),budget:await this.storage.get('2027-01-15:budget')});
 return super.fetch(request);}}
 export default {fetch(request,env){return env.LEDGER.get(env.LEDGER.idFromName('global')).fetch(request);}};`,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',platform:'browser'});
 const directory=await mkdtemp(join(tmpdir(),'cluttercash-ledger-'));
 const options={modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',durableObjects:{LEDGER:{className:'LedgerTest',useSQLite:true}},durableObjectsPersist:directory,bindings:{STRIPE_BILLING_MODE:'test',STRIPE_PRICE_ID:'price_fixture'}};
 let mf=new Miniflare({...convertV4MiniflareOptions(options), resourcePersistencePath:directory});
 const call=async(path,body={})=>{const r=await mf.dispatchFetch(`http://localhost${path}`,{method:'POST',body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
 const grant={eventId:'evt_first',invoiceId:'in_first',customerId:'cus_fixture',subscriptionId:'sub_fixture',priceId:'price_fixture',livemode:false,periodStart:1800000000000,periodEnd:1802678400000};
 const reserve={day:'2027-01-15',timestamp:1800000001000,inviteHash:`paid:${principal}`,inviteLimit:3,inviteWindowMs:604800000,budgetMicroUsd:100,requestCostMicroUsd:1};
 try {
 await call('/seed');assert.equal((await call('/billing/grant',grant)).granted,true);
 const results=await Promise.all(Array.from({length:25},()=>call('/reserve',reserve)));
 assert.equal(results.filter(r=>r.allowed).length,10);
 assert.deepEqual(await call('/inspect'),{credit:{subscriptionId:'sub_fixture',periodStart:grant.periodStart,periodEnd:grant.periodEnd,remaining:0},budget:10});
 await mf.dispose();mf=new Miniflare({...convertV4MiniflareOptions(options), resourcePersistencePath:directory});
 assert.equal((await call('/billing/grant',{...grant,eventId:'evt_replayed'})).granted,false);
 assert.equal((await call('/reserve',reserve)).allowed,false);
 assert.equal((await call('/inspect')).budget,10);
 } finally {await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
