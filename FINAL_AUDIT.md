# ClutterCash — FINAL PRE-LAUNCH ADVERSARIAL AUDIT

## Current remediation overlay (local only)

**Not launch ready.** The report below is preserved **historical baseline evidence**, including its findings, severity counts, verdict, commands, artifact hashes and original clean Git status. Those assertions describe the audited baseline, not today's modified working tree. Current step-by-step verification and limitations are in [docs/LAUNCH_FIX_PROGRESS.md](docs/LAUNCH_FIX_PROGRESS.md); current release gates are in [README.md](README.md#current-release-status-and-gates).

| Finding | Current local status |
|---|---|
| CC-01 | Request/output limits, exact-model pricing floor and conservative reservations verified locally. Account billing controls and approval of proposed $5/$3 pools remain operator gates; not a universal billing cap. |
| CC-02 | Separate anonymous pool and trusted-edge address friction verified locally; three registration-free uses preserved subject to capacity. |
| CC-03–05 | Numeric integrity, corrected research and unique item IDs fixed with regressions. |
| CC-06 | Provenance persisted/displayed for new saves; legacy unlabelled records cannot reliably be reclassified. |
| CC-07–09 | Saved research/correction, content-free error logs and loopback-only legacy entry fixed locally. |
| CC-10 | Best-effort serial minimization and qualified privacy guidance implemented; no guaranteed exclusion or photo sanitization. |
| CC-11–15 | Complete-response deadlines, valid empty results, pre-reservation validation, registered revocation and bounded telemetry verified locally. Transport abort does not prove billing stopped. |
| CC-16 | **Open owner gate:** release still selects debug signing. Supply intended protected signing identity/configuration securely before non-temporary Android distribution. |
| CC-17 | Startup lost-picker recovery implemented with injected regressions. No old-photo replay/upload: original room/label context is unknown, so prompt for a new scan or reopened item's label flow and renewed consent. Physical Android process-death verification remains open. |
| CC-18 | Wrangler 4.131.1 tool chain verified, Worker audit zero known vulnerabilities at recorded check; not blanket dependency security certification. |
| CC-19 | Streamed total envelope and declared-MIME/signature checks implemented before quota/provider work. Signatures are not full decoding or malware checks. |
| CC-20 | Current README gates/data description reconciled; this overlay separates historical findings from remediation. Operations/privacy updates are recorded in progress. |

Local phone-sized release-web demo/privacy/correction/save/reload/reopen/confirmed-delete smoke is now recorded in [docs/LAUNCH_BROWSER_SMOKE.md](docs/LAUNCH_BROWSER_SMOKE.md). Exact browser research URI/navigation, real scan/failure/retry and physical-device smoke remain open. No deployment parity, provider-account billing protection, real Cloudflare concurrency or live alert delivery is certified by these local fixes. No deployment, paid calls, commits, provider changes or signing secrets were introduced in this remediation slice.

---

## Historical audit begins

Audit baseline: `2e8a99fbc013ade1757f902e904261953e97ce6b` (HEAD verified). Scope: local repository and generated artifacts, resuming the interrupted audit. This report independently rechecked the diagnostic findings against source and reran the probes. Previous truncated command results are not treated as successful verification.

No production fixes, refactors, deployment, permanent tests, live AI requests or paid provider calls were made. All adversarial provider responses are explicit synthetic fixtures. This audit is not an assertion about current Cloudflare secrets, production bills, or live deployment parity.

## Summary

**Counts: P0 0 · P1 9 · P2 10 · P3 1 — 20 findings.**

No confirmed P0 at the inspected Worker configuration. P1s are concrete pre-public-launch fixes; the legacy Express finding is conditional on deploying that alternate service. Token rotation does not defeat the global request counter, and a fixed reservation must not be confused with a proven billing cap.

## Evidence and test results

- `node C:/Users/Sgrab/AppData/Local/Temp/cluttercash-audit-probes.mjs`: all local assertions pass. These assertions confirm bugs/controls; passing does not mean the app is bug-free.
- `flutter test test/audit_temporary_test.dart --reporter expanded`: 6 diagnostics pass, including an intentionally captured real framework error from NaN correction.
- `npm test --prefix worker`: 29 passed, 0 failed.
- `npm test --prefix server`: 3 passed, 0 failed.
- `npm audit --json --prefix server`: exit 0, no reported vulnerabilities.
- `npm audit --json --prefix worker`: exit 1, three high package entries in one sharp/libheif advisory chain (CC-18), not three independent deployed vulnerabilities.
- Full permanent Flutter suite: **45 passed**. Analyzer: **no issues**. Production-configured web and release APK builds: **both exit 0**. Artifact hashes and exact commands are recorded in final verification below.
- Durable Object concurrency probe used the production limiter class with a serialized transactional storage mock: 60 parallel requests, 50 allowed and 10 denied. This does not substitute for a deployed Cloudflare concurrency test.

Evidence retained outside the repository: `C:/Users/Sgrab/AppData/Local/Temp/cluttercash-final-audit/` (diagnostic Dart source, complete command logs and JSON results), plus the original `cluttercash-audit-probes.mjs`. The temporary repository test was removed after copying and rerunning it; cleanup verification is recorded at the end.

# FINDINGS

### [CC-01] The reserved-cost ceiling is not an enforced billing ceiling
Severity: P1

Area: Worker / AI cost

Files/lines: `worker/src/worker.js:248–306,541–559,790–819; worker/wrangler.toml:8–10`

What happens: Every accepted analysis reserves a fixed 10,000 micro-USD. The Gemini request has no maxOutputTokens, and neither provider usage nor a derived worst-case request price is checked.

Why it matters: The global counter genuinely bounds request count, but cannot substantiate the documented hard owner cost backstop. Actual paid cost depends on tokens, image processing and provider plan; no bill overrun was generated or measured.

How to reproduce/exploit: Entry: POST /v1/scans or /v1/items/identify. With valid free access and consent, capture the injected provider request. Inspect generationConfig and the fixed reservation. A sufficiently costly permitted response can exceed its reservation.

Evidence: Node probe asserts generationConfig has no maxOutputTokens. With checked-in values, 60 concurrent rotated-token requests admitted 50 and rejected 10; this is a count bound, not verified dollars.

Recommended fix: Set a conservative output-token cap and input limits; derive a worst-case reservation from the selected model/pricing, including applicable token categories. Independently configure provider-side billing protection. Do not promise a hard dollar ceiling until substantiated.

Confidence: High

### [CC-02] Fresh client tokens bypass the free allowance and can exhaust shared capacity
Severity: P1

Area: Access / availability

Files/lines: `worker/src/worker.js:340–362,541–559,790–819`

What happens: Any syntactically valid self-selected device token receives its own three-use allowance; no invite or approval is needed. Non-browser requests can omit Origin.

Why it matters: This is disclosed low-friction trial design, not an accidental authentication bypass or unlimited AI. Nevertheless one caller can take all daily analysis capacity, including the owner’s, without approval.

How to reproduce/exploit: Entry: POST /v1/scans with consent, a small JPEG-labelled part and X-ClutterCash-Device. Use the same token four times, then replace it. Repeat new tokens until the shared counter is exhausted.

Evidence: Probe statuses: 200,200,200,429; fresh token 200. Parallel mock run: 50 accepted, 10 rejected, exactly 50 provider calls.

Recommended fix: For an invited beta, gate AI on approved access, or retain anonymous trials with a small separate shared trial pool and server-side network/bot friction. Preserve global limits. Do not add accounts merely for this.

Confidence: High

### [CC-03] Invalid correction numbers crash results; extreme AI totals also overflow
Severity: P1

Area: Flutter / validation

Files/lines: `lib/main.dart:1786,2052,2208–2236,2413–2414; lib/services/project_store.dart:13–20; worker/src/worker.js:945–954,995–997`

What happens: double.tryParse accepts NaN and Infinity; ordering comparisons do not reject NaN. Values reach toInt rendering and JSON persistence. Separately, individually finite model values such as 1e308 pass Worker validation and can overflow aggregate totals.

Why it matters: A user-controlled correction can break the current results/detail screen and cannot be saved as valid JSON. Hallucinated extreme numbers are not safely bounded either.

How to reproduce/exploit: Entry: result item → I need to correct this item. Paste NaN into all three price fields, then Save correction. The predicate accepts it; copyWith updates the scan; results build calls toInt. For AI path return two items priced 1e308 from a mocked provider.

Evidence: Six-test diagnostic suite includes a widget reproduction capturing Unsupported operation: Infinity or NaN toInt at main.dart:1786/2052; JSON NaN serialization fails. Node probe confirms finite huge values survive and sum to Infinity.

Recommended fix: Require isFinite, a reasonable supported upper bound and ordered values at correction/API/persistence boundaries. Validate totals before rendering and reject invalid model values honestly.

Confidence: High

### [CC-04] Corrected names still search for the old identification
Severity: P1

Area: Correction / marketplace research

Files/lines: `lib/main.dart:2208–2235; lib/domain/item.dart:71–85; lib/domain/listing_guide.dart:15–18,31–42`

What happens: Manual correction changes name and prices but retains the original nonempty searchQuery and recommendation. ListingGuide prefers that old query to the corrected name.

Why it matters: The correction flow fails its central purpose: users verifying a different item are sent to unrelated comparables. README line 17 claims this updates research queries.

How to reproduce/exploit: Entry: result details → correction. Change Lamp to Verified drill when the original searchQuery is old lamp search. Save and open a research link. Execution: copyWith omits searchQuery → preserves it → ListingGuide selects it.

Evidence: Diagnostic asserts ListingGuide.forItem(item.copyWith(name: Verified drill)).searchQuery remains old lamp search; source traces the same copyWith call in the actual form.

Recommended fix: Update or clear searchQuery when manual identity changes; reassess identity-specific marketplace rationale. Add a widget assertion on the resulting link URI.

Confidence: High

### [CC-05] Duplicate model IDs merge selection and status changes across items
Severity: P1

Area: AI contract / project integrity

Files/lines: `worker/src/worker.js:943–950; server/src/app.js:49–55; lib/services/scan_api.dart:169–178; lib/main.dart:1731–1735; lib/domain/project.dart:26–43`

What happens: Both backends preserve duplicate supplied IDs; the client trusts them. Selection uses an ID set and updates map every item with the matching ID.

Why it matters: A plausible malformed AI response causes distinct objects to be selected or marked cleared together, corrupting project progress.

How to reproduce/exploit: Entry: mocked successful scan returns Lamp and Camera both id=same. Parse/save them, then mark just Lamp sold. Worker preserves both; updateStatus maps both matching IDs.

Evidence: Node probe confirms same,same survive validation. Dart diagnostic confirms one updateStatus call produces clearedCount=2.

Recommended fix: Assign unique server-generated per-result IDs or reject duplicate/oversized IDs; defensively validate uniqueness on client load. Keep duplicate-looking objects distinct.

Confidence: High

### [CC-06] Demo data loses its label when saved as an ordinary project
Severity: P1

Area: Truthfulness / persistence

Files/lines: `lib/main.dart:1729–1735,1766–1769,1881–1905,2370–2373,2761–2908; lib/domain/project.dart:3–22; lib/services/project_store.dart:13–19`

What happens: Demo results are correctly labelled initially, but Start clearing persists the fixture items under Garage Reset without a provenance field. The project board/library cannot distinguish these from real results.

Why it matters: Static estimates can become apparently ordinary user project data after the demo, violating the requirement that fake/demo data not leak into production records unlabelled. This is not a silent fallback on AI failure.

How to reproduce/exploit: Entry: Try the demo room → Start clearing 3 items → saved project board/reopen. Results has demo knowledge only from a null result; CleanoutProject and its JSON discard that knowledge.

Evidence: Widget diagnostic saves Vintage film camera from the demo, loads the project and verifies the resulting board has no DEMO label.

Recommended fix: Either keep demo projects ephemeral or persist a demo flag and display it consistently in the library and board.

Confidence: High

### [CC-07] Reopened projects cannot resume correction or marketplace research
Severity: P1

Area: Core saved-project flow

Files/lines: `lib/main.dart:438–445,1881–1905,2761–2908`

What happens: The saved library opens ProjectBoardScreen, whose item controls change clearing status but do not open the result detail/research/correction surface.

Why it matters: Users who save and return lose access to the core identify → verify → research workflow for their saved items even though those fields remain persisted.

How to reproduce/exploit: Entry: save a real scan, return home, reopen it. Library pushes ProjectBoardScreen; inspect/tap its item controls. There is no route back into result details for these saved objects.

Evidence: Widget diagnostic constructs the reopened board and finds neither Sold results nor I need to correct this item. Full board source shows status-only controls rather than an item-details navigation handler.

Recommended fix: Reuse the existing detail/correction surface from saved project items, persisting changes through the existing store. No new project architecture or cloud sync is needed.

Confidence: High

### [CC-08] Malformed model output can leak user-derived text into logs
Severity: P1

Area: Privacy / error handling

Files/lines: `worker/src/worker.js:303–308; server/src/openai-analyzer.js:53–55; server/src/app.js:37–40`

What happens: JSON.parse errors are logged with their raw error.message. Modern JS errors include a prefix of the invalid input.

Why it matters: A malformed provider response containing photo-derived/private text can place that content into Worker/server logs despite sanitized alert/client responses. Scope is operator logs, not a demonstrated public leak.

How to reproduce/exploit: Entry: successful provider HTTP response whose text is PRIVATE-AUDIT... rather than JSON. JSON.parse throws; catch logs the exception message.

Evidence: Injected Node probe intercepted console.error and observed scan_failed Unexpected token plus the synthetic PRIVATE-AU prefix. No real user content was used.

Recommended fix: Log a fixed failure code and safe provider status only; never log raw parse/provider exception messages. Apply the same rule to the legacy server; retain coarse failure diagnostics.

Confidence: High

### [CC-09] Legacy Express service would expose an unmetered paid endpoint if deployed
Severity: P1

Area: Alternate backend / deployment

Files/lines: `server/src/index.js:5–10; server/src/app.js:11–14,26–31; server/src/openai-analyzer.js:29–50`

What happens: With OPENAI_API_KEY configured, the server binds 0.0.0.0 and sends scan requests to OpenAI without consent, authentication, quotas or budget reservation; its default CORS reflects arbitrary origins.

Why it matters: This is a conditional deployment hazard, NOT evidence that the production Worker is bypassable or that this service is publicly deployed. Publishing this supported repository backend with a paid key would create uncontrolled request-count exposure.

How to reproduce/exploit: Entry: POST /v1/scans to the Express server with a permitted image part and no consent/access headers. Route calls analyzer directly. Probe uses only an injected analyzer, not OpenAI.

Evidence: Local Express probe returned 200, analyzer calls=1, Access-Control-Allow-Origin=https://attacker.invalid without consent/auth/device headers. index.js connects this route to createOpenAiAnalyzer and listens on all interfaces.

Recommended fix: Keep this service explicitly local-only/disabled in release instructions, or apply the same consent/access/quota controls before any network deployment. Do not deploy it with a paid key as-is.

Confidence: High

### [CC-10] Serial-number exclusion is a prompt promise, not enforced across output fields
Severity: P2

Area: AI privacy

Files/lines: `worker/src/worker.js:60,973–986; lib/services/scan_api.dart:136–149; lib/services/project_store.dart:59–73; README.md:16,55`

What happens: A serialNumber key is excluded, but synthetic serial content survives inside exactName, model and searchQuery. It can be persisted in the item name/query or sent to a marketplace by a user link click.

Why it matters: The absolute no-return/no-persistence claim is stronger than the implemented control. A real model leak was not measured.

How to reproduce/exploit: Inject identity JSON with a synthetic serial in allowed text fields and serialDetected=true. Inspect returned values.

Evidence: Node probe confirms serial content survives allowed fields. Model prompt asks it not to do so, but validator only truncates those strings.

Recommended fix: Minimize/redact returned identity text where reliably possible; prominently advise cropping serials; qualify privacy copy rather than promising a guarantee a prompt cannot enforce.

Confidence: High

### [CC-11] Timeouts do not cover complete response consumption or upstream work
Severity: P2

Area: Networking / reliability

Files/lines: `lib/services/scan_api.dart:61–64,105–108; worker/src/worker.js:280–297; server/src/openai-analyzer.js:38–50`

What happens: Client timeout covers send until headers, not stream.bytesToString. Provider fetch has no AbortSignal deadline.

Why it matters: A stalled body can leave analysis waiting; client abandonment does not establish upstream cancellation. Manual retry can start another metered request. No automatic infinite retry loop was found.

How to reproduce/exploit: Inspect send().timeout followed by unbounded stream read, or use a response that sends headers then never finishes its body.

Evidence: Source trace plus captured provider request shows no AbortSignal. An actual stalled-stream runtime test was not completed.

Recommended fix: Apply one end-to-end client deadline, abort/close work on cancellation and add a bounded upstream deadline. Avoid automatic retries without idempotency.

Confidence: Medium

### [CC-12] Valid empty scenes are treated as provider failures
Severity: P2

Area: Zero results / quota

Files/lines: `worker/src/worker.js:936–938; server/src/app.js:71; lib/services/scan_api.dart:160–165`

What happens: A structured response containing sceneSummary and items=[] becomes 502 rather than a successful zero-findings result.

Why it matters: An empty shelf or unidentifiable scene consumes an analysis and encourages retry instead of explaining that no candidates were found.

How to reproduce/exploit: Return valid empty-item JSON from the injected provider.

Evidence: Node probe receives 502; client also explicitly rejects an empty items list.

Recommended fix: Allow a validated empty result and show a no-items message with useful photo guidance.

Confidence: High

### [CC-13] Missing identity name consumes quota before validation
Severity: P2

Area: Input validation / allowance

Files/lines: `worker/src/worker.js:248–271`

What happens: Budget and anonymous/invite allowance are reserved before itemName is checked on the identity endpoint.

Why it matters: A malformed request that never reaches AI still consumes scarce allowance/shared capacity. Attacker can cause denial of capacity without waiting for a provider call, though CC-02 already permits capacity exhaustion.

How to reproduce/exploit: Send a consented permitted image to /v1/items/identify without itemName.

Evidence: Probe returns 400 but storage contains budget=10000 and one anonymous use.

Recommended fix: Validate all request fields before reserving budget. Keep reservations for requests actually attempted upstream.

Confidence: High

### [CC-14] Incident revocation instructions do not revoke registered access
Severity: P2

Area: Operations / authorization

Files/lines: `worker/src/worker.js:351–362,625–644; docs/WORKER_BETA_OPERATIONS.md:83–89`

What happens: The incident procedure removes static hashes, but registered invite/device hashes remain independently authorized in Durable Object storage.

Why it matters: An operator following the documented incident response cannot revoke an approved leaked token this way. This is not a bypass of quotas or evidence of a leaked token.

How to reproduce/exploit: Register a hash, ensure it is absent from the static list while another static hash keeps access configured, then authenticate with the registered token.

Evidence: Node probe confirms authorization persists outside the static allow-list.

Recommended fix: Document and provide a narrowly scoped registered-hash revocation operation; verify revoked credentials stop working without deleting all beta state.

Confidence: High

### [CC-15] Anonymous telemetry can be spammed without quota
Severity: P2

Area: Observability / abuse

Files/lines: `worker/src/worker.js:219–226,356–362,826–848; docs/WORKER_BETA_OPERATIONS.md:93`

What happens: Arbitrary valid device tokens can send unlimited schema-valid telemetry independently of AI reservations.

Why it matters: Attackers can pollute funnel/crash metrics and create logging load. This does not call AI, and no logging bill was measured. The runbook incorrectly describes invite-only telemetry.

How to reproduce/exploit: Send repeated allowed event JSON with an invented device token.

Evidence: Probe accepted 25 events with no quota keys stored. Extra fields remain correctly rejected by existing tests.

Recommended fix: Apply a small independent server-side event rate limit and accurately document anonymous telemetry; preserve the closed schema.

Confidence: High

### [CC-16] Android release artifacts use debug signing
Severity: P2

Area: Android distribution

Files/lines: `android/app/build.gradle.kts:28–33`

What happens: The release variant explicitly selects the debug signing configuration.

Why it matters: Acceptable for a consciously temporary sideload experiment, not a production signing/update identity or store release. It does not mean Dart release code is compiled in debug mode.

How to reproduce/exploit: Build release APK and inspect the Gradle signing configuration.

Evidence: Explicit signingConfig = signingConfigs.getByName("debug").

Recommended fix: Create a protected release keystore/signing setup before Android distribution beyond temporary internal testing. Web-only invited beta need not wait on an Android store launch.

Confidence: High

### [CC-17] Android image-picker process-death recovery is absent
Severity: P2

Area: Android lifecycle

Files/lines: `lib/main.dart:792–810,1957–1968`

What happens: Camera/gallery calls await pickImage directly; there is no retrieveLostData startup recovery path.

Why it matters: Android may kill the app activity while the external picker is open; a returning photo can be lost. This was reviewed statically, not reproduced on a device.

How to reproduce/exploit: On Android under memory pressure, launch picker and destroy/recreate the activity before selecting the image; compare with image_picker recovery guidance.

Evidence: Both picker call paths inspected; no retrieveLostData reference in lib/main.dart.

Recommended fix: Handle lost picker data at startup and restore a safe consented continuation; verify with Android lifecycle testing.

Confidence: Medium

### [CC-18] Worker development dependency includes a known libheif vulnerability
Severity: P2

Area: Dependencies / local tooling

Files/lines: `worker/package.json; worker/package-lock.json (sharp → miniflare → wrangler)`

What happens: npm audit reports sharp <0.35.4 affected by GHSA-rgj7-g3m4-5g8c, propagated through miniflare and wrangler.

Why it matters: The advisory is relevant to native image processing in development tooling. It is not proof of a remotely exploitable deployed Worker: the Worker forwards images and does not import sharp.

How to reproduce/exploit: Run npm audit --json --prefix worker and inspect dependency paths.

Evidence: Current audit: three high-severity package entries for one advisory chain; server audit: zero. Advisory: https://github.com/advisories/GHSA-rgj7-g3m4-5g8c .

Recommended fix: Update the affected dev-tool chain to a verified nonaffected version and rerun tests/dry-run; do not expose local image-processing tooling to untrusted inputs meanwhile. No broad upgrade recommendation.

Confidence: High

### [CC-19] Worker parses whole multipart bodies before enforcing image size/type
Severity: P2

Area: Request resource limits

Files/lines: `worker/src/worker.js:231–245`

What happens: request.formData materializes the body before checking image.size. It checks declared MIME but not image signatures; extra form data is not bounded by the image check.

Why it matters: 8 MB is a per-file post-parse limit, not a total request memory limit. Malformed bytes can consume provider attempts; large fields rely on Cloudflare platform ceilings. No platform memory exhaustion was attempted.

How to reproduce/exploit: Send text bytes declared image/jpeg with a malicious filename; add large unrelated fields to inspect the parsing order.

Evidence: Node probe confirms fake JPEG/malicious filename accepted. Filename is not used as a disk path; no traversal execution occurred. The oversized-total-body concern is source-traced, not load-tested.

Recommended fix: Bound total request size before or during parsing where practical, constrain accepted fields, verify supported image signatures before quota/provider invocation. Retain platform limits.

Confidence: High

### [CC-20] Current documentation contains obsolete launch-gate claims
Severity: P3

Area: Documentation

Files/lines: `README.md:95–106; docs/WORKER_BETA_OPERATIONS.md:93`

What happens: README still lists already-present evidence links, label photos and API protection among future gates; telemetry text is out of sync with anonymous-device behavior.

Why it matters: Operators need one accurate launch checklist, not contradictory claims about what exists. Security/functional consequences are covered separately above.

How to reproduce/exploit: Compare the listed gates with current Worker, marketplace and label-photo implementations.

Evidence: Direct README/runbook source comparison.

Recommended fix: Reconcile current-state claims after the actual fixes; preserve historical plans as historical rather than rewriting the app.

Confidence: High

# ATTACKS I ATTEMPTED

All active attacks used local mocks/injected analyzers, not the deployed provider or user data.

| Attempt | Observed result / limit |
|---|---|
| Invent/rotate device IDs; call outside app without Origin | Fresh trial allowance works; shared global reservations still cap accepted calls (CC-01/02). |
| Parallel calls and owner allowance bypass | Serialized storage mock admitted exactly 50/60 under configured ceiling. Existing tests verify owner bypasses invite allowance but not daily capacity. No deployed race exploit demonstrated. |
| Missing/invalid invite, missing quota binding, malformed limits | Existing Worker tests show fail-closed behavior. Anonymous syntactically valid tokens are a distinct intentional path, not validated invites. |
| Replay approval URLs / inspect approval status | Existing tests cover one-time POST approval, expiry, nonapproving GET previews and private status tokens. Guessable request IDs alone do not authorize status or approval. |
| Registered access revocation via static list removal | Still authorized: independent durable registration (CC-14). |
| Arbitrary browser Origin | Worker denies unapproved browser origin; Express defaults to reflecting it. CORS is not authentication and native/script callers omit Origin. |
| Missing consent, malformed multipart, missing/oversized image | Worker enforces consent and per-image checks before provider calls; whole-body parsing and MIME spoof limitations remain (CC-19). |
| Fake image MIME / malicious filename | Fake JPEG-labelled bytes pass Worker. Filename never becomes a filesystem path; no path traversal shown. |
| Missing identify name | 400 after quota reservation (CC-13). |
| Malformed/empty AI JSON and zero results | Generic errors to clients; malformed text leaks into logs; valid empty scenes rejected (CC-08/12). |
| Duplicate IDs / extreme numbers / NaN correction | Reproduced data coupling, numeric overflow and real widget render failure (CC-03/05). |
| Synthetic serial content in allowed model fields | Survives schema filtering (CC-10); no real-image prompt injection/model jailbreak test or serial exposure measured. |
| Prompt injection / malicious marketplace query | Provider cannot execute tools or code; model text is rendered as text and links have fixed HTTPS hosts. Semantic manipulation of identity/price remains possible; no model accuracy guarantee asserted. |
| Anonymous telemetry flood / arbitrary metadata | 25 allowed events accepted without quota; unknown metadata is rejected by tests (CC-15). |
| Save demo / reopen projects / corrected research | Widget diagnostics prove provenance loss, status-only reopening and stale research (CC-04/06/07). |
| Other-user project ID / deletion | No backend project lookup or cloud project database exists. Local store namespace and delete behavior reviewed/tested; a project ID is not a remote access capability. Same browser/OS profile is not a multi-user security boundary. |
| Legacy API without auth/consent | Local injected-analyzer request succeeds (CC-09); no public deployment exploit attempted. |

# VERIFIED SAFE

These are bounded local-code/test conclusions, not blanket production certification.

- **Provider keys stay server-side in the inspected design.** Flutter uses a configured API URL and user access tokens, not a Gemini/OpenAI key. Secrets are not printed in this report. Artifact/secret scan results are recorded in final verification below.
- **Worker quota fails closed** when the Durable Object binding or required access/limit/provider configuration is missing. Reservation precedes the AI call; owner exemption does not bypass the global counter. Atomic storage transactions are used, not a client-only counter.
- **Admin and approval boundaries exist.** Admin invite generation requires a separate key; approval uses high-entropy hashed tokens, a confirmation GET followed by one-time POST, expiry and private status proof. Generated HTML is escaped and has no-store, restrictive CSP and no-referrer headers. No approval IDOR was demonstrated.
- **AI failure does not silently substitute demo results.** Live errors are honest; demo is an explicit action and initially labelled. CC-06 identifies the later persistence exception.
- **Marketplace research is not fabricated listing evidence.** Fixed `Uri.https` hosts and encoded query parameters prevent model-controlled open redirects/javascript URLs. Active and completed-sale links are distinct; copy explains asking prices versus evidence and potential ranges versus appraisals. Model confidence is qualitative, not a measured accuracy probability.
- **No cloud project database or image archive is implemented.** Project data are local SharedPreferences records; project IDs do not expose another user’s cloud data. Project JSON omits image bytes. Delete removes the local project key, and existing store/library tests exercise reopen/delete. This does not erase original gallery photos, backups, or provider-retained data.
- **Images are handled in memory by the backends.** No image filename is used to write a server file. Worker responses disable caching; provider retention is a separate policy issue disclosed in staged-photo consent.
- **Client image MIME is derived from supported signatures** for JPEG/PNG/WebP rather than blindly setting JPEG; unsupported bytes are rejected before upload by client tests. Real HEIC conversion/camera behavior remains device-dependent and unverified here.
- **Telemetry payloads are closed and coarse.** Extra keys/raw errors are rejected; client delivery is best-effort. Operational alert payloads are sanitized even though raw exception logging separately fails CC-08.
- **Android main manifest declares INTERNET without broad storage permissions or explicit cleartext allowance.** The exported launcher activity is normal. This is source inspection, not a claim about all merged APK flags or on-device behavior.
- **No automatic unbounded AI retry loop was found.** Each new analysis reaches quota reservation; failure/retry may consume additional allowances intentionally. Same-token replay is not deduplicated, but remains quota-bounded.

# COVERAGE, LIMITS, AND REMAINING RELEASE CHECKS

Reviewed Flutter domain/parsers/storage and major result/correction/project UI paths; Worker routes, AI schema/validation, durable quota/access/approval storage and alerting; Express/OpenAI alternate backend; Android manifest/Gradle; web entry/base path; repository operations/privacy/deployment instructions; dependency manifests/locks and test surfaces.

Existing tests cover domain ranking/progress, marketplace URLs, ordinary corrections, local save/load/library deletion, upload MIME/parser rejection, explicit demo/live transitions, beta access/status and telemetry, Worker invite/approval/quota behavior. They did not prevent the diagnostic failures in this report. Add focused regression tests only when authorized to fix them.

Not verified in this audit: physical Android install/launch, camera/gallery permissions or HEIC plugin conversions, process-death/resume, mobile embedded-browser research clicks, responsive layouts in real browsers, browser console/runtime errors, deployed refresh/deep links/cache behavior, actual Cloudflare Durable Object races, deployed secrets/budget configuration, provider billing enforcement, live AI quality/latency/accuracy or image prompt injection, Discord delivery and operator retention controls. A web server alone is not browser QA. No production deployment was made. Flutter dependency vulnerability coverage is not equivalent to a complete advisory scan; newer package versions alone are not findings.

Unsaved result state is in-memory and not guaranteed to survive browser refresh/back navigation; local saved records are the persistence boundary. Local storage can be cleared or exhausted; no cross-device sync or encrypted account separation is promised. Huge-project/storage-quota failure and partial-write behavior were source-reviewed but not fault-injected, so no data-loss guarantee is made. Approved/anonymous hash and daily-counter retention should be checked operationally; time-window checks are not proof of physical deletion of every old record. No remote IDOR/SQL injection surface was found in a nonexistent project database.

# LAUNCH VERDICT

⚠️ READY AFTER P0/P1 FIXES

Minimum work to reach invited beta: substantiate the cost reservation with enforced request bounds; prevent a single anonymous caller from consuming all invited capacity; fix numeric validation, item ID uniqueness, stale correction queries, demo provenance and saved-item research/correction access; remove content-bearing exception logs. Keep the legacy Express service unavailable publicly unless equivalently protected. Retest these exact diagnostic cases plus the permanent suites. Confirm the deployed Worker matches the tested build/configuration and exercise a controlled provider request/alert only with operator authorization. Complete one real target-device/browser scan → correction → research → save/reopen/delete smoke, including failure/retry. Android debug signing must be resolved before non-temporary Android distribution; a web-only invited beta can defer Android release work. No account migration, microservices, billing features or expanded MVP scope is needed.

## Final execution and cleanup verification

- `flutter test --reporter expanded` (temporary diagnostic removed): **45 passed**, exit 0.
- `flutter analyze`: **No issues found**, exit 0.
- `flutter build web --release --base-href /cluttercash/ --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev`: **built build/web**, exit 0; Wasm dry run succeeded. This is a compilation result, not browser-runtime verification.
- `flutter build apk --release --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev`: **built release APK**, exit 0. Artifact exists at `build/app/outputs/flutter-apk/app-release.apk`; 51,296,238 bytes. Still debug-signed as noted in CC-16; not installed/launched in this audit.
- `build/web/main.dart.js`: 2,717,649 bytes; SHA-256 `f4a312ddb0a378d56f9a78f3d57ab64045473ba39c010dbaa02d0560c97eedbe`.
- Release APK SHA-256: `3d899b7d9707c91fce785865d4e95fd59b32e4caae93396fb598031214d9b060`.
- Exact-value comparison of available local secret values against tracked files, web JavaScript and decompressed APK entries: **no matches**. Values were not emitted. This is bounded exact-match scanning, not proof against every possible unknown/encoded/historical credential.
- Diagnostic Dart source and logs retained outside the repo. `test/audit_temporary_test.dart` is absent. Existing interrupted audit server `proc_cf722c559d42` (PID 14728) was read back through its exact process handle: **already exited, killed by agent_close, exit -15**. No unrelated process was stopped. The verification runner completed with exit 0.
- Final Git status before handoff: **only `?? FINAL_AUDIT.md`**. Tracked diff empty; baseline HEAD unchanged. No production source/configuration, dependency lockfiles or permanent tests were modified. Generated ignored web/APK artifacts were rebuilt; nothing deployed.
- Full rerun logs: `C:/Users/Sgrab/AppData/Local/Temp/cluttercash-final-audit/{flutter-tests,flutter-analyze,web-build,apk-build,worker-tests,server-tests,worker-audit,server-audit,node-probes,flutter-diagnostics}.log`; structured summaries in `results.json` and `build-results.json`.
