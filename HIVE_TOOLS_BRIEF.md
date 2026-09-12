# Unit 10 — Owner tools

Status: implemented and locally validated; ready for user review. User approved continuation from My agents.

## Contract audit and design

- Original app composition: compact Tools, Webhooks, Tokens and Points views. Use the approved Hive mark, Manrope, light/dark tokens, underline navigation and short GSAP element entrances. Tool definitions and webhook events are owner-facing technical fields needed to configure these features; avoid marketing copy or invented metrics.
- References rechecked: coss dialog patterns (https://coss.com/ui/docs/components/dialog), Rare UI (https://rareui.com), ThreeUI (https://threeui.com). Use native accessible dialogs and original flat lists. No decorative 3D scene on a configuration form.
- Keep the current API-key plus owner-PIN UI gate. Saved keys prefill but do not bypass verification. No new wallet, backend account or network migration is implied. Robinhood remains the shared primary wallet direction; existing Solana actions retain their actual network in review details.
- Tool contract: up to 25 entries; globally unique 3–64 character tool names; 10–500 character descriptions; endpoint passes server SSRF checks; JSON object schema up to 20KB; 0–10,000 USDC per call. Paid tools currently require the existing Solana payout address. No unsupported chain selector or remote endpoint test button.
- Existing tool updates replace the full array. Add a previous-array condition so simultaneous save/delete returns conflict instead of overwriting newer data. Preserve token fields and server URL validation. Tool names stay fixed while editing.
- Webhooks: create URL/events/description, pause/resume/edit/delete, newest delivery records. Signing secret appears once on create; keep it masked and memory-only until deliberate copy and acknowledgement. No test-delivery endpoint exists, so do not invent one. Unknown create results retain a non-secret receipt across reload and require checking subscriptions before a deliberate retry.
- Tokens: preserve agent-token and registered-tool-token launch, optional URL/image upload and existing token links. Review exact agent/tool, symbol, image and Solana network; no invented launch fee, balance or transaction quote. Backend launch services use existing server funding/configuration. Fix exact-agent validation and add an atomic per-tool launch claim. Unknown launch results remain blocked pending verification; do not automatically launch again.
- Points: use returned balance, rate and minimum; require the exact verified linked Solana recipient. Confirm amount, output and recipient. Preserve an uncertain attempt across reload; no automatic conversion retry. Do not fetch unrelated client funds.

## Implementation units

1. Scope owner reads and add private/no-store responses, tool concurrency and tool-launch identity/claim protection.
2. Build PIN-gated shell and tool table/editor/removal confirmation with input retention and schema validation.
3. Build webhook subscription editor, delivery history and protected one-time secret result.
4. Restore token launch/image workflows and points conversion under separate views, with conservative recovery.
5. Validate parsers/routes and browser flows in both themes and mobile widths. Intercept all uploads, webhooks, launches, conversions and other mutations. No actual external messages, endpoint calls or chain actions.
6. Update evidence and stop for review before Unit 11 (wallet management).


## Delivered behavior

- `/agent/dashboard/tools` uses the app shell and the existing owner PIN gate. Four URL-backed views keep each task focused. Agent identity stays beside its avatar at narrow and wide widths; refresh controls remain beside their section title on mobile.
- Tools use flat price-bearing rows, an add/edit dialog, fixed registered names and deliberate removal. Validation and conflict errors retain the draft. Unsaved edits require save or discard before ordinary link navigation and dialog dismissal.
- Webhooks provide event selection, editing, pause/resume, removal and independent delivery history. New signing secrets are masked, never stored in browser storage and require saved-secret acknowledgement. Copy failure permits manual selection. An uncertain create request retains a non-secret receipt across reload.
- Tokens support agent and registered-tool launches, image URL/upload, exact-target review and existing mint links. Launch requests bind to the authenticated agent. Per-tool database claims prevent concurrent launches; writes preserve other tool tokens. Unknown service outcomes remain blocked.
- Points show returned balance/history, rate/minimum and the verified recipient. A successful conversion requires the expected amount and a transaction signature; an uncertain request survives reload without automatic retry.

## Validation and evidence

- Final production build, TypeScript, scoped lint and `git diff --check` passed after the mobile/identity spacing adjustment.
- 130 regression tests passed, including 20 new model/route checks. New tests cover malformed data, secret results, tool conflicts, exact-agent launches, duplicate claims and conversion outputs.
- Final production-preview browser run: 70/70 checks passed, including explicit agent-header alignment checks in both themes at 320 and 1440px. Nineteen writes were intercepted. Tool layouts were checked at 320/375/390/600/760/768/1024/1100/1280/1440px.
- The browser script is `scripts/redesign/check-tools.mjs`; results are `/private/tmp/hive-redesign-qa/tools-results.json`. Screenshots include `tools-list-{light,dark}-{320,1440}.png`, `tools-{webhooks,tokens,points}-{light,dark}-{320,1440}.png` and `tools-webhook-secret-dark-320.png` in that folder.
- Real unauthenticated GET requests to `/api/agents/me/tools` and `/api/webhooks` returned 401. Every upload, subscription change, launch and conversion in browser QA is intercepted. File selection is exercised through Chrome, but the upload response is fabricated. The script clears its fabricated agent session and returns to the actual signed-out page.

## Limits and next unit

- This is local UI and route validation, not evidence of real webhook delivery, image hosting, a funded Bags launch, database index deployment, wallet signing or token transfer. The browser audit uses Chrome emulation, not physical iOS/Android devices.
- The PIN is an owner-interface gate. Existing operational API-key authentication remains; this unit does not claim a new server PIN session or wallet account migration.
- Existing token services and points conversions run on Solana. Shared wallet entry retains the previously implemented Robinhood priority; no network migration is implied by this page.
- Unknown token launches require checking stored launch/mint state and operational reconciliation if the service result was lost. Unknown conversions require checking points history and the wallet; the current contract has no idempotency/reconciliation endpoint to make an automatic retry safe. Cross-tab or separate-device conversion idempotency is not introduced here.
- Existing token metadata for a removed tool remains in the database. The token selector lists currently registered tools; this unit does not add an archive for removed tools.
- All changes remain local on `main_redesign`. Review this unit before starting Unit 11, wallet management.
