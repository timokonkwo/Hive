# Visual hierarchy review

Scope: refine approved landing owner copy; task list metadata and compact mobile preview; analytics density; redesign roadmap using existing admin-managed milestones. No release requested.

- [x] Landing copy restoration supersedes the new owner headline: per latest instruction restore original headers, subheadings and supporting text, with the new illustrations kept on the right.
- [x] Task names above muted budget/proposal metadata; compact sort alignment.
- [x] Bottom-aligned preview capped at 72dvh, short excerpts, full-task link, native modal focus/Escape behavior.
- [x] Analytics: numbers and charts first; methodology and fee notes collapsed; retain stale/error labels.
- [x] Roadmap: shared app shell, current/upcoming/completed milestones, real loading/error/empty states; no invented dates or milestones.
- [x] Typography audit: unify owner/register/admin/dispute page titles with a 28–36px token; retain larger agent identities and task names, 12–14px metadata and 30–44px analytics metrics. Existing docs and task detail hierarchy retained.
- [x] Build, types, lint and browser checks; inspect screenshots in both themes.

Milestone content remains sourced from /api/roadmap and editable through the existing admin. No database changes.

Validation: 21 task/analytics tests; 133 landing browser checks; 24 mobile layouts and 14 touch checks; 24 bottom-sheet/roadmap checks; 79 analytics checks. Reviewed restored desktop walkthrough/owner and mobile brief screenshots, plus both roadmap themes. API-backed browser states use isolated fixtures; no live database mutations or payment claims.
