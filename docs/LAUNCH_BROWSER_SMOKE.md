# Local release browser smoke

Actual local release build served at http://127.0.0.1:8765/cluttercash/ (HTTP readiness 200), phone-sized Chromium viewport 390 × 844. Existing build used unchanged; no rebuild/deploy or production analysis. CDP blocked `*cluttercash-api*` before interactions. Browser evidence is not physical Android evidence.

## Verified in this run

- Startup rendered at phone size; Flutter semantics enabled, screenshots inspected.
- Visible Privacy & beta terms control opened the policy, including OpenAI processing, crop/cover guidance, qualified serial filtering, local saves, and daily address-hash retention disclosure.
- Scan screen → explicitly labelled demo room (not live AI) → item details → correction form.
- Corrected camera to `Verified smoke camera`, low/typical/high 100/150/200 through real inputs; visible detail/range and marketplace query text updated; stale recommendation replaced by qualified local-pickup guidance.
- Saved three selected demo items into Garage Reset. Read back browser local storage: corrected name/range/searchQuery and isDemo=true persisted.
- Full navigation reload → saved library → reopen → research details retained correction and DEMO label in pixels.
- Delete action required explicit confirmation. Confirmed deletion, verified zero project keys, reloaded and reopened library: No saved projects yet.
- Window error/unhandled-rejection listener returned [] before first reload. This is scoped instrumentation, not comprehensive startup or all-navigation console certification.

## Evidence

`docs/launch-browser-evidence/`: 01-phone-startup.png through 09-empty-after-refresh.png (named journey screenshots), saved-project.json (synthetic demo only), smoke-summary.json. Research inspection JSON files are empty and deliberately retained as negative evidence: DOM and shadow-DOM searches found no HTML anchors; trusted pixel clicks produced no intercepted window.open URI. **Exact browser research URI/navigation remains unverified**, despite corrected visible query and persisted query. Do not count the click as success. Widget Link regression coverage is separate evidence.

## Remaining runtime and owner gates

- Follow-up local browser verification exercised the gallery file input, explicit consent, intentionally intercepted network failure and a fresh-photo retry to mocked success; see follow-up below. Camera/physical-device permissions and paid/live provider behavior remain unverified.
- Actual target-device marketplace navigation, Android install/launch, picker process-death and physical-phone interaction remain open.
- CC-16 protected Android release signing is owner-gated (current release selects debug signing).
- Owner approval of proposed $5 daily / $3 anonymous reservation pools, actual provider billing/account controls and deployment authorization remain required. App counters are not universal account billing caps.
- Authorized deployment parity/readback, trusted-edge/Durable Object concurrency, paid/live provider quality and alert delivery remain open. Legacy unlabelled demo provenance cannot be reconstructed.

## Recovered interrupted follow-up evidence

The interrupted follow-up saved actual gallery/consent/failure/reselection evidence, recovered from `deleg_819ead81/task-0.log` and the JSON artifacts rather than inferred from its incomplete report:

- `10-upload-consent.json/png`: generated `synthetic-upload.png` selected through the real browser file input; consent visible and zero intercepted scan requests before acknowledgement.
- `11-network-failure.json/png`: explicit acknowledgement caused one locally intercepted POST (654-byte multipart, consent and image MIME present), intentionally rejected with `LOCAL simulated network failure`. Honest failure screen appeared; demo remained a separate explicit action.
- `12-retry.json/png`: a fresh selection and consent reached the parser, but the initial mock omitted the required contract and produced an honest FormatException. This was a test-fixture error, not successful analysis.
- `15-valid-retry.json/png`: after correcting the local mock contract and another explicit photo selection/consent, the third intercepted request produced `Analysis complete / No items identified`, with no fabricated candidates or project action. This verifies synthetic empty success, not nonempty/provider-quality success or automatic retry.
- Production API was blocked at CDP and replaced locally; no paid/live inference was used. Prior browser context is no longer available on resume, so the historical transport assertions are recovered evidence, not new network instrumentation.
- `14-research-uri.json` records no intercepted opens or marketplace browser targets. Research navigation was NOT completed by that interrupted follow-up.

## Resume: research runtime blocker reproduced

Fresh local browser at 390 × 844, same production-configured artifact and correct `/cluttercash/` base; API origin blocked before app interactions. Opened demo camera details and inspected the rendered research sheet. Trusted physical-coordinate clicks landed on the exact `Sold results` and `Active listings` semantic elements (`isTrusted=true`). CDP target inventories before/after each click show **no new marketplace target**; app URL and sheet remained unchanged. Recursive DOM/open-shadow-root search returned no anchors. Evidence: `16-resume-research.json/png`.

Read-only build diagnosis found a concrete discrepancy: source uses `Link` and `LinkTarget.blank`, but all three `.dart_tool/flutter_build/*/web_plugin_registrant.dart` files omit `UrlLauncherPlugin.registerWith`; `.dart_tool/dartpad/web_plugin_registrant.dart` and `.flutter-plugins-dependencies` include it. The exact served `main.dart.js` has zero `__url_launcher::link` markers and contains the non-web/default delegate error path. See `17-link-registration-diagnostic.json`. This strongly points to stale/incomplete generated release plugin registration, not a malformed marketplace query or an off-screen click. The underlying cache-generation cause is not yet proven.

**This is an unresolved local release artifact/runtime blocker, not merely an untested physical-phone link.** No source/dependency/cache deletion or speculative link workaround was made. Next bounded task: preserve this failing artifact evidence, establish a release plugin-registration regression check, regenerate the build through the normal Flutter toolchain without discarding user edits, and rerun trusted clicks with CDP new-target URI readback. Passing widget Link tests alone cannot close it. No rebuild or full-suite rerun was performed during this evidence-only resume.

## Final local verification and cleanup

- Existing main.dart.js verified: 2,723,758 bytes, SHA-256 `149832225d78334b0711095ff2a83860009638424a4efc57a3aa89de4948300e` (matches latest CC-17 artifact).
- Full Flutter: 77 passed; analyzer: No issues found. Worker: 110 passed / 0 failed. Express final rerun: 36 passed / 0 failed. First Express run had two startup tests exceed the test harness's 1500 ms spawnSync timeout (null exit status versus expected 1); unchanged rerun passed. Retained both logs; no product fix or test timeout relaxation made.
- Worker and Express npm audits: zero known vulnerabilities, both exit 0. Wrangler deploy --dry-run: exit 0; nothing deployed. git diff --check: exit 0.
- Logs: `docs/launch-browser-{flutter,analyze,worker,server,server-rerun,worker-audit,server-audit,dryrun,diff}.log`.
- Nine screenshots counted on disk. Owned temporary server terminated through process manager; socket check confirmed port 8765 closed. Temporary server script remains at `C:/Users/Sgrab/AppData/Local/Temp/cluttercash-smoke-server.py`.

Resume cleanup: owned server `proc_c05ec190b71a` terminated; actual socket check returned Windows 10061 (port 8765 closed). `git diff --check` passed, LF/CRLF notices only. `18-resume-summary.json` records cleanup and artifact existence. The earlier nine-screenshot statement describes the original run only; subsequent evidence is listed in the follow-up/resume sections above. Existing release artifact hash was rechecked unchanged. Prior 77 Flutter / 110 Worker / 36 Express results remain prior verification, not rerun in this evidence-only resume.

No source changes, deploy, commit, paid provider request, signing/account/provider configuration change or Android claim. Existing working-tree changes preserved.

## Resolved local release registration blocker

Flutter 3.44.6 `WebEntrypointTarget` (`packages/flutter_tools/lib/src/build_system/targets/web.dart:48–53,85–88`) runs plugin generation but declares only SDK web.dart as an input and main.dart as an output. Existing web_entrypoint stamps confirmed those same dependencies: changes to plugin metadata did not invalidate this target. DartPad registration was current while cached release registration was stale. Removing **only three disposable web_entrypoint.stamp files**, then running the unchanged production-configured build, regenerated UrlLauncherPlugin registration and restored compiled web Link code. No generated registrant was edited, SDK/source dependency upgraded, or broad cache/source deletion performed. Historical origin of the initial stale entrypoints was not reconstructed; the invalidation defect and minimal recovery are directly evidenced.

- RED artifact check `python tool/check_web_links.py`: exit 1, no compiled web-link marker, no registered launcher (19-registration-red.json). Saved original stamp contents in 20-invalidated-stamps.json; prior broken hash/evidence 16–18 retained.
- GREEN normal release build: exit 0; guard exit 0 (21-registration-green.json). New durable `bash tool/build_web_release.sh` invalidates only these stamps, builds with the existing production API URL and /cluttercash/ base, and runs the artifact guard. Executed wrapper again: exit 0, identical SHA-256. This is a local build workaround for SDK target invalidation, not an app Link-source fix. Use this wrapper for release builds; the post-build guard alone does not prove runtime navigation.
- Fresh local 390 × 844 Chromium, API blocked before interactions, /cluttercash/ served HTTP 200, semantics enabled: trusted Sold and Active clicks each created a CDP page target with the exact expected original query (22-trusted-navigation.json).
- Corrected demo identity to `Verified smoke camera & lens`, range 100/150/200; saved, read actual project storage, fully reloaded, reopened saved library/project and research. Both trusted links created exact targets with `_nkw=Verified+smoke+camera+%26+lens`; Sold also preserved `&LH_Complete=1&LH_Sold=1`. Evidence 23-corrected-save.json and 24-saved-trusted-navigation.json/png. Four observed link clicks are isTrusted=true. eBay returned an Error Page for some navigations: exact outbound navigation is verified, marketplace content availability/results are NOT certified.
- Full Flutter 77 passed; analyzer No issues found; two production-configured builds passed; git diff --check passed. Logs docs/launch-link-{build,repeat-build,flutter,analyze,diff}.log. Artifact main.dart.js: 2,746,687 bytes, SHA-256 `5342b57dfc733de06fa7c380e656156226a3ec3af6359fd0440db4c32cb0399c`.
- Owned server proc_a2dc98908e77 stopped; final socket closure evidence in 25-final-summary.json. Synthetic saved project retained only in the isolated local smoke browser. No deploy, commit, paid/live AI, model/provider/account/Hermes or signing changes. Existing user source diffs preserved. Physical-device/in-app-browser behavior, Android signing/lifecycle, $5/$3 owner approval, provider-account controls, deployment parity and live/edge/alert gates remain unresolved.
