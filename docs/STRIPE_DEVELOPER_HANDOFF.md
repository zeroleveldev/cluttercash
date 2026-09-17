# Stripe durable developer handoff

## Current release status — recovered slice 15

Local TEST implementation only, payments inactive. The custom-domain conversion is complete locally. **233 serial Worker / 94 full Flutter tests pass**, analyzer is clean, the root-domain release build and Worker dry-run pass, and the build renders at `/` in a 390x844 browser with return fragments stripped. No real Stripe/email/AI acceptance or deployment occurred.

The current `build/web` targets `https://cluttercash-api.zeroleveldev.workers.dev`, uses `<base href="/">`, carries `CNAME` for `cluttercash.app`, and enables the TEST billing UI. It must not be published until the matching Worker origin/return-link configuration is deployed under fresh owner authorization. TEST billing remains a sandbox feature gate, not live-mode support.

## Implemented interfaces

- `lib/services/subscriber.dart`: SubscriberApi/SubscriberState explicit challenge, confirmation, refresh, hosted URL preparation and logout; persistent paidIntent/reauthRequired prevents silent free fallback after session expiry. Conditional subscriber bridges call synchronous `web/subscriber_bootstrap.js`; `lib/main.dart` supplies paid state to both scan routes.
- `/#subscriber_verify=<capability>` is captured/stripped before Flutter routing; explicit POST uses independently retained browser proof. `/#billing_return` grants nothing; refresh reads server state. Proof: ten-minute localStorage; bearer: at most 24-hour sessionStorage; noncredential intent remains until explicit logout. JS-accessible storage is not XSS protection. Logout revokes current session only, not all devices or other tabs' in-memory sessions.
- POST `/v1/subscriber/challenge` `{email,browserToken}`; `/verify` `{token,browserToken}` returns `{sessionToken,expiresAt}`. `/session` and `/logout` accept `{}` plus Bearer. Strict approved HTTPS Origin/no queries.
- POST `/v1/billing/checkout`, `/status`, `/portal`: `{}` plus server-authenticated Bearer/strict Origin. Client does not choose Price/customer/subscription/return. Prepare exact-host HTTPS URL explicitly, then offer real Link. Status binding is NOT entitlement; use server `entitled/state/remaining/periodEnd`.
- `/v1/scans` and `/v1/items/identify` prioritize supplied paid bearer and never retry free on invalid/expired bearer. Global DO transaction debits paid credit and reserves provider budget atomically.
- `stripe-checkout.js`: durable principal/customer/session attempt mappings, fixed idempotency keys, authoritative completed-session binding. Metadata/redirects alone never grant. Slice 14 supports repeated canceled-subscription repurchase and expired replacements with authoritative paginated all-status history plus durable retired ownership, same-transaction CAS and retained replay markers. Supersedes the old one-canceled-history limit.
- `stripe-billing.js`/`stripe-webhook.js`: raw bounded signed snapshot events, pinned `2026-08-26.dahlia`, authoritative retrieval; eligible invoice.paid grants ten, event/invoice/period dedupe, terminal cancellation latch. `paid-ledger.js` owns ledger; `subscriber-identity.js` owns challenge/session; `subscriber-email.js` is the bounded optional Resend adapter.
- Mounted real SQLite workerd mock journey now covers challenge -> verify -> Checkout -> authoritative binding -> invoice -> paid exhaustion -> restart -> renewal/cancellation -> repeated purchase. This is implemented, not a pending developer slice. Fixture seed/inspect routes remain test-only.

## Recovered browser evidence boundaries

`docs/evidence/stripe-15/journey.json` has 11 steps and no pageerror/harness failure entries. Screenshots/log prove challenge, stripped fragment/explicit verify, no credit before payment, exact hosted anchors and intercepted destinations, no credit on return, synthetic status ten, paid upload Authorization header and logout/intent removal. All external requests were intercepted; no real payment happened.

Do not overclaim: hosted-link helper allows DOM fallback after forced click, so physical trusted gestures remain unverified. Upload mock returns incomplete result shape: browser shows contract failure, proving header transport but not successful analysis or debit. Font requests still target Google and were locally substituted, so `--no-web-resources-cdn` alone is not a first-party resource guarantee. Browser/Worker tests are distinct synthetic layers, not full live-service integration. Earlier `FAILED.png`/`attempt1.json` are historical harness failures.

## Remaining developer/release gates

1. Owner-approved refund/dispute/reinstatement policy and authoritative handling plus regressions. Refunds/disputes are currently NOT handled; do not describe them as fail-closed. Confirm period-end cancellation and no-carryover policy before launch.
2. Broader injected transaction-failure/rollback matrix, financial-record retention, and operator reconciliation for untracked ambiguous creation older than 23 hours. Bounded history rejects unknown/unowned/nonterminal entries, errors and more than ten pages/1000 entries. Do not delete financial/attempt/binding keys. External dashboard/other-service subscription creation must not race this server.
3. Deploy only after explicit authorization with actual test API/origins, server secrets, verified Resend sender and explicit portal configuration. Validate restrictive CSP, self-hosted resources/fonts, history/referrer safety and artifact hashes. Current bootstrap matches source; release JS hash is recorded in final verification.
4. Separately authorized real inbox, Stripe sandbox, physical-phone/browser storage, trusted Link and cross-device restoration acceptance. No real AI use is implied by test billing permission. Preserve free-three/no signup/card and free saved work.
5. Live-mode implementation and production verification require separate authorization; current server deliberately rejects live. Never present test-local completion as production readiness.

## Owner actions

Use the consolidated `STRIPE_MANUAL_SETUP.md`: intended TEST account/Product/Price, portal policy/config ID, refund/dispute decisions, verified Resend domain/sender/tracking settings, secure vault/Worker secret handoff and separately authorized deployment/sandbox test. Do not ask the owner to write code or paste keys into chat.

## Cleanup/recovery

Recovered transcript: `C:/Users/Sgrab/AppData/Local/hermes/cache/delegation/live/deleg_1a4ee478/task-0.log`, final successful command lines 109–110, subsequent timeout 111–112. Owned browser server port 8886 is closed (connection refused); this recovery started no server. `git diff --check` passes with existing CRLF warnings. Do not restart completed work solely because the delegation summary timed out.
