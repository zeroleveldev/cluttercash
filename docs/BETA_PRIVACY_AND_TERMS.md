# ClutterCash Free Beta — Privacy Notice & Terms

**Effective date:** September 10, 2026
**Support and feedback:** [cluttercash.help@gmail.com](mailto:cluttercash.help@gmail.com)

> This plain-language notice applies to the free ClutterCash beta: three no-registration analyses per browser/device, followed by optional manually approved continued access on that same browser/device. It is not the policy for a future paid or store release.

## What ClutterCash does

ClutterCash helps a person photograph a cluttered space, identify visible items that may be worth selling, and research a **potential selling-price range**. A model-label photo can improve an uncertain identification.

ClutterCash is not an appraisal, authentication service, marketplace, financial advisor, transaction tracker, or guarantee of what an item will sell for. AI results and marketplace-search links are starting points for your own verification. You are responsible for confirming model, condition, accessories, legality, pricing, and marketplace rules before listing or selling anything.

## Free beta access

- The beta is free. A browser/device may run three live analyses without creating an account, registering, or entering an invite code.
- The app creates a random 32-byte token and saves it in local app/browser storage solely to enforce that three-use allowance. The Worker receives and hashes the token; its Durable Object stores only the hash and total accepted-use count. Clearing site storage can replace the local token, so a separate global daily cost ceiling remains in place as an abuse backstop.
- After the three free analyses, a person may request optional continued beta access. The operator manually reviews the request from a private Discord alert. Approval activates a separate rolling allowance for the browser/device that submitted the request; no access code or email delivery is required. Existing manually issued invite codes remain supported.
- There is no subscription, scan pack, payment, or in-app purchase in this beta.
- The service is experimental and may change, be limited, or end without notice.
- Only use it if you are at least 18 and have permission to photograph the space and items.
- Do not upload illegal content or photos that put another person's privacy or safety at risk.

## What data is handled

### Photos sent for live AI analysis

When you choose a photo for a live scan or a model-label refinement and tap **I understand**, the app sends the image to ClutterCash's Cloudflare Worker and then to Google Gemini for analysis.

- The Worker accepts JPEG, PNG, and WebP images up to 8 MB.
- The Worker processes image bytes in memory and is designed not to write the image to disk. Its API responses use `Cache-Control: no-store`.
- Google Gemini is the AI processor for this beta. Google may review free-tier submissions and use them to improve its products. Review Google's applicable terms and privacy information before using live analysis.
- The app asks Gemini not to return or save unique serial numbers. If a serial number is visible in a label photo, the app only receives whether one was detected.
- Never upload faces, mail, addresses, keys, medication, documents, account information, or other sensitive/private content. Photograph a staged, non-sensitive area instead.

### Data stored on your device

ClutterCash has no user accounts and no cloud project sync in this beta. The app stores your projects locally on the device/browser profile you use, including scan results, item corrections, and item statuses.

### Beta access requests

If you request beta access in the app, ClutterCash sends the email address you enter, plus an optional first name and device/browser description, through the Cloudflare Worker to the operator's private Discord webhook. This information is used only to review the request. Do not enter sensitive information. The plaintext contact fields are not stored in the Worker's Durable Object. Pending state contains one-way hashes of the requesting browser token, private status token, and owner approval token, plus timestamps. It also stores one-way hashes of the requesting email and network address for anti-spam limits. Pending requests expire after seven days. After approval, the owner approval-token hash is removed; only the browser hash, private status-token hash, approval state, and expiration remain temporarily so the app can display the result. Discord and Cloudflare process the request under their own policies.

### Limited operational data

The Worker hashes each no-registration device token and revocable invite code. A Cloudflare Durable Object stores the device-token hash with a total accepted-use count for the three free analyses. When the operator approves an in-app request, that same device-token hash is added to the approved registry and receives the same rolling allowance as an invite-backed tester. For approved invite codes, it stores the invite hash with accepted-request timestamps for the rolling seven-day limit. A separately configured owner-controlled hash may bypass the per-invite rolling allowance for service testing, but it remains subject to the same global daily cost ceiling. The approved registry stores hashes and creation times, not plaintext browser tokens, invite codes, or tester emails. The same Durable Object also stores UTC-day reserved-cost totals and whether the daily ceiling alert was sent. It does not store the plaintext device token, plaintext invite code, photo, prompt, provider response, project contents, item identity, or correction details.

When invite-backed telemetry is configured, the app also sends a minimal, allow-listed event name when a scan starts, succeeds, or fails; a local project is created or reopened; an item is corrected or its status changes; or the app reports an unhandled framework/async error. Scan failures and app errors use only a coarse category such as `api`, `unknown`, `framework`, or `async`. The telemetry payload contains no photo, item/project name, value, invite code/hash, raw error text, stack trace, device identifier, account identifier, or arbitrary metadata. Accepted events are written to ClutterCash's Cloudflare Worker logs on a best-effort basis and are intended only for beta reliability/funnel review. Cloudflare and network providers may process standard connection data under their own policies. There is no third-party product-analytics SDK, ad tracker, user profile, session replay, or cloud crash-reporting SDK in this beta.

Provider and budget operational alerts contain only a stable event name and optional HTTP status. Beta-request alerts contain the submitted contact fields described above and a random, expiring, one-time owner approval link. Opening the link shows a confirmation page; a second deliberate tap is required to activate access. Discord mention parsing is disabled.

## Retention and deletion

- **Local projects:** Open **Saved projects** in ClutterCash to delete one project or delete all saved projects. This deletes that local app data from the current device/browser profile and cannot be undone.
- **App/browser data:** You can also remove local data by uninstalling the app or clearing this site's/app's storage. Device backups may retain data under your device or browser provider's own settings.
- **Uploaded images:** ClutterCash does not provide a cloud gallery or account-based image deletion tool because it does not intentionally store your uploaded image on its Worker. Google Gemini's handling is governed by Google's policies; ClutterCash cannot delete data held by Google.
- **Beta access requests:** The private Discord alert remains subject to the Discord channel's retention until the operator deletes it. Hashed pending request/approval state expires after seven days. After approval, the private hashed in-app status record expires after 30 days. The Worker's one-way anti-spam hashes use a rolling 24-hour window; old timestamps are ignored and replaced when that requester submits again after the window.
- **Free-use token:** The random token stays in local app/browser storage until that storage is cleared. Its Worker-side hash and accepted-use count remain for beta abuse/cost control; they are not linked to an account or submitted email.
- **Approved-access quota data:** Approved device/invite hashes and accepted-request timestamps exist to enforce the rolling seven-day beta limit; daily reserved-cost counters and their alert marker are grouped by UTC date. ClutterCash does not use them as an account or activity profile.
- **Beta diagnostic events:** Allow-listed event names remain subject to the Cloudflare account's configured log availability/retention. They cannot be deleted through the local project controls because they contain no project record or account identifier. The operator should use the shortest practical Cloudflare log retention for the beta and must not export raw logs into a long-term user profile.
- **Help:** If you need help deleting local data or have a privacy question, email [cluttercash.help@gmail.com](mailto:cluttercash.help@gmail.com). Do not email sensitive photos, serial numbers, passwords, account information, or payment details.

## Marketplace research

ClutterCash opens user-facing marketplace search pages; it does not post listings for you or claim that it has scraped marketplace data. Active listings are asking prices, not proof of value. Completed-sale results can be useful evidence but still require a genuine model/condition/accessory/shipping comparison.

ClutterCash does not create or post listings. Verify every item and price before posting, and follow the rules, fees, taxes, safety guidance, and terms of every marketplace you choose.

## No warranties; limit of beta service

To the extent permitted by law, the beta is provided "as is" and "as available." ClutterCash does not promise that a scan will identify every item, produce an accurate estimate, work continuously, or lead to a sale. Do not rely on it for urgent, safety-critical, legal, financial, insurance, appraisal, or authentication decisions.

## Changes and contact

This notice may be updated as the beta changes. The effective date at the top will change when it is updated. For beta support, feedback, privacy questions, or to report a problem, email [cluttercash.help@gmail.com](mailto:cluttercash.help@gmail.com).
