import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
const entry = new URL('../src/index.js', import.meta.url);
for (const override of [{NODE_ENV:'production'}, {HOST:'0.0.0.0'}, {HOST:'192.168.1.10'}, {HOST:'::'}]) {
  test(`CC-09 entry fails closed for ${JSON.stringify(override)}`, () => {
    const result = spawnSync(process.execPath, [entry.pathname.replace(/^\/(.:)/,'$1')], {
      env:{...process.env, NODE_ENV:'development', HOST:'127.0.0.1', PORT:'0', OPENAI_API_KEY:'', ...override},
      encoding:'utf8', timeout:1500,
    });
    assert.equal(result.status,1);
    assert.match(result.stderr,/local development only/i);
  });
}
test('CC-09 default entry binds explicit IPv4 loopback', async () => {
  const env = {...process.env, NODE_ENV:'development', PORT:'0', OPENAI_API_KEY:''};
  delete env.HOST;
  const child = spawn(process.execPath,[entry.pathname.replace(/^\/(.:)/,'$1')],{env});
  try {
    const output = await new Promise((resolve,reject) => {
      const timer = setTimeout(()=>reject(new Error('startup timed out')),3000);
      child.stdout.once('data', data=>{clearTimeout(timer);resolve(data.toString());});
      child.once('error',reject);
    });
    assert.match(output,/http:\/\/127\.0\.0\.1:/);
  } finally { child.kill(); await new Promise(resolve=>child.once('exit',resolve)); }
});
