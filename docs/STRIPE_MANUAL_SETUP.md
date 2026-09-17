# Stripe manual setup — owner morning checklist

## Current state

Payments are NOT active. Approved offer: **three free scans without signup or card; optional USD 1.99/month for ten scans per billing month; saved projects, correction and research stay free.**

Local implementation and root-domain conversion are verified: 233 Worker tests and 94 Flutter tests passed; analyzer, release build, Worker dry-run, root assets, return-fragment stripping, and a mobile browser render passed. This is NOT actual Stripe sandbox, inbox delivery or physical-phone acceptance. The build targets the public Worker, but neither the Worker changes nor this web build are deployed without fresh owner authorization.

## Do these owner actions first (no deployment or activation implied)

1. **Stripe account:** sign in to the intended account and select its TEST sandbox. Verify/create one active Product and a licensed, quantity-one, USD 1.99 recurring monthly Price (one-month interval). Record the actual `prod_...` and `price_...` IDs for server configuration; never substitute fixture IDs. Do not add discounts, trials, tax, alternate currencies or usage-based pricing to this fixed-price integration.
2. **Cancellation portal:** create/select an explicit TEST portal configuration (`bpc_...`) with subscription cancellation enabled. Choose immediate versus end-of-paid-period cancellation deliberately; disable unapproved plan changes/retention offers. Record the configuration ID. The code does not validate dashboard feature settings, so these must later be exercised in sandbox.
3. **Policy decisions:** approve cancellation timing, full/partial-refund eligibility and paid-credit treatment, disputes and reinstatement. Current terminal cancellation blocks paid access; scheduled cancellation leaves already-paid allowance until expiry; failed renewal grants no new allowance. Refund/dispute handlers are NOT implemented. Approve whether the implemented reset-to-ten/no-carryover allowance and indefinite financial replay-marker retention are acceptable or require changes before release.
4. **Transactional email:** select/verify an owned sending domain in Resend, install its required DNS records, wait for verified status, and choose the exact bare sender mailbox on that domain. `cluttercash.help@gmail.com` is a support address, NOT proof of an authorized sending domain or Gmail SMTP permission. Disable domain open/click tracking and link rewriting. Review provider pricing, retention and access controls. Create a domain-scoped sending-only API key in secure storage; no messages need to be sent yet.
5. **Secure configuration handoff:** store credentials in an approved secure vault and, only after test-deployment authorization, the Worker secret store. Never paste passwords, API keys, signing secrets, identity secrets or verification links into chat, source, client builds or logs. Use the UI vault/login flow for account authentication; do not send credentials to the assistant in chat. Keep the persistent identity secret backed up securely: rotation changes subscriber principals and requires migration.
6. **Authorize a separate TEST deployment/delivery acceptance session** after developer gates below are reviewed. Supply the intended app HTTPS origin and actual test Worker URL to the developer. Do not guess a webhook URL or change existing AI budgets. Live authorization is a separate future decision.

## Configuration inventory for the authorized developer/operator

Server-only secret store:
- `STRIPE_SECRET_KEY`: intended account's actual TEST API secret.
- `STRIPE_WEBHOOK_SECRET`: signing secret of the exact deployed TEST webhook destination.
- `RESEND_API_KEY`: scoped sending key for the verified domain.
- `SUBSCRIBER_IDENTITY_SECRET`: persistent securely generated high-entropy value, at least 32 characters; never client-side.

Server configuration (IDs/flags are not authenticators):
- `STRIPE_BILLING_MODE=test`
- `STRIPE_PRICE_ID=price_...`, `STRIPE_PRODUCT_ID=prod_...`
- `STRIPE_PORTAL_CONFIGURATION_ID=bpc_...`
- `SUBSCRIBER_EMAIL_ENABLED=true`, `SUBSCRIBER_EMAIL_PROVIDER=resend`
- `SUBSCRIBER_EMAIL_FROM`: exact bare authorized sender, no display name or headers.
- `SUBSCRIBER_EMAIL_TRACKING_DISABLED=true`: owner attestation, not automatic verification.
- `SUBSCRIBER_APP_ORIGIN`: exact HTTPS app origin, no path/trailing slash; align allowed CORS origin.
- Retain existing `BETA_USAGE_LIMITER` global Durable Object binding and existing budget guards.

The frontend test build requires the real authorized API configuration and `CLUTTERCASH_TEST_BILLING=true`; no Stripe/Resend/identity secret belongs in Flutter. Email lands at `https://cluttercash.app/#subscriber_verify=<capability>`; billing return is `https://cluttercash.app/#billing_return`.

Missing configuration fails closed. Authentication mail is bounded and nonretrying; generic acceptance is not proof of inbox delivery. Request a fresh challenge in the receiving browser when restoring on another device.

## Only after the test Worker is actually deployed

1. Register its **actual HTTPS origin + `/v1/billing/webhook`** in the same Stripe TEST sandbox. Use snapshot events, API version **2026-08-26.dahlia**, and these exact types:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
2. Put that destination's signing secret into the authorized test Worker's secret store. Do not register thin notifications or reuse an unrelated destination's secret. Developer verifies configuration and endpoint behavior without exposing secrets.
3. Jointly run a separately authorized small real-email/Stripe-sandbox acceptance: browser-bound confirmation, wrong-browser/single-use/expiry, Checkout success/cancel/abandonment, invoice grant exactly ten, duplicate/out-of-order no refill, renewal/payment failure, portal cancellation, return status, repeat purchase, restoration and expired-session explicit logout. Any real AI scan needs separate permission/budget; do not treat payment testing as permission for paid AI calls.
4. Verify free three still need no account/card, and saved projects/corrections/research remain accessible without subscribing.

## Developer gates — not owner coding tasks

- Implement owner-approved refund/dispute/reinstatement handling with authoritative resources and regressions; currently these events do not revoke access automatically.
- Broaden injected durable-transaction failure/rollback coverage; design financial-marker retention and ambiguous creation reconciliation. Unknown history, over ten pages/1000 entries and untracked creation older than 23 hours fail closed. Never delete attempt/binding/replay keys to unblock a purchase.
- Verify restrictive deployed CSP, self-hosted fonts/resources, credential history/referrer behavior, same-browser/new-device mail recovery, real trusted hosted-link gestures and physical-phone usability. Local fallback clicks are not physical-device evidence.
- Run real sandbox acceptance and exact deployed artifact comparison. This server must remain the exclusive subscription creator for tracked customers; concurrent dashboard/other-service creation is outside its transaction boundary.
- Live mode is deliberately rejected. Live support, production policy/configuration verification and explicit live-payment authorization remain separate future gates. Do not simply flip a flag.
