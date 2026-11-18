# Unit 12  -  Agent ownership verification

Status: implemented and locally validated; ready for review. The user requested the next unit after wallet settings with “What’s next?” on September 12.

## Contract audit

The old verification POST ignores the registration claim token, accepts any syntactically matching X URL, then immediately sets `isVerified` and increases reputation without reading the post. Its UI reports success for any 200 response and loses the form on failure. The status endpoint has no rate limit. Existing verification flags affect matching and other workflows, so unverified submissions must not grant the flag.

## Direction and sequence

1. Keep the existing X-post ownership method, but require the exact agent's API key or valid scoped claim token. A key entered through the page uses the existing PIN gate; claim links authorize only this verification flow.
2. Return public recorded status separately from authorized instructions. Generate an agent-specific public verification code without exposing an API key or claim token. Add a 30-day claim expiry for new links and use creation time for older links. Expired/missing links can use owner access instead.
3. Read the submitted post through the official X API. Verify post ID, actual author, configured owner handle when present, and the exact verification code. Fail closed for missing credentials, unavailable/private/deleted posts, wrong authors or wrong content. Never post to X automatically.
4. Make success atomic and idempotent, preserve reputation, reject changed author/identity/challenge data and record proof metadata. Existing verification flags are not retroactively audited or revoked. Later edits to a newly verified X handle must invalidate that new proof.
5. Build an original focused app page: identity/status, selectable post text with copy recovery, deliberate Open X link, labeled post URL field and exact review. Preserve entered URL on errors; recheck status after uncertain writes before offering a retry. Keep both themes, element entrances, small-screen fit and reduced motion.
6. Validate input/authentication/post-content/atomic-write boundaries and browser states using intercepted responses. No real post, X account, verification flag or reputation mutation during QA. Stop before Unit 13 (agent recovery).

## References

- Supplied design guide and the approved app tokens/typography; coss field patterns: https://coss.com/ui/docs/components/field . Continue the frontend-design-guidelines and design-taste review.
- X post lookup and author expansions: https://docs.x.com/x-api/posts/lookup/quickstart . Use server-only bearer credentials or the existing OAuth 1.0a credentials. The lookup host is fixed; never fetch the user-supplied URL.
- Existing source contracts: `app/api/agents/verify/route.ts`, `verify-claim/route.ts`, registration, owner access, and `lib/x-api.ts`. The posting client remains outside this read-only proof lookup.

## Limits

Claim-link possession is a scoped credential, not proof of an X identity. Actual post matching is still required. A saved historical `isVerified` flag is displayed as recorded; this unit does not recheck the existing database. Live X permissions, production database behavior and owner credentials require separate validation.


## Implemented behavior

- Original app composition with identity, recorded status, selectable post text, copy feedback, X intent link, labeled post URL and review dialog. No automatic X post is sent. Light/dark themes, narrow layouts and short GSAP element entrances use the approved system.
- Public status omits private instructions. Claim tokens travel in a dedicated header, stay in memory and are removed from the browser URL. Refreshing a cleaned claim URL requires the original link or owner key/PIN. Metadata and requests use no-referrer behavior.
- New claim links expire after 30 days; older links use the registration creation date. Invalid or expired claims can use the exact agent's API key and PIN instead. A wrong key cannot start another agent's PIN setup.
- Submission checks the trusted X API response's post ID, author ID, author username, expected handle and exact code line. Reposts, unavailable author data and unrelated text fail. The server fetches only the fixed official API host, with a timeout and redirects rejected.
- Success compares the prior name, owner handle and authorization/challenge hashes; an already saved verified state makes retries idempotent. No reputation value is increased by this endpoint. Secondary activity-log failure does not turn a completed verification into a failed result.
- A changed handle clears proof created by this flow. Concurrent owner-profile edits compare prior proof data to avoid retaining stale verification. Existing manually or historically verified records are not migrated or re-audited.
- Rejected or uncertain submissions keep the post link and a non-secret receipt. A fresh status read resolves saved results. Unverified results offer deliberate edit/retry; malformed or wrong-agent 200 responses do not grant success in the UI.

## Local service configuration

A presence-only environment check on September 12 found no configured X lookup credential set. Real verification therefore remains unavailable locally. Configure either `X_BEARER_TOKEN` with post-lookup access or all four existing OAuth variables (`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`) with sufficient read access. No secret values were printed, copied into frontend code or requested in chat. Credentials alone do not prove live API access; provider permissions and service availability still need validation.

## Validation and evidence

- Final production build, TypeScript, scoped lint and `git diff --check` passed after the invalid-field accessibility update.
- 163 regression tests passed, including 15 verification tests and two additional wallet/profile tests for handle changes. Coverage includes key/claim authorization, expiry, post URL boundaries, private instructions, actual author/code checks, atomic success, repeated requests, service failures and OAuth query signing.
- Final browser run: 49/49 checks passed with four intercepted verification writes. Both themes fit 320/375/390/600/760/768/1024/1100/1280/1440px. Checks also cover claim cleanup/expiry, wrong keys, copy failure, malformed URLs/responses, error/reload recovery, unavailable service, invalid owner handle, long names, enlarged text, missing agents and motion.
- Repeatable tests: `tests/verification-redesign.test.mjs`, `scripts/redesign/check-verify.mjs`. Browser results: `/private/tmp/hive-redesign-qa/verify-results.json`. Screenshots: `verify-{light,dark}-{320,1440}.png`, `verify-review-dark-320.png`, `verify-success-dark-320.png`.
- All verification writes and browser data used intercepted fixtures. No real X post was published/read, no real listing was verified and no reputation or account mutation was performed. A real malformed-ID status read returned 400.

## Review

Open http://localhost:3100/agent/dashboard → Settings → Verify ownership, or use the scoped claim link from registration. The actual local page shows the unavailable-service state until X credentials are configured; the screenshots document the full ready/review/result design.

Work remains local and unpushed on `main_redesign`. Stop for review before Unit 13 (agent recovery). Existing flags are displayed as recorded; this work does not establish that historical verifications passed the new proof checks. Physical mobile devices, real X provider access and production database persistence remain outside local test evidence.
