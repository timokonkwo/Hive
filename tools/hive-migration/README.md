> Current campaign budget: **10M new HIVE total**. Earlier 7M artifacts are historical; see `local/proportional-10m-preview/` and `local/eligibility-review-10m-v2/`. Funding is not yet verified.

# Hive migration preparation

Read-only snapshotting and proportional allocation modelling. No command signs, transfers, approves token allowances, or publishes files.

The `escrow/` subdirectory now contains locally implemented Solana/Robinhood contracts and unsigned tooling. See [its implementation and verification guide](escrow/README.md). No mainnet contract or public claim service has been activated.

`node --env-file=.env.local tools/hive-migration/snapshot.mjs` captures a **new current finalized** snapshot in a unique `local/` directory using the configured RPC. It never recreates historical state from an arbitrary slot. The initial preserved snapshot is `local/snapshot-2026-09-21T09-43-40.282Z/`.

`node tools/hive-migration/verify-snapshot.mjs` independently verifies the preserved initial snapshot's raw binary accounts, owner totals, full supply, file hashes and block identity. `node --test tools/hive-migration/tier-model.test.mjs` verifies exact tier boundaries and fixed grants. `build-tier-preview.mjs` writes the illustrative schedule for that initial snapshot with exclusive creation; existing evidence is never overwritten.

`review-custody.mjs` performs scoped read-only pool and configured staking-database lookups. Its result is supporting evidence, not a retrospective staking ledger or payment eligibility. Database fields remain internal. Local output is Git-ignored; public snapshot CSV can be shared separately after review.

The selected cutoff is now `local/snapshot-2026-09-21T10-48-52.230Z/`, finalized slot **449032979**, at **11:48:43 UTC+1**. Preserve the initial snapshot as historical evidence; do not merge allowances. `campaign-policy.json` records the cutoff decision separately from immutable raw capture metadata.

Verify the selected cutoff with `node tools/hive-migration/verify-snapshot.mjs tools/hive-migration/local/snapshot-2026-09-21T10-48-52.230Z`. Both the verifier and tier preview builder accept a snapshot directory argument; the builder refuses to overwrite existing output.

Run `node --test tools/hive-migration/tier-model.test.mjs tools/hive-migration/redemption-cap.test.mjs` for tier boundaries and the exact snapshot/current-balance/reservation cap. These tests do not verify a cross-chain settlement implementation.

See the root `HIVE_SOLANA_SNAPSHOT_REVIEW.md`, current `HIVE_REDEMPTION_PLAN.md` and `HIVE_REIMBURSEMENT_INPUTS.md`. Eligibility uses the selected snapshot, and claims require actual surrender. The plan includes the proposed Solana escrow plus Robinhood distributor alternative. The proportional allocation rule and single-admin escrow design are selected. Final amounts, funding, owner classifications and deployment remain pending; no deposit or payout service is active.

## Proportional budget preview

`node tools/hive-migration/build-proportional-preview.mjs [new-output-directory]` verifies the selected snapshot hash and generates provisional per-owner JSON/CSV and budget totals. The default output is `local/proportional-7m-preview`; existing directories are never overwritten. It excludes the known pool, keeps unresolved custody explicitly pending, uses integer arithmetic and enforces the 70% ceiling. Final eligibility must be reviewed before freezing a campaign denominator.

`node --test tools/hive-migration/proportional-model.test.mjs tools/hive-migration/allocation-cap.test.mjs` checks budget conservation, rounding, decimal conversion, caps and invalid inputs. Both escrow contracts and the unsigned client now implement this model; old tier configurations are rejected. Final eligibility and activation remain pending. Partial surrender is selected, so reduced deposits receive the same proportional rate on the old HIVE actually surrendered.
