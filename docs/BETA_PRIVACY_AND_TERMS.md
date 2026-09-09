# ClutterCash Free Invited Beta — Privacy Notice & Terms

**Effective date:** September 9, 2026
**Support and feedback:** [cluttercash.help@gmail.com](mailto:cluttercash.help@gmail.com)

> This plain-language notice applies to the free, invite-only ClutterCash beta. It is not the policy for a future paid or store release.

## What ClutterCash does

ClutterCash helps a person photograph a cluttered space, identify visible items that may be worth selling, and research a **potential selling-price range**. A model-label photo can improve an uncertain identification.

ClutterCash is not an appraisal, authentication service, marketplace, financial advisor, transaction tracker, or guarantee of what an item will sell for. AI results and marketplace-search links are starting points for your own verification. You are responsible for confirming model, condition, accessories, legality, pricing, and marketplace rules before listing or selling anything.

## Free invited beta

- The beta is free. There is no subscription, scan pack, payment, or in-app purchase in this beta.
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

### Limited operational data

The Worker hashes the revocable invite code sent by the app and compares the hash with an operator-managed allow-list. A Cloudflare Durable Object stores that invite hash with accepted-request timestamps for the rolling seven-day limit, plus UTC-day reserved-cost totals and whether the daily ceiling alert was sent. It does not store the plaintext invite code, photo, prompt, provider response, project contents, item identity, or correction details.

An invited build also sends a minimal, allow-listed event name when a scan starts, succeeds, or fails; a local project is created or reopened; an item is corrected or its status changes; or the app reports an unhandled framework/async error. Scan failures and app errors use only a coarse category such as `api`, `unknown`, `framework`, or `async`. The telemetry payload contains no photo, item/project name, value, invite code/hash, raw error text, stack trace, device identifier, account identifier, or arbitrary metadata. Accepted events are written to ClutterCash's Cloudflare Worker logs on a best-effort basis and are intended only for beta reliability/funnel review. Cloudflare and network providers may process standard connection data under their own policies. There is no third-party product-analytics SDK, ad tracker, user profile, session replay, or cloud crash-reporting SDK in this beta.

Sanitized operational alerts separately contain only a stable provider-failure event name and HTTP status, or a daily-budget-reached event.

## Retention and deletion

- **Local projects:** Open **Saved projects** in ClutterCash to delete one project or delete all saved projects. This deletes that local app data from the current device/browser profile and cannot be undone.
- **App/browser data:** You can also remove local data by uninstalling the app or clearing this site's/app's storage. Device backups may retain data under your device or browser provider's own settings.
- **Uploaded images:** ClutterCash does not provide a cloud gallery or account-based image deletion tool because it does not intentionally store your uploaded image on its Worker. Google Gemini's handling is governed by Google's policies; ClutterCash cannot delete data held by Google.
- **Invite quota data:** Invite hashes and accepted-request timestamps exist to enforce the rolling seven-day beta limit; daily reserved-cost counters and their alert marker are grouped by UTC date. ClutterCash does not use them as an account or activity profile.
- **Beta diagnostic events:** Allow-listed event names remain subject to the Cloudflare account's configured log availability/retention. They cannot be deleted through the local project controls because they contain no project record or account identifier. The operator should use the shortest practical Cloudflare log retention for the beta and must not export raw logs into a long-term user profile.
- **Help:** If you need help deleting local data or have a privacy question, email [cluttercash.help@gmail.com](mailto:cluttercash.help@gmail.com). Do not email sensitive photos, serial numbers, passwords, account information, or payment details.

## Marketplace research

ClutterCash opens user-facing marketplace search pages; it does not post listings for you or claim that it has scraped marketplace data. Active listings are asking prices, not proof of value. Completed-sale results can be useful evidence but still require a genuine model/condition/accessory/shipping comparison.

ClutterCash does not create or post listings. Verify every item and price before posting, and follow the rules, fees, taxes, safety guidance, and terms of every marketplace you choose.

## No warranties; limit of beta service

To the extent permitted by law, the beta is provided "as is" and "as available." ClutterCash does not promise that a scan will identify every item, produce an accurate estimate, work continuously, or lead to a sale. Do not rely on it for urgent, safety-critical, legal, financial, insurance, appraisal, or authentication decisions.

## Changes and contact

This notice may be updated as the beta changes. The effective date at the top will change when it is updated. For beta support, feedback, privacy questions, or to report a problem, email [cluttercash.help@gmail.com](mailto:cluttercash.help@gmail.com).
