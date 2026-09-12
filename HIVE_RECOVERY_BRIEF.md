# Unit 13 — Agent recovery

Status: implemented and locally validated; ready for user review. Scope is `/agent/recover` and its existing recovery-code contract. Unit 14 requires the next review handoff. X API setup is deferred at the user's request.

## Research and contract audit

- The existing API accepts only recovery codes. Its wallet option was removed for lack of cryptographic proof, but the page still advertises it. Remove this unsupported control.
- Registration issues a 32-character hexadecimal recovery code. Recovery replaces the API key; it does not change the owner PIN or the recovery code. Preserve these semantics.
- The existing route checks its rate limit after looking up the agent, writes without a previous-state guard, and can report failure after the key changed if activity logging fails.
- [coss Field](https://coss.com/ui/docs/components/field) informs visible labels, connected descriptions and accessible validation. Use the established app typography and tokens, with a new task-focused form rather than legacy method cards.
- [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) informs generic credential errors, rate limiting before lookup, masked secrets and explicit recovery consequences. This change preserves the existing reusable offline recovery code; it does not add a new recovery policy.

## Design and implementation sequence

1. Use the approved app shell and a compact two-column workspace: recovery form and a plain explanation of which credentials change. Stack at phone widths. Both themes, visible focus, 44px controls, 16px inputs and reduced-motion support.
2. Keep agent name and masked recovery code in component memory. Allow reveal. Validate before a confirmation dialog. Explain old-key invalidation and unchanged PIN before submitting.
3. Make one request per explicit confirmation. Guard navigation during requests and while an unsaved key is displayed. Treat lost responses as uncertain; never automatically retry. A new deliberate attempt must explain that it replaces any key created by the prior request.
4. Show a validated response in a separate result view. Mask the new key by default, await clipboard success, provide manual selection on clipboard failure and an explicit download. Require saved-key acknowledgement before leaving for My agents. Do not automatically sign in or persist secrets.
5. Harden the existing route: bounded inputs, rate limit all attempts before lookup, exact escaped name plus recovery hash, proof-bound lookup, atomic previous-key/hash match, private response headers, safe failure logging and non-fatal activity logging after a successful replacement.
6. Test malformed/incorrect proof, rate limits, races, logging failure and result parsing. Intercept browser writes using fabricated credentials. Audit desktop/mobile, light/dark, dialog keyboard handling, validation, copy failure, uncertain results, duplicate submission and saved-key controls.

## Delivery limits

No actual agent key, recovery code, PIN, wallet or X configuration may be changed during QA. A local browser pass is not proof of a real recovery against the production database. Recovery cannot restore a lost PIN. The existing process-local rate limiter retains its deployment limitations.


## Validation — 2026-09-12

- Production build, TypeScript, scoped ESLint and `git diff --check` passed.
- 173 regression tests passed, including ten new recovery input/response and API cases.
- 51 production browser checks passed. Both themes were checked at 320, 375, 390, 600, 760, 768, 1024, 1100, 1280 and 1440px; narrow results, enlarged text and long-name confirmation also passed. Desktop, phone and result screenshots were visually reviewed.
- Six recovery writes were intercepted with fabricated credentials. No real database key, PIN, wallet or X mutation occurred. Clipboard rejection/success, file preparation, single-flight requests, confirmation focus, malformed identity responses and reload uncertainty passed.
- Build: `/private/tmp/hive-recovery-build.log`; types/lint: `hive-recovery-types.log` / `hive-recovery-lint.log`; regression log: `hive-recovery-tests.log`; browser report: `/private/tmp/hive-redesign-qa/recovery-results.json`. Repeatable browser script: `scripts/redesign/check-recovery.mjs`.

Review at http://localhost:3100/agent/recover or My agents → Recover access. Changes remain local and unpushed on `main_redesign`. Stop before Unit 14 (tool directory).
