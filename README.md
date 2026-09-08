# ClutterCash

> **Point at the mess. Find the money. Clear the room.**

ClutterCash is a phone-first Flutter consumer app that turns a shelf, closet, or garage photo into a ranked decluttering plan. It emphasizes expected net proceeds and completion—not reseller inventory complexity.

## What works now

- Polished one-action onboarding and camera/gallery capture
- Honest interactive demo with multi-item value ranges and a big-ticket highlight
- Live staged-photo analysis through a Cloudflare Worker backed by Gemini
- Explicit free-tier privacy warning and consent before uploads
- Strict scan response validation; malformed results fail instead of inventing values
- Evidence-safe AI listing titles and editable descriptions generated during each scan
- Official active and completed/sold eBay search links plus Facebook Marketplace and Mercari searches
- Marketplace recommendations based on item type, likely value, shipping burden, and selling effort
- Missing-detail checklists that prevent unknown model, condition, damage, or accessories from becoming invented claims
- Privacy-consented follow-up model-label photos that refine the exact maker/model and regenerate search/listing fields
- Sell/bundle/donate/recycle/keep recommendations
- Ranked action queue and item details
- Listing-draft copy flow and better-photo guidance
- Persistent local cash-sprint projects
- Listed/sold/donated state and realized-earnings tracking
- Transparent pricing prototype: free first value, $8.99 monthly or $49.99 annually
- Android and installable web targets

## Run the demo

```bash
flutter pub get
flutter run -d chrome
```

Tap **Scan my space → Try the demo room**. The demo is intentionally available without an account or provider key.

## Enable real photo analysis

The API keeps the Gemini credential off the client. Photos stay in memory, have an 8 MB cap, are not written to disk by the Worker, and responses use `Cache-Control: no-store`.

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Then run Flutter with the deployed HTTPS URL:

```bash
flutter run -d chrome \
  --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev
```

Do not place `GEMINI_API_KEY` in `--dart-define`, Flutter assets, GitHub Pages, or client code. Gemini's free tier is restricted here to staged, non-sensitive photos because free-tier submissions may be reviewed or used to improve Google's products.

Marketplace research in the free version opens official user-facing search pages; it does not scrape or ingest marketplace data. Active listings are labeled as asking prices, while eBay completed/sold results are presented as stronger—but still manually verified—evidence. The AI estimate is never presented as a researched comparable sale.

For exact-item refinement, users should photograph the manufacturer/model label rather than a unique serial number. The follow-up endpoint returns only whether a serial was detected; it does not return or persist the serial itself. The same free-tier image privacy warning applies to label photos.

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
- `worker/src/worker.js` — deployed Gemini proxy, consent gate, CORS, validation, and rate limiting
- `test/`, `server/test/`, and `worker/test/` — domain, storage, API, and critical UI-flow tests

## Product thesis (not market validation)

The defensible wedge is **whole-space decluttering triage**:

1. Scan an overwhelming area.
2. Rank by likely net cash and effort.
3. Pull out big-ticket items for manual verification.
4. Route the rest to sell, bundle, donate, recycle, or keep.
5. Finish a project and track actual cash earned.

Competitive research on September 7, 2026 found active scanner/listing competitors including Klysto, Value Scout, SellRaze, ThriftAI, Hero, and Reclaim. Multi-item detection alone is not unique. ClutterCash must win on making a room easier to clear.

At $49.99/year, roughly 2,001 active annual subscriptions equal $100,000 gross ARR, before store commission, AI costs, refunds, taxes, support, and acquisition. This is a scale target—not a forecast or guarantee.

## Production launch gates

This is a working MVP, not a store-ready paid business. Before public release:

- Test 30–50 real household cleanouts and measure first scan, correction, queue, listing, sale, return, and paywall behavior
- Add evidence links and distinguish asking prices from sold comps
- Add follow-up photos for labels/model numbers/condition
- Replace prototype billing with RevenueCat or native store billing, including restore/cancel
- Add account/export/deletion flows only if cloud sync is introduced
- Publish privacy policy, terms, support, AI-processor disclosure, and store Data Safety/App Privacy answers
- Add analytics and crash reporting with explicit privacy review
- Add API authentication, rate limits, abuse controls, observability, encrypted deployment, and retention policy
- Validate model accuracy by category; never claim appraisal or authenticity
- Check final name, domain, and trademark availability
- Produce proper App Store screenshots, previews, ASO copy, and short-form demonstrations

Direct marketplace posting is intentionally deferred. Competitor reviews repeatedly cite broken OAuth/posting flows, and marketplace APIs create disproportionate support and policy risk for a solo founder.
