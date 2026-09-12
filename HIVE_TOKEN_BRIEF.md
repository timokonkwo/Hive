# HIVE token and staking — Unit 17

Status: implemented and locally validated; ready for user review. The user approved progression from Disputes and requested a removable “$Hive Launching soon On RobinHood” cover for the new token.

## Direction and boundaries

Direction: compact token workspace in the approved app shell. Density: comfortable. Surface: divided sections and one action panel. Type: clear, restrained, numeric. Motion: short GSAP element entrances with reduced-motion support.

- Default to the new Robinhood token. Use the exact requested launch message as a prominent, persistent cover above its trade/stake area. No dismiss button, query override, fake price, balance, yield, supply or contract address.
- Keep the launch state in one named configuration module. Removing a visual cover alone must not silently turn Solana requests into Robinhood requests. Token address, deployment, trade integration and staking contracts are still unspecified; activation requires those real integrations. Do not expose these implementation details in page copy.
- Keep `/token` inbound links working. `/stake` remains the canonical HIVE workspace; URL-backed network and Trade/Stake views permit deep links and history. Solana stays accessible as a separate existing-token view.
- Solana trading links to the existing Bags token page. Replace the old embedded swap presentation; do not reuse its stale-quote transaction path. Existing staking, unstake request and claim routes remain supported with explicit review, current account data, exact wallet/amount/treasury and persisted request references.
- Show only recorded Solana stake, policy and tier data. No Robinhood terms are inferred from them. Staking transfers retain the exact old mint and nine decimals; no mainnet transactions are performed during QA.

## Research

Read the current `/stake`, `/token`, SwapWidget, `/api/staking`, holder balance, wallet helpers, token utilities and transaction confirmation code. Existing Solana staking is a verified transfer to treasury custody, not an EVM contract. The current policy specifies a seven-day cooldown; claims are treasury transactions. Unknown outcomes must not automatically trigger another transfer or claim.

Official network configuration was checked at https://docs.robinhood.com/chain/connecting/ (4663 mainnet; ETH gas); this verifies the network only, not a HIVE deployment. The existing Bags token URL was checked at https://bags.fm/6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS; it returns a client-rendered page, so do not infer price/liquidity. Coss tabs at https://coss.com/ui/docs/components/tabs informed compact related-view controls; use existing native controls and styling, without a new dependency.

## Implementation units

1. New HIVE workspace, original logo, network navigation and Trade/Stake views. Single-source non-dismissible launch cover; its unavailable actions cannot sign, request quotes or submit transactions.
2. Solana token facts, external trade link and authenticated position with independent loading/error states. Current active/locked amounts, cooldown requests and dated activity. No private account state across account changes.
3. New stake/unstake/claim editors and exact review. Wallet mismatch checks before signing. Persist signed transfer identity before broadcast; retain unknown outcomes across reload and allow checking the existing result. Never auto-send a second transfer.
4. Appropriate API read boundaries and request identity support for recovery. Preserve configured treasury, mint and legacy terms. No new Robinhood contracts or transactions.
5. Static tests, production build, TypeScript and browser fixture audit: launch gate, both themes, 320–1440px, keyboard, history, long values, pending/failure/recovery, stake precision and reduced motion. No real financial writes.

## Delivery gates

- [x] Implement and review both network views and launch cover.
- [x] Verify account, precision, transaction and recovery boundaries.
- [x] Build, TypeScript, scoped lint and relevant regression tests.
- [x] Browser/visual audit and durable launch instructions.
- [x] Handoff for review before Unit 18, Documentation. Keep all changes local and unpushed; paid X verification remains deferred.

## Validation and launch handoff

Production build, TypeScript, scoped lint (zero errors; typing warnings remain), and 241 redesign regression tests passed. Twelve new token tests cover the launch configuration, exact nine-decimal amounts, wrong-chain/token rejection, transaction destinations and message signatures, fees, account-scoped history/receipts and claim safety after a lost broadcast response.

The browser token audit passed 57 checks across both themes and 320–1440px. It covers the cover and inert actions, `/token` redirect, separate Solana trade destination, sign-in/read failures, precise balances, withdrawal cooldowns, review/cancel/rejection, persisted unknown outcomes and recovery with one signed broadcast. All staking writes and RPC requests were intercepted using an isolated fixture wallet. No real stake, claim, trade, treasury transfer or Robinhood transaction was performed. Evidence: `scripts/redesign/check-token.mjs`, `/private/tmp/hive-redesign-qa/token-results.json` and token screenshots in the same directory.

At launch, configure `lib/hive-launch.ts` with the actual Robinhood token address and reviewed HTTPS trade/stake destinations, complete the intended provider integration, and change `status` to `launched`. Each action removes its cover only when its configuration is complete. This is not a deployed Robinhood trading/staking integration; removing the cover alone does not create one. No client-side dismissal or URL override exists.

Existing Solana custody and ledger limits remain: a signed claim reference is now persisted before broadcast, and an uncertain result stays locked as `claiming` to prevent a second payout. There is no new automatic treasury reconciliation worker; unresolved claims or legacy pending stake events may need operator reconciliation. Existing stake accounting uses number-valued database fields and multiple writes, and was not proven end-to-end against a live treasury. The fixture validation must not be treated as financial production certification.

Review at http://localhost:3100/stake . Stop before Unit 18, Documentation. Logo and dropdown corrections requested during this unit are recorded in `HIVE_BRAND_UPDATE.md` and `HIVE_CONTROLS_AUDIT.md`.
