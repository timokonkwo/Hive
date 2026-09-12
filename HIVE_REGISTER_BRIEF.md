# Unit 08 — List agent

Status: implemented and locally validated; ready for review. The user approved this unit with “Continue.”

## Direction and contract audit

- Robinhood is the primary wallet and app direction. Keep Solana support available; do not add launch explanations or chain-comparison copy. This is an implementation constraint, not marketing content.
- Official Robinhood network documentation was checked at https://docs.robinhood.com/chain/connecting/ . Mainnet is 4663; testnet is 46630. The shared authentication frame will use Robinhood as its default EVM chain, keep Ethereum and Solana support, and order EVM wallet choices first. This does not migrate existing Solana payment/token routes or claim a deployed Robinhood transaction flow.
- Current registration is a public agent self-registration API, not a wallet transaction. Required fields are name, description, and 1–10 capabilities. There is no listing fee, listing price or endpoint field in this contract. Do not invent a payment or setup form for unsupported fields. Task prices remain proposal-specific; technical connection instructions belong in owner tools/docs.
- The legacy page activates the agent immediately after receiving credentials and ignores confirmation errors. Replace that behavior with explicit credential acknowledgement and an activation result bound to the created agent. Registration and activation are separate outcomes.
- Credentials are returned once. Keep them in memory, masked until revealed, with individual copy/download actions. Persist only a non-secret receipt marker to avoid accidental repeat registration after reload. Opening My agents may store the API key in the existing session slot only after the owner explicitly chooses that action. Never store the recovery code or claim token automatically.
- The name check needs trimmed input, HTTP validation, abort/identity protection, retry and a final server check. Remove deletion of stale pending agents during registration; pending records still own their names. Add normalized-name uniqueness for new registrations and maintain it on rename. Existing duplicate-name data will not be deleted or silently migrated.
- Add an optional validated DiceBear seed for the avatar chooser, with the same seed exposed to the directory/profile. Existing ID-based avatars stay the fallback. No remote avatar upload or dummy file control.
- Existing Solana token launch and token image upload remain in My agents, where they already work as separate actions. They no longer interrupt creation of a service listing. Legacy API fields stay supported. No unsolicited token launch during registration.
- An EVM receiving wallet can be recorded during registration only with a signed, name-bound, fresh ownership proof. Solana remains an optional additional address. Neither an address field nor wallet connection alone is a payment-success claim.

## Design brief

Direction: focused app listing editor, approved Hive logo/type/tokens, Robinhood accent.
Density: comfortable, narrow form column plus a compact listing preview; flat divided fields.
Flow: listing details → review → save access details → activate. The preview uses only supplied text and selected avatar; no invented price, rating, badges or availability.
Motion: short GSAP element entrances, no continuous animation around credential controls, reduced-motion support.

References: prior approved app units, supplied design guides and Rare UI/ThreeUI interaction research. Native fields, radio avatar choices and a clear review list are preferred to promotional tiles.

## Implementation sequence

1. Add the shared Robinhood chain/wallet ordering while retaining legacy support.
2. Harden trimmed name checks, registration validation/uniqueness and explicit activation; keep old API callers compatible.
3. Build draft restoration, avatar/service details, validation/name checking and review inside the approved app shell.
4. Add optional EVM proof and Solana address, safe credential reveal/copy/download, explicit activation and non-secret recovery receipts.
5. Test parser/request/race/activation/wallet defaults; browser-test both themes, 320–1440px, name races, unknown registration results, credential privacy, activation retry, keyboard and motion. Intercept all writes; no agent or wallet mutation in QA.
6. Run build, TypeScript, scoped lint and visual review. Update evidence and stop before Unit 09.

## Delivery and evidence

- Replaced the legacy registration page with a listing editor, local DiceBear avatar chooser, live name check, optional links/wallet, review, and explicit credential-save/activation steps. Both themes use the shared app shell; mobile fields and access controls fit at 320px. GSAP entrances respect reduced motion.
- Draft storage allows only non-secret listing fields. API keys and recovery codes stay in memory until an explicit copy/download or Open My agents action. Reload restores a non-secret receipt and does not resubmit registration. An uncertain request result requires checking the listing first.
- Registration preserves pending names, uses normalized-name uniqueness for new records, and keeps activity-log failures from hiding successful creation. Activation validates the created identity and permits safe same-agent retries. Existing records are not deleted or migrated.
- Wallet choices put EVM first; Robinhood is the default EVM network. Solana connectors and Solana-only identities remain supported. Mixed-wallet identity tests cover the sign-out regression caused by comparing an EVM connection with a stored Solana primary address. Optional EVM registration ownership uses a signed, expiring, name-bound message.
- The chosen avatar seed follows the agent into the directory, profile, task selection and task workspace. Existing agents keep their ID-based fallback.
- Production build, TypeScript and scoped new-component lint passed. The redesign regression suite passed **94/94 tests**, including 21 added registration/authentication tests. Logs: `/private/tmp/hive-register-final-{build,types,lint,tests}.log`.
- The final production-preview registration browser audit passed **54/54 checks** at ten widths from 320–1440px in both themes. It covers stale name checks, failures/retry, preserved drafts, preview, credential privacy, an actual download with exact fabricated access details, activation failure/retry, reload recovery, text growth and reduced motion. Desktop dark, mobile light and mobile access screenshots were visually inspected. Results: `/private/tmp/hive-redesign-qa/register-results.json`.
- Shared authentication/avatar regressions passed **54/54 task-creation checks** and **60/60 task-workspace checks** on the final build. No runtime exceptions were recorded by these scripts.

## Validation boundaries

The real public name-check endpoint and EVM wallet picker were exercised. Registration and activation writes were intercepted in the browser; route tests used isolated database stubs and offline signatures. No real agent, wallet signature, account mutation, payment or token launch was made. No Robinhood RPC transaction or deployed configuration was verified. New unique indexes are defined in the route but were not applied to a live database during QA. Historical name duplicates remain outside this change. Authenticated owner-dashboard entry still needs an end-to-end check with a disposable account before release; its redesign is Unit 09.

Review at http://localhost:3100/agent/register . Work remains local and unpushed on `main_redesign`. Stop before Unit 09 (My agents).
