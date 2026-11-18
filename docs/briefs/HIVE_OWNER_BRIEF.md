# Unit 09  -  My agents

Status: implemented and locally validated; ready for review. The user approved continuation from List agent.

## Contract and direction

- Use the approved Hive app shell, Manrope and light/dark tokens. Keep Robinhood-first wallet configuration and Solana compatibility; add no launch explanation to product copy.
- Direction: compact owner workspace. Flat work rows, restrained identity header, four URL-backed views: Work, Opportunities, Payments, Settings. No marketing sections, synthetic performance charts or unrelated metric tiles. GSAP element entrances respect reduced motion.
- Research: inspected the current owner page and profile, PIN, payments, opportunities, plugin, token and task APIs. Rechecked coss underline tabs (https://coss.com/ui/docs/components/tabs), Rare UI (https://rareui.com) and ThreeUI (https://threeui.com). Use native navigation links and controls; decorative 3D does not help this working page.
- The API key identifies one agent. There is no authenticated multi-agent roster contract; do not invent a list. Offer deliberate Switch agent and List agent actions.
- Keep the owner PIN gate. A stored API key must not skip it on reload. First access can set a PIN; existing PIN verification precedes private UI reads. PIN is memory-only. This preserves the existing UI contract, not a claim that every operational API is PIN-protected.
- Add a private assigned-work read scoped to the authenticated agent ID and existing linked-wallet assignments, with bounded pagination and filters. Never accept a supplied owner/agent ID as authorization. Work actions open the approved task workspace.
- Existing payment totals sum completed-task budgets as USD/USDC regardless of currency or signature. Do not display this aggregate. Show each recorded amount and payment evidence separately, using explicit units; retain legacy Solana explorer links only for valid Solana signatures.
- Profile edits use current supported fields. Validate safe URLs and string capabilities on both sides. Wallet management, verification, recovery and tool editing retain their named routes, with full redesigns in Units 10–13.
- Keep plugin installation supported as a deliberate action. Webhook, token launch and point-conversion controls will be grouped under owner tools as Unit 10 subunits; their APIs remain available. Do not automatically trigger integrations, token creation, key rotation or monetary actions.
- Key rotation needs a deliberate confirmation and a one-time masked result, with unknown-outcome recovery and no automatic retry. PIN writes must use a compare-and-set condition to avoid concurrent overwrite.

## Sequence and checks

1. Add bounded private work API and truthful payment mapping; preserve API compatibility.
2. Build PIN/key entry and first-access PIN setup, identity header, work/search/filter/pagination and opportunity rows.
3. Add payment history, editable service settings, plugin actions, and explicit key/PIN management.
4. Test parsers, identity boundaries, stale reads, PIN concurrency and key rotation. Browser writes must be intercepted.
5. Audit 320–1440px in both themes, keyboard focus, URL history, independent error/retry, secret handling and reduced motion. Run build, TypeScript and scoped lint.
6. Update delivery evidence and stop for review before Unit 10.

## Delivery and local validation

- Replaced the 2,104-line legacy page with separate owner workspace, access gate, settings, plugin and security modules. The page uses the approved app shell, theme tokens and element-level GSAP entrances.
- Work has server-side search, status filtering, bounded pagination, update dates and actions that open the task workspace. Opportunities exclude tasks reserved for another agent. Payments show actual paid amounts only with known stored token/chain details; otherwise they label the task budget. Mixed-currency totals are omitted.
- Saved keys prefill access without bypassing PIN verification. First-access PIN setup and changes compare the prior database state. Key replacement compares the current hash; a losing request never receives a key that was not stored. Unknown key-change outcomes disable another automatic attempt. PINs are never stored in the browser.
- Service settings validate input, retain failed edits and block navigation until edits are saved or discarded. The selected avatar and rating star match the public profile. Wallet, verification, recovery and tool-management links use the agent's exact ID or existing route.
- Build, TypeScript and scoped lint passed. **110 regression tests passed**, including 16 new owner model/route tests. Logs: `/private/tmp/hive-owner-final-{build,types,lint,tests}.log`.
- **57 owner browser checks passed**, covering both themes at ten widths (320–1440px), PIN setup/rejection, session privacy, work filtering/pagination, stale responses, independent work recovery, unpaid budgets, profile errors/unsaved edits, plugin installation, PIN change, key confirmation/save/reload/unknown outcomes, identity switching and motion.
- Browser review found and fixed a mobile name-column collapse and an Escape dismissal of an unsaved key. Desktop dark work, mobile light work, and mobile dark settings/payment screenshots were inspected. Shared task dialogs now suppress Escape while an action or required save is pending.
- The shared task workspace passed **60/60 browser checks** after the dialog Escape fix, with all task/payment writes intercepted.
- The actual local work endpoint returned **401** with no credentials. All authenticated reads and writes in browser QA used isolated fixtures; no real agent, PIN, key, profile, plugin, task or payment was changed.

## Limits and follow-on units

The API key identifies one agent at a time. A multi-agent roster and server-issued owner session are not part of the current contract. PIN verification gates this UI; operational APIs still use API-key authorization. No end-to-end production owner login, live key rotation, wallet signature or chain transaction was performed. Historical work with only an unverified address or name is not treated as proven ownership. A verified address can select legacy work only when no conflicting canonical assignment ID exists; migration of ambiguous records is outside this unit.

Owner tools remain the next unit. Its scope includes existing tool registration/tokenization plus grouped webhook controls, agent-token launch and points conversion. Those existing APIs are retained, but their old dashboard controls were not copied into this workspace. Wallet management, ownership verification and recovery retain their existing destinations for Units 11–13. The whole app redesign is not complete.

Review: http://localhost:3100/agent/dashboard . Start with the access screen; use your own saved agent credentials to review private data. QA screenshots contain fabricated data only: `/private/tmp/hive-redesign-qa/owner-work-{light,dark}-{320,1440}.png`, `owner-settings-dark-320.png`, `owner-payments-dark-320.png`. Results: `owner-results.json` in that folder. Work remains local and unpushed on `main_redesign`.
