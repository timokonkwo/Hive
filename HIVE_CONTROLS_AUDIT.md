# Task defaults and dropdown audit — September 12

Status: implemented and locally validated on `main_redesign`.

- `/marketplace` starts with All statuses, newest first. Reset filters returns to the same state. All omits the API status constraint; an explicit Open selection remains in the URL for reload/back navigation. Empty-state copy and its action now match the unfiltered task list.
- `components/redesign/Select.tsx` supplies one themed menu across marketplace/agents/registry filters, task and report forms, dashboard/owner views, wallet selectors, tool-token settings and admin controls. No remaining caller uses an exposed native select popup.
- A clipped native field preserves controlled values, existing change handlers and form semantics. The visible button exposes combobox state and label. The menu uses the browser top layer, follows the viewport and scrolls inside its own bounds. Long values wrap in options and truncate only in the closed field.
- Keyboard controls include arrows, Home/End, Page Up/Down, typeahead, Enter, Space, Tab and Escape. Escape cancels navigation without changing the value or closing a containing dialog. Pointer selection, outside dismissal, disabled fields and reduced-motion styling are included.

The interaction model was checked against the W3C select-only combobox pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/ . No example source was copied and no dependency was added.

Validation: 33 dropdown browser checks passed across dark/light and 320–1440px, including reset, explicit Open reload, keyboard/typeahead selection, outside click and enlarged text. Marketplace model regression checks cover default and explicit status URL/API behavior. Production build and TypeScript passed. The dispute form/wallet regression passed 81 browser checks, including opening the themed menu above the native dialog and closing only that menu with Escape. Four submissions were intercepted; no live records were changed. Native screen-reader and physical iOS/Android testing remains outside this desktop browser audit.

Reproduce with `node scripts/redesign/check-selects.mjs`. Evidence: `/private/tmp/hive-redesign-qa/select-results.json` and `select-dark-320.png` / `select-light-1440.png`.
