# Production deployment with the supplemental claim

The frozen 72-wallet allocation remains 10,000,000 Robinhood HIVE. The explicit production exception for `CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF` adds 100,000 Robinhood HIVE for a full deposit of 1,507,505.338430267 Solana HIVE. Total funding is 10,100,000 HIVE. The exception is not represented as a frozen snapshot entry. Partial deposits receive the same fraction of its 100,000 HIVE grant, rounded down in raw units; one terminal attempt also applies to this owner.

Ordinary claims open 2026-09-25 09:00 UTC and close 2026-10-02 09:00 UTC. The exception can start earlier after activation; only a development server reached through loopback, configured with `HIVE_LOCAL_CLAIM_TEST_OWNER` equal to the exception owner, can expose its early UI. Neither that flag nor the countdown activates contracts or the operator. The production website must retain `HIVE_CLAIM_UI_ENABLED=false` until the deployment and settlement rehearsal are verified.

## Signing flow

1. Compile and test both programs. Preserve the existing Solana program identity. Never commit any keypair, `local/` directory, or signer material.
2. From the repository root, run `node --env-file=.env.local tools/hive-migration/escrow/deployment/prepare.mjs`. This reads finalized networks, freezes the deployment bytecode and EVM nonce, and creates an unsigned review under the ignored `local/deployment-100k/` directory.
3. Run `node --env-file=.env.local tools/hive-migration/escrow/deployment/simulate-buffer.mjs` for an unsigned mainnet simulation of the initial buffer transaction. This is not a deployed campaign rehearsal.
4. Run `node --env-file=.env.local tools/hive-migration/escrow/deployment/server.mjs` and open http://localhost:8789 in the browser containing Phantom and MetaMask. Connect the reviewed admin accounts. The page asks for acknowledgement of the single-attempt policy, proposed 24-hour settlement grace period and retained Solana upgrade authority before any signing request. Do not send another EVM transaction from the admin while deploying: its nonce pins the distributor address.
5. Review and sign the fixed deployment transactions. The page creates/uploads/deploys the Solana program, deploys the paused Robinhood distributor, transfers 10.1M HIVE to that distributor and initializes the paused Solana campaign. Uploads are signed in batches of up to eight. Nothing is automatically approved on behalf of the user.
6. Unknown transaction outcomes block progress and are reconciled against the durable journal. If MetaMask returned a transaction but its hash was not saved, use the recovery field to provide its hash. Never regenerate a started deployment review, clear a journal or retry blindly. Final success requires matching program bytes, upgrade authority, immutable contract terms, finalized receipt, inventory and campaign state.
7. Configure the separate settlement signer/operator securely, verify both chains, and rehearse the actual claim before public activation. Browser deployment signing does not provide an unattended Render signer. No signer secret should be sent in chat.

The helper binds only to loopback and requires an exact Host, same-origin JSON requests and a session cookie. Signed messages are compared byte-for-byte with their reviewed Solana transactions; EVM receipts must match the approved sender, nonce, calldata, recipient, value and fee ceilings. Journals are persisted before submission. Public claims remain disabled and both contracts remain paused after this deployment flow.

## Evidence recorded 24 September 2026

- All 72 ordinary maximum allocations unchanged; separate 100K exception verified.
- 67 JavaScript checks passed (checker, quote validation, accounting, transaction recovery and deployment helper); 50 operator checks also passed after isolated dependency install.
- 31 Solidity checks passed; one live-fork check was skipped.
- 14 native and 14 compiled-SBF runtime tests plus interoperability checks passed. These include the admin also acting as claimant and collection owner.
- Type checking passed. Initial buffer simulation on mainnet passed without an admin signature or broadcast.
- Read-only funding check: 10,117,357.525915931234130550 Robinhood HIVE, 0.945225289 SOL, 0.001530077804474558 ETH. Exact-sized program storage estimate 0.69194172 SOL, excluding transaction fees and campaign/account rent.
- WebSocket dependency patched to 8.21.0. Dependency audit still reports nine transitive findings (three high, six moderate), including unpatched bigint-buffer; this is not a clean dependency audit. Isolated dependencies were installed with lifecycle scripts disabled and use its JavaScript fallback. These checks are not an independent audit, machine-checked invariant proof or completed live settlement rehearsal.

As of this preparation, **no admin transaction has been signed or sent; contracts are not deployed and claims are not enabled**. The saved journal and live chain state supersede this preparation status after user signing.
