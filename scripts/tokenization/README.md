# Pons integration verification

These tools exercise the same ABI, quote, transaction and receipt modules used
by the integration. They do not enable the app's launch button.

## Read current contracts

```sh
node scripts/tokenization/inspect.mjs 0x1111111111111111111111111111111111111111 /tmp/pons-inspection.json
```

This performs read-only calls against the public Robinhood RPC. An alternative
RPC may be supplied through `HIVE_PONS_RPC_URL`. The report contains public chain
state and code hashes, not a release approval. The example address is a test
identifier; no key or wallet connection is required.

## Rehearse locally

Run Anvil in a separate terminal. Use the recorded block to reproduce the
2026-10-14 evidence, or deliberately choose a new block for a fresh review.

```sh
anvil --fork-url https://rpc.mainnet.chain.robinhood.com \
  --fork-block-number 88734592 --chain-id 4663 \
  --host 127.0.0.1 --port 18547 --silent
node scripts/tokenization/rehearse.mjs
```

The runner refuses non-loopback endpoints and requires Anvil's client identity.
It uses local impersonation and synthetic balances, advances local finality,
then reverts the fork snapshot and stops impersonation. It never reads keys or
sends live-chain transactions. Stop Anvil when finished.

Cases cover owner/admin recipients, no opening buy, an ordinary opening buy,
and a buy above the graduation threshold with a refund. Checks include exact
metadata, empty social fields, Hive profile URL, token amounts, fees, receipts,
finality, duplicate salts and a wrong nonzero economics hash.

## Application checks

```sh
node --test tests/agent-tokenization*.test.mjs tests/profile*redesign.test.mjs tests/tools-redesign.test.mjs
npm run typecheck
```

`evidence/2026-10-14.json` is an observation, explicitly `reviewed: false`.
Matching deployed source/build evidence remains unavailable. Do not convert an
observed hash into a trusted release automatically. Transaction preparation
requires a separately reviewed release; app signing is still disabled.

## Durable recovery

The internal launch store persists the exact prepared transaction before it may
reach a wallet. Unique indexes reserve one active launch per agent and one
transaction per signer/nonce. There are no TTL indexes on launch intents.
An exposed transaction stays reserved until a finalized launch, revert, or
nonce-consumption proof resolves it. A wallet rejection or an expired quote
alone is insufficient to release it. The signing UI must resume the saved
transaction or support a separately confirmed nonce cancellation; it must not
silently create another launch.

The worker scans at most 2,000 finalized blocks per intent per pass, including
when the browser lost the hash. It accepts a replacement only after verifying
its exact call, nonce, sender, value, receipt and metadata. Profile writes happen
after the confirmed result is saved and can be retried independently. Existing
Solana tokens and conflicting Pons associations are preserved. RPC errors keep
the reservation and omit credential-bearing error details from storage.

`GET /api/agents/:agentId/tokenization/status?role=owner|admin` uses the same
owner/admin authorization as the preview. It returns safe status fields only;
no prepared calldata or worker internals. The dialog loads this before allowing
a new launch and polls pending intents every six seconds while visible.
Authenticated mutations implement wallet authorization, preparation, draft
cancellation, replacement reviews and broadcast recording. The dialog signs
only after explicit review; the release gate keeps production launching disabled.
Smart/delegated-account execution
is not supported by the current direct-transaction adapter.

The user selected existing Cloudinary storage. The uploader generates the same
DiceBear avatar used by the profile, stores a 512px PNG under a content-derived
public ID with overwrite disabled, and freezes its versioned delivery URL in
the intent. Only that constrained URL shape or an IPFS URI can reach calldata.
Cloudinary is provider-hosted storage, not a cryptographic IPFS guarantee.

### Authorization and preparation API

All routes are below `/api/agents/:agentId/tokenization`, accept JSON, and use
`?role=owner|admin` with the existing owner key/admin session authentication.
Caller-supplied recipients, metadata, logo URLs and transaction fields are
rejected. An 8 KiB streamed body limit and origin check apply.

- `POST /authorization`: `{ signer, symbol, purchase }` → server-issued message,
  challenge ID and five-minute expiry. The selected EOA signs that exact message.
- `POST /prepare`: `{ challengeId, signature }` → saved intent status and exact
  hex-encoded wallet transaction, only while its review is still fresh. The
  same proof resumes the same reservation; no signature/private key is stored.
- `POST /cancel`: `{ id }` → cancels only an unexposed draft. It cannot release
  an exposed transaction, even when its quote expires.
- `POST /resume`: `{ id, action: "resume" | "cancel" }` → a fresh fee review
  retaining the saved nonce. Resume rechecks the release/economics/simulation;
  cancellation reviews a zero-value self transaction even while launches pause.
- `POST /broadcast`: `{ id, transactionHash, action?: "resume" | "cancel" }` → verifies the actual transaction
  against the saved intent, then schedules reconciliation. This is a receipt
  registration endpoint, not a transaction broadcaster.

Preparation requires `PONS_LAUNCH_ENABLED=true`, enabled reconciliation, cron
authentication, all three Cloudinary settings **and** a reviewed manifest in
`lib/agent-tokenization/release.ts` (currently null). A flag alone cannot unlock
launching. These routes have not been enabled or deployed. The expected app
origin defaults to `https://uphive.xyz`; `PONS_APP_ORIGIN` may select an explicit
HTTPS preview origin or loopback HTTP origin. Never derive it from request headers.

Preparation checks for profile edits before and after external calls. It leases
the draft before uploading, refreshes the chain snapshot after upload, and saves
the exact prepared transaction before responding. An interrupted draft can be
retried after lease expiry. If an exposed quote expires, the browser must use
status recovery and an explicitly reviewed resume/nonce-cancellation flow; it
must never silently create a second launch. Both recovery actions are now wired
into the dialog; neither releases the reservation before a finalized outcome.

### Local database checks

Start an isolated MongoDB 8 server bound only to `127.0.0.1`, using a disposable
data directory, then run:

```sh
HIVE_TOKENIZATION_TEST_MONGO_URI=mongodb://127.0.0.1:27931 \
  node --test tests/agent-tokenization-store.test.mjs
```

The test refuses non-loopback/credentialed URIs and creates random test databases,
which it drops afterward. It never reads the app's database configuration. With
no test URI this integration suite is explicitly skipped; other tests run
without services. Stop the isolated server after testing.

### Deployment configuration (not enabled)

- Netlify schedule: `scheduled-pons-launches`, every two minutes.
- API: `/api/cron/pons-launches`, authenticated with `Bearer $CRON_SECRET`.
- `PONS_RECONCILIATION_ENABLED=true` is required by both the schedule and API.
- `HIVE_PONS_RPC_URL` optionally selects a provider; default is the public
  Robinhood RPC. Normal app database configuration supplies the durable store.
- The worker is read-only on-chain and has no wallet keys or signing client.
- Each claim has a two-minute lease; an interrupted worker can be reclaimed.
  A pass handles up to five intents by default (maximum ten), with a 30-second
  soft budget between intents and an eight-second timeout per RPC. The host may
  interrupt a slow pass; recovery resumes after lease expiry.
- Before enabling in production, finish the release/signing gates, validate
  provider log-range limits and configure alerts for recovery errors and backlog.
  No production worker or alert delivery has been verified.


The Cloudinary duplicate-upload behavior is documented in the
[official Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference).
The authorization verifier uses viem's EOA signature utility; the distinction
from contract-account verification is covered in the
[official signature verification documentation](https://viem.sh/docs/actions/public/verifyMessage).


### Browser acceptance without live signing

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/tokenization/check-browser.mjs
```

Uses installed Chrome and an ephemeral loopback fixture, closes both afterward,
and writes mobile screenshots under `/tmp/hive-pons-*.png`. The real dialog,
validation and lifecycle hook run against explicit fake API/wallet boundaries.
No private keys, app database or blockchain transactions are involved. This does
not replace a real-wallet pilot on an origin permitted by the Privy app.

### Existing Solana tokens and creator fees

New legacy agent launches are disabled unless the operator explicitly sets
`HIVE_LEGACY_AGENT_LAUNCH_ENABLED=true`. Registration with `launchToken: true`
returns a conflict directing the caller to the dashboard. This flag applies to
agent launches only; existing fee claims, token links and tool tokens are intact.
Do not enable the old agent launch cron as part of the Pons deployment.

The launch success view links to [the Pons profile](https://ponsfamily.com/profile)
for creator fees. Users collect there with the fee-recipient wallet. Hive does
not run an automatic sweep or invent an earnings total from escrow alone.

### Release sequence

1. Obtain source/build evidence matching every deployment in the reviewed manifest;
   inspect ABI and immutable configuration, then populate `release.ts` deliberately.
2. Configure the existing database, Cloudinary, cron secret and allowed app origin.
   Deploy with launch signing disabled, verify the authenticated worker and alert
   handling, then enable reconciliation. Observe successful scheduled invocations.
3. Complete the real-wallet pilot on an allowed Privy origin, with explicit funded
   launch authorization. Check finalized receipts, association publication,
   external Pons metadata/trading links and fee-recipient access.
4. Enable launches only once those checks pass. To pause new launches, set
   `PONS_LAUNCH_ENABLED=false`; keep reconciliation running for exposed intents.
   Status, broadcast registration and explicit cancellation remain available.

Source verification and the live pilot are not claimed by the local test suite.

### Admin edits and current source review

Admins can edit agent name, bio and image from the initial tokenization review. The
profile PATCH route shares preparation's profile lease, checks the starting profile
revision and refuses an active/existing launch. Submitted metadata is never taken
from a launch request: preparation rereads the saved profile and requires a fresh
wallet proof. Uploaded images are bounded raster files, normalized to 512px PNG and
stored with immutable content-derived Cloudinary URLs. Unsaved edits never alter
launch calldata.

The source-provenance gate above is now complete; the reviewed manifest is in
`lib/agent-tokenization/release.ts`. Source evidence and qualifications are recorded
in `scripts/tokenization/evidence/source-review-2026-10-15.json`. To repeat the
read-only verification (this does not enable flags):

```sh
node scripts/tokenization/verify-release.mjs <public-wallet-address> /tmp/pons-source-review
```

For the configured localhost pilot, run the app on port 3000 and its read-only-chain
recovery companion in another terminal:

```sh
node scripts/tokenization/local-worker.mjs
```

The worker reads local environment settings and prints no credentials. Keep it
running until exposed launches have settled. Production uses the scheduled
Netlify function instead. Real-wallet pilot acceptance and production rollout
have not been recorded yet.

## Managed Hive deployer (2026-10-15)

Admin review defaults to **Hive deployer**, the original HIVE signing wallet
`0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2`. This does not reuse HIVE's old
executor contract. **Connected wallet** remains an explicit alternative. Owner
launches continue using the verified owner wallet.

Server-only configuration:

- `PONS_MANAGED_LAUNCH_ENABLED=true`: permits new managed preparations/signatures.
- `PONS_MANAGED_PRIVATE_KEY`: key for the exact wallet above, injected through the
  hosting provider's secret configuration. Never use a `NEXT_PUBLIC_` variable.
- Existing launch, Cloudinary and recovery configuration is still required.

Production uses Netlify Functions on `uphive.xyz`; no local process is required.
The managed key is a secret restricted to the Production context and Functions
scope. The scheduled recovery function runs every two minutes. Only an explicit
admin confirmation signs a new launch; recovery replays existing signed bytes.

Hosting maintenance (uses the existing local Netlify CLI login, never prints
credential values):

```sh
node scripts/tokenization/hosting.mjs status
node scripts/tokenization/hosting.mjs configure
node scripts/tokenization/hosting.mjs health
node scripts/tokenization/hosting.mjs deploy /absolute/path/to/clean-build-checkout
```

`configure` verifies and normalizes the Hive key before restricting its scope,
and enables the production launch/recovery settings. Deploy after configuration
changes. `health` checks the authenticated production recovery endpoint when the
credential is readable. Netlify masks saved secret values, so `deploy` refreshes
the recovery credential, retains it only in memory while deploying, then checks
the runtime signer's public address/readiness without signing a transaction.

For manual deployments, use a clean checkout without `.env.local` and install
dependencies inside that checkout. Do not symlink `node_modules` from another
checkout: Next.js dependency tracing can omit required server modules. Use
Netlify's integrated build-and-deploy command, verify the draft deployment URL,
then publish that verified deployment. A separate `netlify build` followed by
`deploy --no-build` can target Next.js build artifacts after the runtime restores
the original publish directory.

For optional local testing, stop the existing port-3000 server, then run:

```sh
python3 scripts/tokenization/start-managed-local.py
```

The hidden terminal prompt validates the wallet address, passes the key only in
server process memory, and runs the built app on localhost:3000. It never writes
or prints the key. Run `npm run build` first after source changes. The launcher
also starts the recovery companion without passing it the key; Ctrl+C stops both
processes. The companion can also be run separately with
`node scripts/tokenization/local-worker.mjs`.

Open `http://localhost:3000/admin?section=agents`. Preparation cannot spend funds.
The final **Confirm launch** authorizes exactly the displayed transaction, with
its maximum total cost. Robinhood chain 4663 is a live network; the setup command
itself does not submit a launch. Do not reuse the unrelated BNB deployer key.

Managed preparation shares the existing image storage, release checks,
simulation and durable launch journal. The new admin-only POST `/api/agents/:id/tokenization/managed?role=admin`
accepts `prepare`, `refresh`, `confirm`, `discard`, and `retry` actions. It requires
an authenticated admin and an exact configured Origin. It does not accept raw
calldata, transaction targets, recipient overrides, keys, or arbitrary signers.

A partial unique index reserves one unfinished managed intent per signer. Drafts
and unsigned reviews can be discarded; they never enter receipt recovery. After
explicit confirmation, a compare-and-swap persists the signed transaction in an
AES-256-GCM journal bound to that intent before any network broadcast. A
HKDF-derived encryption key is separate from the signing key cryptographically.
Retries and the recovery endpoint replay those identical bytes, including after
the launch enable switch is turned off; they never sign or increase fees.
Keep the same signing secret available until authorized submissions resolve.
The signer reservation releases after finalized confirmation, cancellation or
revert. Unknown submission outcomes remain reserved rather than risk another
launch. Existing connected-wallet intents default to `connected` and retain
their existing recovery behavior.

An already-signed managed transaction is not repriced or cancelled by this UI.
If its fee cap becomes inadequate, an operator must reconcile and replace/cancel
that exact nonce through a separately reviewed transaction. Never discard its
journal or clear its reservation to bypass a pending transaction.

Validation commands:

```sh
node --test tests/agent-tokenization*.test.mjs
HIVE_TOKENIZATION_TEST_MONGO_URI=mongodb://127.0.0.1:27932 node --test tests/agent-tokenization-managed.test.mjs tests/agent-tokenization-store.test.mjs tests/agent-tokenization-profile.test.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/tokenization/check-browser.mjs
node scripts/tokenization/rehearse-managed.mjs
```

The rehearsal refuses non-loopback endpoints and non-Anvil clients, uses a fresh
disposable key, signs only on the fork, verifies finalized receipts and profile
publication, then reverts the fork and drops its disposable MongoDB database.
It does not validate live funding, real admin session access or production
hosting secrets. Those remain pilot/deployment checks.

## Launch recovery and admin regression checks

The public Robinhood RPC can prune state at a launch block before that block
reaches L1 finality. Receipt verification still requires the exact finalized
transaction and factory event. Only an explicit pruned-state error permits the
additional metadata/fee-recipient reads at a pinned current block; both block
hashes are rechecked, and all expected fields must match. RPC outages and mismatches
remain unresolved. Authenticated status polling uses the same leased worker,
scoped to the requested agent, and never signs or broadcasts.

Admin totals read the Pons confirmation journal alongside legacy Solana launches.
Solana creator claims use Bags' `/token-launch/claim-txs/v3`, include user-vault
balances, preserve supplied signatures/blockhashes, and check confirmation errors.
This is separate from Pons creator fees and Bags' separate deployer entitlement.

Regression checks: `node --test tests/agent-tokenization*.test.mjs tests/agent-fees.test.mjs`,
`npm run typecheck`, and `scripts/tokenization/check-browser.mjs` with `PLAYWRIGHT_MODULE`.
The browser fixture includes the actual shared surface CSS in both themes.
