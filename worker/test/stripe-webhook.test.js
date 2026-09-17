import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyTestStripeEvent } from '../src/stripe-webhook.js';

// Synthetic local signing material, not an account credential.
const secret = 'whsec_synthetic_local_test_only';
const now = 1800000000000;
const env = { STRIPE_BILLING_MODE: 'test', STRIPE_WEBHOOK_SECRET: secret };
const event = { id: 'evt_synthetic', object: 'event', type: 'invoice.paid', livemode: false, data: { object: { id: 'in_synthetic' } } };
function signed(body = JSON.stringify(event), timestamp = now / 1000, key = secret) {
  const signature = createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex');
  return { rawBody: body, signature: `t=${timestamp},v1=${signature}`, env, nowMs: now };
}
test('verifies exact raw bytes with official Stripe async verifier', async () => {
  assert.deepEqual(await verifyTestStripeEvent(signed()), event);
});
for (const [name, change] of [
  ['missing mode', x => { x.env = { STRIPE_WEBHOOK_SECRET: secret }; }],
  ['live mode', x => { x.env = { ...env, STRIPE_BILLING_MODE: 'live' }; }],
  ['missing signing secret', x => { x.env = { STRIPE_BILLING_MODE: 'test' }; }],
  ['missing signature', x => { x.signature = null; }],
  ['modified raw body', x => { x.rawBody += ' '; }],
  ['wrong signing secret', x => { x.env = { ...env, STRIPE_WEBHOOK_SECRET: 'whsec_wrong' }; }],
  ['expired signature', x => { Object.assign(x, signed(undefined, now / 1000 - 301)); }],
  ['future signature', x => { Object.assign(x, signed(undefined, now / 1000 + 301)); }],
  ['signed live event', x => { Object.assign(x, signed(JSON.stringify({ ...event, livemode: true }))); }],
  ['missing livemode', x => { Object.assign(x, signed(JSON.stringify({ ...event, livemode: undefined }))); }],
  ['signed malformed JSON', x => { Object.assign(x, signed('{')); }],
  ['signed invalid event envelope', x => { Object.assign(x, signed(JSON.stringify({ livemode: false }))); }],
  ['oversized body', x => { Object.assign(x, signed(' '.repeat(262145))); }],
]) {
  test(`fails closed: ${name}`, async () => {
    const input = signed(); change(input);
    await assert.rejects(verifyTestStripeEvent(input), /^Error: Stripe webhook rejected\.$/);
  });
}
test('accepts rotated v1 signatures when one matches', async () => {
  const input = signed(); input.signature += ',v1=' + '0'.repeat(64);
  assert.deepEqual(await verifyTestStripeEvent(input), event);
});
