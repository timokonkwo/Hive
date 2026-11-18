# Unit 06  -  Task detail

Status: implemented and locally validated; ready for review. User approved progression from Unit 05 with “Continue.”

## Page and contract audit

- Public task details: `/api/tasks/[id]`. Public proposals: `/api/tasks/[id]/bids`. Both can fail independently. A task's budget and an agent's proposed price are distinct; neither is a payment receipt.
- Task states: Open, In Progress, In Review, Completed; preserve other stored states without inventing actions. The existing page is a 1,655-line marketing-style component with weak error handling and mixed private/public loading.
- Client actions use existing Privy authentication and server ownership checks. Add a private, non-cached access result to the task GET response when credentials are supplied, instead of exposing private owner IDs or relying only on client address comparisons. Preserve public redaction.
- Agent actions use the existing session agent credential and `/api/agents/me`. Do not infer agent registration from wallet sign-in. No credential is displayed, placed in URLs, logged, or newly persisted. Users without an agent session can open My agents.
- Proposal management uses the existing PATCH route. Its current acceptance path lacks a task-state claim; fix that boundary so a closed task cannot be reopened and concurrent choices cannot both assign agents. Keep action confirmations specific to the chosen agent and proposed price.
- Owner-only work history uses authenticated GET `/submit`. It must never be fetched for a public viewer. Display actual versions, summary, output, and rejection details. Agent submission retains POST `/submit`, its summary minimum, output types, and required specifications. No fabricated attachment uploader.
- Revision requests use `/reject`; reviews use `/review`; completion uses `/complete`. Ratings use labeled star choices. A failed action preserves the user's text; refresh authoritative task state after writes.
- Messages use `/api/messages/threads` and its thread GET. Keep a selected thread across refresh; clear private content on identity change. No messages are sent during development/QA. New owner messages require an assigned agent or an existing thread, avoiding a thread with no recipient.
- The existing payment build/send/complete endpoints use Solana mainnet USDC. Build a payment preview before signing, require the linked wallet address, show the exact recipient and amount, retain a signed transaction's signature before broadcast, and offer verification against that signature after an uncertain response. Never create a fresh transfer automatically. Wallet linking stays in My tasks/account settings because it requires the existing ownership-proof flow.
- The current completion route rejects a retry of the same signature even if the first verification was interrupted. Permit re-verification only for the same task and authenticated client; preserve cross-task replay protection and atomic task completion. No live payment will be made during validation.
- Public activity currently has no task-specific route. Add a bounded, read-only history endpoint that uses existing public redaction, orders stored events, and handles both historical ObjectId and string task IDs. It must not invent a timeline from guessed dates.

## Design

Use the approved app shell, Hive logo, Manrope, lime accents, and both themes. The task title and status lead; a compact rail holds budget, assigned agent, and the next supported action. The central workspace has Brief, Proposals, Work, and Activity views. Messages are an adjacent, named workspace section, not a floating chat widget. On mobile, the summary and actions become inline and tabs remain readable.

Flat proposal rows expand into the actual proposal. The brief uses a reading column, review checklist, and requested output. Work uses real submission versions and safe links with readable text/code. Review/payment/revision actions use focused dialogs with keyboard dismissal, focus return, pending locks, and persistent failures. Short GSAP element entrances respect reduced motion. No 3D decoration, invented confidence badges, currency-less earnings, or promotional feature cards.

References revisited: https://www.rareui.com/ and https://threeui.com/ . Their interaction ideas inform element transitions, not the page structure or copied artwork. Existing local design research and approved app units remain the style reference.

## Implementation sequence

1. Add page-specific normalizers, role/state action rules, private access result, and bounded activity read.
2. Replace legacy page/layout with modular task workspace and metadata; attach the existing authentication provider without legacy presentation.
3. Build brief/proposals/work/activity and independent empty/loading/error/retry states; preserve valid URL tab state and navigation.
4. Add owner proposal/review/revision actions and agent proposal/submission forms using existing APIs. Protect pending actions, refresh after outcomes, and keep errors beside the action.
5. Add private thread selection and composer with identity isolation and conservative retry behavior.
6. Rebuild payment confirmation around exact server details, existing wallet signing, stored signature recovery, and same-task completion retry. No automatic wallet linking or fund transfer.
7. Validate pure models, route state/ownership/replay guards, payment recovery and UI. Browser fixtures intercept writes; real reads are checked separately. Test both themes, 320–1440px, long titles/addresses, keyboard/dialogs, URL history, stale requests, and reduced motion.
8. Build, typecheck, scoped lint, visual inspection, and update this brief. Report for review before Unit 07 (My tasks).


## Implementation and validation

Implemented the sequence above in `components/redesign/task/`, with a thin route entry and concise task metadata. Resources load independently, ignore aborted responses, and hide prior private data as soon as the identity or access changes. Dialogs use native modal focus handling. Proposal price remains separate from the stored task budget. The activity view shows at most 100 stored records.

- Production build: passed, 122 static pages generated; task detail and activity are dynamic routes.
- TypeScript: passed. Scoped lint for the new task components, task page/layout, and activity endpoint: passed without warnings.
- Data and route regression suite: 56/56 passed across marketplace, agents, profiles, creation, and task detail. Task detail adds 15 tests, including closed-task acceptance, competing task claims, partial-acceptance repair, authenticated signature replay boundaries, explicit access/private caching, and bounded public history.
- Final production browser suite: 60/60 passed, including native keyboard dismissal and focus return, payment-reference restoration after reload, and late private responses after access removal. No runtime exceptions. Both themes fit 320, 375, 390, 600, 760, 768, 1024, 1100, 1280, and 1440px. Desktop work, mobile brief, and narrow payment screenshots were visually reviewed.

Repeat with `scripts/redesign/check-task.mjs`. Evidence: `/private/tmp/hive-redesign-qa/task-results.json`, `task-live-dark-1440.png`, `task-brief-{light,dark}-{320,390,1440}.png`, `task-owner-work-dark-1440.png`, and `task-payment-dark-320.png`.

## Evidence boundaries and remaining limits

Actual public task data was read from the local production preview. Owner/agent writes, messages, work submissions, payment builds, signatures, broadcasts, and completion responses were intercepted in an isolated browser. Route tests use in-memory database and transport doubles. No real task, message, payment, or review was created. These checks establish local UI and route behavior, not live wallet or chain completion.

The existing payment path remains Solana USDC. Robinhood visual accents do not imply a new chain integration. Official wallet behavior reference: https://docs.phantom.com/solana/sending-a-transaction . Account linking stays in My tasks and uses the existing ownership-proof flow. If a signed transfer remains unconfirmed or expires, the page conservatively retains its reference; it does not create another transfer automatically. No new wallet-provider integration was added.

Existing multi-document database updates are not full transactions. The scoped fixes repair proposal assignment and same-task payment retries, but do not claim a general backend security or transaction audit. Physical-device testing and full ASD-STE100 dictionary certification were not performed. The copy uses direct action labels and factual states.

Unit 07 is not started. Review this page before progression. Nothing was committed, pushed, or deployed during Unit 06.
