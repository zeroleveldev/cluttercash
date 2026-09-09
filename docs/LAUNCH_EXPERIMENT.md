# ClutterCash launch experiment

## Positioning

**Point at the mess. Find the money. Clear the room.**

Audience: overwhelmed homeowners, movers, and families clearing garages/closets—not professional resellers.

## Activation funnel

1. Landing viewed
2. Scan started
3. Photo captured
4. Useful objects detected (target: at least 5)
5. Identity correction completed if needed
6. At least one item marked cleared after it leaves the space
7. Free-beta feedback/support request

### Measurement boundary

The invited build records only allow-listed, metadata-free event names for scan start/success/failure, local project creation/reopen, item correction/status update, and coarse app-crash categories. Use aggregate Worker-log counts to identify major drop-offs and reliability problems. Do not attach photos, item/project names, values, invite hashes, device/account IDs, raw errors, stack traces, or arbitrary properties; do not build per-user profiles, session replay, advertising analytics, or an analytics dashboard for this beta. Marketplace-link clicks and support requests are not instrumented in the current minimum telemetry slice.

## Validation gate

Run 30–50 authorized household cleanouts. Continue only if people can complete the workflow and use it to decide what to list or clear. A polished app, waitlist, or social views alone do not validate usefulness or willingness to pay.

## Pricing

Pricing is intentionally undecided. The invited beta is free: no subscription, scan pack, payment, trial, or in-app purchase is offered. Consider paid plans or scan packs only after the beta demonstrates repeat usefulness and the required billing, cancellation, support, and disclosure controls are ready.

## Creative hooks

- “I pointed my phone at one garage shelf…”
- “The mess wasn’t trash. It was $438.”
- “Sell these three. Donate the rest. Clear the room.”
- “This old camera was hiding in plain sight.”
- Before photo → highlighted objects → potential-value range → empty shelf

## Kill signals

- Fewer than five useful candidates in ordinary wide photos
- Identity corrections feel harder than manual eBay/Google Lens search
- Users inspect estimates but do not build an action queue
- Users research items but do not list or clear them
- Inference and acquisition costs make a future paid model unsustainable
- Support load requires marketplace integrations before users will pay
