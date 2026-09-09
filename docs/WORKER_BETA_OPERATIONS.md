# Invited-beta Worker operations

ClutterCash live analysis is fail-closed. Scan and label routes require a valid invite bearer code, an available Durable Object quota reservation, and a configured Gemini key. The public health route does not consume quota.

## Controls

- Invite codes are compared only after SHA-256 hashing. The Worker stores an allow-list of hashes, not plaintext codes.
- `BetaUsageLimiter` uses one Durable Object and an atomic storage transaction for a three-analysis, per-invite rolling seven-day limit and a separate global daily reserved-cost ceiling.
- The invite limit expires each analysis seven days after it was used; the global budget resets on the UTC date boundary.
- Every accepted request reserves `GEMINI_MAX_REQUEST_COST_MICRO_USD` before Gemini is called. This intentionally over-counts failed calls so the configured ceiling fails safe; it is not billing reconciliation.
- The first rejected reservation at the daily ceiling emits `daily_budget_reached`. Gemini failures emit only a route name and HTTP status. Alerts never include photos, invite codes/hashes, prompts, provider response bodies, or API keys.
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
```

`BETA_INVITE_CODE_HASHES` must be JSON such as `["<64-character-sha256>"]`. `ALERT_WEBHOOK_URL` must be HTTPS and accept JSON POSTs. Omitting it leaves analysis protected but disables external alert delivery, so it is required before inviting users.

Validate configuration and tests before an authorized deployment:

```bash
npm test
npx wrangler deploy --dry-run
```

Deployment remains a deliberate manual action; this repository task does not deploy.

## Build an invited client

Both values are required for live analysis. The client sends the invite in `X-ClutterCash-Invite` on scan and label requests:

```bash
flutter build web --release \
  --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev \
  --dart-define=CLUTTERCASH_BETA_INVITE="$INVITE_CODE"
```

A client-side bearer code can be recovered from an installed/web client or observed on that device; it is not an account credential. Keep each code scoped to one invite/device, enforce its three-analysis rolling seven-day quota, distribute builds/links only to intended testers, and revoke or rotate the hash if shared. Never reuse Gemini, Cloudflare, or other privileged secrets as an invite code.

## Alert and incident checks

Before inviting users, send one controlled request against a staging/preview configuration that reaches the ceiling and one request that forces a sanitized provider failure. Confirm the destination receives only:

```json
{"source":"cluttercash-worker","event":"daily_budget_reached"}
```

or a provider failure event with an integer `status`. Do not claim alerting is operational until this end-to-end check succeeds.

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
