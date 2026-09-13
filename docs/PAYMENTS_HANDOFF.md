# Deferred Stripe integration

Owner decision: defer Stripe setup and implementation until Sam is home. No payment integration or live payment configuration has been performed.

## Approved offer

- Three free scans without signup, invite, or payment card.
- Optional subscription: USD 1.99 per month, including 10 scans per billing month.
- Saved projects, corrections, and marketplace research remain accessible without a subscription.
- Payment/account recovery is introduced only for users who choose to subscribe.

## Next session

Confirm whether the owner already has a Stripe account. Owner completes identity/business/tax and bank/payout requirements directly in Stripe; never collect credentials or financial details in chat. Implement and verify test-mode hosted checkout, server-verified subscription events, idempotent credit allocation, atomic scan consumption, cancellation/failed-payment handling and secure paid-access restoration before enabling live payments. Rollover and other unspecified subscription policies remain undecided.

This product decision does not approve deployment, actual provider spending, the proposed Worker reservation pools, or Android release signing. Existing audit/remediation/runtime evidence is in FINAL_AUDIT.md, LAUNCH_FIX_PROGRESS.md and LAUNCH_BROWSER_SMOKE.md. Keep live activation gated until owner authorization and verification.
