# ClutterCash eBay Comparables MVP Plan

> **For Hermes:** Implement only after Sam supplies the required eBay production credentials and explicitly authorizes implementation.

**Goal:** Make ClutterCash’s potential price range credibly grounded in a small, filtered set of **currently active eBay listings**, while preserving the minimal flow: `scan → identify → eBay comparables → potential range → correct → save`.

**Architecture:** Keep Flutter credential-free. The existing Cloudflare Worker obtains and caches an eBay application OAuth token server-side, calls eBay’s official Buy Browse API, filters a bounded result set, and returns only a compact comparable snapshot. Flutter displays three to five active-listing comparables and an asking-price range in the item detail sheet. A correction or model-label identification reruns the same lookup.

**Tech stack:** Flutter/Dart; existing Cloudflare Worker/JavaScript; eBay Buy Browse API; eBay OAuth 2.0 client-credentials grant; existing `http`, `shared_preferences`, and `url_launcher` dependencies.

---

## 1. Recommended implementation approach

Use **eBay Buy Browse API** `item_summary/search` as the only directly integrated marketplace:

- Production endpoint: `GET https://api.ebay.com/buy/browse/v1/item_summary/search`
- Search input: the existing conservative AI/refined `searchQuery`, never an arbitrary client URL.
- Marketplace: eBay US only for this MVP, via `X-EBAY-C-MARKETPLACE-ID: EBAY_US`.
- Listing type: current fixed-price listings only (`buyingOptions:{FIXED_PRICE}`), so each displayed price is an understandable **active asking price**, not an auction bid or completed sale.
- Return at most five representative listings to Flutter. Do not scrape eBay pages, use sold-comps filters, use a seller API, create listings, post to eBay, or integrate another marketplace.

Why Browse API: eBay’s official Browse API is explicitly for searching eBay listings, and its documentation states that Browse methods use an **Application access token** obtained through the client-credentials grant. This matches a read-only, no-user-account beta. A seller/user OAuth flow is unnecessary because ClutterCash neither accesses a user’s eBay data nor posts listings.

Official references reviewed:

- eBay Browse API: <https://developer.ebay.com/develop/api/buy/browse_api/item_summary/search>
- eBay OAuth authorization guide: <https://developer.ebay.com/develop/guides/sell/authorization#the-client-credentials-grant-flow>

Before production use, review and comply with the current eBay Developer Program/API License Agreement, Browse API terms, display/attribution rules, rate limits, and caching/retention restrictions. This plan deliberately avoids storing eBay listing payloads in the Worker or local project persistence unless those terms explicitly permit it.

## 2. Current architecture and fit

Existing paths already provide the required foundation:

- `worker/src/worker.js`
  - receives scan/label images,
  - keeps Gemini credentials server-side,
  - returns an AI-generated `searchQuery` for each item,
  - has a Worker-side request boundary and `Cache-Control: no-store` responses.
- `lib/services/scan_api.dart`
  - sends multipart requests only to the Worker,
  - parses strict JSON contracts,
  - updates identity/search-query data after label analysis.
- `lib/domain/item.dart`
  - holds `name`, `searchQuery`, confidence, potential values, and status-only clearing state.
- `lib/main.dart` / `_ItemDetailsSheet`
  - already shows item details, external marketplace search links, label refinement, and the correction flow.
- `lib/services/project_store.dart`
  - persists only local project data.

Current gap: `ListingGuide` only builds outbound eBay/Facebook/Mercari URLs. It does **not** retrieve or display in-app marketplace comparables. The existing AI value range is an initial hypothesis, not eBay-supported evidence.

## 3. Required accounts, credentials, and configuration

### Sam must obtain/configure before implementation

1. Create/sign into an **eBay Developers Program** account.
2. Create an application and generate a **Production** keyset in the eBay Developer Portal.
3. Confirm the keyset has access to the **Buy Browse API** and the application OAuth scope required by Browse:
   - `https://api.ebay.com/oauth/api_scope`
4. Provide the production **Client ID** and **Client Secret** to the deployment secret manager only. Do **not** paste either into Discord, source code, Flutter `--dart-define`, Git, GitHub Pages, or this plan.
5. Review/accept the applicable eBay API agreement and confirm eBay US listings are the intended initial market.
6. Optionally create a separate Sandbox keyset for contract testing. Sandbox catalog/listings are not validation for live comparable quality.

### Cloudflare configuration to add during implementation

Use Wrangler secrets, not `[vars]` in `worker/wrangler.toml`:

```bash
cd worker
npx wrangler secret put EBAY_CLIENT_ID
npx wrangler secret put EBAY_CLIENT_SECRET
```

Add only non-secret configuration to `worker/wrangler.toml`:

```toml
[vars]
GEMINI_MODEL = "gemini-3.5-flash-lite"
ALLOWED_ORIGIN = "https://zeroleveldev.github.io"
EBAY_MARKETPLACE_ID = "EBAY_US"
```

No Flutter eBay credential, eBay token, or eBay secret is ever added to `lib/`, web assets, browser storage, client logs, or API responses.

## 4. Backend and data flow

### OAuth token flow (Worker only)

1. The Worker receives a bounded comparable-search request for one already-scanned item.
2. `getEbayApplicationToken(env, fetcher)` checks a Worker-private cache for a non-expired application token.
3. On cache miss, Worker POSTs to:
   `https://api.ebay.com/identity/v1/oauth2/token`
4. It sends HTTP Basic credentials built inside the Worker from `EBAY_CLIENT_ID:EBAY_CLIENT_SECRET`, URL-encoded body `grant_type=client_credentials`, and scope `https://api.ebay.com/oauth/api_scope`.
5. Cache the token only server-side, with expiry shortened by a safety buffer. Do not serialize it in a response or log it.
6. If eBay returns one authentication failure, invalidate the token and retry token minting once; then return a generic 502/503 error without provider details.

### Comparable-search endpoint

Add one Worker endpoint:

```text
POST /v1/items/comparables
Content-Type: application/json
```

Accepted body (strictly bounded):

```json
{
  "itemName": "Makita 18V cordless drill",
  "searchQuery": "Makita XFD13 18V cordless drill",
  "confidence": "medium"
}
```

Worker behavior:

1. Apply the same beta access/usage controls as scan/label routes. This endpoint must not become an unauthenticated eBay proxy.
2. Require trimmed `itemName` and `searchQuery`, cap both to 120 characters, and reject empty payloads.
3. Request eBay Browse search with:
   - `q=<URL-encoded searchQuery>`
   - `limit=50` (enough candidates for filtering, never passed through in full)
   - `filter=buyingOptions:{FIXED_PRICE}`
   - `X-EBAY-C-MARKETPLACE-ID: EBAY_US`
   - `Authorization: Bearer <application token>`
4. Read only needed eBay fields: item ID, title, `itemWebUrl`, price/currency, condition, image URL when supplied, buying options, and seller/location/shipping summary only if returned and permitted for display.
5. Filter and calculate the range server-side (rules below).
6. Return a compact, normalized response with `Cache-Control: no-store`:

```json
{
  "query": "Makita XFD13 18V cordless drill",
  "marketplace": "eBay US",
  "listingType": "active asking prices",
  "searchedAt": "2026-09-08T00:00:00.000Z",
  "status": "ready",
  "range": { "low": 55, "typical": 69, "high": 82, "currency": "USD" },
  "comparables": [
    {
      "title": "Makita XFD13 18V LXT Cordless Drill Driver Tool Only",
      "price": 69.99,
      "currency": "USD",
      "condition": "Used",
      "imageUrl": "https://...",
      "itemUrl": "https://www.ebay.com/itm/..."
    }
  ]
}
```

No useful-comps response:

```json
{
  "query": "...",
  "marketplace": "eBay US",
  "listingType": "active asking prices",
  "searchedAt": "...",
  "status": "no_useful_comps",
  "message": "No close current eBay asking-price matches were found. Try correcting the item name or adding a model-label photo.",
  "comparables": []
}
```

The Worker must never describe active prices as sold prices, actual resale value, a guarantee, an appraisal, or a completed comparable sale.

### Flutter flow

1. `ScanApi.analyze` returns the scan exactly as today, including AI identity and search query.
2. On results load, request eBay comparables only for the short sellable/actionable set (maximum five items); do not issue eBay searches for every detected object.
3. Each eligible item shows a local loading state, then one of: ready, no useful comparables, or retryable lookup failure.
4. The item detail sheet displays the returned range and 3–5 comparables. Its existing external eBay search link remains available as a secondary “See more on eBay” action.
5. On manual identity correction or successful model-label refinement, discard the in-memory comparable snapshot and rerun the request for that one item.
6. Do not persist raw eBay listings in `ProjectStore` during the MVP. Saved projects retain item identity/search query and can fetch fresh active listings when reopened. This avoids stale “active” results and minimizes data-retention risk.

## 5. Comparable filtering and potential-range calculation

### Candidate acceptance

From at most 50 eBay item summaries, accept candidates only when all apply:

1. Current listing has `FIXED_PRICE` buying option.
2. Price is finite, positive, and in USD for `EBAY_US`.
3. Title is present and has meaningful normalized overlap with the AI/refined search query.
4. When the query contains a model-like token (letters/numbers/hyphens with at least four characters), candidate title must contain that exact normalized model token. This is the strongest cheap protection against wrong variants.
5. Exclude titles with obvious non-comparable signals, initially: `parts`, `repair`, `broken`, `for parts`, `case only`, `box only`, `manual only`, `lot of`, `bundle`, and `accessory only`—unless such a term is explicitly in the search query.
6. Do not infer condition equivalence from an ambiguous room scan. Display the eBay-provided condition on every card and advise users to compare condition/accessories themselves.

The filtering helper must be deterministic and unit-tested. It should favor returning **no useful comparables** over showing misleading matches.

### Outliers

1. Sort accepted candidates by item price only; do not present shipping, taxes, fees, or net proceeds as part of the range.
2. If five or more candidates remain, calculate Q1 and Q3 and remove values outside `Q1 - 1.5×IQR` through `Q3 + 1.5×IQR`.
3. If fewer than three candidates remain after title/price/outlier filtering, respond `no_useful_comps` rather than manufacture a range.
4. If three or four candidates remain, retain them without IQR removal and use a wider percentile range.
5. Limit representative results to five: select prices around low, median, high and, when present, the closest candidates on either side rather than merely the first eBay response order.

### Price range

For three or more usable active fixed-price items:

- `low`: nearest-rank 25th percentile of filtered item prices
- `typical`: nearest-rank 50th percentile (median)
- `high`: nearest-rank 75th percentile
- Round display values to whole USD for a simple range; retain cents only for individual eBay cards.

Label it exactly as:

> **Potential eBay listing-price range — current active asking prices**

Below it, display:

> These are current asking prices for similar listings, not sold prices, an appraisal, or a guaranteed sale price. Check model, condition, included accessories, shipping, and the full listing before posting.

The original Gemini range remains only a clearly marked **Initial AI triage estimate** until eBay comparisons return. Once ready, do not merge or average it with the eBay-derived range.

## 6. Minimal UI and model changes

### New domain model

Create `lib/domain/ebay_comparable.dart`:

- `EbayComparable`: `title`, `price`, `currency`, `condition`, `imageUrl`, `itemUrl`
- `EbayComparableResult`: `query`, `searchedAt`, `status`, optional `low/typical/high`, and a maximum-five immutable comparable list
- Explicit status enum: `idle`, `loading`, `ready`, `noUsefulComps`, `failed`

Keep this result in result-screen/item-detail in-memory state for the MVP. Do not add it to `ClutterItem` serialization or `ProjectStore` yet.

### Client API

Extend `lib/services/scan_api.dart` with:

```dart
Future<EbayComparableResult> fetchEbayComparables({
  required String itemName,
  required String searchQuery,
  required Confidence confidence,
});
```

It posts only item identity/query data to `/v1/items/comparables`, has the same timeout/error conventions as the existing APIs, and strictly validates every returned URL, USD price, range order, status, and five-item maximum.

### Item-detail sheet

Modify `_ItemDetailsSheet` in `lib/main.dart`:

- Add a compact **Current eBay asking prices** section directly below the item potential-value/identity summary.
- States: loading spinner; 3–5 simple comparable rows/cards; compact no-comps correction CTA; retry on temporary failure.
- Each row shows thumbnail when present, title (two lines max), `$price`, condition, and **Open on eBay**. Links open externally.
- Show the calculated range, query, and date/time searched.
- Keep existing eBay external-search button as **See more on eBay**; Facebook/Mercari remain external only and should not appear as equivalent integrated evidence.
- Remove/hide the listing-draft copy workflow from the invited beta path; it is out of current scope.
- Correcting an item name/range or label refinement calls one shared `_refreshComparables()` after item state updates.

### Results screen

- Retain a short list of actionable/sellable items only.
- If an item has ready eBay results, show its eBay-derived potential range in the summary card.
- If it has no results/loading/error, never silently substitute the AI range as marketplace research; label AI values as initial triage estimates.

## 7. Tests required

### Worker tests (`worker/test/worker.test.js` plus focused new helper tests)

1. Client-credentials request uses `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` only server-side; neither is present in a response or log fixture.
2. Correct OAuth endpoint, Basic authorization, `grant_type=client_credentials`, and Browse scope are requested.
3. Token reuse before expiry; one refresh/retry after a 401; generic failure response after a second failure.
4. Browse request includes eBay Bearer token, `EBAY_US`, query, fixed-price filter, and candidate limit.
5. Valid eBay payload normalizes to no more than five public comparable records.
6. Filters reject missing/zero/non-USD prices, auctions, wrong model token, parts/repair/accessory/lot noise, and malformed item URLs.
7. IQR filtering removes a deliberate extreme outlier while preserving representative normal prices.
8. Fewer than three usable candidates produces `no_useful_comps` without a range.
9. Empty eBay results, rate limits, eBay 4xx/5xx, and malformed OAuth/Browse payloads fail gracefully without provider secrets.
10. Existing scan and label routes still pass unchanged.

### Flutter domain/API tests

1. New response parser rejects malformed range, non-USD currency, non-HTTPS eBay URL, reversed range, more than five comparables, and unknown status.
2. Valid ready/no-useful-comps/failed responses parse deterministically.
3. Initial scan values are visibly distinct from eBay-backed active asking-price range.
4. `ListingGuide` keeps its external eBay link but no longer implies it is equivalent to integrated evidence.

### Widget tests (`test/widget_test.dart` and/or a focused new test)

1. Eligible item displays a loading state then exact range label and three comparable cards.
2. Cards display **Active asking price** context, never “sold price” or “guaranteed.”
3. No-comps state offers item correction/model-label refinement and does not show an invented range.
4. Correct identification invokes the comparable lookup again and replaces old in-memory results.
5. Temporary error shows retry; retry makes one request.
6. Saved/reopened projects do not display stale persisted listings; they can refresh current eBay results.
7. Home screen remains centered on **Scan a space** and **Open saved projects**; no paywall/trial or inventory/transaction workflow remains.

### Full validation

```bash
cd worker && npm test
cd .. && flutter test
flutter analyze
flutter build web --release
git diff --check
```

Then perform real web/Android acceptance tests with production eBay credentials on at least five representative spaces, including a bad/no-comps scene and a corrected model-name path.

## 8. Exact implementation sequence (do not start until authorized)

### Task 0: Obtain and verify eBay prerequisites

- Sam creates the Developer Program production app/keyset and sets Worker secrets.
- Verify a server-side token request manually from a private environment; never paste the token into source/control/chat.
- Confirm API display/caching requirements before storing or rendering eBay fields.

### Task 1: Define the comparable contract test-first

**Files:**
- Create: `worker/src/ebay-comparables.js`
- Create: `worker/test/ebay-comparables.test.js`
- Create: `lib/domain/ebay_comparable.dart`
- Create: `test/domain/ebay_comparable_test.dart`

Write failing tests for ready/no-comps contracts, ranges, representative records, and invalid data. Implement only pure normalization/filter/percentile helpers until those tests pass.

### Task 2: Add Worker OAuth/token and Browse client test-first

**Files:**
- Modify: `worker/src/worker.js`
- Modify: `worker/wrangler.toml`
- Modify: `worker/test/worker.test.js`
- Modify: `worker/test/ebay-comparables.test.js`

Add `POST /v1/items/comparables`, server-only token minting/caching, eBay headers, strict response mapping, generic errors, and existing beta request controls. Run Worker tests before touching Flutter.

### Task 3: Add strict Flutter comparable client test-first

**Files:**
- Modify: `lib/services/scan_api.dart`
- Create or modify: `test/services/scan_api_test.dart`

Write HTTP fixture tests for ready, no-comps, bad payload, and retryable errors. Add the bounded `fetchEbayComparables` method only after the tests fail for its absence.

### Task 4: Render the smallest comparable UI test-first

**Files:**
- Modify: `lib/main.dart`
- Modify: `test/widget_test.dart`

Write a widget test for loading → three active eBay cards → explicit disclaimer. Add one compact detail-sheet section and external eBay card links. Do not add feeds, tabs, dashboards, seller profiles, inventory, or listing-posting UI.

### Task 5: Wire refresh after correction and label refinement

**Files:**
- Modify: `lib/main.dart`
- Modify: `test/widget_test.dart`

Write tests proving name correction and successful label refinement invalidate old comps and request a fresh lookup. Implement a single shared refresh method to avoid two inconsistent code paths.

### Task 6: Simplify non-MVP UI in the same release

**Files:**
- Modify: `lib/main.dart`
- Modify: `lib/domain/item.dart`
- Modify: `test/widget_test.dart`
- Modify: `test/domain/project_test.dart`

Remove visual paywall/trial, no-op sharing, out-of-scope listing-draft flow, and remaining expected-net wording/logic. Preserve simple listed/sold/donated/clear statuses only.

### Task 7: Verify a protected, real-device beta path

- Run complete automated suite/build checks.
- Test camera/gallery and corrected-item search on web and Android.
- Inspect Worker logs for secrets or raw image/eBay payload leakage.
- Check active listing price/disclaimer wording against eBay responses.
- Invite only the first 5 known users, review failure/cost/support signals, then expand to 10–20 if stable.

## Current implementation bookmark

- **eBay active-comparable integration — INCOMPLETE / BLOCKED:** Awaiting eBay Developers Program production-account review and the resulting production Browse API credentials. Do not implement or deploy this integration until approval completes and Sam provides the server-side Cloudflare secrets described above.
- **Completed locally September 8:** invited-beta Worker protection now uses hashed per-invite bearer access, atomic Durable Object quotas, a daily reserved-cost ceiling, and sanitized budget/provider-failure webhooks. Worker tests and a Wrangler dry run pass. Owner-side secrets, deliberate deployment, and an end-to-end alert check remain required before inviting users.
- **Completed locally September 8:** removed paywall/no-op sharing/listing-draft/expected-net remnants from the invited-beta UI, domain/persistence model, Worker response contract, and current product documentation.
- **Completed locally September 8:** scan and model-label uploads now detect JPEG, PNG, or WebP from file signatures, send matching multipart MIME types/filenames, and reject unsupported bytes before upload.
- **Automated QA progress September 9:** both failure and success are now driven through an injected live-analysis boundary in widget tests. The failure case proves the app shows the API error without silently substituting demo values; the success case proves the selected image bytes reach the analyzer and loading is replaced by the returned live result without a demo label. Picker/permission and physical-device acceptance remain owner/manual-required.
- **Completed locally September 9:** privacy-minimal telemetry now covers scan started/succeeded/failed, project created/reopened, item corrected/status updated, and coarse framework/async crashes. The protected Worker accepts only allow-listed event/failure names, rejects arbitrary metadata, and logs no user content or identifiers from the event payload. Deployment and a controlled Cloudflare log-visibility/privacy check remain owner-required.
- **Current unblocked work:** all repository-implementable invited-beta P0 work identified by the audit is complete locally. eBay remains blocked, while operational activation, real-device/photo acceptance, and invited-user recruitment remain explicitly owner/manual-required.

## Priority after this update

1. **P0 prerequisite — implemented locally:** invited-beta Worker protection, durable limits, budget ceiling, and failure/cost alerts; operational activation remains owner-required.
2. **P0 core value:** eBay Browse API active-comparable integration described above.
3. **P0 cleanup — completed locally:** removed paywall/share/listing-draft/net-value remnants that diluted the simple flow.
4. **P0 quality — MIME and live-result transition QA completed locally:** real web/Android picker, permission, and physical-device acceptance remains owner/manual-required.
5. **P0 telemetry — completed locally:** deploy and verify sanitized Worker log visibility before invitations.
6. **P1 evidence:** use the first 10–20 users to validate item detection, query quality, comp usefulness, correction rate, and no-comps behavior.

Still deferred: additional marketplace integrations, sold-price data, inventory, bookkeeping, fees, shipping, listing/posting automation, social, analytics dashboards, accounts/cloud sync, subscriptions/scan packs, and store launch work.
