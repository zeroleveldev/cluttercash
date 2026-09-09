# Invited-beta Worker operations

ClutterCash live analysis is fail-closed. Each browser/device receives three no-registration analyses through a random local token; approved invite codes provide a separate rolling allowance. Both paths require an available Durable Object quota reservation and configured Gemini key. The public health and beta-request routes do not consume analysis quota.

## Controls

- A cryptographically random token is created in local app/browser storage. The Worker hashes it and `BetaUsageLimiter` stores only the hash plus accepted-use count, allowing three no-registration analyses total for that local token.
- Clearing local storage can create another token, so this is a low-friction trial control rather than strong identity. The global daily cost ceiling remains the hard owner-protection backstop.
- Original owner/device invite codes are compared after SHA-256 hashing against the static secret. Newly approved tester codes are registered dynamically in `BetaUsageLimiter`; only their hashes and creation times are stored.
- The public request form sends the submitted email and optional name/device to the private Discord webhook. One-way email/network hashes enforce one request per email and five per network address in a rolling 24-hour window; plaintext contact fields are not stored in the Durable Object.
- `BetaUsageLimiter` uses one Durable Object and atomic storage transactions for invite registration, request throttling, a three-analysis per-invite rolling seven-day limit, and a separate global daily reserved-cost ceiling.
- The invite limit expires each analysis seven days after it was used; the global budget resets on the UTC date boundary.
- Every accepted request reserves `GEMINI_MAX_REQUEST_COST_MICRO_USD` before Gemini is called. This intentionally over-counts failed calls so the configured ceiling fails safe; it is not billing reconciliation.
- The first rejected reservation at the daily ceiling emits `daily_budget_reached`. Gemini failures emit only a route name and HTTP status. Provider/budget alerts never include photos, invite codes/hashes, prompts, provider response bodies, or API keys; access-request alerts include only the contact fields the requester explicitly submitted.
- Missing/invalid access, bindings, limits, or secrets fail closed before Gemini.

The checked-in defaults are 3 live analyses per invite in a rolling seven-day window, a 500,000 micro-USD ($0.50) daily reserved-cost ceiling, and a 10,000 micro-USD ($0.01) maximum reservation per request. Review these values against the currently selected model's documented pricing before each beta expansion. They are operational limits, not a claim about actual request cost.

## Configure without exposing secrets

Create a separate random code for each person/device so one invite can be revoked without rotating all users. Generate codes with a cryptographically secure password manager or random generator. Build a JSON array containing each code's SHA-256 hex digest:

```bash
printf %s "$INVITE_CODE" | openssl dgst -sha256
```

Then configure Cloudflare secrets interactively from `worker/`; never put their values in Git, chat, Flutter assets, or `wrangler.toml`:

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put BETA_INVITE_CODE_HASHES
npx wrangler secret put ALERT_WEBHOOK_URL
npx wrangler secret put ADMIN_API_KEY
```

`BETA_INVITE_CODE_HASHES` must be JSON such as `["<64-character-sha256>"]`. `ALERT_WEBHOOK_URL` must be an HTTPS Discord webhook. `ADMIN_API_KEY` must be a separate high-entropy value of at least 32 characters and must be present both in Cloudflare and the ignored local `worker/.dev.vars`; it authorizes only the private invite-generation command. Never reuse an invite, Gemini key, or webhook URL as this key.

Validate configuration and tests before deployment:

```bash
npm test
npx wrangler deploy --dry-run
```

Deploy after the checks pass:

```bash
npx wrangler deploy
```

## Review and approve a request

A valid public request posts a private Discord alert containing the request ID, tester email, and optional name/device. Review it manually. To approve, run from `worker/`:

```bash
npm run invite -- 'tester@example.com'
```

The command reads `ADMIN_API_KEY` from the ignored local `.dev.vars`, asks the live Worker to create and register one high-entropy invite, and prints the plaintext code once. Send that code to the approved tester privately. Do not paste it into Discord channels, commit it, or add it to the public web build. The tester enters it through **Enter beta invite code** in the app.

## Build the public beta client

The public client needs only the Worker URL. New users receive three analyses immediately through their random local token. An approved tester can later enter a private code on the same device for continued limited testing:

```bash
flutter build web --release \
  --base-href /cluttercash/ \
  --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev
```

A client-side bearer code is observable on that tester's device and is not an account credential. Keep each code scoped to one tester/device, enforce its three-analysis rolling seven-day quota, and send it only to the intended tester. Never reuse Gemini, Cloudflare, admin, or other privileged secrets as an invite code.

## Alert and incident checks

Before inviting users, submit one controlled beta request and confirm Discord receives a human-readable **ClutterCash beta access request** message containing only the expected request ID/contact fields. Also force one sanitized provider failure or ceiling event in a staging/preview configuration and confirm Discord receives a short `ClutterCash Worker alert` message without photos, invite values, prompts, provider bodies, or credentials.

If a code leaks or usage spikes:

1. Remove its hash from `BETA_INVITE_CODE_HASHES` and redeploy the secret/configuration.
2. Lower the weekly request or daily budget values if needed.
3. Rotate `GEMINI_API_KEY` if provider access itself may be exposed.
4. Review Cloudflare/Gemini usage without downloading or logging household-photo payloads.
5. Record the incident and notify affected testers through the beta support channel.

## Minimal beta telemetry

`POST /v1/telemetry` requires the same valid invite header but does not reserve Gemini quota or call the provider. It accepts only these event names:

- `scan_started`, `scan_succeeded`, `scan_failed`
- `project_created`, `project_reopened`
- `item_corrected`, `item_status_updated`
- `app_crash`

Only `scan_failed` and `app_crash` accept a `failureCode`, and only from the checked-in coarse allow-list. Any extra JSON key is rejected so photos, names, values, IDs, raw errors, and stack traces cannot be added accidentally. Accepted payloads are written as `cluttercash-beta` Worker log records. Telemetry delivery is best-effort and never blocks the app journey or consumes provider budget.

After an authorized deployment, use Cloudflare's Worker log/tail tooling for a controlled staging pass and confirm each required event appears without request bodies, invite values/hashes, user content, or raw exceptions. Restrict log access and retention; do not export logs into a user profile. Local tests prove payload validation and event wiring, but an operator must still confirm deployed log visibility before inviting users.
