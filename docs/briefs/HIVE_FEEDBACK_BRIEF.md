# Public feedback redesign

Scope: Unit 20, /feedback. Keep POST /api/feedback and its bug/feature types, title (5–200 characters), description (10–2000 characters), optional contact and existing rate limit. No login requirement or backend changes.

Plan: shared app shell and theme tokens; compact page header; native radio group for report type; labeled fields with inline errors; preserve input on errors; synchronous in-flight guard; server-confirmed receipt and a deliberate new-report action. Contact remains in component state and is not stored in browser storage. Mobile fields use 16px text and full-width controls.

Validation: build and lint; browser checks for both themes, narrow screens, keyboard controls, validation, failed/rate-limited submissions, input retention, duplicate prevention and successful receipt using intercepted requests only.

Delivered: shared app shell, dual-theme form and receipt state implemented. Production build, scoped ESLint and diff checks pass. 23 browser assertions pass across 320, 390, 768 and 1440px in both themes, including field validation/focus, duplicate prevention, retained contact/message on failures, rate-limit copy, report-type changes, confirmed receipt focus and reset. Screenshots reviewed in desktop dark and mobile light; final verification also checks primary-button contrast. Submissions were intercepted; no real feedback was created. Local review: http://localhost:3102/feedback . Not pushed.
