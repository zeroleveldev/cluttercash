# ClutterCash Current-State Audit

**Audited:** September 8, 2026
**Scope:** Read-only code review, automated checks, and live health checks. No app code was changed.

## Executive summary

ClutterCash is a functional **free-beta MVP**, not a production-ready paid app. Its strongest complete path is: photograph a small cluttered area → receive conservative AI item/value hypotheses → review marketplace evidence → refine or correct an item → start a local clearing project.

The public web app and Gemini-backed Worker are online. Automated checks pass. The protected invited-beta Worker path and privacy-minimal funnel/error telemetry are implemented locally but are not active until secrets, the Durable Object migration, alert destination, invited client build, and revised Worker are configured and deliberately deployed. Remaining beta blockers are operational activation and real-device/manual acceptance work.

## What the app currently does

- Phone-first onboarding, camera/gallery selection, and a clearly labeled demo.
- Sends consented JPEG/PNG/WebP uploads to a Cloudflare Worker for Gemini analysis.
- Detects up to 12 household objects and proposes value ranges, confidence, effort, and sell/bundle/donate/recycle/keep routes.
- Shows an action queue, estimated total value, and “big-ticket” items.
- Opens eBay sold/active, Facebook Marketplace, and Mercari searches; it does not scrape marketplaces.
- Accepts a model-label photo to improve maker/model identification while stripping returned serial numbers.
- Creates a local clearing project and tracks item status (listed, sold, or donated) and cleared-space progress.

## Architecture and stack

- **Client:** Flutter/Dart, Material 3; web/PWA and Android project.
- **State/UI:** Stateful widgets; most UI and navigation are concentrated in `lib/main.dart` (~2,500 lines).
- **Local persistence:** `shared_preferences`, storing whole projects as JSON on one device/browser.
- **Media/network:** `image_picker`, `http`, `url_launcher`.
- **Production API:** Cloudflare Worker (`worker/src/worker.js`) calling Gemini with structured JSON output.
- **Alternate API:** Express/OpenAI server under `server/`; it has an older, smaller response contract and is not the deployed production path.
- **Database:** None.
- **Authentication/accounts:** None.
- **Payments:** None; no paywall or trial is offered.
- **Tests:** Flutter domain/service/widget tests plus Node tests for the Express API and Worker.
- **Hosting:** GitHub Pages over HTTPS; Worker over HTTPS.

## Verified working

- Public site returns HTTP 200.
- Worker `/health` returns `ok: true`, `analysisReady: true`, provider `gemini`.
- **34 Flutter tests pass**, `flutter analyze` reports no issues, and the release web build succeeds.
- **3 Express tests and 14 Worker tests pass;** Wrangler's deployment dry run recognizes the Durable Object and limit bindings.
- API key remains server-side.
- Worker enforces hashed invite access, atomic per-invite daily quotas, a global daily reserved-cost ceiling, upload type/size, consent, allowed browser origin, no-store responses, strict response cleanup, generic client errors, serial-number omission, and sanitized budget/provider-failure alerts.
- Scan parsing rejects malformed/empty contracts rather than presenting invented results.

- Marketplace research links and item correction are implemented.

## Incomplete, broken, or misleading

### Critical user-flow gaps

- **Resolved September 8:** Saved projects are discoverable from the welcome screen, reopen into the project board, and can be deleted one at a time or all at once.
- **Resolved September 8:** “Sold” is an item-status action only. It does not record a price, fees, earnings, or any transaction data; marketplace values remain explicitly labeled as estimates.
- **Resolved September 8:** “I need to correct this item” now opens a verified item-name and potential-range editor; corrections update the scan and marketplace research context.
- Every project is named **Garage Reset**, including non-garage scans.
- **Resolved September 8:** Results no longer show hard-coded listing-time or square-footage claims. They show scan-derived potential value and selected-item counts instead.
- Project board omits useful controls for keep/recycle and cannot edit a recorded outcome.

### Resolved scope drift and remaining product gaps

- **Resolved September 8:** Removed the visual paywall/trial, no-op sharing, listing-draft/questionnaire flow, and expected-net logic from the invited-beta client, persistence, and Worker contract.
- **Resolved September 8:** Replaced unsupported future privacy promises with current sensitive-photo guidance, provider disclosure, local project deletion controls, and a support contact.
- No settings page, export, or in-app feedback flow.
- **Resolved September 9 in code:** The invited build emits an allow-listed minimum set of funnel/error event names and coarse crash categories through the protected Worker. It includes no user content, identifiers, raw errors, or analytics SDK. Deployed log visibility still requires an owner-controlled verification; there is intentionally no analytics/admin dashboard.
- Web metadata still contains generic Flutter title/description values.
- Android release uses the debug signing key. There is no iOS project.

### Technical gaps

- **Resolved September 8 in code/config:** Live scan and label routes require a hashed per-invite bearer code and reserve quota atomically through a Durable Object before Gemini. Missing access/bindings/limits fail closed.
- **Resolved September 8 in code/config:** Per-invite UTC-day limits and a global reserved-cost ceiling replace the isolate-local IP map; the first daily ceiling event and sanitized provider failures support an HTTPS alert webhook.
- Operational activation still requires the owner to set Worker secrets, validate the alert destination end to end, build an invited client, and deploy. CORS remains only a browser boundary, not the access mechanism; no WAF/bot product or detailed usage ledger is included.
- **Resolved September 8:** Scan and label uploads detect JPEG, PNG, or WebP from the selected bytes, send the matching MIME type and filename, and reject unsupported data before making a request.
- Queue order trusts AI return order; deterministic client-side ranking remains deferred until real-user evidence justifies it.
- The Express/OpenAI path lacks the deployed Worker’s label-identification, consent, invite-access, and durable-limit behavior, creating two divergent backends.
- Automated UI coverage now verifies both live-analysis outcomes at the app boundary: failure shows the real error without silently presenting demo values, and success passes the selected bytes to the analyzer then replaces loading with the returned live result without a demo label. Picker/permission coverage and a full physical-device lifecycle still require manual acceptance; no verified signed Android release/install test is represented here.
- Minimal telemetry coverage verifies scan started/succeeded/failed, project created/reopened, item corrected, item status updated, and framework/async crash categories. The Worker rejects unknown events, arbitrary metadata, raw failure strings, and invalid invites; telemetry does not consume Gemini quota.

## Security and production concerns

### Existing safeguards

- Provider secret is not embedded in Flutter.
- HTTPS is used by public hosting and API.
- Uploaded files are memory-only in app code, capped at 8 MB, and responses use `Cache-Control: no-store`.
- Users see a specific warning not to upload faces, addresses, mail, medication, keys, documents, or private belongings.
- Gemini output is constrained and sanitized before returning to the client.

### Remaining concerns

- Uploaded household photos are sent to Google Gemini. The repository now includes the free-tier review/training disclosure and plain-language beta notice; the owner must still review the provider's current terms/retention behavior before invitations.
- The implemented bearer-invite boundary is appropriate only for a very small beta: client tokens can be recovered and must remain individually revocable and low-quota. Alert delivery and the configured ceiling still require owner-side secret setup and end-to-end operational verification before invitations.
- Local project records are not encrypted, synced, backed up, exportable, or recoverable after browser storage/app-data loss.
- No dependency/security scanning or CI workflow is present on the tracked `main` branch.

## Database, auth, API, and payment status

| Area | Current status | Launch implication |
|---|---|---|
| Database | None; project JSON is device-local in SharedPreferences | Acceptable only for a clearly disclosed, single-device private beta after project reopen/delete UI exists |
| Authentication | No accounts; revocable per-invite bearer access for live AI routes | Suitable only for a small invited beta after configuration/deployment; client bearer codes are recoverable and quota-limited |
| API | Live Cloudflare Worker + Gemini; protected Worker revision is locally verified but not deployed | Durable quotas, reserved-cost ceiling, and sanitized webhook alerts must be configured and verified operationally |
| Payments | None; no paywall or trial UI | Do not charge until billing and entitlement work is deliberately implemented |
| Marketplace APIs | None; official search links only | Fine for first users; direct posting should remain deferred |

## Absolutely required before first real users

For a **small, invited, free beta**:

1. ~~Make saved projects discoverable/reopenable and provide delete-project/delete-all controls.~~ **Completed September 8.**
2. ~~Remove fake transaction math; make “Sold” a status-only action and clearly label marketplace values as estimates.~~ **Completed September 8.**
3. ~~Implement item correction and remove/label hard-coded live-scan metrics.~~ **Completed September 8.**
4. ~~Publish a plain-language privacy policy, beta terms/disclaimer, AI processor disclosure, data-retention statement, and support/feedback contact.~~ **Completed September 8.**
5. ~~Implement Worker invite/device access, durable rate limits, a daily reserved-cost ceiling, and failure/cost alerts.~~ **Completed September 8 in code/config; owner secret setup, deployment, and end-to-end alert verification remain required.**
6. ~~Add minimum privacy-conscious event/error telemetry for scan started/succeeded/failed, project created/reopened, item corrected, item status updated, and app crashes.~~ **Completed September 9 in code; revised Worker deployment and a controlled log-visibility/privacy check remain owner-required.**
7. Run real-device acceptance tests on the intended distribution target: fresh install, permissions, live scan, label scan, correction, project reopen, deletion, offline/error states, and external links.
8. Test representative real household photos and document accuracy/failure boundaries before making value-related marketing claims.

A cloud database and user accounts are **not required** for the first invited beta if the app is honestly single-device/local-only. Production billing is **not required** until charging begins.

## Prioritized launch checklist

### P0 — before inviting anyone

- [x] Reopen/list/delete local projects; test relaunch persistence.
- [x] Make “Sold” status-only; remove inaccurate transaction/earnings behavior and clearly label estimates.
- [x] Implement item correction and remove/label hard-coded live metrics.
- [x] Publish privacy, beta terms, AI disclosure, retention/deletion instructions, and support contact.
- [x] Add protected beta access, durable API quotas, budget ceiling, and sanitized alert delivery (implementation verified; operational activation remains owner-required).
- [x] Add minimal error/funnel telemetry with privacy review (implementation verified; deployment/log-visibility check remains owner-required).
- [ ] Complete real web/Android device acceptance testing; live-analysis success and failure transitions now have automated widget coverage, but picker/permission and physical-device behavior remain manual blockers.
- [ ] Recruit a very small invited cohort and obtain explicit beta/photo-processing consent.

### P1 — during the first-user beta

- [ ] Validate 30–50 authorized cleanouts against the activation funnel in `docs/LAUNCH_EXPERIMENT.md`.
- [ ] Measure scan usefulness, corrections, marketplace-research actions, actual listings, clear-outs, returns, AI cost, and support burden.
- [ ] Add project naming, item-status controls, keep/recycle controls, feedback, and useful share/export only if observed behavior justifies them.
- [ ] Consolidate or retire the divergent Express backend.
- [ ] Add CI, dependency/security scanning, and operational runbooks.

### P2 — before charging or store launch

- [ ] Add RevenueCat/native billing, entitlement checks, restore/cancel flows, receipts, and subscription disclosures.
- [ ] Create production Android signing, Play Store privacy/data-safety assets, screenshots, and closed testing; add iOS only if intentionally targeted.
- [ ] Decide whether accounts/cloud sync are justified; if added, implement secure auth, database access rules, export, deletion, backup, and recovery.
- [ ] Complete name/domain/trademark review and finalize analytics, crash reporting, support, incident response, and provider-cost economics.

## Launch recommendation

Do **not** launch publicly or accept payment yet. After the P0 items, release an explicitly free, invite-only beta to a handful of known households. The purpose of those users should be validating whether ClutterCash helps people actually list and clear items—not validating the polish of the demo or the AI value reveal alone.
