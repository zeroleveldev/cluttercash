# ClutterCash

> **Point at the mess. Find the money. Clear the room.**

ClutterCash is a phone-first Flutter consumer app that turns a shelf, closet, or garage photo into a ranked decluttering plan. It emphasizes potential selling value and completion—not reseller inventory or bookkeeping complexity.

## What works now

- Polished one-action onboarding and camera/gallery capture
- Honest interactive demo with multi-item value ranges and a big-ticket highlight
- Live staged-photo analysis through a Cloudflare Worker backed by Gemini
- Explicit free-tier privacy warning and consent before uploads
- Strict scan response validation; malformed results fail instead of inventing values
- Official active and completed/sold eBay search links plus Facebook Marketplace and Mercari searches
- Marketplace recommendations based on item type, likely value, shipping burden, and selling effort
- Privacy-consented follow-up model-label photos that refine maker/model identity, with crop guidance and best-effort serial filtering (not guaranteed exclusion)
- An item-name and potential-range correction flow that updates marketplace research queries
- Sell/bundle/donate/recycle/keep recommendations
- Ranked action queue and item details
- Persistent local clearing projects
- Listed/sold/donated status and cleared-space progress
- Free beta with three no-registration analyses per browser/device, followed by optional in-app access requests, private phone approval from Discord, and automatic continued access in the requesting browser; no subscription, scan pack, payment, or in-app purchase is offered yet
- Android and installable web targets

## Free-beta privacy and terms

Read the current [Free Beta — Privacy Notice & Terms](docs/BETA_PRIVACY_AND_TERMS.md) before using live photo analysis. It explains the Google Gemini AI processor, local project storage, photo and deletion limits, beta disclaimers, and how to contact support at [cluttercash.help@gmail.com](mailto:cluttercash.help@gmail.com).

## Run the demo

```bash
flutter pub get
flutter run -d chrome
```

Tap **Scan my space → Try the demo room**. The demo is intentionally available without an account or provider key.

## Enable protected real-photo analysis

The API keeps the Gemini credential off the client. The local implementation accepts JPEG/PNG/WebP signatures, caps each image at 8 MiB and the streamed multipart envelope at 8 MiB + 64 KiB before parsing, processes images in memory without a Worker disk archive, and returns `Cache-Control: no-store`. The app creates one random local token for three no-registration analyses per browser/device, subject to capacity. The Worker stores hashed access identities and counters; anonymous requests also use a day-scoped connection-address hash/count, a separate daily trial pool and the global reservation pool. These controls limit accepted attempts, not every provider-account charge. Old day counters remain until operator cleanup. Approved device/invite hashes provide separate rolling allowances. A prospective tester can submit an email after using the free allowance; the Worker rate-limits the request and sends it to the operator's private Discord webhook. Two-tap approval enables continued access in the requesting browser. Deployment parity and operational controls remain release gates below.

Follow [`docs/WORKER_BETA_OPERATIONS.md`](docs/WORKER_BETA_OPERATIONS.md) to configure Worker secrets, review and approve requests from Discord, maintain the exceptional manual-code fallback, review limits, verify alerts, and handle incidents.

The public build contains the Worker URL but no invite code:

```bash
flutter run -d chrome \
  --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev
```

Normal in-app approvals require no code: the Worker promotes the requesting device-token hash, and the app privately checks approval with a separate locally stored status token. Existing manual invite codes remain supported for exceptional cross-device help. Do not place `GEMINI_API_KEY`, `ADMIN_API_KEY`, Cloudflare credentials, webhook credentials, browser/request tokens, approval URLs, or plaintext invite codes in Git or Flutter assets. Gemini's free tier is restricted here to staged, non-sensitive photos because free-tier submissions may be reviewed or used to improve Google's products.

Marketplace research in the free version opens official user-facing search pages; it does not scrape or ingest marketplace data. Active listings are labeled as asking prices, while eBay completed/sold results are presented as stronger—but still manually verified—evidence. The AI estimate is never presented as a researched comparable sale.

For exact-item refinement, users should photograph the manufacturer/model label rather than a unique serial number. Crop or cover serials before upload, keeping maker/model details visible. The endpoint omits dedicated serial fields and filters exact serial text only when explicitly identified in an unwanted provider field; unmarked or altered serials may remain. Identity-derived marketplace queries reduce extra label text, but exclusion from results, local saves, or user-opened marketplace searches is not guaranteed. Review and correct results before saving or researching. The same free-tier image privacy warning applies to label photos. Users can also correct an item name and potential range directly; those corrections remain in local project data.

## Legacy Express: local development only

`server/` is retained solely for local development; the deployed app continues to use the Gemini Worker. Its entry point binds `127.0.0.1` by default (`HOST=::1` is also supported), rejects other HOST values, and exits with code 1 when `NODE_ENV=production`. Only loopback Host and local HTTP(S) browser origins are accepted; `ALLOWED_ORIGIN` no longer overrides this restriction.

**Do not publish this service through a tunnel, reverse proxy, port forward, container ingress, or a custom entry point.** Loopback binding is the security boundary, not CORS. It has no equivalent consent/access/quota/budget controls, and local calls with an OpenAI key can incur costs. Production must use the protected Worker; this does not certify the Worker's remaining cost/abuse launch gates. No provider has been changed.

## Quality commands

```bash
flutter test
flutter analyze
flutter build web --release
flutter build apk --release
npm test --prefix server
npm test --prefix worker
```

## Architecture

- `lib/domain/` — immutable item, scan, and cleanout-project behavior
- `lib/services/scan_api.dart` — multipart API client and strict parser
- `lib/services/beta_access_api.dart` — public beta-request and private approval-status client with honest errors
- `lib/services/beta_access_state.dart` — local private request-receipt persistence
- `lib/services/project_store.dart` — namespaced SharedPreferences persistence
- `lib/main.dart` — responsive mobile UI and complete demo flow
- `server/src/app.js` — legacy **local-development-only**, unmetered Express analyzer seam; not a release backend
- `server/src/openai-analyzer.js` — server-only image analysis and JSON schema
- `worker/src/worker.js` — Gemini proxy, consent gate, phone approval, approved device/invite access, durable quota/budget protection, validation, and sanitized alerts
- `test/`, `server/test/`, and `worker/test/` — domain, storage, API, and critical UI-flow tests

## Product thesis (not market validation)

The defensible wedge is **whole-space decluttering triage**:

1. Scan an overwhelming area.
2. Rank by potential selling value and effort.
3. Pull out big-ticket items for manual verification.
4. Route the rest to sell, bundle, donate, recycle, or keep.
5. Mark items as cleared after they leave the space.

Competitive research on September 7, 2026 found active scanner/listing competitors including Klysto, Value Scout, SellRaze, ThriftAI, Hero, and Reclaim. Multi-item detection alone is not unique. ClutterCash must win on making a room easier to clear.

Paid pricing and billing are intentionally deferred until after the free beta validates demand and the required billing controls are implemented.

## Current release status and gates

**Not launch ready or certified deployed.** [Launch fix progress](docs/LAUNCH_FIX_PROGRESS.md) is the current local remediation record; [FINAL_AUDIT.md](FINAL_AUDIT.md) preserves historical findings with a current-status overlay. Its baseline test counts and artifact hashes are not evidence for the modified source.

Already implemented locally: marketplace asking-price/sold-search distinctions, model-label photos, explicit upload consent, published/reachable privacy and support, saved-item research/correction, labelled new demo saves, numeric/identity validation, empty-results guidance, complete-response deadlines, protected Worker access/quotas, anonymous-capacity isolation, revocation and bounded coarse telemetry. Three no-registration analyses remain, subject to shared/network/global capacity. Historical demo records cannot reliably be classified retroactively.

Android startup checks lost picker data once. Because original room versus label context and consent cannot be trusted after process death, recovery never uploads/replays the old photo: it asks for a fresh scan or reopening the saved item's label flow, with renewed consent. Actual Android process-death testing remains required.

Before inviting users to this modified build:

- Operator approval of the proposed $5 daily / $3 anonymous reservation pools and $0.50 per-attempt reservation; these are unapproved local settings, not an activated budget or account billing cap.
- Verify actual provider plan/pricing, supported account controls, key isolation, replenishment and monitoring; alerts alone are not a hard spending stop.
- Authorize deployment, verify the exact deployed build/configuration and trusted-edge Durable Object enforcement, and authorize any controlled live-provider/alert tests separately.
- Complete target browser/device scan → failure/retry → correction → research → save/reopen/delete smoke, plus Android camera/gallery/process-death checks. Local tests and builds do not establish this.
- Android release currently uses debug signing: temporary internal test artifact only. Before wider Android distribution, owner must provide the intended protected release/upload keystore and alias through secure local configuration, with secrets kept out of Git/chat, then wire and verify release signing. No keystore or identity has been invented.
- Review operational retention/cleanup and platform-specific Data Safety/App Privacy disclosures. Repository policy and in-app terms already exist; they do not constitute store approval or legal review.

Later public/paid launch work: validate real-household usability and model accuracy by category; check name/domain/trademark availability; prepare store materials. Billing remains deferred until demand and platform controls are validated. Account/export/cloud deletion flows apply only if cloud sync is introduced. Broader telemetry requires explicit privacy review. Never claim appraisal or authenticity.

Direct marketplace posting is intentionally deferred. Competitor reviews repeatedly cite broken OAuth/posting flows, and marketplace APIs create disproportionate support and policy risk for a solo founder.
