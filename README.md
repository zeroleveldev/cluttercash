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
- Free invited beta; no subscription, scan pack, payment, or in-app purchase is offered yet
- Android and installable web targets

## Free invited-beta privacy and terms

Read the current [Free Invited Beta — Privacy Notice & Terms](docs/BETA_PRIVACY_AND_TERMS.md) before using live photo analysis. It explains the Google Gemini AI processor, local project storage, photo and deletion limits, beta disclaimers, and how to contact support at [cluttercash.help@gmail.com](mailto:cluttercash.help@gmail.com).

## Run the demo

```bash
flutter pub get
flutter run -d chrome
```

Tap **Scan my space → Try the demo room**. The demo is intentionally available without an account or provider key.

## Enable protected real-photo analysis

The API keeps the Gemini credential off the client. Photos stay in memory, have an 8 MB cap, are not written to disk by the Worker, and responses use `Cache-Control: no-store`. Live scan and label routes require a hashed per-invite bearer code, an atomic Durable Object quota reservation, and a configured daily reserved-cost ceiling. Sanitized failure/budget alerts can be sent to a private HTTPS webhook.

Follow [`docs/WORKER_BETA_OPERATIONS.md`](docs/WORKER_BETA_OPERATIONS.md) to generate invite hashes, configure Worker secrets, review limits, verify alerts, and handle rotation. Do not deploy as part of routine development.

For an authorized invited-client build, pass both non-privileged client settings:

```bash
flutter run -d chrome \
  --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev \
  --dart-define=CLUTTERCASH_BETA_INVITE="$INVITE_CODE"
```

Do not place `GEMINI_API_KEY`, Cloudflare credentials, alert credentials, or plaintext invite codes in Git or Flutter assets. A client invite code is a revocable, low-quota bearer token—not a server secret—and should be unique per invited person/device. Gemini's free tier is restricted here to staged, non-sensitive photos because free-tier submissions may be reviewed or used to improve Google's products.

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
- `lib/services/project_store.dart` — namespaced SharedPreferences persistence
- `lib/main.dart` — responsive mobile UI and complete demo flow
- `server/src/app.js` — bounded Express API with injected analyzer seam
- `server/src/openai-analyzer.js` — server-only image analysis and JSON schema
- `worker/src/worker.js` — Gemini proxy, consent gate, invite access, durable quota/budget protection, validation, and sanitized alerts
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
