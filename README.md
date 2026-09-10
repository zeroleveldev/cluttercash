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
- Privacy-consented follow-up model-label photos that refine the exact maker/model without returning or persisting serial numbers
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

The API keeps the Gemini credential off the client. Photos stay in memory, have an 8 MB cap, are not written to disk by the Worker, and responses use `Cache-Control: no-store`. The app creates one random local token so each browser/device can run three live analyses without an account or invite code. The Worker stores only its hash and accepted-use count in the Durable Object. Approved device/invite hashes provide a separate rolling allowance, and a global daily reserved-cost ceiling limits abuse if local storage is reset. A prospective tester can submit their email in the app after using the free allowance; the Worker rate-limits the request and sends it to the operator's private Discord webhook. The operator reviews and approves from a two-tap phone page, after which continued access activates automatically in the requesting browser.

Follow [`docs/WORKER_BETA_OPERATIONS.md`](docs/WORKER_BETA_OPERATIONS.md) to configure Worker secrets, review and approve requests from Discord, maintain the exceptional manual-code fallback, review limits, verify alerts, and handle incidents.

The public build contains the Worker URL but no invite code:

```bash
flutter run -d chrome \
  --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev
```

Normal in-app approvals require no code: the Worker promotes the requesting device-token hash, and the app privately checks approval with a separate locally stored status token. Existing manual invite codes remain supported for exceptional cross-device help. Do not place `GEMINI_API_KEY`, `ADMIN_API_KEY`, Cloudflare credentials, webhook credentials, browser/request tokens, approval URLs, or plaintext invite codes in Git or Flutter assets. Gemini's free tier is restricted here to staged, non-sensitive photos because free-tier submissions may be reviewed or used to improve Google's products.

Marketplace research in the free version opens official user-facing search pages; it does not scrape or ingest marketplace data. Active listings are labeled as asking prices, while eBay completed/sold results are presented as stronger—but still manually verified—evidence. The AI estimate is never presented as a researched comparable sale.

For exact-item refinement, users should photograph the manufacturer/model label rather than a unique serial number. The follow-up endpoint returns only whether a serial was detected; it does not return or persist the serial itself. The same free-tier image privacy warning applies to label photos. Users can also correct an item name and potential range directly; those corrections remain in local project data.

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
- `server/src/app.js` — bounded Express API with injected analyzer seam
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

## Production launch gates

This is a working MVP, not a store-ready paid business. Before public release:

- Test 30–50 real household cleanouts and measure first scan, correction, queue, listing, and cleared-space behavior
- Add evidence links and distinguish asking prices from sold comps
- Add follow-up photos for labels/model numbers/condition
- Add billing only after validating demand; include clear pricing, restore/cancel, and required platform controls before charging.
- Add account/export/deletion flows only if cloud sync is introduced
- Publish privacy policy, terms, support, AI-processor disclosure, and store Data Safety/App Privacy answers
- Expand beyond the current allow-listed, metadata-free beta telemetry only after explicit privacy review
- Add API authentication, rate limits, abuse controls, observability, encrypted deployment, and retention policy
- Validate model accuracy by category; never claim appraisal or authenticity
- Check final name, domain, and trademark availability
- Produce proper App Store screenshots, previews, ASO copy, and short-form demonstrations

Direct marketplace posting is intentionally deferred. Competitor reviews repeatedly cite broken OAuth/posting flows, and marketplace APIs create disproportionate support and policy risk for a solo founder.
