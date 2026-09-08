# ClutterCash

> **Point at the mess. Find the money. Clear the room.**

ClutterCash is a phone-first Flutter consumer app that turns a shelf, closet, or garage photo into a ranked decluttering plan. It emphasizes expected net proceeds and completion—not reseller inventory complexity.

## What works now

- Polished one-action onboarding and camera/gallery capture
- Honest interactive demo with multi-item value ranges and a big-ticket highlight
- Optional live photo analysis through a separate server-side OpenAI-compatible vision API
- Strict scan response validation; malformed results fail instead of inventing values
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

The API keeps provider credentials off the client. Photos stay in memory, have an 8 MB cap, are not written to disk by this server, and responses use `Cache-Control: no-store`.

```bash
cd server
npm install
copy .env.example .env
# Put OPENAI_API_KEY in server/.env; optionally change OPENAI_MODEL.
npm start
```

Then run Flutter with the API URL visible to the device:

```bash
# Chrome on this computer
flutter run -d chrome --dart-define=CLUTTERCASH_API_URL=http://localhost:8787

# Android emulator (when installed)
flutter run -d android --dart-define=CLUTTERCASH_API_URL=http://10.0.2.2:8787
```

For a physical phone, use an HTTPS deployment or the development computer's reachable LAN address. Do not place `OPENAI_API_KEY` in `--dart-define`, Flutter assets, or client code.

## Quality commands

```bash
flutter test
flutter analyze
flutter build web --release
flutter build apk --release
npm test --prefix server
```

## Architecture

- `lib/domain/` — immutable item, scan, and cleanout-project behavior
- `lib/services/scan_api.dart` — multipart API client and strict parser
- `lib/services/project_store.dart` — namespaced SharedPreferences persistence
- `lib/main.dart` — responsive mobile UI and complete demo flow
- `server/src/app.js` — bounded Express API with injected analyzer seam
- `server/src/openai-analyzer.js` — server-only image analysis and JSON schema
- `test/` and `server/test/` — domain, storage, API, and critical UI-flow tests

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
