# Unit 11  -  Agent wallet settings

Status: implemented and locally validated; ready for user review. The user approved continuation from Owner tools.

## Contract audit and direction

The existing `/agent/manage/[id]` ignores its ID, displays no current wallet, uses legacy presentation and submits a Solana address without the signature now required by its API. The primary wallet is immutable once set; Solana supports replacement and removal. Preserve those rules. The PIN is an interface gate; operational authorization remains the agent API key.

Direction: focused app settings, comfortable spacing, flat divided wallet sections, restrained Manrope hierarchy, short GSAP element entrances. Keep the original Hive mark and existing lime/theme tokens. Primary wallet first, Solana second. Show addresses and recorded verification; no balances, invented payment support, decorative cards or network launch explanations.

Sources: supplied `/Users/tim/Coding/vibecoding/Design styles/design-guides.md`; coss dialog https://coss.com/ui/docs/components/dialog ; Robinhood network configuration https://docs.robinhood.com/chain/connecting/ ; Privy wallet interfaces in installed package and https://docs.privy.io/wallets/using-wallets/solana/sign-a-message . Existing shared configuration already uses Robinhood Chain 4663 as default and retains Solana connectors.

## Implementation sequence

1. Add a private wallet read/write contract, bound to the URL agent and authenticated identity. Return only agent identity, wallet addresses, verification dates and a revision.
2. Require new EVM/Solana ownership proofs to bind the agent, network, address, previous address and revision. Consume proofs once. Compare saved state during writes; preserve immutable primary-wallet rules. Harden the legacy generic EVM write against unsigned linking and add concurrency checks to legacy wallet writes while keeping signed Solana compatibility.
3. Replace the route with the shared app shell and PIN gate, exact-ID rejection, current-wallet sections, wallet selection, review, sign/save and confirmed result. Do not request transactions. Keep signatures memory-only. Persist only a non-secret uncertain-save receipt, resolve by a fresh read, and require deliberate acknowledgement before retry if no matching save is found.
4. Check data and signature boundaries, wrong owner, stale revision, replay, cancellation, connector errors and unknown results. Test real signatures offline, not with user wallets. Browser mutations and wallet providers use isolated fixtures.
5. Audit both themes, small screens, long addresses, focus/dialog behavior, copy failure, motion and reload. Update evidence and stop before Unit 12 (agent verification).

## Scope limits

Linking proves wallet control; it does not move funds or migrate payments. Do not change wallet-recovery policy or token fee-wallet configuration. Legacy unverified addresses must not gain verified status by display alone. Physical mobile wallets, deployed database state and real wallet connections are separate from local UI/signature validation.


## Delivered behavior

- The new app page uses the exact route agent ID. A mismatched key is rejected before private reads or first-time PIN setup. Invalid agent links show a direct route back to My agents.
- Primary and Solana sections display full selectable addresses and recorded verification status. Connecting and choosing a wallet does not save it. The review names the agent, network, current address and proposed address before signing.
- EVM signing checks Robinhood network selection and the selected account. Solana uses the installed Wallet Standard connector. Signature rejection preserves the review. Connector restoration no longer prevents opening the wallet picker after Privy is ready.
- Successful saves require the expected identity/address/revision and a fresh matching GET. A lost response retains only a non-secret request receipt and can resolve through the saved state. If it does not match, the user must inspect and acknowledge the current wallet before another attempt.
- Primary-wallet replacement stays unavailable. Existing unverified primary addresses need proof before a verified label. Solana replacement and removal retain explicit review. Removing the wallet clears its verification date.
- The generic profile endpoint now rejects unsigned primary-wallet linking and compares prior wallet state on all wallet changes. Existing signed Solana API operations remain supported. Bio and other profile edits do not change wallet revisions.

## Validation

- Final production build, TypeScript, scoped lint and `git diff --check`: passed.
- 146 regression tests passed, including 16 new wallet tests. Offline tests verify actual EVM and Ed25519 signatures, exact-agent binding, expiry, altered messages, replay, stale revisions, legacy writes and removal boundaries.
- 45 production-preview Chrome checks passed. Both themes were checked at 320/375/390/600/760/768/1024/1100/1280/1440px. Additional checks cover wrong-key PIN setup, exact review, wrong network, rejected signing, unknown saves across reload, copy failure, Solana signing/removal, read errors, long identity, enlarged text and element entrances.
- Four wallet-save requests were intercepted. EVM and Solana providers were simulated in an isolated browser tab. No real wallet connection, user signature, transaction or account mutation took place. The actual unauthenticated wallet GET returned 401.
- Repeatable checks: `scripts/redesign/check-wallet.mjs` and `tests/wallet-redesign.test.mjs`. Browser results: `/private/tmp/hive-redesign-qa/wallet-results.json`. Screenshots: `wallet-{light,dark}-{320,1440}.png`, `wallet-review-dark-1440.png`, `wallet-solana-review-dark-320.png` in the same folder.

## Review and remaining limits

Open http://localhost:3100/agent/dashboard , then Settings → Manage wallets. Use the intended agent's access details. The local preview does not bypass owner authentication for review.

This is browser-emulation and offline-signature evidence. Real extensions, mobile wallet handoffs, deployed database concurrency and authenticated production persistence have not been exercised. Legacy non-EVM values in the primary-wallet field need account recovery; this unit does not migrate those identities. The existing five-line Solana proof format remains available through the operational profile API; the new settings endpoint uses the stronger agent/revision-bound format. The PIN remains a UI gate, with API-key authorization at the server.

Work remains local and unpushed on `main_redesign`. Stop for review before Unit 12 (agent verification).
