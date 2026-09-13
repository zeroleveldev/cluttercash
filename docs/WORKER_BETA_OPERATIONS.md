# Free-beta Worker operations

ClutterCash live analysis is fail-closed. Each browser/device receives three no-registration analyses through a random local token; approved device hashes and legacy invite codes provide a separate rolling allowance. All analysis paths require an available Durable Object quota reservation and configured Gemini key. The public health, beta-request, owner-approval, and private status routes do not consume analysis quota.

## Controls

- A cryptographically random token is created in local app/browser storage. The Worker hashes it and `BetaUsageLimiter` stores only the hash plus accepted-use count, allowing three no-registration analyses total for that local token.
- Clearing local storage can create another token, so this is a low-friction trial control rather than strong identity. A separate small shared anonymous pool protects invited capacity. The global daily reservation ceiling bounds admitted Standard-model token-cost reservations, not the provider-account bill.
- Original owner/device invite codes are compared after SHA-256 hashing against the static secret. Approved in-app requests register the requesting device-token hash; no plaintext code is generated or delivered. Legacy tester codes remain supported, and only their hashes and creation times are stored.
- Hashes listed separately in `BETA_OWNER_INVITE_CODE_HASHES` bypass the three-analysis rolling allowance for owner testing. They still reserve against the global daily reservation ceiling, so “unlimited” does not mean unbounded provider spending.
- The public request form sends the submitted email and optional name/device to the private Discord webhook. One-way email/network hashes enforce one request per email and five per network address in a rolling 24-hour window. Plaintext contact fields are not stored in the Durable Object. Hashed device/status/approval tokens are retained for at most seven days while pending; approval removes the owner approval-token hash and retains a private hashed status record for at most 30 days.
- `BetaUsageLimiter` uses one Durable Object and atomic storage transactions for approved-device/invite registration, request throttling, a three-analysis rolling seven-day approved-access limit, and a separate global daily reserved-cost ceiling.
- The invite limit expires each analysis seven days after it was used; the global budget resets on the UTC date boundary.
- Every accepted request reserves `GEMINI_MAX_REQUEST_COST_MICRO_USD` before Gemini is called. Failed calls retain reservations. The configured reservation must be at least the conservative derived floor below; unsupported models and unsafe/missing reservation values fail closed. This is not a provider-account billing limit.
- The first rejected reservation at the daily ceiling emits `daily_budget_reached`. Gemini failures emit only a route name and HTTP status. Provider/budget alerts never include photos, invite codes/hashes, prompts, provider response bodies, or API keys; access-request alerts include only the contact fields the requester explicitly submitted.
- Missing/invalid access, bindings, limits, or secrets fail closed before Gemini.

The checked-in defaults are 3 live analyses per invite in a rolling seven-day window, a **5,000,000 micro-USD ($5.00)** daily reservation ceiling, and **500,000 micro-USD ($0.50)** per request. This raises the proposed daily reservation amount from $0.50 to $5.00 while reducing total default admission capacity from 50 to 10 attempts/day. These are LOCAL proposed settings, not deployed or owner billing-account settings. Operator approval of the $5/day ceiling is required before rollout; keeping the former $0.50 ceiling would admit only one attempt and cannot support the promised three-use trial.

### Conservative token-cost derivation (CC-01)

Exact model remains `gemini-3.5-flash-lite`. Official sources rechecked for this slice:
- [Model limits](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite): 1,048,576 input tokens and 65,536 output tokens.
- [Standard pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite): $0.30/M input, $2.50/M output **including thinking**. No tools, grounding, caching, priority service or extra candidates are requested.
- [Generation API](https://ai.google.dev/api/generate-content): `maxOutputTokens` limits a response candidate. Worker explicitly sends 8192 and `candidateCount: 1` on both routes. Deprecated temperature parameter removed per [release notes](https://ai.google.dev/gemini-api/docs/changelog).

The reservation intentionally does NOT depend on estimating image tiles, bytes-to-tokens, or assuming the 8192 candidate cap includes all separately reported thinking. It reserves the **entire model input window**, plus **65,536 output tokens for thinking and another 8192 visible output tokens**. Computed in micro-USD: `ceil(1048576 * 0.30 + (65536 + 8192) * 2.50) = 498893`; default rounds up to 500000. This conservative fallback relies on the provider honoring its published model limits and Standard pricing, not on a measured local token count. A larger reservation is permitted; a lower/missing/noninteger value or different/missing model fails closed before parsing/reservation/provider work. Rates are code-reviewed constants, not operator-overridable underestimates.

Multipart bodies are stream-counted before parsing, capped at 8 MiB + 64 KiB including all overhead (Content-Length alone is not trusted). One image remains capped at 8 MiB; existing closed-field and 100/40-character identity-context limits bound user text. Fixed prompts/schema add no unbounded user fields. No image dimension/signature decoder is added: the full input-window fallback deliberately avoids relying on dimensions for cost, and malformed image rejection remains CC-19 work. Oversized model input may fail upstream and still retains a reservation; no automatic retry or refund is implemented. The 8192 output cap may truncate dense scenes: existing honest 502 handling applies, never a demo substitution.

Review pricing/model semantics and these deliberately pessimistic capacity tradeoffs before deployment or beta expansion. No live provider quality, token usage or billing enforcement was tested.

## Anonymous analysis protection and retention

`BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD=3000000` limits anonymous analysis reservations inside the global 5000000 ceiling; with the default 500000 reservation this permits six daily trial attempts (two complete new-browser trials) and protects four more attempts from anonymous callers. Approved callers/owner can still consume global capacity; no guarantee of availability is made. Three free attempts per browser remain registration-free, subject to these shared safety limits.

`BETA_ANONYMOUS_NETWORK_DAILY_LIMIT=6` caps accepted anonymous attempts per exact connection address per UTC day across rotated tokens. Only Cloudflare's trusted `CF-Connecting-IP` is used, never client forwarding headers. Missing header or malformed anonymous limits fail closed. Keep the deployment behind Cloudflare's edge; review same-zone Worker subrequests, transforms and Pseudo IPv4 settings before rollout. This is not a /64 IPv6 or person-level limit: multiple addresses can exhaust only the trial pool. Shared NAT users share the network allowance.

The Worker sends only `SHA-256("analysis:" + UTC-day + ":" + address)` to the limiter, not raw addresses, and does not log the digest. Hashing is pseudonymization, not anonymization: address space can be enumerable. The Durable Object stores day-scoped digest/count records and a daily trial reservation total. They stop affecting quotas at UTC rollover but **are not automatically deleted**; retain only for the beta and arrange narrowly scoped operator deletion of expired `YYYY-MM-DD:analysis-network:*` and trial counters. No deletion job was deployed. Do not delete lifetime browser counters as part of network cleanup, which would reset free allowances. Cloudflare connection/log retention is separately operator-controlled; local project deletion does not erase these server-side records.

The provider project needs independent account-level spending/quota controls and monitoring. Alerts alone are not a hard stop. CC-01 local code now enforces the candidate cap, derived reservation floor and exact model allow-list; account controls remain operator gates. Isolate the key/project, check the actual billing plan and supported provider quotas/spending controls, disable automatic prepaid replenishment if applicable, and monitor usage/alerts. Budget notifications are not a hard spending stop. Neither this limiter nor an app budget covers other key users, pricing changes, taxes, or Cloudflare/logging charges.

## Configure without exposing secrets

Create a separate random code for each person/device so one invite can be revoked without rotating all users. Generate codes with a cryptographically secure password manager or random generator. Build a JSON array containing each code's SHA-256 hex digest:

```bash
printf %s "$INVITE_CODE" | openssl dgst -sha256
```

Then configure Cloudflare secrets interactively from `worker/`; never put their values in Git, chat, Flutter assets, or `wrangler.toml`:

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put BETA_INVITE_CODE_HASHES
npx wrangler secret put BETA_OWNER_INVITE_CODE_HASHES
npx wrangler secret put ALERT_WEBHOOK_URL
npx wrangler secret put ADMIN_API_KEY
```

`BETA_INVITE_CODE_HASHES` must be JSON such as `["<64-character-sha256>"]`. `BETA_OWNER_INVITE_CODE_HASHES` uses the same JSON format but should contain only hashes of owner-controlled invite codes; never put a plaintext invite there. `ALERT_WEBHOOK_URL` must be an HTTPS Discord webhook. `ADMIN_API_KEY` must be a separate high-entropy value of at least 32 characters and must be present both in Cloudflare and the ignored local `worker/.dev.vars`; it authorizes only the private invite-generation command. Never reuse an invite, Gemini key, or webhook URL as this key.

Validate configuration and tests before deployment:

```bash
npm test
npx wrangler deploy --dry-run
```

Deploy after the checks pass:

```bash
npx wrangler deploy
```

## Review and approve a request from Discord

A valid public request posts a private Discord alert containing the request ID, tester email, optional name/device, and an expiring one-time owner approval URL.

1. Review the submitted contact information in the private alert.
2. Tap **Approve from your phone**. The first page is confirmation only, which prevents link previews and security scanners from approving automatically.
3. Tap **Activate access** on the confirmation page.
4. The Worker registers the requesting browser's SHA-256 device-token hash, removes the one-time owner approval hash, and marks the private in-app status approved. No access code appears in Discord, email, Worker logs, or the public app bundle.
5. The tester reopens the request screen or taps **Check approval status**. Continued access already works in that same browser.

Approval links expire after seven days and cannot be replayed. If the tester clears site storage or switches browsers before approval, the stored device identity and private status receipt will be lost; ask them to submit a new request from the browser they intend to use.

The private `npm run invite -- 'tester@example.com'` owner command remains available only for exceptional cross-device/manual support. It is not part of the normal in-app approval flow.

## Build the public beta client

The public client needs only the Worker URL. New users receive three analyses immediately through their random local token. A manually approved request activates continued limited testing in that same browser without a code:

```bash
flutter build web --release \
  --base-href /cluttercash/ \
  --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev
```

The browser keeps its random device token and private request-status token in local storage. The Worker receives them over HTTPS and stores only hashes. Never place browser tokens, approval URLs, Gemini, Cloudflare, admin, webhook, or other privileged values in Git, Flutter assets, public Discord channels, or screenshots.

## Alert and incident checks

Before inviting users, submit one controlled beta request and confirm Discord receives a human-readable **ClutterCash beta access request** message containing only the expected request ID/contact fields. Also force one sanitized provider failure or ceiling event in a staging/preview configuration and confirm Discord receives a short `ClutterCash Worker alert` message without photos, invite values, prompts, provider bodies, or credentials.

If a code leaks or usage spikes:

1. Remove its hash from `BETA_INVITE_CODE_HASHES` and `BETA_OWNER_INVITE_CODE_HASHES` wherever present and apply the secret/configuration change. Static access deliberately takes precedence; the revocation endpoint returns 409 without mutation while either list still contains this hash. Keep another valid static hash configured so beta access remains configured. Do not re-add a revoked hash: static configuration would explicitly authorize it again.
2. Revoke the durable registered hash using the admin-authenticated operation below. Static removal alone does not revoke registered invites or approved browser devices.
2. Lower the weekly request or daily budget values if needed.
3. Rotate `GEMINI_API_KEY` if provider access itself may be exposed.
4. Review Cloudflare/Gemini usage without downloading or logging household-photo payloads.
5. Record the incident and notify affected testers through the beta support channel.

### Revoke one registered credential (operator-only)

After authorized deployment of this code, use `POST /v1/admin/invites/revoke`, with the existing separate `ADMIN_API_KEY` as a Bearer header and exactly `{"inviteHash":"<64 lowercase hex SHA-256>"}`. Use the hash of the exact invite/device token, not the token itself or a request ID. For approved browser access, obtain the device hash from its private durable registration/pending-status record; do not collect or log the browser's raw bearer token. Example Git Bash command, with API_URL, ADMIN_API_KEY and INVITE_HASH supplied privately in the operator environment (no secret literals in history):

```bash
curl --fail-with-body --silent --show-error "$API_URL/v1/admin/invites/revoke" \
  -H "Authorization: Bearer $ADMIN_API_KEY" -H 'Content-Type: application/json' \
  --data "{\"inviteHash\":\"$INVITE_HASH\"}"
```

Expected 200: `{"revoked":true}`; repeat is idempotent. 401 means missing/wrong admin authorization, 400 invalid hash/payload, 409 static/owner removal required, 503 no durable mutation confirmed. Read back that exact registered hash through the private Durable Object `/invites/check` binding operation: `allowed:false, revoked:true`; then, only with authorized staging credentials, verify protected requests return 401. No public registry-read/list endpoint is exposed. Never delete the whole Durable Object to revoke one user.

Revocation atomically removes `allowed-invite:<hash>` and retains `revoked-invite:<hash>` indefinitely. The tombstone blocks anonymous fallback for that same browser token and prevents old approval/re-registration from restoring it. Existing allowance/cost counters and other users remain intact; an already-authorized in-flight request is not cancelled. Issue a new credential for intentional restoration. This is token revocation, not a person ban: a new browser token can still claim the existing capacity-limited anonymous trial. Historical approval-status receipts can still say approved until expiry; they are not current authorization proof. These commands were not run against live users during remediation.

## Minimal beta telemetry

`POST /v1/telemetry` accepts the same approved invite/browser access or syntactically valid anonymous browser token as analysis; revoked registered tokens are denied. It does not reserve Gemini quota or call the provider. An independent atomic fixed-UTC-minute limiter admits at most **120 anonymous events and 600 total events** across the entire beta. Rotating tokens/addresses cannot bypass these shared event pools. Anonymous exhaustion leaves the remaining total pool available to approved users. Excess events return 429 without emitting an application telemetry record; unavailable limiter returns 503. Fixed-window boundaries can admit adjacent-minute bursts, and shared-pool abuse can still suppress anonymous metrics. This bounds accepted application event logs, not platform HTTP/access logs, request traffic or all Cloudflare charges. It accepts only these event names:

- `scan_started`, `scan_succeeded`, `scan_failed`
- `project_created`, `project_reopened`
- `item_corrected`, `item_status_updated`
- `app_crash`

Only `scan_failed` and `app_crash` accept a `failureCode`, and only from the checked-in coarse allow-list. Any extra JSON key is rejected so photos, names, values, IDs, raw errors, and stack traces cannot be added accidentally. Accepted payloads are written as `cluttercash-beta` Worker log records. Telemetry delivery is best-effort and never blocks the app journey or consumes provider budget.

Telemetry quota storage is one `telemetry:minute` record containing only minute number and aggregate total/anonymous counts: no IP, device/invite hash, email or per-user key. The next admitted event in a new minute overwrites it; the last aggregate remains while idle. No per-minute records accumulate and no telemetry cleanup alarm is needed. Event-log retention remains separately operator-configured.

After an authorized deployment, use Cloudflare's Worker log/tail tooling for a controlled staging pass and confirm each required event appears without request bodies, invite values/hashes, user content, or raw exceptions. Restrict log access and retention; do not export logs into a user profile. Local tests prove payload validation and event wiring, but an operator must still confirm deployed log visibility before inviting users.
