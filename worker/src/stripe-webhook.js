import Stripe from 'stripe';

const MAX_WEBHOOK_BYTES = 256 * 1024;
const TOLERANCE_SECONDS = 300;

/** Local foundation only: authenticates an event, never grants entitlement.
 * Call with untouched request body, server environment and server clock only.
 * A valid signature is NOT subscription ownership or payment eligibility.
 */
export async function verifyTestStripeEvent({ rawBody, signature, env = {}, nowMs = Date.now() } = {}) {
  try {
    if (env.STRIPE_BILLING_MODE !== 'test'
        || typeof env.STRIPE_WEBHOOK_SECRET !== 'string'
        || !env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')
        || typeof rawBody !== 'string'
        || new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES
        || typeof signature !== 'string'
        || !Number.isSafeInteger(nowMs) || nowMs <= 0) throw new Error();
    // Stripe's SDK checks stale deliveries; also reject excessively future ones.
    const timestamps = signature.split(',').filter(part => part.startsWith('t='));
    if (timestamps.length !== 1 || !/^t=\d+$/.test(timestamps[0])) throw new Error();
    const timestamp = Number(timestamps[0].slice(2));
    if (!Number.isSafeInteger(timestamp)
        || Math.abs(Math.floor(nowMs / 1000) - timestamp) > TOLERANCE_SECONDS) throw new Error();
    const event = await Stripe.webhooks.constructEventAsync(
      rawBody, signature, env.STRIPE_WEBHOOK_SECRET, TOLERANCE_SECONDS,
      Stripe.createSubtleCryptoProvider(), nowMs,
    );
    if (event?.object !== 'event' || event.livemode !== false
        || typeof event.id !== 'string' || !event.id.startsWith('evt_')
        || typeof event.type !== 'string' || !event.type
        || !event.data?.object || typeof event.data.object !== 'object') throw new Error();
    return event;
  } catch {
    // Do not leak payloads, customer information, signature or signing material.
    throw new Error('Stripe webhook rejected.');
  }
}
