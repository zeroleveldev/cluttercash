// Internal normalized commands only. Never expose these DO paths publicly or
// forward a webhook body here: upstream MUST retrieve/validate Stripe resources.
export function paidLedgerConfigured(env) {
  return env.STRIPE_BILLING_MODE === 'test'
    && typeof env.STRIPE_PRICE_ID === 'string' && /^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_ID);
}
const id = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,128}$`).test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export async function paidLedgerCommand(storage, env, path, input) {
  if (!paidLedgerConfigured(env)) return {status:503,error:'Billing unavailable.'};
  const grant = path === '/billing/grant';
  const keys = grant ? ['eventId','invoiceId','customerId','subscriptionId','priceId','livemode','periodStart','periodEnd'] : ['customerId','subscriptionId'];
  if (!input || typeof input !== 'object' || Object.keys(input).some(key=>!keys.includes(key))
    || !id(input.customerId,'cus') || !id(input.subscriptionId,'sub')
    || (grant && (!id(input.eventId,'evt') || !id(input.invoiceId,'in')
      || input.priceId !== env.STRIPE_PRICE_ID || input.livemode !== false
      || !Number.isSafeInteger(input.periodStart) || input.periodStart <= 0
      || !Number.isSafeInteger(input.periodEnd) || input.periodEnd <= input.periodStart))) {
    return {status:400,error:'Invalid billing command.'};
  }
  return storage.transaction(async tx=>{
    const retired=await tx.get(`paid-retired:${input.subscriptionId}`);
    if (retired?.customerId===input.customerId && hash(retired.principal)) return {status:200,granted:false,retired:true};
    const binding=await tx.get(`paid-binding:${input.customerId}`);
    if (binding?.retired) return {status:503,error:'Binding pending.'};
    if (!binding && await tx.get('checkout-customer:'+input.customerId)) return {status:503,error:'Binding pending.'};
    if (!hash(binding?.principal) || binding.subscriptionId !== input.subscriptionId) return {status:400,error:'Invalid billing binding.'};
    if (path === '/billing/check') return {status:200,bound:true};
    const blockKey=`paid-block:${input.subscriptionId}`;
    if (!grant) {
      // Conservative latch: only future authenticated reconciliation may unblock.
      // Arrival timestamps cannot prove lifecycle event ordering.
      await tx.put(blockKey,true);
      return {status:200,blocked:true};
    }
    if (await tx.get(blockKey)) return {status:409,granted:false};
    const eventKey=`paid-event:${input.eventId}`;
    const invoiceKey=`paid-invoice:${input.invoiceId}`;
    const creditKey=`paid-credit:${binding.principal}`;
    if (await tx.get(eventKey) || await tx.get(invoiceKey)) return {status:200,granted:false};
    const previous=await tx.get(creditKey);
    const previousRetired=previous && await tx.get('paid-retired:'+previous.subscriptionId);
    const replacing=previous && previous.subscriptionId!==input.subscriptionId && previousRetired?.principal===binding.principal && previousRetired.customerId===input.customerId && await tx.get('paid-block:'+previous.subscriptionId);
    if (previous && !replacing && (previous.subscriptionId !== input.subscriptionId || input.periodStart < previous.periodEnd)) {
      // Same-period distinct invoices and historical/overlapping periods never refill.
      await tx.put({[eventKey]:true,[invoiceKey]:true});
      return {status:200,granted:false};
    }
    await tx.put({[eventKey]:true,[invoiceKey]:true,[creditKey]:{
      subscriptionId:input.subscriptionId,periodStart:input.periodStart,periodEnd:input.periodEnd,remaining:10,
    }});
    return {status:200,granted:true};
  });
}

export async function paidCreditForReservation(tx, env, principal, timestamp) {
  if (!paidLedgerConfigured(env) || !hash(principal)) return null;
  const credit=await tx.get(`paid-credit:${principal}`);
  if (!credit || !id(credit.subscriptionId,'sub') || await tx.get(`paid-block:${credit.subscriptionId}`)
    || !Number.isSafeInteger(credit.remaining) || credit.remaining < 1 || credit.remaining > 10
    || !Number.isSafeInteger(credit.periodStart) || !Number.isSafeInteger(credit.periodEnd)
    || timestamp < credit.periodStart || timestamp >= credit.periodEnd) return null;
  return credit;
}
