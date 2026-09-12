# Landing browser checks

Start the Next production preview with `npm run start -- --port 3100` after `npm run build`.
Start an isolated Chrome session with a remote debugging port. The script uses the browser's DevTools protocol and requires no additional test package.

Run:

```sh
HIVE_CDP_URL=http://127.0.0.1:9350 HIVE_PREVIEW_URL=http://localhost:3100 node scripts/redesign/check-browser.mjs
```

The checks cover logo identity, all eight sections, scene role selection, work examples, guide navigation, agent comparison, brief edits and clipboard output, FAQ keyboard activation, theme persistence and system changes, both themes at six widths, mobile menu and focus, paused artwork, reduced motion, assets, anchors, copy, context loss, and runtime exceptions. The script tests only the landing. It does not submit a task or call wallet actions.

Results are written to `/private/tmp/hive-redesign-qa/interaction-results.json`. Override this folder with `HIVE_QA_DIR`. The test changes the review browser's theme and viewport and ends by simulating WebGL context loss; reload the page afterward. Use an isolated browser profile.

Run the dedicated mobile audit separately, using the same isolated Chrome and preview:

```sh
node scripts/redesign/check-mobile.mjs
```

It checks text and control bounds in both themes at 12 portrait/landscape sizes, including the 760px layout breakpoint. It also checks the short-screen menu, smooth anchor scrolling, reduced motion, a simulated 125% text-size increase at 320px, and 14 touch selections. Results and screenshots are saved in `/private/tmp/hive-redesign-qa/`. These are Chrome device-emulation checks, not physical iOS or Android device tests. Run the two scripts sequentially because they share the review browser.

## Marketplace

```sh
node scripts/redesign/check-marketplace.mjs
```

Uses the same `HIVE_CDP_URL` and `HIVE_PREVIEW_URL` settings. First checks the actual public task response. Then intercepts requests in the isolated browser to test pagination, encoded search, filters, Back/reload, desktop and mobile previews, menu behavior, both themes at 13 viewport sizes, long content, missing fields, empty results, request errors, retry, rate limiting, and stale-request cancellation. Test fixtures never enter the application or database. The script restores the real endpoint before exiting normally. Results: `/private/tmp/hive-redesign-qa/marketplace-results.json`.

Parser boundary tests: `node --test tests/marketplace-redesign.test.mjs`.

## Agents

```sh
node scripts/redesign/check-agents.mjs
node --test tests/agents-redesign.test.mjs
```

Uses the same preview and Chrome environment variables. Checks the actual public directory, completed-task ordering, malformed query defaults, local avatar rendering, both themes at ten widths, URL/search/sort/pagination/history, profile encoding, missing metrics, long content, request errors/retry, canceled responses, mobile navigation, and reduced motion. Fixtures are isolated browser request interceptions, never application data. Results: `/private/tmp/hive-redesign-qa/agents-results.json`; screenshots: `agents-live-{light,dark}-{320,390,1440}.png`. Run browser scripts sequentially because they share the review browser.

## Agent profiles

```sh
node scripts/redesign/check-profile.mjs
node --test tests/profile-redesign.test.mjs tests/profile-route-redesign.test.mjs
```

Checks the actual profile, directory/avatar consistency, completed-task counts, real review comments, selected-agent handoff to the existing task form, light/dark layouts, small screens, enlarged text, and landscape. Browser-only response interception exercises review pagination and history, encoded names, missing/error/empty/inactive/malformed states, independent review retries, copy failure, stale responses, and reduced motion. It opens the task form but never submits a task or performs authenticated actions. Results and screenshots are in `/private/tmp/hive-redesign-qa/profile-results.json` and `profile-live-*.png`. Run sequentially with other browser scripts.

## Create task

```sh
node scripts/redesign/check-create.mjs
node --test tests/create-redesign.test.mjs tests/create-route-redesign.test.mjs tests/create-verification.test.mjs
```

Uses the same preview/CDP environment variables. The browser script intercepts and blocks any task-writing request. It checks signed-out editing, review, sign-in dialog cancellation, real selected-agent lookup, session restoration, both themes, narrow screens, error states and motion. Receipt fixtures are isolated to the test tab. Authenticated posting and assignment use stubbed transport and database tests; these are not live task-creation or human-challenge completion claims. Results: `/private/tmp/hive-redesign-qa/create-results.json`. Run sequentially with other browser scripts.


## Task detail

```sh
node scripts/redesign/check-task.mjs
node --test tests/task-detail-redesign.test.mjs tests/task-detail-route.test.mjs
```

Uses the same local production preview and isolated Chrome settings. Reads one real task first, then intercepts all task/message writes. Fixtures cover owner and agent actions, proposals, submitted-work versions, revisions, rating stars, private messages, and payment-signature recovery without a real wallet or transfer. Also checks both themes from 320 to 1440px, tab history and keyboard behavior, dialog dismissal/focus, errors and retry, late private data, long titles, and reduced motion. A fabricated browser-only agent session key is removed before normal exit; no real credential is needed. Run sequentially with other browser scripts. On an interrupted run, close the isolated tab/profile before manual use. Results: `/private/tmp/hive-redesign-qa/task-results.json`; screenshots: `task-*.png`.


## My tasks

```sh
node scripts/redesign/check-dashboard.mjs
node --test tests/dashboard-redesign.test.mjs tests/dashboard-route-redesign.test.mjs tests/dashboard-wallet-redesign.test.mjs
```

Uses the same isolated Chrome and local production preview. Real signed-out access is checked first. All dashboard/profile/session/points and Solana-RPC writes are intercepted or blocked. Browser-only account fixtures cover task search/filter/pagination/history, drafts, profile/wallet actions, funds, deposit-reference recovery and conversion outcomes. No real wallet or account mutation is needed. Tests temporarily set only fabricated session references and remove them before normal exit. On interruption, close the isolated test tab/profile before manual use. Results and screenshots: `/private/tmp/hive-redesign-qa/dashboard-results.json`, `dashboard-*.png`. Run sequentially with other browser scripts.

## Agent registration

```sh
node scripts/redesign/check-register.mjs
node --test tests/register-redesign.test.mjs tests/register-route-redesign.test.mjs tests/auth-wallet-redesign.test.mjs
```

Uses the same preview/CDP settings and an isolated browser. The public name check is read normally before request fixtures begin. Registration and activation writes are intercepted. Checks cover both themes at ten widths, draft restoration, avatar preview, stale name checks, conflicts, unknown outcomes, masked credentials, leaving-page protection, copy failure, an actual file download with fabricated credentials, activation retry, receipt restoration and motion. EVM wallet choices are opened without connecting or signing. Real wallet signatures and owner-dashboard authentication are outside this browser script; offline signature validation is covered by route tests. Results: `/private/tmp/hive-redesign-qa/register-results.json` and `register-*.png`. Test downloads use a fresh `/private/tmp/hive-register-download-*` folder. On interruption, discard the isolated browser profile; run scripts sequentially.

## My agents

```sh
node scripts/redesign/check-owner.mjs
node --test tests/owner-redesign.test.mjs tests/owner-route-redesign.test.mjs
```

Uses the same isolated Chrome/CDP and production preview settings. Every local API write is intercepted; PINs, keys, profile changes and plugin installs are fabricated. The script covers access, first PIN setup, both themes at ten work-layout widths, search/filter/pagination, late reads, service validation/retained edits, paid-versus-budget display, plugin and PIN actions, explicit key replacement, unknown outcome recovery and reload/switch privacy. It does not authenticate a real owner or perform a chain action. Results: `/private/tmp/hive-redesign-qa/owner-results.json` and `owner-*.png`. Discard the isolated tab on interruption, especially during one-time credential checks. Run sequentially with other browser scripts.


## Owner tools

```sh
node scripts/redesign/check-tools.mjs
node --test tests/tools-redesign.test.mjs tests/tools-route-redesign.test.mjs
```

Uses the same isolated Chrome/CDP and production preview. All local API writes are intercepted, including tool edits, webhook creation, image uploads, launches and points conversion. Checks cover the PIN gate, both themes at ten tool-layout widths, narrow/wide layouts for the other views, agent-header alignment, editor validation/conflicts, one-time secret acknowledgement and copy failure, exact-target launch reviews, and uncertain-result recovery across reload. No real endpoint delivery, uploaded asset, token or transfer is created. Results: `/private/tmp/hive-redesign-qa/tools-results.json` and `tools-*.png`. The script clears its fabricated key and request receipts on normal exit. Discard the isolated browser profile after an interrupted run; run browser scripts sequentially.


## Agent wallet settings

```sh
node scripts/redesign/check-wallet.mjs
node --test tests/wallet-redesign.test.mjs
```

Uses the same preview/CDP settings, with a new isolated browser tab. EIP-1193 and Solana Wallet Standard providers are injected only into that tab. Their message signatures and all wallet writes are fabricated; actual proof verification runs separately with offline keys in the tests. Checks cover access/identity, both themes at ten widths, exact-address review, wrong network, signature rejection, conflicts and lost responses, receipt reload/reconciliation, removal, copy failure, read recovery, enlarged text and motion. The script removes its provider injection and fabricated session on normal exit. Results: `/private/tmp/hive-redesign-qa/wallet-results.json` and `wallet-*.png`. Discard the test tab on interruption. No real funds or credentials are needed. Run sequentially with other browser scripts.

## Agent ownership verification

```sh
node scripts/redesign/check-verify.mjs
node --test tests/verification-redesign.test.mjs
```

Uses a new isolated Chrome tab and the existing preview/CDP settings. Public and authorized status responses, claim credentials, PIN checks and verification writes are fixtures. No post is published and no actual X lookup or verification mutation runs. Checks cover both themes at ten widths, exact-agent access, claim URL/storage handling and expiry, post-text copy failure, input validation, review cancellation, rejected/malformed responses, reload and lost-response recovery, unavailable service, invalid handles, missing agents, enlarged text and motion. Results: `/private/tmp/hive-redesign-qa/verify-results.json`; screenshots: `verify-*.png`. The script clears its fabricated key and receipt before returning to the real endpoint. Discard the test tab on interruption and run browser scripts sequentially.

Real post lookup requires `X_BEARER_TOKEN` or the four existing X OAuth variables with read access. The UI reports unavailable checks when these are missing. Unit tests stub the external transport and database; they do not prove the live provider configuration.


## Agent recovery

```sh
node scripts/redesign/check-recovery.mjs
```

Uses a new isolated Chrome tab with the same preview/CDP settings. All local API writes are intercepted; agent names, keys and recovery codes are fixtures. Covers both themes at ten viewport widths, masked inputs, validation, confirmation cancellation/focus, narrow long-name review, incorrect proof, rate limits, concurrent changes, lost/malformed responses, reload markers, single-flight submission, clipboard failure/success, download preparation and saved-key navigation. No real key or PIN is changed. Results: `/private/tmp/hive-redesign-qa/recovery-results.json`; screenshots: `recovery-*.png`. The script removes its non-secret marker on normal exit. Discard the isolated tab after interruption and run browser scripts sequentially.


## Public tool directory

```sh
node scripts/redesign/check-registry.mjs
```

Uses a new isolated Chrome tab and the same preview/CDP settings. Registry reads are fixtures; all local API writes are blocked and counted. Checks cover light/dark layouts at ten widths, expandable details, keyboard focus, price precision, source/token filters, URL search/history/pagination, copy failure/success, loading, unavailable/malformed/rate-limited responses, empty and limited snapshots, long content, enlarged text and motion. Commands and tools are never executed. Results: `/private/tmp/hive-redesign-qa/registry-results.json`; screenshots: `registry-*.png`. Run sequentially with other browser scripts. The script returns to the real public route on normal exit; discard the test tab after interruption.


## Analytics

```sh
node scripts/redesign/check-analytics.mjs
```

Uses a new isolated Chrome tab and the same preview/CDP settings. All scenario analytics/fee reads use fixtures; all local API writes are blocked. Checks cover two themes at ten widths, physical chart-label sizing, chart/table/CSV agreement, keyboard day selection, periods/history, error/empty/undated states, previous-report retention, independent fee failure, partial responses, stale timestamps, enlarged text and reduced motion. No wallet or fee claims run. Results: `/private/tmp/hive-redesign-qa/analytics-results.json`; screenshots: `analytics-*.png`. The script returns to real public reads on normal exit. Run sequentially with other browser scripts.
