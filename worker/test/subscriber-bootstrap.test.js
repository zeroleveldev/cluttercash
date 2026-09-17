import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../../web/subscriber_bootstrap.js', import.meta.url), 'utf8');
function boot(hash, data = new Map()) {
 const calls=[]; const store={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const context={location:{hash,pathname:'/'},history:{replaceState:(...args)=>calls.push(args)},window:{},localStorage:store,sessionStorage:store,Date};
 vm.runInNewContext(source,context);return {...context,calls,data};
}
test('capture removes fragment before one-shot memory handoff; no network',()=>{
 const c=boot('#subscriber_verify='+'a'.repeat(64));
 assert.deepEqual(c.calls,[[null,'','/']]);
 assert.equal(c.window.cluttercashSubscriberTake(),'a'.repeat(64));
 assert.equal(c.window.cluttercashSubscriberTake(),null);assert.equal(c.data.size,0);
});
test('malformed fragments and billing return are sanitized without redemption',()=>{
 for(const hash of ['#subscriber_verify=bad','#subscriber_verify='+'a'.repeat(64)+'&extra=x']) {
 const c=boot(hash);assert.equal(c.window.cluttercashSubscriberTake(),'invalid');assert.equal(c.calls.length,1);
 }
 const c=boot('#billing_return');assert.equal(c.window.cluttercashSubscriberTake(),'billing_return');assert.equal(c.calls.length,1);
});
test('expired local proof and arbitrary email cannot restore credentials',()=>{
 const c=boot('');c.data.set('cluttercash.subscriber.proof',JSON.stringify({value:'a'.repeat(64),expires:1}));
 assert.equal(c.window.cluttercashSubscriberRead('proof'),null);
 c.data.set('cluttercash.subscriber.session',JSON.stringify({value:'payer@example.com',expires:Date.now()+60000}));
 assert.equal(c.window.cluttercashSubscriberRead('session'),null);
});
test('missing or malformed retention expiry cannot restore credentials',()=>{
 for (const expires of [undefined,null,'tomorrow',Date.now()+172800000]) {
  const c=boot('');c.data.set('cluttercash.subscriber.session',JSON.stringify({value:'a'.repeat(64),expires}));
  assert.equal(c.window.cluttercashSubscriberRead('session'),null);
  assert.equal(c.data.has('cluttercash.subscriber.session'),false);
 }
});
test('expired and malformed sessions preserve intent through repeated reloads until explicit reset',()=>{
 for(const raw of [JSON.stringify({value:'a'.repeat(64),expires:1}),'{bad',JSON.stringify({value:'a'.repeat(64),expires:'tomorrow'})]) {
  const c=boot(''); c.data.set('cluttercash.subscriber.session',raw);
  assert.equal(c.window.cluttercashSubscriberRead('session'),null);
  assert.equal(c.window.cluttercashSubscriberRead('intent'),'required');
  const reload=boot('',c.data);
  assert.equal(reload.window.cluttercashSubscriberRead('intent'),'required');
  reload.window.cluttercashSubscriberWrite('intent',null);
  assert.equal(boot('',c.data).window.cluttercashSubscriberRead('intent'),null);
 }
 assert.equal(boot('').window.cluttercashSubscriberRead('intent'),null);
});
test('intent is persisted before credential and retained if credential persistence fails',()=>{
 const c=boot('');
 c.sessionStorage.setItem=(key,value)=>{if(key.endsWith('.session'))throw Error('denied');c.data.set(key,value)};
 assert.throws(()=>c.window.cluttercashSubscriberWrite('session','a'.repeat(64)));
 assert.equal(boot('',c.data).window.cluttercashSubscriberRead('intent'),'required');
});
test('early bootstrap precedes Flutter and resource elements, with no referrer',()=>{
 const html=readFileSync(new URL('../../web/index.html',import.meta.url),'utf8');
 assert.ok(html.indexOf('subscriber_bootstrap.js')<html.indexOf('<link'));
 assert.ok(html.indexOf('subscriber_bootstrap.js')<html.indexOf('flutter_bootstrap.js'));
 assert.ok(html.includes('name="referrer" content="no-referrer"'));
});
