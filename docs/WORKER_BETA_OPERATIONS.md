# Free-beta Worker operations

ClutterCash live analysis is fail-closed. Each browser/device receives three no-registration analyses through a random local token; approved device hashes and legacy invite codes provide a separate rolling allowance. All analysis paths require an available Durable Object quota reservation and configured OpenAI key. The public health, beta-request, owner-approval, and private status routes do not consume analysis quota.

## Controls

- A cryptographically random token is created in local app/browser storage. The Worker hashes it and `BetaUsageLimiter` stores only the hash plus accepted-use count, allowing three no-registration analyses total for that local token.
- Clearing local storage can create another token, so this is a low-friction trial control rather than strong identity. A separate small shared anonymous pool protects invited capacity. The global daily reservation ceiling bounds admitted Standard-model token-cost reservations, not the provider-account bill.
- Original owner/device invite codes are compared after SHA-256 hashing against the static secret. Approved in-app requests register the requesting device-token hash; no plaintext code is generated or delivered. Legacy tester codes remain supported, and only their hashes and creation times are stored.
- Hashes listed separately in `BETA_OWNER_INVITE_CODE_HASHES` bypass the three-analysis rolling allowance for owner testing. They still reserve against the global daily reservation ceiling, so “unlimited” does not mean unbounded provider spending.
- The public request form sends the submitted email and optional name/device to the private Discord webhook. One-way email/network hashes enforce one request per email and five per network address in a rolling 24-hour window. Plaintext contact fields are not stored in the Durable Object. Hashed device/status/approval tokens are retained for at most seven days while pending; approval removes the owner approval-token hash and retains a private hashed status record for at most 30 days.
- `BetaUsageLimiter` uses one Durable Object and atomic storage transactions for approved-device/invite registration, request throttling, a three-analysis rolling seven-day approved-access limit, and a separate global daily reserved-cost ceiling.
- The invite limit expires each analysis seven days after it was used; the global budget resets on the UTC date boundary.
- Every accepted request reserves `OPENAI_MAX_REQUEST_COST_MICRO_USD` before OpenAI is called. Failed calls retain reservations. The configured reservation must be at least the conservative derived floor below; unsupported models and unsafe/missing reservation values fail closed. This is not a provider-account billing limit.
- The first rejected reservation at the daily ceiling emits `daily_budget_reached`. Provider failures alert with only a route name and HTTP status. A separate sanitized metric records provider/model, request ID, latency, success, safe failure category, token counts and estimated cost for each attempted provider call. Neither record includes photos, invite values/hashes, prompts, provider output, authorization headers, item names, or API keys.
- Missing/invalid access, bindings, limits, or secrets fail closed before OpenAI.

The checked-in local settings preserve the prior **500,000 micro-USD ($0.50)** daily reservation ceiling and use a **131,072 micro-USD ($0.131072)** per-request reservation. At that deliberately pessimistic reservation, the current daily ceiling admits at most 3 attempted OpenAI calls (`3 * 131072 = 393,216`; attempt 4 would exceed the ceiling). These settings are not deployed or provider-account billing controls. Choose and explicitly approve any higher daily cap plus monthly/account controls before rollout. No monthly limiter is implemented here.

### Conservative token-cost derivation (CC-01)

Exact model is `gpt-5-nano`. Official sources rechecked for this switch:
- [Model limits and modalities](https://platform.openai.com/docs/models/gpt-5-nano): 400,000-token context, 128,000 maximum output tokens, image input, reasoning tokens and Structured Outputs are supported.
- [Standard pricing](https://platform.openai.com/docs/pricing): $0.05/M input, $0.005/M cached input and $0.40/M output.
- [Responses and reasoning](https://platform.openai.com/docs/guides/reasoning): both routes use one Responses API request with `store: false`, `reasoning: { effort: "low" }`, no tools, strict JSON Schema, and `max_output_tokens: 4096`. There is no automatic retry.

The minimum accepted reservation deliberately does not estimate image tiles or bytes-to-tokens. It covers the model's entire published 400,000-token input window plus its entire 128,000-token output window: `ceil(400000 * 0.05 + 128000 * 0.40) = 71200` micro-USD. The checked-in reservation remains higher at 131,072 micro-USD to preserve the existing three-attempt capacity. A lower-than-71,200, missing, noninteger value or different/missing model fails closed before parsing, reservation or provider work. Rates are code-reviewed constants, not operator-overridable underestimates.

Multipart bodies are stream-counted before parsing, capped at 8 MiB + 64 KiB including all overhead (Content-Length alone is not trusted). One image remains capped at 8 MiB; existing magic-signature, closed-field and 100/40-character identity-context checks bound accepted input shape. Fixed prompts/schema add no unbounded user fields. The scan schema and validator return at most 10 objects. Oversized model input may fail upstream and still retains a reservation; no automatic retry or refund is implemented. The 4,096 output cap includes reasoning tokens and may produce an incomplete response; that fails with the existing honest 502 response, never a demo substitution.

Review pricing/model semantics and these deliberately pessimistic capacity tradeoffs before deployment or beta expansion. No live provider quality, token usage or billing enforcement was tested.

## Anonymous analysis protection and retention

`BETA_ANONYMOUS_DAILY_BUDGET_MICRO_USD=393216` limits anonymous analysis reservations inside the global 500000 ceiling; with the 131072 reservation this admits at most 3 anonymous attempts across networks per UTC day. The separate six-attempt network limit and three-use browser limit still apply, but the smaller cost pool wins first. Approved callers/owner share the same global ceiling; no guarantee of availability is made.

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
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put BETA_INVITE_CODE_HASHES
npx wrangler secret put BETA_OWNER_INVITE_CODE_HASHES
npx wrangler secret put ALERT_WEBHOOK_URL
npx wrangler secret put ADMIN_API_KEY
```

`BETA_INVITE_CODE_HASHES` must be JSON such as `["<64-character-sha256>"]`. `BETA_OWNER_INVITE_CODE_HASHES` uses the same JSON format but should contain only hashes of owner-controlled invite codes; never put a plaintext invite there. `ALERT_WEBHOOK_URL` must be an HTTPS Discord webhook. `ADMIN_API_KEY` must be a separate high-entropy value of at least 32 characters and must be present both in Cloudflare and the ignored local `worker/.dev.vars`; it authorizes only the private invite-generation command. Never reuse an invite, OpenAI key, or webhook URL as this key.

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
bash tool/build_web_release.sh
```

This command builds for the `https://cluttercash.app/` root, enables TEST billing UI, targets the public Worker URL, preserves the GitHub Pages `CNAME`, and checks the marketplace-link plugin artifact. It does not deploy anything.

The browser keeps its random device token and private request-status token in local storage. The Worker receives them over HTTPS and stores only hashes. Never place browser tokens, approval URLs, OpenAI, Cloudflare, admin, webhook, or other privileged values in Git, Flutter assets, public Discord channels, or screenshots.

## Alert and incident checks

Before inviting users, submit one controlled beta request and confirm Discord receives a human-readable **ClutterCash beta access request** message containing only the expected request ID/contact fields. Also force one sanitized provider failure or ceiling event in a staging/preview configuration and confirm Discord receives a short `ClutterCash Worker alert` message without photos, invite values, prompts, provider bodies, or credentials.

If a code leaks or usage spikes:

1. Remove its hash from `BETA_INVITE_CODE_HASHES` and `BETA_OWNER_INVITE_CODE_HASHES` wherever present and apply the secret/configuration change. Static access deliberately takes precedence; the revocation endpoint returns 409 without mutation while either list still contains this hash. Keep another valid static hash configured so beta access remains configured. Do not re-add a revoked hash: static configuration would explicitly authorize it again.
2. Revoke the durable registered hash using the admin-authenticated operation below. Static removal alone does not revoke registered invites or approved browser devices.
2. Lower the weekly request or daily budget values if needed.
3. Rotate `OPENAI_API_KEY` if provider access itself may be exposed.
4. Review Cloudflare/OpenAI usage without downloading or logging household-photo payloads.
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

`POST /v1/telemetry` accepts the same approved invite/browser access or syntactically valid anonymous browser token as analysis; revoked registered tokens are denied. It does not reserve provider quota or call OpenAI. An independent atomic fixed-UTC-minute limiter admits at most **120 anonymous events and 600 total events** across the entire beta. Rotating tokens/addresses cannot bypass these shared event pools. Anonymous exhaustion leaves the remaining total pool available to approved users. Excess events return 429 without emitting an application telemetry record; unavailable limiter returns 503. Fixed-window boundaries can admit adjacent-minute bursts, and shared-pool abuse can still suppress anonymous metrics. This bounds accepted application event logs, not platform HTTP/access logs, request traffic or all Cloudflare charges. It accepts only these event names:

- `scan_started`, `scan_succeeded`, `scan_failed`
- `project_created`, `project_reopened`
- `item_corrected`, `item_status_updated`
- `app_crash`

Only `scan_failed` and `app_crash` accept a `failureCode`, and only from the checked-in coarse allow-list. Any extra JSON key is rejected so photos, names, values, IDs, raw errors, and stack traces cannot be added accidentally. Accepted payloads are written as `cluttercash-beta` Worker log records. Telemetry delivery is best-effort and never blocks the app journey or consumes provider budget.

Telemetry quota storage is one `telemetry:minute` record containing only minute number and aggregate total/anonymous counts: no IP, device/invite hash, email or per-user key. The next admitted event in a new minute overwrites it; the last aggregate remains while idle. No per-minute records accumulate and no telemetry cleanup alarm is needed. Event-log retention remains separately operator-configured.

After an authorized deployment, use Cloudflare's Worker log/tail tooling for a controlled staging pass and confirm each required event appears without request bodies, invite values/hashes, user content, or raw exceptions. Restrict log access and retention; do not export logs into a user profile. Local tests prove payload validation and event wiring, but an operator must still confirm deployed log visibility before inviting users.
