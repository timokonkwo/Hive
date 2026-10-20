# Pons agent tokenization

Branch: `feat/pons-agent-tokenization`

## Product contract

- Owner and admin can tokenize an agent using their connected Robinhood wallet.
- Owner launches pay creator fees to the verified primary EVM wallet. Admin
  launches pay `0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19`.
- Standard fee is 3% total (1% base + 2% creator tax); native ETH pair;
  buybacks off; optional opening buy defaults to zero.
- Metadata and avatar come from the agent profile. Ticker is reviewed.
- Append to the bio: “This agent is available on Hive, where you can explore
  its services and work history.” Website links to the canonical Hive agent
  profile. X and Telegram are empty for owner and admin launches. Validate the
  complete description without silently truncating the bio.
- One Pons token per agent, independently of any existing Solana token.
- Community token only. Trading links to Pons; no task payment changes.

## Delivery gates

1. [x] Shared owner/admin UI and authenticated profile preview; pure validation,
   purchase arithmetic, accessible wallet selection and recoverable states.
2. [ ] Protocol verification:
   - [x] Documented ABI, block-pinned runtime/economics observation, and local
     fork rehearsal of launch-only and launch-and-buy. Validate 1% base fees
     before and after graduation, plus 2% creator tax.
   - [ ] Obtain matching source/build evidence and approve the release manifest.
     Explorer API returns 403, published repository/archive 404, Sourcify full
     match 404. Observed code hashes are explicitly unreviewed.
3. [x] Durable launch intent and signing:
   - [x] Calldata construction, simulation, gas estimates, affordability check,
     economics pin, release check and nonce selection as isolated modules.
   - [x] Durable intent, atomic agent/nonce reservations and exact prepared
     transaction persistence before wallet exposure.
   - [x] Wallet-bound authorization, profile avatar upload, preparation API,
     draft cancellation and verified broadcast recording.
   - [x] Browser signing, fee review, expired prepared-transaction recovery and
     explicit nonce cancellation when an exposed call cannot safely resume.
4. [ ] Recovery and confirmation:
   - [x] Read-only receipt verifier binds the saved calldata, sender, nonce and
     value to the actual launch; validates metadata, recipient and opening buy;
     waits for finality and checks canonical blocks before publishing a result.
   - [x] Persist reconciliation results, discover missing/replacement hashes,
     lease worker jobs and retry confirmed profile updates. Authenticated status
     API and read-only scheduled worker implemented, disabled by default.
   - [x] Connect browser status, recovery, expired-review refresh and cancellation.
   - [ ] Deploy/enable the worker and verify operational alerts after the
     contract release review and real-wallet pilot pass.
5. [x] Post-launch integration:
   - [x] Public profile token card and Pons link, validated API projection,
     and coexistence with the existing Solana token.
   - [x] Write the association only after finalized receipt verification, with
     idempotent retries and protection against conflicting profile records.
   - [x] Creator-fee handoff to the native Pons profile, and legacy Bags launch
     isolation across registration, admin, owner, internal and cron entry points.
     Fee collection stays on Pons; Hive does not sign fee claims.
6. [ ] Release acceptance:
   - [x] Mock-wallet browser acceptance and real MongoDB concurrency/fault tests.
   - [ ] Allowed-origin real-wallet acceptance and approved funded pilot.

## Safety invariants

- No transaction submission in the first milestone. A preview is never a quote
  or an approval to spend. UI cannot enable signing with a client-side flag.
- Client never chooses admin/owner recipient. Owner access requires agent key;
  signing milestone additionally requires current primary-wallet proof.
- Database uniqueness is `(agentId, chainId)`; Solana fields are not overwritten.
- Persist intent before wallet approval. A timeout is unresolved, not failed.
- Never unlock an exposed transaction because its quote expired: resolve its
  nonce and chain outcome first. Reconciliation survives the browser closing.
- Fee recipient changes, deletions and profile edits do not rewrite history.
- Read and pin current economics. Fail closed if either curve or graduated-pool
  base fee differs from 1%, code identity changes, or the launch is disabled.

## Protocol evidence

- Official documentation: https://docs.ponsfamily.com/v2
- Factory: `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`, chain 4663.
- Research read: launch fee 0.0005 ETH; config 0 enabled, 1B supply,
  100 bps curve fee; HIVE fee recipient matches the product contract above.
- These values are observations, not hardcoded transaction quotes. Published
  documentation and live permission state differed; reread before signing.
- Matching deployed source/ABI evidence is still a release gate. No live
  deployment, token launch or paid pilot is authorized by this tracker.

## Verification log

- 2026-10-14: 28 focused tests passed (`agent-tokenization` and `tools-redesign`),
  including authenticated preview, fee recipient policy, metadata attribution,
  canonical profile links, excluded socials, integer amounts and quote bounds.
- Type checking, scoped ESLint and `git diff --check` passed.
- Chrome component checks passed for owner/admin review, connected-wallet
  selection, wrong-wallet feedback, retry, loading, keyboard focus containment
  and return, existing-token links, and widths from 320px through 1440px.
  Privy is mocked in these checks; its modal open/close signal verifies that
  the native review dialog yields to the wallet picker and then reopens.
- Chrome checks against the actual Next.js owner dashboard passed with fixture
  API responses: owner entry, existing Solana token link, launch review, amount
  validation, loading, retry, focus return, responsive layout and Pons links.
- Metadata wording checked against Hive's public profile flow at
  https://uphive.xyz/ on 2026-10-14: profiles expose services and work history.
- No real-wallet connection, signature, funded launch or production deployment
  has been verified. Signing remains disabled. Milestones 2–6 remain open.
- 2026-10-14 profile follow-up: 41 focused tests passed across tokenization,
  public profile parsing/API and owner tools. The new public card shows the
  ticker (or shortened address), Robinhood Chain and a Pons trading link.
  Pending, reverted, wrong-chain and malformed records are omitted without
  failing the rest of the profile. Public responses omit private launch fields.
- Profile follow-up type checking passed. Scoped lint has no errors; the public
  route retains two pre-existing `no-explicit-any` warnings.
- Chrome verification against the actual local profile with fixture API data
  passed: visible card, exact Pons URL, keyboard access, legacy Solana link,
  missing/invalid/pending token omission, address fallback and 320–1440px layout.
- Preview console shows Privy's frame policy excludes `http://127.0.0.1:3110`
  (it allows `http://localhost:3000`) and a duplicate WalletConnect initialization
  warning. Use an allowed origin and resolve wallet initialization before the
  real-wallet acceptance gate; the profile fixture check does not prove wallet
  connectivity.
- Chain adapter follow-up: 54 focused tests passed. Type checking and scoped
  lint passed. Four local Anvil fork scenarios passed at Robinhood block
  88,734,592: owner zero buy, owner 0.1 ETH, admin 0.1 ETH, and owner 10 ETH with
  clamped fill/refund. Reconciler passed against the actual fork receipts after
  local finality advancement. No live signatures or transactions were sent.
- Read-only evidence is saved in `scripts/tokenization/evidence/2026-10-14.json`.
  Live snipe-tax duration was 3 seconds, versus 5 in the docs. Zero economics
  hashes bypass the contract comparison, so the builder rejects them. A
  deliberately wrong nonzero pin reverted in each fork scenario.
- The live `finalized` tag trailed the latest timestamp by 1,101 seconds in this
  observation. The next milestone must persist an included/confirming state and
  let the user leave; background reconciliation must finish the association.
  Do not require an open browser or show a new-launch retry while unresolved.

- 2026-10-15 durable recovery: 64 focused unit/API/regression tests and 10
  MongoDB integration tests passed (the latter includes one parent suite).
  MongoDB 8.0.16 ran on loopback with disposable databases; its archive matched
  the official SHA256. No application database was used.
- Database tests cover competing reservations, shared signer nonces, stale
  revisions and worker leases, lost profile writes, conflicting associations,
  RPC failures and finalized nonce cancellation. No TTL index can delete an
  exposed launch. Confirmed launches retain their agent reservation.
- Unit tests cover exact bigint persistence, missing/replacement hash discovery,
  bounded finalized scans, canonical-block changes, nonce proof, wrong-chain
  failures and broadcast hash validation. API tests cover owner/admin access,
  status field redaction and the authenticated, disabled-by-default cron.
- Type checking, scoped lint and whitespace checks passed. No UI was changed
  in this recovery milestone. The status API is not yet wired into the dialog;
  wallet-bound mutation endpoints and signing remain disabled/unimplemented.
- Worker implementation: `/api/cron/pons-launches`, called every two minutes by
  Netlify only with `PONS_RECONCILIATION_ENABLED=true` and `CRON_SECRET`. Nothing
  was deployed or enabled. Operational alert delivery is still outstanding.

- 2026-10-15 authorization/preparation follow-up: server-issued five-minute
  proofs bind agent, role, wallet, metadata, ticker and opening purchase. An
  authorization ID is also its reservation ID: repeated proof submissions resume
  the same record and cannot resurrect a cancelled record. Only challenge
  records have TTL cleanup; launch records never expire.
- User selected the existing Cloudinary service instead of adding IPFS. The
  agent's DiceBear avatar is rendered at 512px and uploaded as PNG with a
  content-derived public ID, overwrite disabled, and a validated versioned URL.
  This is provider-hosted storage, not an IPFS content-address guarantee.
- Live Cloudinary verification uploaded one generated test avatar, repeated the
  upload with the same URL, and fetched a valid 9,006-byte PNG over HTTP 200.
  Public test asset: https://res.cloudinary.com/dgjseefcx/image/upload/v1792054160/hive-agent-tokens/544e5887ba64a0e6740993fff08772077ab3f836ab5f6dba0ce71ab029feb557.png
- Preparation takes a reclaimable database lease, verifies the release before
  upload, rereads chain economics after upload, simulates the exact call, checks
  profile freshness again and saves calldata before returning wallet fields.
  Concurrent calls cannot upload/prepare twice. Upload failures retain the same
  reservation/salt and release the lease for retry.
- Four authenticated POST routes added: `/tokenization/authorization`,
  `/tokenization/prepare`, `/tokenization/cancel`, `/tokenization/broadcast`.
  Authorization/preparation require both `PONS_LAUNCH_ENABLED=true` and a
  separately reviewed release in `lib/agent-tokenization/release.ts`; that
  manifest is currently null. Cancellation and broadcast recording remain
  usable while launches are paused. No endpoint signs or sends a transaction.
- Current direct-transaction adapter requires an EOA and rejects wallets with
  deployed code, including delegated EOAs. Smart/delegated-account execution
  needs separate preparation and receipt support before it can be enabled.
- 75 focused unit/API/regression tests and 15 MongoDB integration tests passed
  (the latter includes the parent suite). Type checking and scoped lint passed.
  Browser signing/recovery integration, fee collection, legacy Bags isolation
  and live-wallet acceptance remain open. No chain transaction or deployment
  was performed.
- Production `next build --webpack` passed, including the new API routes and
  server-side Cloudinary/DiceBear imports. Only existing middleware-deprecation
  and optional bigint native-binding warnings were reported.


## Current completion status — 2026-10-15

Application implementation is complete on the feature branch. Production signing
remains disabled; contract source verification, deployment operations and the
real-wallet pilot are distinct release gates, not completed application tests.

- Dialog now selects the wallet explicitly, requests a scoped ownership proof,
  then shows the exact value and maximum network fee before transaction approval.
  Pending operations have spinners. Declines, missing hashes and interrupted
  requests preserve the saved launch and provide a status/recovery action.
- Reloading or reopening resumes the durable intent. Expired estimates recheck
  deployed contracts, economics, simulated token addresses, funds and gas.
  Replacements keep the original call and nonce. Cancellation requires a separate
  reviewed zero-value transaction to the same wallet; finality must prove nonce
  consumption and absence of the predicted token before the reservation clears.
- Browser requests never automatically resend a transaction. Repeated clicks are
  guarded synchronously, and background receipt recovery survives a closed tab.
- New agent launches through Bags require `HIVE_LEGACY_AGENT_LAUNCH_ENABLED=true`.
  The default blocks old owner/admin/internal/cron launch paths and registration
  requests with `launchToken: true`. Existing token links, fee collection and
  generic tool-token features remain separate.
- Creator fees link to https://ponsfamily.com/profile. The official page offers
  launches, holdings and creator fees after sign-in. This is an external handoff;
  an authenticated fee claim has not been executed during these checks.
- Source review follow-up: the factory runtime embeds IPFS metadata CID
  `QmYW5TEfiF6aPztWrg4FVVt5tNyNqyNvsZ2EfsQCg37wVX`. ipfs.io/dweb.link returned
  HTTP 429; Pinata timed out; Sourcify partial match returned 404. The GitHub
  organization linked by Pons, https://github.com/pons-labs, has no public
  repositories. No matching source/build evidence was obtained, so the reviewed
  release manifest remains null. An observed runtime hash is not substituted for
  a reviewed release.
- Signing capability additionally requires the reconciliation flag, cron secret
  and Cloudinary configuration. API flags alone cannot bypass source review.
- Chrome checks cover separate approval steps, double-click prevention, status
  outages, wallet rejection, lost hashes, interruption after exposure, expired
  reviews, cancellation, close/reopen, success links, focus return and 320–1440px
  layouts. These use mocked external wallets/API boundaries and the real dialog.
- 90 focused unit/API/regression tests and 16 isolated MongoDB tests passed.
  Type checking, scoped ESLint (no errors; existing legacy warnings) and production
  build passed. No live token, signature, funding transaction or deployment was
  performed. Unrelated workspace changes were preserved.

- Final owner-dashboard regression: all 70 browser checks passed against the
  production Next.js build at `http://localhost:3000`, including the gated Pons
  review and existing tool-token, webhook and points flows. The 18 API writes
  were intercepted fixtures; none reached the application database or chain.
  Updated the existing owner-tools check to use the separate agent/Pons flow.

## Admin profile editing and local pilot — 2026-10-15

Supersedes the earlier unresolved source-provenance status above.

- Admin tokenization review now has **Edit agent details**: name, bio, and PNG/JPEG/WebP image upload (2 MB limit). Save updates the agent document and refreshes token metadata/profile link; Cancel discards the draft. Ticker remains an explicit launch choice. Website remains the Hive agent profile; X/TG remain omitted.
- Uploads use the existing Cloudinary account, content-derived immutable IDs, a 512px raster conversion, and a versioned URL. The same image is used for the public profile, directory/comparison, owner dashboard and token preview. Neither wallet nor fee-recipient fields are editable in this form.
- Admin authentication, origin checks, bounded bodies, name uniqueness and stale-profile comparison are enforced server-side. Profile edits and preparation share a reclaimable lease. Active or completed launches reject edits in this review. Upload/save failures retain the draft; repeated saves are guarded; editing requires a fresh wallet authorization afterward.
- The reviewed Pons manifest is now populated. Sourcify's current v2 API provided all five contracts. Source hashes, compiler output versus deployed executable bytes, factory/hook/router ABI and deployer metadata limits were checked. Hook/escrow compiler CBOR differs; executable runtime matches. This uses Sourcify's compiler output, not an independent compilation or full security audit. Evidence: `scripts/tokenization/evidence/source-review-2026-10-15.json`; reproduction: `verify-release.mjs`.
- Local `.env.local` enables launch and reconciliation flags and pins `PONS_APP_ORIGIN=http://localhost:3000`. These are real Robinhood Chain launches requiring explicit wallet review/approval. No transaction was submitted on the live chain during this work.
- Added `scripts/tokenization/local-worker.mjs` to call the existing authenticated recovery endpoint every 15 seconds while the local pilot is running. The deployed Netlify worker remains separately controlled by production environment flags.
- Fork rehearsal passed: no opening buy, ordinary owner/admin buys, and an over-graduation buy with refund. Exact metadata, recipient, fees, balances, final receipt, duplicate salt rejection and stale economics rejection passed. All fork changes were reverted.
- Browser editor checks passed at 320, 390 and 1280px: admin-only entry, Cancel, image selection, failed-save recovery, double-submit prevention, saved preview/profile link, focus and existing signing/recovery flow.
- Isolated MongoDB checks passed for persisted edits, case-insensitive duplicate names, stale edits, concurrent saves, profile/preparation exclusion and active-launch edit refusal. Real Cloudinary upload/fetch confirmed a 512×512 PNG.
- A real-wallet pilot and production deployment/scheduled-worker verification remain outstanding. Local fixtures and fork transactions do not complete those gates.

Final validation for this increment: 151 focused tests passed (two database suites skipped in that run and executed separately); all 20 tests in the isolated MongoDB run passed. Scoped lint, browser checks, fork rehearsal and production build passed. Local app restarted on port 3000; authenticated local recovery returned `enabled: true`, zero errors and no queued launches. The real admin preview and live launch still require the user's browser session; no admin API key is configured. No push or production deployment was performed.

### 2026-10-15 — Managed Hive deployer

Implemented the approved default Hive signing-wallet path for admin tokenization,
with an explicit connected-wallet alternative. Admin review still permits agent
name, bio and image edits before preparing an immutable intent. Owner launches
retain their verified-wallet flow. Existing intent records default to connected
mode, with no destructive data migration.

Managed preparation requires admin access and a matching configured signer;
confirmation requires the exact current review digest and expiry, rechecks the
profile, release, simulation, nonce and balance, then saves an encrypted signed
submission before broadcasting. Atomic revision checks fence concurrent refresh,
discard and confirm actions. A unique partial index prevents simultaneous managed
launches from sharing the signing wallet. Receipt recovery publishes only verified
finalized results and can rebroadcast already-authorized identical bytes after a
crash. It does not independently sign or raise fees.

Local signer setup: `python3 scripts/tokenization/start-managed-local.py` (hidden
terminal entry, key retained only in the server environment). The existing local
BNB deployer is a different address and was not reused. No matching Hive signer
key was found/configured and no live transaction was submitted.

Validation: browser flows passed for managed default, connected fallback,
explicit confirmation, duplicate clicks, lost response/reopen, unsigned discard,
owner regression and responsive layouts. Disposable MongoDB suites passed
concurrency and encrypted-journal recovery. A live-state local Anvil fork passed
managed launch with 0 and 0.1 ETH purchases, real raw signing, retry without another
nonce, finalized receipt validation, profile publication and signer release.
Fork state and test databases were removed afterward. Production deployment and
a real-wallet pilot remain outstanding.

Final checks for this increment: production build, TypeScript and scoped lint
passed; the broader test selection passed 153 tests (three DB suites skipped in
that run and exercised separately); the isolated DB run passed 26 tests. The
localhost admin page returned HTTP 200 and an unauthenticated managed request was
rejected. No managed secret/journal helpers appeared in the client bundle.
Latest public RPC check: deployer code is empty (compatible direct wallet), with
0.000142341662520743 ETH, below the 0.0005 ETH launch fee plus gas. Funding and the
matching server-only key are required before a real managed launch. Nothing was
pushed or deployed.

### 2026-10-15 — Hosted production signer enabled

Supersedes the local-only deployment/configuration status above.

- Published to the existing `hive-protocol` Netlify site (`uphive.xyz`), deployment
  `6ad14e30ae3f5d4af7000447`. The BNB site was not changed. The managed signer and
  recovery now run without a local terminal or worker process.
- Verified the configured private key derives Hive signer
  `0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2`; normalized its missing `0x` prefix
  without printing or writing it locally. Restricted it to secret / Production /
  Functions. Enabled the launch, managed-launch and recovery flags, and pinned
  the managed mutation origin to `https://uphive.xyz`.
- Fresh authenticated production recovery returned HTTP 200, `enabled: true`,
  `managedDeployer.available: true`, the expected public signer address, and zero
  checked/confirmed/published/error counts. No real launch was submitted.
  Netlify's API confirms the deployed recovery schedule is `*/2 * * * *`.
- Live admin and agent-directory pages returned HTTP 200. Unauthenticated cron
  and managed launch requests returned HTTP 401. Production build/type checks
  passed. Focused signer/recovery tests passed (10 passed; the database suite was
  skipped in this small rerun and passed separately in the earlier full run).
- A first function package omitted Next.js dependencies because the isolated
  checkout symlinked `node_modules`. It was promptly rolled back. Rebuilt with
  dependencies copied inside the checkout, verified the missing server module in
  the ZIP, then verified draft server pages before publishing the corrected build.
  The earlier separate no-build upload failed without replacing production.
- Netlify masks saved secret values through its API. `hosting.mjs deploy` retains
  a freshly rotated worker credential only in memory while deploying and uses it
  for the authenticated runtime check; plain `health` refuses masked values.
  The helper rejects build checkouts containing local environment files or a
  symlinked dependency directory.
- Source/build snapshot: `/private/tmp/hive-managed-production-20261015`, with
  `source-manifest.json`; sanitized rollout log: `/tmp/hive-hosted-verified.log`.
  Current helper/docs contain operational follow-ups after that source snapshot.
  Previous stable rollback: `6ad13ac07a0183d5bd4c9aed`.
- This was a manual production deploy from `feat/pons-agent-tokenization`; no
  Git commit, push or merge was performed. Merge this implementation before a
  later automatic build of `main` to avoid replacing it with the older version.
  Actual agent selection and **Confirm launch** in the admin session remain the
  real-transaction acceptance step; hosted readiness does not assert a token was
  launched.

### Main integration — 2026-10-15

The user authorized merging the deployed implementation into `main`. Included
the tokenization flow, hosted signer/recovery, profile editing, related login
fixes and their validation tools; historical untracked claim/migration files
remain outside this change. Application files match the verified production
snapshot. Follow-up changes are operational documentation, the hosting helper,
a trailing-whitespace cleanup, and a corrected health-check test dependency.

Type checking passed. The complete test run exposed a missing test double for
the recently added signer health response; corrected it and verified that signer
status is checked only after authentication and the recovery enable gate. The
legacy `security-regressions.test.mjs` failures were reproduced against unchanged
`origin/main` (`54fb8dc`) in a separate clean source snapshot. Those include
references to removed page components and outdated source assertions, and are
not caused by this merge. Production code remains unchanged from the live
verified implementation.

Merge validation: all other root test suites passed (374 passed, 3 optional
database suites skipped; those database suites passed in the earlier isolated
validation). Type checking, staged whitespace checks and credential-pattern
checks passed; no environment files or secrets are included in the commit.

### Token flow review follow-up — 2026-10-20

- [x] Replace the repeated admin metric cards with a compact summary, launch list,
  and Solana fee section. Trading fees by token remain visible without a dropdown.
- [x] Show unavailable or stale balances explicitly; retain failed lifetime-fee
  rows as unavailable and label the 20-token reporting limit when applicable.
- [x] Persist each fee transaction signature before broadcasting. A wallet lease
  prevents overlapping batches, and request IDs prevent duplicate submission.
  Reconcile lost responses by signature, distinguishing pending, failed/expired,
  and confirmed transactions. Preserve preparation failures alongside receipts.
- [x] Align browser request timeouts with the server's confirmation budget, bound
  each batch, provide pending spinners and explorer links, and refresh balances
  after confirmation. No automatic write retries.
- [x] Expose the verified Pons association in the owner API/tools page, replace
  the tokenize action with the token/trade section, and preserve Solana links.
- [x] Derive launch dates from the canonical receipt block. The backfill script
  verifies saved transaction identity, finality and metadata before date updates;
  it is read-only unless invoked with `--apply`.

Validation: typecheck and targeted lint passed; 96 focused tests passed, with
three optional MongoDB suites skipped. The complete root run passed 415 tests,
with three skipped and three existing failed tests in the legacy security suite
(removed-page references and outdated source assertions). Those files are
unchanged from main. Browser fixtures passed at 320/390/768/1440 in both themes,
including stale/unavailable data, duplicate clicks, lost responses and confirmed
explorer links. The launch fixture also passed profile links, admin token state,
wallet choice, editing, recovery, focus return and managed/connected signing flows.
These are fixture checks; no live fee claim was signed or broadcast for validation.
