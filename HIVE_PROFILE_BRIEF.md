# Unit 04 — Agent profile

Status: implemented, validated, and ready for review. User approved progression from Unit 03 with “Continue.”

## Contract research

- Profile: public `GET /api/agents/by-name/[name]`, with identity, bio, capabilities, stored rating/review count, website, wallet, recent assigned tasks (at most ten), recent proposals (at most ten), and token records.
- Reviews: public `GET /api/agents/[address]/reviews?page=1&limit=5`; actual rating, comment, task reference, tags, and date. No reviewer identity is supplied. Never invent a reviewer, review quote, or completed output.
- Hiring: `/create?agent=<ID>` loads the selected agent and opens the current task form. It is navigation, not an immediate hire, payment, or availability guarantee. The form requires authentication before submission.
- No listed service price, turnaround, availability, or delivered portfolio files are returned. Do not manufacture those fields. State that requirements and budget are set in the task form.
- Correct the profile endpoint's zero-reputation fallback to use the stored value (matching the directory); it currently substitutes an unrelated unbounded formula for zero.
- API route-handler parameters are already decoded; remove their second decode. This Next version encodes App Router page parameters (`get-dynamic-param.js`), so decode them once at the page/metadata boundary, then encode request/link paths. Browser checks cover percent signs, spaces, and encoded slashes. Review pagination preserves the current route instead of navigating to a new name path.
- Include registration status to prevent selecting explicitly inactive/pending agents from this page. Legacy records without a status retain the existing task-entry path; absence is not an online/availability claim.
- Keep earnings and “success rate” out of the profile: earnings lack a currency field, and the existing success rate measures assignments per proposal, not successful work.
- Token records remain a secondary disclosure with validated external destinations, not trading promotion. Proposals remain a separate labeled history view.

## Design brief

Direction: a practical service profile within the approved Hive app shell.
Density: comfortable reading, compact history rows.
Surface: open sections and rules; one task-entry rail on desktop, inline on mobile.
Type: clear names, readable descriptions, aligned facts.
Motion: short element entrances, no animated scores; reduced-motion support.
Do: consistent locally generated DiceBear identity, service/skills before metrics, visible work evidence, independent review recovery, exact task destinations.
Do not: medals, invented trust badges, decorative charts, repeated marketing blocks, generic feature cards, fake prices, fabricated samples.

## Implementation units

1. Share the directory avatar module so identity remains consistent across pages.
2. Add a guarded profile/metadata route and isolate only agent profile paths from legacy presentation; registration/dashboard routes retain providers.
3. Normalize profile and review payloads. Distinguish absent values, zeros, invalid IDs, unsafe URLs, missing profile, and service failures. Cancel stale requests; bound request time.
4. Build service/skills, work facts, desktop task rail/mobile inline action, recent task/proposal controls, actual reviews with URL pagination, and optional account/token disclosures.
5. Handle unknown profile, unavailable selection, missing bio/history/reviews, review-only failure, copy success/failure, malformed data, long text, and avatar failure.
6. Validate actual public data separately from intercepted fixtures. Check mobile, both themes, keyboard controls, task identity handoff, URL encoding, pagination/history, safe links, reduced motion, and loading/error recovery.
7. Run scoped lint, TypeScript, parser tests, production build, and visual review. Report Unit 04 before starting Unit 05.

## Follow-up for Unit 05

The existing create form can report a successful direct assignment even when the assignment request fails. Preserve this finding for the task-form unit; this profile only opens the form and does not submit or claim a completed hire.

## Implementation findings

- The public Sage response supplied genuine comments and task references. Profile completion totals initially differed from the directory because legacy assignments stored as agent names were omitted from the profile query. Added that matching case.
- Removed inherited metadata that generated a legacy promotional image with currency-less earnings and badges. Metadata now uses the agent name and service description without duplicating task aggregations.
- Added stable review/history ordering and bounded review pagination query parsing. Explicitly malformed registration status disables the profile task action.
- Production build and TypeScript passed. The 23 task/directory/profile data and route tests pass. Profile UI lint is clean; API lint has no errors and retains two existing `any` warnings. All 58 profile browser checks passed.

## Review evidence

- Preview: http://localhost:3100/agent/Sage
- The browser checked actual profile/review responses before applying isolated test fixtures. Completed-task counts matched the directory, and rendered comments matched the review endpoint.
- Directory-to-profile navigation preserves the avatar. Create task opens the existing form with the actual agent ID and resolves its name. No task was submitted, no account action was performed, and no payment was attempted.
- Both themes passed at 320, 375, 390, 600, 760, 768, 1024, 1100, 1280, and 1440px. Landscape and 125% text checks passed. Desktop/mobile service and review screenshots were visually inspected.
- Special-character names, review page/Back/reload, zero and missing metrics, safe external links, inactive selection, long text, history switching, independent review retry, malformed responses, stale review cancellation, clipboard fallback, and reduced motion passed.
- Results: `/private/tmp/hive-redesign-qa/profile-results.json`. Screenshots: `profile-live-{light,dark}-{320,390,1440}.png` and `profile-reviews-dark-{390,1440}.png`.
- This is local production and Chrome device-emulation evidence, not physical-device or deployed testing. Changes remain local on `main_redesign`; no push or deployment. Unit 05 awaits review.

## Rating stars and create-task handoff

The user requested stars beside review ratings and approved progression to Unit 05. Both the profile summary and written reviews now include a filled star when a valid rating exists. The full profile regression passes 59 browser checks, including the handoff to the redesigned create form. The directory also has rating stars as subsequently requested.
