# Unit 05 — Create task

Status: implemented and locally validated; ready for review. The user approved this unit and requested stars beside profile review ratings.

## Research and contract decisions

- Keep the approved app shell, Hive logo, Manrope, lime actions, and both themes. Use a quiet writing workspace with numbered form sections and a narrow task summary. Rare UI informs short control/element transitions; the ThreeUI reference does not justify putting a 3D scene inside a task form. References: https://www.rareui.com/ and https://threeui.com/.
- Read the existing create form, authenticated create/instant-match/assign routes, input limits, token validation, draft builder, and Privy providers before implementation. The new form preserves authenticated posting; it does not request a payment or claim new chain support.
- Existing standard creation automatically assigns an agent, even when the form intends direct hire. A subsequent assignment can fail while the old form reports success. Add explicit `assignmentMode` for the redesigned form. `proposals` leaves agent choice with the client; `direct` reserves the selected ID. Requests without this field retain their existing behavior. The background bidding sweep must skip tasks reserved for a selected agent; proposal tasks may receive bids.
- Direct hire remains two requests. Persist a returned task ID before assignment, retry assignment against that same ID, and report partial success honestly. Assignment must reject inactive agents, preserve ownership checks, use an atomic Open-state claim, and allow safe same-agent retry.
- A failed/ambiguous creation response must not trigger automatic resubmission. Persist an attempt marker before the request; after an unknown outcome, link to My tasks for verification. Do not claim server-wide idempotency. Explicit validation/auth/rate-limit rejections can be retried.
- Preserve fixed USDC or negotiable budget, category, tags, requirements, review checklist, and optional token details. Token launch currently targets Bags/Solana; show that only within its conditional fields. No fake attachments or wallet-payment action. Draft generation and explicit instant matching remain optional existing capabilities, behind deliberate actions; generated text must be reviewed before use.
- Match server limits: title 8–120, description 40–5000, requirements 4000, up to eight tags of 32 characters, up to eight checklist items of 180 characters, budget at most 100,000 USDC with two decimals. Validate before review and submission; focus the first invalid field.
- Keep a versioned session draft with all form fields and agent identity; migrate valid prior drafts and ignore malformed structures. Never store auth or human-verification tokens. Clearly indicate unavailable session storage.
- Use the existing Privy wallet/email/Google configuration in a presentation-free provider; match the new theme and logo. No legacy backgrounds, navbar, or footer on this route.
- Cloudflare documents a 300px minimum for flexible widgets and a 150px compact widget. Use compact verification in this form so it fits 320px screens; match the chosen theme. Source: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/.

## Page sequence

1. Write: title/category, task description, requested output and constraints, review checklist, optional tags and token details.
2. Set budget and agent: fixed/negotiable amount; receive proposals, let Hive choose, or retain the agent selected from a profile. Invalid or unavailable selection blocks submission and offers retry or deliberate removal.
3. Review: complete readable brief, budget and agent method, edit action, sign-in when needed, human verification, explicit Post task/Assign task action. Signing in never submits automatically.
4. Receipt: task link and actual outcome. Partial assignment uses the existing task; unknown create outcome points to My tasks. No timed redirect or claim that money moved.

## Delivery and validation

- Modular data model, submission controller, provider, form, and styles; GSAP element entrances respect reduced motion and keep focus stable.
- Validate model boundaries, draft migration, creation/assignment outcomes, explicit mode routing, agent status and assignment races with isolated tests. No test writes to the live database or outbound agent messages.
- Browser-check signed-out writing/review, draft reload, conditional fields, real selected-agent lookup, invalid/missing selection, mobile navigation, both themes at 320–1440px, keyboard focus, overflow, reduced motion, and star icons. Test authenticated transport outcomes with isolated stubs; distinguish that from live authenticated creation.
- Build, typecheck, scoped lint, visual inspection, then update the tracker and report this unit for review before task detail.

## Implementation and review evidence

- Preview: http://localhost:3100/create. Selected-agent entry: http://localhost:3100/create?agent=69d4a15da63b69b835bdf914 . The selected name is fetched from the existing endpoint.
- New modules: `components/redesign/create/{CreateTaskPage.tsx,model.ts,submission.ts,create.module.css}` and `AuthenticatedFrame.tsx`. The create route has new metadata and no legacy landing presentation.
- Both draft text and agent ID survive reload. Signing in opens the existing Privy dialog and does not post. The header omits its redundant new-task action on this route. The final receipt links to the specific task; there is no timed redirect.
- The optional suggestion is shown separately, then accepted into editable fields. Suggested output requirements are included in the visible requirements field. Budget and selection remain client decisions.
- Posting uses explicit `proposals` or `direct` modes on the existing route, or the existing explicit instant-match endpoint. Legacy callers retain their original behavior. Background bidding excludes reserved direct tasks. Direct assignment preserves ownership checks, rejects inactive agents, and checks the requested identity. An atomic Open-state claim prevents competing assignments; deterministic bid/activity IDs support recovery after a partial write.
- 18 new model, transport, route, and verification tests pass. They use in-memory stubs and do not contact the database or agents. Existing directory/profile/task parser tests also pass (41 combined tests).
- All 54 create browser checks pass: real agent lookup, writing/review/edit, validation focus, draft reload, optional token fields, sign-in open/cancel, unknown and partial receipts, both themes at 320/375/390/600/700/768/900/1024/1100/1280/1440px, mobile menu/Escape, long names, malformed/missing/inactive agents, reduced motion, completed element entrances, and zero task-write attempts.
- Desktop/mobile screenshots in both themes were inspected. This caught and fixed an intrinsic-width form column and missing app-header gutter. Results: `/private/tmp/hive-redesign-qa/create-results.json`; screenshots: `create-brief-{light,dark}-{320,390,1440}.png`, `create-review-light-1440.png`, and `create-review-dark-320.png`.
- Production build, TypeScript, and scoped UI lint pass. Changed API routes retain seven existing `any` warnings and no lint errors. Verification uses the selected theme and compact size; failed script loads can be retried.

## Validation boundary and next unit

This is local production-browser evidence plus isolated contract tests. No live authenticated task was posted, no agent was notified, and no payment was attempted. Authenticated create/assign outcomes were validated with stubs; suggested-text normalization was unit-tested, and receipt states used isolated session fixtures. The live draft-generation service was not called. Human verification was checked at its component boundary, not by completing a real challenge.

Creation has no server-wide idempotency guarantee. The form guards an in-flight request, retains its task receipt, and persists an unresolved-attempt marker in session storage. After an ambiguous response, the user must check My tasks before deliberately starting another task. Storage restrictions can prevent cross-reload recovery, and the page reports unavailable draft storage. Assignment recovery is retryable but is not a multi-document database transaction.

The task-detail destination still uses its previous design. It is Unit 06 and awaits review of this page. Work remains local, uncommitted and unpushed.
